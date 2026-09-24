// Versioned display policy; counts successful solutions, never views or skip unlocks.
// Future course phases are not counted until they become actual available levels.
export const progressVersion = "2026-09-escape-weights";
export const groups = [
    ["Mission 1", "01", 15, ["mission1_level1", "mission1_level2", "mission1_level3"]],
    ["Mission 2", "02", 15, ["mission2_level1", "mission2_level2"]],
    ["Mission 3", "03", 15, ["mission3_level1", "mission3_level2", "mission3_level3"]],
    ["Mission 4", "04", 15, ["mission4_level1", "mission4_level2", "mission4_level3"]],
    ["Agententraining", "AG", 10, ["agent_training_level1", "agent_training_level2", "agent_training_level3"]],
    ["PICO", "P", 15, ["pico_level1_navigation", "pico_level2", "pico_level3", "pico_level4_memory"]],
    ["Pixelmuseum", "M", 15, ["pixelmuseum_briefing", "pixelmuseum_finale"]],
    ["Flucht", "H", 15, ["helikopter_flucht_level1", "helikopter_flucht_level2"]]
];
// Display weights only: no saved solutions or unlocks are changed by this policy.
// Requested H-1/H-2/H-3/H-4 weights: 4/4/4/3 (15 total, full course total 100).
// H-3/H-4 do not exist yet: their 7 points are reserved, never awarded or invented.
export const levelWeights = [[5,5,5],[7.5,7.5],[5,5,5],[5,5,5],[3,3,4],[3.75,3.75,3.75,3.75],[5,10],[4,4]];
export const secondProjectBonus = 20;
const unlocks = [
    ['link-level1','link-level2','link-level3'],['link-m2-l1','link-m2-l2'],
    ['link-m3-l1','link-m3-l2','link-m3-l3'],['link-m4-l1','link-m4-l2','link-m4-l3'],
    ['link-agent-training-l1','link-agent-training-l2','link-agent-training-l3'],
    ['link-pico-l1','link-pico-l2','link-pico-l3','link-pico-l4'],
    ['link-museum-briefing','link-museum-finale'],['link-helicopter-level1','link-helicopter-level2']
];
const pageFor = id => ({pico_level1_navigation:'pico_level1',pico_level4_memory:'pico_level4'})[id] || id;
const round = value => Math.round(value * 100) / 100;
export const formatPercent = value => new Intl.NumberFormat('de-AT',{maximumFractionDigits:2}).format(value);
export function calculateProgress(completed = {}, unlockedIds = []) {
    const done = id => id !== null && Object.hasOwn(completed, id) && typeof completed[id] === "string";
    const parts = groups.map(([, , , ids],g) => ids.reduce((sum,id,i)=>sum+(done(id)?levelWeights[g][i]:0),0));
    // No chronology is stored: the further progressed path fills the required slot.
    // Museum wins ties; the other path earns proportional bonus even before its finale.
    const primaryProject = parts[5] > parts[6] ? 5 : 6;
    const optionalProject = primaryProject === 5 ? 6 : 5;
    const base = round(parts.slice(0, 5).reduce((a,b)=>a+b,0) + parts[primaryProject] + parts[7]);
    const bonus = round(parts[optionalProject] / 15 * secondProjectBonus + (done("mission2_level3") ? 5 : 0));
    const unlocked = new Set(['link-level1', ...unlockedIds]);
    const section = (id,code,unlock,optional=false) => ({
        id,code,completed:done(id),available:true,optional,
        unlocked:done(id)||unlocked.has(unlock),href:pageFor(id)+'.html'
    });
    return {
        version:progressVersion,base,bonus,primaryProject,
        label:base===100 ? `${formatPercent(100+bonus)} %` : `${formatPercent(base)} %${bonus ? ` + ${formatPercent(bonus)} Bonuspunkte` : ''}`,
        rows:groups.map(([label,prefix,,ids],g)=>{
            const sections=ids.map((id,i)=>section(id,`${prefix}-${i+1}`,unlocks[g][i],g===optionalProject));
            if(g===1)sections.push(section('mission2_level3','02-3','link-m2-l3',true));
            return {label,codes:sections.filter(s=>s.completed).map(s=>s.code),sections};
        }),
        optionalCompleted:done('mission2_level3')
    };
}
export const progressLegend = '* kennzeichnet gesperrte oder optionale Levels. Rot = offen, Grün = geschafft; optionale Levels sind gedämpft orange-rot bzw. blaugrün. Ohne Link = noch gesperrt. Bonus ersetzt keine Pflichtaufgabe.';
export const teacherProgressGuide = [
    ['Mission 1','15 %','15 %','5 % je Level','—'],
    ['Mission 2','15 % + 5 %*','30 % + 5 %*','7,5 % je Pflichtlevel; 02-3: 5 %*','NG'],
    ['Mission 3','15 %','45 % + 5 %*','5 % je Level','NG / G'],
    ['Mission 4','15 %','60 % + 5 %*','5 % je Level','G / B'],
    ['Agententraining','10 %','70 % + 5 %*','AG-1: 3 %, AG-2: 3 %, AG-3: 4 %','B'],
    ['Projekt: Pixelmuseum oder PICO','15 %','85 % + 5 %*','Museum: Briefing 5 %, Finale 10 %; PICO: 3,75 % je Level','Gut / SG'],
    ['Helikopterflucht','15 %','100 % + 5 %*','4 % + 4 % + 4 % + 3 %; H-3/H-4 (7 %) noch nicht verfügbar','SG']
];

