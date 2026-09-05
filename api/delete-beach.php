<?php
// ========================================
// ===== DELETE BEACH API =====
// ========================================
// Permanently deletes a beach from Beach Management. The database
// foreign keys already cascade-delete beach_images/beach_amenities/
// beach_accommodations/reservations/walk_in_visits/incident_reports/
// reviews/beach_rankings rows, and set any linked beach_owners.beach_id
// to NULL (see database/tukuran_tourism.sql's fk_owner_beach
// constraint) - this endpoint additionally removes the physical image
// files from disk, since the cascade only removes the database rows.

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
$beachId = isset($data['beach_id']) ? intval($data['beach_id']) : 0;

if (!$beachId) {
    echo json_encode(['success' => false, 'message' => 'beach_id is required']);
    exit;
}

try {
    $imgStmt = $db->prepare("SELECT image_url FROM beach_images WHERE beach_id = ?");
    $imgStmt->execute([$beachId]);
    $imagesToDelete = $imgStmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $db->prepare("DELETE FROM beaches WHERE beach_id = ?");
    $stmt->execute([$beachId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Beach not found']);
        exit;
    }

    foreach ($imagesToDelete as $row) {
        $absolutePath = __DIR__ . '/../' . ltrim(str_replace('../', '', $row['image_url']), '/');
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Beach deleted successfully.'
    ]);
} catch (Exception $e) {
    error_log('Error in delete-beach.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
