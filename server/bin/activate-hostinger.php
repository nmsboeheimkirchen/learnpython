<?php
declare(strict_types=1);

namespace AgentPy\Deployment;

use RuntimeException;
use Throwable;
require_once __DIR__ . '/verify-hostinger-release.php';

// CLI only. Changes website files, never the database. Every previous webroot is retained.
function installation(string $requested): array
{
    $root = realpath($requested);
    if (!$root || is_link($requested)) throw new RuntimeException('INVALID_ROOT');
    $private = $root . DIRECTORY_SEPARATOR . 'agentpy-private';
    if (!is_dir($private) || is_link($private)) throw new RuntimeException('INVALID_PRIVATE_DIRECTORY');
    $file = $private . '/installation.json';
    if (is_link($file)) throw new RuntimeException('INVALID_INSTALLATION');
    $metadata = json_decode(file_get_contents($file), true, 10, JSON_THROW_ON_ERROR);
    if (($metadata['format'] ?? null) !== 1 || ($metadata['origin'] ?? '') !== 'https://' . basename($root))
        throw new RuntimeException('INVALID_INSTALLATION');
    foreach (['releases', 'backups'] as $name)
        if (!is_dir($private . '/' . $name) || is_link($private . '/' . $name)) throw new RuntimeException('INVALID_DIRECTORY');
    if (is_link($root . '/public_html')) throw new RuntimeException('LINKED_WEBROOT');
    return [$root, $private];
}

function jsonFile(string $path, array $data): void
{
    if (is_link($path)) throw new RuntimeException('LINKED_METADATA');
    $temp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $handle = fopen($temp, 'xb');
    if (!$handle) throw new RuntimeException('METADATA_WRITE_FAILED');
    $bytes = json_encode($data, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n";
    try {
        if (fwrite($handle, $bytes) !== strlen($bytes) || !fflush($handle)) throw new RuntimeException('METADATA_WRITE_FAILED');
    } finally { fclose($handle); }
    chmod($temp, 0600);
    if (!rename($temp, $path)) throw new RuntimeException('METADATA_RENAME_FAILED');
}

function publicMatches(string $webroot, array $manifest): bool
{
    if (!is_dir($webroot) || is_link($webroot)) return false;
    $expected = [];
    foreach ($manifest['files'] as $path => $record) {
        if (!str_starts_with($path, 'public/')) continue;
        $file = substr($path, 7); $expected[$file] = true;
        if (!is_file($webroot . '/' . $file) || is_link($webroot . '/' . $file)
            || !hash_equals($record['sha256'], hash_file('sha256', $webroot . '/' . $file))) return false;
    }
    $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($webroot, \FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($webroot) + 1));
        if ($file->isLink() || !$file->isFile() || !isset($expected[$relative])) return false;
    }
    return true;
}

