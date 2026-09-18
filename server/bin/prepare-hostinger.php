<?php
declare(strict_types=1);

// One-time CLI preparation only. Never place this file in public_html.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
umask(0077);

try {
    if (PHP_VERSION_ID < 80200) throw new RuntimeException('PHP 8.2+ required');
    if (count($argv) !== 5) throw new RuntimeException('Expected domain directory, HTTPS origin, database name and database user');
    [, $requested, $origin, $dbName, $dbUser] = $argv;
    $root = realpath($requested);
    $host = parse_url($origin, PHP_URL_HOST);
    if (!$root || is_link($requested) || !$host || $origin !== 'https://' . $host
        || basename($root) !== $host || !preg_match('/^[a-z0-9.-]+$/D', $host)
        || !is_dir($root . '/public_html') || is_link($root . '/public_html')
        || !preg_match('/^[a-zA-Z0-9_]{1,64}$/D', $dbName) || !preg_match('/^[a-zA-Z0-9_]{1,64}$/D', $dbUser))
        throw new RuntimeException('Invalid installation target');
    $private = $root . '/agentpy-private';
    // Refuse any pre-existing directory, including partial or foreign installations.
    if (file_exists($private) || is_link($private)) throw new RuntimeException('Private directory already exists; nothing overwritten');
    if (!mkdir($private, 0700)) throw new RuntimeException('Cannot create private directory');
    foreach (['sessions', 'releases', 'tools', 'backups'] as $directory) {
        if (!mkdir($private . '/' . $directory, 0700)) throw new RuntimeException('Cannot create private subdirectory');
    }
    $write = static function (string $path, string $data): void {
        $handle = fopen($path, 'xb');
        if (!$handle) throw new RuntimeException('Cannot exclusively create file');
        try { if (fwrite($handle, $data) !== strlen($data)) throw new RuntimeException('Incomplete file write'); }
        finally { fclose($handle); }
        if (!chmod($path, 0600)) throw new RuntimeException('Cannot restrict permissions');
    };
    $write($private . '/database-password.txt', "REPLACE_WITH_DATABASE_PASSWORD\n");
    $values = var_export([
        'environment' => 'production', 'origin' => $origin,
        'dsn' => 'mysql:host=localhost;dbname=' . $dbName . ';charset=utf8mb4',
        'db_user' => $dbUser,
    ], true);
    $config = <<<'PHP'
<?php
declare(strict_types=1);
// Private server configuration; never publish or commit this directory.
$passwordFile = __DIR__ . '/database-password.txt';
if (is_link($passwordFile) || !is_file($passwordFile) || filesize($passwordFile) > 4096) {
    throw new RuntimeException('Database password not configured');
}
$password = rtrim((string) file_get_contents($passwordFile), "\r\n");
if ($password === '' || $password === 'REPLACE_WITH_DATABASE_PASSWORD' || str_contains($password, "\0")) {
    throw new RuntimeException('Database password not configured');
}
$values = __VALUES__;
$values['db_password'] = $password;
$values['session_path'] = __DIR__ . '/sessions';
return $values;
PHP;
    $write($private . '/config.php', str_replace('__VALUES__', $values, $config) . "\n");
    $write($private . '/.htaccess', "Require all denied\n");
    $write($private . '/installation.json', json_encode(['format' => 1, 'origin' => $origin, 'createdAt' => gmdate('c')], JSON_THROW_ON_ERROR) . "\n");
    echo "Private configuration prepared. Public website and database unchanged.\n";
    echo "Enter the database password directly in: $private/database-password.txt\n";
} catch (Throwable $error) {
    // Never print exceptions/arguments that might contain sensitive input.
    fwrite(STDERR, "Preparation refused or incomplete. Check arguments, PHP version and target directory; no existing files were overwritten.\n");
    exit(1);
}
