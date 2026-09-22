<?php
declare(strict_types=1);

namespace AgentPy;

function accountLabel(mixed $value): string
{
    if (!is_string($value)) throw new \RuntimeException('Invalid label');
    $value = trim($value);
    if ($value === '' || preg_match('/[\x00-\x1f\x7f]/u', $value)
        || !preg_match('/^.{1,100}$/uD', $value)) throw new \RuntimeException('Invalid label');
    return $value;
}

function createClass(\PDO $db, array $input): array
{
    exactFields($input, ['name']);
    $name = accountLabel($input['name']);
    $id = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO classes (id, name, created_at) VALUES (?, ?, ?)')->execute([$id, $name, time()]);
    return ['id' => $id, 'name' => $name];
}

function createAccount(\PDO $db, array $input): array
{
    exactFields($input, ['email', 'password', 'name', 'classId']);
    $email = normalizedEmail($input['email']);
    $name = accountLabel($input['name']);
    $password = $input['password'];
    validateNewPassword($password);
    $classId = $input['classId'];
    if (!is_string($classId) || !preg_match('/^[a-f0-9]{32}$/D', $classId)) throw new \RuntimeException('Invalid class');
    $query = $db->prepare('SELECT name FROM classes WHERE id = ?');
    $query->execute([$classId]);
    $className = $query->fetchColumn();
    if ($className === false) throw new \RuntimeException('Unknown class');
    $id = bin2hex(random_bytes(16));
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO users (id, email, password_hash, display_name, class_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $email, $hash, $name, $classId, time()]);
        $db->prepare('INSERT INTO learning_states (user_id, revision, document, updated_at) VALUES (?, 0, ?, ?)')
            ->execute([$id, json_encode(emptyState(), JSON_THROW_ON_ERROR), time()]);
        $db->commit();
    } catch (\Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
    return ['id' => $id, 'email' => $email, 'name' => $name, 'classId' => $classId, 'className' => $className];
}

function validateNewPassword(mixed $password): void
{
    // Count Unicode code points, not UTF-8 bytes. Bcrypt still has a 72-byte ceiling.
    if (!is_string($password) || strlen($password) > 72 || str_contains($password, "\0")
        || preg_match_all('/./us', $password) < 8) throw new ApiError(422, 'INVALID_NEW_PASSWORD');
}

function migrateAccounts(\PDO $db): void
{
    $mysql = $db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql && strtolower((string) $db->query('SELECT @@default_storage_engine')->fetchColumn()) !== 'innodb')
        throw new \RuntimeException('InnoDB is required');
    $columns = $mysql
        ? $db->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'")->fetchAll(\PDO::FETCH_COLUMN)
        : array_column($db->query('PRAGMA table_info(users)')->fetchAll(), 'name');
    // Pilot migration v2: never guess names/classes or silently rewrite existing accounts.
    $legacy = $columns && (!in_array('display_name', $columns, true) || !in_array('class_id', $columns, true));
    if ($legacy && (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0)
        throw new \RuntimeException('Existing accounts need an explicit profile migration');
    $db->exec(file_get_contents(dirname(__DIR__) . '/schema.sql'));
    if ($legacy) {
        if (!in_array('display_name', $columns, true)) $db->exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) NOT NULL');
        if (!in_array('class_id', $columns, true)) {
            $db->exec($mysql
                ? 'ALTER TABLE users ADD COLUMN class_id VARCHAR(32) NOT NULL, ADD CONSTRAINT users_class_fk FOREIGN KEY (class_id) REFERENCES classes(id)'
                : 'ALTER TABLE users ADD COLUMN class_id VARCHAR(32) NOT NULL REFERENCES classes(id)');
        }
    }
    if (!$db->query('SELECT version FROM schema_migrations WHERE version = 2')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)')->execute([time()]);
    migrateRegistration($db);
    migrateRecovery($db);
    migrateTeachers($db);
}
