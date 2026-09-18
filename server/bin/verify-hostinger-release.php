<?php
declare(strict_types=1);

namespace AgentPy\Deployment;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
use RuntimeException;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;
use FilesystemIterator;
use Throwable;

function verifyRelease(string $requested): array
{
    if (is_link($requested)) throw new RuntimeException('Invalid target');
    $root = realpath($requested);
    if (!$root || is_link($root . '/manifest.json')) throw new RuntimeException('Invalid manifest');
    $manifest = json_decode(file_get_contents($root . '/manifest.json'), true, 20, JSON_THROW_ON_ERROR);
    if (($manifest['format'] ?? null) !== 1 || !preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/D', $manifest['releaseId'] ?? '')
        || !is_array($manifest['files'] ?? null) || !$manifest['files']) throw new RuntimeException('Invalid manifest');
    $seen = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if ($file->isLink()) throw new RuntimeException('Symlinks not allowed');
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
        if ($relative === 'manifest.json') continue;
        if (!$file->isFile() || !isset($manifest['files'][$relative])) throw new RuntimeException('Unexpected file');
        $seen[$relative] = true;
    }
    foreach ($manifest['files'] as $relative => $metadata) {
        if (!preg_match('~^(public|app)/[a-zA-Z0-9_./-]+$~D', $relative) || str_contains($relative, '..')
            || !isset($seen[$relative]) || !is_array($metadata)
            || !is_int($metadata['bytes'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $metadata['sha256'] ?? ''))
            throw new RuntimeException('Invalid file record');
        $file = $root . '/' . $relative;
        if (filesize($file) !== $metadata['bytes'] || !hash_equals($metadata['sha256'], hash_file('sha256', $file)))
            throw new RuntimeException('File mismatch');
    }
    foreach (['public/index.html', 'public/api/index.php', 'app/src/bootstrap.php', 'app/public/api/index.php', 'app/schema.sql'] as $required)
        if (!isset($seen[$required])) throw new RuntimeException('Incomplete release');
    return $manifest;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        if (count($argv) !== 2) throw new RuntimeException('Invalid arguments');
        $manifest = verifyRelease($argv[1]);
        echo json_encode(['verified' => true, 'releaseId' => $manifest['releaseId'], 'files' => count($manifest['files'])], JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) {
        fwrite(STDERR, "Release verification failed. Nothing activated.\n");
        exit(1);
    }
}
