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
    $stmt = $db->prepare("SHOW TABLES LIKE 'amenities'");
    $stmt->execute();
    $tableExists = $stmt->fetch();
    
    if ($tableExists) {
        $stmt = $db->prepare("SELECT * FROM amenities ORDER BY amenity_name");
        $stmt->execute();
        $amenities = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $amenities
        ]);
    } else {
        // Return default amenities if table doesn't exist
        echo json_encode([
            'success' => true,
            'data' => [
                ['amenity_id' => 1, 'amenity_name' => 'Parking Space'],
                ['amenity_id' => 2, 'amenity_name' => 'Electricity Supply'],
                ['amenity_id' => 3, 'amenity_name' => 'Wi-Fi / Internet Access'],
                ['amenity_id' => 4, 'amenity_name' => 'Comfort Rooms'],
                ['amenity_id' => 5, 'amenity_name' => 'Picnic Area'],
                ['amenity_id' => 6, 'amenity_name' => 'Snack Bar'],
                ['amenity_id' => 7, 'amenity_name' => 'Life Vest'],
                ['amenity_id' => 8, 'amenity_name' => 'Restaurant'],
                ['amenity_id' => 9, 'amenity_name' => 'Souvenir Shop'],
                ['amenity_id' => 10, 'amenity_name' => 'Beach Volleyball'],
                ['amenity_id' => 11, 'amenity_name' => 'Kayak Rental'],
                ['amenity_id' => 12, 'amenity_name' => 'Diving Equipment'],
                ['amenity_id' => 13, 'amenity_name' => 'Shower Area'],
                ['amenity_id' => 14, 'amenity_name' => 'Cottage Rentals']
            ]
        ]);
    }
} catch (Exception $e) {
    error_log('Error in get-amenities.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>