<?php
declare(strict_types=1);
namespace AgentPy;

function classNameKey(string $name): string
{
    // Stable across PHP installations, without depending on optional mbstring/intl.
    $name=preg_replace('/\s+/u',' ',trim($name));
    $name=strtolower(strtr($name,['Ä'=>'ä','Ö'=>'ö','Ü'=>'ü','ẞ'=>'ß']));
    return hash('sha256',$name);
}

function migrateManagement(\PDO $db): void
{
    if($db->query('SELECT version FROM schema_migrations WHERE version=8')->fetchColumn())return;
    $rows=$db->query('SELECT c.class_id,c.display_name,u.email FROM teacher_classes c JOIN users u ON u.id=c.teacher_id')->fetchAll();
    $seen=[];
    foreach($rows as $r){
        $key=strtolower(substr(strrchr($r['email'],'@'),1)).':'.classNameKey($r['display_name']);
        if(isset($seen[$key]))throw new \RuntimeException('Resolve existing school class-name conflicts before migration');
        $seen[$key]=true;
    }
    $db->exec(file_get_contents(dirname(__DIR__).'/management-schema.sql'));
    $mysql=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql';
    if($mysql){
        // The old owner/name constraint conflicts with cross-school admin takeovers.
        $indexes=$db->query("SELECT INDEX_NAME,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_classes' AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY' GROUP BY INDEX_NAME")->fetchAll();
        // Keep a non-unique index for the owner foreign key before dropping its UNIQUE.
        $has=$db->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_classes' AND INDEX_NAME='teacher_owner_lookup'")->fetchColumn();
        if(!$has)$db->exec('CREATE INDEX teacher_owner_lookup ON teacher_classes (teacher_id)');
        foreach($indexes as $i)if($i['cols']==='teacher_id,display_name')$db->exec('ALTER TABLE teacher_classes DROP INDEX `'.str_replace('`','``',$i['INDEX_NAME']).'`');
    }else{
        // SQLite's documented rebuild sequence, outside any caller transaction.
        // Foreign-key children (including co-teachers) must never cascade during this rebuild.
        $db->exec('PRAGMA foreign_keys=OFF');
        try{
            $db->beginTransaction();
            $db->exec('CREATE TABLE teacher_classes_v8 (class_id VARCHAR(32) PRIMARY KEY,teacher_id VARCHAR(32) NOT NULL,display_name VARCHAR(100) NOT NULL,FOREIGN KEY(class_id) REFERENCES class_registration(class_id) ON DELETE CASCADE,FOREIGN KEY(teacher_id) REFERENCES teachers(user_id))');
            $db->exec('INSERT INTO teacher_classes_v8 SELECT class_id,teacher_id,display_name FROM teacher_classes');
            $db->exec('DROP TABLE teacher_classes');
            $db->exec('ALTER TABLE teacher_classes_v8 RENAME TO teacher_classes');
            $db->exec('CREATE INDEX teacher_owner_lookup ON teacher_classes (teacher_id)');
            if($db->query('PRAGMA foreign_key_check')->fetch())throw new \RuntimeException('Management migration foreign-key check failed');
            $db->commit();
        }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        finally{$db->exec('PRAGMA foreign_keys=ON');}
    }
    $db->beginTransaction();
    try{
        $ignore=$mysql?'INSERT IGNORE':'INSERT OR IGNORE';
        $insert=$db->prepare($ignore.' INTO class_namespaces (class_id,school_domain,name_key) VALUES (?,?,?)');
        foreach($rows as $r)$insert->execute([$r['class_id'],strtolower(substr(strrchr($r['email'],'@'),1)),classNameKey($r['display_name'])]);
        $db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (8,?)')->execute([time()]);$db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

function ownedClassCount(\PDO $db,string $id): int
{
    $q=$db->prepare('SELECT COUNT(*) FROM teacher_classes WHERE teacher_id=?');$q->execute([$id]);return (int)$q->fetchColumn();
}

function revokeAccountSessions(\PDO $db,string $id): void
{
    $db->prepare($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'
        ?'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON DUPLICATE KEY UPDATE revision=revision+1'
        :'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1')->execute([$id]);
}

function lockAccount(\PDO $db,mixed $id): array
{
    if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(404,'MEMBER_NOT_FOUND');
    $db->prepare('UPDATE users SET active=active WHERE id=?')->execute([$id]);
    $q=$db->prepare('SELECT id,email,display_name AS name,class_id,password_hash FROM users WHERE id=?');$q->execute([$id]);
    return $q->fetch()?:throw new ApiError(404,'MEMBER_NOT_FOUND');
}

function manageClassTeacher(\PDO $db,array $config,array $user,array $body,string $action): array
{
    exactFields($body,$action==='leave'?['classId']:['classId','memberId']);
    $db->beginTransaction();
    try{
        // All participants are locked in stable ID order to serialize transfers/revocations.
        $ids=[$user['id']];if($action==='transfer')$ids[]=(string)$body['memberId'];sort($ids);
        foreach(array_unique($ids) as $id)lockTeacher($db,$id);
        lockRegistrationClass($db,(string)$body['classId']);
        $c=classAccess($db,$user['id'],$body['classId']);
        if($action==='leave'){
            if($c['isOwner'])throw new ApiError(409,'CLASS_OWNER_CANNOT_LEAVE');
            $target=$user['id'];
        }else{
            if(!$c['isOwner'])throw new ApiError(404,'CLASS_NOT_FOUND');
            $target=$body['memberId'];
            if(!is_string($target)||!in_array($target,array_column(classTeacherList($db,$c['id']),'id'),true))throw new ApiError(422,'TEACHER_NOT_AVAILABLE');
        }
        if($action==='transfer'){
            $limit=lockTeacher($db,$target);
            if(ownedClassCount($db,$target)>=$limit)throw new ApiError(409,'TARGET_CLASS_LIMIT_REACHED');
            $db->prepare('UPDATE teacher_classes SET teacher_id=? WHERE class_id=?')->execute([$target,$c['id']]);
            $db->prepare('INSERT INTO class_teachers (class_id,user_id,created_at) VALUES (?,?,?)')->execute([$c['id'],$user['id'],time()]);
        }
        $db->prepare('DELETE FROM class_teachers WHERE class_id=? AND user_id=?')->execute([$c['id'],$target]);
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$user['id'],$c['id'],'teacher-'.$action,time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return $action==='leave'?teacherClasses($db,$config,$user):teacherClass($db,$config,$user,['classId'=>$c['id']]);
}

function removeTeacherRole(\PDO $db,array $admin,string $id,bool $deleteAccount): void
{
    // Caller holds the admin/teacher locks and transaction; do not expose this as a public helper endpoint.
    if(isSuperadmin($db,$id))throw new ApiError(409,'PROTECTED_ADMIN');
    lockTeacher($db,$id);$member=lockAccount($db,$id);
    // Forced takeover intentionally bypasses quota. School namespace and all pupil data stay intact.
    $q=$db->prepare('SELECT class_id FROM teacher_classes WHERE teacher_id=? ORDER BY class_id');$q->execute([$id]);
    foreach($q->fetchAll(\PDO::FETCH_COLUMN) as $class){
        lockRegistrationClass($db,$class);
        $db->prepare('DELETE FROM class_teachers WHERE class_id=? AND user_id=?')->execute([$class,$admin['id']]);
        $db->prepare('UPDATE teacher_classes SET teacher_id=? WHERE class_id=?')->execute([$admin['id'],$class]);
    }
    $db->prepare('DELETE FROM teachers WHERE user_id=?')->execute([$id]); // shared teaching access cascades
    $db->prepare('DELETE FROM teacher_invitations WHERE email=?')->execute([$member['email']]);
    if($deleteAccount){$db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);return;}
    $q=$db->prepare('SELECT id FROM classes WHERE name=?');$q->execute(['Lehrer:innen']);$group=$q->fetchColumn();
    if($group){
        $others=array_values(array_filter(accountClasses($db,$id),fn($c)=>$c['id']!==$group));
        if(!$others){
            // Neutral holding group grants NO class/teacher access, preserves a usable pupil account.
            $q=$db->prepare('SELECT id FROM classes WHERE name=?');$q->execute(['Ohne Klasse']);$fallback=$q->fetchColumn();
            if(!$fallback){$fallback=bin2hex(random_bytes(16));$db->prepare('INSERT INTO classes (id,name,created_at) VALUES (?,?,?)')->execute([$fallback,'Ohne Klasse',time()]);}
            $others=[['id'=>$fallback]];
        }
        $db->prepare('UPDATE users SET class_id=? WHERE id=? AND class_id=?')->execute([$others[0]['id'],$id,$group]);
        $db->prepare('DELETE FROM class_memberships WHERE user_id=? AND class_id=?')->execute([$id,$group]);
    }
    revokeAccountSessions($db,$id);
}

function adminRevokeTeacher(\PDO $db,array $user,array $body): array
{
    exactFields($body,['memberId','deleteAccount']);if(!is_bool($body['deleteAccount']))throw new ApiError(422,'INVALID_FIELDS');
    $db->beginTransaction();
    try{lockSuperadmin($db,$user['id']);lockTeacher($db,$user['id']);removeTeacherRole($db,$user,(string)$body['memberId'],$body['deleteAccount']);$db->commit();}
    catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return adminTeachers($db,$user);
}

function adminAccounts(\PDO $db,array $user): array
{
    if(!isSuperadmin($db,$user['id']))throw new ApiError(403,'ADMIN_REQUIRED');
    $rows=$db->query('SELECT id,display_name AS name,email,active FROM users ORDER BY display_name,email')->fetchAll();
    foreach($rows as &$row){
        $row['classes']=accountClasses($db,$row['id']);$row['isTeacher']=(bool)teacherProfile($db,$row['id']);$row['superadmin']=isSuperadmin($db,$row['id']);
        $q=$db->prepare('SELECT t.class_id AS id,t.display_name AS name,t.teacher_id FROM teacher_classes t WHERE t.teacher_id=? OR EXISTS (SELECT 1 FROM class_teachers c WHERE c.class_id=t.class_id AND c.user_id=?) ORDER BY t.display_name');
        $q->execute([$row['id'],$row['id']]);$row['teachingClasses']=array_map(fn($c)=>['id'=>$c['id'],'name'=>$c['name'],'isOwner'=>$c['teacher_id']===$row['id']],$q->fetchAll());
    }unset($row);
    return ['profile'=>$user,'accounts'=>$rows];
}

function adminUpdateAccount(\PDO $db,array $user,array $body): array
{
    exactFields($body,['memberId','previousEmail','email','name']);$email=normalizedEmail($body['email']);
    try{$name=accountLabel($body['name']);}catch(\RuntimeException){throw new ApiError(422,'INVALID_NAME');}
    $db->beginTransaction();
    try{
        lockSuperadmin($db,$user['id']);$member=lockAccount($db,$body['memberId']);
        // Keep the only administrator's login stable; own display name remains editable in account info.
        if(isSuperadmin($db,$member['id']))throw new ApiError(409,'PROTECTED_ADMIN');
        if($member['email']!==$body['previousEmail'])throw new ApiError(409,'MEMBER_CHANGED');
        if($member['email']!==$email){
            $q=$db->prepare('SELECT id FROM users WHERE email=? UNION ALL SELECT id FROM pending_registrations WHERE email=?');$q->execute([$email,$email]);
            if($q->fetchColumn())throw new ApiError(409,'EMAIL_UNAVAILABLE');
            // Cancel invitations for either identity so old links cannot unexpectedly change roles.
            $db->prepare('DELETE FROM teacher_invitations WHERE email=? OR email=?')->execute([$member['email'],$email]);
            $db->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$member['id']]);
            $db->prepare('DELETE FROM recovery_mail_jobs WHERE user_id=?')->execute([$member['id']]);
            setEmailConfirmed($db,$member['id'],false);revokeAccountSessions($db,$member['id']);
        }
        $db->prepare('UPDATE users SET display_name=?,email=? WHERE id=?')->execute([$name,$email,$member['id']]);$db->commit();
    }catch(\PDOException $e){if($db->inTransaction())$db->rollBack();if(in_array($e->getCode(),['23000','23505'],true))throw new ApiError(409,'EMAIL_UNAVAILABLE');throw $e;}
    catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return adminAccounts($db,$user);
}

