<?php
// ========================================
// ===== BEACH OWNER DASHBOARD STATS API =====
// ========================================
// Powers beach-owner-dashboard.html's six summary cards, its integrated
// Capacity Monitoring section (max capacity/status/accommodation
// availability - previously its own standalone page), and the Recent
// Activity table, scoped to a single beach_id (the beach assigned to the
// logged-in Beach Owner - see Beach owner page/beach-session.js on the
// front end). Every value is computed fresh from the database on each
// request so it reflects new walk-ins/reservations immediately.

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

$beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : 0;
if (!$beachId) {
    echo json_encode(['success' => false, 'message' => 'beach_id is required']);
    exit;
}

try {
    $beachStmt = $db->prepare("SELECT beach_id, beach_name, max_capacity, current_capacity FROM beaches WHERE beach_id = ?");
    $beachStmt->execute([$beachId]);
    $beach = $beachStmt->fetch(PDO::FETCH_ASSOC);

    if (!$beach) {
        echo json_encode(['success' => false, 'message' => 'Beach not found']);
        exit;
    }

    // ----- Today's Visitors: walk-ins today + confirmed reservations for today -----
    $walkInsTodayStmt = $db->prepare("
        SELECT COALESCE(SUM(total_visitors), 0) AS total
        FROM walk_in_visits WHERE beach_id = ? AND visit_date = CURDATE()
    ");
    $walkInsTodayStmt->execute([$beachId]);
    $walkInsToday = (int) $walkInsTodayStmt->fetch(PDO::FETCH_ASSOC)['total'];

    $resTodayStmt = $db->prepare("
        SELECT COALESCE(SUM(num_visitors), 0) AS total
        FROM reservations
        WHERE beach_id = ? AND status IN ('Confirmed', 'Completed') AND reservation_date = CURDATE()
    ");
    $resTodayStmt->execute([$beachId]);
    $reservationsToday = (int) $resTodayStmt->fetch(PDO::FETCH_ASSOC)['total'];

    $todayVisitors = $walkInsToday + $reservationsToday;

    // ----- Reservations: approved reservations for this beach (all time) -----
    // Includes both 'Confirmed' (approved) and 'Completed' (approved and
    // the visit already happened) - marking a reservation Completed must
    // not make it drop out of this count.
    $confirmedStmt = $db->prepare("
        SELECT COUNT(*) AS c FROM reservations WHERE beach_id = ? AND status IN ('Confirmed', 'Completed')
    ");
    $confirmedStmt->execute([$beachId]);
    $totalReservations = (int) $confirmedStmt->fetch(PDO::FETCH_ASSOC)['c'];

    // ----- Walk-in Guests: total walk-in visitors registered today -----
    $walkinGuestsToday = $walkInsToday;

    // ----- Pending Bookings -----
    $pendingStmt = $db->prepare("
        SELECT COUNT(*) AS c FROM reservations WHERE beach_id = ? AND status = 'Pending'
    ");
    $pendingStmt->execute([$beachId]);
    $pendingBookings = (int) $pendingStmt->fetch(PDO::FETCH_ASSOC)['c'];

    // ----- Beach Occupancy % and Remaining Slots -----
    // Uses the same live, database-driven calculation (Confirmed
    // reservations + walk-ins for TODAY, against Max Capacity) as the
    // Tourism Personnel Dashboard and Automated Reports, so this card
    // never disagrees with those - and it updates the moment a walk-in
    // is registered or a reservation is approved, unlike the old static
    // beaches.current_capacity counter.
    $occupancy = getBeachOccupancyToday($db, $beachId);
    $maxCapacity = $occupancy ? $occupancy['max_capacity'] : (int) $beach['max_capacity'];
    $capacityPercent = $occupancy ? $occupancy['percentage'] : 0;
    $remainingSlots = $occupancy ? max($maxCapacity - $occupancy['occupied'], 0) : $maxCapacity;

    // ----- Accommodation Availability -----
    // Whatever accommodation types this beach has configured in Beach
    // Management (any name - not just a fixed list). available_units is
    // computed live from actual Confirmed reservations + today's walk-ins
    // (see getBeachAccommodationAvailability() in db_connection.php), so
    // the Dashboard's Capacity Monitoring section always matches the
    // Reservation Form, the Walk-in Guests form, and Beach Management.
    $accommodations = getBeachAccommodationAvailability($db, $beachId);

    // ----- Recent Activity: latest walk-ins + reservations for this beach -----
    $recentStmt = $db->prepare("
        (SELECT 'Walk-in' AS type, guest_name AS guest_name, total_visitors AS visitors,
                'Checked In' AS status, created_at
         FROM walk_in_visits WHERE beach_id = ?)
        UNION ALL
        (SELECT 'Reservation' AS type, full_name AS guest_name, num_visitors AS visitors,
                status AS status, created_at
         FROM reservations WHERE beach_id = ?)
        ORDER BY created_at DESC
        LIMIT 8
    ");
    $recentStmt->execute([$beachId, $beachId]);
    $recentActivity = $recentStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'beach_id' => (int) $beach['beach_id'],
            'beach_name' => $beach['beach_name'],
            'today_visitors' => $todayVisitors,
            'total_reservations' => $totalReservations,
            'walkin_guests' => $walkinGuestsToday,
            'current_capacity_percent' => $capacityPercent,
            'pending_bookings' => $pendingBookings,
            'remaining_slots' => $remainingSlots,
            'max_capacity' => $maxCapacity,
            'accommodations' => $accommodations,
            'recent_activity' => $recentActivity
        ]
    ]);
} catch (Exception $e) {
    error_log('Error in owner-dashboard-stats.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
