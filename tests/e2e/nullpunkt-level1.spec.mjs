import {expect,test} from '@playwright/test';
async function open(page,url='/pico_level1.html?e2e'){
 await page.goto(url);await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 return page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());
}
async function run(page,source){return page.evaluate(async code=>{window.DroneMissionRuntime.editor.setValue(code);return window.DroneMissionRuntime.run();},source);}

test('@ipad Nullpunkt discovers the energy problem through flight, saves and resets with a drone marker',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const starter=await open(page);
 await expect(page.locator('h1')).toHaveText('Stoppe den Quantenangriff!');
 expect(starter).not.toMatch(/DROHNE|TRANSPONDER|shape\("turtle"\)/);
 expect(await page.locator('.drone-mission-intro,.mission-task-card,.mission-feedback').allInnerTexts()).not.toEqual(expect.arrayContaining([expect.stringMatching(/Reicht die Energie|Energieproblem|erst aufladen/)]));
 await expect(page.locator('#energy-warning')).toBeHidden();
 await expect(page.locator('#energy-discovery')).toHaveCount(0);
 await expect(page.locator('#nullpunkt-drone svg')).toBeVisible();
 expect(await run(page,starter)).toMatchObject({passed:false,levelComplete:false});
 expect(await run(page,starter+'\nprint("Energieproblem erkannt, Akku 0 %")')).toMatchObject({passed:false});
 const solution=starter+'\nfliege_zu(220, 15)\n';
 expect(await run(page,solution)).toMatchObject({passed:true,levelComplete:true});
 const state=await page.evaluate(()=>window.DroneMissionRuntime.getState());
 expect(state).toMatchObject({energy:0,depleted:true,discovered:true});
 expect(state.current.x).toBeLessThan(220);expect(state.current.x).toBeGreaterThan(-365);
 await expect(page.locator('#energy-warning')).toBeVisible();
 await expect(page.locator('#pico-mission-turtle')).toHaveCSS('opacity','0');
 await expect(page.locator('#next-level-btn')).toBeVisible();
 await expect(page.locator('#success-overlay')).toBeVisible({timeout:7000});
 await expect(page.locator('#success-overlay .success-coin')).toHaveCount(3);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')).pico_level1_navigation)).toBe(solution);
 await page.getByRole('button',{name:'Zurück zum Editor',exact:true}).click();
 await page.locator('#reset-btn').click();
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','10');
 await expect(page.locator('#energy-warning')).toBeHidden();
 await expect(page.locator('#flight-trail')).toHaveAttribute('points','');
 await page.screenshot({path:testInfo.outputPath('nullpunkt-start.png'),fullPage:true});
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 await expect(page.locator('#next-level-btn')).toBeVisible();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(solution);
 // Level 2 starts a fresh route to the bottle, preserving level-1 completion.
 await page.locator('#next-level-btn').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toContain('# Operation Nullpunkt - Level 2');
 expect(errors).toEqual([]);
});

test('@ipad Nullpunkt rejects the wrong flight and preserves an existing old completion',async({page})=>{
 const starter=await open(page);
 expect(await run(page,starter+'\nfliege_zu(0, -200)\n')).toMatchObject({passed:false});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({depleted:true,discovered:false});
 await expect(page.locator('#next-level-btn')).toBeHidden();
 const legacy='# legacy saved navigation\nprint("NOVA")';
 await page.evaluate(code=>{localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level1_navigation:code}));localStorage.removeItem('attemptedLevelCode_v1');},legacy);
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 await expect(page.locator('#next-level-btn')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')).pico_level1_navigation)).toBe(legacy);
});

test('@ipad Nullpunkt overview has four stages and the new mission title',async({page})=>{
 await page.goto('/missionen.html');
 await expect(page.locator('#link-pico-title')).toContainText('Operation Nullpunkt');
 await expect(page.locator('#link-pico-l1')).toContainText('Stoppe den Quantenangriff!');
 await expect(page.locator('#link-pico-l2a')).toHaveCount(0);
 await expect(page.locator('#link-pico-l4')).toContainText('Schalte PICO aus');
});

test('Nullpunkt flight moves visibly in real time and fits a phone',async({page},testInfo)=>{
 const starter=await open(page,'/pico_level1.html');
 await page.evaluate(()=>{
  window.__positions=[];
  new MutationObserver(()=>window.__positions.push(document.querySelector('#nullpunkt-drone').style.left)).observe(document.querySelector('#nullpunkt-drone'),{attributes:true,attributeFilter:['style']});
 });
 expect(await run(page,starter+'\nfliege_zu(220, 15)\n')).toMatchObject({passed:true});
 expect(await page.evaluate(()=>new Set(window.__positions).size)).toBeGreaterThan(3);
 await page.getByRole('button',{name:'Zurück zum Editor',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('#reset-btn').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('#nullpunkt-drone')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('nullpunkt-phone.png'),fullPage:true});
});

