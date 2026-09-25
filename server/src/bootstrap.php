<?php
declare(strict_types=1);

namespace AgentPy;

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/account-management.php';
require_once __DIR__ . '/registration.php';
require_once __DIR__ . '/recovery.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/smtp.php';
require_once __DIR__ . '/teachers.php';
require_once __DIR__ . '/roles.php';
require_once __DIR__ . '/management.php';
require_once __DIR__ . '/transfers.php';

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, public readonly array $details = [])
    {
        parent::__construct($errorCode);
    }
}

function config(): array
{
    $path = getenv('AGENTPY_CONFIG');
    $file = $path ? require $path : [];
    if (!is_array($file)) throw new \RuntimeException('Invalid configuration');
    // Optional private mail settings allow deployment without rewriting DB credentials.
    $mailPath = $path ? dirname($path) . '/registration-config.php' : '';
    if ($mailPath && is_file($mailPath)) {
        $mailSettings = require $mailPath;
        if (!is_array($mailSettings)) throw new \RuntimeException('Invalid mail configuration');
        $file = array_replace($file, array_intersect_key($mailSettings, array_flip(['registration_enabled', 'password_reset_enabled', 'mail_transport', 'mail_from', 'mail_per_minute', 'mail_per_day', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_user', 'smtp_password_file'])));
    }
    $values = [];
    foreach (['environment', 'origin', 'dsn', 'db_user', 'db_password', 'session_path', 'registration_enabled', 'password_reset_enabled', 'mail_transport', 'mail_from', 'mail_per_minute', 'mail_per_day', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_user', 'smtp_password_file'] as $key) {
        $env = getenv('AGENTPY_' . strtoupper($key));
        $values[$key] = $env !== false ? $env : ($file[$key] ?? '');
    }
    $values['environment'] = $values['environment'] ?: 'production';
    $values['teacher_key_file'] = getenv('AGENTPY_TEACHER_KEY_FILE') ?: ($path ? dirname($path).'/teacher-code-key.bin' : ($values['environment']==='development' && $values['session_path'] ? dirname($values['session_path']).'/teacher-code-key.bin' : ''));
    if ($values['environment']!=='development' && $path && realpath(dirname($values['teacher_key_file']))!==realpath(dirname($path)))
        throw new \RuntimeException('Teacher key must be private');
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
    $values['registration_enabled'] = filter_var($values['registration_enabled'], FILTER_VALIDATE_BOOLEAN);
    $values['password_reset_enabled'] = filter_var($values['password_reset_enabled'], FILTER_VALIDATE_BOOLEAN);
    $values['mail_transport'] = $values['mail_transport'] ?: 'disabled';
    foreach (['mail_per_minute' => 10, 'mail_per_day' => 100] as $key => $default) {
        $value = $values[$key] === '' ? $default : filter_var($values[$key], FILTER_VALIDATE_INT);
        if ($value === false || $value < 1 || $value > 100000) throw new \RuntimeException('Invalid mail limit');
        $values[$key] = $value;
    }
    if (!in_array($values['mail_transport'], $local ? ['disabled', 'sendmail', 'smtp', 'test'] : ['disabled', 'sendmail', 'smtp'], true))
        throw new \RuntimeException('Unsupported mail transport');
    if (($values['registration_enabled'] || $values['password_reset_enabled']) && ($values['mail_transport'] === 'disabled'
        || !filter_var($values['mail_from'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $values['mail_from'])))
        throw new \RuntimeException('Registration requires a configured sender');
    if ($values['mail_transport'] === 'sendmail' && ($values['mail_per_minute'] > 10 || $values['mail_per_day'] > 100))
        throw new \RuntimeException('Built-in sendmail quotas cannot be exceeded');
    if ($values['mail_transport']==='smtp') {
        $values['smtp_port']=filter_var($values['smtp_port'],FILTER_VALIDATE_INT);
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/D',$values['smtp_host'])
            || !in_array([$values['smtp_port'],$values['smtp_encryption']],[[465,'ssl'],[587,'tls']],true)
            || !filter_var($values['smtp_user'],FILTER_VALIDATE_EMAIL) || $values['smtp_user']!==$values['mail_from']
            || !$values['smtp_password_file']) throw new \RuntimeException('Invalid authenticated SMTP configuration');
        // On Hostinger, secrets must sit next to the private config, not in public_html.
        if (!$local && (!$path || realpath(dirname($values['smtp_password_file']))!==realpath(dirname($path))))
            throw new \RuntimeException('SMTP credential must be private');
    }
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
