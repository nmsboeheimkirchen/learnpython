(() => {
    "use strict";
    const copy = value => JSON.parse(JSON.stringify(value));
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
    const own = (map, key) => Object.hasOwn(map, key) ? map[key] : null;
    const messages = {
        NETWORK_ERROR: "Keine Serverbestätigung. Lass diese Seite offen und versuche die Speicherung erneut.",
        REVISION_CONFLICT: "Der Stand wurde in einem anderen Tab oder Gerät geändert. Sichere deinen aktuellen Code, bevor du den Serverstand neu lädst.",
        PROFILE_CHANGED: "Das angemeldete Konto wurde in einem anderen Tab geändert. Bitte lade die Seite neu.",
        AUTH_REQUIRED: "Deine Anmeldung ist abgelaufen. Sichere deinen Code und melde dich erneut an.",
        CSRF_MISMATCH: "Deine Sitzung hat sich geändert. Bitte melde dich erneut an.",
        INVALID_CREDENTIALS: "Anmeldung nicht möglich. Das Konto ist noch nicht angelegt oder bestätigt, oder E-Mail-Adresse oder Passwort sind falsch.",
        LOGIN_RATE_LIMITED: "Zu viele Anmeldeversuche. Bitte warte 15 Minuten.",
        REGISTRATION_UNAVAILABLE: "Die Neuanmeldung ist gerade nicht verfügbar. Du kannst im Gastmodus arbeiten.",
        CLASS_CODE_INVALID: "Der Klassencode ist ungültig oder abgelaufen.",
        CLASS_CODE_COOLDOWN: "Fünf falsche Versuche. Bitte warte fünf Minuten, bevor du es erneut versuchst.",
        REGISTRATION_RATE_LIMITED: "Gerade gibt es zu viele Anfragen. Bitte versuche es später erneut.",
        CLASS_CODE_REQUIRED: "Bitte gib deinen Klassencode erneut ein.",
        CLASS_FULL: "Diese Klasse hat keine freien Plätze mehr. Bitte frage deine Lehrperson.",
        ADMIN_REQUIRED: "Diese Verwaltung ist nur für Superadmins verfügbar.",
        TEACHER_NOT_AVAILABLE: "Diese Adresse gehört nicht zu einer verfügbaren, bereits freigeschalteten Lehrkraft.",
        ALREADY_TEACHER: "Diese Person ist bereits Lehrkraft. Du kannst ihr Klassenlimit bearbeiten.",
        INVALID_CLASS_LIMIT: "Bitte wähle 1 bis 100 eigene Klassen.",
        LIMIT_BELOW_USAGE: "Das Limit darf nicht unter der Anzahl bereits eigener Klassen liegen.",
        REGISTRATION_PENDING: "Bitte zuerst die offene Kontoanmeldung abschließen und danach erneut einladen.",
        INVALID_TEACHER_INVITATION: "Diese Einladung ist ungültig, abgelaufen oder bereits angenommen. Bitte den Superadmin um eine neue Einladung bitten.",
        ACCOUNT_INACTIVE: "Dieses Konto ist nicht aktiv. Bitte kontaktiere den Superadmin.",
        TEACHER_REQUIRED: "Diese Ansicht ist nur für freigeschaltete Lehrkräfte verfügbar.",
        CLASS_NOT_FOUND: "Diese Klasse ist nicht verfügbar oder gehört nicht zu deinen Klassen.",
        MEMBER_NOT_FOUND: "Dieses Schülerkonto ist nicht mehr in dieser Klasse. Bitte aktualisiere die Ansicht.",
        MEMBER_CHANGED: "Die Adresse wurde inzwischen geändert. Bitte aktualisiere die Klassenansicht.",
        EMAIL_UNAVAILABLE: "Diese Adresse wird bereits verwendet oder ist für eine Anmeldung reserviert.",
        DELETE_CONFIRMATION_REQUIRED: "Bitte bestätige beide Checkboxen und tippe genau LÖSCHEN ein.",
        PROTECTED_TEACHER_ACCOUNT: "Diese Klasse enthält ein geschütztes Lehrer:innenkonto und kann nicht gelöscht werden.",
        CLASS_LIMIT_REACHED: "Du hast dein Klassenlimit erreicht.",
        CLASS_NAME_TAKEN: "Innerhalb deiner Schul-Domain gibt es bereits eine Klasse mit diesem Namen. Wähle einen anderen Namen oder lass dich zur vorhandenen Klasse hinzufügen.",
        TARGET_CLASS_LIMIT_REACHED: "Die ausgewählte Lehrkraft hat keinen freien Platz in ihrem Klassenlimit. Der Superadmin kann das Limit erhöhen.",
        CLASS_OWNER_CANNOT_LEAVE: "Übertrage zuerst die Klasse an eine hinzugefügte Lehrkraft.",
        ACCOUNT_OWNS_CLASSES: "Übertrage oder lösche zuerst deine eigenen Klassen. Danach kannst du dein Konto löschen.",
        PROTECTED_ADMIN: "Das Superadmin-Konto ist vor Rollenentzug und Löschung geschützt. Den eigenen Anzeigenamen kannst du unter Kontoinfo ändern.",
        PASSWORD_CHECK_FAILED: "Das Passwort stimmt nicht. Dein Konto wurde nicht gelöscht.",
        SAME_CLASS: "Wähle eine andere Zielklasse.",
        TRANSFER_CHANGED: "Die Klassenverwaltung hat sich geändert. Bitte lade die Übersicht neu und stelle die Anfrage erneut.",
        TRANSFER_ALREADY_PENDING: "Für diese Person und Zielklasse besteht bereits eine andere Anfrage. Ziehe sie zuerst zurück.",
        TRANSFER_NOT_FOUND: "Diese Anfrage ist nicht mehr offen, abgelaufen oder für dich nicht verfügbar.",
        INVALID_CLASS_NAME: "Bitte gib einen Klassennamen mit 1 bis 100 Zeichen ein.",
        INVALID_NEW_PASSWORD: "Das Passwort braucht mindestens 8 Zeichen und darf höchstens 72 UTF-8-Bytes lang sein.",
        INVALID_NAME: "Bitte gib einen Namen mit 1 bis 100 Zeichen ein.",
        RECOVERY_UNAVAILABLE: "Passwort-Zurücksetzen ist gerade nicht verfügbar. Bitte frage deine Lehrperson.",
        RESET_INVALID: "Dieser Link ist ungültig, abgelaufen oder bereits verwendet. Fordere über Passwort vergessen einen neuen Link an.",
        PASSWORD_MISMATCH: "Die Passwörter stimmen nicht überein.",
        INVALID_EMAIL: "Bitte prüfe deine E-Mail-Adresse.",
        VERIFICATION_INVALID: "Dieser Bestätigungslink ist ungültig, abgelaufen oder wurde bereits verwendet. Melde dich an, wenn du deine E-Mail schon bestätigt hast; sonst frage deine Lehrperson.",
        ALREADY_SIGNED_IN: "Du bist bereits angemeldet. Melde dich zuerst ab, um ein anderes Konto zu bestätigen oder anzulegen.",
        SESSION_CLOSED: "Diese Lernsitzung ist beendet.",
        INVALID_RESPONSE: "Der Serverstand konnte nicht sicher gelesen werden. Bitte nicht weiterarbeiten.",
        WRITE_BLOCKED: "Eine vorherige Speicherung ist ungeklärt. Bitte zuerst erneut versuchen oder den Konflikt klären."
    };
    function error(code, status = 0) {
        return Object.assign(new Error(messages[code] || "Die Änderung wurde nicht bestätigt. Bitte sichere deinen Code und versuche es später erneut."), { code, status });
    }
    function validateState(state) {
        if (!object(state) || !Number.isSafeInteger(state.revision) || state.revision < 0 || !object(state.data)) throw error("INVALID_RESPONSE");
        const data = state.data;
        for (const key of ["attemptedCodes", "completedCodes"]) {
            if (!object(data[key]) || Object.values(data[key]).some(code => typeof code !== "string")) throw error("INVALID_RESPONSE");
        }
        if (!object(data.featureProgress) || !Array.isArray(data.unlockedIds) || data.unlockedIds.some(id => typeof id !== "string")) throw error("INVALID_RESPONSE");
        return copy(state);
    }
    function createClient({ endpoint = "api/index.php", fetch: fetcher = window.fetch.bind(window), baseURL = window.location.href, timeoutMs = 12000 } = {}) {
        const url = new URL(endpoint, baseURL);
        if (url.origin !== new URL(baseURL).origin || !/^https?:$/.test(url.protocol) || url.username || url.password) throw error("INVALID_ENDPOINT");
        async function request(action, { body, csrfToken, profileId } = {}) {
            const target = new URL(url);
            target.search = new URLSearchParams({ action }).toString();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const headers = { Accept: "application/json" };
                if (profileId) headers["X-Agentpy-Profile"] = profileId;
                if (body !== undefined) Object.assign(headers, { "Content-Type": "application/json", "X-CSRF-Token": csrfToken });
                const response = await fetcher(target.href, {
                    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
                    redirect: "error", headers, signal: controller.signal,
                    ...(body === undefined ? {} : { body: JSON.stringify(body) })
                });
                let data;
                try { data = await response.json(); } catch (_) { throw error("INVALID_RESPONSE", response.status); }
                if (!response.ok) {
                    const failure = error(data?.error?.code || "SERVER_UNAVAILABLE", response.status);
                    for (const key of ["retryAfter", "attemptsLeft"]) if (Number.isSafeInteger(data?.error?.[key])) failure[key] = data.error[key];
                    throw failure;
                }
                return data;
            } catch (failure) {
                if (failure.code && failure instanceof Error) throw failure;
                throw error("NETWORK_ERROR");
            } finally { clearTimeout(timeout); }
        }
        return Object.freeze({ request });
    }
    function createRemoteLearningStores({ client, profile, csrfToken, initialState, saveMode = "attempts", operationId = () => window.crypto.randomUUID() }) {
        if (!profile?.id || !csrfToken || !["attempts", "completion-only"].includes(saveMode)) throw error("INVALID_CONTEXT");
        const profileId = profile.id; // Never follow a mutable current-profile variable.
        let state = validateState(initialState);
        let disposed = false;
        let pending = null;
        let blocked = null;
        let tail = Promise.resolve();
        let queued = 0;
        let volatileAttempts = {};
        let status = Object.freeze({ type: "saved", message: "Serverstand geladen." });
        const listeners = new Set();
        function notify(type, message, failure = null) {
            status = Object.freeze({ type, message, error: failure });
            for (const listener of listeners) { try { listener(status); } catch (_) { /* UI isolation */ } }
        }
        function assertOpen() { if (disposed) throw error("SESSION_CLOSED"); }
        function value(read) { assertOpen(); return { ok: true, value: copy(read()) }; }
        async function transmit() {
            assertOpen();
            notify("saving", "Wird zentral gespeichert …");
            try {
                const response = await client.request("write", { body: pending, csrfToken, profileId });
                assertOpen();
                if (response.profile?.id !== profileId) throw error("PROFILE_CHANGED");
                const next = validateState(response.state);
                if (next.revision < state.revision) throw error("INVALID_RESPONSE");
                state = next;
                if (pending.command.type === "reset") volatileAttempts = {};
                if (pending.command.type === "complete") delete volatileAttempts[pending.command.levelId];
                if (pending.command.type === "attempt") delete volatileAttempts[pending.command.levelId];
                pending = null;
                blocked = null;
                notify("saved", "Zentral gespeichert.");
                return { ok: true };
            } catch (failure) {
                if (disposed) return { ok: false, error: error("SESSION_CLOSED") };
                blocked = failure;
                notify(failure.code === "REVISION_CONFLICT" ? "conflict" : "error", failure.message, failure);
                return { ok: false, error: failure };
            }
        }
        function enqueue(action) {
            queued++;
            const run = tail.then(() => { assertOpen(); return action(); }).catch(failure => ({ ok: false, error: failure }));
            tail = run.then(() => { queued--; });
            return run;
        }
        function write(command) {
            const frozenCommand = copy(command);
            return enqueue(() => {
                if (blocked) return { ok: false, error: blocked };
                pending = { command: frozenCommand, expectedRevision: state.revision, operationId: operationId() };
                return transmit();
            });
        }
        const controls = Object.freeze({
            // Explicit save is intentional even in completion-only mode; never executes code.
            saveDraft: (levelId, code) => write({ type: "attempt", levelId, code }),
            subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
            getStatus: () => status,
            hasUnconfirmed: () => queued > 0 || pending !== null || Object.keys(volatileAttempts).length > 0,
            retry() {
                return enqueue(() => {
                    if (!pending) return { ok: true };
                    // Conflict/auth errors require an explicit reload, never automatic overwriting.
                    if (blocked && (blocked.status === 409 || blocked.status === 401 || blocked.status === 403)) return { ok: false, error: blocked };
                    return transmit();
                });
            },
            dispose() { disposed = true; state = null; volatileAttempts = {}; pending = null; listeners.clear(); }
        });
        return Object.freeze({
            controls,
            codeStore: Object.freeze({
                getAttemptedCode: id => value(() => own(volatileAttempts, id) ?? own(state.data.attemptedCodes, id)),
                getCompletedCode: id => value(() => own(state.data.completedCodes, id)),
                getCompletedCodes: () => value(() => state.data.completedCodes),
                recordAttempt(levelId, code) {
                    if (saveMode !== "completion-only") return write({ type: "attempt", levelId, code });
                    assertOpen();
                    volatileAttempts[levelId] = code;
                    notify("local-only", "Nur in diesem Tab: Unfertiger Code wird im Abschlussmodus nicht zentral gespeichert.");
                    return { ok: true };
                }
            }),
            progressStore: Object.freeze({
                getUnlockedLevelIds: () => value(() => state.data.unlockedIds),
                getFeatureProgress: id => value(() => own(state.data.featureProgress, id)),
                setFeatureProgress: (featureId, featureValue) => write({ type: "feature", featureId, value: featureValue }),
                grantUnlocks: unlockIds => write({ type: "unlocks", unlockIds: Array.isArray(unlockIds) ? unlockIds : [unlockIds] })
            }),
            coordinator: Object.freeze({
                completeLevel: ({ levelId, code }) => write({ type: "complete", levelId, code }),
                resetLearningData: () => write({ type: "reset" }),
                dispose: controls.dispose
            })
        });
    }
    window.AgentPyRemoteLearningData = Object.freeze({ createClient, createRemoteLearningStores, validateState, error });
})();