// Recommended continuation, not a claim about the last chronological visit.
// Never treat unlock/skip flags as completed work. Only available required steps
// participate; optional 02-3/PICO2a must not block the next mission.
export function nextCourseTarget({completedCodes = {}, attemptedCodes = {}} = {}) {
    const done = id => Object.hasOwn(completedCodes,id) && typeof completedCodes[id] === 'string';
    const attempted = id => Object.hasOwn(attemptedCodes,id) && typeof attemptedCodes[id] === 'string';
    const titles = ['System Access','Bombe entschärfen','Safe-Knacker','Geheimdienst-Chat','Drohnensteuerung','PICO','Pixelmuseum','Flucht'];
    const href = id => ({pico_level1_navigation:'pico_level1',pico_level4_memory:'pico_level4'})[id] || id;
    const nextIn = index => {
        const group = groups[index], position = group[3].findIndex(id=>id && !done(id));
        if(position < 0) return null;
        const id = group[3][position], code = `${group[1]}-${position+1}`;
        return {label:`${titles[index]} · ${code}`,href:href(id)+'.html',action:`Weiter mit ${code}`};
    };
    const coreIds = groups.slice(0,5).flatMap(group=>group[3]);
    if (!coreIds.some(id=>done(id)||attempted(id)) && !groups.slice(5).some(group=>group[3].some(id=>id&&(done(id)||attempted(id))))) {
        return {label:'System Access',href:'mission1_start.html',action:'Mission 1 starten'};
    }
    for(let index=0;index<5;index++) { const next=nextIn(index); if(next) return next; }
    const completeProject = index => groups[index][3].every(done);
    if (!completeProject(5) && !completeProject(6)) {
        // Resume a started project; if both were started, use the one further
        // progressed (stable PICO tie-break, no invented timestamp).
        const score = index => groups[index][3].filter(done).length/groups[index][3].length
            + (groups[index][3].some(attempted) ? .001 : 0);
        const pico=score(5), museum=score(6);
        if(pico || museum) return nextIn(museum>pico ? 6 : 5);
        return {label:'Weggabelung',href:'projektwahl.html',action:'Projekt auswählen'};
    }
    const escape=nextIn(7); if(escape) return escape;
    return {label:'Alle verfügbaren Pflichtabschnitte geschafft',href:'projektwahl.html',action:'Weiteres Projekt ansehen'};
}
