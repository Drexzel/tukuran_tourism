<?php
// ========================================
// ===== SMART RESORT RECOMMENDATION API =====
// ========================================
// Supports the Reservation Form's "Find Similar Available Beaches" feature.
//
// This is a RULE-BASED, database-driven recommendation - not AI/ML and not
// hardcoded/dummy data. It reuses the same live-capacity logic already used
// elsewhere in the system (getBeachOccupancyToday / getBeachAccommodationAvailability
// in includes/db_connection.php) so the numbers here always agree with what
// the rest of the app (Dashboard, Beach Operator pages, Reservation Form)
// already shows.
//
// Two lightweight actions, both GET:
//
//   action=check     - Cheap capacity check for ONE beach (the one the
//                       tourist already selected). Used to decide whether
//                       to show the "not enough capacity" notice at all.
//                       Params: beach_id, num_visitors, date (optional)
//
//   action=recommend - Only called when the tourist actually clicks
//                       "Find Similar Available Beaches". Looks at every
//                       other Active beach, keeps the ones with enough real
//                       remaining capacity for the requested date, and
//                       ranks them by how similar they are to the beach the
//                       tourist originally picked (same accommodation type,
//                       available units, similar amenities, similar
//                       entrance fee, same location/barangay where
//                       applicable).
//                       Params: beach_id, num_visitors, date (optional),
//                               accommodation_type (optional)

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$action = isset($_GET['action']) && $_GET['action'] === 'recommend' ? 'recommend' : 'check';

$beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : 0;
$numVisitors = isset($_GET['num_visitors']) ? intval($_GET['num_visitors']) : 0;

// Optional ?date=YYYY-MM-DD - same validation/convention as get-beaches.php
// and getBeachOccupancyToday(): falls back to today when absent/invalid.
$date = null;
if (isset($_GET['date']) && $_GET['date'] !== '') {
    $candidateDate = $_GET['date'];
    $parsed = DateTime::createFromFormat('Y-m-d', $candidateDate);
    if ($parsed && $parsed->format('Y-m-d') === $candidateDate) {
        $date = $candidateDate;
    }
}
$effectiveDate = $date ?: date('Y-m-d');

if ($beachId <= 0 || $numVisitors <= 0) {
    echo json_encode(['success' => false, 'message' => 'beach_id and num_visitors are required']);
    exit();
}

