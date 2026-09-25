import {test,expect} from '@playwright/test';
import {fixture} from './fixtures.mjs';
const password='Synthetic-browser-password-123!';
const lesson=page=>page.frameLocator('#account-lesson');
async function setup(page){await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});}
async function login(page,email){
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
}
async function classes(page){await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();}
test('superadmin invites new and existing teachers; external collaborator can read but not administer the class',async({page,browser})=>{
    test.setTimeout(120000);await setup(page);await page.goto('/');await login(page,`admin-${test.info().project.name}@example.test`);await classes(page);
    await expect(lesson(page).getByRole('heading',{name:'Verwaltete Lehrer:innen'})).toBeVisible();
    const invite=async email=>{
        await lesson(page).getByRole('button',{name:'Lehrkraft hinzufügen',exact:true}).click();
        await expect(page.getByLabel('Eigene Klassen (1–100)')).toHaveValue('10');
        await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);await page.getByRole('button',{name:'Einladung senden',exact:true}).click();
        await expect(lesson(page).getByRole('heading',{name:'Offene Einladungen'})).toBeVisible();
        return fixture('teacher-invite-token',{email}).token;
    };
    const email=`invited-${test.info().project.name}@external.test`,token=await invite(email);
    const context=await browser.newContext(),pupil=await context.newPage();await setup(pupil);
    try{
        const secretRequests=[];pupil.on('request',r=>{if(r.url().includes(token))secretRequests.push(r.url());});
        await pupil.goto('/index.html#teacher-invite='+token);
        const form=pupil.getByRole('dialog',{name:'Einladung als Lehrkraft'});
        await form.getByLabel('Name',{exact:true}).fill('Alex Teacher');
        await form.getByLabel('Passwort (mindestens 8 Zeichen)',{exact:true}).fill(password);
        await form.getByLabel('Passwort wiederholen',{exact:true}).fill('mismatch');
        await form.getByRole('button',{name:'Einladung annehmen'}).click();await expect(form).toContainText('Passwörter stimmen nicht überein');
        await form.getByLabel('Passwort wiederholen',{exact:true}).fill(password);
        await form.getByRole('button',{name:'Einladung annehmen'}).click();
        await expect(pupil.getByRole('dialog',{name:'Am Schulkonto anmelden'})).toBeVisible();
        await pupil.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);await pupil.getByLabel('Passwort',{exact:true}).fill(password);
        await pupil.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(pupil.getByRole('button',{name:'Benutzermenü'})).toBeVisible();expect(secretRequests).toEqual([]);
        await lesson(page).getByRole('button',{name:'Klasse erstellen',exact:true}).click();await page.getByLabel('Klassenname').fill('Gemeinsam UI');
        await page.getByRole('dialog').getByRole('button',{name:'Klasse erstellen',exact:true}).click();
        await lesson(page).getByRole('button',{name:'Lehrpersonen hinzufügen'}).click();
        await page.getByRole('button',{name:'Über E-Mail hinzufügen'}).click();await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await page.getByRole('dialog').getByRole('button',{name:'Lehrkraft hinzufügen',exact:true}).click();
        await expect(lesson(page).getByText('Weitere Lehrkräfte: Alex Teacher')).toBeVisible();
        await classes(pupil);await expect(lesson(pupil).getByRole('heading',{name:'Verwaltete Lehrer:innen'})).toHaveCount(0);
        await expect(lesson(pupil).getByText(/0 von 10 eigenen Klassen/)).toBeVisible();
        await lesson(pupil).getByRole('button',{name:'Klasse ansehen'}).click();
        await expect(lesson(pupil).getByRole('button',{name:'Klasse löschen'})).toHaveCount(0);
        await expect(lesson(pupil).getByRole('button',{name:'Lehrpersonen hinzufügen'})).toHaveCount(0);
        await page.screenshot({path:test.info().outputPath('owner-shared-class.png')});
        await lesson(page).getByRole('button',{name:'Meine Klassen',exact:true}).click();
        const existing=`promote-student-${test.info().project.name}@example.test`,existingToken=await invite(existing);
        // Wrong signed-in identity must be able to log out and resume exactly this invitation.
        await pupil.goto('/index.html#teacher-invite='+existingToken);
        await pupil.getByRole('dialog').getByRole('button',{name:'Abmelden',exact:true}).click();
        await expect(pupil.getByRole('dialog')).toContainText('bestehendes Konto');
        await expect(pupil.getByRole('dialog').getByLabel('Passwort',{exact:true})).toHaveCount(0);
        await pupil.getByRole('button',{name:'Einladung annehmen',exact:true}).click();
        await expect(pupil.getByRole('dialog',{name:'Am Schulkonto anmelden'})).toBeVisible();
        await page.reload();await classes(page);await expect(lesson(page).getByText(existing,{exact:false})).toBeVisible();
        await page.screenshot({path:test.info().outputPath('admin-teachers.png')});
    }finally{await context.close();}
});
