Put PHPMailer's src/ files here (Exception.php, PHPMailer.php, SMTP.php)
if you're installing PHPMailer manually instead of via Composer.

Download from: https://github.com/PHPMailer/PHPMailer
(use the "Code -> Download ZIP" button, then copy the 3 files out of its
src/ folder into this folder, so you end up with:
  includes/PHPMailer/src/Exception.php
  includes/PHPMailer/src/PHPMailer.php
  includes/PHPMailer/src/SMTP.php

Then edit includes/mail-config.php: fill in your SMTP details and set
'smtp_enabled' => true.

If you'd rather use Composer instead, you don't need this folder at all -
just run `composer require phpmailer/phpmailer` from the BEACH/ folder,
and mailer.php will find it automatically via vendor/autoload.php.
