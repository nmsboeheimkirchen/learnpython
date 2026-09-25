<?php
declare(strict_types=1);
namespace AgentPy;

function migrateTransfers(\PDO $db): void
{
    $db->exec(file_get_contents(dirname(__DIR__).'/transfer-schema.sql'));
    if(!$db->query('SELECT version FROM schema_migrations WHERE version=9')->fetchColumn())
        $db->prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (9,?)')->execute([time()]);
}

function cancelClassTransfers(\PDO $db,string $classId): void
{
    if($db->query('SELECT version FROM schema_migrations WHERE version=9')->fetchColumn())
        $db->prepare('DELETE FROM student_transfers WHERE source_class_id=? OR target_class_id=?')->execute([$classId,$classId]);
}

function transferClass(\PDO $db,mixed $id): array
{
    if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError(404,'CLASS_NOT_FOUND');
    $q=$db->prepare('SELECT t.class_id AS id,t.teacher_id AS ownerId,t.display_name AS name,r.capacity FROM teacher_classes t JOIN class_registration r ON r.class_id=t.class_id WHERE t.class_id=?');$q->execute([$id]);
    return $q->fetch()?:throw new ApiError(404,'CLASS_NOT_FOUND');
}

function transferTargets(\PDO $db,array $user,array $body): array
{
    exactFields($body,['classId']);ownClass($db,$user['id'],$body['classId']);
    $q=$db->prepare('SELECT class_id AS id,display_name AS name FROM teacher_classes WHERE teacher_id=? AND class_id<>? ORDER BY display_name');$q->execute([$user['id'],$body['classId']]);
    return ['profile'=>$user,'classes'=>$q->fetchAll()];
}

function pendingStudentTransfers(\PDO $db,array $user): array
{
    // Only involved owners see the pupil identity; never expose source code or passwords.
    $q=$db->prepare('SELECT r.id,r.mode,r.expires_at AS expiresAt,r.requested_by AS requestedBy,u.display_name AS name,u.email,s.display_name AS sourceName,t.display_name AS targetName,t.teacher_id AS targetOwner FROM student_transfers r JOIN users u ON u.id=r.user_id JOIN teacher_classes s ON s.class_id=r.source_class_id JOIN teacher_classes t ON t.class_id=r.target_class_id WHERE r.expires_at>? AND s.teacher_id=r.requested_by AND (r.requested_by=? OR t.teacher_id=?) ORDER BY r.created_at');
    $q->execute([time(),$user['id'],$user['id']]);
    $requests=array_map(fn($r)=>array_diff_key($r,['requestedBy'=>true,'targetOwner'=>true])+['incoming'=>$r['targetOwner']===$user['id']],$q->fetchAll());
    return ['profile'=>$user,'requests'=>$requests];
}

function applyStudentTransfer(\PDO $db,string $sourceId,array $target,string $memberId,string $mode): void
{
    // Caller owns both class locks + the pupil lock in a transaction. Add BEFORE remove.
    lockStudentMember($db,$sourceId,$memberId);
    $already=in_array($target['id'],array_column(accountClasses($db,$memberId),'id'),true);
    if(!$already && occupiedSeats($db,$target['id'],time())>=(int)$target['capacity'])throw new ApiError(409,'CLASS_FULL');
    $ignore=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE';
    $db->prepare($ignore.' INTO class_memberships (user_id,class_id,created_at) VALUES (?,?,?)')->execute([$memberId,$target['id'],time()]);
    if($mode==='move'){
        $db->prepare('UPDATE users SET class_id=? WHERE id=? AND class_id=?')->execute([$target['id'],$memberId,$sourceId]);
        $db->prepare('DELETE FROM class_memberships WHERE user_id=? AND class_id=?')->execute([$memberId,$sourceId]);
        $db->prepare('DELETE FROM student_transfers WHERE user_id=? AND source_class_id=?')->execute([$memberId,$sourceId]);
    }
    // Learning state, password, email verification, other memberships and roles are untouched.
}

