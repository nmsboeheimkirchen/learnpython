<?php
declare(strict_types=1);

use function AgentPy\{beginSession, config, currentUser, database, exactFields, jsonResponse, login, readBody, readState, requireMutation, requireUser, rotateSession, writeState, registrationPolicy, checkInvitation, registerStudent, verifyRegistration};
use AgentPy\ApiError;

// In the release layout private application files live alongside public/, not inside it.
ini_set('display_errors', '0');
require dirname(__DIR__, 2) . '/src/bootstrap.php';
try {
    $config = config();
    if ($config['secure_cookie'] && ($_SERVER['HTTPS'] ?? '') !== 'on') throw new ApiError(400, 'HTTPS_REQUIRED');
    $db = database($config);
    beginSession($config);
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (array_diff(array_keys($_GET), ['action'])) throw new ApiError(400, 'INVALID_QUERY');
    if ($method === 'GET' && $action === 'session') {
        jsonResponse(['profile' => currentUser($db), 'csrfToken' => $_SESSION['csrf'], 'registration' => registrationPolicy($config), 'recovery' => ['enabled' => $config['password_reset_enabled']]]);
    }
    if ($method === 'GET' && $action === 'state') {
        $user = requireUser($db);
        jsonResponse(['profile' => $user, 'state' => readState($db, $user['id'])]);
    }
    if ($method === 'GET' && $action === 'teacher-classes') {
        jsonResponse(\AgentPy\teacherClasses($db,$config,\AgentPy\requireTeacher($db)));
    }
    if ($method === 'GET' && $action === 'admin-teachers') jsonResponse(\AgentPy\adminTeachers($db,\AgentPy\requireSuperadmin($db)));
    if ($method === 'GET' && $action === 'admin-accounts') jsonResponse(\AgentPy\adminAccounts($db,\AgentPy\requireSuperadmin($db)));
    if ($method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    requireMutation($config);
    $body = readBody();
    if(in_array($action,['admin-revoke-teacher','admin-update-account','admin-delete-account'],true)){
        $user=\AgentPy\requireSuperadmin($db);
        jsonResponse(match($action){
            'admin-revoke-teacher'=>\AgentPy\adminRevokeTeacher($db,$user,$body),
            'admin-update-account'=>\AgentPy\adminUpdateAccount($db,$user,$body),
            'admin-delete-account'=>\AgentPy\deleteAccount($db,$user,$body,true)
        });
    }
    if($action==='delete-account')jsonResponse(\AgentPy\deleteAccount($db,requireUser($db),$body,false));
    if(in_array($action,['teacher-remove-teacher','teacher-leave-class','teacher-transfer-class'],true)){
        $user=\AgentPy\requireTeacher($db);
        $operation=match($action){'teacher-remove-teacher'=>'remove','teacher-leave-class'=>'leave','teacher-transfer-class'=>'transfer'};
        jsonResponse(\AgentPy\manageClassTeacher($db,$config,$user,$body,$operation));
    }
    if (in_array($action,['admin-invite-teacher','admin-teacher-limit'],true)) {
        $user=\AgentPy\requireSuperadmin($db);
        jsonResponse($action==='admin-invite-teacher'?\AgentPy\inviteTeacher($db,$config,$user,$body):\AgentPy\updateTeacherLimit($db,$user,$body));
    }
    if ($action==='teacher-invitation-info') jsonResponse(\AgentPy\teacherInvitationInfo($db,$body));
    if ($action==='accept-teacher-invitation') jsonResponse(\AgentPy\acceptTeacherInvitation($db,$body));
    if (in_array($action,['teacher-class','teacher-create-class','teacher-renew-code','teacher-delete-class','teacher-delete-member','teacher-delete-preview','teacher-confirm-email','teacher-update-member','teacher-candidates','teacher-add-teacher'],true)) {
        $user=\AgentPy\requireTeacher($db);
        jsonResponse(match($action){
            'teacher-class'=>\AgentPy\teacherClass($db,$config,$user,$body),
            'teacher-create-class'=>\AgentPy\createTeacherClass($db,$config,$user,$body),
            'teacher-renew-code'=>\AgentPy\renewTeacherCode($db,$config,$user,$body),
            'teacher-delete-class'=>\AgentPy\deleteTeacherClass($db,$config,$user,$body),
            'teacher-delete-member'=>\AgentPy\deleteTeacherMember($db,$config,$user,$body),
            'teacher-delete-preview'=>\AgentPy\previewTeacherDeletion($db,$config,$user,$body),
            'teacher-confirm-email'=>\AgentPy\changeTeacherEmail($db,$config,$user,$body,true),
            'teacher-update-member'=>\AgentPy\changeTeacherEmail($db,$config,$user,$body,false),
            'teacher-candidates'=>\AgentPy\teacherCandidates($db,$user,$body),
            'teacher-add-teacher'=>\AgentPy\addClassTeacher($db,$config,$user,$body)
        });
    }
    if ($action === 'check-invitation') jsonResponse(checkInvitation($db, $config, $body));
    if ($action === 'register') jsonResponse(registerStudent($db, $config, $body), 202);
    if ($action === 'verify-email') jsonResponse(verifyRegistration($db, $config, $body));
    if ($action === 'request-password-reset') jsonResponse(\AgentPy\requestPasswordReset($db,$config,$body),202);
    if ($action === 'reset-password') jsonResponse(\AgentPy\resetPassword($db,$config,$body));
    if ($action === 'cancel-registration') {
        exactFields($body, []);
        unset($_SESSION['registration_grant']); // Never reset code-failure/cooldown counters here.
        jsonResponse(['cancelled' => true]);
    }
    if ($action === 'login') {
        jsonResponse(['profile' => login($db, $body), 'csrfToken' => $_SESSION['csrf']]);
    }
    if ($action === 'logout') {
        requireUser($db);
        exactFields($body, []);
        rotateSession();
        jsonResponse(['profile' => null, 'csrfToken' => $_SESSION['csrf']]);
    }
    if ($action === 'write') {
        $user = requireUser($db);
        jsonResponse(['profile' => $user] + writeState($db, $user['id'], $body));
    }
    if ($action === 'update-profile') {
        $user = requireUser($db);
        exactFields($body, ['name']);
        try { $name = \AgentPy\accountLabel($body['name']); }
        catch (\RuntimeException) { throw new ApiError(422, 'INVALID_NAME'); }
        // Identity, email, class and learning state cannot be changed by this endpoint.
        $db->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$name, $user['id']]);
        jsonResponse(['profile' => currentUser($db)]);
    }
    throw new ApiError(404, 'NOT_FOUND');
} catch (ApiError $error) {
    if ($error->status === 429) header('Retry-After: ' . ($error->details['retryAfter'] ?? 900));
    jsonResponse(['error' => ['code' => $error->errorCode] + $error->details], $error->status);
} catch (Throwable $error) {
    // Never expose exception text, SQL, paths, credentials or submitted code to clients/logs.
    error_log('AgentPy API request failed: ' . get_class($error));
    jsonResponse(['error' => ['code' => 'SERVER_UNAVAILABLE']], 503);
}
