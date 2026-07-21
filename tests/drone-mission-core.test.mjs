import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadCore() {
    const window = {};
    const context = vm.createContext({
        Math,
        Number,
        Object,
        Set,
        window
    });
    const source = readFileSync(new URL("../assets/drone-mission-core.js", import.meta.url), "utf8");
    vm.runInContext(source, context);
    return window.DroneMissionCore;
}

test("movement budget reaches affordable targets without inventing energy", () => {
    const core = loadCore();
    const movement = core.clampMovementByBudget(
        { x: 0, y: 0 },
        { x: 30, y: 40 },
        10,
        0.1
    );

    assert.equal(movement.stopped, false);
    assert.equal(movement.distance, 50);
    assert.equal(movement.spent, 5);
    assert.equal(movement.remaining, 5);
    assert.deepEqual({ ...movement.point }, { x: 30, y: 40 });
});

test("movement budget clamps an oversized Funkbase flight at the real endpoint", () => {
    const core = loadCore();
    const start = { x: -365, y: 55 };
    const energyCell = { x: -380, y: -90 };
    const funkbase = { x: 340, y: 15 };
    const costPerUnit = 10 / core.distance(start, energyCell);
    const movement = core.clampMovementByBudget(start, funkbase, 10, costPerUnit);

    assert.equal(movement.stopped, true);
    assert.equal(movement.remaining, 0);
    assert.ok(core.distance(start, movement.point) <= core.distance(start, energyCell) + core.EPSILON);
    assert.ok(core.distance(movement.point, funkbase) > 500);
});

test("target evidence records only real nearby visits and marks", () => {
    const core = loadCore();
    const evidence = core.createTargetEvidence([
        { id: "cell", x: -380, y: -90, radius: 18 },
        { id: "base", x: 340, y: 15, radius: 24 }
    ]);

    evidence.recordVisit({ x: -379, y: -91 });
    evidence.recordMark({ x: 0, y: 0 });
    assert.deepEqual({ ...evidence.snapshot(), visited: [...evidence.snapshot().visited], marked: [...evidence.snapshot().marked] }, {
        visited: ["cell"],
        marked: []
    });
});

test("provenance tracker rejects a forged item that was never issued", () => {
    const core = loadCore();
    const tracker = core.createProvenanceTracker();
    const realCell = Object.freeze({ id: "energy-cell" });
    const forgedCell = Object.freeze({ id: "energy-cell" });
    const inventory = [];

    tracker.issue(realCell);
    assert.equal(tracker.recordAppend(inventory, forgedCell), false);
    assert.equal(tracker.wasCollected(inventory, realCell), false);
    assert.equal(tracker.recordAppend(inventory, realCell), true);
    assert.equal(tracker.wasCollected(inventory, realCell), true);
});
