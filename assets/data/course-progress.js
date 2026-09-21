// Versioned display policy; counts successful solutions, never views or skip unlocks.
// Reserved escape phases are deliberately not fictitious completable level IDs.
export const progressVersion = "2026-09-pilot";
export const groups = [
    ["Mission 1", "01", 15, ["mission1_level1", "mission1_level2", "mission1_level3"]],
    ["Mission 2", "02", 15, ["mission2_level1", "mission2_level2"]],
    ["Mission 3", "03", 15, ["mission3_level1", "mission3_level2", "mission3_level3"]],
    ["Mission 4", "04", 15, ["mission4_level1", "mission4_level2", "mission4_level3"]],
    ["Agententraining", "AG", 10, ["agent_training_level1", "agent_training_level2", "agent_training_level3"]],
    ["PICO", "P", 20, ["pico_level1_navigation", "pico_level2", "pico_level3", "pico_level4_memory"]],
    ["Pixelmuseum", "M", 20, ["pixelmuseum_briefing", "pixelmuseum_finale"]],
    ["Flucht", "H", 10, ["helikopter_flucht_level1", "helikopter_flucht_level2", null, null]]
];
export function calculateProgress(completed = {}) {
    const done = id => id !== null && Object.hasOwn(completed, id) && typeof completed[id] === "string";
    const parts = groups.map(([, , weight, ids]) => weight * ids.filter(done).length / ids.length);
    const base = Math.floor(parts.slice(0, 5).reduce((a,b) => a+b, 0) + Math.max(parts[5], parts[6]) + parts[7]);
    const bonus = (parts[5] === 20 && parts[6] === 20 ? 20 : 0) + (done("mission2_level3") ? 5 : 0);
    return {
        version: progressVersion, base, bonus,
        label: base === 100 ? `${100 + bonus} %` : `${base} %${bonus ? ` + ${bonus} Bonuspunkte` : ""}`,
        rows: groups.map(([label, prefix, , ids]) => ({ label,
            codes: ids.flatMap((id,i) => done(id) ? [`${prefix}-${i+1}`] : []),
            sections: ids.map((id,i) => ({code:`${prefix}-${i+1}`,completed:done(id),available:id!==null}))
        })),
        optionalCompleted: done("mission2_level3")
    };
}

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
