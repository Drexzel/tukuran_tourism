<?php
// ========================================
// ===== MAIL / SMTP CONFIGURATION =====
// ========================================
// Used by includes/mailer.php to send real emails via PHPMailer + SMTP.
//
// HOW TO ENABLE:
// 1. Install PHPMailer (pick ONE):
//      A. Composer (recommended) - from the BEACH/ folder, run:
//           composer require phpmailer/phpmailer
//         This creates vendor/autoload.php, which mailer.php looks for
//         automatically.
//      B. Manual (no Composer) - download PHPMailer from
//           https://github.com/PHPMailer/PHPMailer
//         and copy these 3 files from its src/ folder into
//         includes/PHPMailer/src/ (same file names):
//           Exception.php, PHPMailer.php, SMTP.php
// 2. Fill in smtp_host / smtp_username / smtp_password below with a real
//    SMTP account (e.g. Gmail + an "App Password", or your web host's
//    SMTP details - check their control panel/documentation).
// 3. Set 'smtp_enabled' => true.
//
// Until you do this, sendAppEmail() in includes/mailer.php automatically
// falls back to PHP's built-in mail() function, so account creation etc.
// keep working either way - they just won't deliver real email until SMTP
// is configured (mail() almost never works on local XAMPP/WAMP without
// extra setup, since there's no local mail server).

return [
    // Flip to true once PHPMailer is installed AND the SMTP fields below
    // are filled in with real credentials.
    'smtp_enabled'  => true,

    // Example for Gmail: 'smtp.gmail.com', port 587, secure 'tls',
    // username = full Gmail address, password = a 16-character
    // "App Password" (NOT your normal Gmail password - Google requires
    // 2-Step Verification to be on before it will let you create one, at
    // https://myaccount.google.com/apppasswords).
    'smtp_host'     => 'smtp.gmail.com',
    'smtp_port'     => 587,
    'smtp_username' => 'drexzelescoreal@gmail.com',
    'smtp_password' => 'rvxvzvvuqeccntyr',
    'smtp_secure'   => 'tls', // 'tls' (port 587) or 'ssl' (port 465)

    // What recipients see as the sender. Gmail requires this to match (or
    // be closely tied to) the authenticated smtp_username above, or it
    // will silently rewrite the From address itself.
    'from_email'    => 'drexzelescoreal@gmail.com',
    'from_name'     => 'Tukuran Tourism Office',
];
