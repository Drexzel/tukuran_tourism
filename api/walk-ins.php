<?php
// ========================================
// ===== WALK-IN VISITS API =====
// ========================================
// Persists walk-in guest registrations submitted through the Beach Owner
// page's walk-in-registration.html, and is queried by the Tourism
// Personnel Dashboard (via dashboard-stats.php) for "Today's Visitors"
// and "Monthly Visitors".

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getWalkIns($db);
        break;
    case 'POST':
        createWalkIn($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function getWalkIns($db) {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;
        $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : null;
        $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : null;

        $sql = "
            SELECT w.*, b.beach_name
            FROM walk_in_visits w
            JOIN beaches b ON w.beach_id = b.beach_id
            WHERE 1=1
        ";
        $params = [];

        if ($beachId) {
            $sql .= " AND w.beach_id = ?";
            $params[] = $beachId;
        }
        if ($dateFrom) {
            $sql .= " AND w.visit_date >= ?";
            $params[] = $dateFrom;
        }
        if ($dateTo) {
            $sql .= " AND w.visit_date <= ?";
            $params[] = $dateTo;
        }

        $sql .= " ORDER BY w.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $walkIns = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $walkIns]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function createWalkIn($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['beach_id', 'total_visitors'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
                return;
            }
        }

        $visitDate = $data['visit_date'] ?? date('Y-m-d');

        // ----- Guest Type (Local / Foreign) -----
        // Same rule as the Reservation Form: local_visitors + foreign_visitors
        // must always equal total_visitors (Total Guests) so no visitor is
        // ever double-counted or dropped. The form already enforces this
        // client-side; this re-derives/clamps it server-side too so a direct
        // API call can't desync the two figures.
        $totalVisitors = intval($data['total_visitors']);
        $foreignVisitors = intval($data['foreign_visitors'] ?? 0);
        if ($foreignVisitors < 0) $foreignVisitors = 0;
        if ($foreignVisitors > $totalVisitors) $foreignVisitors = $totalVisitors;
        $localVisitors = $totalVisitors - $foreignVisitors;

        $stmt = $db->prepare("
            INSERT INTO walk_in_visits (
                beach_id, guest_name, age, total_visitors, male_count, female_count,
                age_kids, age_teens, age_adults_18_25, age_adults_26_40, age_adults_41_59, age_seniors,
                origin, local_visitors, foreign_visitors, accommodation_type, visit_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            intval($data['beach_id']),
            $data['guest_name'] ?? '',
            isset($data['age']) && $data['age'] !== '' ? intval($data['age']) : null,
            $totalVisitors,
            intval($data['male_count'] ?? 0),
            intval($data['female_count'] ?? 0),
            // Age Bracket / Guest Breakdown counts (default 0 when not sent)
            intval($data['age_kids'] ?? 0),
            intval($data['age_teens'] ?? 0),
            intval($data['age_adults_18_25'] ?? 0),
            intval($data['age_adults_26_40'] ?? 0),
            intval($data['age_adults_41_59'] ?? 0),
            intval($data['age_seniors'] ?? 0),
            $data['origin'] ?? '',
            $localVisitors,
            $foreignVisitors,
            $data['accommodation_type'] ?? '',
            $visitDate
        ]);

        $walkInId = $db->lastInsertId();

        // Bump the beach's live visitor count so Capacity Monitoring /
        // Beach Occupancy stay in sync with newly registered walk-ins.
        $updateCapacity = $db->prepare("
            UPDATE beaches
            SET current_capacity = current_capacity + ?
            WHERE beach_id = ?
        ");
        $updateCapacity->execute([$totalVisitors, intval($data['beach_id'])]);

        echo json_encode([
            'success' => true,
            'message' => 'Walk-in guest registered successfully',
            'walkin_id' => $walkInId
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>