test('@ipad Nullpunkt alarm beeps once, holds continuation for seven seconds and cancels cleanly',async({page},testInfo)=>{
 await page.addInitScript(()=>{
  window.__tones=[];
  const parameter=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  window.AudioContext=class {
   state='suspended';currentTime=0;destination={};
   resume(){this.state='running';return Promise.resolve();}
   createOscillator(){return {frequency:parameter(),connect(){},disconnect(){},start(){window.__tones.push(Date.now());},stop(){}};}
   createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
  };
 });
 const starter=await open(page);
 await page.clock.install();
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.evaluate(()=>{
  new MutationObserver(()=>{
   if(!document.querySelector('#energy-warning').hidden)window.__alarmStarted??=Date.now();
  }).observe(document.querySelector('#energy-warning'),{attributes:true,attributeFilter:['hidden']});
 });
 const upperRun=page.locator('[data-mission-run]');
 async function startAlarm(){
  await page.evaluate(code=>{window.__alarmStarted=null;window.DroneMissionRuntime.editor.setValue(code);},starter+'\nfliege_zu(220, 15)\n');
  await upperRun.click();
  for(let tick=0;tick<20;tick++){
   await page.clock.runFor(50);
   if(await page.locator('#energy-warning').isVisible())return;
  }
  throw new Error('The stopped drone did not show its alarm.');
 }
 await startAlarm();
 await expect(page.locator('#energy-warning')).toContainText('Akku: kritischer Zustand!');
 await expect(upperRun).toBeDisabled();
 await expect(page.locator('#run-btn')).toBeDisabled();
 await expect(page.locator('#presentation-run-btn')).toBeDisabled();
 expect(await page.evaluate(()=>window.__tones.length)).toBe(1);
 const remaining=await page.evaluate(()=>6999-(Date.now()-window.__alarmStarted));
 expect(remaining).toBeGreaterThan(0);
 await page.clock.runFor(remaining);
 await expect(page.locator('#success-overlay')).toBeHidden();
 await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.isRunning())).toBe(true);
 // Even direct/keyboard-style run requests cannot reset or bypass the pause.
 await page.evaluate(()=>window.DroneMissionRuntime.run());
 expect(await page.evaluate(()=>window.__tones.length)).toBe(1);
 await page.screenshot({path:testInfo.outputPath('nullpunkt-alarm.png'),fullPage:true});
 await page.clock.runFor(1);
 await expect(page.locator('#success-overlay')).toBeVisible();
 await expect(page.locator('#next-level-btn')).toBeVisible();
 await page.getByRole('button',{name:'Zurück zum Editor',exact:true}).click();
 await page.locator('[data-mission-reset]').click();
 await startAlarm();
 expect(await page.evaluate(()=>window.__tones.length)).toBe(2);
 await page.locator('[data-mission-reset]').click();
 await expect(page.locator('#energy-warning')).toBeHidden();
 await expect(upperRun).toBeEnabled();
 await page.clock.runFor(7500);
 await expect(page.locator('#success-overlay')).toBeHidden();
 await expect(page.locator('#next-level-btn')).toBeHidden();
 await expect(page.locator('#energy-meter')).toHaveAttribute('aria-valuenow','10');
 expect(await page.evaluate(()=>window.__tones.length)).toBe(2);
});

test('PICO editors keep an upper flight button and compact instructions',async({page})=>{
 for(const level of ['1','2','2a','3','4']){
  await open(page,`/pico_level${level}.html?e2e`);
  const upperRun=page.locator('[data-mission-run]');
  await expect(upperRun).toHaveText('▶ Flug starten');
  await expect(page.locator('#editor-panel > .mission-section-heading')).toHaveCount(0);
  const button=await upperRun.boundingBox(),editor=await page.locator('.CodeMirror').boundingBox();
  expect(button.y+button.height).toBeLessThan(editor.y);
  if(level==='1'){
   const panel=await page.locator('#editor-panel').boundingBox();
   expect(editor.y-panel.y).toBeLessThan(200);
   expect(editor.y).toBeLessThan(640);
  }
  // Upper button is wired to the same runtime on every legacy stage too.
  await page.evaluate(()=>window.DroneMissionRuntime.editor.setValue('print("Oberer Startknopf")'));
  await upperRun.click();
  await expect(page.locator('#console-output')).toContainText('Oberer Startknopf');
  await expect(upperRun).toHaveText('▶ Flug starten');
 }
});
