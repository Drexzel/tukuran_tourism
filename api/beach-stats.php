<?php
// ========================================
// ===== BEACH STATS API =====
// ========================================
// Powers the Landing Page's "Number of Municipal Beaches" and
// "Most Visited Beach" info cards so they are no longer hardcoded.
//
// - total_beaches: every beach registered by Tourism Personnel, regardless
//   of status, since the counter is meant to reflect the municipality's
//   full roster of registered beaches.
// - most_visited: among ACTIVE beaches (the ones the public can actually
//   view/reserve), the one with the highest current visitor count
//   (beaches.current_capacity - the live visitor tally maintained by beach
//   owners). Ties are broken by rating, then by total_reviews.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Total registered beaches (any status)
        $totalStmt = $db->query("SELECT COUNT(*) as total FROM beaches");
        $total = (int) $totalStmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Most visited active beach, ranked by current visitor count
        $mostVisitedStmt = $db->query("
            SELECT 
                beach_id,
                beach_name,
                barangay,
                current_capacity,
                rating,
                total_reviews
            FROM beaches
            WHERE status = 'Active'
            ORDER BY current_capacity DESC, rating DESC, total_reviews DESC
            LIMIT 1
        ");
        $mostVisited = $mostVisitedStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => [
                'total_beaches' => $total,
                'most_visited' => $mostVisited ?: null
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
}
?>
