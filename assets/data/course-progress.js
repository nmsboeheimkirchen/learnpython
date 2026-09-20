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
        rows: groups.map(([label, prefix, , ids]) => ({ label, codes: ids.flatMap((id,i) => done(id) ? [`${prefix}-${i+1}`] : []) })),
        optionalCompleted: done("mission2_level3")
    };
}
