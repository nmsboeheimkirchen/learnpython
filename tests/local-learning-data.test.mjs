import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const adapterSource = readFileSync(
    new URL("../assets/data/local-learning-data.js", import.meta.url),
    "utf8"
);

class FaultStorage {
    constructor(initial = {}) {
        this.data = new Map(Object.entries(initial));
        this.calls = [];
        this.failure = null;
    }

    fail(operation, key, name = "SecurityError") {
        this.failure = { operation, key, name };
    }

    maybeThrow(operation, key, value) {
        this.calls.push({ operation, key, value });
        if (this.failure?.operation === operation && this.failure?.key === key) {
            const error = new Error(`${operation} failed`);
            error.name = this.failure.name;
            throw error;
        }
    }

    getItem(key) {
        this.maybeThrow("getItem", key);
        return this.data.has(key) ? this.data.get(key) : null;
    }

    setItem(key, value) {
        this.maybeThrow("setItem", key, String(value));
        this.data.set(key, String(value));
    }

    removeItem(key) {
        this.maybeThrow("removeItem", key);
        this.data.delete(key);
    }
}

function loadAdapter() {
    const storageListeners = [];
    const window = {
        addEventListener(type, listener) {
            if (type === "storage") storageListeners.push(listener);
        }
    };
    vm.runInContext(adapterSource, vm.createContext({ window }));
    return {
        adapter: window.AgentPyLocalLearningData,
        dispatchStorage(event) {
            storageListeners.forEach(listener => listener(event));
        }
    };
}

const knownLevels = new Set(["level-1", "level-2"]);
const knownUnlocks = new Set(["start", "link-level-2", "link-finale"]);

function normalizeCodeMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value).filter(([id, code]) => knownLevels.has(id) && typeof code === "string")
    );
}

function normalizeUnlocks(value) {
    const requested = Array.isArray(value) ? value : [];
    return [...new Set(["start", ...requested.filter(id => knownUnlocks.has(id))])];
}

function createStores(adapter, storage, additionalOptions = {}) {
    return adapter.createLocalLearningStores({
        storage,
        defaultUnlockedLevelIds: ["start"],
        isKnownLevel: id => knownLevels.has(id),
        normalizeCodeMap,
        normalizeUnlockedLevelIds: normalizeUnlocks,
        ...additionalOptions
    });
}

test("the local adapter preserves the established keys and exact code versions", () => {
    const { adapter } = loadAdapter();
    const keys = adapter.STORAGE_KEYS;
    const storage = new FaultStorage({
        [keys.unlockedLevels]: JSON.stringify(["start", "link-level-2"]),
        [keys.completedCode]: JSON.stringify({ "level-1": "print('done')" }),
        [keys.attemptedCode]: JSON.stringify({ "level-2": "print('draft')" }),
        [keys.pixelmuseumHelp]: JSON.stringify({ used: 2 })
    });
    const stores = createStores(adapter, storage);

    assert.deepEqual([...stores.progressStore.getUnlockedLevelIds().value], ["start", "link-level-2"]);
    assert.equal(stores.codeStore.getCompletedCode("level-1").value, "print('done')");
    assert.equal(stores.codeStore.getAttemptedCode("level-2").value, "print('draft')");
    assert.equal(stores.progressStore.getFeatureProgress("pixelmuseum").value.used, 2);

    assert.equal(stores.codeStore.recordAttempt("level-1", "print('new')").ok, true);
    assert.deepEqual(JSON.parse(storage.data.get("attemptedLevelCode_v1")), {
        "level-1": "print('new')",
        "level-2": "print('draft')"
    });
    assert.equal(storage.data.has("attemptedLevelCode_v2"), false);
});

