import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

function deliverTestMail() {
    const fixture = JSON.parse(readFileSync('.cache/login-browser-fixture.json','utf8'));
    const portable = resolve('.cache/php-runtime/php-8.5.10/php.exe');
    const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
    const args = php === portable ? ['-n','-d',`extension_dir=${dirname(php)}/ext`,'-d','extension=pdo_sqlite'] : [];
    const result = spawnSync(php,[...args,'tests/backend-fixture.php','mail-test'],{encoding:'utf8',windowsHide:true,input:JSON.stringify({count:10}),env:{...process.env,AGENTPY_CONFIG:'',AGENTPY_ENVIRONMENT:'development',AGENTPY_ORIGIN:'http://127.0.0.1:4174',AGENTPY_DSN:fixture.dsn,AGENTPY_DB_USER:'',AGENTPY_DB_PASSWORD:'',AGENTPY_SESSION_PATH:fixture.sessions,AGENTPY_REGISTRATION_ENABLED:'true',AGENTPY_MAIL_TRANSPORT:'test',AGENTPY_MAIL_FROM:'noreply@example.test'}});
    expect(result.status,result.stderr).toBe(0);
    return JSON.parse(result.stdout).messages;
}
async function register(page) {
    await page.goto('/');
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByRole('button',{name:'Neuanmeldung',exact:true}).click();
}
test('restricted rollout hides registration unless the server explicitly enables it', async ({page}) => {
    for (const policy of [undefined, {enabled:false}, {enabled:'true'}]) {
        await page.route('**/api/index.php?action=session', async route => {
            const response = await route.fetch();
            const json = await response.json();
            json.registration = policy;
            await route.fulfill({response, json});
        });
        await page.goto('/');
        await page.locator('[data-account-actions]').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(page.getByRole('dialog')).toContainText('nur die Anmeldung mit einem bestehenden Konto');
        await expect(page.getByRole('button',{name:'Neuanmeldung',exact:true})).toHaveCount(0);
        await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toBeVisible();
        await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
        await page.unroute('**/api/index.php?action=session');
    }
});

