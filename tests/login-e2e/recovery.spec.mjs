import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Only disposable localhost fixtures; no production transport or user accounts.
function fixture(action, input = {}) {
    const state = JSON.parse(readFileSync('.cache/login-browser-fixture.json','utf8'));
    const portable = resolve('.cache/php-runtime/php-8.5.10/php.exe');
    const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
    const args = php === portable ? ['-n','-d',`extension_dir=${dirname(php)}/ext`,'-d','extension=pdo_sqlite'] : [];
    const result = spawnSync(php,[...args,'tests/backend-fixture.php',action],{
        encoding:'utf8',windowsHide:true,input:JSON.stringify(input),env:{...process.env,
            AGENTPY_CONFIG:'',AGENTPY_ENVIRONMENT:'development',AGENTPY_ORIGIN:'http://127.0.0.1:4174',
            AGENTPY_DSN:state.dsn,AGENTPY_DB_USER:'',AGENTPY_DB_PASSWORD:'',AGENTPY_SESSION_PATH:state.sessions,
            AGENTPY_REGISTRATION_ENABLED:'true',AGENTPY_PASSWORD_RESET_ENABLED:'true',AGENTPY_MAIL_TRANSPORT:'test',AGENTPY_MAIL_FROM:'noreply@example.test'}
    });
    expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout || '{}');
}
const child = page => page.frames().find(frame=>frame.parentFrame()===page.mainFrame());
async function shell(page, path='/') {
    await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
    await page.goto(path);
    await expect(page.locator('#account-lesson')).toBeVisible();
}
async function login(page,email,password) {
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
    await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
}

test('reset is hidden unless explicitly enabled and discarded fragments never send a token',async({page})=>{
    const actions=[];
    page.on('request',request=>{if(request.url().includes('/api/'))actions.push(new URL(request.url()).searchParams.get('action'));});
    for(const policy of [undefined,{enabled:false},{enabled:'true'}]) {
        await page.route('**/api/index.php?action=session',async route=>{
            const response=await route.fetch(), json=await response.json();json.recovery=policy;await route.fulfill({response,json});
        });
        await shell(page,'/index.html#reset='+'b'.repeat(64));
        await expect(page.locator('.account-panel')).toContainText('noch nicht freigegeben');
        expect(page.url()).not.toContain('#reset=');
        expect(child(page).url()).not.toContain('#reset=');
        await page.getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(page.getByRole('button',{name:'Passwort vergessen?',exact:true})).toHaveCount(0);
        await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
        await page.unroute('**/api/index.php?action=session');
    }
    expect(actions.every(action=>action==='session')).toBe(true);
});

test('new password dialog fits a phone, rejects mismatch and clears secret inputs after invalid links',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await shell(page,'/index.html#reset='+'b'.repeat(64));
    const dialog=page.getByRole('dialog',{name:'Neues Passwort festlegen'});
    await expect(dialog).toBeVisible();
    expect(page.url()).not.toContain('#reset=');expect(child(page).url()).not.toContain('#reset=');
    await page.getByLabel('Neues Passwort',{exact:true}).fill('Reset!888');
    await page.getByLabel('Passwort wiederholen',{exact:true}).fill('different');
    await page.getByRole('button',{name:'Neues Passwort speichern'}).click();
    await expect(dialog).toContainText('stimmen nicht überein');
    await page.getByLabel('Passwort wiederholen',{exact:true}).fill('Reset!888');
    await page.getByRole('button',{name:'Passwort anzeigen',exact:true}).click();
    await page.getByRole('button',{name:'Wiederholung anzeigen'}).click();
    await expect(page.getByLabel('Passwort wiederholen')).toHaveAttribute('type','text');
    await page.getByRole('button',{name:'Neues Passwort speichern'}).click();
    await expect(dialog.getByRole('alert')).toContainText('ungültig');
    await expect(page.getByLabel('Neues Passwort',{exact:true})).toHaveValue('');
    await expect(page.getByLabel('Passwort wiederholen')).toHaveAttribute('type','password');
    await expect(page.getByRole('button',{name:'Wiederholung anzeigen'})).toHaveAttribute('aria-pressed','false');
    const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.y+box.height).toBeLessThanOrEqual(844);
    await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
    await expect(dialog).toHaveCount(0);
});

test('forgot password through shell preserves progress, invalidates another device and allows only the new password',async({page,browser})=>{
    const email=`recovery-student-${test.info().project.name}@example.test`;
    const oldPassword='Synthetic-browser-password-123!',newPassword='Reset!888';
    const deviceContext=await browser.newContext(),device=await deviceContext.newPage();
    try {
        await shell(device);await login(device,email,oldPassword);
        const before=await child(device).evaluate(async()=>{
            const session=await fetch('/api/index.php?action=session').then(r=>r.json());
            const headers={'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'X-Agentpy-Profile':session.profile.id};
            const response=await fetch('/api/index.php?action=write',{method:'POST',headers,body:JSON.stringify({expectedRevision:0,operationId:crypto.randomUUID(),command:{type:'complete',levelId:'mission1_level1',code:'print("saved before reset")'}})});
            if(!response.ok)throw new Error('fixture write failed');
            return (await response.json()).state;
        });
        await shell(page);
        await page.getByRole('button',{name:'Anmelden',exact:true}).click();
        await page.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();
        await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await page.getByRole('button',{name:'Link anfordern'}).click();
        await expect(page.getByRole('dialog')).toContainText('Outlook');
        await expect(page.getByRole('dialog')).toContainText('höchstens 10 Konto-Mails');
        fixture('mail-clear-attempts');
        const message=fixture('mail-test',{count:10}).messages.find(mail=>mail.to===email&&mail.body.includes('#reset='));
        expect(message).toBeTruthy();
        const link=message.body.match(/http[^\s]+#reset=[a-f0-9]{64}/)[0];
        const urls=[];page.on('request',request=>urls.push(request.url()));
        await page.goto(link);
        await expect(page.getByRole('dialog',{name:'Neues Passwort festlegen'})).toBeVisible();
        expect(page.url()).not.toContain('#reset=');expect(child(page).url()).not.toContain('#reset=');
        await page.getByLabel('Neues Passwort',{exact:true}).fill(newPassword);
        await page.getByLabel('Passwort wiederholen').fill(newPassword);
        await page.getByRole('button',{name:'Neues Passwort speichern'}).click();
        await expect(page.getByRole('dialog')).toContainText('Passwort wurde geändert');
        expect(urls.some(url=>url.includes('#reset='))).toBe(false);
        await page.getByRole('button',{name:'Zur Anmeldung'}).click();
        await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await page.getByLabel('Passwort',{exact:true}).fill(oldPassword);
        await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(page.getByRole('alert')).toContainText('Passwort');
        await page.getByLabel('Passwort',{exact:true}).fill(newPassword);
        await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        const after=await child(page).evaluate(async()=>{
            const session=await fetch('/api/index.php?action=session').then(r=>r.json());
            return (await fetch('/api/index.php?action=state',{headers:{'X-Agentpy-Profile':session.profile.id}}).then(r=>r.json())).state;
        });
        expect(after).toEqual(before);
        await device.reload();await expect(device.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
    } finally {await deviceContext.close();}
});
