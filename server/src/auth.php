<?php
declare(strict_types=1);

namespace AgentPy;

function beginSession(array $config): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', '7200');
    session_name($config['secure_cookie'] ? '__Host-agentpy_session' : 'agentpy_session');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => $config['secure_cookie'],
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    if ($config['session_path']) session_save_path($config['session_path']);
    if (!session_start()) throw new \RuntimeException('Session storage unavailable');
    $now = time();
    if (isset($_SESSION['user_id']) && (
        $now - ($_SESSION['last_seen'] ?? 0) > 7200
        || $now - ($_SESSION['login_at'] ?? 0) > 43200
    )) {
        rotateSession();
    }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    $_SESSION['last_seen'] = $now;
}

function rotateSession(): void
{
    $_SESSION = ['csrf' => bin2hex(random_bytes(32)), 'last_seen' => time()];
    if (!session_regenerate_id(true)) throw new \RuntimeException('Session rotation failed');
}

function requireMutation(array $config): void
{
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== $config['origin']) throw new ApiError(403, 'ORIGIN_MISMATCH');
    $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$csrf || !hash_equals($_SESSION['csrf'], $csrf)) throw new ApiError(403, 'CSRF_MISMATCH');
}

function currentUser(\PDO $db): ?array
{
    if (!isset($_SESSION['user_id'])) return null;
    $query = $db->prepare('SELECT u.id, u.email, u.display_name AS name, u.class_id AS classId, c.name AS className FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND u.active = 1');
    $query->execute([$_SESSION['user_id']]);
    $user = $query->fetch();
    if (!$user || (int) ($_SESSION['auth_epoch'] ?? 0) !== authEpoch($db, $user['id'])) {
        rotateSession();
        return null;
    }
    if (teacherSchema($db)) {
        $q=$db->prepare('SELECT display_name FROM teacher_classes WHERE class_id=?');$q->execute([$user['classId']]);
        $name=$q->fetchColumn();if($name!==false)$user['className']=$name;
    }
    $user['teacher']=teacherProfile($db,$user['id']);
    $user['superadmin']=isSuperadmin($db,$user['id']);
    $user['emailVerified']=emailConfirmed($db,$user['id']);
    if(membershipSchema($db))$user['classes']=accountClasses($db,$user['id']);
    return $user;
}

function requireUser(\PDO $db): array
{
    $user = currentUser($db);
    if (!$user) throw new ApiError(401, 'AUTH_REQUIRED');
    // This guard rejects stale tabs after switching accounts. It is NOT authentication:
    // the database owner always comes from the verified server-side session above.
    if (($_SERVER['HTTP_X_AGENTPY_PROFILE'] ?? '') !== $user['id'])
        throw new ApiError(409, 'PROFILE_CHANGED');
    return $user;
}

function normalizedEmail(mixed $value): string
{
    if (!is_string($value)) throw new ApiError(422, 'INVALID_EMAIL');
    $email = strtolower(trim($value));
    if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL))
        throw new ApiError(422, 'INVALID_EMAIL');
    return $email;
}

function throttle(\PDO $db, string $subject, int $limit): void
{
    // Account and IP buckets: the IP allowance accommodates a whole class behind one NAT.
    $bucket = hash('sha256', $subject . ':' . intdiv(time(), 900));
    $driver = $db->getAttribute(\PDO::ATTR_DRIVER_NAME);
    $sql = 'INSERT INTO login_limits (bucket_key, hits, expires_at) VALUES (?, 1, ?) ';
    $sql .= $driver === 'mysql'
        ? 'ON DUPLICATE KEY UPDATE hits = hits + 1'
        : 'ON CONFLICT(bucket_key) DO UPDATE SET hits = hits + 1';
    $db->prepare($sql)->execute([$bucket, time() + 1800]);
    $query = $db->prepare('SELECT hits FROM login_limits WHERE bucket_key = ?');
    $query->execute([$bucket]);
    $db->prepare('DELETE FROM login_limits WHERE expires_at < ?')->execute([time()]);
    if ((int) $query->fetchColumn() > $limit) throw new ApiError(429, 'LOGIN_RATE_LIMITED');
}

function login(\PDO $db, array $body): array
{
    exactFields($body, ['email', 'password']);
    $email = normalizedEmail($body['email']);
    if (!is_string($body['password']) || strlen($body['password']) > 72 || str_contains($body['password'], "\0"))
        throw new ApiError(422, 'INVALID_PASSWORD');
    throttle($db, 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 150);
    throttle($db, 'email:' . $email, 10);
    // Read password + epoch in one snapshot: a concurrent reset must never let
    // the OLD password authenticate a session with the NEW epoch.
    $v4 = (int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn() >= 4;
    $query = $db->prepare($v4
        ? 'SELECT u.id,u.email,u.password_hash,u.active,COALESCE(e.revision,0) AS auth_epoch FROM users u LEFT JOIN auth_epochs e ON e.user_id=u.id WHERE u.email=?'
        : 'SELECT id,email,password_hash,active,0 AS auth_epoch FROM users WHERE email=?');
    $query->execute([$email]);
    $user = $query->fetch();
    $query->closeCursor();
    // Valid bcrypt hash at the same cost as provisioned accounts; never an actual account.
    $dummy = '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $valid = password_verify($body['password'], $user ? $user['password_hash'] : $dummy);
    if (!$user || !$valid || !(int) $user['active']) throw new ApiError(401, 'INVALID_CREDENTIALS');
    rotateSession();
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['auth_epoch'] = (int)$user['auth_epoch'];
    $_SESSION['login_at'] = time();
    return currentUser($db) ?? throw new ApiError(401, 'INVALID_CREDENTIALS');
}
