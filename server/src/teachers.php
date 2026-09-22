<?php
declare(strict_types=1);
namespace AgentPy;

function teacherSchema(\PDO $db): bool
{
    return (int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn() >= 5;
}

function migrateTeachers(\PDO $db): void
{
    $db->exec(file_get_contents(dirname(__DIR__) . '/teacher-schema.sql'));
    if (!$db->query('SELECT version FROM schema_migrations WHERE version=5')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (5,?)')->execute([time()]);
}

function teacherKey(array $config): string
{
    $file = $config['teacher_key_file'];
    if (!$file || !is_file($file) || is_link($file)) throw new \RuntimeException('Teacher key unavailable');
    $key = file_get_contents($file);
    if (!is_string($key) || strlen($key) !== 32) throw new \RuntimeException('Invalid teacher key');
    return $key;
}

function prepareTeacherKey(array $config): void
{
    if (PHP_SAPI !== 'cli' || !$config['teacher_key_file']) throw new \RuntimeException('Private CLI setup required');
    $file = $config['teacher_key_file'];
    if (!file_exists($file)) {
        $stream = fopen($file, 'xb');
        if (!$stream) throw new \RuntimeException('Private key creation failed');
        chmod($file, 0600);
        try { if (fwrite($stream, random_bytes(32)) !== 32) throw new \RuntimeException('Private key write failed'); }
        finally { fclose($stream); }
    }
    teacherKey($config);
}

function teacherProfile(\PDO $db, string $id): ?array
{
    if (!teacherSchema($db)) return null;
    $q=$db->prepare('SELECT class_limit FROM teachers WHERE user_id=?');$q->execute([$id]);
    $row=$q->fetch();return $row ? ['classLimit'=>(int)$row['class_limit']] : null;
}

function requireTeacher(\PDO $db): array
{
    $user=requireUser($db);
    if (!$user['teacher']) throw new ApiError(403,'TEACHER_REQUIRED');
    return $user;
}

function ownClass(\PDO $db, string $teacher, mixed $classId): array
{
    if (!is_string($classId) || !preg_match('/^[a-f0-9]{32}$/D',$classId)) throw new ApiError(404,'CLASS_NOT_FOUND');
    $q=$db->prepare('SELECT t.class_id AS id,t.display_name AS name,r.capacity FROM teacher_classes t JOIN class_registration r ON r.class_id=t.class_id WHERE t.class_id=? AND t.teacher_id=?');
    $q->execute([$classId,$teacher]);return $q->fetch() ?: throw new ApiError(404,'CLASS_NOT_FOUND');
}

function visibleInvitation(\PDO $db, array $config, string $classId, int $now): ?array
{
    $q=$db->prepare('SELECT i.code_hash,i.expires_at,s.encrypted_code FROM class_invitations i JOIN invitation_secrets s ON s.code_hash=i.code_hash WHERE i.class_id=? AND i.active=1 AND i.expires_at>? ORDER BY i.expires_at DESC');
    $q->execute([$classId,$now]);$row=$q->fetch();if (!$row) return null;
    $raw=base64_decode($row['encrypted_code'],true);
    if ($raw===false || strlen($raw)!==33) throw new \RuntimeException('Invalid encrypted invitation');
    $code=openssl_decrypt(substr($raw,28),'aes-256-gcm',teacherKey($config),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16),$classId);
    if (!is_string($code) || !preg_match('/^[A-Z]{5}$/D',$code) || !hash_equals($row['code_hash'],hash('sha256',$code))) throw new \RuntimeException('Invalid invitation key');
    return ['code'=>$code,'expiresAt'=>(int)$row['expires_at']];
}

function classSummary(\PDO $db, array $config, array $class, int $now): array
{
    $q=$db->prepare('SELECT COUNT(*) FROM users u WHERE u.class_id=? AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id=u.id)');
    $q->execute([$class['id']]);$members=(int)$q->fetchColumn();
    $q=$db->prepare('SELECT COUNT(*) FROM pending_registrations WHERE class_id=? AND expires_at>?');
    $q->execute([$class['id'],$now]);$pending=(int)$q->fetchColumn();
    return ['id'=>$class['id'],'name'=>$class['name'],'capacity'=>(int)$class['capacity'],'members'=>$members,'pending'=>$pending,
        'free'=>max(0,(int)$class['capacity']-$members-$pending),'invitation'=>visibleInvitation($db,$config,$class['id'],$now)];
}

function teacherClasses(\PDO $db, array $config, array $user): array
{
    $q=$db->prepare('SELECT t.class_id AS id,t.display_name AS name,r.capacity FROM teacher_classes t JOIN class_registration r ON r.class_id=t.class_id WHERE t.teacher_id=? ORDER BY t.display_name');
    $q->execute([$user['id']]);$classes=$q->fetchAll();$now=time();
    return ['profile'=>$user,'classLimit'=>$user['teacher']['classLimit'],'serverTime'=>$now,
        'classes'=>array_map(fn($c)=>classSummary($db,$config,$c,$now),$classes)];
}

function teacherClass(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['classId']);$class=ownClass($db,$user['id'],$body['classId']);$now=time();
    // Only completion IDs, never student source code, password hashes or verification tokens.
    $q=$db->prepare('SELECT u.id,u.display_name AS name,u.email,u.active,s.document FROM users u LEFT JOIN learning_states s ON s.user_id=u.id WHERE u.class_id=? AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id=u.id) ORDER BY u.display_name,u.email');
    $q->execute([$class['id']]);$members=[];
    foreach($q->fetchAll() as $row) {
        $document=$row['document']===null ? null : json_decode($row['document'],true,20,JSON_THROW_ON_ERROR);
        $completed=$document['completedCodes'] ?? null;
        $members[]=['id'=>$row['id'],'name'=>$row['name'],'email'=>$row['email'],'status'=>(int)$row['active'] ? 'confirmed':'inactive',
            'completedIds'=>is_array($completed) ? array_keys(array_filter($completed,'is_string')) : null];
    }
    $q=$db->prepare('SELECT display_name AS name,email FROM pending_registrations WHERE class_id=? AND expires_at>? ORDER BY display_name,email');
    $q->execute([$class['id'],$now]);
    foreach($q->fetchAll() as $row)$members[]=$row+['status'=>'pending','completedIds'=>null];
    return ['profile'=>$user,'class'=>classSummary($db,$config,$class,$now),'members'=>$members,'serverTime'=>$now];
}

