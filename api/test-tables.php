<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dbPath = realpath(__DIR__ . '/../includes/db_connection.php');
if (!$dbPath || !file_exists($dbPath)) {
    echo json_encode(['success' => false, 'message' => 'Database connection file not found']);
    exit;
}

require_once $dbPath;

$db = getDB();

if (!$db) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

try {
    // Check all required tables
    $tables = [
        'beaches',
        'amenities', 
        'beach_amenities',
        'accommodation_types',
        'beach_accommodations',
        'beach_images',
        'beach_owners',
        'tourists',
        'visit_logs',
        'incident_reports',
        'beach_rankings',
        'reviews'
    ];
    
    $results = [];
    $allExist = true;
    
    foreach ($tables as $table) {
        $stmt = $db->prepare("SHOW TABLES LIKE :table");
        $stmt->execute([':table' => $table]);
        $exists = $stmt->fetch() !== false;
        $results[$table] = $exists;
        if (!$exists) $allExist = false;
    }
    
    // Get table counts
    $counts = [];
    foreach ($tables as $table) {
        try {
            $stmt = $db->query("SELECT COUNT(*) as count FROM `$table`");
            $counts[$table] = $stmt->fetch()['count'];
        } catch (Exception $e) {
            $counts[$table] = 0;
        }
    }
    
    echo json_encode([
        'success' => $allExist,
        'message' => $allExist ? 'All tables exist' : 'Some tables are missing',
        'tables' => $results,
        'counts' => $counts,
        'database' => 'tukuran_tourism'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error checking tables: ' . $e->getMessage()
    ]);
}
?>