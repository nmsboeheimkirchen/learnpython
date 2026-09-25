import {test,expect} from '@playwright/test';
import {fixture} from './fixtures.mjs';
const password='Synthetic-browser-password-123!';
const lesson=page=>page.frameLocator('#account-lesson');
async function login(page,email){
    await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
    await page.goto('/');await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(page.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
    await expect(lesson(page).locator('[data-next-target]')).toBeVisible();
}
async function api(page,action,body){
    return page.evaluate(async({action,body})=>{
        const s=await fetch('/api/index.php?action=session').then(r=>r.json());
        const response=await fetch('/api/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken,'X-Agentpy-Profile':s.profile?.id||''},...(body===undefined?{}:{body:JSON.stringify(body)})});
        const data=await response.json();if(!response.ok)throw Error(data.error?.code);return data;
    },{action,body});
}
async function classes(page){await page.getByRole('button',{name:'Benutzermenü'}).click();await page.getByRole('button',{name:'Meine Klassen',exact:true}).click();await expect(lesson(page).getByRole('heading',{name:'Meine Klassen',exact:true})).toBeVisible();}
async function room(page,name){await lesson(page).locator('article').filter({hasText:name}).getByRole('button',{name:'Klasse ansehen'}).click();await expect(lesson(page).getByRole('heading',{name,exact:true})).toBeVisible();}

test('student transfer UI: own-class move, foreign approval and preserved student progress',async({page,browser})=>{
    test.setTimeout(120000);const engine=test.info().project.name;
    const pupilContext=await browser.newContext(),targetContext=await browser.newContext();
    const pupil=await pupilContext.newPage(),target=await targetContext.newPage();
    try{
        await login(page,`transfer-owner-${engine}@example.test`);await login(target,`transfer-target-${engine}@example.test`);await login(pupil,`transfer-student-${engine}@example.test`);
        const a=(await api(page,'teacher-create-class',{name:'Transfer A '+engine})).class;
        const b=(await api(page,'teacher-create-class',{name:'Transfer B '+engine})).class;
        const c=(await api(target,'teacher-create-class',{name:'Transfer C '+engine})).class;
        const profile=(await api(pupil,'session')).profile;fixture('membership-add',{id:profile.id,classId:a.id});
        await api(pupil,'write',{expectedRevision:0,operationId:crypto.randomUUID(),command:{type:'complete',levelId:'mission1_level1',code:'print("Same account")'}});
        await classes(page);await room(page,a.name);
        await lesson(page).getByRole('button',{name:'transfer-student einer anderen Klasse zuordnen'}).click();
        const dialog=page.getByRole('dialog',{name:'Schüler:in zuordnen'});
        await expect(dialog.getByLabel('Art der Zuordnung')).toHaveValue('move');
        await dialog.getByLabel('Zielklasse',{exact:true}).selectOption(b.id);
        await expect(dialog.getByLabel('Klassencode der Zielklasse')).not.toBeVisible();
        await page.screenshot({path:test.info().outputPath('student-transfer-own.png')});
        await dialog.getByRole('button',{name:'Zuordnung bestätigen'}).click();
        await expect(lesson(page).getByText('Noch keine Anmeldungen.',{exact:false})).toBeVisible();
        await lesson(page).getByRole('button',{name:'Meine Klassen',exact:true}).click();await room(page,b.name);
        await expect(lesson(page).getByRole('button',{name:'Fortschritt von transfer-student',exact:true})).toHaveText('5 %');
        await lesson(page).getByRole('button',{name:'transfer-student einer anderen Klasse zuordnen'}).click();
        await dialog.getByLabel('Art der Zuordnung').selectOption('add');await dialog.getByLabel('Zielklasse',{exact:true}).selectOption('');
        await dialog.getByLabel('Klassencode der Zielklasse').fill(c.invitation.code);
        await expect(dialog).toContainText('10 Tage');await expect(dialog).toContainText('reserviert keinen Platz');
        await dialog.getByRole('button',{name:'Zuordnung bestätigen'}).click();
        await expect(page.getByRole('dialog',{name:'Anfrage gesendet'})).toContainText('Bis zur Zustimmung bleibt alles unverändert');
        await page.getByRole('dialog').getByRole('button',{name:'Schließen',exact:true}).click();
        await classes(target);await expect(lesson(target).getByRole('heading',{name:'Schülerübertragungen'})).toBeVisible();
        const request=lesson(target).locator('.teacher-transfer-row').filter({hasText:profile.email});
        await expect(request).toContainText('Zusätzlich zuordnen');await request.getByRole('button',{name:'Annehmen',exact:true}).click();
        await expect(target.getByRole('dialog')).toContainText('bleibt zusätzlich');
        await target.screenshot({path:test.info().outputPath('student-transfer-approve.png')});
        await target.getByRole('dialog').getByRole('button',{name:'Annehmen',exact:true}).click();
        await expect(request).toHaveCount(0);await room(target,c.name);
        await expect(lesson(target).getByRole('button',{name:'Fortschritt von transfer-student',exact:true})).toHaveText('5 %');
        await pupil.reload();await expect(pupil.getByRole('button',{name:'Benutzermenü'})).toBeVisible();
        const after=(await api(pupil,'session')).profile;
        expect(after.id).toBe(profile.id);expect(after.classes.map(x=>x.id)).toEqual(expect.arrayContaining([profile.classId,b.id,c.id]));expect(after.classes.map(x=>x.id)).not.toContain(a.id);
        expect((await api(pupil,'state')).state.data.completedCodes.mission1_level1).toBe('print("Same account")');
    }finally{await pupilContext.close();await targetContext.close();}
});
