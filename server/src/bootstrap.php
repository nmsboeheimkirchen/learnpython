<?php
declare(strict_types=1);

namespace AgentPy;

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/auth.php';

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode)
    {
        parent::__construct($errorCode);
    }
}

function config(): array
{
    $path = getenv('AGENTPY_CONFIG');
    $file = $path ? require $path : [];
    if (!is_array($file)) throw new \RuntimeException('Invalid configuration');
    $values = [];
    foreach (['environment', 'origin', 'dsn', 'db_user', 'db_password', 'session_path'] as $key) {
        $env = getenv('AGENTPY_' . strtoupper($key));
        $values[$key] = $env !== false ? $env : ($file[$key] ?? '');
    }
    $values['environment'] = $values['environment'] ?: 'production';
    $origin = parse_url($values['origin']);
    $local = $values['environment'] === 'development'
        && in_array($origin['host'] ?? '', ['127.0.0.1', 'localhost'], true);
    $validScheme = ($origin['scheme'] ?? '') === 'https' || ($local && ($origin['scheme'] ?? '') === 'http');
    if (!$origin || isset($origin['user']) || isset($origin['pass'])
        || isset($origin['query']) || isset($origin['fragment']) || isset($origin['path'])
        || !($origin['host'] ?? '') || !$validScheme)
        throw new \RuntimeException('An explicit HTTPS origin is required');
    if (!$values['dsn']) throw new \RuntimeException('Database configuration is required');
    if (!$local && !str_starts_with($values['dsn'], 'mysql:'))
        throw new \RuntimeException('Production requires MySQL/MariaDB');
    $values['secure_cookie'] = !$local || $origin['scheme'] === 'https';
    return $values;
}

function database(array $config): \PDO
{
    $db = new \PDO($config['dsn'], $config['db_user'], $config['db_password'], [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        \PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    if ($db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $db->exec('PRAGMA foreign_keys = ON');
        $db->exec('PRAGMA busy_timeout = 5000');
    }
    return $db;
}

function jsonResponse(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    exit;
}

function readBody(): array
{
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json')
        throw new ApiError(415, 'JSON_REQUIRED');
    $raw = file_get_contents('php://input', false, null, 0, 70000);
    if ($raw === false || strlen($raw) > 65536) throw new ApiError(413, 'PAYLOAD_TOO_LARGE');
    try {
        $object = json_decode($raw, false, 20, JSON_THROW_ON_ERROR);
    } catch (\JsonException) {
        throw new ApiError(400, 'INVALID_JSON');
    }
    if (!$object instanceof \stdClass) throw new ApiError(400, 'INVALID_JSON');
    return (array) $object;
}

function exactFields(array $value, array $required): void
{
    if (array_diff(array_keys($value), $required) || array_diff($required, array_keys($value)))
        throw new ApiError(422, 'INVALID_FIELDS');
}
