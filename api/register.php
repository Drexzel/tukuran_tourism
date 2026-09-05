<?php
// ========================================
// ===== SELF-REGISTRATION DISABLED =====
// ========================================
// Beach Owner accounts are now created only by the Tourism Personnel
// (Admin), via api/add-beach-owner.php from the "Manage Beach Owners"
// page. This endpoint is kept only to return a clear message to any
// old/cached page that still tries to call it.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

echo json_encode([
    'success' => false,
    'message' => 'Self-registration is no longer available. Beach Owner accounts are created by the Tourism Office - please contact them to request access.'
]);
?>
