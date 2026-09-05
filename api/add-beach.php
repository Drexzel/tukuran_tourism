<?php
// ========================================
// ===== ADD BEACH API =====
// ========================================

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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
        // Beach info now arrives as multipart/form-data (regular POST fields)
        // instead of a raw JSON body, so that the beach image file can be
        // uploaded in the same request.
        $data = $_POST;

        if (empty($data)) {
            echo json_encode([
                'success' => false,
                'message' => 'No data received'
            ]);
            exit;
        }

        // Amenities and accommodations are sent as JSON-encoded strings
        // (arrays don't travel cleanly as plain form fields).
        $data['amenities'] = [];
        if (isset($_POST['amenities']) && $_POST['amenities'] !== '') {
            $decoded = json_decode($_POST['amenities'], true);
            if (is_array($decoded)) {
                $data['amenities'] = $decoded;
            }
        }

        $data['accommodations'] = [];
        if (isset($_POST['accommodations']) && $_POST['accommodations'] !== '') {
            $decoded = json_decode($_POST['accommodations'], true);
            if (is_array($decoded)) {
                $data['accommodations'] = $decoded;
            }
        }

        // Validate required fields
        // Note: owner_name is intentionally not required/inserted here -
        // it's derived from the linked Beach Owner account (beach_owners
        // table, see get-beaches.php), the same way phone is handled.
        $required = ['beach_name', 'location', 'max_capacity'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                echo json_encode([
                    'success' => false,
                    'message' => "Missing required field: $field"
                ]);
                exit;
            }
        }
        
        $db->beginTransaction();
        
        // 1. Insert beach
        $stmt = $db->prepare("
            INSERT INTO beaches (
                beach_name, status, location, barangay,
                adult_fee, child_fee, max_capacity, current_capacity,
                description, google_maps_link, latitude, longitude,
                phone, facebook, website,
                gcash_number, gcash_name, bank_name, bank_account_name, bank_account_number,
                rating, total_reviews
            ) VALUES (
                :beach_name, :status, :location, :barangay,
                :adult_fee, :child_fee, :max_capacity, 0,
                :description, :google_maps_link, :latitude, :longitude,
                :phone, :facebook, :website,
                :gcash_number, :gcash_name, :bank_name, :bank_account_name, :bank_account_number,
                0, 0
            )
        ");
        
        $stmt->execute([
            ':beach_name' => $data['beach_name'],
            ':status' => $data['status'] ?? 'Active',
            ':location' => $data['location'],
            ':barangay' => $data['barangay'] ?? '',
            ':adult_fee' => $data['adult_fee'] ?? 0,
            ':child_fee' => $data['child_fee'] ?? 0,
            ':max_capacity' => $data['max_capacity'],
            ':description' => $data['description'] ?? '',
            ':google_maps_link' => $data['google_maps_link'] ?? '',
            ':latitude' => (isset($data['latitude']) && $data['latitude'] !== '') ? $data['latitude'] : null,
            ':longitude' => (isset($data['longitude']) && $data['longitude'] !== '') ? $data['longitude'] : null,
            ':phone' => $data['phone'] ?? '',
            ':facebook' => $data['facebook'] ?? '',
            ':website' => $data['website'] ?? '',
            ':gcash_number' => $data['gcash_number'] ?? '',
            ':gcash_name' => $data['gcash_name'] ?? '',
            ':bank_name' => $data['bank_name'] ?? '',
            ':bank_account_name' => $data['bank_account_name'] ?? '',
            ':bank_account_number' => $data['bank_account_number'] ?? ''
        ]);
        
        $beachId = $db->lastInsertId();

        // 1b. Handle the optional GCash QR code image upload. Stored on the
        // beaches row (gcash_qr) so it can be shown on the Reservation Form.
        $savedQr = saveGcashQrUpload($beachId);
        if ($savedQr !== null) {
            $db->prepare("UPDATE beaches SET gcash_qr = ? WHERE beach_id = ?")
               ->execute([$savedQr, $beachId]);
        }
        
        // 2. Handle the uploaded beach images (up to 4). Sent as
        // beach_images[] (a multi-file field) from the Add Beach form.
        if (isset($_FILES['beach_images'])) {
            $files = $_FILES['beach_images'];
            $fileCount = is_array($files['name']) ? count($files['name']) : 0;
            $maxImages = 4;
            $sortOrder = 0;

            $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            $maxSize = 5 * 1024 * 1024; // 5MB per image
            $extMap = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                'image/gif' => 'gif'
            ];

            $imgStmt = $db->prepare("
                INSERT INTO beach_images (beach_id, image_url, is_main, sort_order)
                VALUES (:beach_id, :image_url, :is_main, :sort_order)
            ");

            for ($i = 0; $i < $fileCount && $sortOrder < $maxImages; $i++) {
                if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                    continue;
                }

                $tmpName = $files['tmp_name'][$i];
                $size = $files['size'][$i];

                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mimeType = finfo_file($finfo, $tmpName);
                finfo_close($finfo);

                if (!in_array($mimeType, $allowedTypes, true) || $size > $maxSize) {
                    continue;
                }

                $uploadDir = __DIR__ . '/../uploads/beaches/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                $safeExt = $extMap[$mimeType];
                $fileName = 'beach_' . $beachId . '_' . uniqid() . '.' . $safeExt;
                $destination = $uploadDir . $fileName;

                if (move_uploaded_file($tmpName, $destination)) {
                    // Stored relative to any page one folder below the BEACH
                    // root (e.g. "Tourism Personnel/" or "Landing page/"),
                    // matching the convention already used for default images.
                    $imageUrl = '../uploads/beaches/' . $fileName;

                    $imgStmt->execute([
                        ':beach_id' => $beachId,
                        ':image_url' => $imageUrl,
                        ':is_main' => $sortOrder === 0 ? 1 : 0,
                        ':sort_order' => $sortOrder
                    ]);
                    $sortOrder++;
                }
            }
        }
        
        // 3. Insert amenities
        if (isset($data['amenities']) && is_array($data['amenities']) && !empty($data['amenities'])) {
            // First, get amenity IDs
            $placeholders = implode(',', array_fill(0, count($data['amenities']), '?'));
            $stmt = $db->prepare("SELECT amenity_id, amenity_name FROM amenities WHERE amenity_name IN ($placeholders)");
            $stmt->execute($data['amenities']);
            $amenityMap = [];
            while ($row = $stmt->fetch()) {
                $amenityMap[$row['amenity_name']] = $row['amenity_id'];
            }
            
            $stmt = $db->prepare("INSERT INTO beach_amenities (beach_id, amenity_id) VALUES (:beach_id, :amenity_id)");
            foreach ($data['amenities'] as $amenityName) {
                if (isset($amenityMap[$amenityName])) {
                    $stmt->execute([
                        ':beach_id' => $beachId,
                        ':amenity_id' => $amenityMap[$amenityName]
                    ]);
                } else {
                    // Insert new amenity if not exists
                    $insertStmt = $db->prepare("INSERT INTO amenities (amenity_name) VALUES (:amenity_name)");
                    $insertStmt->execute([':amenity_name' => $amenityName]);
                    $newId = $db->lastInsertId();
                    $stmt->execute([
                        ':beach_id' => $beachId,
                        ':amenity_id' => $newId
                    ]);
                }
            }
        }
        
        // 4. Insert accommodations
        if (isset($data['accommodations']) && is_array($data['accommodations']) && !empty($data['accommodations'])) {
            // Get type IDs
            $typeNames = array_column($data['accommodations'], 'type');
            $placeholders = implode(',', array_fill(0, count($typeNames), '?'));
            $stmt = $db->prepare("SELECT type_id, type_name FROM accommodation_types WHERE type_name IN ($placeholders)");
            $stmt->execute($typeNames);
            $typeMap = [];
            while ($row = $stmt->fetch()) {
                $typeMap[$row['type_name']] = $row['type_id'];
            }
            
            $stmt = $db->prepare("
                INSERT INTO beach_accommodations (beach_id, type_id, total_units, price_per_unit, available_units)
                VALUES (:beach_id, :type_id, :total_units, :price_per_unit, :total_units)
            ");
            
            foreach ($data['accommodations'] as $accommodation) {
                $typeName = $accommodation['type'];
                if (isset($typeMap[$typeName])) {
                    $stmt->execute([
                        ':beach_id' => $beachId,
                        ':type_id' => $typeMap[$typeName],
                        ':total_units' => $accommodation['units'],
                        ':price_per_unit' => isset($accommodation['price']) ? (float) $accommodation['price'] : 0
                    ]);
                }
            }
        }
        
        // Note: no beach owner account is created here. Tourism Personnel
        // only add the beach's information and image - beach owner
        // accounts are handled separately, elsewhere in the system.
        
        $db->commit();
        
        // Return the new beach data
        $beachStmt = $db->prepare("SELECT * FROM beaches WHERE beach_id = ?");
        $beachStmt->execute([$beachId]);
        $beachData = $beachStmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'message' => 'Beach added successfully!',
            'beach_id' => $beachId,
            'beach_name' => $data['beach_name'],
            'data' => $beachData
        ]);
        
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('Error in add-beach.php: ' . $e->getMessage());
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

/**
 * Saves the optional GCash QR code image uploaded with the beach form
 * (multipart field name: "gcash_qr"). Validates the type/size, stores it
 * under uploads/payments/qr/, and returns the relative path to save in
 * beaches.gcash_qr - or null if no (valid) file was uploaded.
 *
 * Shared shape with the equivalent helper in update-beach.php.
 */
function saveGcashQrUpload($beachId) {
    if (!isset($_FILES['gcash_qr']) || $_FILES['gcash_qr']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $file = $_FILES['gcash_qr'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $allowedTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $maxSize = 5 * 1024 * 1024; // 5MB

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!isset($allowedTypes[$mimeType]) || $file['size'] > $maxSize) {
        return null;
    }

    $uploadDir = __DIR__ . '/../uploads/payments/qr/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $fileName = 'gcashqr_' . intval($beachId) . '_' . uniqid() . '.' . $allowedTypes[$mimeType];
    $destination = $uploadDir . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return null;
    }

    // Relative to any page one folder below the BEACH root, matching how
    // beach image URLs are stored.
    return '../uploads/payments/qr/' . $fileName;
}
?>