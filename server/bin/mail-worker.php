<?php
declare(strict_types=1);

// Install this CLI-only dispatcher at agentpy-private/tools/mail-worker.php.
// The cron command stays stable: it follows the currently active public release.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
umask(0077);
try {
    $private = dirname(__DIR__);
    $root = dirname($private);
    if (basename($private) !== 'agentpy-private' || is_link($private) || is_link($root . '/public_html'))
        throw new RuntimeException('Invalid installation');
    $metadata = json_decode(file_get_contents($private . '/installation.json'), true, 10, JSON_THROW_ON_ERROR);
    if (($metadata['format'] ?? null) !== 1 || ($metadata['origin'] ?? '') !== 'https://' . basename($root))
        throw new RuntimeException('Invalid installation');
    $release = json_decode(file_get_contents($root . '/public_html/release.json'), true, 10, JSON_THROW_ON_ERROR)['releaseId'] ?? '';
    if (!is_string($release) || !preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/D', $release))
        throw new RuntimeException('Invalid release');
    $app = $private . '/releases/' . $release . '/app';
    foreach (['/releases', '/releases/' . $release, '/releases/' . $release . '/app'] as $part)
        if (is_link($private . $part) || !is_dir($private . $part)) throw new RuntimeException('Invalid release path');
    $lockPath = $private . '/mail-worker.lock';
    if (is_link($lockPath)) throw new RuntimeException('Invalid lock');
    $lock = fopen($lockPath, 'c');
    if (!$lock) throw new RuntimeException('Cannot lock worker');
    if (!flock($lock, LOCK_EX | LOCK_NB)) { echo "Worker already running.\n"; exit; }
    $processed = 0;
    // Rollback to the pre-registration release must not keep sending old jobs.
    if (is_file($app . '/src/registration.php')) {
        putenv('AGENTPY_CONFIG=' . $private . '/config.php');
        require $app . '/src/bootstrap.php';
        $config = AgentPy\config();
        if ($config['registration_enabled']) {
            $db = AgentPy\database($config);
            for ($i = 0; $i < $config['mail_per_minute']; $i++) {
                if (!AgentPy\dispatchMail($db, $config)) break;
                $processed++;
            }
        }
    }
    // Private, non-personal heartbeat proves that hPanel actually runs the job.
    $status = ['releaseId' => $release, 'ranAt' => time(), 'processed' => $processed];
    $statusPath = $private . '/mail-worker-status.json';
    if (is_link($statusPath)) throw new RuntimeException('Invalid status path');
    $temporary = $statusPath . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($temporary, json_encode($status, JSON_THROW_ON_ERROR), LOCK_EX) === false
        || !rename($temporary, $statusPath)) throw new RuntimeException('Cannot save worker status');
    echo json_encode($status, JSON_THROW_ON_ERROR) . "\n";
} catch (Throwable $error) {
    // Never expose mail recipients, tokens, DB credentials or exception arguments.
    fwrite(STDERR, "Mail worker failed. Check private configuration and deployment.\n");
    exit(1);
}
