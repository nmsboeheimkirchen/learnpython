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

function membershipSchema(\PDO $db): bool
{
    return (int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn() >= 6;
}

function migrateMemberships(\PDO $db): void
{
    // Idempotent additive migration; no account, credential or learning state rewrite.
    $db->exec(file_get_contents(dirname(__DIR__).'/membership-schema.sql'));
    $ignore=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE';
    $db->exec($ignore.' INTO class_memberships (user_id,class_id,created_at) SELECT id,class_id,created_at FROM users');
    $db->exec($ignore.' INTO email_confirmations (user_id,confirmed,updated_at) SELECT id,1,created_at FROM users');
    if(!$db->query('SELECT version FROM schema_migrations WHERE version=6')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (6,?)')->execute([time()]);
}

function classMemberCondition(\PDO $db): string
{
    // Primary-class fallback keeps old and new releases safe during a rolling switch.
    return membershipSchema($db)
        ? '(u.class_id=? OR EXISTS (SELECT 1 FROM class_memberships m WHERE m.user_id=u.id AND m.class_id=?))'
        : 'u.class_id=?';
}

function classMemberParams(\PDO $db, string $id): array
{
    return membershipSchema($db)?[$id,$id]:[$id];
}

function accountClasses(\PDO $db, string $id, bool $lock = false): array
{
    $extra=membershipSchema($db)?' OR EXISTS (SELECT 1 FROM class_memberships m WHERE m.user_id=u.id AND m.class_id=c.id)':'';
    $q=$db->prepare('SELECT c.id,COALESCE(t.display_name,c.name) AS name FROM users u JOIN classes c ON (c.id=u.class_id'.$extra.') LEFT JOIN teacher_classes t ON t.class_id=c.id WHERE u.id=? ORDER BY c.id'.($lock&&$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));
    $q->execute([$id]);return $q->fetchAll();
}

function emailConfirmed(\PDO $db, string $id): bool
{
    if(!membershipSchema($db))return true;
    $q=$db->prepare('SELECT confirmed FROM email_confirmations WHERE user_id=?');$q->execute([$id]);
    $value=$q->fetchColumn();return $value===false || (int)$value===1;
}

function setEmailConfirmed(\PDO $db, string $id, bool $confirmed): void
{
    if(!membershipSchema($db))return;
    $db->prepare($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'
        ? 'INSERT INTO email_confirmations (user_id,confirmed,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE confirmed=VALUES(confirmed),updated_at=VALUES(updated_at)'
        : 'INSERT INTO email_confirmations (user_id,confirmed,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET confirmed=excluded.confirmed,updated_at=excluded.updated_at')
        ->execute([$id,$confirmed?1:0,time()]);
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
    $q=$db->prepare('SELECT COUNT(*) FROM users u WHERE '.classMemberCondition($db).' AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id=u.id)');
    $q->execute(classMemberParams($db,$class['id']));$members=(int)$q->fetchColumn();
    $q=$db->prepare('SELECT COUNT(*) FROM pending_registrations WHERE class_id=? AND expires_at>?');
    $q->execute([$class['id'],$now]);$pending=(int)$q->fetchColumn();
    return ['id'=>$class['id'],'name'=>$class['name'],'capacity'=>(int)$class['capacity'],'members'=>$members,'pending'=>$pending,
        'free'=>max(0,(int)$class['capacity']-$members-$pending),'invitation'=>visibleInvitation($db,$config,$class['id'],$now)];
}

function teacherClasses(\PDO $db, array $config, array $user): array
{
    $shared=rolesSchema($db)?' OR EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id=t.class_id AND ct.user_id=?)':'';
    $q=$db->prepare('SELECT t.class_id AS id,t.display_name AS name,r.capacity,t.teacher_id AS ownerId FROM teacher_classes t JOIN class_registration r ON r.class_id=t.class_id WHERE t.teacher_id=?'.$shared.' ORDER BY t.display_name');
    $q->execute(rolesSchema($db)?[$user['id'],$user['id']]:[$user['id']]);$classes=$q->fetchAll();$now=time();
    return ['profile'=>$user,'classLimit'=>$user['teacher']['classLimit'],'serverTime'=>$now,
        'ownedCount'=>count(array_filter($classes,fn($c)=>$c['ownerId']===$user['id'])),
        'classes'=>array_map(fn($c)=>classSummary($db,$config,$c,$now)+['isOwner'=>$c['ownerId']===$user['id']],$classes)];
}

function teacherClass(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['classId']);$class=classAccess($db,$user['id'],$body['classId']);$now=time();
    // Only completion IDs, never student source code, password hashes or verification tokens.
    $q=$db->prepare('SELECT u.id,u.display_name AS name,u.email,u.active,s.document FROM users u LEFT JOIN learning_states s ON s.user_id=u.id WHERE '.classMemberCondition($db).' ORDER BY u.display_name,u.email');
    $q->execute(classMemberParams($db,$class['id']));$members=[];
    foreach($q->fetchAll() as $row) {
        $document=$row['document']===null ? null : json_decode($row['document'],true,20,JSON_THROW_ON_ERROR);
        $completed=$document['completedCodes'] ?? null;
        $members[]=['id'=>$row['id'],'name'=>$row['name'],'email'=>$row['email'],'status'=>(int)$row['active'] ? (emailConfirmed($db,$row['id'])?'confirmed':'unverified'):'inactive',
            'isTeacher'=>(bool)teacherProfile($db,$row['id']),
            'otherClasses'=>array_values(array_filter(accountClasses($db,$row['id']),fn($c)=>$c['id']!==$class['id'])),
            'completedIds'=>is_array($completed) ? array_keys(array_filter($completed,'is_string')) : null,
            'unlockedIds'=>array_values(array_filter($document['unlockedIds']??[],'is_string'))];
    }
    $q=$db->prepare('SELECT id,display_name AS name,email FROM pending_registrations WHERE class_id=? AND expires_at>? ORDER BY display_name,email');
    $q->execute([$class['id'],$now]);
    foreach($q->fetchAll() as $row)$members[]=$row+['status'=>'pending','completedIds'=>null];
    return ['profile'=>$user,'class'=>classSummary($db,$config,$class,$now)+['isOwner'=>$class['isOwner'],'ownerName'=>$class['ownerName'],'ownerEmail'=>$class['ownerEmail'],'schoolDomain'=>$class['schoolDomain'],'teachers'=>classTeacherList($db,$class['id'])],'members'=>$members,'serverTime'=>$now];
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
        $domain=strtolower(substr(strrchr($user['email'],'@'),1));$nameKey=classNameKey($name);
        $q=$db->prepare('SELECT class_id FROM class_namespaces WHERE school_domain=? AND name_key=?');$q->execute([$domain,$nameKey]);
        if($q->fetchColumn())throw new ApiError(409,'CLASS_NAME_TAKEN');
        $id=bin2hex(random_bytes(16));$now=time();
        // Public names are unique within the original school domain, not the current owner.
        $db->prepare('INSERT INTO classes (id,name,created_at) VALUES (?,?,?)')->execute([$id,'class-'.$id,$now]);
        $db->prepare('INSERT INTO class_registration (class_id) VALUES (?)')->execute([$id]);
        $db->prepare('INSERT INTO teacher_classes (class_id,teacher_id,display_name) VALUES (?,?,?)')->execute([$id,$user['id'],$name]);
        try{$db->prepare('INSERT INTO class_namespaces (class_id,school_domain,name_key) VALUES (?,?,?)')->execute([$id,$domain,$nameKey]);}
        catch(\PDOException $e){if(in_array($e->getCode(),['23000','23505'],true))throw new ApiError(409,'CLASS_NAME_TAKEN');throw $e;}
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

function lockStudentMember(\PDO $db, string $classId, mixed $id, bool $allowTeacherRemoval=false): array
{
    if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(404,'MEMBER_NOT_FOUND');
    $db->prepare('UPDATE users SET active=active WHERE id=?')->execute([$id]);
    $q=$db->prepare('SELECT u.id,u.email,u.display_name AS name FROM users u WHERE u.id=? AND '.classMemberCondition($db).($allowTeacherRemoval?'':' AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id=u.id)').($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));
    $q->execute([$id,...classMemberParams($db,$classId)]);
    return $q->fetch() ?: throw new ApiError(404,'MEMBER_NOT_FOUND');
}

function removeClassMembership(\PDO $db, string $id, string $classId): void
{
    $classes=accountClasses($db,$id,true);
    $others=array_values(array_filter($classes,fn($c)=>$c['id']!==$classId));
    if($others){
        // Move the legacy primary reference before deleting a class. Keep all learning data.
        $db->prepare('UPDATE users SET class_id=? WHERE id=? AND class_id=?')->execute([$others[0]['id'],$id,$classId]);
        $db->prepare('DELETE FROM class_memberships WHERE user_id=? AND class_id=?')->execute([$id,$classId]);
    }else{
        if(teacherProfile($db,$id))throw new ApiError(409,'PROTECTED_TEACHER_ACCOUNT');
        $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
    }
}

function previewTeacherDeletion(\PDO $db, array $config, array $user, array $body): array
{
    $result=teacherClass($db,$config,$user,$body);
    return ['profile'=>$user,'class'=>$result['class'],'protectedMembers'=>array_values(array_filter($result['members'],fn($m)=>!empty($m['otherClasses'])))];
}

function changeTeacherEmail(\PDO $db, array $config, array $user, array $body, bool $confirmOnly): array
{
    exactFields($body,$confirmOnly?['classId','memberId','email']:['classId','memberId','email','previousEmail','name']);
    classAccess($db,$user['id'],$body['classId']);
    $email=normalizedEmail($body['email']);
    if(!$confirmOnly){try{$name=accountLabel($body['name']);}catch(\RuntimeException){throw new ApiError(422,'INVALID_NAME');}}
    $db->beginTransaction();
    try{
        lockTeacher($db,$user['id']);classAccess($db,$user['id'],$body['classId']);lockRegistrationClass($db,$body['classId']);
        $member=lockStudentMember($db,$body['classId'],$body['memberId']);
        if($member['email']!==($confirmOnly?$email:$body['previousEmail']))throw new ApiError(409,'MEMBER_CHANGED');
        if($confirmOnly){
            setEmailConfirmed($db,$member['id'],true);
        }else{
            if($email!==$member['email']){
                $q=$db->prepare('SELECT id FROM users WHERE email=? UNION ALL SELECT id FROM pending_registrations WHERE email=?');
                $q->execute([$email,$email]);if($q->fetchColumn())throw new ApiError(409,'EMAIL_UNAVAILABLE');
                $db->prepare('UPDATE users SET email=? WHERE id=?')->execute([$email,$member['id']]);
                setEmailConfirmed($db,$member['id'],false);
                // Revocation and address replacement are one transaction; state is untouched.
                $db->prepare($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'
                    ? 'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON DUPLICATE KEY UPDATE revision=revision+1'
                    : 'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1')->execute([$member['id']]);
                $db->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$member['id']]);
                $db->prepare('DELETE FROM recovery_mail_jobs WHERE user_id=?')->execute([$member['id']]);
            }
            $db->prepare('UPDATE users SET display_name=? WHERE id=?')->execute([$name,$member['id']]);
        }
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')
            ->execute([bin2hex(random_bytes(16)),$user['id'],$body['classId'],$confirmOnly?'email-confirmed':'member-updated',time()]);
        $db->commit();
    }catch(\PDOException $e){
        if($db->inTransaction())$db->rollBack();
        if(in_array($e->getCode(),['23000','23505'],true))throw new ApiError(409,'EMAIL_UNAVAILABLE');
        throw $e;
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,['classId'=>$body['classId']]);
}

