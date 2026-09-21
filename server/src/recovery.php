<?php
declare(strict_types=1);

namespace AgentPy;

function migrateRecovery(\PDO $db): void
{
    $db->exec(file_get_contents(dirname(__DIR__) . '/recovery-schema.sql'));
    if (!$db->query('SELECT version FROM schema_migrations WHERE version=4')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (4,?)')->execute([time()]);
}

function requireRecovery(array $config): void
{
    if (!$config['password_reset_enabled']) throw new ApiError(503, 'RECOVERY_UNAVAILABLE');
}

// Before migration, old v2 accounts still work. Once v4 exists, revocation also
// applies when recovery is later switched off. Legacy sessions have epoch zero.
function authEpoch(\PDO $db, string $id): int
{
    if ((int) $db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn() < 4) return 0;
    $q = $db->prepare('SELECT revision FROM auth_epochs WHERE user_id=?'); $q->execute([$id]);
    return (int) $q->fetchColumn();
}

function requestPasswordReset(\PDO $db, array $config, array $body): array
{
    requireRecovery($config); exactFields($body, ['email']);
    $email = normalizedEmail($body['email']);
    registrationThrottle($db, 'reset-request', 160);
    $started = hrtime(true);
    $accepted = ['accepted' => true, 'mailPolicy' => registrationPolicy($config)];
    try {
        // Same generic answer for unknown, inactive, throttled and existing accounts.
        // This account limit must never lock out login or consume a live reset link.
        try { throttle($db, 'reset-email:' . $email, 3); }
        catch (ApiError) { return $accepted; }
        $db->beginTransaction();
        // Acquire the same per-user lock as token consumption, even on SQLite.
        $db->prepare('UPDATE users SET active=active WHERE email=?')->execute([$email]);
        $q = $db->prepare('SELECT id,password_hash FROM users WHERE email=? AND active=1');
        $q->execute([$email]); $user = $q->fetch();
        $now = time();
        if ($user) {
            $db->prepare('DELETE FROM password_resets WHERE user_id=? AND (expires_at<=? OR (token_expires_at>0 AND token_expires_at<=?))')->execute([$user['id'],$now,$now]);
            $q = $db->prepare('SELECT id FROM password_resets WHERE user_id=?'); $q->execute([$user['id']]);
            // Repeated requests do not invalidate the first link or send a mail flood.
            if (!$q->fetchColumn()) {
                $id = bin2hex(random_bytes(16)); $token = bin2hex(random_bytes(32));
                $db->prepare('INSERT INTO password_resets (id,user_id,token_hash,credential_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)')
                    ->execute([$id,$user['id'],hash('sha256',$token),hash('sha256',$user['password_hash']),$now+86400,$now]);
                $db->prepare('INSERT INTO recovery_mail_jobs (id,user_id,reset_id,kind,token,available_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([bin2hex(random_bytes(16)),$user['id'],$id,'reset',$token,$now,$now+86400,$now]);
            }
        }
        $db->commit(); return $accepted;
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    finally {
        // Bound normal small DB timing differences; transport happens asynchronously.
        $remaining = 100000 - intdiv(hrtime(true) - $started, 1000);
        if ($remaining > 0) usleep($remaining);
    }
}

function resetPassword(\PDO $db, array $config, array $body): array
{
    requireRecovery($config); exactFields($body, ['token','password','confirmation']);
    registrationThrottle($db, 'reset-consume', 160);
    if (!is_string($body['token']) || !preg_match('/^[a-f0-9]{64}$/D', $body['token'])) throw new ApiError(422,'RESET_INVALID');
    validateNewPassword($body['password']);
    if (!is_string($body['confirmation']) || !hash_equals($body['password'],$body['confirmation'])) throw new ApiError(422,'PASSWORD_MISMATCH');
    $tokenHash = hash('sha256',$body['token']);
    $q = $db->prepare('SELECT user_id FROM password_resets WHERE token_hash=?'); $q->execute([$tokenHash]);
    $id = $q->fetchColumn();
    // Release the SQLite read lock before hashing/obtaining the write lock. Two
    // consumers otherwise hold each other's commit hostage until SQLITE_BUSY.
    $q->closeCursor();
    if (!$id) throw new ApiError(422,'RESET_INVALID');
    $hash = password_hash($body['password'],PASSWORD_BCRYPT,['cost'=>12]);
    $now = time(); $db->beginTransaction();
    try {
        $db->prepare('UPDATE users SET active=active WHERE id=?')->execute([$id]);
        $q = $db->prepare('SELECT r.*,u.password_hash,u.active FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=?' . ($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));
        $q->execute([$tokenHash]); $reset = $q->fetch();
        if (!$reset || !(int)$reset['active'] || (int)$reset['expires_at']<=$now || (int)$reset['token_expires_at']<=$now
            || !hash_equals($reset['credential_hash'],hash('sha256',$reset['password_hash']))) throw new ApiError(422,'RESET_INVALID');
        $db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$hash,$id]);
        $db->prepare($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'
            ? 'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON DUPLICATE KEY UPDATE revision=revision+1'
            : 'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1')->execute([$id]);
        $db->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$id]);
        $db->prepare('INSERT INTO recovery_mail_jobs (id,user_id,kind,available_at,expires_at,created_at) VALUES (?,?,?,?,?,?)')
            ->execute([bin2hex(random_bytes(16)),$id,'reset-notice',$now,$now+86400,$now]);
        $db->commit();
    } catch (\Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    rotateSession(); // No automatic login; all other old sessions fail epoch checks.
    return ['reset'=>true,'csrfToken'=>$_SESSION['csrf']];
}
