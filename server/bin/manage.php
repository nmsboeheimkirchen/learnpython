<?php
declare(strict_types=1);

namespace AgentPy;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/src/bootstrap.php';
require dirname(__DIR__) . '/src/account-management.php';

try {
    $db = database(config());
    $action = $argv[1] ?? '';
    if ($action === 'migrate') {
        migrateAccounts($db);
        echo "Schema ready.\n";
    } elseif (in_array($action, ['create-user', 'create-class'], true)) {
        // Provision accounts using stdin, never password command-line arguments.
        $input = json_decode(stream_get_contents(STDIN, 2048), true, 10, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new \RuntimeException('Expected JSON on stdin');
        echo json_encode($action === 'create-user' ? createAccount($db, $input) : createClass($db, $input), JSON_THROW_ON_ERROR) . "\n";
    } else {
        throw new \RuntimeException('Usage: php server/bin/manage.php migrate|create-class|create-user');
    }
} catch (\Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Management command failed (' . get_class($error) . ").\n");
    exit(1);
}
