<?php
// ========================================
// ===== BEACH DEACTIVATE / ACTIVATE API =====
// ========================================
// Replaces the old "Delete Beach" action in Beach Management. A beach is
// never permanently removed from here - this only flips beaches.status
// between 'Active' and 'Inactive' (the same status column/values the
// system already had). Every other page (Landing Page, Browse All
// Beaches, Beach Details, Reservation Form, Beach Owner pages, Tourism
// Personnel Dashboard) already reads this same status via
// get-beaches.php, so flipping it here is automatically reflected
// everywhere without any other change.
//
// Deactivating additionally checks for active reservations (Pending or
// Confirmed - i.e. not yet Cancelled/Expired) first. If any exist, it
// reports them back instead of deactivating, so Tourism Personnel can
// review them and explicitly confirm before proceeding. Reservation
// records themselves are never modified, deleted, or touched by this
// endpoint - they stay exactly as they are for monitoring, reporting and
// history, and continue to be managed through the existing reservation
// workflow.

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}

$beachId = isset($data['beach_id']) ? intval($data['beach_id']) : 0;
$action = isset($data['action']) ? $data['action'] : '';
$confirm = !empty($data['confirm']);

if (!$beachId) {
    echo json_encode(['success' => false, 'message' => 'beach_id is required']);
    exit;
}

if (!in_array($action, ['deactivate', 'activate'], true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    exit;
}

try {
    $beachStmt = $db->prepare("SELECT beach_id, beach_name, status FROM beaches WHERE beach_id = ?");
    $beachStmt->execute([$beachId]);
    $beach = $beachStmt->fetch(PDO::FETCH_ASSOC);

    if (!$beach) {
        echo json_encode(['success' => false, 'message' => 'Beach not found']);
        exit;
    }

    if ($action === 'activate') {
        $db->prepare("UPDATE beaches SET status = 'Active' WHERE beach_id = ?")->execute([$beachId]);
        echo json_encode([
            'success' => true,
            'message' => $beach['beach_name'] . ' is now active and accepting reservations again.',
            'status' => 'Active'
        ]);
        exit;
    }

    // ----- action === 'deactivate' -----
    // Active reservations = Pending or Confirmed (i.e. not yet Cancelled or
    // Expired). These are the statuses the system uses for reservations
    // that haven't been completed, cancelled, rejected or expired.
    $activeStmt = $db->prepare("
        SELECT reservation_id, full_name, reservation_date, num_visitors, status
        FROM reservations
        WHERE beach_id = ? AND status IN ('Pending', 'Confirmed')
        ORDER BY reservation_date ASC
    ");
    $activeStmt->execute([$beachId]);
    $activeReservations = $activeStmt->fetchAll(PDO::FETCH_ASSOC);
    $activeCount = count($activeReservations);

    if ($activeCount > 0 && !$confirm) {
        // Don't deactivate yet - let Tourism Personnel review the active
        // reservations first and explicitly confirm.
        echo json_encode([
            'success' => false,
            'requires_confirmation' => true,
            'active_count' => $activeCount,
            'active_reservations' => array_slice($activeReservations, 0, 10),
            'message' => $beach['beach_name'] . ' has ' . $activeCount . ' active reservation(s).'
        ]);
        exit;
    }

    $db->prepare("UPDATE beaches SET status = 'Inactive' WHERE beach_id = ?")->execute([$beachId]);

    echo json_encode([
        'success' => true,
        'message' => $beach['beach_name'] . ' has been deactivated. It no longer accepts new reservations.',
        'status' => 'Inactive',
        'active_count' => $activeCount
    ]);
} catch (Exception $e) {
    error_log('Error in beach-status.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
