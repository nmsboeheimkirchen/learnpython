import {test,expect} from '@playwright/test';
const lesson=page=>page.frameLocator('#account-lesson');
test('teacher menu, empty start, class creation, persistent join code and responsive roster',async({page,context})=>{
    await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
    await page.goto('/');await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(`teacher-${test.info().project.name}@example.test`);
    await page.getByLabel('Passwort',{exact:true}).fill('Synthetic-browser-password-123!');
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();
    await expect(lesson(page).getByRole('heading',{name:'Deine erste Klasse'})).toBeVisible();
    await lesson(page).getByRole('button',{name:'Klasse erstellen',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Klassenname').fill('1A <b>Beispiel</b>');
    await page.getByRole('dialog').getByRole('button',{name:'Klasse erstellen',exact:true}).click();
    await expect(lesson(page).getByRole('heading',{name:'1A <b>Beispiel</b>',exact:true})).toBeVisible();
    const code=await lesson(page).locator('.teacher-code strong').textContent();expect(code).toMatch(/^[A-Z]{5}$/);
    await expect(lesson(page).locator('.teacher-code')).toContainText('gültig bis');
    await expect(lesson(page).locator('.teacher-count')).toContainText('32 frei');
    // Returning to the app checks identity briefly; it must not erase a valid class view.
    const recheck=page.waitForResponse(r=>r.url().includes('action=session'));
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await recheck;
    await expect(lesson(page).locator('html')).not.toHaveClass(/account-blocked/);
    await expect(lesson(page).getByRole('heading',{name:'1A <b>Beispiel</b>',exact:true})).toBeVisible();
    await page.reload();await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();
    await lesson(page).getByRole('button',{name:'Klasse ansehen'}).click();
    await expect(lesson(page).locator('.teacher-code strong')).toHaveText(code);
    await page.setViewportSize({width:390,height:844});
    const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());expect(await frame.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({path:test.info().outputPath('teacher-class.png')});
    // A real logout in another tab still erases private class data immediately.
    const other=await context.newPage();await other.goto('/app.html');
    await other.getByRole('button',{name:'Benutzermenü'}).click();await other.getByRole('button',{name:'Abmelden',exact:true}).click();
    await expect(lesson(page).locator('html')).toHaveClass(/account-invalidated/);
    await expect(lesson(page).getByText('1A <b>Beispiel</b>',{exact:true})).toHaveCount(0);
    await other.close();
});
