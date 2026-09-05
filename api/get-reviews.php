<?php
// ========================================
// ===== GET REVIEWS API =====
// ========================================
// Returns the real reviews stored for a beach (Beach Details page,
// "Ratings and Reviews" section) plus the current average rating/total
// review count, straight from the reviews table - no hardcoded sample
// reviews. See api/submit-review.php for how new reviews are added.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);

        if (!$beachId) {
            echo json_encode(['success' => false, 'message' => 'beach_id is required']);
            exit;
        }

        $stmt = $db->prepare("
            SELECT review_id, reviewer_name, rating, comment, created_at
            FROM reviews
            WHERE beach_id = ?
            ORDER BY created_at DESC
        ");
        $stmt->execute([$beachId]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalReviews = count($reviews);
        $averageRating = 0;
        if ($totalReviews > 0) {
            $sum = 0;
            foreach ($reviews as $r) {
                $sum += (int) $r['rating'];
            }
            $averageRating = round($sum / $totalReviews, 2);
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'reviews' => $reviews,
                'average_rating' => $averageRating,
                'total_reviews' => $totalReviews
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
