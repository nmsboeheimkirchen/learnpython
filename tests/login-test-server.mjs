// Disposable, localhost-only packaged app for browser integration tests. Never deploy.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHostingerRelease } from '../scripts/build-hostinger-release.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portable = join(root, '.cache/php-runtime/php-8.5.10/php.exe');
const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
const phpArgs = php === portable ? ['-n', '-d', `extension_dir=${dirname(php)}/ext`, '-d', 'extension=pdo_sqlite', '-d', 'extension=openssl'] : [];
mkdirSync(join(root, '.cache'), { recursive: true });
const temp = mkdtempSync(join(root, '.cache/login-browser-'));
const webroot = join(temp, 'public_html');
const release = join(temp, 'agentpy-private/releases/browser-test');
// Legacy runtime tests exercise documents directly. shell.spec opens the actual shell.
buildHostingerRelease({ destination: release, releaseId: 'browser-test', shell: false });
cpSync(join(release, 'public'), webroot, { recursive: true });
// Disposable localhost configuration only; production credentials never enter tests.
writeFileSync(join(temp, 'agentpy-private/config.php'), '<?php return [];');
writeFileSync(join(temp, 'agentpy-private/database-password.txt'), 'Synthetic-not-public');
mkdirSync(join(temp, 'sessions'));
const env = { ...process.env, AGENTPY_CONFIG: '', AGENTPY_ENVIRONMENT: 'development',
    AGENTPY_ORIGIN: 'http://127.0.0.1:4174', AGENTPY_DSN: `sqlite:${join(temp, 'browser_test.sqlite')}`,
    AGENTPY_DB_USER: '', AGENTPY_DB_PASSWORD: '', AGENTPY_SESSION_PATH: join(temp, 'sessions') };
Object.assign(env, { AGENTPY_REGISTRATION_ENABLED: 'true', AGENTPY_PASSWORD_RESET_ENABLED: 'true', AGENTPY_MAIL_TRANSPORT: 'test', AGENTPY_MAIL_FROM: 'noreply@example.test' });
env.AGENTPY_TEACHER_KEY_FILE=join(temp,'agentpy-private/teacher-code-key.bin');
writeFileSync(join(root, '.cache/login-browser-fixture.json'), JSON.stringify({ dsn: env.AGENTPY_DSN, sessions: env.AGENTPY_SESSION_PATH }));
function manage(command, input = {}) {
    const result = spawnSync(php, [...phpArgs, 'server/bin/manage.php', command], { cwd: root, env, input: JSON.stringify(input), encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(`Test fixture setup failed: ${result.stderr || result.error}`);
    return result.stdout;
}
manage('migrate');
const classInfo = JSON.parse(manage('create-class', { name: 'Browser Test' }));
manage('create-invitation', { classId: classInfo.id, code: 'CTEST', expiresAt: Math.floor(Date.now()/1000)+86400 });
for (const engine of ['login-chromium', 'login-webkit']) {
    // Shell cases use a separate fixture account. The full suite must not spend
    // the same student's ten-login throttle bucket across unrelated scenarios.
    for (const name of ['student-a', 'student-b', 'shell-student', 'recovery-student','polish-student','verification-student','mode-student','promote-student','transfer-student']) manage('create-user', { email: `${name}-${engine}@example.test`, password: 'Synthetic-browser-password-123!', name, classId: classInfo.id });
    for(const teacherName of ['teacher','membership-teacher','admin','mgmt-owner','mgmt-co','mgmt-admin','transfer-owner','transfer-target']){
    const teacher=JSON.parse(manage('create-user',{email:`${teacherName}-${engine}@example.test`,password:'Synthetic-browser-password-123!',name:teacherName.startsWith('mgmt-')?teacherName:'Michael Fixture',classId:classInfo.id}));
    const grant=spawnSync(php,[...phpArgs,'tests/backend-fixture.php','teacher-grant'],{cwd:root,env,input:JSON.stringify({id:teacher.id,limit:10}),encoding:'utf8',windowsHide:true});
    if(grant.status!==0)throw Error('Teacher fixture setup failed');
    if(teacherName==='admin'||teacherName==='mgmt-admin'){const result=spawnSync(php,[...phpArgs,'tests/backend-fixture.php','admin-grant'],{cwd:root,env,input:JSON.stringify({id:teacher.id}),encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error('Admin fixture setup failed');}
    }
}
const child = spawn(php, [...phpArgs, '-S', '127.0.0.1:4174', '-t', webroot], { env, cwd: root, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); });
child.on('exit', code => { process.exitCode = code || 0; });
