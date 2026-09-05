<?php
// ========================================
// ===== UPDATE BEACH CAPACITY API =====
// ========================================

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

if (!$db) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        
        if (!isset($data['beach_id']) || !isset($data['current_capacity'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Missing required fields: beach_id and current_capacity'
            ]);
            exit;
        }
        
        $beachId = intval($data['beach_id']);
        $currentCapacity = intval($data['current_capacity']);
        
        // Update capacity
        $stmt = $db->prepare("
            UPDATE beaches 
            SET current_capacity = :current_capacity 
            WHERE beach_id = :beach_id
        ");
        
        $stmt->execute([
            ':beach_id' => $beachId,
            ':current_capacity' => $currentCapacity
        ]);
        
        // Get updated beach data
        $beach = fetchOne("SELECT * FROM beaches WHERE beach_id = ?", [$beachId]);
        $remainingCapacity = $beach['max_capacity'] - $beach['current_capacity'];
        
        echo json_encode([
            'success' => true,
            'message' => 'Capacity updated successfully',
            'data' => [
                'current_capacity' => $beach['current_capacity'],
                'remaining_capacity' => $remainingCapacity
            ]
        ]);
        
    } catch (Exception $e) {
        error_log('Error in update-capacity.php: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Error: ' . $e->getMessage()
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
}
?>