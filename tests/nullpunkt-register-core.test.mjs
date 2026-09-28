import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
function load(){const window={};vm.runInNewContext(readFileSync(new URL('../assets/nullpunkt-register-core.js',import.meta.url),'utf8'),{window});return window.NullpunktRegisterCore;}
const states=Array.from({length:16},(_,n)=>Array.from({length:4},(_,i)=>(n>>i)&1?1:-1));
test('All randomized Q-04 variants have exactly one solution among the 16 states',()=>{
 const core=load(),answers=new Set();
 for(let target=0;target<14;target++)for(let pair=0;pair<6;pair++){
  let call=0;const task=core.generate(()=>call++===0?(target+.1)/14:(pair+.1)/6);
  const solutions=states.filter(values=>core.evaluate(task,values).every(Boolean));
  assert.equal(solutions.length,1);answers.add(solutions[0].join(','));
  assert.equal(core.evaluate(task,[1,1,1,1]).every(Boolean),false);
 }
 assert.equal(answers.size,14);
});
test('The requested example and malformed inputs are checked using all four conditions',()=>{
 const core=load(),task={pairA:[0,2],pairB:[1,3],total:0,productA:1,productB:1,sign:1,anchor:2};
 assert.equal(core.evaluate(task,[1,-1,1,-1]).every(Boolean),true);
 assert.equal(core.evaluate(task,[-1,1,-1,1]).filter(Boolean).length,3);
 assert.equal(core.evaluate(task,[1,1,1,1]).filter(Boolean).length,3);
 for(const values of [[],[0,0,0,0],['1',-1,1,-1],null])assert.equal(core.evaluate(task,values).filter(Boolean).length,0);
});
test('Requested analysis substitutes current numbers only in correct rows and counts remaining combinations',()=>{
 const core=load(),task={pairA:[0,2],pairB:[1,3],total:0,productA:1,productB:1,sign:1,anchor:2};
 const hint=core.reasoning(task,[-1,1,-1,1],true);
 assert.deepEqual(Array.from(hint.matchedRows),[0,1,2]);assert.equal(hint.remaining,2);
 assert.deepEqual(JSON.parse(JSON.stringify(hint.lines)),[
  {row:1,label:'Prüfsumme',equation:'−1 +1 −1 +1 = 0'},
  {row:2,label:'Produkt Q1 · Q3',equation:'(−1) · (−1) = +1'},
  {row:3,label:'Produkt Q2 · Q4',equation:'(+1) · (+1) = +1'}
 ]);
 assert.match(hint.summary,/bleiben 2 von 16 Möglichkeiten/);
 const unchecked=core.reasoning(task,[-1,1,-1,1]);
 assert.equal(unchecked.remaining,16);assert.equal(unchecked.summary,'');assert.equal(unchecked.lines.length,0);assert.equal(unchecked.matchedRows.length,0);
 const solved=core.reasoning(task,[1,-1,1,-1],true);assert.equal(solved.remaining,1);assert.equal(solved.lines.length,4);
 assert.equal(solved.lines[3].equation,'+1 + (+1) = +2');assert.match(solved.summary,/bleibt 1 von 16 Möglichkeit/);
 const difference={pairA:[0,1],pairB:[2,3],total:2,productA:-1,productB:1,sign:-1,anchor:2};
 assert.equal(core.reasoning(difference,[1,-1,1,1],true).lines[3].equation,'+1 − (−1) = +2');
 const none=core.reasoning(task,[-1,1,1,-1],true);
 // This input has a correct total, but no correct products or anchor.
 assert.deepEqual(Array.from(none.matchedRows),[0]);assert.equal(none.remaining,6);
 const noRows=core.reasoning({...task,total:2},[-1,1,1,-1],true);
 assert.equal(noRows.lines.length,0);assert.match(noRows.summary,/alle 16 Möglichkeiten/);
 // Counts are deductions from whole equations, never a claim that individual arrows are fixed.
 for(let target=0;target<14;target++)for(const values of states){
  const variant=core.generate(()=>(target+.1)/14),checked=core.evaluate(variant,values);
  const remaining=states.filter(v=>core.evaluate(variant,v).every((pass,i)=>!checked[i]||pass)).length;
  const analysis=core.reasoning(variant,values,true);
  assert.equal(analysis.remaining,remaining);
  assert.deepEqual(Array.from(analysis.lines,line=>line.row),Array.from(checked).flatMap((passed,i)=>passed?[i+1]:[]));
  assert.doesNotMatch(JSON.stringify(analysis),/Beginne|Achte|Ändere|drei ↑|nächste Zeile/);
 }
});
