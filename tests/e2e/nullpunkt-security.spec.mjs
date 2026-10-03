import {expect,test} from '@playwright/test';
const assignment=n=>`def kalibrieren(werte):\n    for i in range(len(werte)):\n        if werte[i] > 0:\n            werte[i] = ${n}\n    return werte`;
async function open(page){await page.goto('/pico_level4.html?e2e');await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);}
async function begin(page,code){await page.evaluate(code=>{window.DroneMissionRuntime.editor.setValue(code);window.__run=window.DroneMissionRuntime.run();},code);}
const state=page=>page.evaluate(()=>window.DroneMissionRuntime.getState());
async function warning(page){await expect(page.locator('#calibration-alert-text')).toHaveText('Fehler erkannt',{timeout:10000});}
async function stop(page){await page.locator('.calibration-stop').click();await page.evaluate(()=>window.__run);await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.isRunning())).toBe(false);}
async function solveFrame(page){
 const frame=page.frameLocator('#calibration-login-frame');
 await expect(frame.locator('#register-check')).toBeVisible();
 const values=await frame.locator('body').evaluate(()=>{
  const task=window.DroneMissionRuntime.getState().register;
  return Array.from({length:16},(_,n)=>Array.from({length:4},(_,i)=>(n>>i)&1?1:-1)).find(v=>window.NullpunktRegisterCore.evaluate(task,v).every(Boolean));
 });
 for(let i=0;i<4;i++)if(values[i]===-1)await frame.locator('#spin-'+i).click();
 await frame.locator('#register-check').click();await expect(frame.locator('.register-tick:visible')).toHaveCount(4);
 await expect(frame.locator('#register-unlocked')).toBeVisible();await frame.locator('#register-continue').click();
}

test('@ipad Assignments 1 and 10000 appear before detection, and timely stopping preserves code and analysis',async({page},info)=>{
 test.setTimeout(35000);await open(page);
 for(const n of ['1','10000']){
  const code=assignment(n);await begin(page,code);
  await expect.poll(async()=> (await state(page)).values[0]).toBe(Number(n));
  await expect(page.locator('#calibration-alert')).toBeHidden();
  await expect(page.locator('#calibration-value-0')).toHaveText(n==='10000'?'+10000 %':'+1 %');
  await warning(page);const observed=await state(page);
  expect(observed.effectHistory.find(e=>e.event==='error-detected').elapsed).toBeGreaterThanOrEqual(1950);
  await page.screenshot({path:info.outputPath('detected-'+n+'.png'),fullPage:true});
  await stop(page);expect((await state(page)).securityLocked).toBe(false);
  expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
  await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('K1:');
  await expect(page.locator('#calibration-help')).toContainText(n==='10000'?'→ +10000 %':'→ +1 %');
  await expect(page.locator('#calibration-help')).toContainText('Kontrollsumme:');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBeUndefined();
 }
 expect((await state(page)).stoppedErrors).toBe(2);
});

