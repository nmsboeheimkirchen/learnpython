import {test,expect} from '@playwright/test';
const password='Synthetic-browser-password-123!';
const lesson=page=>page.frameLocator('#account-lesson');
async function setup(page){await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});await page.goto('/');}
async function login(page,email){
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
}
async function classes(page){await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();}

test('management: small icons, email disclosure, transfer/leave, account edit, role revocation and self deletion',async({page,browser})=>{
    test.setTimeout(120000);const engine=test.info().project.name,coEmail=`mgmt-co-${engine}@example.test`,name='Management '+engine;
    const coContext=await browser.newContext(),adminContext=await browser.newContext(),co=await coContext.newPage(),admin=await adminContext.newPage();
    try{
        await setup(page);await login(page,`mgmt-owner-${engine}@example.test`);await classes(page);
        await lesson(page).getByRole('button',{name:'Klasse erstellen',exact:true}).click();await page.getByLabel('Klassenname').fill(name);await page.getByRole('dialog').getByRole('button',{name:'Klasse erstellen',exact:true}).click();
        const code=await lesson(page).locator('.teacher-code strong').textContent();
        await lesson(page).getByRole('button',{name:'Lehrpersonen hinzufügen'}).click();
        const add=page.getByRole('dialog',{name:'Lehrpersonen hinzufügen'});
        for(const svg of await add.locator('svg').all()){const rect=await svg.boundingBox();expect(rect.width).toBeLessThanOrEqual(22);expect(rect.height).toBeLessThanOrEqual(22);}
        await page.screenshot({path:test.info().outputPath('management-add-teacher.png')});
        await add.getByRole('button',{name:'mgmt-co · '+coEmail,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Lehrkraft hinzufügen',exact:true}).click();
        await lesson(page).getByRole('button',{name:'mgmt-co',exact:true}).click();await expect(lesson(page).getByText(' · '+coEmail,{exact:true})).toBeVisible();
        await lesson(page).getByRole('button',{name:'Klasse übertragen',exact:true}).click();
        await expect(page.getByRole('dialog')).toContainText('freien Klassenplatz');await page.getByRole('button',{name:'Übertragen',exact:true}).click();
        await expect(lesson(page).getByRole('button',{name:'Klasse verlassen',exact:true})).toBeVisible();
        await expect(lesson(page).getByRole('button',{name:'Klasse löschen',exact:true})).toHaveCount(0);
        await lesson(page).getByRole('button',{name:'Klasse verlassen',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Klasse verlassen',exact:true}).click();
        await expect(lesson(page).getByRole('heading',{name:'Deine erste Klasse'})).toBeVisible();
        await setup(co);await login(co,coEmail);await classes(co);await lesson(co).getByRole('button',{name:'Klasse ansehen'}).click();await expect(lesson(co).locator('.teacher-code strong')).toHaveText(code);
        await setup(admin);await login(admin,`mgmt-admin-${engine}@example.test`);await classes(admin);
        await lesson(admin).getByText('Alle Konten und Klassenzugehörigkeiten',{exact:true}).click();await lesson(admin).getByRole('searchbox',{name:'Konten suchen'}).fill(coEmail);
        let row=lesson(admin).locator('.teacher-account-list li').filter({hasText:coEmail});await expect(row).toContainText(name);
        await row.getByRole('button',{name:'Bearbeiten',exact:true}).click();const newEmail=`mgmt-edited-${engine}@example.test`;
        await admin.getByLabel('Anzeigename',{exact:true}).fill('Edited Teacher');await admin.getByLabel('E-Mail-Adresse',{exact:true}).fill(newEmail);await admin.getByRole('button',{name:'Speichern',exact:true}).click();
        await co.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(co.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();await expect(lesson(co).locator('[data-next-target]')).toBeVisible();
        await lesson(admin).getByRole('button',{name:'Lehrerrolle von Edited Teacher entziehen',exact:true}).click();
        await expect(admin.getByRole('dialog').getByRole('checkbox')).not.toBeChecked();
        await admin.screenshot({path:test.info().outputPath('management-revoke.png')});
        await admin.getByRole('button',{name:'Lehrerrolle entziehen',exact:true}).click();
        await expect(lesson(admin).locator('article').filter({hasText:name})).toBeVisible();
        await login(co,newEmail);await co.getByRole('button',{name:'Benutzermenü'}).click();await expect(co.getByRole('button',{name:'Meine Klassen',exact:true})).toHaveCount(0);
        await co.getByRole('button',{name:'Kontoinfo bearbeiten',exact:true}).click();await co.getByRole('button',{name:'Konto löschen',exact:true}).click();
        await co.getByLabel('Dein Passwort').fill('wrong');await co.getByRole('button',{name:'Konto endgültig löschen'}).click();await expect(co.getByRole('dialog')).toContainText('nicht gelöscht');
        await co.getByLabel('Dein Passwort').fill(password);await co.getByRole('button',{name:'Konto endgültig löschen'}).click();await expect(co.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();await expect(lesson(co).locator('[data-next-target]')).toBeVisible();
        await lesson(admin).getByText('Alle Konten und Klassenzugehörigkeiten',{exact:true}).click();await lesson(admin).getByRole('searchbox',{name:'Konten suchen'}).fill(newEmail);await expect(lesson(admin).locator('.teacher-account-list li:visible')).toHaveCount(0);
    }finally{await coContext.close();await adminContext.close();}
});
