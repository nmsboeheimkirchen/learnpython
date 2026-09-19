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
    await page.getByRole('button',{name:'Konto anlegen'}).click();
    await expect(page.getByRole('dialog')).toContainText('Outlook');
    await expect(page.getByRole('dialog')).toContainText('höchstens 10 Bestätigungsmails pro Minute');
    await page.getByRole('button',{name:'Weiter im Gastmodus'}).click();
    const mail=deliverTestMail().find(item=>item.to===email);
    expect(mail).toBeTruthy();
    const link=mail.body.match(/http[^\s]+#verify=[a-f0-9]{64}/)[0];
    const context=await browser.newContext();
    try {
        const device=await context.newPage();
        await device.goto(link);
        await expect(device.getByRole('button',{name:'E-Mail jetzt bestätigen'})).toBeVisible();
        expect(device.url()).not.toContain('#verify=');
        await device.getByRole('button',{name:'E-Mail jetzt bestätigen'}).click();
        await expect(device.getByRole('dialog')).toContainText('Deine E-Mail-Adresse ist bestätigt');
        await device.getByRole('button',{name:'Zur Anmeldung'}).click();
        await device.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await device.getByLabel('Passwort',{exact:true}).fill(password);
        await device.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
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