try {
    if ($action === 'check') {
        checkBeachCapacity($db, $beachId, $numVisitors, $effectiveDate);
    } else {
        $accommodationType = isset($_GET['accommodation_type']) ? trim($_GET['accommodation_type']) : '';
        recommendSimilarBeaches($db, $beachId, $numVisitors, $effectiveDate, $accommodationType);
    }
} catch (Exception $e) {
    error_log('Error in beach-recommendations.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

// ========================================
// ===== action=check =====
// ========================================
// Reuses getBeachOccupancyToday() (already the single source of truth for
// "how many guests does this beach actually have right now / on this date")
// so this always matches what the Tourism Personnel Dashboard and Beach
// Operator pages already show for the same beach/date.
function checkBeachCapacity($db, $beachId, $numVisitors, $date) {
    $occ = getBeachOccupancyToday($db, $beachId, $date);

    if (!$occ) {
        echo json_encode(['success' => false, 'message' => 'Beach not found or not Active']);
        return;
    }

    $remaining = max(0, $occ['max_capacity'] - $occ['occupied']);
    $canAccommodate = $numVisitors <= $remaining;

    echo json_encode([
        'success' => true,
        'beach_id' => $occ['beach_id'],
        'beach_name' => $occ['beach_name'],
        'date' => $date,
        'num_visitors' => $numVisitors,
        'max_capacity' => $occ['max_capacity'],
        'occupied' => $occ['occupied'],
        'remaining_capacity' => $remaining,
        'can_accommodate' => $canAccommodate
    ]);
}

// ========================================
// ===== action=recommend =====
// ========================================
function recommendSimilarBeaches($db, $beachId, $numVisitors, $date, $accommodationType) {
    // ----- 1. Load the originally-selected beach, for similarity scoring -----
    // (location/barangay, entrance fee, amenities). If it can't be found
    // (e.g. was deactivated in the meantime) we still recommend beaches
    // purely on capacity - we just skip the "similar to" scoring boosts.
    $originStmt = $db->prepare("
        SELECT beach_id, beach_name, barangay, location, adult_fee, child_fee
        FROM beaches
        WHERE beach_id = ?
    ");
    $originStmt->execute([$beachId]);
    $origin = $originStmt->fetch(PDO::FETCH_ASSOC);

    $originAmenityStmt = $db->prepare("SELECT amenity_id FROM beach_amenities WHERE beach_id = ?");
    $originAmenityStmt->execute([$beachId]);
    $originAmenityIds = $originAmenityStmt->fetchAll(PDO::FETCH_COLUMN);
    $originAmenityIds = array_map('intval', $originAmenityIds ?: []);

    // ----- 2. Every other Active beach is a candidate -----
    $candidatesStmt = $db->prepare("
        SELECT beach_id, beach_name, location, barangay, adult_fee, child_fee,
               max_capacity, rating, total_reviews,
               (SELECT image_url FROM beach_images WHERE beach_id = b.beach_id AND is_main = TRUE LIMIT 1) AS main_image
        FROM beaches b
        WHERE status = 'Active' AND beach_id != ?
        ORDER BY beach_id DESC
    ");
    $candidatesStmt->execute([$beachId]);
    $candidates = $candidatesStmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];

    foreach ($candidates as $candidate) {
        $candidateId = (int) $candidate['beach_id'];

        // ----- Real, live capacity for the requested date (no estimates) -----
        $occ = getBeachOccupancyToday($db, $candidateId, $date);
        if (!$occ) continue;
        $remaining = max(0, $occ['max_capacity'] - $occ['occupied']);

        // Rule 1: must actually be able to fit the requested guests on the
        // requested date. Beaches that can't are simply not recommended.
        if ($remaining < $numVisitors) {
            continue;
        }

        // ----- Real accommodations for this beach/date (same helper the -----
        // ----- Reservation Form itself uses) -----
        $accommodations = getBeachAccommodationAvailability($db, $candidateId, $date);

        $hasMatchingType = false;
        if ($accommodationType !== '') {
            foreach ($accommodations as $acc) {
                if (strcasecmp($acc['type_name'], $accommodationType) === 0 && (int) $acc['available_units'] > 0) {
                    $hasMatchingType = true;
                    break;
                }
            }
        }
        $hasAnyAvailableAccommodation = false;
        foreach ($accommodations as $acc) {
            if ((int) $acc['available_units'] > 0) { $hasAnyAvailableAccommodation = true; break; }
        }

        // ----- Amenities (for both scoring and displaying to the tourist) -----
        $amenityStmt = $db->prepare("
            SELECT a.amenity_id, a.amenity_name
            FROM beach_amenities ba
            JOIN amenities a ON ba.amenity_id = a.amenity_id
            WHERE ba.beach_id = ?
        ");
        $amenityStmt->execute([$candidateId]);
        $amenityRows = $amenityStmt->fetchAll(PDO::FETCH_ASSOC);
        $candidateAmenityIds = array_map(function ($r) { return (int) $r['amenity_id']; }, $amenityRows);
        $sharedAmenityCount = $origin ? count(array_intersect($originAmenityIds, $candidateAmenityIds)) : 0;

        // ========================================
        // ===== SCORING (simple, transparent, rule-based) =====
        // ========================================
        // Every point comes from real database fields - never randomized,
        // never machine-learned. Kept simple on purpose per the request.
        $score = 0;

        // Same accommodation type, actually available: strongest signal.
        if ($hasMatchingType) {
            $score += 40;
        } elseif ($hasAnyAvailableAccommodation) {
            $score += 10;
        }

        // Shared amenities.
        $score += min($sharedAmenityCount, 10) * 3;

        // Similar entrance fee (adult_fee), only when the origin beach is known.
        if ($origin) {
            $feeDiff = abs((float) $candidate['adult_fee'] - (float) $origin['adult_fee']);
            $score += max(0, 20 - ($feeDiff / 25));
        }

        // Same location/barangay, when both are known and non-empty.
        if ($origin && !empty($origin['barangay']) && !empty($candidate['barangay'])
            && strcasecmp($origin['barangay'], $candidate['barangay']) === 0) {
            $score += 15;
        } elseif ($origin && !empty($origin['location']) && !empty($candidate['location'])
            && strcasecmp($origin['location'], $candidate['location']) === 0) {
            $score += 8;
        }

        // Small tiebreaker so beaches that comfortably fit the party (not
        // just barely) and beaches with a stronger track record rank
        // slightly higher among otherwise-similar matches.
        $score += min(10, floor($remaining / max(1, $numVisitors)) * 2);
        $score += min(5, (float) $candidate['rating']);

        $results[] = [
            'beach_id' => $candidateId,
            'beach_name' => $candidate['beach_name'],
            'location' => $candidate['location'],
            'barangay' => $candidate['barangay'],
            'adult_fee' => (float) $candidate['adult_fee'],
            'child_fee' => (float) $candidate['child_fee'],
            'max_capacity' => (int) $candidate['max_capacity'],
            'remaining_capacity' => $remaining,
            'rating' => (float) $candidate['rating'],
            'total_reviews' => (int) $candidate['total_reviews'],
            'main_image' => $candidate['main_image'],
            'amenities' => array_map(function ($r) { return $r['amenity_name']; }, $amenityRows),
            'accommodations' => $accommodations,
            'matched_accommodation_type' => $hasMatchingType,
            'shared_amenities_count' => $sharedAmenityCount,
            'match_score' => round($score, 2)
        ];
    }

    // Highest similarity first; ties broken by more remaining room, then rating.
    usort($results, function ($a, $b) {
        if ($a['match_score'] !== $b['match_score']) {
            return $b['match_score'] <=> $a['match_score'];
        }
        if ($a['remaining_capacity'] !== $b['remaining_capacity']) {
            return $b['remaining_capacity'] <=> $a['remaining_capacity'];
        }
        return $b['rating'] <=> $a['rating'];
    });

    // A short, manageable list rather than every qualifying beach.
    $results = array_slice($results, 0, 8);

    echo json_encode([
        'success' => true,
        'requested' => [
            'beach_id' => $beachId,
            'beach_name' => $origin ? $origin['beach_name'] : null,
            'num_visitors' => $numVisitors,
            'date' => $date,
            'accommodation_type' => $accommodationType
        ],
        'data' => $results
    ]);
}
?>
