<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../includes/db_connection.php'; // Ensure path matches your setup

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Optional ?id= filter, used by the Beach Details page so it can pull
        // a single beach's full record (with amenities/accommodations/images
        // populated below) instead of fetching every beach.
        $beachIdFilter = isset($_GET['id']) ? intval($_GET['id']) : null;

        // Optional ?all=1 flag. Public/tourist-facing pages (Browse All
        // Beaches, the tourist Beach Details page, the Landing Page) never
        // set this, so they keep only ever seeing Active beaches - that
        // part is unchanged. Internal pages that need to see every beach
        // regardless of status - Tourism Personnel's Beach Management list
        // AND its "View Details" (otherwise an Inactive/Maintenance beach
        // would 404 as "Beach not found" for the very staff managing it),
        // the admin dashboard's occupancy overview, the Manage Beach
        // Owners beach picker, and the Beach Owner's own pages (an owner
        // must still see their own beach's info if it's temporarily marked
        // Inactive) - pass all=1 to opt out of that filter.
        $includeAllStatuses = isset($_GET['all']) && $_GET['all'] === '1';

        // Optional ?date=YYYY-MM-DD filter. Accommodation unit availability
        // (reserved/occupied/available counts below) is otherwise computed
        // for TODAY only, which is correct for the Walk-in Guests form
        // (always today's occupancy) but wrong for the Reservation Form,
        // which books a specific future/current date - a unit taken today
        // shouldn't block an unrelated future date, and one that's free
        // today may already be fully booked on the date actually being
        // reserved. When provided and a valid Y-m-d date, that date is used
        // instead of today; otherwise behavior is unchanged.
        $accommodationDateFilter = null;
        if (isset($_GET['date']) && $_GET['date'] !== '') {
            $candidateDate = $_GET['date'];
            $parsed = DateTime::createFromFormat('Y-m-d', $candidateDate);
            if ($parsed && $parsed->format('Y-m-d') === $candidateDate) {
                $accommodationDateFilter = $candidateDate;
            }
        }

        // Fix: Use adult_fee and child_fee instead of entrance_fee
        //
        // Phone (and owner name) now come from the linked Beach Owner
        // account (beach_owners.beach_id) when one exists - that's the
        // single source of truth for contact info, rather than the
        // separate beaches.phone/owner_name columns that used to be
        // filled in manually on the Add Beach form. Falls back to those
        // legacy columns only if no Beach Owner account is linked yet.
        $sql = "
            SELECT 
                b.beach_id,
                b.beach_name,
                b.location,
                b.barangay,
                COALESCE(bo.owner_name, b.owner_name) AS owner_name,
                b.adult_fee,
                b.child_fee,
                b.max_capacity,
                b.current_capacity,
                b.rating,
                b.total_reviews,
                b.description,
                b.status,
                b.google_maps_link,
                b.latitude,
                b.longitude,
                COALESCE(bo.phone_number, b.phone) AS phone,
                b.facebook,
                b.website,
                b.gcash_number,
                b.gcash_name,
                b.gcash_qr,
                b.bank_name,
                b.bank_account_name,
                b.bank_account_number,
                bo.owner_id AS linked_owner_id,
                bo.email AS linked_owner_email,
                (
                    SELECT image_url FROM beach_images 
                    WHERE beach_id = b.beach_id AND is_main = TRUE 
                    LIMIT 1
                ) as main_image
            FROM beaches b
            LEFT JOIN (
                -- If more than one Beach Owner account somehow ends up
                -- linked to the same beach, use the most recently created
                -- one as the authoritative contact.
                SELECT bo1.*
                FROM beach_owners bo1
                INNER JOIN (
                    SELECT beach_id, MAX(owner_id) AS latest_owner_id
                    FROM beach_owners
                    WHERE beach_id IS NOT NULL
                    GROUP BY beach_id
                ) latest ON latest.beach_id = bo1.beach_id AND latest.latest_owner_id = bo1.owner_id
            ) bo ON bo.beach_id = b.beach_id
        ";
        $params = [];
        $whereClauses = [];
        if (!$includeAllStatuses) {
            $whereClauses[] = "b.status = 'Active'";
        }
        if ($beachIdFilter) {
            $whereClauses[] = "b.beach_id = ?";
            $params[] = $beachIdFilter;
        }
        if (!empty($whereClauses)) {
            $sql .= " WHERE " . implode(' AND ', $whereClauses);
        }
        $sql .= " ORDER BY b.beach_id DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $beaches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch related data for each beach
        foreach ($beaches as &$beach) {
            
            // 1. Get Amenities
            $stmtAmenities = $db->prepare("
                SELECT a.amenity_name 
                FROM beach_amenities ba
                JOIN amenities a ON ba.amenity_id = a.amenity_id
                WHERE ba.beach_id = ?
            ");
            $stmtAmenities->execute([$beach['beach_id']]);
            $beach['amenities'] = $stmtAmenities->fetchAll(PDO::FETCH_ASSOC);

            // 2. Get Accommodations. available_units (and the extra
            // reserved_units/occupied_units breakdown) is computed live
            // from actual Confirmed reservations + walk-ins for the
            // requested date (?date=, defaulting to today when absent) -
            // see getBeachAccommodationAvailability() in db_connection.php -
            // rather than read from a stored counter, so the Reservation
            // Form, Walk-in Guests form, Beach Operator Dashboard and
            // Beach Management "View Details" panel all agree.
            $beach['accommodations'] = getBeachAccommodationAvailability($db, $beach['beach_id'], $accommodationDateFilter);
            
            // 3. Get All Images
            $stmtImages = $db->prepare("
                SELECT image_id, image_url, is_main 
                FROM beach_images 
                WHERE beach_id = ? 
                ORDER BY sort_order ASC
            ");
            $stmtImages->execute([$beach['beach_id']]);
            $beach['images'] = $stmtImages->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'success' => true,
            'data' => $beaches
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}
?>