import {expect,test} from '@playwright/test';
const solution=`def kalibrieren(werte):
    for i in range(len(werte)):
        if werte[i] > 0:
            werte[i] = werte[i] + 1
        elif werte[i] < 0:
            werte[i] = werte[i] - 1
    return werte`;
async function open(page){await page.goto('/pico_level4.html?e2e');await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);return page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());}
async function run(page,code){return page.evaluate(async code=>{window.DroneMissionRuntime.editor.setValue(code);return window.DroneMissionRuntime.run();},code);}
async function begin(page,code){await page.evaluate(code=>{window.DroneMissionRuntime.editor.setValue(code);const start=performance.now();window.__calibrationRun=window.DroneMissionRuntime.run().then(result=>{window.__calibrationDuration=performance.now()-start;return result;});},code);}
test('Percent mission keeps the editor visible on a 16:9 school laptop',async({page},info)=>{
 await page.setViewportSize({width:1366,height:768});await open(page);
 const editor=await page.locator('.CodeMirror').boundingBox(),button=await page.locator('[data-mission-run]').boundingBox();
 expect(editor.y).toBeLessThan(640);expect(button.y+button.height).toBeLessThan(editor.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('percent-laptop.png'),fullPage:true});
});
test('@ipad Calibration starts with changing small decimals and an incomplete assignment scaffold, no unsolicited help',async({page},info)=>{
 const starter=await open(page);expect(starter).toContain('def kalibrieren(werte):');expect(starter.match(/\bpass\b/g).length).toBe(3);
 await expect(page.locator('#calibration-help')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
 const first=await page.locator('.calibration-readings').innerText();await expect.poll(()=>page.locator('.calibration-readings').innerText()).not.toBe(first);
 const values=await page.evaluate(()=>window.DroneMissionRuntime.getState().values);
 expect(values.every(value=>Math.abs(value)>=92&&Math.abs(value)<=108)).toBe(true);
 for(const i of [0,2])await expect(page.locator('#calibration-value-'+i)).toHaveText(/^\+.+ %$/);
 for(const i of [1,3])await expect(page.locator('#calibration-value-'+i)).toHaveText(/^−.+ %$/);
 await expect(page.locator('#calibration-sum')).toHaveText('0 %');
 await expect(page.locator('#calibration-camera .calibration-frame')).toHaveAttribute('src',/terminal-v3\.webp$/);
 expect(await run(page,starter)).toMatchObject({passed:false});await expect(page.locator('#validation-message')).toContainText('unverändert');
 await expect(page.locator('#calibration-help')).toBeHidden();await page.locator('#calibration-help-btn').click();await expect(page.locator('#calibration-help')).toBeVisible();
 await expect(page.locator('#calibration-help')).toContainText('Dein Code hat die vier Kalibrierwerte nicht verändert.');
 await expect(page.locator('#calibration-help-btn')).toBeDisabled();
 await page.locator('#calibration-help-btn').dispatchEvent('click');expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().helpCount)).toBe(1);
 await page.screenshot({path:info.outputPath('calibration-editor.png'),fullPage:true});
});
test('@ipad Calibration reports stabilizing code and a missing function without a security lock',async({page})=>{
 await open(page);
 for(const code of [solution.replace('+ 1','- 1').replace(' - 1\n    return',' + 1\n    return'),'print("fertig")']){
  expect(await run(page,code)).toMatchObject({passed:false});
  await expect(page.locator('#calibration-ending')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBeUndefined();
 }
});
test('@ipad Learner calibration keeps running through interference with a stable sum and earns four coins after the sequence',async({page},info)=>{
 test.setTimeout(50000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));await open(page);
 await page.evaluate(()=>{
  window.__displaySamples=[];const camera=document.getElementById('calibration-camera');
  new MutationObserver(()=>window.__displaySamples.push({display:camera.dataset.display,stage:camera.dataset.effectStage,telemetry:getComputedStyle(document.getElementById('calibration-telemetry')).opacity,noise:getComputedStyle(document.getElementById('calibration-noise')).opacity,black:getComputedStyle(document.getElementById('calibration-screen-blackout')).opacity})).observe(camera,{attributes:true,attributeFilter:['data-display','data-effect-stage']});
 });
 await page.evaluate(()=>window.TeacherSolutions.load('nullpunkt_level4'));
 const code=await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue());expect(code).toContain('werte[i] = werte[i] + 1');
 await begin(page,code);
 await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.getState().cycle)).toBeGreaterThan(50);
 await expect(page.locator('#next-level-btn')).toBeHidden();await expect(page.locator('#calibration-ending')).toBeHidden();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getOption('readOnly'))).toBe(true);
 await page.screenshot({path:info.outputPath('calibration-running.png'),fullPage:true});
 await page.waitForFunction(()=>{const state=window.DroneMissionRuntime.getState();return state.cycle>480&&parseFloat(getComputedStyle(document.getElementById('calibration-room-flare'),'::before').opacity)>.8;});
 await page.screenshot({path:info.outputPath('calibration-warning-flare.png'),fullPage:true,animations:'allow'});
 const result=await page.evaluate(()=>window.__calibrationRun);expect(result).toMatchObject({passed:true});
 expect(await page.evaluate(()=>window.__calibrationDuration)).toBeLessThan(40000);
 const state=await page.evaluate(()=>window.DroneMissionRuntime.getState());expect(state.cycle).toBeGreaterThan(600);expect(state.history).toHaveLength(Math.floor(state.cycle/5));
 const initialSum=state.initialValues.reduce((sum,n)=>sum+n,0);
 for(const entry of state.history){expect(Math.abs(entry.sum-initialSum)).toBeLessThan(0.000001);entry.values.forEach((v,i)=>expect(Math.abs(Math.abs(v-state.initialValues[i])-entry.cycle)).toBeLessThan(.000001));}
 await expect(page.locator('#calibration-camera')).toHaveAttribute('data-phase','3');await expect(page.locator('.calibration-frame')).toHaveCount(1);
 expect(state.effectHistory.filter(e=>['smoke','alarm','warning','display-interference','heavy-smoke','core-flicker','screen-blackout','room-blackout','complete'].includes(e.event)).map(e=>e.event)).toEqual(['smoke','alarm','warning','display-interference','heavy-smoke','core-flicker','screen-blackout','room-blackout','complete']);
 expect(state.effectHistory.find(e=>e.event==='smoke').cycle).toBe(60);expect(state.effectHistory.find(e=>e.event==='alarm').cycle).toBe(160);expect(state.effectHistory.find(e=>e.event==='warning-tones').cycle).toBe(240);
 const flashes=state.effectHistory.filter(e=>e.stage==='display-interference'&&['display-noise','display-numbers'].includes(e.event));
 expect(flashes.map(e=>e.display)).toEqual(['noise','numbers','noise','numbers','noise','numbers']);
 for(let i=1;i<flashes.length;i++){expect(flashes[i].elapsed-flashes[i-1].elapsed).toBeGreaterThanOrEqual(i%2?170:500);expect(flashes[i].cycle).toBeGreaterThan(flashes[i-1].cycle);}
 expect(state.interferenceCount).toBe(3);expect(state.warningToneCount).toBe(3);
 expect(state.alarmToneCount).toBeGreaterThan(3);
 const tones=state.effectHistory.filter(e=>e.event==='rhythmic-warning');
 expect(tones[0].elapsed).toBeGreaterThan(flashes[0].elapsed);
 for(let i=1;i<tones.length;i++)expect(tones[i].elapsed-tones[i-1].elapsed).toBeGreaterThanOrEqual(780);
 expect(state.effectHistory.find(e=>e.event==='room-surge').cycle).toBe(480);
 const finale=state.effectHistory.find(e=>e.event==='heavy-smoke');
 expect(finale.deviation).toBeGreaterThanOrEqual(1800-1e-7);expect(finale.deviation).toBeLessThan(1801);
 expect(state.effectHistory.find(e=>e.event==='display-interference').deviation).toBeLessThan(1800);
 expect(state.history.filter(entry=>entry.cycle<finale.cycle).every(entry=>Math.max(...entry.values.map(Math.abs))<1800-1e-7)).toBe(true);
 expect(state.effects.roomRed).toBeGreaterThan(.7);
 const visualSamples=await page.evaluate(()=>window.__displaySamples);
 expect(visualSamples.some(sample=>sample.display==='noise')).toBe(true);
 for(const sample of visualSamples){expect([sample.telemetry,sample.noise,sample.black]).toEqual(sample.display==='noise'?['0','1','0']:sample.display==='black'?['0','0','1']:['1','0','0']);}
 expect(state.effectHistory.filter(e=>e.stage==='core-flicker'&&e.event==='display-noise')).toHaveLength(3);
 const black=state.effectHistory.find(e=>e.event==='screen-blackout'),room=state.effectHistory.find(e=>e.event==='room-blackout');expect(room.elapsed-black.elapsed).toBeGreaterThanOrEqual(690);
 expect(black.cycle).toBe(state.cycle);expect(room.cycle).toBe(state.cycle);
 await expect(page.locator('#calibration-camera')).toHaveAttribute('data-display','black');await expect(page.locator('#calibration-camera')).toHaveAttribute('data-alarm-active','true');
 await expect(page.locator('#calibration-screen-blackout')).toHaveCSS('opacity','1');await expect(page.locator('#calibration-noise')).toHaveCSS('opacity','0');
 await expect(page.locator('#calibration-smoke-heavy')).toHaveCSS('opacity','1');await expect(page.locator('#calibration-bar-blackout')).toHaveCSS('opacity','1');
 await expect(page.locator('#calibration-ending')).toBeVisible();await expect(page.locator('#calibration-telemetry')).toHaveCSS('opacity','0');
 await expect(page.locator('#success-overlay')).toBeHidden();await page.screenshot({path:info.outputPath('calibration-failure.png'),fullPage:true});
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBe(code);
 await page.locator('#calibration-finish').click();await expect(page.locator('#success-overlay .success-coin')).toHaveCount(4);
 await expect(page.locator('#success-overlay .success-btn')).toHaveAttribute('href','helikopter_flucht.html');
 await page.locator('#success-overlay .success-btn').click();await expect(page).toHaveURL(/\/helikopter_flucht\.html$/);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Der Lord kommt zurück.');
 await page.goto('/pico_level4.html?e2e');await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(code);await expect(page.locator('#next-level-btn')).toBeVisible();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().complete)).toBe(false);expect(errors).toEqual([]);
});
test('@ipad Stopping calibration cancels the sequence and cannot award a late success',async({page})=>{
 const starter=await open(page);await page.locator('#presentation-btn').click();await expect(page.locator('#calibration-camera')).toBeVisible();await begin(page,solution);
 await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.getState().cycle)).toBeGreaterThan(20);
 await page.locator('.calibration-stop').click();await page.evaluate(()=>window.__calibrationRun);
 await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.isRunning())).toBe(false);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(solution);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({phase:'stopped',complete:false,failure:0});
 const stoppedCycle=await page.evaluate(()=>window.DroneMissionRuntime.getState().cycle);
 await page.clock.install();await page.clock.runFor(12000);
 await expect(page.locator('#next-level-btn')).toBeHidden();await expect(page.locator('#calibration-ending')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBeUndefined();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({effectStage:'idle',display:'numbers',cycle:stoppedCycle});
 await expect(page.locator('#calibration-smoke-light')).toHaveCSS('opacity','0');await expect(page.locator('#calibration-camera')).toHaveAttribute('data-alarm-active','false');
});
test('@ipad Syntax errors and runtime errors stay in the output without security penalties',async({page})=>{
 await open(page);
 expect(await run(page,'def kalibrieren(werte)\n    return werte')).toBeNull();await expect(page.locator('#console-output')).toContainText('SyntaxError');
 await expect(page.locator('#calibration-ending')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await run(page,'def kalibrieren(werte):\n    raise ValueError("Probe")')).toBeNull();await expect(page.locator('#console-output')).toContainText('Probe');
 expect(await run(page,'def kalibrieren(werte):\n    while True:\n        pass')).toBeNull();
 await expect(page.locator('#console-output')).toContainText('läuft zu lange');
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({securityLocked:false,stoppedErrors:0});await expect(page.locator('#calibration-alert')).toBeHidden();
 await expect(page.locator('#calibration-ending')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
});

test('@ipad Python is still executed and validated after the first display outage',async({page})=>{
 test.setTimeout(30000);await open(page);
 const late=`zaehler = 0\n`+solution.replace('    for i',`    global zaehler\n    zaehler = zaehler + 1\n    if zaehler > 664:\n        return [0, 0, 0, 0]\n    for i`);
 await begin(page,late);await expect(page.locator('#calibration-alert-text')).toHaveText('Fehler erkannt',{timeout:20000});
 await page.locator('.calibration-stop').click();await page.evaluate(()=>window.__calibrationRun);
 const state=await page.evaluate(()=>window.DroneMissionRuntime.getState());
 expect(state.cycle).toBeGreaterThan(660);expect(state.effectHistory.some(e=>e.event==='display-noise')).toBe(true);
 expect(state.observation.after).toEqual([0,0,0,0]);expect(state.stoppedErrors).toBe(1);
 expect(state.effectHistory.some(e=>e.event==='complete')).toBe(false);
 await expect(page.locator('#calibration-ending')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
 await expect(page.locator('#calibration-room-flare')).toHaveCSS('opacity','0');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBeUndefined();
});

test('@ipad Code changed during calibration cannot earn completion',async({page})=>{
 await open(page);await begin(page,solution);
 await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.getState().cycle)).toBeGreaterThan(20);
 await page.evaluate(()=>window.DroneMissionRuntime.editor.setValue('print("geänderter Code")'));
 expect(await page.evaluate(()=>window.__calibrationRun)).toMatchObject({passed:false});
 await expect(page.locator('#validation-message')).toContainText('während des Laufs verändert');
 await expect(page.locator('#calibration-ending')).toBeHidden();await expect(page.locator('#next-level-btn')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')||'{}').pico_level4_memory)).toBeUndefined();
});

test('@ipad Reset during interference cancels both initial and rhythmic warning audio',async({page})=>{
 test.setTimeout(35000);
 await page.addInitScript(()=>{
  window.__audioEvents=[];
  window.AudioContext=class{
   constructor(){this.state='running';this.currentTime=0;this.destination={};window.__audioEvents.push('created');}
   resume(){return Promise.resolve();} close(){this.state='closed';window.__audioEvents.push('closed');return Promise.resolve();}
   createOscillator(){return {frequency:{value:0},connect(){},disconnect(){},start(){window.__audioEvents.push('tone-start');window.__toneFrequencies.push(this.frequency.value);},stop(){window.__audioEvents.push('tone-stop');}};}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  };window.__toneFrequencies=[];
 });
 await open(page);expect(await page.evaluate(()=>window.__audioEvents)).toEqual([]);
 await begin(page,solution);
 await expect(page.locator('#calibration-camera')).toHaveAttribute('data-effect-stage','display-interference',{timeout:15000});
 await expect.poll(()=>page.evaluate(()=>window.DroneMissionRuntime.getState().alarmToneCount)).toBeGreaterThan(0);
 expect((await page.evaluate(()=>window.__audioEvents.filter(event=>event==='tone-start'))).length).toBeGreaterThan(3);
 await page.locator('.calibration-stop').click();await page.evaluate(()=>window.__calibrationRun);
 const events=await page.evaluate(()=>window.__audioEvents);expect(events.filter(event=>event==='created')).toHaveLength(1);expect(events.filter(event=>event==='closed')).toHaveLength(1);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState())).toMatchObject({phase:'stopped',display:'numbers',effectStage:'idle'});
 expect(await page.evaluate(()=>[...new Set(window.__toneFrequencies)])).toEqual([180]);
 await expect(page.locator('#calibration-noise')).toHaveCSS('opacity','0');await expect(page.locator('#calibration-bar-blackout')).toHaveCSS('opacity','0');
 await expect(page.locator('#next-level-btn')).toBeHidden();
 const starts=events.filter(event=>event==='tone-start').length;
 await page.clock.install();await page.clock.runFor(4000);
 expect((await page.evaluate(()=>window.__audioEvents.filter(event=>event==='tone-start'))).length).toBe(starts);
 await expect(page.locator('#calibration-room-tint')).toHaveCSS('opacity','0');
});

