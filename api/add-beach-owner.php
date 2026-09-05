<?php
// ========================================
// ===== ADMIN: ADD BEACH OWNER ACCOUNT =====
// ========================================
// Only the Tourism Personnel (Admin) uses this - beach owners can no
// longer self-register (see api/register.php, which is now disabled).
// Generates a random temporary password, saves the hashed version, links
// the account to a beach, and emails the login credentials to the owner.

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
require_once '../includes/mailer.php';

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$resortName = trim($data['resortName'] ?? '');
$ownerName = trim($data['ownerName'] ?? '');
$email = trim($data['email'] ?? '');
$phoneNumber = trim($data['phoneNumber'] ?? '');
$beachId = isset($data['beachId']) && $data['beachId'] !== '' ? intval($data['beachId']) : null;

if (!$resortName || !$ownerName || !$email) {
    echo json_encode(['success' => false, 'message' => 'Resort name, owner name, and email are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Please provide a valid email address']);
    exit;
}

try {
    // Check for existing email
    $stmt = $db->prepare("SELECT owner_id FROM beach_owners WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'An account with that email already exists']);
        exit;
    }

    // Generate a username from the email (before the @), ensuring uniqueness
    $baseUsername = strtolower(preg_replace('/[^a-z0-9]/i', '', explode('@', $email)[0]));
    if ($baseUsername === '') $baseUsername = 'owner';
    $username = $baseUsername;
    $suffix = 1;
    while (true) {
        $stmt = $db->prepare("SELECT owner_id FROM beach_owners WHERE username = :username LIMIT 1");
        $stmt->execute([':username' => $username]);
        if (!$stmt->fetch()) break;
        $username = $baseUsername . $suffix;
        $suffix++;
    }

    // Generate a random, readable temporary password
    $password = generateRandomPassword();
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("
        INSERT INTO beach_owners (resort_name, owner_name, email, phone_number, username, password_hash, beach_id, status)
        VALUES (:resort_name, :owner_name, :email, :phone_number, :username, :password_hash, :beach_id, 'Active')
    ");
    $stmt->execute([
        ':resort_name' => $resortName,
        ':owner_name' => $ownerName,
        ':email' => $email,
        ':phone_number' => $phoneNumber,
        ':username' => $username,
        ':password_hash' => $passwordHash,
        ':beach_id' => $beachId
    ]);

    $ownerId = $db->lastInsertId();

    // Look up the assigned beach's name (if any) so the credentials email
    // can tell the owner which beach they now manage.
    $beachName = 'Not yet assigned - contact the Tourism Office';
    if ($beachId) {
        $beachStmt = $db->prepare("SELECT beach_name FROM beaches WHERE beach_id = ?");
        $beachStmt->execute([$beachId]);
        $beachRow = $beachStmt->fetch(PDO::FETCH_ASSOC);
        if ($beachRow) {
            $beachName = $beachRow['beach_name'];
        }
    }

    // Attempt to email the credentials. This never throws - a mail
    // problem must never undo or block the account that was just saved
    // to MySQL above - so the account is always created successfully
    // regardless of whether the email actually goes out.
    $emailResult = ['sent' => false, 'method' => 'none', 'error' => 'Email sending was skipped due to an unexpected error.'];
    try {
        $emailResult = sendCredentialsEmail($email, $ownerName, $username, $password, $beachName);
    } catch (Exception $mailErr) {
        error_log('add-beach-owner.php: email sending threw an unexpected exception: ' . $mailErr->getMessage());
    }
    $emailSent = $emailResult['sent'];

    echo json_encode([
        'success' => true,
        'message' => $emailSent
            ? 'Beach Owner account has been created successfully. The login credentials have been sent to the registered email address.'
            : 'Beach Owner account has been created and saved successfully, but the credentials email could not be sent. '
                . 'Error: ' . ($emailResult['error'] ?? 'Unknown email error.'),
        'owner_id' => $ownerId,
        'email_sent' => $emailSent,
        'email_method' => $emailResult['method'],
        'email_error' => $emailResult['error'],
        'username' => $username,
        'temporary_password' => $password
    ]);

} catch (Exception $e) {
    error_log('Error in add-beach-owner.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

// ========================================
// ===== HELPERS =====
// ========================================

function generateRandomPassword($length = 10) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    $password = '';
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $password;
}

function sendCredentialsEmail($toEmail, $ownerName, $username, $password, $beachName) {
    $subject = 'Welcome to Tukuran Tourism Information Management System';
    // Build the login link from the live domain automatically so the emailed
    // link works on InfinityFree (falls back to a relative path if the host
    // can't be determined for some reason).
    $scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host    = $_SERVER['HTTP_HOST'] ?? '';
    $loginUrl = $host
        ? $scheme . '://' . $host . "/Log-in page/login.html"
        : "/Log-in page/login.html";

    $plainTextBody = "Dear Beach Owner,\r\n\r\n"
        . "Your account has been successfully created by the Tourism Office.\r\n\r\n"
        . "Your login credentials are:\r\n\r\n"
        . "Username:\r\n{$username}\r\n\r\n"
        . "Password:\r\n{$password}\r\n\r\n"
        . "Login here:\r\n{$loginUrl}\r\n\r\n"
        . "For security purposes, please change your password after your first login.\r\n\r\n"
        . "Thank you.\r\n\r\n"
        . "Tukuran Tourism Office\r\n";

    $htmlBody = '
        <p>Dear Beach Owner,</p>

        <p>Your account has been successfully created by the Tourism Office.</p>

        <p>Your login credentials are:</p>

        <p>
        <strong>Username:</strong> ' . htmlspecialchars($username) . '<br>
        <strong>Password:</strong> ' . htmlspecialchars($password) . '
        </p>

        <p>
        <strong>Login here:</strong><br>
        <a href="' . $loginUrl . '">
        ' . $loginUrl . '
        </a>
        </p>

        <p>
        For security purposes, please change your password after your first login.
        </p>

        <p>
        Thank you.
        </p>

        <p>
        <strong>Tukuran Tourism Office</strong>
        </p>
    ';

    return sendAppEmail($toEmail, $ownerName, $subject, $htmlBody, $plainTextBody);
}
?>
