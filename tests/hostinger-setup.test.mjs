import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildHostingerRelease } from '../scripts/build-hostinger-release.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portable = join(repo, '.cache/php-runtime/php-8.5.10/php.exe');
const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
const phpArgs = php === portable ? ['-n'] : [];
const prepare = join(repo, 'server/bin/prepare-hostinger.php');
const verify = join(repo, 'server/bin/verify-hostinger-release.php');
const activate = join(repo, 'server/bin/activate-hostinger.php');
function run(args, env = {}) { return spawnSync(php, [...phpArgs, ...args], { cwd: repo, encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } }); }
function domain() {
    mkdirSync(join(repo, '.cache'), { recursive: true });
    const parent = mkdtempSync(join(repo, '.cache/hosting-setup-'));
    const root = join(parent, 'agentpy.example.test');
    mkdirSync(join(root, 'public_html'), { recursive: true });
    writeFileSync(join(root, 'public_html/default.php'), 'UNCHANGED');
    return root;
}
function init(root) { return run([prepare, root, 'https://agentpy.example.test', 'agentpy_test', 'agentpy_test']); }

test('stable mail cron follows the active release, records a private heartbeat and stops on rollback', () => {
    const root = domain(); assert.equal(init(root).status, 0);
    const privateRoot = join(root, 'agentpy-private');
    const worker = join(privateRoot, 'tools/mail-worker.php');
    cpSync(join(repo, 'server/bin/mail-worker.php'), worker);
    const active = join(root, 'public_html/release.json');
    const app = join(privateRoot, 'releases/worker-test/app/src'); mkdirSync(app, {recursive:true});
    writeFileSync(join(app, 'registration.php'), '<?php // fixture');
    writeFileSync(join(app, 'bootstrap.php'), `<?php namespace AgentPy;
        function config() { return ['registration_enabled'=>true,'mail_per_minute'=>10]; }
        function database($config) { return null; }
        function dispatchMail($db,$config) { static $n=0; return ++$n<=3; }`);
    writeFileSync(active, JSON.stringify({releaseId:'worker-test'}));
    const result = run([worker]); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).processed, 3);
    const status = join(privateRoot, 'mail-worker-status.json');
    assert.equal(JSON.parse(readFileSync(status)).releaseId, 'worker-test');
    if (process.platform !== 'win32') assert.equal(statSync(status).mode & 0o777, 0o600);
    mkdirSync(join(privateRoot, 'releases/old-test/app'), {recursive:true});
    writeFileSync(active, JSON.stringify({releaseId:'old-test'}));
    assert.equal(JSON.parse(run([worker]).stdout).processed, 0);
    writeFileSync(active, JSON.stringify({releaseId:'../../outside'}));
    assert.equal(run([worker]).status, 1);
    assert.equal(JSON.parse(readFileSync(status)).releaseId, 'old-test');
});

test('setup creates only private configuration and refuses to overwrite a password on rerun', () => {
    const root = domain(); const result = init(root);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const privateRoot = join(root, 'agentpy-private');
    const password = join(privateRoot, 'database-password.txt');
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
    assert.equal(existsSync(join(root, 'public_html/config.php')), false);
    assert.ok(existsSync(join(privateRoot, 'sessions')));
    if (process.platform !== 'win32') { assert.equal(statSync(privateRoot).mode & 0o777, 0o700); assert.equal(statSync(password).mode & 0o777, 0o600); }
    writeFileSync(password, 'Synthetic-password-never-overwrite');
    assert.equal(init(root).status, 1);
    assert.equal(readFileSync(password, 'utf8'), 'Synthetic-password-never-overwrite');
});

test('setup validates the website target before writing anything', () => {
    const root = domain();
    for (const args of [
        [root, 'http://agentpy.example.test', 'test', 'test'],
        [root, 'https://wrong.example.test', 'test', 'test'],
        [join(root, 'public_html'), 'https://agentpy.example.test', 'test', 'test'],
        [root, 'https://agentpy.example.test', 'bad;dbname=other', 'test'],
    ]) {
        assert.equal(run([prepare, ...args]).status, 1);
        assert.equal(existsSync(join(root, 'agentpy-private')), false);
    }
});

test('private password file is plain text, preserves special characters and fails closed while unconfigured', () => {
    const root = domain(); assert.equal(init(root).status, 0);
    const config = join(root, 'agentpy-private/config.php');
    const probe = 'try {$c=require getenv("TEST_CONFIG"); echo hash("sha256",$c["db_password"]);} catch(Throwable $e) {exit(2);}';
    assert.equal(run(['-r', probe], { TEST_CONFIG: config }).status, 2);
    const secret = ' Synthetic-only-"quote\'-$-\\-ü ';
    writeFileSync(join(root, 'agentpy-private/database-password.txt'), `${secret}\r\n`);
    const result = run(['-r', probe], { TEST_CONFIG: config });
    assert.equal(result.status, 0, result.stderr);
    const expected = run(['-r', 'echo hash("sha256",getenv("TEST_PASSWORD"));'], { TEST_PASSWORD: secret });
    assert.equal(result.stdout, expected.stdout);
    assert.ok(!result.stdout.includes(secret));
});