function deleteTeacherClass(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['classId','confirmation','deleteClass','deleteExclusiveAccounts']);
    if($body['confirmation']!=='LÖSCHEN'||$body['deleteClass']!==true||$body['deleteExclusiveAccounts']!==true)throw new ApiError(422,'DELETE_CONFIRMATION_REQUIRED');
    ownClass($db,$user['id'],$body['classId']);
    $db->beginTransaction();
    try {
        lockTeacher($db,$user['id']);
        ownClass($db,$user['id'],$body['classId']);
        lockRegistrationClass($db,$body['classId']);
        // Lock the actual current member set, not the earlier confirmation preview.
        $q=$db->prepare('SELECT u.id FROM users u WHERE '.classMemberCondition($db).' ORDER BY u.id'.($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));
        $q->execute(classMemberParams($db,$body['classId']));
        foreach($q->fetchAll(\PDO::FETCH_COLUMN) as $id)removeClassMembership($db,$id,$body['classId']);
        // Class cascades revoke invitations and pending registrations only for this class.
        $db->prepare('DELETE FROM classes WHERE id=?')->execute([$body['classId']]);
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')
            ->execute([bin2hex(random_bytes(16)),$user['id'],$body['classId'],'class-deleted',time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClasses($db,$config,$user);
}

function deleteTeacherMember(\PDO $db, array $config, array $user, array $body): array
{
    exactFields($body,['classId','memberId','kind']);
    if(!is_string($body['memberId']) || !preg_match('/^[a-f0-9]{32}$/D',$body['memberId']) || !in_array($body['kind'],['user','pending'],true))throw new ApiError(404,'MEMBER_NOT_FOUND');
    ownClass($db,$user['id'],$body['classId']);
    $db->beginTransaction();
    try {
        lockTeacher($db,$user['id']);ownClass($db,$user['id'],$body['classId']);lockRegistrationClass($db,$body['classId']);
        if($body['kind']==='pending'){
            $q=$db->prepare('DELETE FROM pending_registrations WHERE id=? AND class_id=?');
        $q->execute([$body['memberId'],$body['classId']]);
            if($q->rowCount()!==1)throw new ApiError(404,'MEMBER_NOT_FOUND');
        }else{
            lockStudentMember($db,$body['classId'],$body['memberId'],true);
            removeClassMembership($db,$body['memberId'],$body['classId']);
        }
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')
            ->execute([bin2hex(random_bytes(16)),$user['id'],$body['classId'],'member-deleted',time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,['classId'=>$body['classId']]);
}
