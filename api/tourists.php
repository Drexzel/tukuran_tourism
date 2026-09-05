<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../db_connection.php';

$db = getDB();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getTourists($db);
        break;
    case 'POST':
        createTourist($db);
        break;
    case 'PUT':
        updateTourist($db);
        break;
    case 'DELETE':
        deleteTourist($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function getTourists($db) {
    try {
        $search = isset($_GET['search']) ? '%' . $_GET['search'] . '%' : '%';
        $gender = isset($_GET['gender']) ? $_GET['gender'] : '';
        $type = isset($_GET['type']) ? $_GET['type'] : '';
        $origin = isset($_GET['origin']) ? '%' . $_GET['origin'] . '%' : '%';

        $query = "
            SELECT 
                t.tourist_id,
                t.full_name,
                t.gender,
                t.age,
                t.origin,
                t.contact_number,
                t.email,
                t.created_at,
                (
                    SELECT COUNT(*) FROM visits v 
                    WHERE v.tourist_id = t.tourist_id
                ) as total_visits
            FROM tourists t
            WHERE t.full_name LIKE ?
        ";

        $params = [$search];

        if ($gender) {
            $query .= " AND t.gender = ?";
            $params[] = $gender;
        }

        if ($origin !== '%') {
            $query .= " AND t.origin LIKE ?";
            $params[] = $origin;
        }

        $query .= " ORDER BY t.created_at DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $tourists = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data' => $tourists
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

function createTourist($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['full_name']) || !isset($data['origin'])) {
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO tourists (
                full_name, gender, age, origin, contact_number, email
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $data['full_name'],
            $data['gender'] ?? null,
            $data['age'] ?? null,
            $data['origin'],
            $data['contact_number'] ?? null,
            $data['email'] ?? null
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Tourist created successfully',
            'tourist_id' => $db->lastInsertId()
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

function updateTourist($db) {
    // Similar implementation for update
}

function deleteTourist($db) {
    // Similar implementation for delete
}
?>