(() => {
    "use strict";

    function frozenContext(context = {}) {
        const kind = context.kind ?? "guest";
        if (kind !== "guest" && kind !== "authenticated") {
            throw new Error("Unbekannter Lernstandskontext.");
        }
        const profileId = kind === "guest"
            ? "guest-local"
            : (typeof context.profileId === "string" ? context.profileId.trim() : "");

        if (!profileId) {
            throw new Error("Ein angemeldeter Lernstand braucht eine eindeutige Profil-ID.");
        }

        return Object.freeze({ kind, profileId });
    }

    function errorDetails(error, operation) {
        const source = error && typeof error === "object" ? error : {};
        const details = {
            code: typeof source.code === "string" ? source.code : "STORAGE_ERROR",
            key: typeof source.key === "string" ? source.key : null,
            message: typeof source.message === "string"
                ? source.message
                : "Der Lernstand konnte nicht gespeichert werden.",
            name: typeof source.name === "string" ? source.name : "StorageError",
            operation
        };
        if (typeof source.rollbackSucceeded === "boolean") {
            details.rollbackSucceeded = source.rollbackSucceeded;
        }
        return Object.freeze(details);
    }

    function outcomeFrom(value) {
        if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "ok")) {
            return value;
        }
        return { ok: value !== false, value };
    }

    function createLearningSession(options = {}) {
        const context = frozenContext(options.context);
        const progressStore = options.progressStore;
        const codeStore = options.codeStore;
        const coordinator = options.coordinator;
        const draftCache = options.draftCache || {
            clear() { return true; },
            get() { return null; },
            set() { return true; }
        };

        if (!progressStore || !codeStore || !coordinator) {
            throw new Error("ProgressStore, CodeStore und Koordinator sind erforderlich.");
        }

        const listeners = new Set();
        let disposed = false;
        let generation = 0;
        let lastError = null;

        function emit(event) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (_error) {
                    // Ein UI-Listener darf die Speicherung nicht unterbrechen.
                }
            });
        }

        function reportError(error, operation) {
            lastError = errorDetails(error, operation);
            emit(Object.freeze({ type: "error", error: lastError, context }));
        }

        function finalizeWrite(rawOutcome, operation, operationGeneration) {
            if (disposed || operationGeneration !== generation) {
                emit(Object.freeze({ type: "stale-operation", operation, context }));
                return false;
            }

            const outcome = outcomeFrom(rawOutcome);
            if (!outcome.ok) {
                reportError(outcome.error, operation);
                return false;
            }

            lastError = null;
            emit(Object.freeze({ type: "change", operation, context }));
            return true;
        }

        function write(operation, action) {
            if (disposed) {
                reportError({ code: "SESSION_CLOSED", message: "Diese Lernsitzung ist bereits beendet." }, operation);
                return false;
            }

            const operationGeneration = generation;
            try {
                const result = action();
                if (result && typeof result.then === "function") {
                    return result
                        .then(value => finalizeWrite(value, operation, operationGeneration))
                        .catch(error => {
                            if (!disposed && operationGeneration === generation) reportError(error, operation);
                            return false;
                        });
                }
                return finalizeWrite(result, operation, operationGeneration);
            } catch (error) {
                reportError(error, operation);
                return false;
            }
        }

        function read(operation, action, fallback) {
            if (disposed) return fallback;
            try {
                const outcome = outcomeFrom(action());
                if (!outcome.ok) {
                    reportError(outcome.error, operation);
                    return Object.prototype.hasOwnProperty.call(outcome, "value") ? outcome.value : fallback;
                }
                return Object.prototype.hasOwnProperty.call(outcome, "value") ? outcome.value : fallback;
            } catch (error) {
                reportError(error, operation);
                return fallback;
            }
        }

        const unsubscribeExternal = typeof coordinator.subscribe === "function"
            ? coordinator.subscribe(event => emit(Object.freeze({
                type: "external-change",
                context,
                detail: event || null
            })))
            : null;

        const ready = Promise.resolve(coordinator.ready)
            .then(() => !disposed)
            .catch(error => {
                if (disposed) return false;
                reportError(error, "ready");
                return false;
            });

        const api = {
            context,
            ready,

            getUnlockedLevelIds() {
                return read("read-progress", () => progressStore.getUnlockedLevelIds(), []);
            },

            getCompletedLevelCodes() {
                return read("read-completed-code", () => codeStore.getCompletedCodes(), {});
            },

            isCompleted(levelId) {
                return read("read-completed-code", () => codeStore.getCompletedCode(levelId), null) !== null;
            },

            getAttemptedCode(levelId) {
                return read("read-attempted-code", () => codeStore.getAttemptedCode(levelId), null);
            },

            getCompletedCode(levelId) {
                return read("read-completed-code", () => codeStore.getCompletedCode(levelId), null);
            },

            recordAttempt(levelId, code) {
                return write("record-attempt", () => codeStore.recordAttempt(levelId, code));
            },

            completeLevel({ levelId, code, unlockIds = [] } = {}) {
                return write("complete-level", () => coordinator.completeLevel({
                    levelId,
                    code,
                    unlockIds
                }));
            },

            grantUnlocks(unlockIds) {
                return write("grant-unlocks", () => progressStore.grantUnlocks(unlockIds));
            },

            getFeatureProgress(featureId) {
                return read("read-feature-progress", () => progressStore.getFeatureProgress(featureId), null);
            },

            setFeatureProgress(featureId, value) {
                return write("set-feature-progress", () => progressStore.setFeatureProgress(featureId, value));
            },

            getDraft(levelId) {
                return read("read-draft", () => draftCache.get(levelId), null);
            },

            saveDraft(levelId, code) {
                return write("save-draft", () => draftCache.set(levelId, code));
            },

            clearDraft(levelId) {
                return write("clear-draft", () => draftCache.clear(levelId));
            },

            resetLearningData() {
                return write("reset-learning-data", () => coordinator.resetLearningData());
            },

            getLastError() {
                return lastError;
            },

            subscribe(listener) {
                if (typeof listener !== "function") return () => {};
                listeners.add(listener);
                return () => listeners.delete(listener);
            },

            dispose() {
                if (disposed) return;
                disposed = true;
                generation += 1;
                if (typeof unsubscribeExternal === "function") unsubscribeExternal();
                listeners.clear();
            }
        };

        return Object.freeze(api);
    }

    function createDeviceSettings(settingsStore) {
        if (!settingsStore) throw new Error("Ein SettingsStore ist erforderlich.");
        return Object.freeze({
            isTeacherMode() {
                const outcome = outcomeFrom(settingsStore.isTeacherMode());
                return outcome.ok ? Boolean(outcome.value) : false;
            },
            enableTeacherMode() {
                const outcome = outcomeFrom(settingsStore.enableTeacherMode());
                return Boolean(outcome.ok);
            },
            clear() {
                const outcome = outcomeFrom(settingsStore.clear());
                return Boolean(outcome.ok);
            }
        });
    }

    window.AgentLearningDataCore = Object.freeze({
        createDeviceSettings,
        createLearningSession
    });
})();
