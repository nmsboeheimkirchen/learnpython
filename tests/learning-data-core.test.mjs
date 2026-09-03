import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const coreSource = readFileSync(
    new URL("../assets/data/learning-data-core.js", import.meta.url),
    "utf8"
);

function loadCore() {
    const window = {};
    vm.runInContext(coreSource, vm.createContext({ window }));
    return window.AgentLearningDataCore;
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function dependencies(label = "store") {
    const calls = [];
    const featureProgress = new Map();
    const attempted = new Map();
    const completed = new Map();
    const unlocked = ["start"];
    let externalListener = null;

    return {
        calls,
        fireExternal(detail) {
            externalListener?.(detail);
        },
        stores: {
            progressStore: {
                getUnlockedLevelIds() {
                    calls.push([label, "get-unlocks"]);
                    return { ok: true, value: [...unlocked] };
                },
                grantUnlocks(ids) {
                    calls.push([label, "grant-unlocks", [...ids]]);
                    unlocked.push(...ids);
                    return { ok: true };
                },
                getFeatureProgress(id) {
                    calls.push([label, "get-feature", id]);
                    return { ok: true, value: featureProgress.get(id) ?? null };
                },
                setFeatureProgress(id, value) {
                    calls.push([label, "set-feature", id, value]);
                    featureProgress.set(id, value);
                    return { ok: true };
                }
            },
            codeStore: {
                getAttemptedCode(id) {
                    calls.push([label, "get-attempt", id]);
                    return { ok: true, value: attempted.get(id) ?? null };
                },
                getCompletedCode(id) {
                    calls.push([label, "get-completed", id]);
                    return { ok: true, value: completed.get(id) ?? null };
                },
                getCompletedCodes() {
                    return { ok: true, value: Object.fromEntries(completed) };
                },
                recordAttempt(id, code) {
                    calls.push([label, "record-attempt", id, code]);
                    attempted.set(id, code);
                    return { ok: true };
                }
            },
            coordinator: {
                completeLevel(command) {
                    calls.push([label, "complete", command]);
                    completed.set(command.levelId, command.code);
                    return { ok: true };
                },
                resetLearningData() {
                    calls.push([label, "reset"]);
                    return { ok: true };
                },
                subscribe(listener) {
                    externalListener = listener;
                    return () => {
                        calls.push([label, "unsubscribe"]);
                        externalListener = null;
                    };
                }
            },
            draftCache: {
                get(id) {
                    calls.push([label, "get-draft", id]);
                    return { ok: true, value: null };
                },
                set(id, code) {
                    calls.push([label, "set-draft", id, code]);
                    return { ok: true };
                },
                clear(id) {
                    calls.push([label, "clear-draft", id]);
                    return { ok: true };
                }
            }
        }
    };
}

test("a learning session is permanently bound to one immutable profile context", async () => {
    const core = loadCore();
    const guestDeps = dependencies("guest");
    const profileDeps = dependencies("profile-a");
    const guest = core.createLearningSession({
        context: { kind: "guest" },
        ...guestDeps.stores
    });
    const profile = core.createLearningSession({
        context: { kind: "authenticated", profileId: " tenant-a:user-a " },
        ...profileDeps.stores
    });

    assert.equal(Object.isFrozen(guest.context), true);
    assert.equal(guest.context.kind, "guest");
    assert.equal(guest.context.profileId, "guest-local");
    assert.equal(profile.context.kind, "authenticated");
    assert.equal(profile.context.profileId, "tenant-a:user-a");

    assert.equal(await guest.recordAttempt("level-1", "guest code"), true);
    assert.equal(await profile.recordAttempt("level-1", "profile code"), true);
    assert.deepEqual(guestDeps.calls.at(-1), ["guest", "record-attempt", "level-1", "guest code"]);
    assert.deepEqual(profileDeps.calls.at(-1), ["profile-a", "record-attempt", "level-1", "profile code"]);
    assert.equal(guestDeps.calls.some(call => call[0] === "profile-a"), false);
    assert.equal(profileDeps.calls.some(call => call[0] === "guest"), false);

    assert.throws(
        () => core.createLearningSession({
            context: { kind: "authenticated" },
            ...dependencies().stores
        }),
        /eindeutige Profil-ID/
    );
    assert.throws(
        () => core.createLearningSession({
            context: { kind: "auth", profileId: "user" },
            ...dependencies().stores
        }),
        /Unbekannter Lernstandskontext/
    );
});

test("the facade routes progress, code, feature and draft operations through their stores", async () => {
    const core = loadCore();
    const deps = dependencies();
    const session = core.createLearningSession({ context: { kind: "guest" }, ...deps.stores });

    assert.deepEqual([...session.getUnlockedLevelIds()], ["start"]);
    assert.equal(await session.recordAttempt("level-1", "print(1)"), true);
    assert.equal(session.getAttemptedCode("level-1"), "print(1)");
    assert.equal(await session.completeLevel({
        levelId: "level-1",
        code: "print(1)",
        unlockIds: ["level-2"]
    }), true);
    assert.equal(session.isCompleted("level-1"), true);
    assert.equal(await session.grantUnlocks(["extra"]), true);
    assert.equal(await session.setFeatureProgress("museum", { help: 2 }), true);
    assert.equal(session.getFeatureProgress("museum").help, 2);
    assert.equal(await session.saveDraft("level-1", "draft"), true);
    assert.equal(session.getDraft("level-1"), null);
    assert.equal(await session.clearDraft("level-1"), true);
    assert.equal(await session.resetLearningData(), true);

    assert.equal(deps.calls.some(call => call[1] === "complete"), true);
    assert.equal(deps.calls.some(call => call[1] === "set-feature"), true);
    assert.equal(deps.calls.some(call => call[1] === "set-draft"), true);
});

test("storage errors are observable and a failed write never reports success", async () => {
    const core = loadCore();
    const deps = dependencies();
    deps.stores.codeStore.recordAttempt = () => ({
        ok: false,
        error: {
            code: "STORAGE_QUOTA_EXCEEDED",
            key: "attempted",
            message: "voll",
            name: "QuotaExceededError"
        }
    });
    const session = core.createLearningSession({ context: { kind: "guest" }, ...deps.stores });
    const events = [];
    session.subscribe(event => events.push(event));

    assert.equal(await session.recordAttempt("level-1", "code"), false);
    assert.equal(session.getLastError().code, "STORAGE_QUOTA_EXCEEDED");
    assert.equal(session.getLastError().operation, "record-attempt");
    assert.equal(events.at(-1).type, "error");

    deps.stores.codeStore.getAttemptedCode = () => ({
        ok: false,
        value: null,
        error: { code: "STORAGE_UNAVAILABLE", message: "blockiert", name: "SecurityError" }
    });
    assert.equal(session.getAttemptedCode("level-1"), null);
    assert.equal(session.getLastError().operation, "read-attempted-code");
});

test("promise based adapters work and late results are discarded after a profile switch", async () => {
    const core = loadCore();
    const deps = dependencies();
    const pending = deferred();
    deps.stores.coordinator.completeLevel = () => pending.promise;
    const session = core.createLearningSession({
        context: { kind: "authenticated", profileId: "tenant:user-a" },
        ...deps.stores
    });
    const events = [];
    session.subscribe(event => events.push(event.type));

    const completion = session.completeLevel({ levelId: "level-1", code: "code" });
    session.dispose();
    pending.resolve({ ok: true });

    assert.equal(await completion, false);
    assert.equal(events.includes("change"), false);
    assert.equal(deps.calls.some(call => call[1] === "unsubscribe"), true);
});

test("an asynchronous adapter rejection is reported without falling back to another store", async () => {
    const core = loadCore();
    const deps = dependencies("profile-b");
    deps.stores.coordinator.completeLevel = async () => {
        const error = new Error("offline");
        error.code = "REMOTE_UNAVAILABLE";
        throw error;
    };
    const session = core.createLearningSession({
        context: { kind: "authenticated", profileId: "tenant:user-b" },
        ...deps.stores
    });

    assert.equal(await session.completeLevel({ levelId: "level-1", code: "code" }), false);
    assert.equal(session.getLastError().code, "REMOTE_UNAVAILABLE");
    assert.equal(session.context.profileId, "tenant:user-b");
});

test("external adapter changes are forwarded only while the session is active", () => {
    const core = loadCore();
    const deps = dependencies();
    const session = core.createLearningSession({ context: { kind: "guest" }, ...deps.stores });
    const events = [];
    session.subscribe(event => events.push(event));

    deps.fireExternal({ key: "progress" });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "external-change");
    assert.equal(events[0].detail.key, "progress");

    session.dispose();
    deps.fireExternal({ key: "code" });
    assert.equal(events.length, 1);
});
