<?php
// ========================================
// ===== BEACH UPDATE REQUESTS API =====
// ========================================
// Beach Owners submit "Update Requests" to Tourism Personnel (e.g. update
// GCash number, add an accommodation/amenity, update the entrance fee, or a
// general beach-info update). Tourism Personnel review them in their Update
// Requests page and approve/reject each one.
//
//   GET  -> list requests (optionally ?beach_id= / ?status=)
//   POST -> create a new request (Beach Owner)
//   PUT  -> update a request's status + optional admin note (Tourism Personnel)

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
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        listRequests($db);
        break;
    case 'POST':
        createRequest($db);
        break;
    case 'PUT':
        updateRequestStatus($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function listRequests($db) {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;
        $status = isset($_GET['status']) ? trim($_GET['status']) : null;

        // Pull the live beach name via a join when the beach still exists,
        // falling back to the name captured on the request itself.
        $sql = "
            SELECT r.*, COALESCE(b.beach_name, r.beach_name) AS beach_name_live
            FROM beach_update_requests r
            LEFT JOIN beaches b ON r.beach_id = b.beach_id
            WHERE 1=1
        ";
        $params = [];
        if ($beachId) {
            $sql .= " AND r.beach_id = ?";
            $params[] = $beachId;
        }
        if ($status && in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
            $sql .= " AND r.status = ?";
            $params[] = $status;
        }
        $sql .= " ORDER BY r.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $rows]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function createRequest($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            $data = $_POST;
        }

        $requestType = isset($data['request_type']) ? trim($data['request_type']) : '';
        $details = isset($data['details']) ? trim($data['details']) : '';

        if ($requestType === '') {
            echo json_encode(['success' => false, 'message' => 'Please select a request type.']);
            return;
        }
        if ($details === '') {
            echo json_encode(['success' => false, 'message' => 'Please describe the requested change.']);
            return;
        }

        $beachId = (isset($data['beach_id']) && $data['beach_id'] !== '') ? intval($data['beach_id']) : null;
        $ownerId = (isset($data['owner_id']) && $data['owner_id'] !== '') ? intval($data['owner_id']) : null;
        $ownerName = isset($data['owner_name']) ? trim($data['owner_name']) : '';

        // Capture the beach name now so the request stays readable even if the
        // beach is later renamed/removed.
        $beachName = isset($data['beach_name']) ? trim($data['beach_name']) : '';
        if ($beachName === '' && $beachId) {
            $bStmt = $db->prepare("SELECT beach_name FROM beaches WHERE beach_id = ?");
            $bStmt->execute([$beachId]);
            $row = $bStmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $beachName = $row['beach_name'];
            }
        }

        $stmt = $db->prepare("
            INSERT INTO beach_update_requests
                (beach_id, owner_id, owner_name, beach_name, request_type, details, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        ");
        $stmt->execute([$beachId, $ownerId, $ownerName, $beachName, $requestType, $details]);

        echo json_encode([
            'success' => true,
            'message' => 'Your request has been sent to the Tourism Office.',
            'request_id' => $db->lastInsertId()
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function updateRequestStatus($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            $data = [];
        }

        $requestId = isset($data['request_id']) ? intval($data['request_id']) : 0;
        $status = isset($data['status']) ? trim($data['status']) : '';

        if (!$requestId) {
            echo json_encode(['success' => false, 'message' => 'Missing request_id']);
            return;
        }
        if (!in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid status value']);
            return;
        }

        $adminNote = isset($data['admin_note']) ? trim($data['admin_note']) : null;

        $stmt = $db->prepare("
            UPDATE beach_update_requests
            SET status = ?, admin_note = ?
            WHERE request_id = ?
        ");
        $stmt->execute([$status, ($adminNote !== '' ? $adminNote : null), $requestId]);

        if ($stmt->rowCount() === 0) {
            // Still succeed if the row exists but nothing changed; only warn
            // when the id truly isn't found.
            $check = $db->prepare("SELECT request_id FROM beach_update_requests WHERE request_id = ?");
            $check->execute([$requestId]);
            if (!$check->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Request not found']);
                return;
            }
        }

        echo json_encode(['success' => true, 'message' => 'Request updated']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>