test("a blocked getItem returns a safe fallback without deleting existing data", () => {
    const { adapter } = loadAdapter();
    const key = adapter.STORAGE_KEYS.attemptedCode;
    const original = JSON.stringify({ "level-1": "keep me" });
    const storage = new FaultStorage({ [key]: original });
    storage.fail("getItem", key);
    const stores = createStores(adapter, storage);

    const result = stores.codeStore.getAttemptedCode("level-1");
    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.equal(result.error.code, "STORAGE_UNAVAILABLE");
    assert.equal(result.error.operation, "getItem");
    assert.equal(storage.data.get(key), original);
    assert.equal(storage.calls.some(call => call.operation === "removeItem"), false);
});

test("a quota error leaves the previous attempted code byte-for-byte intact", () => {
    const { adapter } = loadAdapter();
    const key = adapter.STORAGE_KEYS.attemptedCode;
    const original = JSON.stringify({ "level-1": "old" });
    const storage = new FaultStorage({ [key]: original });
    storage.fail("setItem", key, "QuotaExceededError");
    const stores = createStores(adapter, storage);

    const result = stores.codeStore.recordAttempt("level-2", "new");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "STORAGE_QUOTA_EXCEEDED");
    assert.equal(result.error.operation, "setItem");
    assert.equal(storage.data.get(key), original);
});

test("a removeItem failure makes reset fail and never touches unrelated browser data", () => {
    const { adapter } = loadAdapter();
    const keys = adapter.STORAGE_KEYS;
    const storage = new FaultStorage({
        [keys.unlockedLevels]: "[]",
        [keys.completedCode]: "{}",
        [keys.attemptedCode]: "{}",
        [keys.pixelmuseumHelp]: "{}",
        unrelated: "belongs to another feature"
    });
    storage.fail("removeItem", keys.completedCode);
    const stores = createStores(adapter, storage);

    const result = stores.coordinator.resetLearningData();
    assert.equal(result.ok, false);
    assert.equal(result.error.operation, "removeItem");
    assert.equal(result.error.rollbackSucceeded, true);
    assert.equal(storage.data.get(keys.unlockedLevels), "[]");
    assert.equal(storage.data.has(keys.completedCode), true);
    assert.equal(storage.data.get("unrelated"), "belongs to another feature");
    assert.equal(storage.calls.some(call => call.key === "unrelated"), false);
});