function requestStudentTransfer(\PDO $db,array $config,array $user,array $body): array
{
    exactFields($body,['classId','memberId','targetClassId','code','mode']);
    if(!in_array($body['mode'],['move','add'],true)||!is_string($body['code'])||!is_string($body['targetClassId'])||($body['code']==='')===($body['targetClassId']===''))throw new ApiError(422,'INVALID_FIELDS');
    ownClass($db,$user['id'],$body['classId']);
    registrationThrottle($db,'pupil-transfer',100);
    $info=null;
    if($body['code']!==''){
        $code=strtoupper(trim($body['code']));
        $info=preg_match('/^[A-Z]{5}$/D',$code)?invitation($db,hash('sha256',$code),time()):null;
        if(!$info)throw new ApiError(422,'CLASS_CODE_INVALID');
        $target=transferClass($db,$info['class_id']);
    }else{
        // Arbitrary target IDs are not a discovery API. Foreign requests require a live code.
        ownClass($db,$user['id'],$body['targetClassId']);$target=transferClass($db,$body['targetClassId']);
    }
    if($target['id']===$body['classId'])throw new ApiError(422,'SAME_CLASS');
    $db->beginTransaction();
    try{
        $owners=[$user['id'],$target['ownerId']];sort($owners);foreach(array_unique($owners)as $id)lockTeacher($db,$id);
        $classes=[$body['classId'],$target['id']];sort($classes);foreach($classes as $id)lockRegistrationClass($db,$id);
        ownClass($db,$user['id'],$body['classId']);$current=transferClass($db,$target['id']);
        if($current['ownerId']!==$target['ownerId'])throw new ApiError(409,'TRANSFER_CHANGED');
        $target=$current; // Use capacity re-read under the class lock, not the preflight snapshot.
        if($info&&!invitation($db,hash('sha256',$code),time()))throw new ApiError(422,'CLASS_CODE_INVALID');
        $member=lockStudentMember($db,$body['classId'],$body['memberId']);
        $pending=$target['ownerId']!==$user['id'];
        if(!$pending)applyStudentTransfer($db,$body['classId'],$target,$member['id'],$body['mode']);
        else{
            $db->prepare('DELETE FROM student_transfers WHERE expires_at<=?')->execute([time()]);
            $q=$db->prepare('SELECT id,mode FROM student_transfers WHERE source_class_id=? AND target_class_id=? AND user_id=?');$q->execute([$body['classId'],$target['id'],$member['id']]);$existing=$q->fetch();
            if($existing&&$existing['mode']!==$body['mode'])throw new ApiError(409,'TRANSFER_ALREADY_PENDING');
            if(!$existing)$db->prepare('INSERT INTO student_transfers (id,source_class_id,target_class_id,user_id,requested_by,mode,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$body['classId'],$target['id'],$member['id'],$user['id'],$body['mode'],time()+864000,time()]);
        }
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$user['id'],$body['classId'],$pending?'pupil-transfer-request':'pupil-'.$body['mode'],time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClass($db,$config,$user,['classId'=>$body['classId']])+['pending'=>$pending,'targetName'=>$target['name']];
}

function decideStudentTransfer(\PDO $db,array $config,array $user,array $body): array
{
    exactFields($body,['requestId','decision']);
    if(!is_string($body['requestId'])||!in_array($body['decision'],['accept','decline','cancel'],true))throw new ApiError(422,'INVALID_FIELDS');
    $q=$db->prepare('SELECT * FROM student_transfers WHERE id=? AND expires_at>?');$q->execute([$body['requestId'],time()]);$r=$q->fetch()?:throw new ApiError(404,'TRANSFER_NOT_FOUND');$q->closeCursor();
    $target=transferClass($db,$r['target_class_id']);
    if(($body['decision']==='cancel'?$r['requested_by']:$target['ownerId'])!==$user['id'])throw new ApiError(404,'TRANSFER_NOT_FOUND');
    $db->beginTransaction();
    try{
        $owners=[$r['requested_by'],$target['ownerId']];sort($owners);foreach(array_unique($owners)as $id)lockTeacher($db,$id);
        $classes=[$r['source_class_id'],$r['target_class_id']];sort($classes);foreach($classes as $id)lockRegistrationClass($db,$id);
        ownClass($db,$r['requested_by'],$r['source_class_id']);$target=ownClass($db,$target['ownerId'],$r['target_class_id']);
        $q=$db->prepare('DELETE FROM student_transfers WHERE id=? AND expires_at>?');$q->execute([$r['id'],time()]);
        if($q->rowCount()!==1)throw new ApiError(404,'TRANSFER_NOT_FOUND');
        if($body['decision']==='accept')applyStudentTransfer($db,$r['source_class_id'],$target,$r['user_id'],$r['mode']);
        $db->prepare('INSERT INTO teacher_audit (id,teacher_id,class_id,action,created_at) VALUES (?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),$user['id'],$r['target_class_id'],'transfer-'.$body['decision'],time()]);
        $db->commit();
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    return teacherClasses($db,$config,$user);
}
