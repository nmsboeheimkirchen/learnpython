import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadPicoCore() {
    const window = {};
    const context = vm.createContext({ Math, Number, Object, Set, window });
    vm.runInContext(
        readFileSync(new URL("../assets/drone-mission-core.js", import.meta.url), "utf8"),
        context
    );
    vm.runInContext(
        readFileSync(new URL("../assets/pico-mission-core.js", import.meta.url), "utf8"),
        context
    );
    return window.PicoMissionCore;
}

function prepareChargedBeaconRun(pico, state) {
    const equipment = [];
    state.recordStatus({ DROHNE: "PICO", TRANSPONDER: "suche" });
    state.recordFrame(pico.START);
    state.recordFrame(pico.ENERGY_CELL);
    state.searchHere(pico.ENERGY_CELL, equipment);
    equipment.push("Energiezelle");
    state.syncEquipment(equipment);
    state.recordFrame(pico.BEACON);
}

test("PICO records the real direct-flight energy stop", () => {
    const pico = loadPicoCore();
    const state = pico.createState();

    state.recordFrame(pico.START);
    const limit = state.limitMovement(pico.START, pico.BEACON);
    assert.equal(limit.stop, true);
    state.recordFrame(limit);

    const snapshot = state.snapshot();
    assert.equal(snapshot.directBeaconAttempted, true);
    assert.equal(snapshot.depleted, true);
    assert.equal(snapshot.energy, 0);
    assert.equal(snapshot.beaconReached, false);
});

test("all PICO capabilities work in one uninterrupted level-1-style run", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    const equipment = [];

    state.recordStatus({ DROHNE: "NOVA", TRANSPONDER: "suche" });
    state.recordFrame(pico.START);
    assert.equal(state.limitMovement(pico.START, pico.ENERGY_CELL), null);
    state.recordFrame(pico.ENERGY_CELL);
    assert.equal(state.searchHere(pico.ENERGY_CELL, equipment), "Energiezelle");
    equipment.push("Energiezelle");
    assert.equal(state.syncEquipment(equipment), true);
    state.recordStatus({ DROHNE: "NOVA", TRANSPONDER: "aufgeladen" });
    assert.equal(state.limitMovement(pico.ENERGY_CELL, pico.BEACON), null);
    state.recordFrame(pico.BEACON);
    assert.equal(state.send(pico.BEACON), true);
    state.recordStatus({ DROHNE: "NOVA", TRANSPONDER: "gesendet" });

    const snapshot = state.snapshot();
    assert.equal(snapshot.charged, true);
    assert.equal(snapshot.signalSent, true);
    assert.ok(snapshot.energy > 0);
    assert.deepEqual([...snapshot.transponderHistory], ["suche", "aufgeladen", "gesendet"]);
});

test("PICO does not charge from an invented item or a wrong-place search", () => {
    const pico = loadPicoCore();
    const state = pico.createState();

    assert.equal(state.syncEquipment(["Energiezelle"]), false);
    assert.equal(state.searchHere({ x: 0, y: 0 }, []), null);
    assert.equal(state.syncEquipment(["Energiezelle"]), false);
    assert.equal(state.snapshot().charged, false);
});

test("PICO status history comes from executed DROHNE and TRANSPONDER values", () => {
    const pico = loadPicoCore();
    const state = pico.createState();

    state.recordStatus({ DROHNE: "  LUMI  ", TRANSPONDER: "suche" });
    state.recordStatus({ DROHNE: "LUMI", TRANSPONDER: "aufgeladen" });
    const snapshot = state.snapshot();

    assert.equal(snapshot.droneName, "LUMI");
    assert.equal(snapshot.transponder, "aufgeladen");
    assert.deepEqual([...snapshot.droneNameHistory], ["LUMI"]);
    assert.deepEqual([...snapshot.transponderHistory], ["suche", "aufgeladen"]);
});

test("PICO accepts memory deletion only after a successful signal", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    prepareChargedBeaconRun(pico, state);

    assert.equal(state.send(pico.BEACON), true);
    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "delete" });

    const snapshot = state.snapshot();
    assert.equal(snapshot.memoryDeletedAfterSignal, true);
    assert.equal(state.statusReachedAfterSignal("DROHNE", "self-destroy"), true);
    assert.equal(state.statusReachedAfterSignal("TRANSPONDER", "delete"), true);
});

test("PICO keeps the first successful signal checkpoint when a later extra send fails", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    prepareChargedBeaconRun(pico, state);

    assert.equal(state.send(pico.BEACON), true);
    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "delete" });
    assert.equal(state.send(pico.START), false);

    const snapshot = state.snapshot();
    assert.equal(snapshot.signalSent, true);
    assert.equal(snapshot.memoryDeletedAfterSignal, true);
});

test("PICO rejects deletion values that were set before sending", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    prepareChargedBeaconRun(pico, state);

    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "delete" });
    assert.equal(state.send(pico.BEACON), true);

    assert.equal(state.snapshot().memoryDeletedAfterSignal, false);
});

test("PICO rejects a mixed deletion order", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    prepareChargedBeaconRun(pico, state);

    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "suche" });
    assert.equal(state.send(pico.BEACON), true);
    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "delete" });

    assert.equal(state.snapshot().memoryDeletedAfterSignal, false);
});

test("PICO rejects deletion after a failed signal attempt", () => {
    const pico = loadPicoCore();
    const state = pico.createState();
    state.recordStatus({ DROHNE: "PICO", TRANSPONDER: "suche" });
    state.recordFrame(pico.START);

    assert.equal(state.send(pico.START), false);
    state.recordStatus({ DROHNE: "self-destroy", TRANSPONDER: "delete" });

    assert.equal(state.snapshot().memoryDeletedAfterSignal, false);
});
