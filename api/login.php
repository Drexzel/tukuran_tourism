<?php
// ============================================================
// ===== LOGIN API (role auto-detected from the database) =====
// ============================================================
// Expects JSON POST body: { "identifier": "email or username", "password": "..." }
//
// The client sends NO role. This endpoint identifies the account by its
// username or email across the three real account tables and determines
// the role from where/what the account is, then tells the client which
// dashboard to open:
//
//   tourism_personnel                 -> Tourism Personnel -> Tourism Personnel/admin-dashboard.html
//   beach_owners                      -> Beach Operator     -> Beach owner page/beach-owner-dashboard.html
//   users.role = 'TourismPersonnel'   -> Tourism Personnel -> (admin dashboard)
//   users.role = 'BeachOwner'         -> Beach Operator     -> (owner dashboard)
//   users.role = 'Tourist'            -> Tourist            -> Landing page/beach.html
//
// Passwords are verified with the system's bcrypt method (password_verify).
// For robustness with any pre-existing rows that may not have been hashed,
// a plaintext / md5 fallback is also accepted - but every account this app
// creates (see api/add-beach-owner.php and the default admin seed in
// includes/db_connection.php) is stored with password_hash()/bcrypt.

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

$data = json_decode(file_get_contents('php://input'), true);

// Accept `identifier`, or fall back to legacy `email` / `username` keys.
$identifier = trim(
    $data['identifier']
    ?? $data['email']
    ?? $data['username']
    ?? ''
);
$password = $data['password'] ?? '';

if ($identifier === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'Email/Username and password are required']);
    exit;
}

/**
 * Verify a submitted password against a stored value.
 * - bcrypt/argon hashes (start with "$2", "$argon") -> password_verify()
 * - otherwise -> accept exact plaintext match or md5 match (legacy rows only)
 */
function verifyPassword($input, $stored) {
    if ($stored === null || $stored === '') return false;
    if (preg_match('/^\$(2|argon)/', $stored)) {
        return password_verify($input, $stored);
    }
    return hash_equals($stored, $input) || hash_equals($stored, md5($input));
}

// Helper: does a table exist? (some databases may not have all three)
function tableExists($db, $name) {
    try {
        return $db->query("SHOW TABLES LIKE " . $db->quote($name))->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

$invalid = ['success' => false, 'message' => 'Invalid credentials. Please try again.'];

try {
    // ----------------------------------------------------------------
    // 1) Tourism Personnel (admin) -> `tourism_personnel`
    //    Matched by username OR email. Column is `password`, status enum
    //    ('Active','Inactive').
    // ----------------------------------------------------------------
    if (tableExists($db, 'tourism_personnel')) {
        $stmt = $db->prepare(
            "SELECT * FROM tourism_personnel WHERE username = :id OR email = :id LIMIT 1"
        );
        $stmt->execute([':id' => $identifier]);
        $tp = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($tp && verifyPassword($password, $tp['password'])) {
            if (isset($tp['status']) && strtolower($tp['status']) !== 'active') {
                echo json_encode(['success' => false, 'message' => 'Your account is inactive. Please contact the administrator.']);
                exit;
            }
            unset($tp['password']);
            echo json_encode([
                'success'  => true,
                'message'  => 'Login successful',
                'role'     => 'admin',
                'redirect' => '../Tourism Personnel/admin-dashboard.html',
                'data'     => $tp
            ]);
            exit;
        }
    }

    // ----------------------------------------------------------------
    // 2) Beach Operator (Beach Owner) -> `beach_owners`
    //    Matched by email OR username. Column is `password_hash` (bcrypt).
    // ----------------------------------------------------------------
    if (tableExists($db, 'beach_owners')) {
        $stmt = $db->prepare(
            "SELECT * FROM beach_owners WHERE email = :id OR username = :id LIMIT 1"
        );
        $stmt->execute([':id' => $identifier]);
        $owner = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($owner && verifyPassword($password, $owner['password_hash'])) {
            if (isset($owner['status']) && strtolower($owner['status']) !== 'active') {
                echo json_encode([
                    'success' => false,
                    'message' => 'Your account is ' . strtolower($owner['status']) . '. Please contact the Tourism Office.'
                ]);
                exit;
            }
            unset($owner['password_hash']);
            if (isset($owner['beach_id'])) {
                $owner['beach_id'] = intval($owner['beach_id']);
            }
            echo json_encode([
                'success'  => true,
                'message'  => 'Login successful',
                'role'     => 'owner',
                'redirect' => '../Beach owner page/beach-owner-dashboard.html',
                'data'     => $owner
            ]);
            exit;
        }
    }

    // ----------------------------------------------------------------
    // 3) Generic `users` table (role enum: Tourist/BeachOwner/TourismPersonnel)
    //    Matched by username OR email. Column is `password`.
    // ----------------------------------------------------------------
    if (tableExists($db, 'users')) {
        $stmt = $db->prepare(
            "SELECT * FROM users WHERE username = :id OR email = :id LIMIT 1"
        );
        $stmt->execute([':id' => $identifier]);
        $u = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($u && verifyPassword($password, $u['password'])) {
            if (isset($u['status']) && strtolower($u['status']) !== 'active') {
                echo json_encode(['success' => false, 'message' => 'Your account is ' . strtolower($u['status']) . '. Please contact the administrator.']);
                exit;
            }

            // Map the users.role value onto the app's role + dashboard.
            $roleRaw = strtolower($u['role'] ?? '');
            unset($u['password']);

            if ($roleRaw === 'tourismpersonnel' || $roleRaw === 'admin') {
                echo json_encode(['success' => true, 'message' => 'Login successful', 'role' => 'admin',
                    'redirect' => '../Tourism Personnel/admin-dashboard.html', 'data' => $u]);
                exit;
            }
            if ($roleRaw === 'beachowner' || $roleRaw === 'owner') {
                echo json_encode(['success' => true, 'message' => 'Login successful', 'role' => 'owner',
                    'redirect' => '../Beach owner page/beach-owner-dashboard.html', 'data' => $u]);
                exit;
            }
            // Default: tourist
            echo json_encode(['success' => true, 'message' => 'Login successful', 'role' => 'tourist',
                'redirect' => '../Landing page/beach.html', 'data' => $u]);
            exit;
        }
    }

    // Nothing matched anywhere.
    echo json_encode($invalid);
} catch (Exception $e) {
    error_log('Error in login.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Login failed. Please try again.']);
}
?>