test('@ipad Ignored warning locks access; the real level 3 puzzle restores the exact code without another reward',async({page},info)=>{
 test.setTimeout(45000);await open(page);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(()=>localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level3:'# Originaler Flug'})));
 const code='# Mein Versuch bleibt erhalten\n'+assignment('10000');await begin(page,code);await warning(page);
 await expect(page.locator('#calibration-alert-text')).toHaveText('Manipulation erkannt',{timeout:8000});
 await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');await page.evaluate(()=>window.__run);
 const locked=await state(page);expect(locked.securityLocked).toBe(true);
 const detected=locked.effectHistory.find(e=>e.event==='error-detected'),manipulated=locked.effectHistory.find(e=>e.event==='manipulation-detected');
 expect(manipulated.elapsed-detected.elapsed).toBeGreaterThanOrEqual(4950);
 await page.evaluate(()=>{window.DroneMissionRuntime.reset();window.DroneMissionRuntime.run();window.postMessage({type:'nullpunkt:terminal-unlocked'},location.origin);});
 expect((await state(page)).securityLocked).toBe(true);
 await expect(page.locator('#next-level-btn')).toBeHidden();
 // The inner puzzle must stay self-contained even in an account-enabled build.
 const accountRequests=[];
 await page.route('**/assets/data/account-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.AgentAccountConfig={enabled:true,shell:true,endpoint:"/api/index.php"};'}));
 page.on('request',request=>{if(request.url().includes('/api/'))accountRequests.push(request.url());});
 await page.locator('#calibration-relogin').click();
 const frame=page.frameLocator('#calibration-login-frame');await expect(frame.locator('.register-lock')).toBeVisible();
 await expect(frame.locator('#learning-nav-dock')).toBeHidden();await expect(frame.locator('.account-fullscreen')).toBeHidden();
 await expect(frame.locator('#back-to-flight')).toBeHidden();await expect(frame.locator('#flight-workspace')).toBeHidden();
 await expect(frame.locator('#register-hint')).toBeHidden();
 await frame.locator('#register-check').click();
 await frame.locator('#register-help-btn').click();
 await expect(frame.locator('.register-analysis li')).toHaveCount(4);
 await expect(frame.locator('.register-analysis .is-failed').first()).toContainText('Nicht erfüllt · erwartet');
 await expect(frame.locator('.register-analysis-caution')).toContainText('(−1) · (−1) = +1 und (+1) · (+1) = +1');
 await expect.poll(()=>page.locator('#calibration-login-frame').evaluate(element=>{
  const layout={height:element.clientHeight,documentHeight:element.contentDocument.documentElement.scrollHeight,mainHeight:element.contentDocument.getElementById('main-content').scrollHeight};
  return layout.documentHeight-layout.height>2?layout:null;
 })).toBeNull();
 await page.screenshot({path:info.outputPath('reauth-terminal.png'),fullPage:true});
 await solveFrame(page);await expect(page.locator('#calibration-return-note')).toBeVisible();
 await expect(page.locator('#validation-title')).toHaveText('Letzten Codeversuch untersuchen');
 expect((await state(page))).toMatchObject({securityLocked:false,stoppedErrors:0,phase:'review'});
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')))).toEqual({pico_level3:'# Originaler Flug'});
 expect(accountRequests).toEqual([]);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('→ +10000 %');
 await expect(page.locator('#success-overlay')).toBeHidden();
 await page.screenshot({path:info.outputPath('returned-code-analysis.png'),fullPage:true});expect(errors).toEqual([]);
 // The restored editor really accepts another run.
 await begin(page,'def kalibrieren(werte):\n    return werte');await page.evaluate(()=>window.__run);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('nicht verändert');
});

test('@ipad Zero-channel mistakes are displayed and detected even after correct live updates',async({page})=>{
 test.setTimeout(30000);await open(page);
 const code='def kalibrieren(werte):\n    for i in range(len(werte)):\n        if werte[i] > 0:\n            werte[i] += 1\n        elif werte[i] < 0:\n            werte[i] -= 1\n        else:\n            werte[i] = 1\n    return werte';
 await begin(page,code);await expect(page.locator('#calibration-alert-text')).toHaveText('Fehler erkannt',{timeout:20000});await stop(page);
 const observed=await state(page);expect(observed.cycle).toBeGreaterThan(600);expect(observed.observation.before).toEqual([0,2,-2,0]);
 expect(observed.observation.after).toEqual([1,3,-3,1]);expect(observed.complete).toBe(false);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('K1: 0 % → +1 %');
});

