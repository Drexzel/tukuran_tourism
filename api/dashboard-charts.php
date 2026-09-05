<?php
// ========================================
// ===== DASHBOARD CHARTS API =====
// ========================================
// Feeds the three analytics charts on admin-dashboard.html with real
// numbers derived from reservations + walk_in_visits, instead of the
// random placeholder data the dashboard used to generate client-side.
//
// Usage:
//   dashboard-charts.php?type=most-visited|visitor-origin|gender-distribution|age-distribution
//   dashboard-charts.php?trend=monthly|yearly   (for the Monthly Visitor Trends chart)

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    if (isset($_GET['trend'])) {
        echo json_encode(['success' => true, 'data' => getTrendData($db, $_GET['trend'])]);
        exit;
    }

    $type = $_GET['type'] ?? 'most-visited';

    switch ($type) {
        case 'most-visited':
            echo json_encode(['success' => true, 'data' => getMostVisited($db)]);
            break;
        case 'beach-ranking':
            echo json_encode(['success' => true, 'data' => getBeachRanking($db)]);
            break;
        case 'visitor-origin':
            echo json_encode(['success' => true, 'data' => getVisitorOrigin($db)]);
            break;
        case 'gender-distribution':
            echo json_encode(['success' => true, 'data' => getGenderDistribution($db)]);
            break;
        case 'age-distribution':
            echo json_encode(['success' => true, 'data' => getAgeDistribution($db)]);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Unknown chart type']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

// Total visitors per beach = walk-ins + confirmed reservations (all time)
function getMostVisited($db) {
    $rows = $db->query("
        SELECT b.beach_name,
            COALESCE(w.walkin_total, 0) + COALESCE(r.reservation_total, 0) AS total_visitors
        FROM beaches b
        LEFT JOIN (
            SELECT beach_id, SUM(total_visitors) AS walkin_total
            FROM walk_in_visits GROUP BY beach_id
        ) w ON w.beach_id = b.beach_id
        LEFT JOIN (
            SELECT beach_id, SUM(num_visitors) AS reservation_total
            FROM reservations WHERE status IN ('Confirmed', 'Completed') GROUP BY beach_id
        ) r ON r.beach_id = b.beach_id
        WHERE b.status = 'Active'
        ORDER BY total_visitors DESC
        LIMIT 8
    ")->fetchAll(PDO::FETCH_ASSOC);

    return [
        'labels' => array_map(fn($r) => $r['beach_name'], $rows),
        'values' => array_map(fn($r) => (int) $r['total_visitors'], $rows)
    ];
}

// Beach Ranking (Most Visited Beaches, dashboard top section).
// Like getMostVisited() but returns EVERY participating (Active) beach - no
// LIMIT - ranked highest-to-lowest, plus the total number of participating
// beaches. Total visitors per beach = walk-ins + Approved (Confirmed)
// reservations, computed fresh on each request so the ranking stays
// real-time as reservation/walk-in data changes.
function getBeachRanking($db) {
    $rows = $db->query("
        SELECT b.beach_name,
            COALESCE(w.walkin_total, 0) + COALESCE(r.reservation_total, 0) AS total_visitors
        FROM beaches b
        LEFT JOIN (
            SELECT beach_id, SUM(total_visitors) AS walkin_total
            FROM walk_in_visits GROUP BY beach_id
        ) w ON w.beach_id = b.beach_id
        LEFT JOIN (
            SELECT beach_id, SUM(num_visitors) AS reservation_total
            FROM reservations WHERE status IN ('Confirmed', 'Completed') GROUP BY beach_id
        ) r ON r.beach_id = b.beach_id
        WHERE b.status = 'Active'
        ORDER BY total_visitors DESC, b.beach_name ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    return [
        'labels' => array_map(fn($r) => $r['beach_name'], $rows),
        'values' => array_map(fn($r) => (int) $r['total_visitors'], $rows),
        'total_beaches' => count($rows)
    ];
}

// Visitor origin combined from both walk-in and reservation records
function getVisitorOrigin($db) {
    $rows = $db->query("
        SELECT origin, SUM(cnt) AS total FROM (
            SELECT NULLIF(TRIM(origin), '') AS origin, SUM(total_visitors) AS cnt
            FROM walk_in_visits GROUP BY origin
            UNION ALL
            SELECT NULLIF(TRIM(origin), '') AS origin, SUM(num_visitors) AS cnt
            FROM reservations WHERE status IN ('Confirmed', 'Completed') GROUP BY origin
        ) combined
        WHERE origin IS NOT NULL
        GROUP BY origin
        ORDER BY total DESC
        LIMIT 8
    ")->fetchAll(PDO::FETCH_ASSOC);

    return [
        'labels' => array_map(fn($r) => $r['origin'], $rows),
        'values' => array_map(fn($r) => (int) $r['total'], $rows)
    ];
}

function getGenderDistribution($db) {
    $walkin = $db->query("
        SELECT COALESCE(SUM(male_count),0) AS male, COALESCE(SUM(female_count),0) AS female
        FROM walk_in_visits
    ")->fetch(PDO::FETCH_ASSOC);

    $reservation = $db->query("
        SELECT COALESCE(SUM(male_count),0) AS male, COALESCE(SUM(female_count),0) AS female
        FROM reservations WHERE status IN ('Confirmed', 'Completed')
    ")->fetch(PDO::FETCH_ASSOC);

    return [
        'labels' => ['Male', 'Female'],
        'values' => [
            (int) $walkin['male'] + (int) $reservation['male'],
            (int) $walkin['female'] + (int) $reservation['female']
        ]
    ];
}

// Age Bracket / Guest Breakdown is captured on both the Walk-in
// Registration form and the Reservation form and stored as six raw
// database columns (age_kids, age_teens, age_adults_18_25,
// age_adults_26_40, age_adults_41_59, age_seniors - see
// database/migration_age_brackets.sql). The forms themselves only ever
// show guests/staff four groups - Kids (0-12), Teen (13-17),
// Adult (18-59), Senior (60+) - so the three adult sub-columns are summed
// back into one Adult (18-59) bucket here, same buckets and same source
// tables as api/reports.php's getAgeDistribution(), so the Dashboard and
// Automated Reports always agree with each other.
function getAgeDistribution($db) {
    $bucketCols = [
        'Kids (0-12)'  => ['age_kids'],
        'Teen (13-17)' => ['age_teens'],
        'Adult (18-59)'=> ['age_adults_18_25', 'age_adults_26_40', 'age_adults_41_59'],
        'Senior (60+)' => ['age_seniors']
    ];
    $allCols = array_merge(...array_values($bucketCols));
    $bracketCols = implode(', ', array_map(function ($col) {
        return "COALESCE(SUM($col), 0) AS $col";
    }, $allCols));

    $w = $db->query("SELECT $bracketCols FROM walk_in_visits")->fetch(PDO::FETCH_ASSOC);
    $r = $db->query("SELECT $bracketCols FROM reservations WHERE status IN ('Confirmed', 'Completed')")->fetch(PDO::FETCH_ASSOC);

    $labels = [];
    $values = [];
    foreach ($bucketCols as $label => $cols) {
        $count = 0;
        foreach ($cols as $col) {
            $count += (int) $w[$col] + (int) $r[$col];
        }
        $labels[] = $label;
        $values[] = $count;
    }

    return ['labels' => $labels, 'values' => $values];
}

// Monthly/yearly visitor trend combining walk-ins + confirmed reservations
function getTrendData($db, $period) {
    if ($period === 'yearly') {
        $rows = $db->query("
            SELECT period, SUM(cnt) AS total FROM (
                SELECT YEAR(visit_date) AS period, SUM(total_visitors) AS cnt
                FROM walk_in_visits GROUP BY YEAR(visit_date)
                UNION ALL
                SELECT YEAR(reservation_date) AS period, SUM(num_visitors) AS cnt
                FROM reservations WHERE status IN ('Confirmed', 'Completed') GROUP BY YEAR(reservation_date)
            ) combined
            GROUP BY period
            ORDER BY period ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        return [
            'labels' => array_map(fn($r) => (string) $r['period'], $rows),
            'values' => array_map(fn($r) => (int) $r['total'], $rows)
        ];
    }

    // Default: monthly, for the last 12 months ending this month
    $rows = $db->query("
        SELECT period, SUM(cnt) AS total FROM (
            SELECT DATE_FORMAT(visit_date, '%Y-%m') AS period, SUM(total_visitors) AS cnt
            FROM walk_in_visits GROUP BY period
            UNION ALL
            SELECT DATE_FORMAT(reservation_date, '%Y-%m') AS period, SUM(num_visitors) AS cnt
            FROM reservations WHERE status IN ('Confirmed', 'Completed') GROUP BY period
        ) combined
        WHERE period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m')
        GROUP BY period
        ORDER BY period ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    return [
        'labels' => array_map(fn($r) => $r['period'], $rows),
        'values' => array_map(fn($r) => (int) $r['total'], $rows)
    ];
}
?>