function deleteAccount(\PDO $db,array $user,array $body,bool $admin): array
{
    exactFields($body,$admin?['memberId','confirmation']:['password','confirmation']);
    if($body['confirmation']!==true)throw new ApiError(422,'DELETE_CONFIRMATION_REQUIRED');
    $id=$admin?$body['memberId']:$user['id'];
    if(!$admin)throttle($db,'delete-account:'.$user['id'],10);
    $db->beginTransaction();
    try{
        if($admin){lockSuperadmin($db,$user['id']);lockTeacher($db,$user['id']);}
        if(isSuperadmin($db,(string)$id))throw new ApiError(409,'PROTECTED_ADMIN');
        if(teacherProfile($db,(string)$id))lockTeacher($db,(string)$id);
        $member=lockAccount($db,$id);
        if(!$admin){
            if(!is_string($body['password'])||!password_verify($body['password'],$member['password_hash']))throw new ApiError(422,'PASSWORD_CHECK_FAILED');
            if(ownedClassCount($db,$id)>0)throw new ApiError(409,'ACCOUNT_OWNS_CLASSES');
        }
        if(teacherProfile($db,$id)){
            if($admin)removeTeacherRole($db,$user,$id,true);
            else{$db->prepare('DELETE FROM teachers WHERE user_id=?')->execute([$id]);$db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);}
        }else $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
        $db->prepare('DELETE FROM teacher_invitations WHERE email=?')->execute([$member['email']]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    if($admin)return adminAccounts($db,$user);
    rotateSession();return ['profile'=>null,'csrfToken'=>$_SESSION['csrf'],'deleted'=>true];
}
