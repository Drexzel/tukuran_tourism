<?php
// ========================================
// ===== TOURISM PERSONNEL DASHBOARD STATS API =====
// ========================================
// Powers the six summary cards on admin-dashboard.html. Every value here
// is computed fresh from the database on each request, so the dashboard
// stays accurate as beaches, reservations, and walk-in registrations are
// added or modified (the front-end polls this endpoint periodically to
// keep the numbers current without a manual page reload).

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');
// Always compute fresh - never let the browser/proxy serve a stale cached
// copy of these numbers (this is what makes "Total Beaches" etc. update
// immediately after a beach is added/edited in Beach Management).
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // ----- Total Beaches: matches Beach Management, which (via
        // get-beaches.php) only ever lists/counts beaches with
        // status = 'Active'. Counting all statuses here would make this
        // card disagree with what Beach Management actually shows. -----
        $totalBeaches = (int) $db->query("SELECT COUNT(*) AS c FROM beaches WHERE status = 'Active'")->fetch(PDO::FETCH_ASSOC)['c'];

        // ----- Today's Visitors: walk-ins today + confirmed reservations for today -----
        $walkInsToday = (int) $db->query("
            SELECT COALESCE(SUM(total_visitors), 0) AS total
            FROM walk_in_visits
            WHERE visit_date = CURDATE()
        ")->fetch(PDO::FETCH_ASSOC)['total'];

        $reservationsToday = (int) $db->query("
            SELECT COALESCE(SUM(num_visitors), 0) AS total
            FROM reservations
            WHERE status IN ('Confirmed', 'Completed') AND reservation_date = CURDATE()
        ")->fetch(PDO::FETCH_ASSOC)['total'];

        $todayVisitors = $walkInsToday + $reservationsToday;

        // ----- Total Reservations: all approved reservations (all time) -----
        // Counts both 'Confirmed' (approved, upcoming/ongoing) and
        // 'Completed' (approved and the visit already happened) - a
        // Beach Owner marking a reservation Completed should never make
        // it disappear from this count.
        $totalReservations = (int) $db->query("
            SELECT COUNT(*) AS c FROM reservations WHERE status IN ('Confirmed', 'Completed')
        ")->fetch(PDO::FETCH_ASSOC)['c'];

        // ----- Monthly Visitors: walk-ins + confirmed/completed reservations this calendar month -----
        $walkInsMonth = (int) $db->query("
            SELECT COALESCE(SUM(total_visitors), 0) AS total
            FROM walk_in_visits
            WHERE MONTH(visit_date) = MONTH(CURDATE()) AND YEAR(visit_date) = YEAR(CURDATE())
        ")->fetch(PDO::FETCH_ASSOC)['total'];

        $reservationsMonth = (int) $db->query("
            SELECT COALESCE(SUM(num_visitors), 0) AS total
            FROM reservations
            WHERE status IN ('Confirmed', 'Completed')
              AND MONTH(reservation_date) = MONTH(CURDATE())
              AND YEAR(reservation_date) = YEAR(CURDATE())
        ")->fetch(PDO::FETCH_ASSOC)['total'];

        $monthlyVisitors = $walkInsMonth + $reservationsMonth;

        // ----- Remaining Slots / At Capacity -----
        // Same live, database-driven occupancy calculation used by
        // Automated Reports and the Beach Owner Dashboard (Confirmed
        // reservations + walk-ins for TODAY, against Max Capacity), so
        // this card always agrees with them and updates the moment a
        // visitor record changes.
        $occupancyByBeach = getBeachOccupancyToday($db);

        $remainingSlots = 0;
        $atCapacity = 0;
        foreach ($occupancyByBeach as $beachOccupancy) {
            $remainingSlots += max($beachOccupancy['max_capacity'] - $beachOccupancy['occupied'], 0);
            if ($beachOccupancy['max_capacity'] > 0 && $beachOccupancy['occupied'] >= $beachOccupancy['max_capacity']) {
                $atCapacity++;
            }
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'total_beaches'      => $totalBeaches,
                'today_visitors'     => $todayVisitors,
                'total_reservations' => $totalReservations,
                'monthly_visitors'   => $monthlyVisitors,
                'remaining_slots'    => $remainingSlots,
                'at_capacity'        => $atCapacity
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
}
?>
