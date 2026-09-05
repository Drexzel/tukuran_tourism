<?php
// ========================================
// ===== ADMIN: UPDATE BEACH OWNER ACCOUNT =====
// ========================================
// Used by the "Edit" action on Manage Beach Owners. Updates the editable
// profile fields; the password is intentionally left alone here since it
// is stored as a one-way hash (see add-beach-owner.php) - resetting it is
// a separate, explicit action, not a silent side effect of an info edit.

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$ownerId = isset($data['ownerId']) ? intval($data['ownerId']) : 0;
$resortName = trim($data['resortName'] ?? '');
$ownerName = trim($data['ownerName'] ?? '');
$email = trim($data['email'] ?? '');
$phoneNumber = trim($data['phoneNumber'] ?? '');
$beachId = isset($data['beachId']) && $data['beachId'] !== '' ? intval($data['beachId']) : null;
$status = $data['status'] ?? 'Active';

if (!$ownerId || !$resortName || !$ownerName || !$email) {
    echo json_encode(['success' => false, 'message' => 'Owner id, resort name, owner name, and email are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Please provide a valid email address']);
    exit;
}

if (!in_array($status, ['Active', 'Pending', 'Suspended'], true)) {
    $status = 'Active';
}

try {
    // Make sure no other account already uses this email
    $stmt = $db->prepare("SELECT owner_id FROM beach_owners WHERE email = :email AND owner_id != :owner_id LIMIT 1");
    $stmt->execute([':email' => $email, ':owner_id' => $ownerId]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Another account already uses that email address']);
        exit;
    }

    $stmt = $db->prepare("
        UPDATE beach_owners
        SET resort_name = :resort_name,
            owner_name = :owner_name,
            email = :email,
            phone_number = :phone_number,
            beach_id = :beach_id,
            status = :status
        WHERE owner_id = :owner_id
    ");
    $stmt->execute([
        ':resort_name' => $resortName,
        ':owner_name' => $ownerName,
        ':email' => $email,
        ':phone_number' => $phoneNumber,
        ':beach_id' => $beachId,
        ':status' => $status,
        ':owner_id' => $ownerId
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Beach Owner account updated successfully.'
    ]);
} catch (Exception $e) {
    error_log('Error in update-beach-owner.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
