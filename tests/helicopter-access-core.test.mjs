import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadCore() {
    const window = {};
    const context = vm.createContext({ Object, window });
    vm.runInContext(
        readFileSync(new URL("../assets/helicopter-access-core.js", import.meta.url), "utf8"),
        context
    );
    return window.HelicopterAccessCore;
}

test("the helicopter computer issues a noisy signal without exposing a separate password constant", () => {
    const source = readFileSync(new URL("../assets/helicopter-access-core.js", import.meta.url), "utf8");
    const core = loadCore();
    const state = core.createState();
    const signal = state.receive();

    assert.doesNotMatch(source, /seru#7/i);
    assert.match(signal, /\?/);
    assert.equal(state.snapshot().receiveCount, 1);
    assert.equal(state.snapshot().accessGranted, false);
});

test("the helicopter computer accepts only a verified replace result after receive", () => {
    const core = loadCore();
    const state = core.createState();
    const signal = state.receive();
    const decoded = signal.replaceAll(core.NOISE_CHARACTER, "");

    assert.equal(state.check(decoded, false), false, "the right text without replace provenance must fail");
    assert.equal(state.snapshot().lastFailure, core.FAILURES.TRANSFORM_REQUIRED);
    assert.equal(state.check(decoded, true), true);
    assert.equal(state.snapshot().accessGranted, true);
});

test("a trusted transform still has to produce the current decoded signal", () => {
    const core = loadCore();
    const state = core.createState();
    state.receive();

    assert.equal(state.check("falsch", true), false);
    assert.equal(state.snapshot().lastFailure, core.FAILURES.WRONG_PASSWORD);
    assert.equal(state.snapshot().accessGranted, false);
});

test("printing or checking before receive cannot grant helicopter access", () => {
    const core = loadCore();
    const state = core.createState();

    assert.equal(state.check("ACCESS GRANTED!", true), false);
    assert.equal(state.snapshot().lastFailure, core.FAILURES.RECEIVE_REQUIRED);
    assert.equal(state.snapshot().accessGranted, false);
});

test("each helicopter program run starts with fresh access evidence", () => {
    const core = loadCore();
    const first = core.createState();
    const signal = first.receive();
    first.check(signal.replaceAll(core.NOISE_CHARACTER, ""), true);

    const second = core.createState();
    assert.equal(first.snapshot().accessGranted, true);
    assert.equal(second.snapshot().receiveCount, 0);
    assert.equal(second.snapshot().checkCount, 0);
    assert.equal(second.snapshot().accessGranted, false);
});
