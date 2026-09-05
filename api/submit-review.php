<?php
// ========================================
// ===== SUBMIT REVIEW API =====
// ========================================
// Persists a tourist review for a beach (Beach Details page, "Write a
// Review" form). After inserting, recalculates beaches.rating and
// beaches.total_reviews from every review on file for that beach, so the
// average rating stays in sync everywhere it's shown - Beach Details
// itself, Browse Beaches, Beach Management, and Beach Ranking - without
// touching any of those pages.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = $_POST; // fallback if sent as form data instead of JSON
    }

    $beachId = isset($data['beach_id']) ? intval($data['beach_id']) : 0;
    $rating = isset($data['rating']) ? intval($data['rating']) : 0;
    $comment = isset($data['comment']) ? trim($data['comment']) : '';
    $reviewerName = isset($data['reviewer_name']) ? trim($data['reviewer_name']) : '';

    if (!$beachId) {
        echo json_encode(['success' => false, 'message' => 'beach_id is required']);
        exit;
    }
    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5']);
        exit;
    }
    if ($comment === '') {
        echo json_encode(['success' => false, 'message' => 'A review comment is required']);
        exit;
    }
    if ($reviewerName === '') {
        $reviewerName = 'Anonymous';
    }

    // Make sure the beach actually exists before attaching a review to it.
    $beachCheck = $db->prepare("SELECT beach_id FROM beaches WHERE beach_id = ?");
    $beachCheck->execute([$beachId]);
    if (!$beachCheck->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Beach not found']);
        exit;
    }

    $db->beginTransaction();

    $insert = $db->prepare("
        INSERT INTO reviews (beach_id, reviewer_name, rating, comment)
        VALUES (?, ?, ?, ?)
    ");
    $insert->execute([$beachId, $reviewerName, $rating, $comment]);
    $reviewId = $db->lastInsertId();

    // Recalculate the beach's average rating/review count from every
    // review on file (the single source of truth from here on), then keep
    // beaches.rating/total_reviews - already read by Browse Beaches,
    // Beach Management and Beach Ranking - in sync automatically.
    $agg = $db->prepare("SELECT COUNT(*) AS cnt, AVG(rating) AS avg_rating FROM reviews WHERE beach_id = ?");
    $agg->execute([$beachId]);
    $aggRow = $agg->fetch(PDO::FETCH_ASSOC);
    $newTotal = (int) $aggRow['cnt'];
    $newAverage = $newTotal > 0 ? round((float) $aggRow['avg_rating'], 2) : 0;

    $update = $db->prepare("UPDATE beaches SET rating = ?, total_reviews = ? WHERE beach_id = ?");
    $update->execute([$newAverage, $newTotal, $beachId]);

    $db->commit();

    $reviewStmt = $db->prepare("SELECT review_id, reviewer_name, rating, comment, created_at FROM reviews WHERE review_id = ?");
    $reviewStmt->execute([$reviewId]);
    $review = $reviewStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Review submitted successfully',
        'data' => [
            'review' => $review,
            'average_rating' => $newAverage,
            'total_reviews' => $newTotal
        ]
    ]);
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
