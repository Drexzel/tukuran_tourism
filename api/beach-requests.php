<?php
// ========================================
// ===== BEACH OWNER UPDATE REQUESTS API =====
// ========================================
// POST: submitted by a Beach Owner from "Update Requests" (scoped to
//       their assigned beach - see Beach owner page/update-requests.js).
//       Examples: update GCash number, add a new accommodation type, add
//       a new amenity, update the entrance fee, request a general beach
//       information update.
// GET:  read by Tourism Personnel's "Update Requests" page (all beaches,
//       with optional status filter), or by the Beach Owner's own page
//       (scoped to their beach_id) to see the status of their requests.
// PUT:  Tourism Personnel approves or rejects a request, optionally with
//       a note and a quick direct update to the beach's simple fields
//       (GCash number/name, entrance fees) so the change is immediately
//       reflected everywhere the beaches table is read from. Additions
//       to accommodations/amenities are approved here and then added by
//       Tourism Personnel in Beach Management, same as any other beach
//       edit, which keeps that logic in one place.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        getBeachRequests($db);
        break;
    case 'POST':
        createBeachRequest($db);
        break;
    case 'PUT':
        reviewBeachRequest($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function getBeachRequests($db) {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';

        $sql = "
            SELECT r.*, b.beach_name, b.location, b.barangay,
                   o.owner_name, o.resort_name
            FROM beach_update_requests r
            JOIN beaches b ON r.beach_id = b.beach_id
            LEFT JOIN beach_owners o ON r.owner_id = o.owner_id
            WHERE 1=1
        ";
        $params = [];

        if ($beachId) {
            $sql .= " AND r.beach_id = ?";
            $params[] = $beachId;
        }
        if ($status && $status !== 'all') {
            $sql .= " AND r.status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY r.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $requests]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function createBeachRequest($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['beach_id', 'request_type', 'title'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
                return;
            }
        }

        $stmt = $db->prepare("
            INSERT INTO beach_update_requests (
                beach_id, owner_id, request_type, title, details, requested_value, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        ");
        $stmt->execute([
            intval($data['beach_id']),
            isset($data['owner_id']) && $data['owner_id'] !== '' ? intval($data['owner_id']) : null,
            $data['request_type'],
            $data['title'],
            $data['details'] ?? '',
            $data['requested_value'] ?? ''
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Request sent to the Tourism Office',
            'request_id' => $db->lastInsertId()
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function reviewBeachRequest($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['request_id']) || !isset($data['status'])) {
            echo json_encode(['success' => false, 'message' => 'Missing request_id or status']);
            return;
        }

        $allowed = ['Pending', 'Approved', 'Rejected'];
        if (!in_array($data['status'], $allowed, true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid status value']);
            return;
        }

        $requestId = intval($data['request_id']);
        $adminNotes = $data['admin_notes'] ?? '';

        // Look up the request first (need its beach_id for the optional
        // quick-apply update below).
        $findStmt = $db->prepare("SELECT * FROM beach_update_requests WHERE request_id = ?");
        $findStmt->execute([$requestId]);
        $request = $findStmt->fetch(PDO::FETCH_ASSOC);
        if (!$request) {
            echo json_encode(['success' => false, 'message' => 'Request not found']);
            return;
        }

        // Optional: Tourism Personnel can directly apply a simple field
        // change (GCash number/name, adult/child fee) while approving,
        // so the change is saved to the beaches table in the same step
        // and immediately shows up everywhere the beach is displayed.
        if ($data['status'] === 'Approved' && !empty($data['apply_field']) && isset($data['apply_value'])) {
            $allowedFields = [
                'gcash_number' => 'gcash_number',
                'gcash_name'   => 'gcash_name',
                'adult_fee'    => 'adult_fee',
                'child_fee'    => 'child_fee',
                'description'  => 'description',
                'location'     => 'location',
            ];
            $field = $data['apply_field'];
            if (isset($allowedFields[$field])) {
                $column = $allowedFields[$field];
                $updateStmt = $db->prepare("UPDATE beaches SET {$column} = ? WHERE beach_id = ?");
                $updateStmt->execute([$data['apply_value'], intval($request['beach_id'])]);
            }
        }

        $updateReq = $db->prepare("
            UPDATE beach_update_requests
            SET status = ?, admin_notes = ?, reviewed_at = NOW()
            WHERE request_id = ?
        ");
        $updateReq->execute([$data['status'], $adminNotes, $requestId]);

        echo json_encode(['success' => true, 'message' => 'Request updated']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>
