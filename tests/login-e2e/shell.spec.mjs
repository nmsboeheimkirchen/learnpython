import { test, expect } from '@playwright/test';
const password = 'Synthetic-browser-password-123!';
const lesson = page => page.frameLocator('#account-lesson');
const child = page => page.frames().find(frame => frame.parentFrame() === page.mainFrame());
async function open(page, screen = 'index.html') {
    // Exercise the production redirect as well as the actual persistent shell.
    await page.addInitScript(() => { window.AgentAccountConfig = {enabled:true, endpoint:'api/index.php', saveMode:'attempts', shell:true}; });
    await page.goto('/' + screen);
    await expect(page.locator('#account-lesson')).toBeVisible();
    await expect(page.getByRole('button', {name:'Anmelden', exact:true})).toBeVisible();
}
async function login(page) {
    await page.getByRole('button', {name:'Anmelden', exact:true}).click();
    await page.getByLabel('E-Mail-Adresse', {exact:true}).fill(`shell-student-${test.info().project.name}@example.test`);
    await page.getByLabel('Passwort', {exact:true}).fill(password);
    const response=page.waitForResponse(response=>response.url().includes('action=login'));
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    expect((await response).status()).toBe(200);
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
}
async function navigate(page, screen) {
    await child(page).evaluate(screen => { location.href = screen; }, screen);
    await expect(lesson(page).locator('html')).not.toHaveClass(/account-blocked/);
    await expect.poll(() => child(page).url()).toContain(screen);
}
test('shell keeps native fullscreen and top controls across mission and level navigation', async ({page}) => {
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await open(page, 'mission1_start.html');
    await page.evaluate(() => { window.shellIdentity = 'unchanged'; });
    const native = await page.evaluate(() => document.fullscreenEnabled && !!document.documentElement.requestFullscreen);
    if (native) await page.getByRole('button',{name:'Vollbild',exact:true}).click();
    await lesson(page).getByRole('link',{name:/Training starten/}).click();
    await expect(page.getByRole('dialog',{name:'Im Gastmodus starten'})).toBeVisible();
    await page.getByRole('button',{name:'OK – Mission starten'}).click();
    await expect(lesson(page).locator('#python-editor')).toBeAttached();
    await navigate(page,'mission1_level2.html');
    expect(await page.evaluate(()=>window.shellIdentity)).toBe('unchanged');
    if(native) await expect(page.getByRole('button',{name:'Vollbild beenden'})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toHaveCount(1);
    await expect(page.locator('.account-panel')).toBeHidden();
    await expect(lesson(page).locator('.account-toolbar,.account-panel')).toHaveCount(0);
    await navigate(page,'mission1_start.html');
    await lesson(page).getByRole('link',{name:/Training starten/}).click();
    await expect(page.getByRole('dialog',{name:'Im Gastmodus starten'})).toBeVisible();
    await page.screenshot({path:test.info().outputPath('guest-dialog.png')});
    expect(errors).toEqual([]);
});
test('guest login resumes intended mission; eye, menu, explicit draft save and account info', async ({page}) => {
    await open(page,'mission1_start.html');
    await lesson(page).getByRole('link',{name:/Training starten/}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(`shell-student-${test.info().project.name}@example.test`);
    await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Passwort anzeigen',exact:true}).click();
    await expect(page.getByLabel('Passwort',{exact:true})).toHaveAttribute('type','text');
    const input = await page.getByLabel('Passwort',{exact:true}).boundingBox();
    const eye = await page.getByRole('button',{name:'Passwort verbergen'}).boundingBox();
    expect(Math.abs(input.y+input.height/2-eye.y-eye.height/2)).toBeLessThan(2);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect.poll(()=>child(page).url()).toContain('mission1_level1.html');
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
    await expect.poll(()=>child(page).evaluate(()=>!!window.editor)).toBe(true);
    await child(page).evaluate(async()=>{await window.AgentLearningData.resetLearningData(); window.editor.setValue('# Entwurf ohne Ausführung');});
    await page.getByRole('button',{name:'Benutzermenü'}).click();
    await page.getByRole('button',{name:'Code speichern',exact:true}).click();
    await expect(page.locator('.account-panel')).toContainText('Entwurf zentral gespeichert');
    expect(await child(page).evaluate(()=>window.AgentLearningData.getCompletedCode('mission1_level1'))).toBeNull();
    await page.getByRole('button',{name:'Fortschritt',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('0 %');
    await page.getByRole('button',{name:'Schließen',exact:true}).click();
    await page.getByRole('button',{name:'Benutzermenü'}).click();
    await page.getByRole('button',{name:'Kontoinfo bearbeiten'}).click();
    await page.getByLabel('Anzeigename',{exact:true}).fill('Neuer Testname');
    await page.getByRole('button',{name:'Namen speichern'}).click();
    await expect(page.getByRole('dialog')).toContainText('Anzeigename gespeichert');
    // Restore fixture display name; no real user is touched.
    await page.getByLabel('Anzeigename',{exact:true}).fill('shell-student');
    await page.getByRole('button',{name:'Namen speichern'}).click();
    await expect(page.getByRole('button',{name:'Namen speichern'})).toBeEnabled();
    await page.getByRole('button',{name:'Schließen',exact:true}).click();
    await navigate(page,'mission1_level2.html');
    await navigate(page,'mission1_level1.html');
    await expect.poll(()=>child(page).evaluate(()=>window.editor?.getValue())).toBe('# Entwurf ohne Ausführung');
    await page.getByRole('button',{name:'Benutzermenü'}).click();
    await page.screenshot({path:test.info().outputPath('account-menu.png')});
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
});
test('shell honours failure/retry and clears account data after another tab logs out',async({page,context})=>{
    await open(page,'mission1_level1.html'); await login(page);
    await expect.poll(()=>child(page).evaluate(()=>!!window.editor)).toBe(true);
    let lost=false;
    await page.route('**/api/index.php?action=write',async route=>{
        if(!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();
    });
    await child(page).evaluate(()=>window.AgentLearningData.recordAttempt('mission1_level1','# failed acknowledgement'));
    await expect(page.getByRole('button',{name:'Speichern erneut versuchen'})).toBeVisible();
    await page.getByRole('button',{name:'Speichern erneut versuchen'}).click();
    await expect(page.locator('.account-panel')).toContainText('Zentral gespeichert');
    const other=await context.newPage(); await other.goto('/app.html');
    await other.getByRole('button',{name:'Benutzermenü'}).click();
    await other.getByRole('button',{name:'Abmelden',exact:true}).click();
    await expect(lesson(page).locator('html')).toHaveClass(/account-blocked/);
    expect(await child(page).evaluate(()=>window.editor.getValue())).toBe('');
    await expect(page.getByRole('button',{name:'Seite neu laden'})).toBeVisible();
    await other.close();
});
test('deep link, Back and forward keep shell and exact lesson without duplicate controls',async({page})=>{
    await open(page,'mission1_level2.html#l');
    await expect.poll(()=>child(page).url()).toContain('mission1_level2.html#l');
    await navigate(page,'mission1_level3.html');
    await page.goBack();
    await expect.poll(()=>child(page).url()).toContain('mission1_level2.html');
    await page.goForward();
    await expect.poll(()=>child(page).url()).toContain('mission1_level3.html');
    await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toHaveCount(1);
    await expect(page.getByRole('button',{name:'Vollbild',exact:true})).toHaveCount(1);
});

test('special pages retain account controls, explicit save targets and small-screen login stays contained',async({page})=>{
    await open(page); await login(page);
    for(const [screen,level] of [['projektwahl.html',null],['impressum.html',null],['pico_level1.html','pico_level1_navigation'],['pico_level4.html','pico_level4_memory'],['pixelmuseum_finale.html','pixelmuseum_finale'],['helikopter_flucht_level2.html','helikopter_flucht_level2']]){
        await navigate(page,screen);
        await page.getByRole('button',{name:'Benutzermenü'}).click();
        const save=page.getByRole('button',{name:'Code speichern',exact:true});
        if(level){await expect(save).toBeEnabled();expect(await child(page).evaluate(()=>window.AgentCurrentLevel)).toBe(level);}
        else await expect(save).toBeDisabled();
        await page.getByRole('button',{name:'Benutzermenü'}).click();
        if(screen==='pico_level1.html'){
            await lesson(page).locator('#presentation-btn').click();
            await expect(lesson(page).locator('#exit-presentation-btn')).toBeVisible();
            await expect(page.getByRole('button',{name:'Vollbild',exact:true})).toBeVisible();
            await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
            await lesson(page).locator('#exit-presentation-btn').click();
        }
    }
    await navigate(page,'index.html');
    await page.getByRole('button',{name:'Benutzermenü'}).click();
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toBeFocused();
    for(const selector of ['.account-dialog','.account-fullscreen','.account-person']){
        const box=await page.locator(selector).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.y+box.height).toBeLessThanOrEqual(844);
    }
    await page.screenshot({path:test.info().outputPath('shell-phone-login.png')});
});
test('unsaved typing warns on logout; cancelled logout keeps account and explicit save resolves warning',async({page})=>{
    await open(page,'mission1_level1.html');await login(page);
    await expect.poll(()=>child(page).evaluate(()=>!!window.editor)).toBe(true);
    await child(page).evaluate(()=>window.editor.replaceRange('# Noch nicht gespeichert\n',{line:0,ch:0},undefined,'+input'));
    await page.getByRole('button',{name:'Benutzermenü'}).click();
    const warning=page.waitForEvent('dialog').then(async dialog=>{expect(dialog.message()).toContain('ungespeicherter Code');await dialog.dismiss();});
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();await warning;
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
    await page.getByRole('button',{name:'Code speichern',exact:true}).click();
    await expect(page.locator('.account-panel')).toContainText('Entwurf zentral gespeichert');
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
});
