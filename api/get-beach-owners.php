<?php
// ========================================
// ===== ADMIN: LIST BEACH OWNER ACCOUNTS =====
// ========================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

try {
    $stmt = $db->query("
        SELECT o.owner_id, o.resort_name, o.owner_name, o.email, o.phone_number,
               o.username, o.status, o.created_at, o.beach_id, b.beach_name
        FROM beach_owners o
        LEFT JOIN beaches b ON o.beach_id = b.beach_id
        ORDER BY o.created_at DESC
    ");
    $owners = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $owners
    ]);
} catch (Exception $e) {
    error_log('Error in get-beach-owners.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
