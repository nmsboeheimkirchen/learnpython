import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
function load(){const window={};const context=vm.createContext({window,Math,Number,Object,Set});for(const file of ['drone-mission-core.js','nullpunkt-level1-core.js'])vm.runInContext(readFileSync(new URL('../assets/'+file,import.meta.url),'utf8'),context);return window.NullpunktLevel1Core;}
test('Nullpunkt recognizes a real aborted flight to PICO without a name or status object',()=>{
 const core=load(),state=core.createState();state.recordFrame(core.START);
 const limit=state.limitMovement(core.START,core.TARGET);assert.equal(limit.stop,true);state.recordFrame(limit);
 const result=state.snapshot();assert.equal(result.discovered,true);assert.equal(result.energy,0);assert.ok(result.current.x<core.TARGET.x);assert.ok(Math.abs(result.travelled-core.FLIGHT_BUDGET)<.001);
});
test('Nullpunkt does not complete for an empty run, a target request alone, or an unrelated empty battery',()=>{
 const core=load(),state=core.createState();assert.equal(state.snapshot().discovered,false);
 state.recordFrame(core.START);state.limitMovement(core.START,core.TARGET);assert.equal(state.snapshot().discovered,false);
 state.reset();state.recordFrame(core.START);const limit=state.limitMovement(core.START,{x:0,y:-200});state.recordFrame(limit);assert.equal(state.snapshot().depleted,true);assert.equal(state.snapshot().discovered,false);
});
test('Nullpunkt charges distance only after initialization and never moves after depletion',()=>{
 const core=load(),state=core.createState();state.recordFrame({x:0,y:0});assert.equal(state.snapshot().initialized,false);assert.equal(state.snapshot().energy,10);
 state.recordFrame(core.START);const point={x:core.START.x+50,y:core.START.y};state.recordFrame(point);assert.ok(state.snapshot().energy>0&&state.snapshot().energy<10);
 const limit=state.limitMovement(point,core.TARGET);state.recordFrame(limit);const stopped=state.snapshot();state.recordFrame(core.TARGET);assert.deepEqual(state.snapshot(),stopped);
 state.reset();assert.equal(state.snapshot().energy,10);assert.equal(state.snapshot().discovered,false);
});
