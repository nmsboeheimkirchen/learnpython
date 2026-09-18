<?php
declare(strict_types=1);

// Copy OUTSIDE the public web directory and set AGENTPY_CONFIG to that path.
// Never commit the actual credentials. Environment variables may be used instead.
return [
    'environment' => 'production',
    'origin' => 'https://agentpy.bildungdigital.at',
    'dsn' => 'mysql:host=127.0.0.1;dbname=YOUR_DATABASE;charset=utf8mb4',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_password' => 'SET_OUTSIDE_GIT',
    'session_path' => '', // Use the host's private PHP session directory, or an absolute private path.
];
