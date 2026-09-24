<?php
declare(strict_types=1);

namespace AgentPy;

function migrateRegistration(\PDO $db): void
{
    $db->exec(file_get_contents(dirname(__DIR__) . '/registration-schema.sql'));
    $mysql = $db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
    $db->exec($mysql ? 'INSERT IGNORE INTO mail_dispatch_lock (id) VALUES (1)'
        : 'INSERT OR IGNORE INTO mail_dispatch_lock (id) VALUES (1)');
    if (!$db->query('SELECT version FROM schema_migrations WHERE version = 3')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)')->execute([time()]);
}

function requireRegistration(array $config): void
{
    if (!$config['registration_enabled']) throw new ApiError(503, 'REGISTRATION_UNAVAILABLE');
    if (isset($_SESSION['user_id'])) throw new ApiError(409, 'ALREADY_SIGNED_IN');
}

function registrationPolicy(array $config): array
{
    // MAIL-TRANSPORT-LIMIT: UI and worker consume this same server configuration.
    return ['enabled' => $config['registration_enabled'], 'perMinute' => $config['mail_per_minute'],
        'perDay' => $config['mail_per_day']];
}

function invitation(\PDO $db, string $hash, int $now): ?array
{
    $q = $db->prepare('SELECT i.class_id, c.name, r.capacity FROM class_invitations i JOIN classes c ON c.id=i.class_id JOIN class_registration r ON r.class_id=i.class_id WHERE i.code_hash=? AND i.active=1 AND i.expires_at>?');
    $q->execute([$hash, $now]);
    $result=$q->fetch() ?: null;
    if ($result && teacherSchema($db)) {
        $q=$db->prepare('SELECT display_name FROM teacher_classes WHERE class_id=?');$q->execute([$result['class_id']]);
        $name=$q->fetchColumn();if($name!==false)$result['name']=$name;
    }
    return $result;
}

