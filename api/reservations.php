<?php
// ========================================
// ===== RESERVATIONS API =====
// ========================================
// Persists reservations submitted through the Landing Page's
// reservation-form.html, and is queried by the Tourism Personnel Dashboard
// (via dashboard-stats.php) for "Total Reservations" and visitor counts.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/db_connection.php';
require_once '../includes/mailer.php';

$db = getDB();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getReservations($db);
        break;
    case 'POST':
        createReservation($db);
        break;
    case 'PUT':
        updateReservationStatus($db);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function getReservations($db) {
    try {
        $beachId = isset($_GET['beach_id']) ? intval($_GET['beach_id']) : null;
        $status = isset($_GET['status']) ? $_GET['status'] : null;
        $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : null;
        $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : null;
        // Added so a single reservation can be looked up directly (e.g. by
        // the tourist-facing confirmation page polling its own reservation's
        // status) without pulling the whole beach's list.
        $reservationId = isset($_GET['reservation_id']) ? intval($_GET['reservation_id']) : null;

        $sql = "
            SELECT r.*, b.beach_name
            FROM reservations r
            JOIN beaches b ON r.beach_id = b.beach_id
            WHERE 1=1
        ";
        $params = [];

        if ($reservationId) {
            $sql .= " AND r.reservation_id = ?";
            $params[] = $reservationId;
        }
        if ($beachId) {
            $sql .= " AND r.beach_id = ?";
            $params[] = $beachId;
        }
        if ($status) {
            $sql .= " AND r.status = ?";
            $params[] = $status;
        }
        if ($dateFrom) {
            $sql .= " AND r.reservation_date >= ?";
            $params[] = $dateFrom;
        }
        if ($dateTo) {
            $sql .= " AND r.reservation_date <= ?";
            $params[] = $dateTo;
        }

        $sql .= " ORDER BY r.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $reservations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $reservations]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function createReservation($db) {
    try {
        // The Reservation Form now uploads a Proof of Payment file, so the
        // request arrives as multipart/form-data ($_POST + $_FILES). Older
        // callers that still POST a raw JSON body keep working: we fall back
        // to reading php://input when no form fields are present.
        $isMultipart = !empty($_POST) || !empty($_FILES);
        if ($isMultipart) {
            $data = $_POST;
        } else {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!is_array($data)) {
                $data = [];
            }
        }

        $required = ['beach_id', 'full_name', 'contact_number', 'email', 'num_visitors', 'reservation_date'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
                return;
            }
        }

        // ----- Online Down Payment Processing: required payment inputs -----
        // Payment Reference Number is always required. The Proof of Payment
        // file is required on multipart submissions (the Reservation Form);
        // legacy JSON callers may omit it and simply store no file.
        $paymentReference = isset($data['payment_reference']) ? trim($data['payment_reference']) : '';
        if ($paymentReference === '') {
            echo json_encode(['success' => false, 'message' => 'Missing required field: payment_reference']);
            return;
        }

        // Validate beach_id exists, and that the beach is currently Active.
        // A deactivated beach (see api/beach-status.php) must not accept new
        // reservations even if someone reaches this endpoint directly.
        $checkBeach = $db->prepare("SELECT beach_id, status FROM beaches WHERE beach_id = ?");
        $checkBeach->execute([intval($data['beach_id'])]);
        $beachRow = $checkBeach->fetch(PDO::FETCH_ASSOC);
        if (!$beachRow) {
            echo json_encode(['success' => false, 'message' => 'Invalid beach_id: Beach does not exist']);
            return;
        }
        if ($beachRow['status'] !== 'Active') {
            echo json_encode(['success' => false, 'message' => 'This beach is not currently accepting reservations.']);
            return;
        }

        // ----- Handle the uploaded Proof of Payment (JPG/JPEG/PNG/PDF) -----
        $proofPath = '';
        if (isset($_FILES['proof_of_payment']) && $_FILES['proof_of_payment']['error'] !== UPLOAD_ERR_NO_FILE) {
            $file = $_FILES['proof_of_payment'];

            if ($file['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => 'Proof of payment upload failed. Please try again.']);
                return;
            }

            $allowedTypes = [
                'image/jpeg' => 'jpg',
                'image/png'  => 'png',
                'application/pdf' => 'pdf'
            ];
            $maxSize = 5 * 1024 * 1024; // 5MB

            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            if (!isset($allowedTypes[$mimeType])) {
                echo json_encode(['success' => false, 'message' => 'Proof of payment must be a JPG, JPEG, PNG or PDF file.']);
                return;
            }
            if ($file['size'] > $maxSize) {
                echo json_encode(['success' => false, 'message' => 'Proof of payment is too large (maximum 5MB).']);
                return;
            }

            $uploadDir = __DIR__ . '/../uploads/payments/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $ext = $allowedTypes[$mimeType];
            $fileName = 'payment_' . intval($data['beach_id']) . '_' . uniqid() . '.' . $ext;
            $destination = $uploadDir . $fileName;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                echo json_encode(['success' => false, 'message' => 'Could not save the proof of payment file on the server.']);
                return;
            }

            // Stored relative to any page one folder below the BEACH root
            // (Landing page/, Beach owner page/, Tourism Personnel/),
            // matching how beach image URLs are stored.
            $proofPath = '../uploads/payments/' . $fileName;
        } elseif ($isMultipart) {
            // A multipart submission from the Reservation Form must include
            // the proof of payment - it's a required field there.
            echo json_encode(['success' => false, 'message' => 'Missing required field: proof of payment']);
            return;
        }

        // Optional amount paid (down payment). Stored as-is when provided.
        $amountPaid = (isset($data['amount_paid']) && $data['amount_paid'] !== '')
            ? floatval($data['amount_paid'])
            : null;

        // A payment reference (and, on the form, a proof file) has been
        // provided, so the reservation is submitted with the payment marked
        // "Submitted" and the payment date/time recorded now.
        $paymentStatus = 'Submitted';
        $paymentDate = date('Y-m-d H:i:s');

        // ----- Guest Type (Local / Foreign) -----
        // Same rule as the Walk-in Guest Form: local_visitors + foreign_visitors
        // must always equal num_visitors (Total Guests) so no visitor is ever
        // double-counted or dropped. The form already enforces this client-side;
        // this re-derives/clamps it server-side too so a direct API call can't
        // desync the two figures.
        $numVisitors = intval($data['num_visitors']);
        $foreignVisitors = intval($data['foreign_visitors'] ?? 0);
        if ($foreignVisitors < 0) $foreignVisitors = 0;
        if ($foreignVisitors > $numVisitors) $foreignVisitors = $numVisitors;
        $localVisitors = $numVisitors - $foreignVisitors;

        $stmt = $db->prepare("
            INSERT INTO reservations (
                beach_id, full_name, contact_number, email, origin,
                num_visitors, male_count, female_count,
                age_kids, age_teens, age_adults_18_25, age_adults_26_40, age_adults_41_59, age_seniors,
                local_visitors, foreign_visitors,
                reservation_date, eta_time, accommodation_type,
                payment_reference, proof_of_payment, payment_status, amount_paid, payment_date,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        ");

        $result = $stmt->execute([
            intval($data['beach_id']),
            $data['full_name'],
            $data['contact_number'],
            $data['email'],
            $data['origin'] ?? '',
            $numVisitors,
            intval($data['male_count'] ?? 0),
            intval($data['female_count'] ?? 0),
            // Age Bracket / Guest Breakdown counts (default 0 when not sent)
            intval($data['age_kids'] ?? 0),
            intval($data['age_teens'] ?? 0),
            intval($data['age_adults_18_25'] ?? 0),
            intval($data['age_adults_26_40'] ?? 0),
            intval($data['age_adults_41_59'] ?? 0),
            intval($data['age_seniors'] ?? 0),
            $localVisitors,
            $foreignVisitors,
            $data['reservation_date'],
            $data['eta_time'] ?? null,
            $data['accommodation_type'] ?? $data['accommodation'] ?? 'none',
            $paymentReference,
            $proofPath,
            $paymentStatus,
            $amountPaid,
            $paymentDate
        ]);

        if (!$result) {
            $errorInfo = $stmt->errorInfo();
            echo json_encode(['success' => false, 'message' => 'Database error: ' . ($errorInfo[2] ?? 'Unknown error')]);
            return;
        }

        $reservationId = $db->lastInsertId();

        // Look up the beach name for the confirmation email
        $beachName = 'Selected Beach';
        $beachStmt = $db->prepare("SELECT beach_name FROM beaches WHERE beach_id = ?");
        $beachStmt->execute([intval($data['beach_id'])]);
        $beachRow = $beachStmt->fetch(PDO::FETCH_ASSOC);
        if ($beachRow) {
            $beachName = $beachRow['beach_name'];
        }

        // Send confirmation email
        $emailResult = ['sent' => false, 'method' => 'none', 'error' => 'Email sending was skipped due to an unexpected error.'];
        try {
            $emailResult = sendReservationConfirmationEmail(
                $data['email'],
                $data['full_name'],
                $beachName,
                $data['reservation_date'],
                $data['eta_time'] ?? null,
                intval($data['num_visitors']),
                $reservationId,
                $paymentReference
            );
        } catch (Exception $mailErr) {
            error_log('reservations.php: confirmation email threw an unexpected exception: ' . $mailErr->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Reservation submitted - pending approval by the Beach Owner',
            'reservation_id' => $reservationId,
            'email_sent' => $emailResult['sent'],
            'email_method' => $emailResult['method'],
            'email_error' => $emailResult['error']
        ]);
    } catch (PDOException $e) {
        error_log('PDO Error in createReservation: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    } catch (Exception $e) {
        error_log('Error in createReservation: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function updateReservationStatus($db) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['reservation_id']) || !isset($data['status'])) {
            echo json_encode(['success' => false, 'message' => 'Missing reservation_id or status']);
            return;
        }

        // 'Confirmed' is stored in the database but always displayed as
        // "Approved" in every module's UI. 'Completed' is a new terminal
        // status, reachable only from 'Confirmed', set manually by the
        // Beach Owner's "Mark as Completed" action - never inferred
        // automatically from the reservation date/ETA having passed.
        $allowedStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Expired'];
        if (!in_array($data['status'], $allowedStatuses, true)) {
            echo json_encode(['success' => false, 'message' => 'Invalid status value']);
            return;
        }

        $reservationId = intval($data['reservation_id']);
        $newStatus = $data['status'];
        // Who triggered this call - defaults to 'owner' so the Beach
        // Operator's existing Approve/Reject actions in Reservation
        // Management (which never send this field) behave exactly as
        // before. Only an explicit 'tourist' value (sent by the
        // Reservation Form's Cancel Reservation button) applies the
        // tourist-cancellation rules below.
        $initiatedBy = isset($data['initiated_by']) && $data['initiated_by'] === 'tourist' ? 'tourist' : 'owner';

        // Look up the current status + visitor count first, so we know
        // whether this change is actually entering/leaving "Confirmed"
        // (and therefore whether the beach's live capacity needs to move).
        // Also pull the tourist/beach details needed for the "Reservation
        // Approved" email below, so we don't need a second round-trip.
        $stmt = $db->prepare("
            SELECT r.beach_id, r.num_visitors, r.status, r.full_name, r.email,
                   r.reservation_date, r.eta_time, b.beach_name
            FROM reservations r
            JOIN beaches b ON r.beach_id = b.beach_id
            WHERE r.reservation_id = ?
        ");
        $stmt->execute([$reservationId]);
        $reservation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reservation) {
            echo json_encode(['success' => false, 'message' => 'Reservation not found']);
            return;
        }

        $oldStatus = $reservation['status'];

        // ----- Tourist self-cancellation: verify against the database -----
        // (never against whatever the tourist's page happened to be
        // showing) before touching anything. This is what keeps a stale
        // page, a second open tab, or a Beach Operator approval that
        // landed a moment earlier from ever cancelling something it
        // shouldn't, or double-processing an already-settled reservation.
        if ($initiatedBy === 'tourist' && $newStatus === 'Cancelled') {
            if ($oldStatus === 'Cancelled') {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => 'This reservation has already been cancelled.']);
                return;
            }
            if ($oldStatus === 'Expired') {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => 'This reservation has already expired and can no longer be cancelled.']);
                return;
            }
            if ($oldStatus === 'Completed') {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => 'This reservation has already been completed and can no longer be cancelled.']);
                return;
            }
            // Cancellation window: allowed any time up to and including the
            // reservation date itself - not once that date has passed.
            // (Approval status doesn't affect this - an already-Approved/
            // Confirmed reservation can still be cancelled up to its date.)
            $resDateTs = strtotime($reservation['reservation_date']);
            $todayTs = strtotime(date('Y-m-d'));
            if ($resDateTs !== false && $resDateTs < $todayTs) {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => 'This reservation is past its date and is no longer eligible for cancellation.']);
                return;
            }
        }

        // ----- Owner-initiated changes: guard against stale/duplicate ------
        // clicks re-processing a reservation that has already reached a
        // terminal state (Completed/Cancelled/Expired), and make sure
        // "Mark as Completed" can only ever be applied to a currently
        // Approved (Confirmed) reservation - never invented from a Pending,
        // Cancelled or already-Expired one, and never triggered by a date/
        // ETA check. This is the single source of truth every module reads
        // from, so once a status is settled here it stays settled.
        if ($initiatedBy === 'owner') {
            $terminalStatuses = ['Completed', 'Cancelled', 'Expired'];
            if (in_array($oldStatus, $terminalStatuses, true) && $newStatus !== $oldStatus) {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => "This reservation is already {$oldStatus} and can no longer be changed."]);
                return;
            }
            if ($newStatus === 'Completed' && $oldStatus !== 'Confirmed') {
                echo json_encode(['success' => false, 'not_eligible' => true, 'current_status' => $oldStatus,
                    'message' => 'Only an approved reservation can be marked as completed.']);
                return;
            }
        }

        $db->beginTransaction();

        // The Beach Owner can optionally type a reason when rejecting a
        // reservation (status -> Cancelled). Only touch rejection_reason
        // when actually rejecting, so approving/other transitions never
        // wipe out a previously recorded reason by accident.
        if ($newStatus === 'Cancelled') {
            $reason = isset($data['reason']) ? trim($data['reason']) : '';
            $updateStmt = $db->prepare("UPDATE reservations SET status = ?, rejection_reason = ? WHERE reservation_id = ?");
            $updateStmt->execute([$newStatus, $reason !== '' ? $reason : null, $reservationId]);
        } else {
            $updateStmt = $db->prepare("UPDATE reservations SET status = ? WHERE reservation_id = ?");
            $updateStmt->execute([$newStatus, $reservationId]);
        }

        // A Beach Owner approving a reservation (-> Confirmed) reserves
        // those visitor slots against the beach's capacity. Moving a
        // previously-Confirmed reservation away from Confirmed (e.g.
        // rejecting/cancelling it afterwards) releases those slots again.
        if ($oldStatus !== 'Confirmed' && $newStatus === 'Confirmed') {
            $capStmt = $db->prepare("UPDATE beaches SET current_capacity = current_capacity + ? WHERE beach_id = ?");
            $capStmt->execute([$reservation['num_visitors'], $reservation['beach_id']]);
        } elseif ($oldStatus === 'Confirmed' && $newStatus !== 'Confirmed') {
            $capStmt = $db->prepare("UPDATE beaches SET current_capacity = GREATEST(current_capacity - ?, 0) WHERE beach_id = ?");
            $capStmt->execute([$reservation['num_visitors'], $reservation['beach_id']]);
        }

        $db->commit();

        // Notify the tourist by email the moment a Beach Owner approves
        // their reservation (Pending/other -> Confirmed). Never blocks or
        // undoes the status change above if the email fails to send.
        $emailResult = null;
        if ($oldStatus !== 'Confirmed' && $newStatus === 'Confirmed') {
            try {
                $emailResult = sendReservationApprovedEmail(
                    $reservation['email'],
                    $reservation['full_name'],
                    $reservation['beach_name'],
                    $reservation['reservation_date'],
                    $reservation['eta_time'],
                    $reservationId
                );
            } catch (Exception $mailErr) {
                error_log('reservations.php: approval email threw an unexpected exception: ' . $mailErr->getMessage());
            }
        }

        // Notify the tourist by email when a Beach Owner rejects their
        // reservation (-> Cancelled), including the optional reason they
        // typed in. Not sent when the tourist cancelled it themselves -
        // that email is worded as a rejection by the Beach Owner, which
        // would be confusing to send back to the person who cancelled it.
        if ($initiatedBy === 'owner' && $oldStatus !== 'Cancelled' && $newStatus === 'Cancelled') {
            try {
                $emailResult = sendReservationRejectedEmail(
                    $reservation['email'],
                    $reservation['full_name'],
                    $reservation['beach_name'],
                    isset($data['reason']) ? trim($data['reason']) : '',
                    $reservationId
                );
            } catch (Exception $mailErr) {
                error_log('reservations.php: rejection email threw an unexpected exception: ' . $mailErr->getMessage());
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Reservation status updated',
            'email_sent' => $emailResult ? $emailResult['sent'] : null,
            'email_method' => $emailResult ? $emailResult['method'] : null,
            'email_error' => $emailResult ? $emailResult['error'] : null
        ]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// ========================================
// ===== RESERVATION CONFIRMATION EMAIL =====
// ========================================
// Sent automatically whenever a Tourist submits the reservation form
// (createReservation() above), using the same PHPMailer/SMTP setup
// (includes/mailer.php + includes/mail-config.php) already used for
// Beach Owner account credentials in api/add-beach-owner.php.

/**
 * Formats a reservation_id into a human-friendly reference number, e.g.
 * reservation_id 1 in 2026 -> "RES-2026-0001". Used since the
 * reservations table has no dedicated reference-number column.
 */
function formatReservationReference($reservationId) {
    return 'RES-' . date('Y') . '-' . str_pad($reservationId, 4, '0', STR_PAD_LEFT);
}

function sendReservationConfirmationEmail($toEmail, $touristName, $beachName, $reservationDate, $etaTime, $numVisitors, $reservationId, $paymentReference = '') {
    $referenceNumber = formatReservationReference($reservationId);
    $subject = 'Reservation Submitted Successfully – Tukuran Tourism Information Management System';

    // Friendly date/time formatting for the email (falls back to the raw
    // value if it can't be parsed, so the email is still sent).
    $displayDate = $reservationDate;
    $dateTs = strtotime($reservationDate);
    if ($dateTs !== false) {
        $displayDate = date('F j, Y', $dateTs);
    }

    $displayEta = 'Not specified';
    $displayExpiration = 'N/A';
    if (!empty($etaTime)) {
        $etaTs = strtotime($etaTime);
        if ($etaTs !== false) {
            $displayEta = date('g:i A', $etaTs);
            // Reservation Expiration Time = ETA + 30 minutes.
            $displayExpiration = date('g:i A', strtotime('+30 minutes', $etaTs));
        } else {
            $displayEta = $etaTime;
        }
    }

    $plainTextBody = "Dear {$touristName},\r\n\r\n"
        . "Thank you for choosing one of the participating beaches in Tukuran.\r\n"
        . "Your reservation has been successfully submitted and is currently waiting for approval from the Beach Owner.\r\n\r\n"
        . "Reservation Details\r\n"
        . "Reservation Reference No.: {$referenceNumber}\r\n"
        . "Beach Name: {$beachName}\r\n"
        . "Reservation Date: {$displayDate}\r\n"
        . "Estimated Time of Arrival (ETA): {$displayEta}\r\n"
        . "Reservation Expiration Time: {$displayExpiration}\r\n"
        . "Number of Visitors: {$numVisitors}\r\n"
        . "Payment Reference Number: " . ($paymentReference !== '' ? $paymentReference : 'N/A') . "\r\n"
        . "Payment Status: Payment Submitted\r\n"
        . "Reservation Status: Pending Approval\r\n\r\n"
        . "IMPORTANT: Please arrive at the beach before your Reservation Expiration Time above. "
        . "If you do not arrive by then, this reservation will automatically expire and will no longer be honored.\r\n\r\n"
        . "Tukuran Tourism Office\r\n";

    $htmlBody = '
        <p>Dear ' . htmlspecialchars($touristName) . ',</p>

        <p>Thank you for choosing one of the participating beaches in Tukuran.</p>

        <p>Your reservation has been successfully submitted and is currently waiting for approval from the Beach Owner.</p>

        <h3 style="margin:20px 0 8px 0;">Reservation Details</h3>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
            <tr><td><strong>Reservation Reference No.:</strong></td><td>' . htmlspecialchars($referenceNumber) . '</td></tr>
            <tr><td><strong>Beach Name:</strong></td><td>' . htmlspecialchars($beachName) . '</td></tr>
            <tr><td><strong>Reservation Date:</strong></td><td>' . htmlspecialchars($displayDate) . '</td></tr>
            <tr><td><strong>Estimated Time of Arrival (ETA):</strong></td><td>' . htmlspecialchars($displayEta) . '</td></tr>
            <tr><td><strong>Reservation Expiration Time:</strong></td><td>' . htmlspecialchars($displayExpiration) . '</td></tr>
            <tr><td><strong>Number of Visitors:</strong></td><td>' . htmlspecialchars((string)$numVisitors) . '</td></tr>
            <tr><td><strong>Payment Reference Number:</strong></td><td>' . htmlspecialchars($paymentReference !== '' ? $paymentReference : 'N/A') . '</td></tr>
            <tr><td><strong>Payment Status:</strong></td><td>🟢 Payment Submitted</td></tr>
            <tr><td><strong>Reservation Status:</strong></td><td>🟡 Pending Approval</td></tr>
        </table>

        <p style="color:#e74c5e; font-weight:600;">
        Important: Please arrive before your Reservation Expiration Time above.
        If you do not arrive by then, this reservation will automatically expire and will no longer be honored.
        </p>

        <p><strong>Tukuran Tourism Office</strong></p>
    ';

    return sendAppEmail($toEmail, $touristName, $subject, $htmlBody, $plainTextBody);
}

// ========================================
// ===== RESERVATION APPROVAL EMAIL =====
// ========================================
// Sent automatically whenever a Beach Owner approves a reservation
// (updateReservationStatus() above, Pending -> Confirmed).

/**
 * Builds and sends the "Reservation Approved" email to the tourist.
 * Never throws internally - always returns a sendAppEmail()-style result
 * array so callers can log/report the outcome without risking the status
 * update itself.
 */
function sendReservationApprovedEmail($toEmail, $touristName, $beachName, $reservationDate, $etaTime, $reservationId) {
    $subject = 'Reservation Approved';

    $displayDate = $reservationDate;
    $dateTs = strtotime($reservationDate);
    if ($dateTs !== false) {
        $displayDate = date('F j, Y', $dateTs);
    }

    $displayEta = 'Not specified';
    $displayExpiration = 'N/A';
    if (!empty($etaTime)) {
        $etaTs = strtotime($etaTime);
        if ($etaTs !== false) {
            $displayEta = date('g:i A', $etaTs);
            // Reservation Expiration Time = ETA + 30 minutes.
            $displayExpiration = date('g:i A', strtotime('+30 minutes', $etaTs));
        } else {
            $displayEta = $etaTime;
        }
    }

    $plainTextBody = "Dear {$touristName},\r\n\r\n"
        . "Good news!\r\n"
        . "Your reservation has been approved by the Beach Owner.\r\n\r\n"
        . "Beach: {$beachName}\r\n"
        . "Reservation Date: {$displayDate}\r\n"
        . "ETA: {$displayEta}\r\n"
        . "Expiration Time: {$displayExpiration}\r\n"
        . "Status: Approved\r\n\r\n"
        . "Please arrive before your reservation expiration time.\r\n\r\n"
        . "We hope you enjoy your visit!\r\n\r\n"
        . "Tukuran Tourism Office\r\n";

    $htmlBody = '
        <p>Dear ' . htmlspecialchars($touristName) . ',</p>

        <p>Good news!<br>Your reservation has been approved by the Beach Owner.</p>

        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
            <tr><td><strong>Beach:</strong></td><td>' . htmlspecialchars($beachName) . '</td></tr>
            <tr><td><strong>Reservation Date:</strong></td><td>' . htmlspecialchars($displayDate) . '</td></tr>
            <tr><td><strong>ETA:</strong></td><td>' . htmlspecialchars($displayEta) . '</td></tr>
            <tr><td><strong>Expiration Time:</strong></td><td>' . htmlspecialchars($displayExpiration) . '</td></tr>
            <tr><td><strong>Status:</strong></td><td>🟢 Approved</td></tr>
        </table>

        <p style="color:#e74c5e; font-weight:600;">
        Please arrive before your reservation expiration time.
        </p>

        <p>We hope you enjoy your visit!</p>

        <p><strong>Tukuran Tourism Office</strong></p>
    ';

    return sendAppEmail($toEmail, $touristName, $subject, $htmlBody, $plainTextBody);
}

// ========================================
// ===== RESERVATION REJECTED EMAIL =====
// ========================================
// Sent automatically whenever a Beach Owner rejects a reservation
// (updateReservationStatus() above, Pending/other -> Cancelled).

/**
 * Builds and sends the "Reservation Update" (rejected) email to the tourist.
 * $reason is optional - if the Beach Owner didn't type one in, the email
 * says so instead of leaving a blank line.
 */
function sendReservationRejectedEmail($toEmail, $touristName, $beachName, $reason, $reservationId) {
    $subject = 'Reservation Update';
    $displayReason = ($reason !== null && trim($reason) !== '') ? trim($reason) : 'Not specified by the Beach Owner.';

    $plainTextBody = "Dear Tourist,\r\n\r\n"
        . "We regret to inform you that your reservation has been rejected by the Beach Owner.\r\n\r\n"
        . "Beach:\r\n{$beachName}\r\n\r\n"
        . "Reason:\r\n{$displayReason}\r\n\r\n"
        . "You may submit another reservation or choose a different participating beach.\r\n\r\n"
        . "Thank you.\r\n"
        . "Tukuran Tourism Office\r\n";

    $htmlBody = '
        <p>Dear Tourist,</p>

        <p>We regret to inform you that your reservation has been rejected by the Beach Owner.</p>

        <p><strong>Beach:</strong><br>' . htmlspecialchars($beachName) . '</p>

        <p><strong>Reason:</strong><br>' . nl2br(htmlspecialchars($displayReason)) . '</p>

        <p>You may submit another reservation or choose a different participating beach.</p>

        <p>Thank you.<br>
        <strong>Tukuran Tourism Office</strong></p>
    ';

    return sendAppEmail($toEmail, $touristName, $subject, $htmlBody, $plainTextBody);
}
?>