test("an invalid completion fails inside the shared lock without requesting it recursively", async () => {
    const { adapter } = loadAdapter();
    const storage = new FaultStorage();
    let lockRequests = 0;
    const lockManager = {
        request(_name, _options, action) {
            lockRequests += 1;
            return Promise.resolve().then(action);
        }
    };
    const stores = createStores(adapter, storage, { lockManager });

    const result = await stores.coordinator.completeLevel({
        levelId: "unknown-level",
        code: "code",
        unlockIds: []
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_LEARNING_DATA");
    assert.equal(lockRequests, 1);
});

test("completeLevel rolls the code back when its unlock write fails", () => {
    const { adapter } = loadAdapter();
    const keys = adapter.STORAGE_KEYS;
    const originalCodes = JSON.stringify({ "level-1": "old code" });
    const originalUnlocks = JSON.stringify(["start"]);
    const storage = new FaultStorage({
        [keys.completedCode]: originalCodes,
        [keys.unlockedLevels]: originalUnlocks
    });
    storage.fail("setItem", keys.unlockedLevels, "QuotaExceededError");
    const stores = createStores(adapter, storage);

    const result = stores.coordinator.completeLevel({
        levelId: "level-2",
        code: "new code",
        unlockIds: ["link-level-2"]
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "STORAGE_QUOTA_EXCEEDED");
    assert.equal(result.error.rollbackSucceeded, true);
    assert.equal(storage.data.get(keys.completedCode), originalCodes);
    assert.equal(storage.data.get(keys.unlockedLevels), originalUnlocks);
});

test("two adapter instances merge consecutive changes over the same browser storage", () => {
    const { adapter } = loadAdapter();
    const storage = new FaultStorage();
    const tabA = createStores(adapter, storage);
    const tabB = createStores(adapter, storage);

    assert.equal(tabA.coordinator.completeLevel({
        levelId: "level-1",
        code: "A",
        unlockIds: ["link-level-2"]
    }).ok, true);
    assert.equal(tabB.coordinator.completeLevel({
        levelId: "level-2",
        code: "B",
        unlockIds: ["link-finale"]
    }).ok, true);

    assert.deepEqual(JSON.parse(storage.data.get(adapter.STORAGE_KEYS.completedCode)), {
        "level-1": "A",
        "level-2": "B"
    });
    assert.deepEqual(JSON.parse(storage.data.get(adapter.STORAGE_KEYS.unlockedLevels)), [
        "start",
        "link-level-2",
        "link-finale"
    ]);
});

test("the shared browser lock serializes concurrent read-modify-write completions", async () => {
    const { adapter } = loadAdapter();
    const storage = new FaultStorage();
    const lockCalls = [];
    let queue = Promise.resolve();
    const lockManager = {
        request(name, options, action) {
            lockCalls.push({ name, options });
            const operation = queue.then(action);
            queue = operation.then(() => undefined, () => undefined);
            return operation;
        }
    };
    const tabA = createStores(adapter, storage, { lockManager });
    const tabB = createStores(adapter, storage, { lockManager });

    const [resultA, resultB] = await Promise.all([
        tabA.coordinator.completeLevel({
            levelId: "level-1",
            code: "A",
            unlockIds: ["link-level-2"]
        }),
        tabB.coordinator.completeLevel({
            levelId: "level-2",
            code: "B",
            unlockIds: ["link-finale"]
        })
    ]);

    assert.equal(resultA.ok, true);
    assert.equal(resultB.ok, true);
    assert.equal(lockCalls.length, 2);
    assert.equal(lockCalls.every(call => call.name === "agent-py-learning-data-v1"), true);
    assert.equal(lockCalls.every(call => call.options.mode === "exclusive"), true);
    assert.deepEqual(JSON.parse(storage.data.get(adapter.STORAGE_KEYS.completedCode)), {
        "level-1": "A",
        "level-2": "B"
    });
});

test("corrupt and unknown legacy entries are repaired safely", () => {
    const { adapter } = loadAdapter();
    const keys = adapter.STORAGE_KEYS;
    const storage = new FaultStorage({
        [keys.completedCode]: JSON.stringify({
            "level-1": "valid",
            "removed-level": "unknown",
            "level-2": 42
        }),
        [keys.attemptedCode]: "not-json"
    });
    const stores = createStores(adapter, storage);

    assert.deepEqual(JSON.parse(JSON.stringify(stores.codeStore.getCompletedCodes().value)), {
        "level-1": "valid"
    });
    assert.deepEqual(JSON.parse(storage.data.get(keys.completedCode)), { "level-1": "valid" });
    assert.equal(stores.codeStore.getAttemptedCode("level-1").value, null);
    assert.equal(storage.data.has(keys.attemptedCode), false);
});

test("the optional draft cache is a no-op and performs no browser-storage calls", () => {
    const { adapter } = loadAdapter();
    const storage = new FaultStorage();
    const stores = createStores(adapter, storage);
    const callCount = storage.calls.length;

    assert.equal(stores.draftCache.get("level-1").value, null);
    assert.equal(stores.draftCache.set("level-1", "every keystroke").ok, true);
    assert.equal(stores.draftCache.clear("level-1").ok, true);
    assert.equal(storage.calls.length, callCount);
});

test("tracked changes in another tab are exposed through the coordinator subscription", () => {
    const { adapter, dispatchStorage } = loadAdapter();
    const stores = createStores(adapter, new FaultStorage());
    const changes = [];
    const unsubscribe = stores.coordinator.subscribe(event => changes.push(event));

    dispatchStorage({ key: adapter.STORAGE_KEYS.completedCode });
    dispatchStorage({ key: "unrelated" });
    assert.deepEqual(JSON.parse(JSON.stringify(changes)), [{ key: adapter.STORAGE_KEYS.completedCode }]);

    unsubscribe();
    dispatchStorage({ key: adapter.STORAGE_KEYS.unlockedLevels });
    assert.equal(changes.length, 1);
});
