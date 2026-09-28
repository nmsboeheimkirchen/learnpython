import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
function load(){const window={};const context=vm.createContext({window,Math,Number,Object,Array,Set});for(const name of ['drone-mission-core','nullpunkt-level1-core','nullpunkt-level2-core'])vm.runInContext(readFileSync(new URL('../assets/'+name+'.js',import.meta.url),'utf8'),context);return window;}
function arrive(prepare=true){const w=load(),state=w.NullpunktLevel2Core.createState(),inventory=[];if(prepare)state.observeEquipment(inventory);state.recordFrame(w.NullpunktLevel1Core.START);assert.equal(state.limitMovement(w.NullpunktLevel1Core.START,w.NullpunktLevel2Core.ENERGY_CELL),null);state.recordFrame(w.NullpunktLevel2Core.ENERGY_CELL);return {w,state,inventory};}
function append(state,inventory,item){inventory.push(item);state.recordAppend(inventory,item);return state.syncEquipment(inventory);}
test('Nullpunkt bottle is reachable with start energy and a real search plus collection charges it once',()=>{
 const {w,state,inventory}=arrive();assert.ok(state.snapshot().energy>0&&state.snapshot().energy<1);
 const item=state.searchHere(inventory);assert.equal(item,'Energiezelle');state.recordOutput(item);
 assert.equal(append(state,inventory,item),true);assert.equal(state.snapshot().energy,100);assert.equal(state.snapshot().printed,true);
 assert.equal(state.searchHere(inventory),null);assert.equal(append(state,inventory,item),false);
 state.recordFrame({x:w.NullpunktLevel2Core.ENERGY_CELL.x+12,y:w.NullpunktLevel2Core.ENERGY_CELL.y});assert.equal(state.snapshot().energy,99);
});
test('Nullpunkt cannot charge from forged inventory, a remote search or a stale find',()=>{
 const {w,state,inventory}=arrive();assert.equal(state.syncEquipment(['Energiezelle']),false);
 state.searchHere(['Energiezelle']);assert.equal(state.syncEquipment(['Energiezelle']),false);
 // Leave the search radius while some energy remains: this expires the find.
 state.recordFrame({x:-400,y:-85});assert.equal(append(state,inventory,'Energiezelle'),false);
 assert.equal(state.snapshot().charged,false);
 state.reset();state.recordFrame(w.NullpunktLevel1Core.START);assert.equal(state.searchHere([]),null);assert.equal(state.syncEquipment(['Energiezelle']),false);
});
test('Nullpunkt requires learner output after a real search and reset clears the charge',()=>{
 const {state,inventory}=arrive();state.recordOutput('Energiezelle');assert.equal(state.snapshot().printed,false);
 const item=state.searchHere(inventory);append(state,inventory,item);assert.equal(state.snapshot().printed,false);
 state.recordOutput(item);assert.equal(state.snapshot().printed,true);
 state.reset();assert.equal(state.snapshot().energy,10);assert.equal(state.snapshot().charged,false);assert.equal(state.snapshot().found,false);
 assert.equal(state.snapshot().listPrepared,false);assert.equal(state.snapshot().appended,false);
});
test('Nullpunkt accepts a late empty list, but still needs append to that list and detects erased finds',()=>{
 const {state,inventory}=arrive(false);
 state.observeEquipment(inventory); // Allowed: position in the program matters only when it erases the fund.
 const item=state.searchHere(inventory);
 assert.equal(append(state,inventory,item),true);assert.equal(state.snapshot().listPrepared,true);
 state.observeEquipment([]);assert.equal(state.snapshot().equipmentCleared,true);
 const prepared=arrive();const found=prepared.state.searchHere(prepared.inventory);
 prepared.inventory.push(found); // Replacing or filling the list is not append evidence.
 assert.equal(prepared.state.syncEquipment(prepared.inventory),false);
 assert.equal(prepared.state.recordAppend([found],found),false);
 assert.equal(prepared.state.recordAppend(prepared.inventory,found),true);
 assert.equal(prepared.state.syncEquipment([found]),false);
 assert.equal(prepared.state.syncEquipment(prepared.inventory),true);
});
test('Nullpunkt direct flight still depletes before PICO and stops subsequent movement',()=>{
 const w=load(),state=w.NullpunktLevel2Core.createState(),flight=w.NullpunktLevel1Core;
 state.recordFrame(flight.START);const limit=state.limitMovement(flight.START,flight.TARGET);state.recordFrame(limit);
 const before=state.snapshot();assert.equal(before.depleted,true);assert.equal(state.searchHere([]),null);
 state.recordFrame(flight.ENERGY_CELL);assert.deepEqual(state.snapshot().current,before.current);assert.equal(state.syncEquipment(['Energiezelle']),false);
});
test('Umlaut names are adapted for Python without touching comments, string literals or longer identifiers',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../assets/nullpunkt-python-names.js',import.meta.url),'utf8'),{window});
 const names=window.NullpunktPythonNames;
 const source=`Ausrüstung = []\nAUSRÜSTUNG = []\nAusrüstung.append(fund)\n# Ausrüstung stays\nprint("Ausrüstung", 'AUSRÜSTUNG')\ntext = """Ausrüstung\nAUSRÜSTUNG"""\nmeine_Ausrüstung = []\n`;
 const adapted=names.prepareCode(source);
 assert.ok(adapted.startsWith(names.globalName('Ausrüstung')+' = []'));
 assert.ok(adapted.includes(names.globalName('AUSRÜSTUNG')+' = []'));
 assert.ok(adapted.includes(names.globalName('Ausrüstung')+'.append(fund)'));
 assert.ok(adapted.endsWith(source.slice(source.indexOf('# Ausrüstung'))));
 assert.equal(names.formatError('NameError: '+names.globalName('Ausrüstung')),'NameError: Ausrüstung');
});
