import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateProgress,groups} from '../assets/data/course-progress.js';
const completed = ids => Object.fromEntries(ids.filter(Boolean).map(id=>[id,'# solution']));
test('progress counts only real completed required sections, not optional legacy IDs',()=>{
    assert.equal(calculateProgress({}).label,'0 %');
    assert.equal(calculateProgress({mission1_level1:''}).base,5);
    assert.equal(calculateProgress({mission1_level1:null}).base,0);
    assert.equal(calculateProgress(completed(['mission1_level4','pico_level2a','invented'])).base,0);
    assert.equal(calculateProgress(completed(['mission2_level3'])).label,'0 % + 5 Bonuspunkte');
});
test('choice paths normalize independently; the second complete project adds its bonus once',()=>{
    const pico=groups[5][3], museum=groups[6][3];
    assert.equal(calculateProgress(completed(pico)).base,20);
    assert.equal(calculateProgress(completed(museum)).base,20);
    assert.equal(calculateProgress(completed([...pico,...museum.slice(0,1)])).bonus,0);
    assert.equal(calculateProgress(completed([...pico,...museum,...pico])).label,'20 % + 20 Bonuspunkte');
});
test('missing escape phases cannot be completed or masked by bonuses; legacy data has no invented chronology',()=>{
    const result=calculateProgress(completed([...groups.flatMap(g=>g[3]),'mission2_level3']));
    assert.equal(result.label,'95 % + 25 Bonuspunkte');
    assert.deepEqual(result.rows[7].codes,['H-1','H-2']);
    assert.equal(result.optionalCompleted,true);
    assert.equal(Object.hasOwn(result,'lastCompleted'),false);
});
