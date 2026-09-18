// Explicit operator action. Credentials arrive only on stdin; never save them to a file.
// Creates one account, reuses/creates its named class, then verifies login without changing progress.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [releaseId] = process.argv.slice(2);
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(releaseId || '')) throw new Error('Release ID required');
const base = 'https://agentpy.bildungdigital.at';
const privateRoot = '/home/u535472856/domains/agentpy.bildungdigital.at/agentpy-private';
const keyDir = join(process.env.USERPROFILE || process.env.HOME, '.ssh');
const ssh = process.platform === 'win32' ? 'C:/Windows/System32/OpenSSH/ssh.exe' : 'ssh';
const sshArgs = ['-F', process.platform === 'win32' ? 'NUL' : '/dev/null', '-T', '-p', '65002', '-i', join(keyDir, 'agentpy_hostinger'),
    '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'IdentityAgent=none', '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes',
    '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UpdateHostKeys=no',
    '-o', `UserKnownHostsFile=${join(keyDir, 'agentpy_hostinger_known_hosts')}`, '-o', 'ConnectTimeout=15', 'u535472856@195.35.49.40'];

async function readInput() {
    process.stdin.setEncoding('utf8');
    if (!process.stdin.isTTY) {
        let input = ''; for await (const chunk of process.stdin) input += chunk;
        return JSON.parse(input);
    }
    // Raw mode disables terminal echo; one JSON line is accepted, never printed.
    process.stdin.setRawMode(true); process.stdin.resume();
    console.log('Secure stdin ready (input will not be echoed).');
    return new Promise((resolve, reject) => {
        let input = '';
        function receive(chunk) {
            input += chunk;
            if (!/[\r\n\x03]/.test(input) && input.length <= 2048) return;
            process.stdin.off('data', receive); process.stdin.setRawMode(false); process.stdin.pause();
            try {
                if (input.includes('\x03') || input.length > 2048) throw new Error('Input cancelled');
                resolve(JSON.parse(input.trim()));
            } catch { reject(new Error('Invalid input')); }
        }
        process.stdin.on('data', receive);
    });
}

let stage = 'read-input';
let browser;
try {
    const input = await readInput();
    stage = 'create-account';
    const php = `ini_set("display_errors","0"); try { require "${privateRoot}/releases/${releaseId}/app/src/bootstrap.php"; require "${privateRoot}/releases/${releaseId}/app/src/account-management.php"; $input=json_decode(stream_get_contents(STDIN,2048),true,10,JSON_THROW_ON_ERROR); AgentPy\\exactFields($input,["email","password","name","className"]); $db=AgentPy\\database(AgentPy\\config()); if($db->query("SELECT DATABASE()")->fetchColumn()!=="u535472856_agentpy") throw new RuntimeException(); $name=AgentPy\\accountLabel($input["className"]); $q=$db->prepare("SELECT id FROM classes WHERE name = ?"); $q->execute([$name]); $classId=$q->fetchColumn(); if($classId===false)$classId=AgentPy\\createClass($db,["name"=>$name])["id"]; unset($input["className"]); $input["classId"]=$classId; echo json_encode(AgentPy\\createAccount($db,$input),JSON_THROW_ON_ERROR); } catch(Throwable $e){fwrite(STDERR,"ACCOUNT_PROVISION_FAILED");exit(1);}`.replaceAll('\\\\', '\\');
    let profile;
    try {
        profile = JSON.parse(execFileSync(ssh, [...sshArgs, `AGENTPY_CONFIG=${privateRoot}/config.php /opt/alt/php83/usr/bin/php -r '${php}'`],
            { input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }));
    } catch { throw new Error('Provision failed; inspect exact account before retrying'); }
    console.log(JSON.stringify({ created: true, email: profile.email, name: profile.name, className: profile.className }));
    stage = 'browser-login';
    browser = await chromium.launch();
    const page = await browser.newPage(); // No trace, video, screenshot or storage-state export.
    await page.goto(base + '/');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(input.email);
    await page.getByLabel('Passwort', { exact: true }).fill(input.password);
    await page.getByRole('dialog').getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toBeVisible();
    await expect(page.locator('.account-panel')).toContainText(`${profile.name} · Klasse ${profile.className}`);
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await expect(page.locator('.account-panel')).toContainText('Gastmodus');
    input.password = '';
    console.log(JSON.stringify({ verified: true, checks: ['real-browser-login', 'name-and-class', 'logout'], progressChanged: false }));
} catch {
    // Playwright/exec exceptions can embed arguments; never print the original exception.
    console.error(`Account operation failed at ${stage}. Inspect account state before retrying; no secrets logged.`);
    process.exitCode = 1;
} finally { if (browser) await browser.close(); }