function registrationThrottle(\PDO $db, string $action, int $limit): void
{
    try { throttle($db, 'registration:' . $action . ':ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $limit); }
    catch (ApiError $error) { throw new ApiError(429, 'REGISTRATION_RATE_LIMITED', ['retryAfter' => 900]); }
}

function checkInvitation(\PDO $db, array $config, array $body): array
{
    requireRegistration($config);
    exactFields($body, ['code']);
    $now = time();
    $remaining = ($_SESSION['code_blocked_until'] ?? 0) - $now;
    if ($remaining > 0) throw new ApiError(429, 'CLASS_CODE_COOLDOWN', ['retryAfter' => $remaining]);
    if (isset($_SESSION['code_blocked_until'])) unset($_SESSION['code_blocked_until'], $_SESSION['code_failures']);
    // This generous secondary IP limit accommodates a whole school NAT. Five failures
    // are counted per server session; resetting cookies does not bypass this IP brake.
    registrationThrottle($db, 'code', 320);
    try { throttle($db, 'registration:code-global', 2000); }
    catch (ApiError) { throw new ApiError(429, 'REGISTRATION_RATE_LIMITED', ['retryAfter' => 900]); }
    unset($_SESSION['registration_grant']);
    $code = is_string($body['code']) ? strtoupper(trim($body['code'])) : '';
    $hash = hash('sha256', $code);
    $info = preg_match('/^[A-Z]{5}$/D', $code) ? invitation($db, $hash, $now) : null;
    if (!$info) {
        $_SESSION['code_failures'] = ($_SESSION['code_failures'] ?? 0) + 1;
        if ($_SESSION['code_failures'] >= 5) {
            $_SESSION['code_blocked_until'] = $now + 300;
            throw new ApiError(429, 'CLASS_CODE_COOLDOWN', ['retryAfter' => 300]);
        }
        throw new ApiError(422, 'CLASS_CODE_INVALID', ['attemptsLeft' => 5 - $_SESSION['code_failures']]);
    }
    $_SESSION['code_failures'] = 0;
    $_SESSION['registration_grant'] = ['hash' => $hash, 'classId' => $info['class_id'], 'expires' => $now + 600];
    return ['className' => $info['name']];
}

function lockRegistrationClass(\PDO $db, string $id): void
{
    // First operation of the transaction: SQLite obtains its write lock too.
    $db->prepare('UPDATE class_registration SET capacity=capacity WHERE class_id=?')->execute([$id]);
}

function occupiedSeats(\PDO $db, string $id, int $now): int
{
    $q = $db->prepare('SELECT COUNT(*) FROM users u WHERE '.classMemberCondition($db) . (teacherSchema($db) ? ' AND NOT EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id=u.id)' : ''));
    $q->execute(classMemberParams($db,$id));
    $count = (int) $q->fetchColumn();
    $q = $db->prepare('SELECT COUNT(*) FROM pending_registrations WHERE class_id=? AND expires_at>?');
    $q->execute([$id, $now]);
    return $count + (int) $q->fetchColumn();
}

function classroomDomainMatches(\PDO $db, string $classId, string $email): bool
{
    if(!membershipSchema($db))return false;
    $q=$db->prepare('SELECT u.email FROM teacher_classes t JOIN users u ON u.id=t.teacher_id WHERE t.class_id=? AND u.active=1');
    $q->execute([$classId]);$teacherEmail=$q->fetchColumn();
    // Exact normalized domain match, never substring/suffix; still requires valid class grant.
    return is_string($teacherEmail) && strtolower(substr(strrchr($teacherEmail,'@'),1))===substr(strrchr($email,'@'),1);
}

function registerStudent(\PDO $db, array $config, array $body): array
{
    requireRegistration($config);
    exactFields($body, ['name', 'email', 'password']);
    registrationThrottle($db, 'submit', 160);
    $grant = $_SESSION['registration_grant'] ?? [];
    $now = time();
    if (($grant['expires'] ?? 0) <= $now) throw new ApiError(403, 'CLASS_CODE_REQUIRED');
    $email = normalizedEmail($body['email']);
    try { $name = accountLabel($body['name']); } catch (\RuntimeException) { throw new ApiError(422, 'INVALID_NAME'); }
    validateNewPassword($body['password']);
    $passwordHash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $immediate = false;
    $db->beginTransaction();
    try {
        lockRegistrationClass($db, $grant['classId']);
        $info = invitation($db, $grant['hash'], $now);
        if (!$info || $info['class_id'] !== $grant['classId']) throw new ApiError(403, 'CLASS_CODE_REQUIRED');
        $immediate = classroomDomainMatches($db,$info['class_id'],$email);
        $db->prepare('DELETE FROM pending_registrations WHERE expires_at<=?')->execute([$now]);
        $existing = $db->prepare('SELECT id FROM users WHERE email=? UNION ALL SELECT id FROM pending_registrations WHERE email=?');
        $existing->execute([$email, $email]);
        if (!$existing->fetchColumn()) {
            if (occupiedSeats($db, $info['class_id'], $now) >= (int) $info['capacity']) throw new ApiError(409, 'CLASS_FULL');
            $id = bin2hex(random_bytes(16));
            if ($immediate) {
                $db->prepare('INSERT INTO users (id,email,password_hash,display_name,class_id,created_at) VALUES (?,?,?,?,?,?)')->execute([$id,$email,$passwordHash,$name,$info['class_id'],$now]);
                $db->prepare('INSERT INTO learning_states (user_id,revision,document,updated_at) VALUES (?,0,?,?)')->execute([$id,json_encode(emptyState(),JSON_THROW_ON_ERROR),$now]);
                setEmailConfirmed($db,$id,false);
            } else {
            $token = bin2hex(random_bytes(32));
            $db->prepare('INSERT INTO pending_registrations (id,email,password_hash,display_name,class_id,invitation_hash,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
                ->execute([$id, $email, $passwordHash, $name, $info['class_id'], $grant['hash'], hash('sha256', $token), $now + 172800, $now]);
            $db->prepare('INSERT INTO mail_jobs (id,registration_id,token,available_at,created_at) VALUES (?,?,?,?,?)')
                ->execute([bin2hex(random_bytes(16)), $id, $token, $now, $now]);
            }
        }
        $db->commit();
    } catch (\PDOException $error) {
        if ($db->inTransaction()) $db->rollBack();
        // A concurrent registration of the same email is intentionally indistinguishable.
        if (!in_array($error->getCode(), ['23000', '23505'], true)) throw $error;
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    // Retain a short-lived grant so retry after a lost HTTP response is safe.
    return ['accepted' => true, 'immediate' => $immediate, 'mailPolicy' => registrationPolicy($config) + ['dailyLimitReached' => dailyMailLimitReached($db, $config, $now)]];
}

function verifyRegistration(\PDO $db, array $config, array $body): array
{
    requireRegistration($config);
    exactFields($body, ['token']);
    registrationThrottle($db, 'verify', 160);
    if (!is_string($body['token']) || !preg_match('/^[a-f0-9]{64}$/D', $body['token'])) throw new ApiError(422, 'VERIFICATION_INVALID');
    $now = time();
    $find = $db->prepare('SELECT * FROM pending_registrations WHERE token_hash=?');
    $hash = hash('sha256', $body['token']);
    $find->execute([$hash]);
    $pending = $find->fetch();
    // Release the preliminary SQLite read lock before obtaining the class write
    // lock. Concurrent confirmations otherwise can deadlock each other's commit.
    // The transaction below re-reads and validates the token under that lock.
    $find->closeCursor();
    if (!$pending) throw new ApiError(422, 'VERIFICATION_INVALID');
    $db->beginTransaction();
    try {
        lockRegistrationClass($db, $pending['class_id']);
        // Locking/current read on MySQL avoids consuming the same token concurrently.
        $find = $db->prepare('SELECT * FROM pending_registrations WHERE token_hash=?' . ($db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''));
        $find->execute([$hash]);
        $pending = $find->fetch();
        if (!$pending || (int) $pending['expires_at'] <= $now || (int) $pending['token_expires_at'] <= $now)
            throw new ApiError(422, 'VERIFICATION_INVALID');
        // A reservation made before natural code expiry can still be confirmed
        // within its own bounded token/reservation lifetime. Explicit revocation
        // still invalidates it (invitation.active must remain 1).
        $info = invitation($db, $pending['invitation_hash'], (int)$pending['created_at']);
        if (!$info || $info['class_id'] !== $pending['class_id']) throw new ApiError(422, 'VERIFICATION_INVALID');
        if (occupiedSeats($db, $pending['class_id'], $now) > (int) $info['capacity']) throw new ApiError(409, 'CLASS_FULL');
        $db->prepare('INSERT INTO users (id,email,password_hash,display_name,class_id,created_at) VALUES (?,?,?,?,?,?)')
            ->execute([$pending['id'], $pending['email'], $pending['password_hash'], $pending['display_name'], $pending['class_id'], $now]);
        $db->prepare('INSERT INTO learning_states (user_id,revision,document,updated_at) VALUES (?,0,?,?)')
            ->execute([$pending['id'], json_encode(emptyState(), JSON_THROW_ON_ERROR), $now]);
        setEmailConfirmed($db,$pending['id'],true);
        $db->prepare('DELETE FROM pending_registrations WHERE id=?')->execute([$pending['id']]);
        $db->commit();
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    // Deliberately no automatic login: a confirmation link may open on a different device.
    return ['verified' => true];
}

function createInvitation(\PDO $db, array $body): array
{
    exactFields($body, ['classId', 'code', 'expiresAt']);
    if (!is_string($body['classId']) || !preg_match('/^[a-f0-9]{32}$/D', $body['classId'])
        || !is_string($body['code']) || !preg_match('/^[A-Z]{5}$/D', $body['code'])
        || !is_int($body['expiresAt']) || $body['expiresAt'] <= time()) throw new \RuntimeException('Invalid invitation');
    $mysql = $db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
    $db->prepare($mysql ? 'INSERT IGNORE INTO class_registration (class_id) VALUES (?)'
        : 'INSERT OR IGNORE INTO class_registration (class_id) VALUES (?)')->execute([$body['classId']]);
    $db->prepare('INSERT INTO class_invitations (code_hash,class_id,expires_at) VALUES (?,?,?)')
        ->execute([hash('sha256', $body['code']), $body['classId'], $body['expiresAt']]);
    return ['classId' => $body['classId'], 'expiresAt' => $body['expiresAt']];
}

function revokeInvitation(\PDO $db, array $body): array
{
    exactFields($body, ['code']);
    if (!is_string($body['code']) || !preg_match('/^[A-Z]{5}$/D', $body['code'])) throw new \RuntimeException('Invalid code');
    $db->prepare('UPDATE class_invitations SET active=0 WHERE code_hash=?')->execute([hash('sha256', $body['code'])]);
    return ['revoked' => true];
}
