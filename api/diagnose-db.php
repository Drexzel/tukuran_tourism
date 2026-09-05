<?php
// TEMPORARY DIAGNOSTIC SCRIPT - delete this file once you're done debugging.
// Open this directly in your browser, e.g.:
//   http://localhost/tukuran tourism/BEACH/api/diagnose-db.php
// It shows exactly which MySQL server/database PHP is actually talking to,
// so we can compare it against what phpMyAdmin shows.

header('Content-Type: application/json');

require_once '../includes/db_connection.php';
$db = getDB();

try {
    $info = [];

    // Which server/port/socket is PHP's PDO connection actually using?
    $info['server_info']   = $db->getAttribute(PDO::ATTR_SERVER_INFO);
    $info['server_version'] = $db->getAttribute(PDO::ATTR_SERVER_VERSION);
    $info['connection_status'] = $db->getAttribute(PDO::ATTR_CONNECTION_STATUS);

    $info['current_database'] = $db->query("SELECT DATABASE() AS db")->fetch(PDO::FETCH_ASSOC)['db'];
    $info['hostname_port']    = $db->query("SELECT @@hostname AS host, @@port AS port")->fetch(PDO::FETCH_ASSOC);
    $info['datadir']          = $db->query("SELECT @@datadir AS datadir")->fetch(PDO::FETCH_ASSOC)['datadir'];

    $info['reservations_count'] = (int) $db->query("SELECT COUNT(*) AS c FROM reservations")->fetch(PDO::FETCH_ASSOC)['c'];
    $info['latest_reservations'] = $db->query("SELECT reservation_id, beach_id, full_name, reservation_date, status, created_at FROM reservations ORDER BY created_at DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

    // Also try an actual insert + immediate read-back, to rule out any
    // silent transaction/commit issue.
    $testStmt = $db->prepare("
        INSERT INTO reservations (beach_id, full_name, contact_number, email, origin, num_visitors, reservation_date, status)
        VALUES (999999, 'DIAGNOSTIC TEST ROW - safe to delete', '00000000000', 'diagnostic@test.local', 'test', 1, CURDATE(), 'Pending')
    ");
    $testStmt->execute();
    $insertedId = $db->lastInsertId();
    $readBack = $db->prepare("SELECT * FROM reservations WHERE reservation_id = ?");
    $readBack->execute([$insertedId]);
    $info['diagnostic_insert_id'] = $insertedId;
    $info['diagnostic_read_back'] = $readBack->fetch(PDO::FETCH_ASSOC);

    echo json_encode($info, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}