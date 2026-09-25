<?php
declare(strict_types=1);
namespace AgentPy;

function rolesSchema(\PDO $db): bool
{
    return (bool)$db->query('SELECT version FROM schema_migrations WHERE version=7')->fetchColumn();
}

function migrateRoles(\PDO $db): void
{
    $db->exec(file_get_contents(dirname(__DIR__).'/roles-schema.sql'));
    if(!rolesSchema($db))$db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (7,?)')->execute([time()]);
}

function isSuperadmin(\PDO $db, string $id): bool
{
    if(!rolesSchema($db))return false;
    $q=$db->prepare('SELECT user_id FROM superadmins WHERE user_id=?');$q->execute([$id]);return (bool)$q->fetchColumn();
}

function requireSuperadmin(\PDO $db): array
{
    $user=requireTeacher($db);
    if(!isSuperadmin($db,$user['id']))throw new ApiError(403,'ADMIN_REQUIRED');
    return $user;
}

function lockSuperadmin(\PDO $db, string $id): void
{
    $q=$db->prepare('SELECT user_id FROM superadmins WHERE user_id=?'.($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));
    $q->execute([$id]);if(!$q->fetchColumn())throw new ApiError(403,'ADMIN_REQUIRED');
}

function classAccess(\PDO $db, string $teacher, mixed $classId): array
{
    if(!is_string($classId)||!preg_match('/^[a-f0-9]{32}$/D',$classId))throw new ApiError(404,'CLASS_NOT_FOUND');
    $shared=rolesSchema($db)?' OR EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id=t.class_id AND ct.user_id=?)':'';
    $q=$db->prepare('SELECT t.class_id AS id,t.display_name AS name,r.capacity,t.teacher_id AS ownerId,u.display_name AS ownerName,u.email AS ownerEmail,n.school_domain AS schoolDomain FROM teacher_classes t JOIN class_registration r ON r.class_id=t.class_id JOIN users u ON u.id=t.teacher_id LEFT JOIN class_namespaces n ON n.class_id=t.class_id WHERE t.class_id=? AND (t.teacher_id=?'.$shared.')');
    $q->execute(rolesSchema($db)?[$classId,$teacher,$teacher]:[$classId,$teacher]);
    $row=$q->fetch()?:throw new ApiError(404,'CLASS_NOT_FOUND');$row['isOwner']=$row['ownerId']===$teacher;return $row;
}

function classTeacherList(\PDO $db, string $classId): array
{
    if(!rolesSchema($db))return [];
    $q=$db->prepare('SELECT u.id,u.display_name AS name,u.email FROM class_teachers ct JOIN users u ON u.id=ct.user_id WHERE ct.class_id=? ORDER BY u.display_name,u.email');
    $q->execute([$classId]);return $q->fetchAll();
}

function teacherCandidates(\PDO $db, array $user, array $body): array
{
    exactFields($body,['classId']);ownClass($db,$user['id'],$body['classId']);
    $q=$db->query('SELECT u.id,u.display_name AS name,u.email FROM teachers t JOIN users u ON u.id=t.user_id WHERE u.active=1 ORDER BY u.display_name,u.email');
    $assigned=array_column(classTeacherList($db,$body['classId']),'id');$domain=strrchr($user['email'],'@');
    $candidates=array_values(array_filter($q->fetchAll(),fn($u)=>$u['id']!==$user['id']&&!in_array($u['id'],$assigned,true)&&strrchr($u['email'],'@')===$domain));
    return ['profile'=>$user,'candidates'=>$candidates];
}

function addClassTeacher(\PDO $db,array $config,array $user,array $body): array
{
    exactFields($body,['classId','email']);$email=normalizedEmail($body['email']);
    $db->beginTransaction();
    try{
        lockTeacher($db,$user['id']);ownClass($db,$user['id'],$body['classId']);lockRegistrationClass($db,$body['classId']);
        $q=$db->prepare('SELECT u.id FROM teachers t JOIN users u ON u.id=t.user_id WHERE u.email=? AND u.active=1');$q->execute([$email]);$id=$q->fetchColumn();
        if(!$id||$id===$user['id'])throw new ApiError(422,'TEACHER_NOT_AVAILABLE');
        $ignore=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE';
        $db->prepare($ignore.' INTO class_teachers (class_id,user_id,created_at) VALUES (?,?,?)')->execute([$body['classId'],$id,time()]);
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$user['id'],$body['classId'],'teacher-added',time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,['classId'=>$body['classId']]);
}

