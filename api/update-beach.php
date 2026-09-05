<?php
// ========================================
// ===== UPDATE BEACH API =====
// ========================================
// Lets Tourism Personnel edit a beach's information from Beach
// Management. Reuses the same field set as add-beach.php, plus image
// management (delete existing images, add new ones, up to 4 total).

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
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Beach info arrives as multipart/form-data (like add-beach.php) so new
    // images can be uploaded in the same request as the other edits.
    $data = $_POST;

    $beachId = isset($data['beach_id']) ? intval($data['beach_id']) : 0;
    if (!$beachId) {
        echo json_encode(['success' => false, 'message' => 'Missing beach_id']);
        exit;
    }

    $existsStmt = $db->prepare("SELECT beach_id, status FROM beaches WHERE beach_id = ?");
    $existsStmt->execute([$beachId]);
    $existingBeach = $existsStmt->fetch(PDO::FETCH_ASSOC);
    if (!$existingBeach) {
        echo json_encode(['success' => false, 'message' => 'Beach not found']);
        exit;
    }
    // Status (Active/Inactive) is no longer editable from this form - it's
    // managed exclusively through the Deactivate/Activate action in Beach
    // Management (see beach-status.php), which also runs the active-
    // reservation safety check. Always keep the beach's current status here
    // so a routine info edit never silently reverts a deactivated beach.
    $currentStatus = $existingBeach['status'];

    $required = ['beach_name', 'location', 'max_capacity'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            exit;
        }
    }

    $amenities = [];
    if (isset($_POST['amenities']) && $_POST['amenities'] !== '') {
        $decoded = json_decode($_POST['amenities'], true);
        if (is_array($decoded)) {
            $amenities = $decoded;
        }
    }

    $accommodations = [];
    if (isset($_POST['accommodations']) && $_POST['accommodations'] !== '') {
        $decoded = json_decode($_POST['accommodations'], true);
        if (is_array($decoded)) {
            $accommodations = $decoded;
        }
    }

    // Image ids the admin removed in the edit form.
    $deleteImageIds = [];
    if (isset($_POST['delete_image_ids']) && $_POST['delete_image_ids'] !== '') {
        $decoded = json_decode($_POST['delete_image_ids'], true);
        if (is_array($decoded)) {
            $deleteImageIds = array_map('intval', $decoded);
        }
    }

    $db->beginTransaction();

    // 1. Update the beach's core information. owner_name/phone are
    // intentionally NOT updated here - they're derived from the linked
    // Beach Owner account (see get-beaches.php), which is managed from
    // Manage Beach Owners instead.
    $stmt = $db->prepare("
        UPDATE beaches SET
            beach_name = :beach_name,
            status = :status,
            location = :location,
            barangay = :barangay,
            adult_fee = :adult_fee,
            child_fee = :child_fee,
            max_capacity = :max_capacity,
            description = :description,
            latitude = :latitude,
            longitude = :longitude,
            facebook = :facebook,
            website = :website,
            gcash_number = :gcash_number,
            gcash_name = :gcash_name,
            bank_name = :bank_name,
            bank_account_name = :bank_account_name,
            bank_account_number = :bank_account_number
        WHERE beach_id = :beach_id
    ");
    $stmt->execute([
        ':beach_name' => $data['beach_name'],
        ':status' => $currentStatus,
        ':location' => $data['location'],
        ':barangay' => $data['barangay'] ?? '',
        ':adult_fee' => $data['adult_fee'] ?? 0,
        ':child_fee' => $data['child_fee'] ?? 0,
        ':max_capacity' => $data['max_capacity'],
        ':description' => $data['description'] ?? '',
        ':latitude' => (isset($data['latitude']) && $data['latitude'] !== '') ? $data['latitude'] : null,
        ':longitude' => (isset($data['longitude']) && $data['longitude'] !== '') ? $data['longitude'] : null,
        ':facebook' => $data['facebook'] ?? '',
        ':website' => $data['website'] ?? '',
        ':gcash_number' => $data['gcash_number'] ?? '',
        ':gcash_name' => $data['gcash_name'] ?? '',
        ':bank_name' => $data['bank_name'] ?? '',
        ':bank_account_name' => $data['bank_account_name'] ?? '',
        ':bank_account_number' => $data['bank_account_number'] ?? '',
        ':beach_id' => $beachId
    ]);

    // ----- Online Down Payment: GCash QR code image -----
    // A newly uploaded QR replaces the old one; an explicit remove flag
    // (with no new upload) clears it. Otherwise the saved QR is untouched.
    $oldQrToDelete = null;
    $newQrPath = saveGcashQrUpload($beachId);
    $removeQr = isset($_POST['remove_gcash_qr']) && $_POST['remove_gcash_qr'] === '1';

    if ($newQrPath !== null || $removeQr) {
        $curStmt = $db->prepare("SELECT gcash_qr FROM beaches WHERE beach_id = ?");
        $curStmt->execute([$beachId]);
        $currentQr = (string) ($curStmt->fetchColumn() ?: '');

        if ($newQrPath !== null) {
            if ($currentQr !== '' && $currentQr !== $newQrPath) {
                $oldQrToDelete = $currentQr;
            }
            $db->prepare("UPDATE beaches SET gcash_qr = ? WHERE beach_id = ?")->execute([$newQrPath, $beachId]);
        } elseif ($removeQr) {
            if ($currentQr !== '') {
                $oldQrToDelete = $currentQr;
            }
            $db->prepare("UPDATE beaches SET gcash_qr = '' WHERE beach_id = ?")->execute([$beachId]);
        }
    }

    // 2. Replace amenities entirely with the submitted set.
    $db->prepare("DELETE FROM beach_amenities WHERE beach_id = ?")->execute([$beachId]);
    if (!empty($amenities)) {
        $placeholders = implode(',', array_fill(0, count($amenities), '?'));
        $stmt = $db->prepare("SELECT amenity_id, amenity_name FROM amenities WHERE amenity_name IN ($placeholders)");
        $stmt->execute($amenities);
        $amenityMap = [];
        while ($row = $stmt->fetch()) {
            $amenityMap[$row['amenity_name']] = $row['amenity_id'];
        }

        $insertAmenity = $db->prepare("INSERT INTO beach_amenities (beach_id, amenity_id) VALUES (:beach_id, :amenity_id)");
        foreach ($amenities as $amenityName) {
            if (isset($amenityMap[$amenityName])) {
                $insertAmenity->execute([':beach_id' => $beachId, ':amenity_id' => $amenityMap[$amenityName]]);
            } else {
                $insertNew = $db->prepare("INSERT INTO amenities (amenity_name) VALUES (:amenity_name)");
                $insertNew->execute([':amenity_name' => $amenityName]);
                $newId = $db->lastInsertId();
                $insertAmenity->execute([':beach_id' => $beachId, ':amenity_id' => $newId]);
            }
        }
    }

    // 3. Replace accommodations, preserving how many units are currently
    // occupied rather than resetting everything back to fully available.
    $existingAccStmt = $db->prepare("
        SELECT at.type_name, ba.total_units, ba.available_units
        FROM beach_accommodations ba
        JOIN accommodation_types at ON ba.type_id = at.type_id
        WHERE ba.beach_id = ?
    ");
    $existingAccStmt->execute([$beachId]);
    $existingOccupied = [];
    foreach ($existingAccStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $existingOccupied[$row['type_name']] = max(0, (int)$row['total_units'] - (int)$row['available_units']);
    }

    $db->prepare("DELETE FROM beach_accommodations WHERE beach_id = ?")->execute([$beachId]);

    if (!empty($accommodations)) {
        $typeNames = array_column($accommodations, 'type');
        $placeholders = implode(',', array_fill(0, count($typeNames), '?'));
        $stmt = $db->prepare("SELECT type_id, type_name FROM accommodation_types WHERE type_name IN ($placeholders)");
        $stmt->execute($typeNames);
        $typeMap = [];
        while ($row = $stmt->fetch()) {
            $typeMap[$row['type_name']] = $row['type_id'];
        }

        $insertAcc = $db->prepare("
            INSERT INTO beach_accommodations (beach_id, type_id, total_units, price_per_unit, available_units)
            VALUES (:beach_id, :type_id, :total_units, :price_per_unit, :available_units)
        ");

        foreach ($accommodations as $accommodation) {
            $typeName = $accommodation['type'];
            if (!isset($typeMap[$typeName])) continue;

            $totalUnits = (int) $accommodation['units'];
            $occupied = $existingOccupied[$typeName] ?? 0;
            $availableUnits = max(0, $totalUnits - $occupied);

            $insertAcc->execute([
                ':beach_id' => $beachId,
                ':type_id' => $typeMap[$typeName],
                ':total_units' => $totalUnits,
                ':price_per_unit' => isset($accommodation['price']) ? (float) $accommodation['price'] : 0,
                ':available_units' => $availableUnits
            ]);
        }
    }

    // 4. Delete any images the admin removed (DB row now; files after commit).
    $filesToDelete = [];
    if (!empty($deleteImageIds)) {
        $placeholders = implode(',', array_fill(0, count($deleteImageIds), '?'));
        $imgStmt = $db->prepare("SELECT image_id, image_url FROM beach_images WHERE beach_id = ? AND image_id IN ($placeholders)");
        $imgStmt->execute(array_merge([$beachId], $deleteImageIds));
        foreach ($imgStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $filesToDelete[] = $row['image_url'];
        }
        $db->prepare("DELETE FROM beach_images WHERE beach_id = ? AND image_id IN ($placeholders)")
            ->execute(array_merge([$beachId], $deleteImageIds));
    }

    // 5. Add any newly uploaded images, respecting the 4-image cap.
    $countStmt = $db->prepare("SELECT COUNT(*) AS c FROM beach_images WHERE beach_id = ?");
    $countStmt->execute([$beachId]);
    $existingImageCount = (int) $countStmt->fetch(PDO::FETCH_ASSOC)['c'];

    $maxImages = 4;
    $slotsLeft = max(0, $maxImages - $existingImageCount);

    if ($slotsLeft > 0 && isset($_FILES['beach_images'])) {
        $files = $_FILES['beach_images'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 0;

        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $maxSize = 5 * 1024 * 1024;
        $extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

        $sortStmt = $db->prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM beach_images WHERE beach_id = ?");
        $sortStmt->execute([$beachId]);
        $nextSort = (int) $sortStmt->fetch(PDO::FETCH_ASSOC)['max_sort'] + 1;

        $imgStmt = $db->prepare("
            INSERT INTO beach_images (beach_id, image_url, is_main, sort_order)
            VALUES (:beach_id, :image_url, :is_main, :sort_order)
        ");

        for ($i = 0; $i < $fileCount && $slotsLeft > 0; $i++) {
            if ($files['error'][$i] !== UPLOAD_ERR_OK) continue;

            $tmpName = $files['tmp_name'][$i];
            $size = $files['size'][$i];

            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $tmpName);
            finfo_close($finfo);

            if (!in_array($mimeType, $allowedTypes, true) || $size > $maxSize) continue;

            $uploadDir = __DIR__ . '/../uploads/beaches/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

            $fileName = 'beach_' . $beachId . '_' . uniqid() . '.' . $extMap[$mimeType];
            $destination = $uploadDir . $fileName;

            if (move_uploaded_file($tmpName, $destination)) {
                $imageUrl = '../uploads/beaches/' . $fileName;
                $imgStmt->execute([
                    ':beach_id' => $beachId,
                    ':image_url' => $imageUrl,
                    ':is_main' => ($existingImageCount === 0 && $nextSort === 0) ? 1 : 0,
                    ':sort_order' => $nextSort
                ]);
                $nextSort++;
                $slotsLeft--;
            }
        }
    }

    // Make sure exactly one image is flagged as main (the first by sort
    // order), in case the previous main image was just deleted above.
    $mainCheckStmt = $db->prepare("SELECT image_id FROM beach_images WHERE beach_id = ? AND is_main = 1");
    $mainCheckStmt->execute([$beachId]);
    if (!$mainCheckStmt->fetch()) {
        $db->prepare("
            UPDATE beach_images SET is_main = 1
            WHERE beach_id = ? ORDER BY sort_order ASC LIMIT 1
        ")->execute([$beachId]);
    }

    $db->commit();

    // Physically remove deleted image files now that the DB change is
    // committed (avoid deleting files if the transaction had rolled back).
    foreach ($filesToDelete as $relativeUrl) {
        $absolutePath = __DIR__ . '/../' . ltrim(str_replace('../', '', $relativeUrl), '/');
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    // Remove the previous GCash QR image file if it was replaced or cleared.
    if (!empty($oldQrToDelete)) {
        $absoluteQr = __DIR__ . '/../' . ltrim(str_replace('../', '', $oldQrToDelete), '/');
        if (is_file($absoluteQr)) {
            @unlink($absoluteQr);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Beach updated successfully!',
        'beach_id' => $beachId
    ]);
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Error in update-beach.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

/**
 * Saves the optional GCash QR code image uploaded with the beach edit form
 * (multipart field name: "gcash_qr"). Validates type/size, stores it under
 * uploads/payments/qr/, and returns the relative path to save in
 * beaches.gcash_qr - or null if no (valid) new file was uploaded.
 *
 * Mirrors the helper of the same name in add-beach.php.
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

    return '../uploads/payments/qr/' . $fileName;
}
?>
