<?php
// ============================================================
// ===== LOGIN DIAGNOSTIC & DEFAULT-ADMIN REPAIR TOOL =====
// ============================================================
// Open in a browser to see the state of the default Tourism Personnel
// account (in the `tourism_personnel` table):
//
//   http://localhost/.../api/diagnose-login.php
//
// Add ?fix=1 to (re)create the default admin (username: admin,
// email: admin@tukuran.gov.ph, password: admin123, hashed with bcrypt):
//
//   http://localhost/.../api/diagnose-login.php?fix=1
//
// DELETE this file once login works.

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain; charset=utf-8');

require_once '../includes/db_connection.php';
$db = getDB(); // runs self-heal (creates tourism_personnel + seeds admin if missing)

$email    = 'admin@tukuran.gov.ph';
$username = 'admin';
$pass     = 'admin123';
$doFix    = isset($_GET['fix']) && $_GET['fix'] == '1';

echo "==== LOGIN DIAGNOSTIC (tourism_personnel) ====\n";
echo "PHP version: " . PHP_VERSION . "\n\n";

try {
    $has = $db->query("SHOW TABLES LIKE 'tourism_personnel'")->rowCount() > 0;
    echo "tourism_personnel table exists: " . ($has ? "YES" : "NO") . "\n";
    if (!$has) { echo "\n-> Reload once; the self-heal will create it and seed the admin.\n"; exit; }

    $stmt = $db->prepare("SELECT personnelID, fullName, username, email, position, status, password FROM tourism_personnel WHERE email = :e OR username = :u LIMIT 1");
    $stmt->execute([':e' => $email, ':u' => $username]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "default admin exists:           " . ($admin ? "YES" : "NO") . "\n";
    if ($admin) {
        echo "  personnelID:  " . $admin['personnelID'] . "\n";
        echo "  username:     " . $admin['username'] . "\n";
        echo "  email:        " . $admin['email'] . "\n";
        echo "  position:     " . $admin['position'] . "\n";
        echo "  status:       " . $admin['status'] . ($admin['status'] === 'Active' ? "  (ok)" : "  <-- not Active") . "\n";
        echo "  pw hash pref: " . substr($admin['password'], 0, 4) . "\n";
        $v = preg_match('/^\$(2|argon)/', $admin['password']) ? password_verify($pass, $admin['password']) : ($admin['password'] === $pass);
        echo "  'admin123' matches:           " . ($v ? "YES" : "NO  <-- reason login fails") . "\n";
    }

    if ($doFix) {
        echo "\n==== APPLYING FIX (?fix=1) ====\n";
        $hash = password_hash($pass, PASSWORD_DEFAULT);
        if ($admin) {
            $db->prepare("UPDATE tourism_personnel SET password = :p, status = 'Active', position = COALESCE(NULLIF(position,''),'Tourism Personnel') WHERE personnelID = :id")
               ->execute([':p' => $hash, ':id' => $admin['personnelID']]);
            echo "Default admin password reset to 'admin123' and status set Active.\n";
        } else {
            $db->prepare("INSERT INTO tourism_personnel (fullName, username, password, email, position, status) VALUES ('Tourism Office Admin', :u, :p, :e, 'Tourism Personnel', 'Active')")
               ->execute([':u' => $username, ':p' => $hash, ':e' => $email]);
            echo "Default admin account created in tourism_personnel.\n";
        }
        $stmt->execute([':e' => $email, ':u' => $username]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "Re-check 'admin123' matches:    " . (password_verify($pass, $admin['password']) ? "YES - log in with  admin  /  admin123" : "NO - unexpected") . "\n";
        echo "\nIMPORTANT: delete api/diagnose-login.php now.\n";
    } elseif (!$admin || $admin['status'] !== 'Active' || !(preg_match('/^\$(2|argon)/', $admin['password']) ? password_verify($pass, $admin['password']) : ($admin['password'] === $pass))) {
        echo "\n-> To (re)create/repair the default admin, reload with ?fix=1 at the end of the URL.\n";
    } else {
        echo "\n-> Default admin looks correct. Log in with:  admin  /  admin123\n";
        echo "   If it still fails, hard-refresh the login page (Ctrl+Shift+R) and\n";
        echo "   confirm the updated api/login.php was uploaded.\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
?>