function adminTeachers(\PDO $db,array $user): array
{
    if(!isSuperadmin($db,$user['id']))throw new ApiError(403,'ADMIN_REQUIRED');
    $teachers=$db->query('SELECT u.id,u.display_name AS name,u.email,t.class_limit AS classLimit,(SELECT COUNT(*) FROM teacher_classes c WHERE c.teacher_id=u.id) AS ownedClasses FROM teachers t JOIN users u ON u.id=t.user_id ORDER BY u.display_name,u.email')->fetchAll();
    foreach($teachers as &$t){$t['classLimit']=(int)$t['classLimit'];$t['ownedClasses']=(int)$t['ownedClasses'];$t['superadmin']=isSuperadmin($db,$t['id']);}unset($t);
    $q=$db->prepare('SELECT id,email,class_limit AS classLimit,expires_at AS expiresAt FROM teacher_invitations WHERE accepted_at=0 AND expires_at>? ORDER BY created_at');$q->execute([time()]);
    return ['profile'=>$user,'teachers'=>$teachers,'invitations'=>$q->fetchAll()];
}

function validClassLimit(mixed $limit): int
{
    if(!is_int($limit)||$limit<1||$limit>100)throw new ApiError(422,'INVALID_CLASS_LIMIT');return $limit;
}

