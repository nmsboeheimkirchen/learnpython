import {expect,test} from '@playwright/test';
async function open(page,url='/pico_level2.html?e2e'){
 await page.goto(url);await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 return page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());
}
const route='\nfliege_zu(-455, -85)\n';
const investigate='fund = drohne.suche_hier()\nprint(fund)\n';
const collect='fund = drohne.suche_hier()\nprint("Gefunden:", fund)\nausruestung.append(fund)\n';
const prepare=code=>code.replace('import turtle','import turtle\n\nausruestung = []');
async function run(page,code){return page.evaluate(async source=>{window.DroneMissionRuntime.editor.setValue(source);return window.DroneMissionRuntime.run();},code);}
async function start(page,code){
 await page.evaluate(source=>{window.DroneMissionRuntime.editor.setValue(source);},code);
 await page.locator('[data-mission-run]').click();
}

test('@ipad Nullpunkt level 2 charges visibly from a real find, saves and continues directly to level 3',async({page},testInfo)=>{
 test.setTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const starter=await open(page);
 await expect(page.locator('h1')).toHaveText('Finden und aufladen');
 expect(starter).not.toMatch(/DROHNE|TRANSPONDER|shape\("turtle"\)/);
 expect(starter).not.toContain('ausruestung');
 await expect(page.locator('#learning-step')).toContainText('Schritt 1 von 2');
 await expect(page.locator('#equipment-task')).toBeHidden();
 await expect(page.locator('#nullpunkt-help')).toBeHidden();
 await page.locator('.nullpunkt-code-help summary').click();
 await expect(page.locator('.nullpunkt-code-help li')).toHaveCount(2);
 await expect(page.locator('.nullpunkt-code-help')).not.toContainText('append');
 await page.locator('.nullpunkt-code-help summary').click();
 await expect(page.locator('.mission-scene')).toHaveAttribute('src',/pico-command-lab-v3\.webp$/);
 expect(await run(page,starter)).toMatchObject({passed:false});
 await page.screenshot({path:testInfo.outputPath('nullpunkt-level2-start.png'),fullPage:true});
 const searchCode=starter+route+investigate;
 expect(await run(page,searchCode)).toMatchObject({passed:true,levelComplete:false});
 await expect(page.locator('#learning-step')).toContainText('Schritt 2 von 2');
 await expect(page.locator('#validation-title')).toHaveText('Schritt 1 geschafft');
 await expect(page.locator('#search-task')).toBeHidden();
 await expect(page.locator('#nullpunkt-help-panel')).toBeHidden();
 await expect(page.locator('#next-level-btn')).toBeHidden();
 await expect(page.locator('#success-overlay')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(searchCode);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level2)).toBeUndefined();
 const help=page.locator('#nullpunkt-help-btn'),hints=page.locator('#nullpunkt-help-panel');
 await help.click();await expect(hints).toContainText('Hinweis 1 von 3');await expect(hints).toContainText('print(fund)');await expect(hints).not.toContainText('append');
 await page.screenshot({path:testInfo.outputPath('nullpunkt-level2-step2.png'),fullPage:true});
 await help.click();await expect(hints).toContainText('ausruestung = []');await expect(hints).not.toContainText('ausruestung.append(fund)');
 await help.click();await expect(hints).not.toContainText('ausruestung.append(fund)');await expect(page.locator('#list-warning')).toContainText('Lege die Liste');
 expect(await run(page,prepare(searchCode))).toMatchObject({passed:false,levelComplete:false});
 await expect(page.locator('#equipment-hud')).toContainText('ausruestung:leer');
 await expect(page.locator('#list-warning')).toBeHidden();
 await help.click();await expect(hints).toContainText('ausruestung.append(fund)');
 await help.click();await expect(hints).toContainText('Hinweis 3 von 3');
 // A last asynchronous movement must not postpone charge detection until after validation.
 const solution=prepare(searchCode)+'drohne.goto(-455, -85)\nausruestung.append(fund)\n';
 await start(page,solution);
 await expect(page.locator('body')).toHaveClass(/nullpunkt-charging/);
 await expect.poll(async()=>Number(await page.locator('#energy-meter').getAttribute('aria-valuenow'))).toBeGreaterThan(10);
 const mid=Number(await page.locator('#energy-meter').getAttribute('aria-valuenow'));expect(mid).toBeLessThan(100);
 await expect(page.locator('#next-level-btn')).toBeHidden();
 await page.screenshot({path:testInfo.outputPath('nullpunkt-level2-charging.png'),fullPage:true});
 await expect(page.locator('#success-overlay')).toBeVisible();
 await expect(page.locator('#success-overlay .success-coin')).toHaveCount(4);
 await expect(page.locator('#success-overlay .success-btn')).toHaveAttribute('href','pico_level3.html');
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','100');
 await expect(page.locator('#energy-warning')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({found:true,printed:true,charged:true,energy:100});
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level2)).toBe(solution);
 await page.getByRole('button',{name:'Zurück zum Editor',exact:true}).click();
 await page.locator('[data-mission-reset]').click();
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','10');
 await expect(page.locator('#charge-status')).toBeHidden();
 await expect(page.locator('#learning-step')).toContainText('Schritt 1 von 2');
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(starter);
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(solution);
 await expect(page.locator('#next-level-btn')).toBeVisible();
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','10'); // no invented replay
 await page.locator('#next-level-btn').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 const nextStarter=await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());
 expect(nextStarter).toContain('# Operation Nullpunkt - Level 3');expect(nextStarter).toContain('drohne.goto(-455, -85)');
 expect(errors).toEqual([]);
});

