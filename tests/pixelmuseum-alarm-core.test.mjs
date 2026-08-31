import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadAlarmCore() {
    const window = {};
    const context = vm.createContext({ Math, Number, Object, window });
    vm.runInContext(
        readFileSync(new URL("../assets/pixelmuseum-alarm-core.js", import.meta.url), "utf8"),
        context
    );
    return window.PixelmuseumAlarmCore;
}

test("Pixelmuseum alarm starts visibly at level 1 and advances in controlled steps", () => {
    const alarm = loadAlarmCore().createState();

    assert.deepEqual({ ...alarm.snapshot() }, {
        level: 0,
        maxLevel: 8,
        started: false,
        disabled: false,
        failed: false
    });
    assert.equal(alarm.advance().level, 0, "time alone cannot advance an unarmed alarm");
    assert.equal(alarm.start().level, 1);
    assert.equal(alarm.advance().level, 2);
    assert.equal(alarm.advance(2).level, 4);
});

test("the alarm starts immediately but the portal stays open until level 3", () => {
    const alarm = loadAlarmCore().createState();
    alarm.start();

    assert.equal(alarm.snapshot().level, 1);
    assert.equal(alarm.isPortalOpen(true), true);
    alarm.advance();
    assert.equal(alarm.snapshot().level, 2);
    assert.equal(alarm.isPortalOpen(true), true);
    alarm.advance();
    assert.equal(alarm.snapshot().level, 3);
    assert.equal(alarm.isPortalOpen(true), false);
});

test("a valid deterministic hack reopens the portal before the action budget expires", () => {
    const alarm = loadAlarmCore().createState();
    alarm.start();
    alarm.advance();
    const hacked = alarm.disable();

    assert.equal(hacked.disabled, true);
    assert.equal(hacked.failed, false);
    assert.equal(hacked.level, 0);
    assert.equal(alarm.isPortalOpen(true), true);
});

test("the alarm fails deterministically at its eighth completed action", () => {
    const alarm = loadAlarmCore().createState();
    alarm.start();
    const almostFailed = alarm.advance(6);
    const failed = alarm.advance();

    assert.equal(almostFailed.failed, false);
    assert.equal(failed.failed, true);
    assert.equal(failed.level, 8);
    assert.equal(alarm.disable().disabled, false, "a late hack cannot undo failure");
});