function issueTeacherCode(\PDO $db, array $config, string $teacher, string $classId, int $now): array
{
    // Called inside a transaction with teacher + registration-class locks held.
    // Natural expiry does not revoke confirmations reserved while the code was valid.
    $key=teacherKey($config);
    for($try=0;$try<20;$try++) {
        $code='';for($i=0;$i<5;$i++)$code.=chr(65+random_int(0,25));
        $hash=hash('sha256',$code);
        $q=$db->prepare('SELECT code_hash FROM class_invitations WHERE code_hash=?');$q->execute([$hash]);
        if ($q->fetchColumn()) continue;
        try {$db->prepare('INSERT INTO class_invitations (code_hash,class_id,expires_at) VALUES (?,?,?)')->execute([$hash,$classId,$now+864000]);}
        catch(\PDOException $error){if(in_array($error->getCode(),['23000','23505'],true))continue;throw $error;}
        $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($code,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,$classId,16);
        if($cipher===false)throw new \RuntimeException('Code encryption failed');
        $db->prepare('INSERT INTO invitation_secrets (code_hash,encrypted_code) VALUES (?,?)')->execute([$hash,base64_encode($iv.$tag.$cipher)]);
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$teacher,$classId,'code-generated',$now]);
        return ['code'=>$code,'expiresAt'=>$now+864000];
    }
    throw new \RuntimeException('Code allocation failed');
}

function lockTeacher(\PDO $db, string $id): int
{
    $db->prepare('UPDATE teachers SET class_limit=class_limit WHERE user_id=?')->execute([$id]);
    $q=$db->prepare('SELECT class_limit FROM teachers WHERE user_id=?');$q->execute([$id]);$limit=$q->fetchColumn();
    if($limit===false)throw new ApiError(403,'TEACHER_REQUIRED');return (int)$limit;
}

function createTeacherClass(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['name']);try{$name=accountLabel($body['name']);}catch(\RuntimeException){throw new ApiError(422,'INVALID_CLASS_NAME');}
    $db->beginTransaction();
    try {
        $limit=lockTeacher($db,$user['id']);
        $q=$db->prepare('SELECT COUNT(*) FROM teacher_classes WHERE teacher_id=?');$q->execute([$user['id']]);
        if((int)$q->fetchColumn()>=$limit)throw new ApiError(409,'CLASS_LIMIT_REACHED');
        $q=$db->prepare('SELECT class_id FROM teacher_classes WHERE teacher_id=? AND display_name=?');$q->execute([$user['id'],$name]);
        if($q->fetchColumn())throw new ApiError(409,'CLASS_NAME_TAKEN');
        $id=bin2hex(random_bytes(16));$now=time();
        // Legacy classes.name remains unique. Public names are owner-scoped, so two
        // teachers can both create "1A" without leaking another teacher's class.
        $db->prepare('INSERT INTO classes (id,name,created_at) VALUES (?,?,?)')->execute([$id,'class-'.$id,$now]);
        $db->prepare('INSERT INTO class_registration (class_id) VALUES (?)')->execute([$id]);
        $db->prepare('INSERT INTO teacher_classes (class_id,teacher_id,display_name) VALUES (?,?,?)')->execute([$id,$user['id'],$name]);
        issueTeacherCode($db,$config,$user['id'],$id,$now);$db->commit();
    } catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,['classId'=>$id]);
}

function renewTeacherCode(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['classId']);ownClass($db,$user['id'],$body['classId']);$db->beginTransaction();
    try {
        lockTeacher($db,$user['id']);ownClass($db,$user['id'],$body['classId']);lockRegistrationClass($db,$body['classId']);$now=time();
        // Retrying a lost response reuses the current code instead of generating another.
        if(!visibleInvitation($db,$config,$body['classId'],$now))issueTeacherCode($db,$config,$user['id'],$body['classId'],$now);
        $db->commit();
    } catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,$body);
}