test('@ipad Nullpunkt level 2 rejects invented finds, missing output and search away from the bottle',async({page})=>{
 const starter=prepare(await open(page));
 expect(await run(page,starter+route+'print("Energiezelle")\nausruestung.append("Energiezelle")')).toMatchObject({passed:false});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({found:false,charged:false});
 expect(await run(page,starter+'\n'+collect)).toMatchObject({passed:false});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({found:false,charged:false,lastSearchFailure:'WRONG_PLACE'});
 expect(await run(page,starter+route+'fund = drohne.suche_hier()\nprint(fund)')).toMatchObject({passed:true,levelComplete:false});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({found:true,printed:true,charged:false});
 expect(await run(page,starter+route+'fund = drohne.suche_hier()\nausruestung.append(fund)')).toMatchObject({passed:false});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({found:true,printed:false,charged:true});
 await expect(page.locator('#next-level-btn')).toBeHidden();
 await expect(page.locator('#success-overlay')).toBeHidden();
});

test('@ipad Nullpunkt level 2 cancels an empty-battery alarm and a pending charge without a late success',async({page})=>{
 const starter=await open(page);
 await start(page,starter+'\nfliege_zu(220, 15)');
 await expect(page.locator('#energy-warning')).toBeVisible();
 await expect(page.locator('#next-level-btn')).toBeHidden();
 await page.locator('[data-mission-reset]').click();
 await expect(page.locator('#energy-warning')).toBeHidden();
 await expect(page.locator('[data-mission-run]')).toBeEnabled();
 await start(page,prepare(starter)+route+collect);
 await expect(page.locator('body')).toHaveClass(/nullpunkt-charging/);
 // Dispatch at the detected charge phase; tablet scrolling can outlast the short animation.
 await page.locator('[data-mission-reset]').dispatchEvent('click');
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','10');
 await expect(page.locator('[data-mission-run]')).toBeEnabled();
 await page.waitForTimeout(3000);
 await expect(page.locator('#charge-status')).toBeHidden();
 await expect(page.locator('#success-overlay')).toBeHidden();
 await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level2)).toBeUndefined();
});

test('@ipad Nullpunkt level 2 preserves older attempts and completions without inventing a charge',async({page})=>{
 await open(page);
 const legacy='# Existing learner code\nprint("Mein alter Fund")';
 const attempted=legacy+'\n# Noch in Arbeit';
 const ownLevel3='# Existing level 3 attempt\nprint("Eigener Code")';
 await page.evaluate(({legacy,attempted,ownLevel3})=>{
  localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level2:legacy}));
  localStorage.setItem('attemptedLevelCode_v1',JSON.stringify({pico_level2:attempted,pico_level3:ownLevel3}));
 },{legacy,attempted,ownLevel3});
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(attempted);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({energy:10,charged:false,found:false});
 await expect(page.locator('#next-level-btn')).toBeVisible();
 await page.locator('#next-level-btn').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(ownLevel3);
});

test('Nullpunkt level 2 uses a real animated drone and fits a phone',async({page},testInfo)=>{
 const starter=await open(page,'/pico_level2.html');
 await page.evaluate(()=>{window.__flightPositions=[];new MutationObserver(()=>window.__flightPositions.push(document.querySelector('#nullpunkt-drone').style.top)).observe(document.querySelector('#nullpunkt-drone'),{attributes:true,attributeFilter:['style']});});
 const result=await run(page,prepare(starter)+route+collect);expect(result.passed).toBe(true);
 expect(await page.evaluate(()=>new Set(window.__flightPositions).size)).toBeGreaterThan(3);
 await page.getByRole('button',{name:'Zurück zum Editor',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-mission-reset]').click();
 await page.locator('.nullpunkt-code-help summary').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('[data-mission-run]')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('nullpunkt-level2-phone.png'),fullPage:true});
});

test('@ipad Nullpunkt list names, gated hints and erased finds follow the learner code',async({page},testInfo)=>{
 test.setTimeout(45000);
 const starter=await open(page),search=starter+route+investigate;
 await run(page,search);
 await run(page,prepare(search).replaceAll('ausruestung','inventar'));
 await expect(page.locator('#list-warning')).toHaveText('Falscher Name, deine Liste soll ausruestung heißen!');
 await expect(page.locator('#equipment-hud')).toBeHidden();
 await run(page,search);await expect(page.locator('#list-warning')).toHaveText('Lege die Liste ausruestung an!');
 for(const name of ['ausruestung','AUSRÜSTUNG','Ausrüstung','Ausruestung','AUSRUESTUNG']){
  const result=await run(page,prepare(search).replaceAll('ausruestung',name));
  expect(result).toMatchObject({passed:false,levelComplete:false});
  await expect(page.locator('#equipment-name')).toHaveText(name+':');
  await expect(page.locator('#equipment-items')).toHaveText('leer');
  await expect(page.locator('#list-warning')).toBeHidden();
  expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().listRunConfirmed)).toBe(true);
 }
 const erased=prepare(starter)+route+collect+'ausruestung = []\n';
 expect(await run(page,erased)).toMatchObject({passed:false,levelComplete:false});
 await expect(page.locator('#list-warning')).toHaveText('Die leere Liste muss weiter oben stehen, damit sie den aufgenommenen Fund nicht wieder löscht.');
 await expect(page.locator('#equipment-items')).toHaveText('leer');
 await page.screenshot({path:testInfo.outputPath('nullpunkt-list-warning.png'),fullPage:true});
 // An empty list after the search is allowed if it precedes the append.
 expect(await run(page,search+'Ausrüstung = []\nAusrüstung.append(fund)\n')).toMatchObject({passed:true,levelComplete:true});
 await expect(page.locator('#equipment-name')).toHaveText('Ausrüstung:');
 await expect(page.locator('#equipment-items')).toHaveText('Energiezelle');
});
