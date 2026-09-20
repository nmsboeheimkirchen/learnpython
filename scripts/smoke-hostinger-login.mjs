// Explicit live smoke test: creates two synthetic accounts, tests them, deletes only them.
// DB password stays on Hostinger. Generated test passwords and cookies stay in process memory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [releaseId] = process.argv.slice(2);
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(releaseId || '')) throw new Error('Release ID required');
const base = 'https://agentpy.bildungdigital.at';
const remoteRoot = '/home/u535472856/domains/agentpy.bildungdigital.at/agentpy-private';
const ssh = process.platform === 'win32' ? 'C:/Windows/System32/OpenSSH/ssh.exe' : 'ssh';
const keyDirectory = join(process.env.USERPROFILE || process.env.HOME, '.ssh');
const sshArgs = ['-F', process.platform === 'win32' ? 'NUL' : '/dev/null', '-T', '-p', '65002', '-i', join(keyDirectory, 'agentpy_hostinger'),
    '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'IdentityAgent=none', '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes',
    '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UpdateHostKeys=no',
    '-o', `UserKnownHostsFile=${join(keyDirectory, 'agentpy_hostinger_known_hosts')}`, '-o', 'ConnectTimeout=15', 'u535472856@195.35.49.40'];
function remote(command, input) {
    try { return execFileSync(ssh, [...sshArgs, command], { input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch { throw new Error('SSH test-account operation failed; details suppressed.'); }
}
const nonce = randomBytes(12).toString('hex');
const accounts = ['a', 'b'].map(letter => ({ email: `smoke-${letter}-${nonce}@example.test`, password: randomBytes(24).toString('hex') }));
const className = `smoke-${nonce}`;
const checks = [];
let stage = 'create-test-accounts';
class Session {
    cookie = ''; csrf = ''; profile = null;
    async call(action, body, extra = {}) {
        const headers = { ...(this.cookie ? { Cookie: this.cookie } : {}) };
        if (body !== undefined) Object.assign(headers, { 'Content-Type': 'application/json', Origin: base, 'X-CSRF-Token': this.csrf });
        if (this.profile) headers['X-Agentpy-Profile'] = this.profile.id;
        Object.assign(headers, extra);
        const response = await fetch(`${base}/api/index.php?action=${action}`, {
            method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body),
            redirect: 'error', signal: AbortSignal.timeout(15000),
        });
        const cookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-agentpy_session='));
        if (cookie) this.cookie = cookie.split(';')[0];
        const data = await response.json();
        if (data.csrfToken) this.csrf = data.csrfToken;
        return { status: response.status, data };
    }
    async login(account) {
        assert.equal((await this.call('session')).status, 200);
        const result = await this.call('login', account); assert.equal(result.status, 200);
        this.profile = result.data.profile;
    }
}
try {
    const testClass = JSON.parse(remote(`AGENTPY_CONFIG=${remoteRoot}/config.php /opt/alt/php83/usr/bin/php ${remoteRoot}/releases/${releaseId}/app/bin/manage.php create-class`, { name: className }));
    for (const account of accounts) remote(`AGENTPY_CONFIG=${remoteRoot}/config.php /opt/alt/php83/usr/bin/php ${remoteRoot}/releases/${releaseId}/app/bin/manage.php create-user`, { ...account, name: 'Synthetic smoke learner', classId: testClass.id });
    stage = 'login-and-write';
    const device1 = new Session(); const device2 = new Session(); const other = new Session();
    await device1.login(accounts[0]); await device2.login(accounts[0]); await other.login(accounts[1]);
    assert.equal(device1.profile.name, 'Synthetic smoke learner');
    assert.equal(device2.profile.className, className);
    const start = (await device1.call('state')).data.state;
    assert.equal(start.revision, 0);
    const code = 'print("Verbindung wird hergestellt...")\n# synthetischer Hostinger-Gerätewechseltest';
    const operation = { operationId: randomUUID(), expectedRevision: 0, command: { type: 'complete', levelId: 'mission1_level1', code } };
    const saved = await device1.call('write', operation); assert.equal(saved.status, 200); assert.equal(saved.data.state.revision, 1);
    const read = await device2.call('state'); assert.equal(read.status, 200);
    assert.equal(JSON.stringify(read.data.state), JSON.stringify(saved.data.state));
    assert.ok(JSON.stringify(read.data.state).includes(JSON.stringify(code).slice(1, -1)));
    checks.push('login', 'completion-save', 'second-device-read');
    stage = 'replay-conflict-and-isolation';
    const replay = await device1.call('write', operation); assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true); assert.equal(replay.data.state.revision, 1);
    const stale = await device2.call('write', { ...operation, operationId: randomUUID(), command: { type: 'attempt', levelId: 'mission1_level1', code: '# stale' } });
    assert.equal(stale.status, 409);
    const isolated = await other.call('state'); assert.equal(isolated.data.state.revision, 0);
    assert.ok(!JSON.stringify(isolated.data).includes('synthetischer Hostinger'));
    assert.equal((await other.call('state', undefined, { 'X-Agentpy-Profile': device1.profile.id })).status, 409);
    assert.equal((await device1.call('write', operation, { 'X-CSRF-Token': 'wrong' })).status, 403);
    checks.push('idempotent-retry', 'stale-write-rejected', 'account-isolation', 'csrf');
    stage = 'logout';
    assert.equal((await device1.call('logout', {})).status, 200); device1.profile = null;
    assert.equal((await device1.call('state')).status, 401);
    assert.equal((await device2.call('state')).status, 200);
    checks.push('logout', 'independent-device-session');
    stage = 'synthetic-browser-account-menu';
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({viewport:{width:1366,height:768}});
        await page.goto(base + '/', {waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Anmelden',exact:true}).click();
        await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(accounts[0].email);
        await page.getByLabel('Passwort',{exact:true}).fill(accounts[0].password);
        await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        const frame = page.frameLocator('#account-lesson');
        await page.locator('#account-lesson').evaluate(iframe=>{iframe.contentWindow.location.href='mission1_level1.html';});
        await expect(frame.locator('.CodeMirror')).toBeVisible();
        await page.locator('#account-lesson').evaluate(iframe=>{iframe.contentWindow.editor.setValue('# synthetic explicitly saved draft');});
        await page.getByRole('button',{name:'Benutzermenü'}).click();
        await page.getByRole('button',{name:'Code speichern',exact:true}).click();
        await expect(page.locator('.account-panel')).toContainText('Entwurf zentral gespeichert');
        const checked=(await device2.call('state')).data.state;
        assert.equal(checked.data.attemptedCodes.mission1_level1,'# synthetic explicitly saved draft');
        assert.equal(checked.data.completedCodes.mission1_level1,code);
        await page.getByRole('button',{name:'Fortschritt',exact:true}).click();
        await expect(page.getByRole('dialog')).toContainText('01-1');
        await expect(page.locator('.account-progress-number')).toHaveText('5 %');
        await page.getByRole('button',{name:'Schließen',exact:true}).click();
        await page.getByRole('button',{name:'Benutzermenü'}).click();
        await page.getByRole('button',{name:'Kontoinfo bearbeiten'}).click();
        await page.getByLabel('Anzeigename',{exact:true}).fill('Synthetic updated learner');
        await page.getByRole('button',{name:'Namen speichern'}).click();
        await expect(page.getByRole('dialog')).toContainText('Anzeigename gespeichert');
        await page.getByRole('button',{name:'Schließen',exact:true}).click();
        await page.getByRole('button',{name:'Benutzermenü'}).click();
        await page.getByRole('button',{name:'Abmelden',exact:true}).click();
        await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
        checks.push('browser-login-menu','explicit-draft-without-completion','progress-display','profile-name-edit','browser-logout');
    } finally { await browser.close(); }
} catch {
    console.error(`Live login smoke test failed at ${stage}; no credentials or response payloads logged.`);
    process.exitCode = 1;
} finally {
    // Only these freshly generated exact synthetic addresses; no cleanup of other accounts.
    const cleanup = `ini_set("display_errors","0"); try { require "${remoteRoot}/releases/${releaseId}/app/src/bootstrap.php"; $emails=json_decode(stream_get_contents(STDIN),true,10,JSON_THROW_ON_ERROR); if(!is_array($emails)||count($emails)!==2) throw new RuntimeException(); foreach($emails as $email) if(!preg_match("/^smoke-[ab]-[a-f0-9]{24}@example[.]test$/D",$email)) throw new RuntimeException(); $db=AgentPy\\database(AgentPy\\config()); if($db->query("SELECT DATABASE()")->fetchColumn()!=="u535472856_agentpy") throw new RuntimeException(); $db->beginTransaction(); $q=$db->prepare("DELETE FROM users WHERE email = ?"); $count=0; foreach($emails as $email){$q->execute([$email]);$count+=$q->rowCount();} $q=$db->prepare("DELETE FROM classes WHERE name = ?"); $q->execute(["${className}"]); $classes=$q->rowCount(); $db->commit(); echo json_encode(["removedSyntheticAccounts"=>$count,"removedSyntheticClasses"=>$classes]); } catch(Throwable $e) {if(isset($db)&&$db->inTransaction())$db->rollBack(); fwrite(STDERR,"SYNTHETIC_CLEANUP_FAILED");exit(1);}`;
    try {
        const cleaned = JSON.parse(remote(`AGENTPY_CONFIG=${remoteRoot}/config.php /opt/alt/php83/usr/bin/php -r '${cleanup.replaceAll('\\\\', '\\')}'`, accounts.map(value => value.email)));
        console.log(JSON.stringify({ ok: !process.exitCode, checks, ...cleaned }));
    } catch {
        console.error(`Synthetic cleanup needs attention for run ${nonce}; no secrets logged.`); process.exitCode = 1;
    }
}
