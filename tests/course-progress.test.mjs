import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateProgress,groups,nextCourseTarget} from '../assets/data/course-progress.js';
const completed = ids => Object.fromEntries(ids.filter(Boolean).map(id=>[id,'# solution']));
test('progress counts only real completed required sections, not optional legacy IDs',()=>{
    assert.equal(calculateProgress({}).label,'0 %');
    assert.equal(calculateProgress({mission1_level1:''}).base,5);
    assert.equal(calculateProgress({mission1_level1:null}).base,0);
    assert.equal(calculateProgress(completed(['mission1_level4','pico_level2a','invented'])).base,0);
    assert.equal(calculateProgress(completed(['mission2_level3'])).label,'0 % + 5 Bonuspunkte');
});
test('overview distinguishes completed, unfinished and not yet available sections',()=>{
    const rows=calculateProgress(completed(['mission1_level1'])).rows;
    assert.deepEqual(rows[0].sections.map(({code,completed,unlocked})=>({code,completed,unlocked})),[{code:'01-1',completed:true,unlocked:true},{code:'01-2',completed:false,unlocked:false},{code:'01-3',completed:false,unlocked:false}]);
    assert.equal(rows[7].sections.length,2);
    const open=calculateProgress({},['link-level2']).rows[0].sections[1];
    assert.equal(open.unlocked,true);assert.equal(open.href,'mission1_level2.html');
});
test('home resumes the next required level, ignores optional levels and honors real project progress',()=>{
    const target=ids=>nextCourseTarget({completedCodes:completed(ids)});
    assert.equal(target([]).label,'System Access');
    assert.equal(nextCourseTarget({attemptedCodes:{mission1_level1:'draft'}}).href,'mission1_level1.html');
    assert.equal(target(['mission1_level1']).label,'System Access · 01-2');
    assert.equal(target(groups[0][3]).href,'mission2_level1.html');
    assert.equal(target(groups.slice(0,2).flatMap(g=>g[3])).href,'mission3_level1.html');
    const core=groups.slice(0,5).flatMap(g=>g[3]);
    assert.equal(target(core).href,'projektwahl.html');
    assert.equal(target([...core,'pixelmuseum_briefing']).href,'pixelmuseum_finale.html');
    assert.equal(target([...core,'pico_level1_navigation']).href,'pico_level2.html');
    assert.equal(target([...core,...groups[6][3]]).href,'helikopter_flucht_level1.html');
    assert.equal(target([...core,...groups[6][3],'helikopter_flucht_level1']).href,'helikopter_flucht_level2.html');
    assert.equal(target(groups.flatMap(g=>g[3])).href,'projektwahl.html');
    assert.equal(nextCourseTarget({completedCodes:{mission1_level1:null},unlockedIds:['anything']}).label,'System Access');
});
test('choice paths normalize independently; the second complete project adds its bonus once',()=>{
    const pico=groups[5][3], museum=groups[6][3];
    assert.equal(calculateProgress(completed(pico)).base,15);
    assert.equal(calculateProgress(completed(museum)).base,15);
    assert.equal(calculateProgress(completed([...pico,...museum.slice(0,1)])).bonus,6.67);
    assert.equal(calculateProgress(completed([...museum,...pico.slice(0,1)])).bonus,5);
    assert.equal(calculateProgress(completed([...pico,...museum,...pico])).label,'15 % + 20 Bonuspunkte');
});
test('available required levels reach 100%; bonus is independent and legacy data has no invented chronology',()=>{
    const result=calculateProgress(completed([...groups.flatMap(g=>g[3]),'mission2_level3']));
    assert.equal(result.label,'125 %');
    assert.equal(calculateProgress(completed([...groups.slice(0,5).flatMap(g=>g[3]),...groups[6][3],...groups[7][3]])).label,'100 %');
    assert.equal(result.rows[1].sections[2].optional,true);
    assert.equal(result.rows[5].sections.every(s=>s.optional),true);
    assert.deepEqual(result.rows[7].codes,['H-1','H-2']);
    assert.equal(result.optionalCompleted,true);
    assert.equal(Object.hasOwn(result,'lastCompleted'),false);
});
