<?php
// ========================================
// ===== EMAIL SENDER (PHPMailer integration) =====
// ========================================
// Central place for sending transactional emails (currently: Beach Owner
// account credentials from api/add-beach-owner.php). Prefers PHPMailer
// over SMTP when it's installed and configured (see mail-config.php);
// otherwise falls back to PHP's built-in mail(), and if that also fails,
// simply reports it failed. It never throws - a mail problem must never
// break the account-creation request that triggered it.

/**
 * Loads the PHPMailer classes if they're available, via whichever
 * install method was used. Returns true only if the PHPMailer class is
 * actually usable afterward.
 */
function loadPHPMailer() {
    static $checked = null;
    static $available = false;

    if ($checked !== null) {
        return $available;
    }
    $checked = true;

    // Option A: installed via Composer (composer require phpmailer/phpmailer)
    $composerAutoload = __DIR__ . '/../vendor/autoload.php';
    if (file_exists($composerAutoload)) {
        require_once $composerAutoload;
    }

    // Option B: PHPMailer's src/ files copied manually into
    // includes/PHPMailer/src/ (no Composer required).
    if (!class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        $manualBase = __DIR__ . '/PHPMailer/src/';
        if (file_exists($manualBase . 'Exception.php')
            && file_exists($manualBase . 'PHPMailer.php')
            && file_exists($manualBase . 'SMTP.php')) {
            require_once $manualBase . 'Exception.php';
            require_once $manualBase . 'PHPMailer.php';
            require_once $manualBase . 'SMTP.php';
        }
    }

    $available = class_exists('PHPMailer\\PHPMailer\\PHPMailer');
    return $available;
}

/**
 * Reads includes/mail-config.php, with safe defaults if it's missing.
 */
function getMailConfig() {
    $configPath = __DIR__ . '/mail-config.php';
    if (file_exists($configPath)) {
        $config = require $configPath;
        if (is_array($config)) {
            return $config;
        }
    }
    return [
        'smtp_enabled' => false,
        'from_email' => 'noreply@tukurantourism.local',
        'from_name' => 'Tukuran Tourism Office'
    ];
}

/**
 * Sends an email. Always returns an array describing what happened -
 * never throws - so callers can proceed (e.g. keep the account they just
 * created) regardless of whether the email actually went out.
 *
 * @param string $toEmail
 * @param string $toName
 * @param string $subject
 * @param string $htmlBody      HTML version of the message
 * @param string $plainTextBody Plain-text fallback version
 * @return array{sent: bool, method: string, error: ?string}
 */
function sendAppEmail($toEmail, $toName, $subject, $htmlBody, $plainTextBody) {
    $config = getMailConfig();

    if (!empty($config['smtp_enabled'])) {
        if (!loadPHPMailer()) {
            $error = 'PHPMailer library files were not found in includes/PHPMailer/src/ '
                . '(expected Exception.php, PHPMailer.php, and SMTP.php - see includes/PHPMailer/README.txt).';
            error_log('sendAppEmail: ' . $error);
            return ['sent' => false, 'method' => 'smtp', 'error' => $error];
        }

        try {
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = $config['smtp_host'];
            $mail->SMTPAuth = true;
            $mail->Username = $config['smtp_username'];
            $mail->Password = $config['smtp_password'];
            $mail->SMTPSecure = (($config['smtp_secure'] ?? 'tls') === 'ssl')
                ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
                : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $config['smtp_port'] ?? 587;

            // For localhost/XAMPP only
$mail->SMTPOptions = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];

            $fromEmail = $config['from_email'] ?? $config['smtp_username'];
            $fromName = $config['from_name'] ?? 'Tukuran Tourism Office';
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($toEmail, $toName);
            $mail->addReplyTo($fromEmail, $fromName);

            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            $mail->AltBody = $plainTextBody;

            $mail->send();
            return ['sent' => true, 'method' => 'smtp', 'error' => null];
        } catch (Exception $e) {
            // Surface the real PHPMailer/SMTP error (e.g. "SMTP Error:
            // Could not authenticate.") rather than masking it by quietly
            // falling back to mail() - that fallback almost never works
            // either, and would just replace a specific, actionable error
            // with a useless generic one.
            $detail = (isset($mail) && $mail->ErrorInfo) ? $mail->ErrorInfo : $e->getMessage();
            error_log('sendAppEmail (PHPMailer/SMTP) failed: ' . $detail);
            return ['sent' => false, 'method' => 'smtp', 'error' => $detail];
        }
    }

    // SMTP not enabled/configured at all - fall back to PHP's built-in
    // mail(). Works out of the box on most real hosting; almost never on
    // local XAMPP/WAMP without extra setup, since there's typically no
    // local mail transport agent configured.
    $fromEmail = $config['from_email'] ?? 'noreply@tukurantourism.local';
    $fromName = $config['from_name'] ?? 'Tukuran Tourism Office';

    $headers = "From: {$fromName} <{$fromEmail}>\r\n"
        . "Reply-To: {$fromEmail}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n";

    // @ suppresses the warning PHP throws when no mail transport is
    // configured; we surface that as sent=false to the caller instead.
    $sent = @mail($toEmail, $subject, $plainTextBody, $headers);

    return [
        'sent' => $sent,
        'method' => 'mail()',
        'error' => $sent ? null : 'SMTP is not enabled in includes/mail-config.php, and PHP\'s built-in mail() function is not configured on this machine (no local mail transport agent).'
    ];
}
?>
