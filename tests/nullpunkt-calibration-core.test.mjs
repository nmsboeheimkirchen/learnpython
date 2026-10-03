import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
function load(){const window={};vm.runInNewContext(readFileSync(new URL('../assets/nullpunkt-calibration-core.js',import.meta.url),'utf8'),{window});return window.NullpunktCalibrationCore;}
test('Idle percentages keep the left channels near +100, right channels near -100, and checksum zero',()=>{
 const c=load(),snapshots=new Set();
 for(let time=0;time<20000;time+=137){const v=c.idleValues(time);snapshots.add(v.join(','));assert.ok(v[0]>0&&v[2]>0);assert.ok(v[1]<0&&v[3]<0);assert.ok(v.every(n=>Math.abs(n)>=92&&Math.abs(n)<=108));assert.ok(Math.abs(c.checksum(v))===0);}
 assert.ok(snapshots.size>20);
});
test('Each percent update accepts outward steps up to one point and checks zero preservation and numeric output',()=>{
 const c=load(),before=[100,-100,0,2];
 assert.equal(c.inspect(before,[101,-101,0,3]).passed,true);
 assert.equal(c.inspect(before,[100.1,-100.1,0,2.1]).passed,true);
 assert.equal(c.inspect(before,[100.01,-100.01,0,2.01]).passed,true);
 for(const output of [[100,-100,0,2],[110,-110,0,12],[99,-99,0,1],[101,-101,1,3],[-100,-100,-100,-100],null,[100],['101',-101,0,3],[NaN,-101,0,3],[Infinity,-101,0,3]])assert.equal(c.inspect(before,output).passed,false);
 assert.match(c.inspect(before,[110,-110,0,12]).message,/mehr als 1 Prozentpunkt/);
 assert.match(c.inspect(before,[99,-99,0,1]).message,/zur Null/);
});
test('Small balanced steps can reach the final threshold without an iteration limit',()=>{
 const c=load();
 for(const step of [.1,.01]){
  let values=[100,-100,100,-100],cycles=0;
  while(!c.finalStageReady(values)){
   const next=values.map(v=>c.round(v+Math.sign(v)*step)),observed=c.observe(values,next,0);
   assert.equal(observed.passed,true);assert.equal(observed.suspicious,false);
   values=next;cycles++;assert.ok(cycles<=170001);
  }
  assert.equal(cycles,1700/step);
 }
});
test('The supplied minus-positive plus-negative program approaches zero and then oscillates safely',()=>{
 const c=load();let values=c.idleValues(1200);
 for(let i=0;i<2000;i++){
  const next=values.map(v=>v>0?v-1:v<0?v+1:v);
  assert.equal(c.observe(values,next,0).suspicious,false);
  assert.equal(c.finalStageReady(next),false);values=next;
 }
 assert.ok(values.every(v=>Math.abs(v)<1));
});
test('K4 measurement noise stays within 0.99 points without accumulating or masking interventions',()=>{
 const c=load(),values=[100.01,-102.17,102.17,-100.01],sums=new Set();
 for(let time=0;time<50000;time+=137){
  const measured=c.measuredValues(values,time),sum=c.checksum(measured);sums.add(sum);
  assert.deepEqual(Array.from(measured.slice(0,3)),values.slice(0,3));
  assert.ok(Math.abs(measured[3]-values[3])<=.99000001);assert.ok(Math.abs(sum)<=.99);
  assert.equal(c.checksum(values),0);
 }
 assert.ok(sums.size>100);
 assert.equal(c.observe(values,[101.01,-102.17,102.17,-100.01]).checksumChanged,true);
 assert.equal(c.checksum(c.measuredValues([104,-100,100,-100],0)),4);
});
test('Six hundred updates diverge by 600 percentage points while keeping the checksum and prefinal progress',()=>{
 const c=load();let values=c.idleValues(1200),start=Array.from(values),sum=c.checksum(values);
 for(let i=0;i<c.CYCLES;i++){const next=values.map(v=>c.round(v+Math.sign(v)*c.STEP));assert.equal(c.inspect(values,next).passed,true);assert.equal(c.checksum(next),sum);values=next;}
 values.forEach((v,i)=>assert.ok(Math.abs(Math.abs(v-start[i])-600)<1e-7));
 assert.equal(c.phase(0,values),0);assert.equal(c.phase(300,values),1);assert.equal(c.phase(450,values),2);assert.equal(c.phase(600,values),2);
 assert.equal(c.finalStageReady(values),false);
});

test('The scaled final threshold is 1800 percent, not 118 percent or merely an elapsed cycle count',()=>{
 const c=load();
 for(const values of [[1799,-1799,100,-100],[118,-118,118,-118],[100,-100,100,-100]]){
  assert.equal(c.finalStageReady(values),false);assert.equal(c.phase(5000,values),2);
 }
 for(const values of [[1800,-1800,100,-100],[100,-1800,100,1600],[1799.99999999999,-1800,100,-100]]){
  assert.equal(c.finalStageReady(values),true);assert.equal(c.phase(1700,values),3);
 }
 assert.equal(c.finalStageReady([Infinity,NaN,null,undefined]),false);
});
test('Observations separate harmless incomplete code from oversized or checksum-changing interventions',()=>{
 const c=load(),before=[103,-101,101,-103];
 assert.equal(c.observe(before,before).unchanged,true);assert.equal(c.observe(before,before).suspicious,false);
 const fixed=c.observe(before,[10000,-101,10000,-103]);assert.equal(fixed.oversized,true);assert.equal(fixed.checksumChanged,true);assert.equal(fixed.after[0],10000);
 assert.equal(c.observe([100,-100,100,-100],[10000,-10000,10000,-10000]).suspicious,true);
 assert.equal(c.observe(before,[104,-101,101,-103]).checksumChanged,true);
 assert.equal(c.observe(before,[103.1,-101.1,101.1,-103.1]).suspicious,false);
 assert.equal(c.observe(before,[104,-102,102,-104]).suspicious,false);
 assert.equal(c.observe(before,[104.01,-102.01,102.01,-104.01]).oversized,true);
 for(const result of [null,[1,2],['x',0,0,0],[Infinity,0,0,0]])assert.equal(c.observe(before,result).suspicious,true);
});