function deploy(string $requested, string $releaseId, string $action, ?callable $move = null): array
{
    umask(0077);
    if (!preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/D', $releaseId)
        || !in_array($action, ['activate', 'confirm', 'rollback'], true)) throw new RuntimeException('INVALID_ARGUMENTS');
    [$root, $private] = installation($requested);
    $lockFile = $private . '/deployment.lock';
    if (is_link($lockFile)) throw new RuntimeException('LINKED_LOCK');
    $lock = fopen($lockFile, 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('DEPLOYMENT_BUSY');
    $move ??= static fn(string $from, string $to): bool => rename($from, $to);
    $public = $root . '/public_html';
    $pendingFile = $private . '/deployment-pending.json';
    $activeFile = $private . '/active-deployment.json';
    try {
        foreach ([$pendingFile, $activeFile] as $file) if (is_link($file)) throw new RuntimeException('LINKED_METADATA');
        if ($action === 'activate') {
            if (file_exists($pendingFile)) throw new RuntimeException('PENDING_DEPLOYMENT');
            if (!is_dir($public)) throw new RuntimeException('MISSING_WEBROOT');
            $release = $private . '/releases/' . $releaseId;
            $manifest = verifyRelease($release);
            if ($manifest['releaseId'] !== $releaseId) throw new RuntimeException('RELEASE_ID_MISMATCH');
            if (is_file($public . '/release.json') && (json_decode(file_get_contents($public . '/release.json'), true)['releaseId'] ?? '') === $releaseId)
                throw new RuntimeException('ALREADY_ACTIVE');
            $token = gmdate('YmdHis') . '-' . bin2hex(random_bytes(5));
            $stage = $private . '/public-ready-' . $token;
            $backupName = 'web-' . $token;
            $backup = $private . '/backups/' . $backupName;
            if (!mkdir($stage, 0755)) throw new RuntimeException('STAGING_FAILED');
            chmod($stage, 0755);
            foreach ($manifest['files'] as $path => $record) {
                if (!str_starts_with($path, 'public/')) continue;
                $target = $stage . '/' . substr($path, 7);
                $directory = dirname($target);
                if (!is_dir($directory)) {
                    // Create public subdirectories explicitly; no secret directories copied.
                    $parts = explode('/', substr(str_replace('\\', '/', $directory), strlen(str_replace('\\', '/', $stage)) + 1));
                    $walk = $stage;
                    foreach ($parts as $part) { $walk .= '/' . $part; if (!is_dir($walk)) { mkdir($walk, 0755); chmod($walk, 0755); } }
                }
                if (!copy($release . '/' . $path, $target) || !chmod($target, 0644)) throw new RuntimeException('STAGING_FAILED');
            }
            if (!publicMatches($stage, $manifest)) throw new RuntimeException('STAGING_MISMATCH');
            $pending = ['format' => 1, 'releaseId' => $releaseId, 'backup' => $backupName, 'startedAt' => gmdate('c')];
            jsonFile($pendingFile, $pending); // Durable recovery instructions before either rename.
            if (!$move($public, $backup)) throw new RuntimeException('BACKUP_RENAME_FAILED');
            try {
                if (!$move($stage, $public)) throw new RuntimeException('ACTIVATION_RENAME_FAILED');
            } catch (Throwable $error) {
                if (!file_exists($public) && !rename($backup, $public)) throw new RuntimeException('RESTORE_REQUIRED');
                throw $error;
            }
            return ['status' => 'pending-healthcheck', 'releaseId' => $releaseId, 'backup' => $backupName];
        }
        $recordFile = is_file($pendingFile) ? $pendingFile : $activeFile;
        if (!is_file($recordFile)) throw new RuntimeException('NO_DEPLOYMENT_RECORD');
        $record = json_decode(file_get_contents($recordFile), true, 10, JSON_THROW_ON_ERROR);
        if (($record['format'] ?? null) !== 1 || ($record['releaseId'] ?? '') !== $releaseId
            || !preg_match('/^web-[0-9]{14}-[a-f0-9]{10}$/D', $record['backup'] ?? '')) throw new RuntimeException('INVALID_DEPLOYMENT_RECORD');
        $backup = $private . '/backups/' . $record['backup'];
        if (is_link($backup)) throw new RuntimeException('LINKED_BACKUP');
        if ($action === 'confirm') {
            if ($recordFile !== $pendingFile || !is_dir($backup)
                || !publicMatches($public, verifyRelease($private . '/releases/' . $releaseId))) throw new RuntimeException('CONFIRMATION_FAILED');
            $record['confirmedAt'] = gmdate('c');
            jsonFile($activeFile, $record);
        } else {
            if (is_dir($backup)) {
                $rejected = $private . '/backups/rejected-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(5));
                if (is_dir($public) && !$move($public, $rejected)) throw new RuntimeException('ROLLBACK_STAGING_FAILED');
                try { if (!$move($backup, $public)) throw new RuntimeException('ROLLBACK_FAILED'); }
                catch (Throwable $error) {
                    if (!file_exists($public) && is_dir($rejected)) rename($rejected, $public);
                    throw $error;
                }
            } elseif ($recordFile !== $pendingFile || !is_dir($public)) {
                throw new RuntimeException('BACKUP_MISSING');
            }
            // Pending first rename may not have happened, or automatic restoration already ran.
            $previousId = is_file($public . '/release.json') ? (json_decode(file_get_contents($public . '/release.json'), true)['releaseId'] ?? null) : null;
            if ($previousId === $releaseId) throw new RuntimeException('RESTORE_NOT_PROVEN');
            jsonFile($activeFile, ['format' => 1, 'releaseId' => $previousId, 'rolledBack' => $releaseId, 'restoredAt' => gmdate('c')]);
        }
        if ($recordFile === $pendingFile && !rename($pendingFile, $private . '/backups/deployment-' . bin2hex(random_bytes(8)) . '.json'))
            throw new RuntimeException('JOURNAL_ARCHIVE_FAILED');
        return ['status' => $action === 'confirm' ? 'confirmed' : 'rolled-back', 'releaseId' => $releaseId];
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        if (count($argv) !== 4) throw new RuntimeException('INVALID_ARGUMENTS');
        echo json_encode(deploy($argv[1], $argv[2], $argv[3]), JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) {
        // Error codes are controlled here; do not expose PHP paths or configuration data.
        $code = preg_match('/^[A-Z_]+$/D', $error->getMessage()) ? $error->getMessage() : 'DEPLOYMENT_FAILED';
        fwrite(STDERR, $code . "\n"); exit(1);
    }
}