test('Phone access denial and the embedded terminal fit without horizontal scrolling',async({page},info)=>{
 test.setTimeout(35000);await page.setViewportSize({width:390,height:844});await open(page);
 await begin(page,assignment('10000'));
 await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert',{timeout:14000});
 await page.locator('#calibration-relogin').click();
 const frame=page.frameLocator('#calibration-login-frame');await expect(frame.locator('#register-check')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const height=await page.locator('#calibration-login-frame').evaluate(el=>el.getBoundingClientRect().height);expect(height).toBeLessThan(1800);
 await page.screenshot({path:info.outputPath('reauth-phone.png'),fullPage:true});
 await solveFrame(page);expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(assignment('10000'));
});

test('@ipad The third detected error locks immediately after two timely stops; manual reset does not erase the count',async({page})=>{
 test.setTimeout(35000);await open(page);
 for(let attempt=1;attempt<=2;attempt++){
  await begin(page,assignment('10000'));await warning(page);await stop(page);expect((await state(page)).stoppedErrors).toBe(attempt);
  await page.locator('#reset-btn').click();expect((await state(page)).stoppedErrors).toBe(attempt);
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime?.getState().stoppedErrors)).toBe(attempt);
 }
 await begin(page,assignment('1'));
 await expect(page.locator('#calibration-alert-text')).toHaveText('Manipulation erkannt',{timeout:7000});
 await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');await page.evaluate(()=>window.__run);
 const locked=await state(page);expect(locked.securityLocked).toBe(true);
 expect(locked.effectHistory.some(e=>e.event==='error-detected')).toBe(false);
 expect(locked.effectHistory.find(e=>e.event==='manipulation-detected').elapsed).toBeLessThan(4500);
});

test('@ipad Numeric edge cases show real small changes, large balanced jumps, and mutated values without return',async({page})=>{
 test.setTimeout(35000);await open(page);
 const small='def kalibrieren(werte):\n    for i in range(len(werte)):\n        if werte[i] > 0:\n            werte[i] += 0.1\n        else:\n            werte[i] -= 0.1\n    return werte';
 await begin(page,small);await page.evaluate(()=>window.__run);expect((await state(page)).securityLocked).toBe(false);
 const observed=await state(page);expect(observed.values[0]).toBeGreaterThan(observed.initialValues[0]);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('Änderung +0,1 %');
 await begin(page,'def kalibrieren(werte):\n    return [10000, -10000, 10000, -10000]');await warning(page);
 expect((await state(page)).values).toEqual([10000,-10000,10000,-10000]);expect((await state(page)).sum).toBe(0);await stop(page);
 await begin(page,assignment('10000').replace('    return werte',''));
 await expect.poll(async()=> (await state(page)).values[0]).toBe(10000);await warning(page);await stop(page);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('keine Liste mit vier gültigen Zahlen');
});

test('@ipad Invalid result shapes and nonfinite channels cannot bypass detection or crash the terminal',async({page})=>{
 test.setTimeout(40000);
 for(const result of ['[1, 2]','["x", 2, 3, 4]','[float("inf"), 0, 0, 0]']){
  await open(page);await page.evaluate(()=>sessionStorage.clear());await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
  await begin(page,'def kalibrieren(werte):\n    return '+result);await warning(page);await stop(page);
  expect((await state(page)).complete).toBe(false);await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('keine Liste');
 }
});

test('@ipad Reload during the lock alarm and during reauthentication preserves the lock and exact failed attempt',async({page})=>{
 test.setTimeout(40000);await open(page);
 // An old completion must not override the newer lock during initialization.
 await page.evaluate(()=>localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level4_memory:'# Alter Abschluss'})));
 const code='# Fehler zum Untersuchen\n'+assignment('10000');await begin(page,code);
 await expect(page.locator('#calibration-alert-text')).toHaveText('Manipulation erkannt',{timeout:11000});
 await page.reload();await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');
 expect((await state(page)).securityLocked).toBe(true);
 await expect(page.locator('#run-btn')).toBeDisabled();await expect(page.locator('#reset-btn')).toBeDisabled();await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
 await page.locator('#calibration-relogin').click();await expect(page.frameLocator('#calibration-login-frame').locator('#register-check')).toBeVisible();
 await page.reload();await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');
 await page.locator('#calibration-relogin').click();
 const frame=page.frameLocator('#calibration-login-frame');await expect(frame.locator('#register-check')).toBeVisible();
 // Neither another source nor a message from this frame with an old token unlocks it.
 await page.evaluate(()=>window.postMessage({type:'nullpunkt:terminal-unlocked',token:new URL(document.querySelector('iframe').src).searchParams.get('reauthToken')},location.origin));
 await frame.locator('body').evaluate(()=>parent.postMessage({type:'nullpunkt:terminal-unlocked',token:'old-frame'},location.origin));
 expect((await state(page)).securityLocked).toBe(true);
 await solveFrame(page);await expect(page.locator('#calibration-return-note')).toBeVisible();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('→ +10000 %');
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime?.getState().securityLocked)).toBe(false);
});