function inviteTeacher(\PDO $db,array $config,array $user,array $body): array
{
    exactFields($body,['email','classLimit']);if(!$config['registration_enabled'])throw new ApiError(503,'REGISTRATION_UNAVAILABLE');
    $email=normalizedEmail($body['email']);$limit=validClassLimit($body['classLimit']);$now=time();
    $db->beginTransaction();
    try{
        lockSuperadmin($db,$user['id']);
        $q=$db->prepare('SELECT u.id FROM teachers t JOIN users u ON u.id=t.user_id WHERE u.email=?');$q->execute([$email]);
        if($q->fetchColumn())throw new ApiError(409,'ALREADY_TEACHER');
        $q=$db->prepare('SELECT id FROM pending_registrations WHERE email=? AND expires_at>?');$q->execute([$email,$now]);
        if($q->fetchColumn())throw new ApiError(409,'REGISTRATION_PENDING');
        $q=$db->prepare('SELECT id FROM teacher_invitations WHERE email=? AND accepted_at=0 AND expires_at>?');$q->execute([$email,$now]);
        if(!$q->fetchColumn()){
            $db->prepare('DELETE FROM teacher_invitations WHERE email=?')->execute([$email]);
            $id=bin2hex(random_bytes(16));$token=bin2hex(random_bytes(32));
            $db->prepare('INSERT INTO teacher_invitations (id,email,token_hash,class_limit,invited_by,expires_at,created_at) VALUES (?,?,?,?,?,?,?)')->execute([$id,$email,hash('sha256',$token),$limit,$user['id'],$now+864000,$now]);
            $db->prepare('INSERT INTO teacher_mail_jobs (id,invitation_id,token,available_at,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$id,$token,$now,$now]);
        }
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return adminTeachers($db,$user);
}

function updateTeacherLimit(\PDO $db,array $user,array $body): array
{
    exactFields($body,['memberId','classLimit']);$limit=validClassLimit($body['classLimit']);
    $db->beginTransaction();
    try{
        lockSuperadmin($db,$user['id']);lockTeacher($db,(string)$body['memberId']);
        $q=$db->prepare('SELECT COUNT(*) FROM teacher_classes WHERE teacher_id=?');$q->execute([$body['memberId']]);
        if((int)$q->fetchColumn()>$limit)throw new ApiError(409,'LIMIT_BELOW_USAGE');
        $db->prepare('UPDATE teachers SET class_limit=? WHERE user_id=?')->execute([$limit,$body['memberId']]);$db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return adminTeachers($db,$user);
}

function teacherInvitation(\PDO $db,mixed $token): array
{
    if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))throw new ApiError(422,'INVALID_TEACHER_INVITATION');
    $q=$db->prepare('SELECT * FROM teacher_invitations WHERE token_hash=? AND accepted_at=0 AND expires_at>?');$q->execute([hash('sha256',$token),time()]);
    return $q->fetch()?:throw new ApiError(422,'INVALID_TEACHER_INVITATION');
}

function teacherInvitationInfo(\PDO $db,array $body): array
{
    exactFields($body,['token']);registrationThrottle($db,'teacher-link',100);
    $i=teacherInvitation($db,$body['token']);$q=$db->prepare('SELECT id,display_name FROM users WHERE email=?');$q->execute([$i['email']]);$u=$q->fetch();
    return ['email'=>$i['email'],'name'=>$u?$u['display_name']:'','existing'=>(bool)$u,'classLimit'=>(int)$i['class_limit']];
}

function acceptTeacherInvitation(\PDO $db,array $body): array
{
    exactFields($body,['token','name','password','confirmation']);registrationThrottle($db,'teacher-accept',60);
    $i=teacherInvitation($db,$body['token']);$signedIn=currentUser($db);
    if($signedIn&&$signedIn['email']!==$i['email'])throw new ApiError(409,'ALREADY_SIGNED_IN');
    $db->beginTransaction();
    try{
        lockSuperadmin($db,$i['invited_by']);
        $q=$db->prepare('UPDATE teacher_invitations SET accepted_at=? WHERE id=? AND accepted_at=0 AND expires_at>?');$q->execute([time(),$i['id'],time()]);
        if($q->rowCount()!==1)throw new ApiError(422,'INVALID_TEACHER_INVITATION');
        $q=$db->prepare('SELECT id,active FROM users WHERE email=?'.($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':''));$q->execute([$i['email']]);$existing=$q->fetch();
        if($existing&&!(int)$existing['active'])throw new ApiError(409,'ACCOUNT_INACTIVE');
        $q=$db->prepare('SELECT id FROM classes WHERE name=?');$q->execute(['Lehrer:innen']);$group=$q->fetchColumn();
        if(!$group){$group=bin2hex(random_bytes(16));$db->prepare('INSERT INTO classes (id,name,created_at) VALUES (?,?,?)')->execute([$group,'Lehrer:innen',time()]);}
        if($existing){$id=$existing['id'];}
        else{
            if($body['password']!==$body['confirmation'])throw new ApiError(422,'PASSWORD_MISMATCH');
            validateNewPassword($body['password']);
            try{$name=accountLabel($body['name']);}catch(\RuntimeException){throw new ApiError(422,'INVALID_NAME');}
            $q=$db->prepare('SELECT id FROM pending_registrations WHERE email=? AND expires_at>?');$q->execute([$i['email'],time()]);if($q->fetchColumn())throw new ApiError(409,'REGISTRATION_PENDING');
            $id=bin2hex(random_bytes(16));
            $db->prepare('INSERT INTO users (id,email,password_hash,display_name,class_id,created_at) VALUES (?,?,?,?,?,?)')->execute([$id,$i['email'],password_hash($body['password'],PASSWORD_BCRYPT,['cost'=>12]),$name,$group,time()]);
            $db->prepare('INSERT INTO learning_states (user_id,revision,document,updated_at) VALUES (?,0,?,?)')->execute([$id,json_encode(emptyState(),JSON_THROW_ON_ERROR),time()]);
        }
        $ignore=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE';
        $db->prepare($ignore.' INTO teachers (user_id,class_limit) VALUES (?,?)')->execute([$id,(int)$i['class_limit']]);
        $db->prepare($ignore.' INTO class_memberships (user_id,class_id,created_at) VALUES (?,?,?)')->execute([$id,$group,time()]);
        setEmailConfirmed($db,$id,true);
        $db->prepare($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON DUPLICATE KEY UPDATE revision=revision+1':'INSERT INTO auth_epochs (user_id,revision) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1')->execute([$id]);
        $db->prepare('DELETE FROM teacher_mail_jobs WHERE invitation_id=?')->execute([$i['id']]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    // No automatic login or password reset; existing credentials and progress stay intact.
    return ['accepted'=>true];
}