test('server verifies the full package and rejects tampering, extra files and path traversal', () => {
    const root = domain(); const release = join(root, 'release');
    buildHostingerRelease({ destination: release, releaseId: 'host-test' });
    const checked = run([verify, release]); assert.equal(checked.status, 0, checked.stderr);
    assert.equal(JSON.parse(checked.stdout).verified, true);
    const original = readFileSync(join(release, 'public/index.html'));
    writeFileSync(join(release, 'public/index.html'), 'tampered');
    assert.equal(run([verify, release]).status, 1);
    writeFileSync(join(release, 'public/index.html'), original);
    const manifestPath = join(release, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.files['app/../../secret'] = { bytes: 0, sha256: '0'.repeat(64) };
    writeFileSync(manifestPath, JSON.stringify(manifest)); assert.equal(run([verify, release]).status, 1);
    delete manifest.files['app/../../secret']; writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(join(release, 'public/unexpected.txt'), 'Synthetic-secret');
    assert.equal(run([verify, release]).status, 1);
});

test('packaged API fails closed without configuration and does not disclose server paths or secrets', () => {
    const root = domain(); assert.equal(init(root).status, 0);
    const release = join(root, 'agentpy-private/releases/wrapper-test');
    buildHostingerRelease({ destination: release, releaseId: 'wrapper-test' });
    cpSync(join(release, 'public'), join(root, 'public_html'), { recursive: true });
    const result = run([join(root, 'public_html/api/index.php')]);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).error.code, 'SERVER_UNAVAILABLE');
    assert.ok(!result.stdout.includes(root));
    assert.ok(!result.stdout.includes('REPLACE_WITH_DATABASE_PASSWORD'));
});

function deployment() {
    const root = domain(); assert.equal(init(root).status, 0);
    const release = join(root, 'agentpy-private/releases/deploy-test');
    buildHostingerRelease({ destination: release, releaseId: 'deploy-test' });
    return { root, release, privateRoot: join(root, 'agentpy-private') };
}
function deploy(root, action, id = 'deploy-test') { return run([activate, root, id, action]); }

test('activation retains the previous webroot, requires confirmation and rolls back without changing secrets', () => {
    const { root, privateRoot } = deployment();
    const secretPath = join(privateRoot, 'database-password.txt');
    writeFileSync(secretPath, 'Synthetic-password-must-survive');
    const result = deploy(root, 'activate'); assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.status, 'pending-healthcheck');
    assert.equal(readFileSync(join(privateRoot, 'backups', record.backup, 'default.php'), 'utf8'), 'UNCHANGED');
    assert.equal(existsSync(join(root, 'public_html/default.php')), false);
    assert.equal(deploy(root, 'activate').status, 1);
    assert.equal(deploy(root, 'confirm', 'wrong-release').status, 1);
    const confirmed = deploy(root, 'confirm'); assert.equal(confirmed.status, 0, confirmed.stderr);
    assert.equal(existsSync(join(privateRoot, 'deployment-pending.json')), false);
    const rollback = deploy(root, 'rollback'); assert.equal(rollback.status, 0, rollback.stderr);
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
    assert.equal(readFileSync(secretPath, 'utf8'), 'Synthetic-password-must-survive');
    assert.equal(deploy(root, 'rollback').status, 1, 'a repeated rollback must be refused');
});

test('activation refuses changed packages before touching the live website', () => {
    const { root, release } = deployment();
    writeFileSync(join(release, 'public/index.html'), 'bad package');
    assert.equal(deploy(root, 'activate').status, 1);
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
    assert.equal(existsSync(join(root, 'agentpy-private/deployment-pending.json')), false);
});

test('failed second rename restores the old website and leaves a recoverable journal', () => {
    const { root, privateRoot } = deployment();
    const script = 'require getenv("TEST_ACTIVATE"); $calls=0; try {AgentPy\\Deployment\\deploy(getenv("TEST_ROOT"),"deploy-test","activate",function($a,$b) use (&$calls) {return ++$calls === 2 ? false : rename($a,$b);}); exit(9);} catch(Throwable $e) {echo $e->getMessage();}';
    const result = run(['-r', script], { TEST_ACTIVATE: activate, TEST_ROOT: root });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'ACTIVATION_RENAME_FAILED');
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
    assert.ok(existsSync(join(privateRoot, 'deployment-pending.json')));
    assert.equal(deploy(root, 'rollback').status, 0);
    assert.equal(existsSync(join(privateRoot, 'deployment-pending.json')), false);
});

test('rollback recovers a process interrupted after moving the old webroot', () => {
    const { root, privateRoot } = deployment();
    const backup = 'web-20260917000000-0123456789';
    writeFileSync(join(privateRoot, 'deployment-pending.json'), JSON.stringify({ format: 1, releaseId: 'deploy-test', backup }));
    renameSync(join(root, 'public_html'), join(privateRoot, 'backups', backup));
    const result = deploy(root, 'rollback'); assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
});

test('confirmation refuses changed public files and rollback recovers the previous webroot', () => {
    const { root } = deployment(); assert.equal(deploy(root, 'activate').status, 0);
    writeFileSync(join(root, 'public_html/index.html'), 'unexpected change');
    assert.equal(deploy(root, 'confirm').status, 1);
    assert.equal(deploy(root, 'rollback').status, 0);
    assert.equal(readFileSync(join(root, 'public_html/default.php'), 'utf8'), 'UNCHANGED');
});
