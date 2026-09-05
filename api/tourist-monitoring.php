<?php
// ========================================
// ===== TOURIST MONITORING API =====
// ========================================
// Powers Tourism Personnel/tourist-monitoring.html's visitor records table.
// That page used to show hardcoded sample rows with no connection to the
// database at all - this endpoint builds the real list from the same two
// tables every other module in the system already reads from:
//   - reservations   (status IN ('Confirmed', 'Completed'), i.e. approved
//                      by a Beach Owner - matches how "visitors" are
//                      counted everywhere else, e.g. dashboard-stats.php.
//                      A reservation later marked Completed by the Beach
//                      Owner is still a real, realized visit and must not
//                      disappear from this list.)
//   - walk_in_visits  (every walk-in registration is already a realized
//                      visit, so all rows count)
//
// Neither table stores a separate row per individual tourist (each
// reservation/walk-in is one party led by one registering guest, with
// aggregate male_count/female_count and, for walk-ins, local/foreign
// counts) - so this endpoint reports at that same party level rather than
// inventing per-person data that was never collected.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $gender = isset($_GET['gender']) ? trim($_GET['gender']) : '';   // 'Male' | 'Female' | ''
    $type = isset($_GET['type']) ? trim($_GET['type']) : '';         // 'Local' | 'Foreign' | ''
    $origin = isset($_GET['origin']) ? trim($_GET['origin']) : '';
    $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;

    // ----- Pull confirmed (approved) reservations, one row per party -----
    $resSql = "
        SELECT
            r.full_name        AS full_name,
            r.male_count        AS male_count,
            r.female_count      AS female_count,
            NULL                AS age,
            r.origin            AS origin,
            r.local_visitors    AS local_visitors,
            r.foreign_visitors  AS foreign_visitors,
            r.num_visitors      AS num_visitors,
            r.reservation_date  AS visit_date,
            b.beach_name        AS beach_name,
            'Reservation'       AS source
        FROM reservations r
        JOIN beaches b ON r.beach_id = b.beach_id
        WHERE r.status IN ('Confirmed', 'Completed')
    ";
    $resParams = [];
    if ($beachId) {
        $resSql .= " AND r.beach_id = ?";
        $resParams[] = $beachId;
    }

    // ----- Pull walk-in registrations, one row per party -----
    $walkinSql = "
        SELECT
            w.guest_name        AS full_name,
            w.male_count        AS male_count,
            w.female_count      AS female_count,
            w.age               AS age,
            w.origin            AS origin,
            w.local_visitors    AS local_visitors,
            w.foreign_visitors  AS foreign_visitors,
            w.total_visitors    AS num_visitors,
            w.visit_date        AS visit_date,
            b.beach_name        AS beach_name,
            'Walk-in'           AS source
        FROM walk_in_visits w
        JOIN beaches b ON w.beach_id = b.beach_id
        WHERE 1=1
    ";
    $walkinParams = [];
    if ($beachId) {
        $walkinSql .= " AND w.beach_id = ?";
        $walkinParams[] = $beachId;
    }

    $resStmt = $db->prepare($resSql);
    $resStmt->execute($resParams);
    $reservationRows = $resStmt->fetchAll(PDO::FETCH_ASSOC);

    $walkinStmt = $db->prepare($walkinSql);
    $walkinStmt->execute($walkinParams);
    $walkinRows = $walkinStmt->fetchAll(PDO::FETCH_ASSOC);

    $allRows = array_merge($reservationRows, $walkinRows);

    // ----- Derive Gender + Type labels from the recorded aggregate counts -----
    // (no per-individual gender/nationality is collected anywhere in the
    // system, so these reflect the composition of the party, not a single
    // person - e.g. "Mixed" means the party included both men and women).
    foreach ($allRows as &$row) {
        $male = (int) ($row['male_count'] ?? 0);
        $female = (int) ($row['female_count'] ?? 0);
        if ($male > 0 && $female > 0) {
            $row['gender_label'] = 'Mixed';
        } elseif ($male > 0) {
            $row['gender_label'] = 'Male';
        } elseif ($female > 0) {
            $row['gender_label'] = 'Female';
        } else {
            $row['gender_label'] = 'Not recorded';
        }

        $local = $row['local_visitors'] !== null ? (int) $row['local_visitors'] : null;
        $foreign = $row['foreign_visitors'] !== null ? (int) $row['foreign_visitors'] : null;
        if ($local === null && $foreign === null) {
            // Reservations don't track local/foreign split at all.
            $row['type_label'] = 'Not specified';
        } elseif ($local > 0 && $foreign > 0) {
            $row['type_label'] = 'Mixed';
        } elseif ($foreign > 0) {
            $row['type_label'] = 'Foreign';
        } elseif ($local > 0) {
            $row['type_label'] = 'Local';
        } else {
            $row['type_label'] = 'Not specified';
        }

        $row['age_label'] = ($row['age'] !== null && $row['age'] !== '') ? (string) $row['age'] : 'Not recorded';
    }
    unset($row);

    // ----- Apply filters (search / gender / type / origin) -----
    if ($search !== '') {
        $needle = mb_strtolower($search);
        $allRows = array_values(array_filter($allRows, function ($row) use ($needle) {
            return mb_strpos(mb_strtolower($row['full_name'] ?? ''), $needle) !== false;
        }));
    }
    if ($gender !== '') {
        $allRows = array_values(array_filter($allRows, function ($row) use ($gender) {
            return $row['gender_label'] === $gender || $row['gender_label'] === 'Mixed';
        }));
    }
    if ($type !== '') {
        $allRows = array_values(array_filter($allRows, function ($row) use ($type) {
            return $row['type_label'] === $type || $row['type_label'] === 'Mixed';
        }));
    }
    if ($origin !== '') {
        $needle = mb_strtolower($origin);
        $allRows = array_values(array_filter($allRows, function ($row) use ($needle) {
            return mb_strpos(mb_strtolower($row['origin'] ?? ''), $needle) !== false;
        }));
    }

    // ----- Sort by most recent visit date first -----
    usort($allRows, function ($a, $b) {
        return strcmp($b['visit_date'], $a['visit_date']);
    });

    echo json_encode([
        'success' => true,
        'data' => array_values($allRows),
        'total' => count($allRows)
    ]);
} catch (Exception $e) {
    error_log('Error in tourist-monitoring.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
