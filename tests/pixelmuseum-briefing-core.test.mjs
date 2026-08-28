import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadBriefingCore() {
    const window = {};
    const context = vm.createContext({ Math, Number, Object, Set, window });
    vm.runInContext(
        readFileSync(new URL("../assets/drone-mission-core.js", import.meta.url), "utf8"),
        context
    );
    vm.runInContext(
        readFileSync(new URL("../assets/pixelmuseum-briefing-core.js", import.meta.url), "utf8"),
        context
    );
    return window.PixelmuseumBriefingCore;
}

test("Pixelmuseum briefing starts at the rehearsal coordinates with an empty inventory", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const snapshot = state.snapshot();

    assert.deepEqual({ ...briefing.START }, { x: 260, y: -170 });
    assert.deepEqual({ ...briefing.KEYCARD }, { x: -230, y: 70 });
    assert.deepEqual({ ...briefing.STAR_FRAGMENT }, { x: -70, y: -75 });
    assert.deepEqual({ ...snapshot.current }, { x: 260, y: -170 });
    assert.deepEqual([...snapshot.collectedItems], []);
    assert.equal(snapshot.pendingItem, null);
    assert.equal(snapshot.lastSearchFailure, null);
});

test("invented inventory strings neither collect an item nor unlock the fragment", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const inventedInventory = [briefing.KEYCARD_ITEM, briefing.STAR_FRAGMENT_ITEM];

    assert.equal(state.syncInventory(inventedInventory), false);
    assert.equal(state.searchHere(briefing.STAR_FRAGMENT, inventedInventory), null);

    const snapshot = state.snapshot();
    assert.equal(snapshot.keycardCollected, false);
    assert.equal(snapshot.starFragmentCollected, false);
    assert.deepEqual([...snapshot.collectedItems], []);
    assert.equal(snapshot.lastSearchFailure, briefing.FAILURES.KEYCARD_REQUIRED);
});

test("the real keycard must be collected before the real star fragment", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const inventory = [];

    const blockedFragment = state.searchHere(briefing.STAR_FRAGMENT, inventory);
    assert.equal(blockedFragment, null);
    assert.equal(state.snapshot().lastSearchFailure, briefing.FAILURES.KEYCARD_REQUIRED);

    const card = state.searchHere(briefing.KEYCARD, inventory);
    assert.equal(card, briefing.KEYCARD_ITEM);
    assert.equal(state.syncInventory(inventory), false, "finding alone must not collect the card");
    inventory.push(card);
    assert.equal(state.syncInventory(inventory), true);

    const fragment = state.searchHere(briefing.STAR_FRAGMENT, inventory);
    assert.equal(fragment, briefing.STAR_FRAGMENT_ITEM);
    inventory.push(fragment);
    assert.equal(state.syncInventory(inventory), true);

    const snapshot = state.snapshot();
    assert.equal(snapshot.keycardCollected, true);
    assert.equal(snapshot.starFragmentCollected, true);
    assert.deepEqual(
        [...snapshot.collectionOrder],
        [briefing.KEYCARD_ITEM, briefing.STAR_FRAGMENT_ITEM]
    );
});

test("a pre-existing matching string does not satisfy a newly issued find", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const inventory = [briefing.KEYCARD_ITEM];

    const card = state.searchHere(briefing.KEYCARD, inventory);
    assert.equal(card, briefing.KEYCARD_ITEM);
    assert.equal(state.syncInventory(inventory), false);
    assert.equal(state.snapshot().keycardCollected, false);

    inventory.push(card);
    assert.equal(state.syncInventory(inventory), true);
    assert.equal(state.snapshot().keycardCollected, true);
});

test("a genuine search return remains valid after the drone flies away", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const inventory = [];

    const card = state.searchHere(briefing.KEYCARD, inventory);
    assert.equal(state.snapshot().pendingItem, briefing.KEYCARD_ITEM);

    const frame = state.recordFrame({ x: briefing.KEYCARD.x + 40, y: briefing.KEYCARD.y });
    assert.equal(frame.moved, true);
    inventory.push(card);

    assert.equal(state.syncInventory(inventory), true);
    const snapshot = state.snapshot();
    assert.equal(snapshot.pendingItem, null);
    assert.equal(snapshot.keycardCollected, true);
    assert.equal(snapshot.lastSearchFailure, null);
});

test("wrong-place searches and reset expose stable state", () => {
    const briefing = loadBriefingCore();
    const state = briefing.createState();
    const inventory = [];

    assert.equal(state.searchHere({ x: 0, y: 0 }, inventory), null);
    assert.equal(state.snapshot().lastSearchFailure, briefing.FAILURES.WRONG_PLACE);

    const card = state.searchHere(briefing.KEYCARD, inventory);
    inventory.push(card);
    assert.equal(state.syncInventory(inventory), true);
    state.reset();

    const snapshot = state.snapshot();
    assert.deepEqual({ ...snapshot.current }, { ...briefing.START });
    assert.equal(snapshot.keycardCollected, false);
    assert.equal(snapshot.starFragmentCollected, false);
    assert.equal(snapshot.searchAttempted, false);
    assert.equal(snapshot.searchFound, false);
    assert.equal(snapshot.lastSearchFailure, null);
});
