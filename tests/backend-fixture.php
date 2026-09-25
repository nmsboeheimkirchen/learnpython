<?php
declare(strict_types=1);

// CLI-only fixtures, never part of a release. Only disposable development databases.
require dirname(__DIR__) . '/server/src/bootstrap.php';
// Helpers are loaded by bootstrap.
if (PHP_SAPI !== 'cli' || getenv('AGENTPY_ENVIRONMENT') !== 'development') exit(1);
$config = AgentPy\config();
if (!str_starts_with($config['dsn'], 'sqlite:') && !preg_match('/(?:;|:)dbname=[A-Za-z0-9_]*_test(?:;|$)/D', $config['dsn'])) exit(1);
$db = AgentPy\database($config);
$input = json_decode(stream_get_contents(STDIN), true, 20, JSON_THROW_ON_ERROR);
switch ($argv[1] ?? '') {
    case 'test-management-migration':
        $snapshot=function()use($db){$out=[];foreach(['users','classes','learning_states','teachers','teacher_classes','class_teachers','class_memberships','email_confirmations','class_invitations']as $table){$rows=array_map(fn($row)=>json_encode($row),$db->query('SELECT * FROM '.$table)->fetchAll());sort($rows);$out[$table]=$rows;}return $out;};
        $before=$snapshot();$db->exec('DROP TABLE class_namespaces');$db->exec('DELETE FROM schema_migrations WHERE version=8');
        $db->exec('CREATE UNIQUE INDEX old_owner_name ON teacher_classes (teacher_id,display_name)');
        AgentPy\migrateManagement($db);AgentPy\migrateManagement($db);
        echo json_encode(['preserved'=>$before===$snapshot(),'version'=>(int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn()]);break;
    case 'admin-grant':
        $db->prepare('INSERT INTO superadmins (user_id,created_at) VALUES (?,?)')->execute([$input['id'],time()]);break;
    case 'teacher-invite-expire':
        $db->prepare('UPDATE teacher_invitations SET expires_at=1 WHERE email=?')->execute([$input['email']]);break;
    case 'teacher-invite-token':
        $q=$db->prepare('SELECT j.token FROM teacher_mail_jobs j JOIN teacher_invitations i ON i.id=j.invitation_id WHERE i.email=?');$q->execute([$input['email']]);echo json_encode(['token'=>$q->fetchColumn()]);break;
    case 'test-roles-migration':
        // Only disposable test DSNs pass the guard above. No production grant here.
        $snapshot=function()use($db){$out=[];foreach(['users','classes','learning_states','teachers','teacher_classes','class_memberships','email_confirmations']as $table){$rows=array_map(fn($row)=>json_encode($row),$db->query('SELECT * FROM '.$table)->fetchAll());sort($rows);$out[$table]=$rows;}return $out;};
        $before=$snapshot();
        foreach(['teacher_mail_jobs','teacher_invitations','class_teachers','superadmins']as $table)$db->exec('DROP TABLE '.$table);
        $db->exec('DELETE FROM schema_migrations WHERE version=7');
        AgentPy\migrateRoles($db);AgentPy\migrateRoles($db);
        echo json_encode(['preserved'=>$before===$snapshot(),'superadmins'=>(int)$db->query('SELECT COUNT(*) FROM superadmins')->fetchColumn(),'version'=>(int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn()]);break;
    case 'test-membership-migration':
        // Only disposable test DSNs pass the guard above. Exercise populated v5 -> v6.
        $snapshot=fn()=>[$db->query('SELECT * FROM users ORDER BY id')->fetchAll(),$db->query('SELECT * FROM learning_states ORDER BY user_id')->fetchAll()];
        $before=$snapshot();
        $db->exec('DROP TABLE email_confirmations');$db->exec('DROP TABLE class_memberships');
        $db->exec('DELETE FROM schema_migrations WHERE version=6');
        AgentPy\migrateMemberships($db);
        $q=$db->query('SELECT COUNT(*) FROM users');$count=(int)$q->fetchColumn();
        if($count!==(int)$db->query('SELECT COUNT(*) FROM class_memberships')->fetchColumn())throw new RuntimeException('Backfill');
        AgentPy\setEmailConfirmed($db,$input['id'],false);
        AgentPy\migrateMemberships($db);
        echo json_encode(['ok'=>$before===$snapshot(),'confirmed'=>AgentPy\emailConfirmed($db,$input['id']),'version'=>(int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn()]);
        break;
    case 'membership-add':
        $db->prepare('INSERT INTO class_memberships (user_id,class_id,created_at) VALUES (?,?,?)')->execute([$input['id'],$input['classId'],time()]);break;
    case 'membership-inspect':
        echo json_encode(['classes'=>AgentPy\accountClasses($db,$input['id']),'confirmed'=>AgentPy\emailConfirmed($db,$input['id'])]);break;
    case 'teacher-grant':
        $db->prepare('INSERT INTO teachers (user_id,class_limit) VALUES (?,?)')->execute([$input['id'],$input['limit']]);break;
    case 'teacher-expire':
        $db->prepare('UPDATE class_invitations SET expires_at=? WHERE class_id=?')->execute([time()-1,$input['classId']]);break;
    case 'teacher-limit':
        $db->prepare('UPDATE teachers SET class_limit=? WHERE user_id=?')->execute([$input['limit'],$input['id']]);break;
    case 'teacher-key-check':
        $q=$db->prepare('SELECT encrypted_code FROM invitation_secrets WHERE code_hash=?');$q->execute([hash('sha256',$input['code'])]);
        $cipher=$q->fetchColumn();echo json_encode(['encrypted'=>is_string($cipher)&&!str_contains($cipher,$input['code']),'hasPrivateKey'=>strlen(AgentPy\teacherKey($config))===32]);break;
    case 'teacher-clean':
        $q=$db->prepare('SELECT class_id FROM teacher_classes WHERE teacher_id=?');$q->execute([$input['id']]);
        foreach($q->fetchAll(PDO::FETCH_COLUMN) as $id){$db->prepare('DELETE FROM users WHERE class_id=?')->execute([$id]);$db->prepare('DELETE FROM classes WHERE id=?')->execute([$id]);}
        $db->prepare('DELETE FROM teachers WHERE user_id=?')->execute([$input['id']]);break;
    case 'init-v2-only':
        $db->exec(file_get_contents(dirname(__DIR__) . '/server/schema.sql'));
        if ((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) exit(1);
        foreach (['class_namespaces','teacher_mail_jobs','teacher_invitations','class_teachers','superadmins','class_memberships','email_confirmations','invitation_secrets','teacher_classes','teachers','teacher_audit','recovery_mail_jobs','password_resets','auth_epochs','mail_jobs', 'pending_registrations', 'class_invitations', 'class_registration', 'mail_attempts', 'mail_dispatch_lock'] as $table)
            $db->exec('DROP TABLE IF EXISTS ' . $table);
        $db->exec('DELETE FROM schema_migrations');
        $db->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)')->execute([time()]);
        break;
    case 'inspect-v2-only':
        $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        $tables = $mysql ? $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)
            : $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
        echo json_encode(['schema' => (int) $db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn(),
            'hasRegistrationTables' => (bool) array_intersect($tables, ['mail_jobs', 'pending_registrations', 'class_invitations', 'class_registration', 'mail_attempts', 'mail_dispatch_lock'])]);
        break;
    case 'registration-inspect':
        $q = $db->prepare('SELECT id,token_hash,token_expires_at,expires_at FROM pending_registrations WHERE email=?');
        $q->execute([$input['email']]); $pending = $q->fetch();
        $q = $db->prepare('SELECT COUNT(*) FROM users WHERE email=?'); $q->execute([$input['email']]);
        echo json_encode(['pending' => $pending, 'users' => (int) $q->fetchColumn(), 'jobs' => (int) $db->query('SELECT COUNT(*) FROM mail_jobs')->fetchColumn()]);
        break;
    case 'registration-capacity':
        $db->prepare('UPDATE class_registration SET capacity=? WHERE class_id=?')->execute([$input['capacity'], $input['classId']]);
        break;
    case 'registration-expire':
        $db->prepare('UPDATE pending_registrations SET expires_at=1 WHERE email=?')->execute([$input['email']]);
        break;
    case 'registration-expire-code-session':
        session_id($input['session']); AgentPy\beginSession($config);
        $_SESSION['code_blocked_until'] = time() - 1; session_write_close();
        break;
    case 'registration-grant-expire':
        session_id($input['session']); AgentPy\beginSession($config);
        $_SESSION['registration_grant']['expires'] = 1; session_write_close();
        break;
    case 'registration-clean-class':
        // Also clean a disposable account when a test failed just after confirming
        // it, before its ID could be added to the usual per-user teardown list.
        $db->prepare('DELETE FROM users WHERE class_id=?')->execute([$input['classId']]);
        $db->prepare('DELETE FROM classes WHERE id=?')->execute([$input['classId']]);
        break;
    case 'mail-test':
        $config['mail_per_minute'] = $input['perMinute'] ?? 10;
        $config['mail_per_day'] = $input['perDay'] ?? 100;
        $messages = [];
        for ($i=0; $i<($input['count'] ?? 1); $i++) {
            if (!AgentPy\dispatchMail($db, $config, function ($to, $body) use (&$messages, $input) {
                $messages[] = ['to' => $to, 'body' => $body]; return !($input['fail'] ?? false);
            }, $input['now'] ?? time())) break;
        }
        echo json_encode(['messages' => $messages, 'policy' => AgentPy\registrationPolicy($config), 'attempts' => (int) $db->query('SELECT COUNT(*) FROM mail_attempts')->fetchColumn()]);
        break;
    case 'mail-claim-crash':
        $job = AgentPy\claimMail($db, $config, $input['now']);
        echo json_encode(['claimed' => $job !== null]); // Process exits before transport; job must survive.
        break;
    case 'registration-expire-token':
        $db->prepare('UPDATE pending_registrations SET token_expires_at=1 WHERE email=?')->execute([$input['email']]);
        break;
    case 'mail-clear-attempts':
        $db->exec('DELETE FROM mail_attempts'); break;
    case 'reset-inspect':
        $q=$db->prepare('SELECT r.* FROM password_resets r JOIN users u ON u.id=r.user_id WHERE u.email=?');$q->execute([$input['email']]);
        $reset=$q->fetch();
        $q=$db->prepare('SELECT j.kind,j.token,j.state,j.attempts FROM recovery_mail_jobs j JOIN users u ON u.id=j.user_id WHERE u.email=?');$q->execute([$input['email']]);
        echo json_encode(['reset'=>$reset,'jobs'=>$q->fetchAll()]);break;
    case 'reset-expire':
        $db->prepare('UPDATE password_resets SET token_expires_at=1 WHERE user_id=(SELECT id FROM users WHERE email=?)')->execute([$input['email']]);break;
    case 'session-legacy-epoch':
        session_id($input['session']);AgentPy\beginSession($config);unset($_SESSION['auth_epoch']);session_write_close();break;
    case 'mail-seed':
        $now = time();
        for ($i=0; $i<$input['count']; $i++) {
            $id=bin2hex(random_bytes(16)); $token=bin2hex(random_bytes(32));
            $db->prepare('INSERT INTO pending_registrations (id,email,password_hash,display_name,class_id,invitation_hash,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
                ->execute([$id,"queue-$id@example.test",'synthetic-no-login','Queue fixture',$input['classId'],hash('sha256',$input['code']),hash('sha256',$token),$now+172800,$now]);
            $db->prepare('INSERT INTO mail_jobs (id,registration_id,token,available_at,created_at) VALUES (?,?,?,?,?)')->execute([$id,$id,$token,$now,$now]);
        }
        break;
    case 'registration-migrate-preserves':
        $before = $db->query('SELECT * FROM users ORDER BY id')->fetchAll();
        $states = $db->query('SELECT * FROM learning_states ORDER BY user_id')->fetchAll();
        AgentPy\migrateAccounts($db); AgentPy\migrateAccounts($db);
        if ($before !== $db->query('SELECT * FROM users ORDER BY id')->fetchAll() || $states !== $db->query('SELECT * FROM learning_states ORDER BY user_id')->fetchAll()) throw new LogicException('Migration changed data');
        echo json_encode(['ok'=>true]); break;
    case 'test-profile-migration':
        // Destructive fixture is restricted to a disposable *_test DB above.
        $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        $tables = $mysql ? $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)
            : $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('users', $tables, true) && (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) exit(1);
        foreach (['class_namespaces','invitation_secrets','teacher_classes','teachers','teacher_audit','recovery_mail_jobs','password_resets','auth_epochs','mail_jobs', 'pending_registrations', 'class_invitations', 'class_registration', 'mail_attempts', 'mail_dispatch_lock', 'write_receipts', 'learning_states', 'users', 'classes', 'schema_migrations', 'login_limits'] as $table)
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
    case 'deleted-user-counts':
        $counts=[];
        foreach (['users'=>'id','learning_states'=>'user_id','write_receipts'=>'user_id','auth_epochs'=>'user_id','password_resets'=>'user_id','recovery_mail_jobs'=>'user_id'] as $table=>$field) {
            $q=$db->prepare("SELECT COUNT(*) FROM $table WHERE $field=?");$q->execute([$input['id']]);
            $counts[$table]=(int)$q->fetchColumn();
        }
        echo json_encode($counts);break;
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
