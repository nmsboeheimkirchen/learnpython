(() => {
    "use strict";

    const STORAGE_KEYS = Object.freeze({
        unlockedLevels: "unlockedLevels_v2",
        completedCode: "completedLevelCode_v1",
        attemptedCode: "attemptedLevelCode_v1",
        pixelmuseumHelp: "pixelmuseumHelp_v1",
        teacherMode: "cheatMode",
        legacySidebar: "sidebarState"
    });
    const LEARNING_KEYS = Object.freeze([
        STORAGE_KEYS.unlockedLevels,
        STORAGE_KEYS.completedCode,
        STORAGE_KEYS.attemptedCode,
        STORAGE_KEYS.pixelmuseumHelp
    ]);
    const TRACKED_KEYS = new Set(Object.values(STORAGE_KEYS));
    const LEARNING_DATA_LOCK = "agent-py-learning-data-v1";
    const LEARNING_DATA_LOCK_DB = "agent-py-learning-locks-v1";
    const LEARNING_DATA_LOCK_STORE = "locks";

    function clone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function errorResult(error, operation, key) {
        const errorName = typeof error?.name === "string" ? error.name : "StorageError";
        const quotaExceeded = errorName === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
        return {
            ok: false,
            error: {
                code: quotaExceeded ? "STORAGE_QUOTA_EXCEEDED" : "STORAGE_UNAVAILABLE",
                key,
                message: quotaExceeded
                    ? "Der Browserspeicher ist voll. Dein Lernstand wurde nicht gespeichert."
                    : "Der Browser blockiert den Lernstand. Die letzte Änderung wurde nicht gespeichert.",
                name: errorName,
                operation
            }
        };
    }

    function unavailableResult(operation, key) {
        return errorResult({ name: "SecurityError" }, operation, key);
    }

    function createStorageDriver(storage) {
        return Object.freeze({
            getItem(key) {
                if (!storage || typeof storage.getItem !== "function") return unavailableResult("getItem", key);
                try {
                    return { ok: true, value: storage.getItem(key) };
                } catch (error) {
                    return errorResult(error, "getItem", key);
                }
            },
            setItem(key, value) {
                if (!storage || typeof storage.setItem !== "function") return unavailableResult("setItem", key);
                try {
                    storage.setItem(key, String(value));
                    return { ok: true };
                } catch (error) {
                    return errorResult(error, "setItem", key);
                }
            },
            removeItem(key) {
                if (!storage || typeof storage.removeItem !== "function") return unavailableResult("removeItem", key);
                try {
                    storage.removeItem(key);
                    return { ok: true };
                } catch (error) {
                    return errorResult(error, "removeItem", key);
                }
            }
        });
    }

    function browserStorage() {
        try {
            return window.localStorage;
        } catch (_error) {
            return null;
        }
    }

    function browserWebLockManager() {
        try {
            return window.navigator?.locks || null;
        } catch (_error) {
            return null;
        }
    }

    function browserIndexedDb() {
        try {
            return window.indexedDB || null;
        } catch (_error) {
            return null;
        }
    }

    function lockFailure(error, actionStarted = false) {
        const failure = new Error(
            typeof error?.message === "string"
                ? error.message
                : "Die lokale Lernstandssperre ist nicht verfügbar."
        );
        failure.name = typeof error?.name === "string" ? error.name : "StorageError";
        failure.actionStarted = actionStarted;
        return failure;
    }

    function createIndexedDbLockManager(indexedDb) {
        if (!indexedDb || typeof indexedDb.open !== "function") return null;
        let databasePromise = null;

        function openDatabase() {
            if (databasePromise) return databasePromise;

            databasePromise = new Promise((resolve, reject) => {
                let request;
                try {
                    request = indexedDb.open(LEARNING_DATA_LOCK_DB, 1);
                } catch (error) {
                    reject(lockFailure(error));
                    return;
                }

                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(LEARNING_DATA_LOCK_STORE)) {
                        database.createObjectStore(LEARNING_DATA_LOCK_STORE);
                    }
                };
                request.onerror = () => reject(lockFailure(request.error));
                request.onblocked = () => reject(lockFailure({
                    name: "InvalidStateError",
                    message: "Die lokale Lernstandssperre wird von einem anderen Tab blockiert."
                }));
                request.onsuccess = () => {
                    const database = request.result;
                    database.onversionchange = () => {
                        database.close();
                        databasePromise = null;
                    };
                    if ("onclose" in database) {
                        database.onclose = () => {
                            databasePromise = null;
                        };
                    }
                    resolve(database);
                };
            }).catch(error => {
                databasePromise = null;
                throw error;
            });

            return databasePromise;
        }

        return Object.freeze({
            request(name, _options, action) {
                return openDatabase().then(database => new Promise((resolve, reject) => {
                    let actionResult;
                    let actionStarted = false;
                    let settled = false;
                    let transaction;

                    const fail = error => {
                        if (settled) return;
                        settled = true;
                        reject(lockFailure(error, actionStarted));
                    };

                    try {
                        transaction = database.transaction(LEARNING_DATA_LOCK_STORE, "readwrite");
                    } catch (error) {
                        fail(error);
                        return;
                    }

                    transaction.onabort = () => fail(transaction.error);
                    transaction.onerror = () => fail(transaction.error);
                    transaction.oncomplete = () => {
                        if (settled) return;
                        settled = true;
                        resolve(actionResult);
                    };

                    let request;
                    try {
                        request = transaction.objectStore(LEARNING_DATA_LOCK_STORE).get(name);
                    } catch (error) {
                        try {
                            transaction.abort();
                        } catch (_abortError) {
                            // Die ursprüngliche Ursache wird gemeldet.
                        }
                        fail(error);
                        return;
                    }

                    request.onsuccess = () => {
                        actionStarted = true;
                        try {
                            actionResult = action();
                        } catch (error) {
                            try {
                                transaction.abort();
                            } catch (_abortError) {
                                // Die ursprüngliche Ursache wird gemeldet.
                            }
                            fail(error);
                        }
                    };
                }));
            }
        });
    }

    function browserLockManager() {
        const webLocks = browserWebLockManager();
        const databaseLocks = createIndexedDbLockManager(browserIndexedDb());
        if (!webLocks) return databaseLocks;
        if (!databaseLocks) return webLocks;

        // Manche WebKit-Builds stellen Web Locks bereit, teilen sie aber nicht
        // zuverlässig zwischen Tabs. Die IDB-Transaktion ist daher primär;
        // Web Locks bleiben der Fallback, falls IndexedDB vor der Aktion ausfällt.
        return Object.freeze({
            request(name, options, action) {
                let actionStarted = false;
                const trackedAction = () => {
                    actionStarted = true;
                    return action();
                };
                const withWebLock = () => webLocks.request(name, options, trackedAction);

                try {
                    return Promise.resolve(databaseLocks.request(name, options, trackedAction))
                        .catch(error => {
                            if (actionStarted || error?.actionStarted) throw error;
                            return withWebLock();
                        });
                } catch (error) {
                    if (actionStarted) return Promise.reject(error);
                    return Promise.resolve(withWebLock());
                }
            }
        });
    }

    function createLocalLearningStores(options = {}) {
        const driver = createStorageDriver(
            Object.prototype.hasOwnProperty.call(options, "storage")
                ? options.storage
                : browserStorage()
        );
        const lockManager = Object.prototype.hasOwnProperty.call(options, "lockManager")
            ? options.lockManager
            : browserLockManager();
        const defaultUnlockedLevelIds = Array.isArray(options.defaultUnlockedLevelIds)
            ? [...options.defaultUnlockedLevelIds]
            : [];
        const normalizeUnlockedLevelIds = typeof options.normalizeUnlockedLevelIds === "function"
            ? options.normalizeUnlockedLevelIds
            : value => (Array.isArray(value) ? value : defaultUnlockedLevelIds);
        const normalizeCodeMap = typeof options.normalizeCodeMap === "function"
            ? options.normalizeCodeMap
            : value => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
        const isKnownLevel = typeof options.isKnownLevel === "function"
            ? options.isKnownLevel
            : () => true;
        const featureKeys = Object.freeze({
            pixelmuseum: STORAGE_KEYS.pixelmuseumHelp,
            ...(options.featureKeys || {})
        });
        const externalListeners = new Set();

        function withExclusiveLearningLock(action) {
            if (!lockManager || typeof lockManager.request !== "function") {
                return action();
            }

            try {
                return lockManager
                    .request(LEARNING_DATA_LOCK, { mode: "exclusive" }, action)
                    .catch(error => errorResult(error, "lock", null));
            } catch (error) {
                return errorResult(error, "lock", null);
            }
        }

        function readJson(key, fallback, normalize) {
            const stored = driver.getItem(key);
            if (!stored.ok) return { ...stored, value: clone(fallback) };
            if (stored.value === null || stored.value === "") {
                return { ok: true, value: clone(fallback) };
            }

            try {
                const parsed = JSON.parse(stored.value);
                const normalized = normalize(parsed);
                const normalizedJson = JSON.stringify(normalized);
                if (normalizedJson !== JSON.stringify(parsed)) {
                    const repaired = driver.setItem(key, normalizedJson);
                    if (!repaired.ok) return { ...repaired, value: clone(normalized) };
                }
                return { ok: true, value: clone(normalized) };
            } catch (_error) {
                const removed = driver.removeItem(key);
                if (!removed.ok) return { ...removed, value: clone(fallback) };
                return { ok: true, value: clone(fallback) };
            }
        }

        function writeJson(key, value) {
            return driver.setItem(key, JSON.stringify(value));
        }

        function readUnlocked() {
            return readJson(
                STORAGE_KEYS.unlockedLevels,
                defaultUnlockedLevelIds,
                normalizeUnlockedLevelIds
            );
        }

        function readCodeMap(key) {
            return readJson(key, {}, normalizeCodeMap);
        }

        function writeCode(key, levelId, code) {
            if (!isKnownLevel(levelId) || typeof code !== "string") {
                return {
                    ok: false,
                    error: {
                        code: "INVALID_LEARNING_DATA",
                        key,
                        message: "Dieser Code gehört zu keinem bekannten Level.",
                        name: "ValidationError",
                        operation: "setItem"
                    }
                };
            }

            const current = readCodeMap(key);
            if (!current.ok) return current;
            const next = { ...current.value, [levelId]: code };
            return writeJson(key, next);
        }

        const progressStore = Object.freeze({
            getUnlockedLevelIds() {
                return readUnlocked();
            },

            grantUnlocks(unlockIds) {
                return withExclusiveLearningLock(() => {
                    const current = readUnlocked();
                    if (!current.ok) return current;
                    const requested = Array.isArray(unlockIds) ? unlockIds : [unlockIds];
                    const next = normalizeUnlockedLevelIds([...current.value, ...requested]);
                    if (JSON.stringify(next) === JSON.stringify(current.value)) return { ok: true };
                    return writeJson(STORAGE_KEYS.unlockedLevels, next);
                });
            },

            getFeatureProgress(featureId) {
                const key = featureKeys[featureId];
                if (!key) return { ok: true, value: null };
                return readJson(key, null, value => (
                    value && typeof value === "object" && !Array.isArray(value) ? value : null
                ));
            },

            setFeatureProgress(featureId, value) {
                const key = featureKeys[featureId];
                if (!key || !value || typeof value !== "object" || Array.isArray(value)) {
                    return {
                        ok: false,
                        error: {
                            code: "INVALID_LEARNING_DATA",
                            key: key || null,
                            message: "Dieser Hilfestand kann nicht gespeichert werden.",
                            name: "ValidationError",
                            operation: "setItem"
                        }
                    };
                }
                return withExclusiveLearningLock(() => writeJson(key, value));
            }
        });

        const codeStore = Object.freeze({
            getAttemptedCode(levelId) {
                const result = readCodeMap(STORAGE_KEYS.attemptedCode);
                if (!result.ok) return { ...result, value: null };
                return {
                    ok: true,
                    value: Object.prototype.hasOwnProperty.call(result.value, levelId)
                        ? result.value[levelId]
                        : null
                };
            },

            getCompletedCode(levelId) {
                const result = readCodeMap(STORAGE_KEYS.completedCode);
                if (!result.ok) return { ...result, value: null };
                return {
                    ok: true,
                    value: Object.prototype.hasOwnProperty.call(result.value, levelId)
                        ? result.value[levelId]
                        : null
                };
            },

            getCompletedCodes() {
                return readCodeMap(STORAGE_KEYS.completedCode);
            },

            recordAttempt(levelId, code) {
                return withExclusiveLearningLock(() => writeCode(STORAGE_KEYS.attemptedCode, levelId, code));
            },

            recordCompletion(levelId, code) {
                return withExclusiveLearningLock(() => writeCode(STORAGE_KEYS.completedCode, levelId, code));
            }
        });

        function completeLevel({ levelId, code, unlockIds = [] } = {}) {
            if (!isKnownLevel(levelId) || typeof code !== "string") {
                return writeCode(STORAGE_KEYS.completedCode, levelId, code);
            }

            const previousCodes = readCodeMap(STORAGE_KEYS.completedCode);
            if (!previousCodes.ok) return previousCodes;
            const previousUnlocks = readUnlocked();
            if (!previousUnlocks.ok) return previousUnlocks;

            const nextCodes = { ...previousCodes.value, [levelId]: code };
            const nextUnlocks = normalizeUnlockedLevelIds([
                ...previousUnlocks.value,
                ...(Array.isArray(unlockIds) ? unlockIds : [])
            ]);
            const savedCode = writeJson(STORAGE_KEYS.completedCode, nextCodes);
            if (!savedCode.ok) return savedCode;

            if (JSON.stringify(nextUnlocks) === JSON.stringify(previousUnlocks.value)) {
                return { ok: true };
            }

            const savedProgress = writeJson(STORAGE_KEYS.unlockedLevels, nextUnlocks);
            if (savedProgress.ok) return savedProgress;

            const rollback = writeJson(STORAGE_KEYS.completedCode, previousCodes.value);
            return {
                ...savedProgress,
                error: {
                    ...savedProgress.error,
                    rollbackSucceeded: rollback.ok
                }
            };
        }

        function removeKeysAtomically(keys) {
            const snapshot = new Map();
            for (const key of keys) {
                const result = driver.getItem(key);
                if (!result.ok) return result;
                snapshot.set(key, result.value);
            }

            for (let index = 0; index < keys.length; index += 1) {
                const result = driver.removeItem(keys[index]);
                if (result.ok) continue;

                let rollbackSucceeded = true;
                for (const affectedKey of keys.slice(0, index + 1)) {
                    const previousValue = snapshot.get(affectedKey);
                    if (previousValue === null) continue;
                    if (!driver.setItem(affectedKey, previousValue).ok) rollbackSucceeded = false;
                }
                return {
                    ...result,
                    error: { ...result.error, rollbackSucceeded }
                };
            }
            return { ok: true };
        }

        function resetLearningData() {
            return removeKeysAtomically(LEARNING_KEYS);
        }

        const settingsStore = Object.freeze({
            isTeacherMode() {
                const result = driver.getItem(STORAGE_KEYS.teacherMode);
                if (!result.ok) return { ...result, value: false };
                return { ok: true, value: result.value === "true" };
            },
            enableTeacherMode() {
                return driver.setItem(STORAGE_KEYS.teacherMode, "true");
            },
            clear() {
                return removeKeysAtomically([STORAGE_KEYS.teacherMode, STORAGE_KEYS.legacySidebar]);
            }
        });

        const draftCache = Object.freeze({
            clear() { return { ok: true }; },
            get() { return { ok: true, value: null }; },
            set() { return { ok: true }; }
        });

        function handleStorageEvent(event) {
            if (!event || !TRACKED_KEYS.has(event.key)) return;
            externalListeners.forEach(listener => listener({ key: event.key }));
        }

        if (typeof window.addEventListener === "function") {
            window.addEventListener("storage", handleStorageEvent);
        }

        const coordinator = Object.freeze({
            completeLevel(command) {
                return withExclusiveLearningLock(() => completeLevel(command));
            },
            resetLearningData() {
                return withExclusiveLearningLock(resetLearningData);
            },
            subscribe(listener) {
                if (typeof listener !== "function") return () => {};
                externalListeners.add(listener);
                return () => externalListeners.delete(listener);
            }
        });

        return Object.freeze({
            codeStore,
            coordinator,
            draftCache,
            progressStore,
            settingsStore
        });
    }

    window.AgentPyLocalLearningData = Object.freeze({
        STORAGE_KEYS,
        createLocalLearningStores
    });
})();
