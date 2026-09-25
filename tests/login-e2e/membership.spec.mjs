import {test,expect} from '@playwright/test';
import {fixture} from './fixtures.mjs';
const password='Synthetic-browser-password-123!';
const lesson=page=>page.frameLocator('#account-lesson');
const child=page=>page.frames().find(f=>f.parentFrame()===page.mainFrame());
async function open(page){
    await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
    await page.goto('/');await expect(page.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
}
async function login(page,email){
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
    await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
    await expect(lesson(page).locator('[data-next-target]')).toBeVisible();
}
async function api(page,action,body){
    return child(page).evaluate(async({action,body})=>{
        const s=await fetch('/api/index.php?action=session').then(r=>r.json());
        const r=await fetch('/api/index.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'X-Agentpy-Profile':s.profile?.id||''},body:JSON.stringify(body)});
        const result=await r.json();if(!r.ok)throw Error(result.error?.code);return result;
    },{action,body});
}
test('same-domain signup, teacher confirmation/correction, logout and shared-class deletion preserve progress',async({page,browser})=>{
    test.setTimeout(120000);
    await open(page);await login(page,`membership-teacher-${test.info().project.name}@example.test`);
    const a=(await api(page,'teacher-create-class',{name:'A – gemeinsam'})).class;
    const b=(await api(page,'teacher-create-class',{name:'B – bleibt'})).class;
    const studentContext=await browser.newContext(),pupil=await studentContext.newPage();
    try{
        await open(pupil);
        await pupil.getByRole('button',{name:'Anmelden',exact:true}).click();
        await pupil.getByRole('button',{name:'Neuanmeldung',exact:true}).click();
        await pupil.getByLabel('Klassencode',{exact:true}).fill(a.invitation.code);
        await pupil.getByRole('button',{name:'Klassencode prüfen',exact:true}).click();
        const form=pupil.getByRole('dialog');
        await form.getByLabel('Name',{exact:true}).fill('Ada Falsch');
        const email=`wrong-${test.info().project.name}@example.test`,corrected=`corrected-${test.info().project.name}@example.test`;
        await form.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await form.getByLabel('Passwort (mindestens 8 Zeichen)',{exact:true}).fill(password);
        await form.getByLabel('Passwort wiederholen',{exact:true}).fill(password);
        await form.getByRole('button',{name:'Konto anlegen',exact:true}).click();
        await expect(form).toContainText('ohne Bestätigungslink');
        expect(fixture('registration-inspect',{email}).pending).toBe(false);
        await form.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();
        await pupil.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
        await pupil.getByLabel('Passwort',{exact:true}).fill(password);
        await pupil.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
        await expect(pupil.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        const state=await child(pupil).evaluate(async()=>{
            const s=await fetch('/api/index.php?action=session').then(r=>r.json());
            const state=await fetch('/api/index.php?action=state',{headers:{'X-Agentpy-Profile':s.profile.id}}).then(r=>r.json());
            const r=await fetch('/api/index.php?action=write',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'X-Agentpy-Profile':s.profile.id},body:JSON.stringify({expectedRevision:state.state.revision,operationId:crypto.randomUUID(),command:{type:'complete',levelId:'mission1_level1',code:'print("Keep this")'}})});
            if(!r.ok)throw Error('Test progress write');return s.profile.id;
        });
        fixture('membership-add',{id:state,classId:b.id});
        await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();
        await lesson(page).locator('article').filter({hasText:a.name}).getByRole('button',{name:'Klasse ansehen'}).click();
        await expect(lesson(page).getByRole('button',{name:'E-Mail von Ada Falsch bestätigen?'})).toBeVisible();
        await lesson(page).getByRole('button',{name:'E-Mail von Ada Falsch bestätigen?'}).click();
        await expect(page.getByRole('dialog')).toContainText(email);
        await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
        await lesson(page).getByRole('button',{name:'E-Mail von Ada Falsch bestätigen?'}).click();
        await page.getByRole('button',{name:'Ja',exact:true}).click();
        await expect(lesson(page).getByText('Bestätigt',{exact:true})).toBeVisible();
        await lesson(page).getByRole('button',{name:'Ada Falsch bearbeiten'}).click();
        await page.getByLabel('Name',{exact:true}).fill('Ada Korrekt');
        await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(corrected);
        await page.getByRole('button',{name:'Speichern',exact:true}).click();
        await expect(lesson(page).getByText(corrected,{exact:true})).toBeVisible();
        await pupil.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
        await expect(lesson(pupil).locator('[data-next-target]')).toBeVisible();
        await expect(pupil.getByRole('button',{name:'Anmelden',exact:true})).toBeVisible();
        await login(pupil,corrected);
        await expect(lesson(pupil).locator('[data-next-target]')).toHaveText('System Access · 01-2');
        await lesson(page).getByRole('button',{name:'E-Mail von Ada Korrekt bestätigen?'}).click();
        await page.getByRole('button',{name:'Nein: Bearbeiten',exact:true}).click();
        await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toHaveValue(corrected);
        await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
        await lesson(page).getByRole('button',{name:'Klasse löschen',exact:true}).click();
        await expect(page.locator('ul.teacher-preserved')).toContainText(corrected);
        await expect(page.locator('ul.teacher-preserved')).toContainText(b.name);
        await expect(page.locator('ul.teacher-preserved')).toContainText('bleiben erhalten');
        await expect(page.locator('.teacher-danger').first()).toHaveCSS('color','rgb(241, 160, 166)');
        await page.screenshot({path:test.info().outputPath('shared-class-deletion.png')});
        await page.getByLabel('Tippe zur Bestätigung LÖSCHEN').fill('LÖSCHEN');
        for(const checkbox of await page.getByRole('dialog').getByRole('checkbox').all())await checkbox.check();
        await page.getByRole('dialog').getByRole('button',{name:'Klasse löschen',exact:true}).click();
        await pupil.reload();await expect(lesson(pupil).locator('[data-next-target]')).toHaveText('System Access · 01-2');
        await lesson(page).locator('article').filter({hasText:b.name}).getByRole('button',{name:'Klasse ansehen'}).click();
        await expect(lesson(page).getByText('Ada Korrekt',{exact:true})).toBeVisible();
        await expect(lesson(page).getByRole('button',{name:'Fortschritt von Ada Korrekt',exact:true})).toHaveText('5 %');
        await lesson(page).getByRole('button',{name:'Klasse löschen',exact:true}).click();
        await expect(page.locator('ul.teacher-preserved')).toHaveCount(0);
        await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
    }finally{await studentContext.close();}
});
