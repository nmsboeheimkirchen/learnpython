import {expect,test} from '@playwright/test';
async function open(page,url='/pico_level3.html?e2e'){
 await page.goto(url);await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 return page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());
}
async function run(page,code){return page.evaluate(async source=>{window.DroneMissionRuntime.editor.setValue(source);return window.DroneMissionRuntime.run();},code);}
async function solve(page){
 const values=await page.evaluate(()=>{
  const task=window.DroneMissionRuntime.getState().register;
  return Array.from({length:16},(_,n)=>Array.from({length:4},(_,i)=>(n>>i)&1?1:-1)).find(v=>window.NullpunktRegisterCore.evaluate(task,v).every(Boolean));
 });
 for(let i=0;i<4;i++)if(values[i]===-1)await page.locator('#spin-'+i).click();
}
test('@ipad Nullpunkt flies to PICO, changes camera, checks Q-04 and unlocks level 4 only after solving',async({page},testInfo)=>{
 test.setTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const starter=await open(page);
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','100');
 await expect(page.locator('#terminal-view')).toBeHidden();
 expect(await run(page,starter+'\nprint("PICO erreicht")')).toMatchObject({passed:false});
 await expect(page.locator('#terminal-view')).toBeHidden();
 const code=starter+'\nfliege_zu(220, 15)\n';
 expect(await run(page,code)).toMatchObject({passed:true,levelComplete:false});
 await expect(page.locator('#terminal-view')).toBeVisible();
 await expect(page.locator('#flight-workspace')).toBeHidden();
 await expect(page.locator('#register-title')).toHaveText('QUANTENREGISTER Q-04');
 await expect(page.locator('#register-rules li')).toHaveCount(4);
 await expect(page.locator('#register-help')).toBeVisible();
 await expect(page.locator('#register-help-btn')).toBeDisabled();
 await expect(page.locator('#register-hint')).toBeHidden();
 await expect(page.locator('#register-hint')).toBeEmpty();
 await expect(page.locator('#terminal-view')).not.toContainText('Denkspur');
 await page.locator('#register-help-btn').dispatchEvent('click');
 await expect(page.locator('#register-hint')).toBeHidden();
 await expect(page.locator('.register-tick:visible')).toHaveCount(0);
 const hintBox=await page.locator('#register-help').boundingBox(),cameraBox=await page.locator('.terminal-camera').boundingBox();
 expect(hintBox.y+hintBox.height).toBeLessThan(cameraBox.y);
 await expect(page.locator('#success-overlay')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level3)).toBeUndefined();
 await page.locator('#register-check').click();await expect(page.locator('#register-feedback')).toContainText('Zugriff verweigert');
 const matching=await page.evaluate(()=>window.DroneMissionRuntime.getState().checked.filter(Boolean).length);
 await expect(page.locator('.register-tick:visible')).toHaveCount(matching);
 await expect(page.locator('#register-hint')).toBeHidden();
 await expect(page.locator('#register-hint')).toBeEmpty();
 await page.locator('#register-help-btn').click();await expect(page.locator('#register-hint-title')).toHaveText('Analyse der Zentrale');
 await expect(page.locator('#register-hint')).toContainText('Ersetze Q1, Q2, Q3 und Q4');
 await expect(page.locator('.register-analysis li')).toHaveCount(matching);
 const analysis=await page.evaluate(()=>{const state=window.DroneMissionRuntime.getState();return window.NullpunktRegisterCore.reasoning(state.register,state.values,true);});
 await expect(page.locator('.register-analysis-summary')).toHaveText(analysis.summary);
 for(let i=0;i<analysis.lines.length;i++){
  await expect(page.locator('.register-analysis li').nth(i)).toHaveText(analysis.lines[i].label+': '+analysis.lines[i].equation+' ✓ Korrekt');
  await expect(page.locator('.register-analysis li').nth(i)).toHaveAttribute('value',String(analysis.lines[i].row));
 }
 await expect(page.locator('#register-help-btn')).toBeDisabled();
 await page.locator('#register-help-btn').dispatchEvent('click');
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().helpLevel)).toBe(1);
 for(let request=2;request<=4;request++){
  await page.locator('#register-check').click();await expect(page.locator('#register-hint')).toBeHidden();
  await page.locator('#register-help-btn').click();await expect(page.locator('#register-hint')).toBeVisible();
  await expect(page.locator('#register-hint')).not.toContainText('Ersetze Q1');
  await expect(page.locator('#register-help-btn')).toBeDisabled();
  expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().helpLevel)).toBe(request);
 }
 const outside=await page.locator('.register-screen').evaluate(screen=>{
  const box=screen.getBoundingClientRect();
  return [...screen.querySelectorAll('button,h2,li,#register-feedback')].filter(element=>{
   if(!element.getClientRects().length)return false;
   const rect=element.getBoundingClientRect();return rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1;
  }).map(element=>element.id||element.textContent);
 });
 expect(outside).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('nullpunkt-register.png'),fullPage:true});
 await solve(page);await page.locator('#register-check').click();
 await expect(page.locator('#register-unlocked')).toBeVisible();
 await expect(page.locator('#success-overlay')).toBeHidden();
 await page.screenshot({path:testInfo.outputPath('nullpunkt-unlocked.png'),fullPage:true});
 await page.locator('#register-continue').click();
 await expect(page.locator('#success-overlay')).toBeVisible();await expect(page.locator('#success-overlay .success-coin')).toHaveCount(4);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level3)).toBe(code);
 await page.getByRole('button',{name:'Zurück zum Terminal',exact:true}).click();
 await expect(page.locator('#unlocked-title')).toHaveText('UNLOCKED');
 await page.locator('#next-level-btn').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 const next=await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());expect(next).toContain('drohne.sende()');expect(next).not.toContain('# Operation Nullpunkt');
 expect(errors).toEqual([]);
});
test('@ipad Nullpunkt register resets with a new flight and cannot complete changed or cancelled code',async({page})=>{
 const starter=await open(page);
 const code=starter+'\nfliege_zu(220, 15)\n';await run(page,code);
 await page.locator('#spin-0').focus();await page.keyboard.press('Space');await expect(page.locator('#spin-0')).toHaveText('↓');
 await page.keyboard.press('Enter');await expect(page.locator('#spin-0')).toHaveText('↑');
 await page.locator('#back-to-flight').click();
 await page.evaluate(()=>window.DroneMissionRuntime.editor.setValue('print("Geändert")'));
 await page.locator('#return-to-terminal').click();await solve(page);await page.locator('#register-check').click();
 await expect(page.locator('#register-feedback')).toContainText('Flugcode wurde verändert');
 await expect(page.locator('#success-overlay')).toBeHidden();
 await page.locator('#back-to-flight').click();await page.locator('[data-mission-reset]').click();
 await expect(page.locator('#terminal-view')).toBeHidden();await expect(page.locator('#return-to-terminal')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({reached:false,solved:false,failures:0,values:[1,1,1,1]});
 // Reaching the target and then flying away must not leave camera access behind.
 expect(await run(page,code+'fliege_zu(120, 15)')).toMatchObject({passed:false});await expect(page.locator('#terminal-view')).toBeHidden();
});
test('@ipad Nullpunkt keeps old level 3 code and completed status',async({page})=>{
 await open(page);
 const old='# Alter eigener Code\nprint("Erhalten")';
 await page.evaluate(old=>{localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level3:old}));},old);
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(old);
 await expect(page.locator('#next-level-btn')).toBeVisible();await expect(page.locator('#terminal-view')).toBeHidden();
});
test('@ipad Nullpunkt keeps four green ticks for exactly three seconds and cancels pending unlocks on reset',async({page},testInfo)=>{
 test.setTimeout(45000);
 const starter=await open(page),code=starter+'\nfliege_zu(220, 15)\n';
 await run(page,code);
 await page.locator('#register-check').click();await expect(page.locator('.register-tick:visible')).not.toHaveCount(0);
 await page.locator('#register-help-btn').click();await expect(page.locator('#register-hint')).toBeVisible();
 await page.locator('#spin-0').click();await expect(page.locator('.register-tick:visible')).toHaveCount(0);
 await expect(page.locator('#register-hint')).toBeHidden();await expect(page.locator('#register-hint')).toBeEmpty();
 await expect(page.locator('#register-help-btn')).toBeDisabled();
 await page.locator('#spin-0').click(); // Return to all-up before filling the solution.
 await solve(page);
 await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.locator('#register-check').click();
 await expect(page.locator('.register-tick:visible')).toHaveCount(4);
 await expect(page.locator('.register-tick').first()).toHaveCSS('color','rgb(141, 255, 179)');
 await expect(page.locator('#register-check')).toBeDisabled();await expect(page.locator('#back-to-flight')).toBeDisabled();
 await expect(page.locator('#next-level-btn')).toBeHidden();await expect(page.locator('#register-unlocked')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level3)).toBeUndefined();
 await page.screenshot({path:testInfo.outputPath('nullpunkt-four-ticks.png'),fullPage:true});
 await page.clock.runFor(2999);
 await expect(page.locator('.register-tick:visible')).toHaveCount(4);await expect(page.locator('#register-unlocked')).toBeHidden();
 await page.clock.runFor(1);
 await expect(page.locator('#unlocked-title')).toBeVisible();await expect(page.locator('#register-puzzle')).toBeHidden();
 await expect(page.locator('#success-overlay')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level3)).toBe(code);
 await page.clock.resume();
 // A new flight clears the old timer/state; reset during the next pause cannot unlock later.
 await page.locator('#back-to-flight').click();await run(page,code);await solve(page);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.locator('#register-check').click();await expect(page.locator('.register-tick:visible')).toHaveCount(4);
 await page.evaluate(()=>window.DroneMissionRuntime.reset());
 await page.clock.runFor(4000);
 await expect(page.locator('#terminal-view')).toBeHidden();await expect(page.locator('#register-unlocked')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({solved:false,unlockPending:false,checked:null,helpLevel:0});
});
test('Nullpunkt camera fits a phone and uses actual flight animation',async({page},testInfo)=>{
 const starter=await open(page,'/pico_level3.html');
 await page.evaluate(()=>{window.__positions=[];new MutationObserver(()=>window.__positions.push(document.querySelector('#nullpunkt-drone').style.left)).observe(document.querySelector('#nullpunkt-drone'),{attributes:true,attributeFilter:['style']});});
 await run(page,starter+'\nfliege_zu(220, 15)\n');expect(await page.evaluate(()=>new Set(window.__positions).size)).toBeGreaterThan(3);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('#register-check')).toBeVisible();
 for(let i=0;i<4;i++){const box=await page.locator('#spin-'+i).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 await page.screenshot({path:testInfo.outputPath('nullpunkt-register-phone.png'),fullPage:true});
 await solve(page);await page.locator('#register-check').click();await expect(page.locator('#register-unlocked')).toBeVisible();
 await page.locator('#register-continue').click();await expect(page.locator('#success-overlay')).toBeVisible();
});