test('restricted rollout clears verification fragments without opening a wizard or sending a request', async ({page}) => {
    const actions = [];
    page.on('request', request => {
        if(request.url().includes('/api/index.php')) actions.push(new URL(request.url()).searchParams.get('action'));
    });
    await page.route('**/api/index.php?action=session', async route => {
        const response = await route.fetch();
        const json = await response.json();
        json.registration = {enabled:false};
        await route.fulfill({response,json});
    });
    await page.goto('/#verify=' + 'a'.repeat(64));
    await expect(page.locator('.account-panel')).toContainText('noch nicht freigegeben');
    expect(page.url()).not.toContain('#verify=');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(actions).toEqual(['session']);
});
test('fullscreen control toggles native fullscreen or explains an unsupported browser',async({page})=>{
    await page.goto('/');
    const control=page.getByRole('button',{name:'Vollbild',exact:true});
    await expect(control).toBeVisible();
    if(await page.evaluate(()=>Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen))){
        await control.click();
        await expect(page.getByRole('button',{name:'Vollbild beenden',exact:true})).toHaveAttribute('aria-pressed','true');
        await page.getByRole('button',{name:'Vollbild beenden',exact:true}).click();
        await expect(control).toHaveAttribute('aria-pressed','false');
    } else {
        await page.evaluate(()=>Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined,configurable:true}));
        const dialogPromise=page.waitForEvent('dialog').then(async dialog=>{
            expect(dialog.message()).toContain('F11'); await dialog.accept();
        });
        await control.click();
        await dialogPromise;
    }
});
test('new header and password visibility; cancel keeps guest data unchanged',async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await page.goto('/');
    await expect(page.locator('.course-header .course-brand')).toBeVisible();
    await expect(page.locator('.course-header-action, .variant-switch')).toHaveCount(0);
    await expect(page.locator('.course-header').getByRole('button',{name:'Vollbild',exact:true})).toBeVisible();
    await page.evaluate(()=>localStorage.setItem('attemptedLevelCode_v1','{"mission1_level1":"GAST"}'));
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('Passwort',{exact:true}).fill('Test!888');
    await page.getByRole('button',{name:'Passwort anzeigen',exact:true}).click();
    await expect(page.getByLabel('Passwort',{exact:true})).toHaveAttribute('type','text');
    await page.getByRole('button',{name:'Neuanmeldung',exact:true}).click();
    await page.getByLabel('Klassencode',{exact:true}).fill('WRONG');
    await page.getByRole('button',{name:'Klassencode prüfen'}).click();
    await expect(page.getByRole('alert')).toContainText('Noch 4 Versuche');
    await page.getByRole('button',{name:'Abbrechen · Gastmodus'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>localStorage.getItem('attemptedLevelCode_v1'))).toContain('GAST');
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByLabel('Passwort',{exact:true})).toHaveAttribute('type','password');
    await expect(page.getByLabel('Passwort',{exact:true})).toHaveValue('');
});
test('class invitation, queued mail and explicit verification on another browser create a usable account',async({page,browser})=>{
    await register(page);
    await page.getByLabel('Klassencode',{exact:true}).fill('CTEST');
    await page.getByRole('button',{name:'Klassencode prüfen'}).click();
    await expect(page.getByRole('dialog')).toContainText('Willkommen in Browser Test');
    const email=`browser-${randomUUID()}@example.test`, password='Test!888';
    await page.getByLabel('Name',{exact:true}).fill('Test Anmeldung');
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
    await page.getByLabel('Passwort (mindestens 8 Zeichen)',{exact:true}).fill(password);
    await page.getByLabel('Passwort wiederholen',{exact:true}).fill('Different!888');
    const registrationRequests=[];
    page.on('request',r=>{if(r.url().includes('action=register'))registrationRequests.push(r);});
    await page.getByRole('button',{name:'Konto anlegen'}).click();
    await expect(page.getByRole('alert')).toContainText('Die Passwörter stimmen nicht überein');
    expect(registrationRequests).toHaveLength(0);
    await expect(page.getByLabel('Passwort (mindestens 8 Zeichen)',{exact:true})).toHaveValue(password);
    await page.getByRole('button',{name:'Wiederholung anzeigen',exact:true}).click();
    await expect(page.getByLabel('Passwort wiederholen',{exact:true})).toHaveAttribute('type','text');
    await page.getByLabel('Passwort wiederholen',{exact:true}).fill(password);
    expect(await page.getByRole('dialog').locator('form').evaluate(form=>form.checkValidity())).toBe(true);
    const registrationResponse=page.waitForResponse(response=>response.url().includes('action=register'));
    await page.getByRole('button',{name:'Konto anlegen'}).click();
    expect((await registrationResponse).status()).toBe(202);
    await expect(page.getByRole('dialog')).toContainText('Outlook');
    await expect(page.getByRole('dialog')).toContainText('höchstens 10 Bestätigungsmails pro Minute');
    await page.getByRole('button',{name:'Weiter im Gastmodus'}).click();
    // A pending account gets the same generic list as an unknown address/bad password.
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
    await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Mögliche Ursachen');
    await expect(page.getByRole('alert').locator('li')).toHaveText(['Das Konto wurde noch nicht angelegt.','Die E-Mail-Adresse wurde noch nicht bestätigt.','Die E-Mail-Adresse oder das Passwort ist falsch.']);
    await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
    const mail=deliverTestMail().find(item=>item.to===email);
    expect(mail).toBeTruthy();
    const link=mail.body.match(/http[^\s]+#verify=[a-f0-9]{64}/)[0];
    const context=await browser.newContext();
    try {
        const device=await context.newPage();
        await device.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
        await device.goto('/');
        await device.getByRole('button',{name:'Anmelden',exact:true}).click();
        await device.getByLabel('E-Mail-Adresse',{exact:true}).fill(`verification-student-${test.info().project.name}@example.test`);
        await device.getByLabel('Passwort',{exact:true}).fill('Synthetic-browser-password-123!');
        await device.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(device.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        const token=link.split('#verify=')[1],requests=[];
        device.on('request',r=>requests.push({url:r.url(),body:r.postDataJSON?.bind(r)}));
        await device.goto(link);
        const verification=device.getByRole('dialog',{name:'E-Mail bestätigen',exact:true});
        await expect(verification.getByRole('alert')).toContainText('Du bist bereits angemeldet');
        await expect(verification.locator('[data-intro]')).toBeHidden();
        await expect(verification.getByRole('button',{name:'E-Mail jetzt bestätigen'})).toHaveCount(0);
        await verification.getByRole('button',{name:'Abbrechen',exact:true}).click();
        await expect(device.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        expect(requests.some(r=>r.url.includes('action=verify-email'))).toBe(false);
        await device.goto(link);
        await verification.getByRole('button',{name:'Abmelden',exact:true}).click();
        await expect(device.getByRole('button',{name:'E-Mail jetzt bestätigen'})).toBeVisible();
        expect(device.url()).not.toContain('#verify=');
        expect(device.frames().some(f=>f.url().includes(token))).toBe(false);
        expect(requests.some(r=>r.url.includes(token))).toBe(false);
        expect(requests.some(r=>r.url.includes('action=verify-email'))).toBe(false);
        await device.getByRole('button',{name:'E-Mail jetzt bestätigen'}).click();
        await expect(device.getByRole('dialog')).toContainText('Deine E-Mail-Adresse ist bestätigt');
        expect(requests.find(r=>r.url.includes('action=verify-email')).body().token).toBe(token);
        // Hold cancellation to prove login cannot rotate cookies while an older
        // registration session request is still in flight (WebKit CI regression).
        let releaseCancellation;
        const cancellationGate=new Promise(resolve=>{releaseCancellation=resolve;});
        let cancellationStarted;
        const cancellationSeen=new Promise(resolve=>{cancellationStarted=resolve;});
        await device.route('**/api/index.php?action=cancel-registration',async route=>{
            cancellationStarted(); await cancellationGate; await route.continue();
        });
        await device.getByRole('button',{name:'Zur Anmeldung'}).click();
        await cancellationSeen;
        await expect(device.getByRole('dialog')).toContainText('Deine E-Mail-Adresse ist bestätigt');
        await expect(device.getByRole('button',{name:'Zur Anmeldung'})).toBeDisabled();
        releaseCancellation();
        await device.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await device.getByLabel('Passwort',{exact:true}).fill(password);
        const loginResponse=device.waitForResponse(response=>response.url().includes('action=login'));
        await device.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        expect((await loginResponse).status()).toBe(200);
        await expect(device.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        await expect(device.locator('.account-panel')).toContainText('Test Anmeldung · Klasse Browser Test');
    } finally { await context.close(); }
});
test('registration dialog stays within a small school laptop and narrow phone viewport',async({page})=>{
    for(const viewport of [{width:1366,height:600},{width:390,height:844}]){
        await page.setViewportSize(viewport); await register(page);
        await page.getByLabel('Klassencode',{exact:true}).fill('CTEST');
        await page.getByRole('button',{name:'Klassencode prüfen'}).click();
        await expect(page.getByLabel('Name',{exact:true})).toBeVisible();
        const box=await page.getByRole('dialog').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
        await page.getByRole('button',{name:'Abbrechen · Gastmodus'}).click();
    }
});
