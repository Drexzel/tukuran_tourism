<?php
// ========================================
// ===== ADMIN: DELETE BEACH OWNER ACCOUNT =====
// ========================================
// Used by the "Delete" action on Manage Beach Owners. Permanently removes
// the account after the admin confirms in the UI.

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$ownerId = isset($data['ownerId']) ? intval($data['ownerId']) : 0;

if (!$ownerId) {
    echo json_encode(['success' => false, 'message' => 'Owner id is required']);
    exit;
}

try {
    $stmt = $db->prepare("DELETE FROM beach_owners WHERE owner_id = :owner_id");
    $stmt->execute([':owner_id' => $ownerId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'No account found with that id']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Beach Owner account deleted successfully.'
    ]);
} catch (Exception $e) {
    error_log('Error in delete-beach-owner.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
