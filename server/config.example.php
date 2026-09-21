<?php
declare(strict_types=1);

// Copy OUTSIDE the public web directory and set AGENTPY_CONFIG to that path.
// Never commit the actual credentials. Environment variables may be used instead.
// MAIL-TRANSPORT-LIMIT: keep transport quotas in one server-side configuration; derive the
// registration notice from its public limits, never from a second hardcoded 10.
// On hosting/SMTP changes, review quotas, queue pacing/retries, UI and tests together.
// Hostinger built-in PHP/Sendmail: 10/minute and 100/rolling 24h (checked 2026-09-19).
// A server upgrade alone does not remove these quotas; SMTP has provider-specific limits.
// Retain durable pending jobs and abuse protection when changing/removing a transport cap.
// Source: https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/
// Implementation and regression checklist: LOGIN-NEXT-STEPS.md, MAIL-TRANSPORT-LIMIT.
return [
    'environment' => 'production',
    'origin' => 'https://agentpy.bildungdigital.at',
    'dsn' => 'mysql:host=127.0.0.1;dbname=YOUR_DATABASE;charset=utf8mb4',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_password' => 'SET_OUTSIDE_GIT',
    'session_path' => '', // Use the host's private PHP session directory, or an absolute private path.
    // Enable only after configuring the sender, CLI worker and testing actual receipt.
    // These keys can also live in private registration-config.php next to the real config.
    'registration_enabled' => false,
    'password_reset_enabled' => false,
    // Authenticated SMTP: mailbox password in a private file beside config.php.
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_encryption' => 'ssl',
    'smtp_user' => 'noreply@agentpy.bildungdigital.at',
    'smtp_password_file' => __DIR__ . '/smtp-password.txt',
    'mail_transport' => 'disabled', // disabled|sendmail|smtp; enable after real receipt/authentication check.
    'mail_from' => '',
    'mail_per_minute' => 10,
    'mail_per_day' => 100,
];
