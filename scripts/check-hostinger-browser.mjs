// Anonymous browser smoke test against the explicitly selected pilot origin.
import { chromium, webkit, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = 'https://agentpy.bildungdigital.at';
const output = '.cache/hostinger-browser';
const registrationEnabled = process.argv.includes('--registration');
const polish = process.argv.includes('--polish');
// After the explicitly requested pilot reset, CTEST no longer exists. Do not
// recreate a permanent test invitation just to satisfy a production smoke test.
const withoutTestClass = process.argv.includes('--without-test-class');
await mkdir(output, { recursive: true });
for (const [name, engine, options] of [
    ['chromium', chromium, { viewport: { width: 1366, height: 768 } }],
    ['webkit-ipad', webkit, devices['iPad (gen 7)']],
]) {
    const browser = await engine.launch();
    try {
        const context = await browser.newContext(options);
        const page = await context.newPage();
        let scriptErrors = 0;
        const failedAssets = [];
        page.on('pageerror', () => scriptErrors++);
        page.on('response', response => {
            if (response.url().startsWith(base + '/') && response.status() >= 400)
                failedAssets.push(new URL(response.url()).pathname);
        });
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        await expect(page.locator('#account-lesson')).toBeVisible();
        const header = page.locator('[data-account-actions]');
        await expect(header.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
        await expect(header.getByRole('button', { name: 'Vollbild', exact: true })).toBeVisible();
        await expect(page.locator('html')).not.toHaveClass(/account-blocked/);
        if(polish){
            await expect(page.frameLocator('#account-lesson').locator('[data-next-target]')).toHaveText('System Access');
            const logo=await page.locator('.account-shell-brand img').boundingBox();
            if(!logo||logo.width<190)throw Error('Updated logo missing');
            await page.screenshot({path:`${output}/${name}-home-r8.png`});
        }
        await header.getByRole('button', { name: 'Anmelden', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Am Schulkonto anmelden' });
        await expect(dialog).toBeVisible();
        if(polish){
            const primary=await dialog.getByRole('button',{name:'Anmelden',exact:true}).evaluate(el=>+getComputedStyle(el).fontWeight);
            const secondary=await dialog.getByRole('button',{name:'Abbrechen',exact:true}).evaluate(el=>+getComputedStyle(el).fontWeight);
            if(primary<=secondary)throw Error('Missing primary action emphasis');
        }
        await expect(dialog.getByLabel('E-Mail-Adresse')).toBeFocused();
        if (registrationEnabled) {
            await expect(dialog).toContainText('Zur Neuanmeldung brauchst du einen Klassencode');
            await expect(dialog.getByRole('button', { name: 'Neuanmeldung', exact: true })).toBeVisible();
            await expect(dialog.getByRole('button', { name: 'Passwort vergessen?', exact: true })).toBeVisible();
        } else {
            await expect(dialog).toContainText('nur die Anmeldung mit einem bestehenden Konto');
            await expect(dialog.getByRole('button', { name: 'Neuanmeldung', exact: true })).toHaveCount(0);
        }
        await dialog.getByRole('button', { name: 'Passwort anzeigen', exact: true }).click();
        await expect(dialog.getByLabel('Passwort', { exact: true })).toHaveAttribute('type', 'text');
        await dialog.getByRole('button', { name: 'Passwort verbergen', exact: true }).click();
        await expect(dialog.getByLabel('Passwort', { exact: true })).toHaveAttribute('type', 'password');
        const box = await dialog.boundingBox();
        const viewport = page.viewportSize();
        if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height)
            throw new Error('Login dialog outside viewport');
        await page.screenshot({ path: `${output}/${name}-login.png` });
        if (registrationEnabled) {
            await dialog.getByRole('button',{name:'Neuanmeldung',exact:true}).click();
            const wizard=page.getByRole('dialog',{name:'Neuanmeldung'});
            await expect(wizard.getByLabel('Klassencode',{exact:true})).toBeVisible();
            if(!withoutTestClass){
                await wizard.getByLabel('Klassencode',{exact:true}).fill('CTEST');
                await wizard.getByRole('button',{name:'Klassencode prüfen'}).click();
                await expect(wizard).toContainText('Willkommen in Test!');
                for (const name of ['Name','E-Mail-Adresse','Passwort (mindestens 8 Zeichen)']) await expect(wizard.getByLabel(name,{exact:true})).toBeVisible();
            }
            await page.screenshot({path:`${output}/${name}-registration.png`});
            // Do not create fake mail recipients or reset any real password.
            await wizard.getByRole('button',{name:'Abbrechen · Gastmodus'}).click();
            await expect(wizard).toHaveCount(0);
            await header.getByRole('button',{name:'Anmelden',exact:true}).click();
            await dialog.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();
            const recovery=page.getByRole('dialog',{name:'Passwort zurücksetzen'});
            await expect(recovery.getByRole('button',{name:'Link anfordern'})).toBeVisible();
            await recovery.getByRole('button',{name:'Abbrechen',exact:true}).click();
            await header.getByRole('button',{name:'Anmelden',exact:true}).click();
        }
        await dialog.getByRole('button', { name: 'Abbrechen' }).click();
        await expect(dialog).toHaveCount(0);
        const lesson=page.frameLocator('#account-lesson');
        const native=await page.evaluate(()=>document.fullscreenEnabled && !!document.documentElement.requestFullscreen);
        if(native) await header.getByRole('button',{name:'Vollbild',exact:true}).click();
        await page.locator('#account-lesson').evaluate(frame=>{frame.contentWindow.location.href='mission1_start.html';});
        // Home has a same-named link. Wait for the requested document before
        // clicking, otherwise the test can open a guest dialog on the old home
        // just as the mission document replaces it and closes that dialog.
        const missionFrame=page.frames().find(frame=>frame.parentFrame()===page.mainFrame());
        await missionFrame.waitForURL('**/mission1_start.html',{waitUntil:'domcontentloaded'});
        await missionFrame.evaluate(async()=>{if(window.AgentLearningDataReady)await window.AgentLearningDataReady;});
        await lesson.getByRole('link',{name:/Training starten/}).click();
        await expect(page.getByRole('dialog',{name:'Im Gastmodus starten'})).toBeVisible();
        await page.getByRole('button',{name:'OK – Mission starten'}).click();
        await expect(lesson.locator('#python-editor')).toBeAttached();
        if(native) await expect(header.getByRole('button',{name:'Vollbild beenden'})).toHaveAttribute('aria-pressed','true');
        await expect(page.locator('.account-panel')).toBeHidden();
        if (scriptErrors || failedAssets.length) throw new Error('Script or asset failures');
        console.log(JSON.stringify({ browser: name, ok: true, checks: ['home-assets', 'guest-ready', 'header-login-fullscreen', registrationEnabled ? (withoutTestClass ? 'registration-entry-and-recovery' : 'CTEST-Test-registration-and-recovery') : 'restricted-registration', 'password-visibility', 'login-dialog', 'focus', 'dialog-fit', 'cancel','guest-mission-dialog','persistent-shell-fullscreen'], screenshot: `${output}/${name}-login.png` }));
    } finally { await browser.close(); }
}
