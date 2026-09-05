<?php
// ========================================
// ===== UPDATE ACCOMMODATIONS API =====
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
        
        if (!isset($data['beach_id']) || !isset($data['accommodations'])) {
            echo json_encode([
                'success' => false,
                'message' => 'Missing required fields'
            ]);
            exit;
        }
        
        $beachId = intval($data['beach_id']);
        
        $db->beginTransaction();
        
        foreach ($data['accommodations'] as $acc) {
            if (isset($acc['type_id']) && isset($acc['available_units'])) {
                $stmt = $db->prepare("
                    UPDATE beach_accommodations 
                    SET available_units = :available_units 
                    WHERE beach_id = :beach_id AND type_id = :type_id
                ");
                
                $stmt->execute([
                    ':beach_id' => $beachId,
                    ':type_id' => $acc['type_id'],
                    ':available_units' => $acc['available_units']
                ]);
            }
        }
        
        $db->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Accommodations updated successfully'
        ]);
        
    } catch (Exception $e) {
        $db->rollBack();
        error_log('Error in update-accommodations.php: ' . $e->getMessage());
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