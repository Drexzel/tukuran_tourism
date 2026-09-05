<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ===== FIX: Include database connection with proper path =====
$dbPath = realpath(__DIR__ . '/../includes/db_connection.php');
if (!$dbPath || !file_exists($dbPath)) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection file not found'
    ]);
    exit;
}

require_once $dbPath;

$db = getDB();

if (!$db) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]);
    exit;
}

try {
    // Check if table exists
    $stmt = $db->prepare("SHOW TABLES LIKE 'accommodation_types'");
    $stmt->execute();
    $tableExists = $stmt->fetch();
    
    if ($tableExists) {
        $stmt = $db->prepare("SELECT * FROM accommodation_types ORDER BY type_name");
        $stmt->execute();
        $types = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $types
        ]);
    } else {
        // Return default types if table doesn't exist
        echo json_encode([
            'success' => true,
            'data' => [
                ['type_id' => 1, 'type_name' => 'Cottage'],
                ['type_id' => 2, 'type_name' => 'Room'],
                ['type_id' => 3, 'type_name' => 'Picnic Table'],
                ['type_id' => 4, 'type_name' => 'Tent'],
                ['type_id' => 5, 'type_name' => 'Cabana'],
                ['type_id' => 6, 'type_name' => 'Camping Site']
            ]
        ]);
    }
} catch (Exception $e) {
    error_log('Error in get-accommodation-types.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>