test('@ipad Reduced motion uses calm display changes and a static warning even when audio is unavailable',async({page})=>{
 test.setTimeout(50000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{window.AudioContext=class{constructor(){throw new Error('Audio unavailable');}};});
 await open(page);await begin(page,solution);expect(await page.evaluate(()=>window.__calibrationRun)).toMatchObject({passed:true});
 const state=await page.evaluate(()=>window.DroneMissionRuntime.getState());expect(state.reducedMotion).toBe(true);expect(state.interferenceCount).toBe(3);
 const changes=state.effectHistory.filter(event=>event.event==='display-noise'||event.event==='display-numbers');
 for(let i=1;i<changes.length;i++)expect(changes[i].elapsed-changes[i-1].elapsed).toBeGreaterThanOrEqual(590);
 expect(state.effectHistory.filter(event=>event.stage==='core-flicker'&&event.event==='display-noise')).toHaveLength(1);
 await expect(page.locator('#calibration-alarm')).toHaveCSS('animation-name','none');await expect(page.locator('#calibration-camera')).toHaveAttribute('data-alarm-active','true');
 await expect(page.locator('#calibration-smoke-heavy img')).toHaveCSS('animation-name','none');
 expect(await page.locator('#calibration-room-flare').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
 await expect(page.locator('#calibration-screen-blackout')).toHaveCSS('opacity','1');expect(await page.evaluate(()=>window.__calibrationDuration)).toBeLessThan(40000);
 expect(state.effectHistory.find(e=>e.event==='heavy-smoke').deviation).toBeGreaterThanOrEqual(1800-1e-7);
});
test('@ipad Old completions and attempted code survive without fabricating calibration or inheriting flight code',async({page})=>{
 await open(page);const old='# Mein bisheriger Abschluss\nprint("erhalten")';
 await page.evaluate(old=>{localStorage.setItem('completedLevelCode_v1',JSON.stringify({pico_level3:'fliege_zu(220, 15)',pico_level4_memory:old}));},old);
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(window.DroneMissionRuntime))).toBe(true);
 expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toBe(old);await expect(page.locator('#next-level-btn')).toBeVisible();
 expect(await page.evaluate(()=>window.DroneMissionRuntime.getState().failure)).toBe(0);
 await page.locator('#reset-btn').click();expect(await page.evaluate(()=>window.DroneMissionRuntime.editor.getValue())).toContain('def kalibrieren(werte):');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('completedLevelCode_v1')).pico_level4_memory)).toBe(old);
});
test('Calibration is usable on a phone and keeps the run control above the code',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const button=await page.locator('[data-mission-run]').boundingBox(),editor=await page.locator('.CodeMirror').boundingBox();expect(button.y+button.height).toBeLessThan(editor.y);
 await expect(page.locator('.calibration-checksum')).toContainText('Kontrollsumme');
 const sum=await page.locator('#calibration-sum').boundingBox(),footer=await page.locator('.calibration-footer').boundingBox(),counter=await page.locator('.calibration-counter').boundingBox();
 expect(sum.x+sum.width).toBeLessThanOrEqual(counter.x);expect(sum.y+sum.height).toBeLessThanOrEqual(footer.y+footer.height+1);
 expect(await page.locator('#calibration-sum').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(await page.locator('.calibration-counter').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));
 await expect(page.locator('#calibration-help')).toBeHidden();await page.screenshot({path:info.outputPath('calibration-phone.png'),fullPage:true});
});
