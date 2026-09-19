<?php
declare(strict_types=1);

namespace AgentPy;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/src/bootstrap.php';
// Account and registration helpers are loaded by bootstrap.

try {
    $config = config();
    $db = database($config);
    $action = $argv[1] ?? '';
    if ($action === 'migrate') {
        migrateAccounts($db);
        echo "Schema ready.\n";
    } elseif ($action === 'mail-work') {
        $sent = 0;
        for ($i = 0; $i < $config['mail_per_minute']; $i++) {
            if (!dispatchMail($db, $config)) break;
            $sent++;
        }
        echo json_encode(['processed' => $sent]) . "\n";
    } elseif (in_array($action, ['create-user', 'create-class', 'create-invitation', 'revoke-invitation'], true)) {
        // Provision accounts using stdin, never password command-line arguments.
        $input = json_decode(stream_get_contents(STDIN, 2048), true, 10, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new \RuntimeException('Expected JSON on stdin');
        $result = match ($action) {
            'create-user' => createAccount($db, $input), 'create-class' => createClass($db, $input),
            'create-invitation' => createInvitation($db, $input),
            'revoke-invitation' => revokeInvitation($db, $input),
        };
        echo json_encode($result, JSON_THROW_ON_ERROR) . "\n";
    } else {
        throw new \RuntimeException('Usage: php server/bin/manage.php migrate|create-class|create-user|create-invitation|revoke-invitation|mail-work');
    }
} catch (\Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Management command failed (' . get_class($error) . ").\n");
    exit(1);
}