test('Local file reauthentication resizes the full terminal and unlocks across opaque frame origins',async({page},info)=>{
 test.setTimeout(40000);const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(new URL('../../pico_level4.html?e2e',import.meta.url).href);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 await page.locator('#presentation-btn').click();await begin(page,assignment('10000'));
 await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert',{timeout:14000});
 await page.reload();await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');
 await page.locator('#calibration-relogin').click();
 const frame=page.frameLocator('#calibration-login-frame');await expect(frame.locator('#register-check')).toBeVisible();
 await expect.poll(()=>frame.locator('body').evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(2);
 await expect(page.locator('body')).not.toHaveClass(/presentation-mode/);
 const height=await page.locator('#calibration-login-frame').evaluate(el=>el.getBoundingClientRect().height);expect(height).toBeGreaterThan(600);
 await page.screenshot({path:info.outputPath('file-reauth-complete.png'),fullPage:true});
 await solveFrame(page);await expect(page.locator('#calibration-return-note')).toBeVisible();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(assignment('10000'));
 expect(errors).toEqual([]);
});

test('@ipad Security checkpoints stay with their learning profile and never load another profile\'s failed code',async({page})=>{
 test.setTimeout(30000);
 // Isolate the mission's profile boundary without contacting an account server.
 await page.addInitScript(()=>{
  let data;Object.defineProperty(window,'AgentLearningData',{configurable:true,get(){return data;},set(value){
   const profileId=new URLSearchParams(location.search).get('testProfile');
   data=profileId?{...value,context:{kind:'authenticated',profileId}}:value;
  }});
 });
 await page.goto('/pico_level4.html?e2e&testProfile=A');await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 const code='# Nur Profil A\n'+assignment('10000');await begin(page,code);
 await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert',{timeout:14000});
 // The fake adapter has no real account separation: clear its attempted code so
 // the assertions below specifically exercise the new session checkpoint.
 await page.evaluate(()=>localStorage.removeItem('attemptedLevelCode_v1'));
 for(const url of ['/pico_level4.html?e2e&testProfile=B','/pico_level4.html?e2e']){
  await page.goto(url);await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
  expect((await state(page)).securityLocked).toBe(false);
  expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).not.toContain('Nur Profil A');
 }
 await page.goto('/pico_level4.html?e2e&testProfile=A');await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
});

test('@ipad Legacy lock measurements migrate once to percent while preserving the exact learner program',async({page})=>{
 test.setTimeout(20000);await open(page);
 const code=assignment('0.01');
 await page.evaluate(code=>{
  const context=window.AgentLearningData.context;
  const key='nullpunkt-security-v1:'+JSON.stringify([context.kind,context.profileId,new URL('.',location.href).pathname]);
  sessionStorage.setItem(key,JSON.stringify({locked:true,stoppedErrors:2,code,values:[.01,-1.01,.01,-1.03],initialValues:[1.03,-1.01,1.01,-1.03],cycle:4,testVersion:3,
   observation:{before:[1.03,-1.01,1.01,-1.03],after:[.01,-1.01,.01,-1.03],referenceSum:0},lastInspection:'Alter Durchlauf'}));
 },code);
 for(let reload=0;reload<2;reload++){
  await page.reload();await expect(page.locator('#calibration-alert-text')).toHaveText('Zugriff verweigert');
  expect((await state(page)).values).toEqual([1,-101,1,-103]);
  expect((await state(page)).initialValues).toEqual([103,-101,101,-103]);
  expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
 }
 await page.locator('#calibration-relogin').click();await solveFrame(page);
 await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toContainText('K1: +103 % → +1 %');
 await expect(page.locator('#calibration-help')).toContainText('1 Prozentpunkt');
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);
});
