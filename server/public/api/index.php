<?php
declare(strict_types=1);

use function AgentPy\{beginSession, config, currentUser, database, exactFields, jsonResponse, login, readBody, readState, requireMutation, requireUser, rotateSession, writeState, registrationPolicy, checkInvitation, registerStudent, verifyRegistration};
use AgentPy\ApiError;

// In the release layout private application files live alongside public/, not inside it.
ini_set('display_errors', '0');
require dirname(__DIR__, 2) . '/src/bootstrap.php';
try {
    $config = config();
    if ($config['secure_cookie'] && ($_SERVER['HTTPS'] ?? '') !== 'on') throw new ApiError(400, 'HTTPS_REQUIRED');
    $db = database($config);
    beginSession($config);
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (array_diff(array_keys($_GET), ['action'])) throw new ApiError(400, 'INVALID_QUERY');
    if ($method === 'GET' && $action === 'session') {
        jsonResponse(['profile' => currentUser($db), 'csrfToken' => $_SESSION['csrf'], 'registration' => registrationPolicy($config)]);
    }
    if ($method === 'GET' && $action === 'state') {
        $user = requireUser($db);
        jsonResponse(['profile' => $user, 'state' => readState($db, $user['id'])]);
    }
    if ($method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    requireMutation($config);
    $body = readBody();
    if ($action === 'check-invitation') jsonResponse(checkInvitation($db, $config, $body));
    if ($action === 'register') jsonResponse(registerStudent($db, $config, $body), 202);
    if ($action === 'verify-email') jsonResponse(verifyRegistration($db, $config, $body));
    if ($action === 'cancel-registration') {
        exactFields($body, []);
        unset($_SESSION['registration_grant']); // Never reset code-failure/cooldown counters here.
        jsonResponse(['cancelled' => true]);
    }
    if ($action === 'login') {
        jsonResponse(['profile' => login($db, $body), 'csrfToken' => $_SESSION['csrf']]);
    }
    if ($action === 'logout') {
        requireUser($db);
        exactFields($body, []);
        rotateSession();
        jsonResponse(['profile' => null, 'csrfToken' => $_SESSION['csrf']]);
    }
    if ($action === 'write') {
        $user = requireUser($db);
        jsonResponse(['profile' => $user] + writeState($db, $user['id'], $body));
    }
    throw new ApiError(404, 'NOT_FOUND');
} catch (ApiError $error) {
    if ($error->status === 429) header('Retry-After: ' . ($error->details['retryAfter'] ?? 900));
    jsonResponse(['error' => ['code' => $error->errorCode] + $error->details], $error->status);
} catch (Throwable $error) {
    // Never expose exception text, SQL, paths, credentials or submitted code to clients/logs.
    error_log('AgentPy API request failed: ' . get_class($error));
    jsonResponse(['error' => ['code' => 'SERVER_UNAVAILABLE']], 503);
}
