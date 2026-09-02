import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function deterministicCrypto(seed = 0x12345678) {
    let value = seed >>> 0;
    return {
        getRandomValues(target) {
            for (let index = 0; index < target.length; index += 1) {
                value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
                target[index] = value;
            }
            return target;
        }
    };
}

function loadCore(randomSource = deterministicCrypto()) {
    const window = { crypto: randomSource };
    const context = vm.createContext({ Object, Uint32Array, window });
    vm.runInContext(
        readFileSync(new URL("../assets/helicopter-access-core.js", import.meta.url), "utf8"),
        context
    );
    return window.HelicopterAccessCore;
}

test("the helicopter computer generates a 256-character mixed password", () => {
    const source = readFileSync(new URL("../assets/helicopter-access-core.js", import.meta.url), "utf8");
    const core = loadCore();
    const password = core.createRandomPassword();

    assert.doesNotMatch(source, /seru#7/i);
    assert.doesNotMatch(source, /SIGNAL_PARTS/);
    assert.match(source, /getRandomValues/);
    assert.doesNotMatch(source, /Math\.random/);
    assert.equal(password.length, 256);
    assert.doesNotMatch(password, /\?/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[0-9]/);
    assert.ok([...password].some(character => core.SPECIAL_CHARACTERS.includes(character)));
});

test("the signal alternates 256 password characters with exactly 255 question marks", () => {
    const core = loadCore();
    const password = core.createRandomPassword();
    const state = core.createState(password);
    const signal = state.receive();
    const decoded = signal.replaceAll(core.NOISE_CHARACTER, "");

    assert.equal(signal.length, 511);
    assert.equal([...signal].filter(character => character === core.NOISE_CHARACTER).length, 255);
    assert.equal(signal, [...password].join(core.NOISE_CHARACTER));
    assert.equal(decoded, password);
    assert.equal(state.snapshot().receiveCount, 1);
    assert.equal(state.snapshot().accessGranted, false);
});

test("the exact password is accepted regardless of how the learner produced it", () => {
    const core = loadCore();
    const password = core.createRandomPassword();
    const state = core.createState(password);

    assert.equal(state.check(password), true);
    const snapshot = state.snapshot();
    assert.equal(snapshot.sequence, 1);
    assert.equal(snapshot.receiveCount, 0);
    assert.equal(snapshot.checkCount, 1);
    assert.equal(snapshot.accessGranted, true);
    assert.equal(snapshot.lastFailure, null);
    assert.equal(snapshot.checkAttempts.length, 1);
    assert.equal(snapshot.checkAttempts[0].sequence, 1);
    assert.equal(snapshot.checkAttempts[0].accepted, true);
});

test("wrong output and a wrong password cannot grant helicopter access", () => {
    const core = loadCore();
    const state = core.createState();

    assert.equal(state.check("ACCESS GRANTED!"), false);
    assert.equal(state.snapshot().lastFailure, core.FAILURES.RECEIVE_REQUIRED);
    state.receive();
    assert.equal(state.check("falsch"), false);
    assert.equal(state.snapshot().lastFailure, core.FAILURES.WRONG_PASSWORD);
    assert.equal(state.snapshot().accessGranted, false);
});

test("run resets clear evidence while preserving the page password", () => {
    const core = loadCore();
    const password = core.createRandomPassword();
    const first = core.createState(password);
    const signal = first.receive();
    first.check(signal.replaceAll(core.NOISE_CHARACTER, ""));

    const second = core.createState(password);
    assert.equal(first.snapshot().accessGranted, true);
    assert.equal(second.snapshot().receiveCount, 0);
    assert.equal(second.snapshot().checkCount, 0);
    assert.equal(second.snapshot().accessGranted, false);
    assert.equal(second.receive(), signal);
});

test("different page secrets can be generated deterministically for testing", () => {
    const first = loadCore(deterministicCrypto(1)).createRandomPassword();
    const second = loadCore(deterministicCrypto(2)).createRandomPassword();

    assert.notEqual(first, second);
});
