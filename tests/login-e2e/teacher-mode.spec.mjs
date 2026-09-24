import {test,expect} from '@playwright/test';
const pages=['mission1_level1','mission1_level2','mission1_level3','mission1_level4','mission2_level1','mission2_level2','mission2_level3','mission3_level1','mission3_level2','mission3_level3','mission4_level1','mission4_level2','mission4_level3','agent_training_level1','agent_training_level2','agent_training_level3','pico_level1','pico_level2','pico_level2a','pico_level3','pico_level4','pixelmuseum_briefing','pixelmuseum_finale','helikopter_flucht_level1','helikopter_flucht_level2'];
const lesson=page=>page.frameLocator('#account-lesson');
const frame=page=>page.frames().find(f=>f.parentFrame()===page.mainFrame());
async function configure(page){
    await page.addInitScript(()=>{window.AgentAccountConfig={enabled:true,endpoint:'api/index.php',saveMode:'attempts',shell:true};});
}
async function login(page,account){
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(`${account}-${test.info().project.name}@example.test`);
    await page.getByLabel('Passwort',{exact:true}).fill('Synthetic-browser-password-123!');
    await page.getByRole('dialog').getByRole('button',{name:'Anmelden',exact:true}).click();
    await expect(lesson(page).locator('[data-next-target]')).toBeVisible();
}
for(const mode of ['guest','teacher','pupil']){
    test(`teacher solutions across every level: ${mode}, session persistence and no URL-role escalation`,async({page,context})=>{
        test.setTimeout(180000);await configure(page);
        const errors=[];page.on("pageerror",error=>errors.push(error.message));
        await page.goto('/mission1_level1.html#l');
        await expect(lesson(page).locator('[data-teacher-solution]').first()).toBeVisible();
        if(mode!=='guest'){
            // B1: login starts from a guest lesson and MUST land on home.
            await login(page,mode==='teacher'?'teacher':'mode-student');
        }
        for(const name of pages){
            await page.goto('/'+name+'.html'+(mode==='pupil'?'#l':''));
            await expect(lesson(page).locator('html')).not.toHaveClass(/account-blocked/);
            await expect.poll(()=>frame(page)?.evaluate(()=>Boolean(window.AgentDeviceSettings)), {message:`${mode}: ${name} settings readiness`}).toBe(true);
            expect(await frame(page).evaluate(()=>window.AgentDeviceSettings.isTeacherMode()),name).toBe(mode!=='pupil');
            const buttons=lesson(page).locator('[data-teacher-solution]');
            expect(await buttons.count(),name).toBeGreaterThan(0);
            for(const b of await buttons.all())mode==='pupil'?await expect(b).toBeHidden():await expect(b).toBeVisible();
            expect(await frame(page).evaluate(()=>location.hash),name).not.toBe('#l');
        }
        expect(errors).toEqual([]);
        if(mode==='guest'){
            const fresh=await context.newPage();await configure(fresh);await fresh.goto('/mission1_level1.html');
            await expect(lesson(fresh).locator('[data-teacher-solution]').first()).toBeHidden();
            await fresh.close();
        }
    });
}
