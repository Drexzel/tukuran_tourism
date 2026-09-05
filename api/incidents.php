<?php
// ========================================
// ===== INCIDENT REPORTS API =====
// ========================================
// POST: submitted by a Beach Owner from Incident Alert (scoped to their
//       assigned beach on the front end - see Beach owner page/incident-alert.js).
// GET:  read by Tourism Personnel's Incident Report page, with optional
//       search/type/status filters.
// PUT:  Tourism Personnel updates an incident's status.

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

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        getIncidents($db);
        break;
    case 'POST':
        createIncident($db);
        break;
    case 'PUT':
        updateIncidentStatus($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function getIncidents($db) {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $type = isset($_GET['type']) ? $_GET['type'] : '';
        $status = isset($_GET['status']) ? $_GET['status'] : '';

        $sql = "
            SELECT i.*, b.beach_name, b.location, b.barangay
            FROM incident_reports i
            JOIN beaches b ON i.beach_id = b.beach_id
            WHERE 1=1
        ";
        $params = [];

        if ($beachId) {
            $sql .= " AND i.beach_id = ?";
            $params[] = $beachId;
        }
        if ($type && $type !== 'all') {
            $sql .= " AND i.incident_type = ?";
            $params[] = $type;
        }
        if ($status && $status !== 'all') {
            $sql .= " AND i.status = ?";
            $params[] = $status;
        }
        if ($search !== '') {
            $sql .= " AND (b.beach_name LIKE ? OR i.incident_type LIKE ? OR i.description LIKE ?)";
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql .= " ORDER BY i.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $incidents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $incidents]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function createIncident($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['beach_id', 'incident_type', 'description'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
                return;
            }
        }

        $stmt = $db->prepare("
            INSERT INTO incident_reports (
                beach_id, reported_by, incident_type, incident_date, incident_time, description, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        ");
        $stmt->execute([
            intval($data['beach_id']),
            $data['reported_by'] ?? '',
            $data['incident_type'],
            $data['incident_date'] ?? date('Y-m-d'),
            $data['incident_time'] ?? date('H:i:s'),
            $data['description']
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Incident alert sent to the Tourism Office',
            'incident_id' => $db->lastInsertId()
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function updateIncidentStatus($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['incident_id']) || !isset($data['status'])) {
            echo json_encode(['success' => false, 'message' => 'Missing incident_id or status']);
            return;
        }

        $allowed = ['Pending', 'Investigating', 'Resolved', 'Closed'];
        if (!in_array($data['status'], $allowed, true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid status value']);
            return;
        }

        $stmt = $db->prepare("UPDATE incident_reports SET status = ? WHERE incident_id = ?");
        $stmt->execute([$data['status'], intval($data['incident_id'])]);

        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'Incident not found']);
            return;
        }

        echo json_encode(['success' => true, 'message' => 'Incident status updated']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>
