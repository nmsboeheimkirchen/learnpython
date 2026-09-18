<?php
declare(strict_types=1);

// CLI-only fixtures, never part of a release. Only disposable development databases.
require dirname(__DIR__) . '/server/src/bootstrap.php';
require dirname(__DIR__) . '/server/src/account-management.php';
if (PHP_SAPI !== 'cli' || getenv('AGENTPY_ENVIRONMENT') !== 'development') exit(1);
$config = AgentPy\config();
if (!str_starts_with($config['dsn'], 'sqlite:') && !preg_match('/(?:;|:)dbname=[A-Za-z0-9_]*_test(?:;|$)/D', $config['dsn'])) exit(1);
$db = AgentPy\database($config);
$input = json_decode(stream_get_contents(STDIN), true, 20, JSON_THROW_ON_ERROR);
switch ($argv[1] ?? '') {
    case 'test-profile-migration':
        // Destructive fixture is restricted to a disposable *_test DB above.
        $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        $tables = $mysql ? $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)
            : $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('users', $tables, true) && (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) exit(1);
        foreach (['write_receipts', 'learning_states', 'users', 'classes', 'schema_migrations', 'login_limits'] as $table)
            $db->exec('DROP TABLE IF EXISTS ' . $table);
        $db->exec('CREATE TABLE users (id VARCHAR(32) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)');
        $db->exec("INSERT INTO users (id,email,password_hash,created_at) VALUES ('legacy','legacy@example.test','synthetic-not-a-hash',0)");
        try { AgentPy\migrateAccounts($db); throw new LogicException('Unsafe migration accepted'); }
        catch (RuntimeException $e) { if ($e->getMessage() !== 'Existing accounts need an explicit profile migration') throw $e; }
        if ((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 1) throw new LogicException('Legacy data changed');
        $db->exec("DELETE FROM users WHERE id='legacy'");
        AgentPy\migrateAccounts($db); AgentPy\migrateAccounts($db);
        if ((int) $db->query('SELECT COUNT(*) FROM schema_migrations WHERE version=2')->fetchColumn() !== 1) throw new LogicException('Migration not recorded');
        echo json_encode(['ok' => true]);
        break;
    case 'test-profile-constraints':
        foreach (['UPDATE users SET class_id = NULL WHERE id = ?', "UPDATE users SET class_id = 'missing' WHERE id = ?"] as $sql) {
            try { $db->prepare($sql)->execute([$input['id']]); throw new LogicException('Missing class accepted'); }
            catch (PDOException $e) { /* Expected NOT NULL / FK rejection. */ }
        }
        try { $db->prepare('DELETE FROM classes WHERE id = ?')->execute([$input['classId']]); throw new LogicException('Assigned class deleted'); }
        catch (PDOException $e) { /* Existing users must retain their class. */ }
        AgentPy\migrateAccounts($db); // Repeating completed migration preserves populated v2 DB.
        echo json_encode(['ok' => true]);
        break;
    case 'course':
        echo json_encode(AgentPy\course(), JSON_THROW_ON_ERROR);
        break;
    case 'inspect':
        $query = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
        $query->execute([$input['id']]);
        echo json_encode(['password_hash' => $query->fetchColumn()], JSON_THROW_ON_ERROR);
        break;
    case 'receipt-failure':
        $db->exec('DROP TRIGGER IF EXISTS agentpy_test_receipt_failure');
        $sql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
            ? "CREATE TRIGGER agentpy_test_receipt_failure BEFORE INSERT ON write_receipts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test write failure'"
            : "CREATE TRIGGER agentpy_test_receipt_failure BEFORE INSERT ON write_receipts BEGIN SELECT RAISE(ABORT, 'Test write failure'); END";
        $db->exec($sql);
        break;
    case 'clear-failure':
        $db->exec('DROP TRIGGER IF EXISTS agentpy_test_receipt_failure');
        break;
    case 'corrupt-state':
        $db->prepare('UPDATE learning_states SET document = ? WHERE user_id = ?')->execute(['{}', $input['id']]);
        break;
    case 'deactivate':
        $db->prepare('UPDATE users SET active = 0 WHERE id = ?')->execute([$input['id']]);
        break;
    case 'expire-session':
        session_id($input['session']);
        AgentPy\beginSession($config);
        $_SESSION['last_seen'] = time() - 7201;
        session_write_close();
        break;
    case 'cleanup':
        $db->exec('DROP TRIGGER IF EXISTS agentpy_test_receipt_failure');
        $query = $db->prepare('DELETE FROM users WHERE id = ?');
        foreach ($input['ids'] as $id) $query->execute([$id]);
        if (isset($input['classId'])) $db->prepare('DELETE FROM classes WHERE id = ?')->execute([$input['classId']]);
        $db->exec('DELETE FROM login_limits');
        break;
    default: exit(1);
}
