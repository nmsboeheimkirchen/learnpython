(() => {
    "use strict";

    const MAX_HELP_LEVEL = 3;
    const PROGRESS_VERSION = 1;

    function issue(id, title, levels, options = {}) {
        if (!Array.isArray(levels) || levels.length !== MAX_HELP_LEVEL) {
            throw new Error(`Hilfethema ${id} braucht genau ${MAX_HELP_LEVEL} Stufen.`);
        }
        return Object.freeze({
            id,
            title,
            countable: options.countable !== false,
            levels: Object.freeze(levels.map(text => String(text)))
        });
    }

    const ISSUES = Object.freeze({
        WAIT_FOR_RUN: issue(
            "WAIT_FOR_RUN",
            "Der Programmlauf ist noch nicht fertig",
            [
                "Warte, bis die Drohne ihren aktuellen Flug beendet hat.",
                "Die Zentrale wertet nur einen vollständig abgeschlossenen Programmlauf aus.",
                "Sobald der Lauf beendet ist, kannst du erneut Hilfe anfordern und erhältst einen Hinweis zum dann beobachteten Zustand."
            ],
            { countable: false }
        ),
        RUN_FIRST: issue(
            "RUN_FIRST",
            "Die Zentrale braucht einen Programmlauf",
            [
                "Starte zuerst deinen Code. Danach kann die Zentrale sehen, an welcher Stelle deine Mission stockt.",
                "Ohne Laufzeitdaten kennt die Zentrale weder den Standort der Drohne noch den Inhalt deines Inventars.",
                "Starte dein Programm und fordere nach dem beendeten Lauf erneut Hilfe an."
            ],
            { countable: false }
        ),
        RUN_AGAIN: issue(
            "RUN_AGAIN",
            "Der Code wurde seit dem letzten Lauf verändert",
            [
                "Starte den geänderten Code, damit die Zentrale nicht mit veralteten Beobachtungen hilft.",
                "Der letzte Missionszustand gehört noch zur vorherigen Codefassung.",
                "Starte dein Programm erneut. Erst der neue Lauf zeigt, welches Problem noch besteht."
            ],
            { countable: false }
        ),
        SEARCH_NEEDS_DRONE: issue(
            "SEARCH_NEEDS_DRONE",
            "suche_hier() gehört zur Drohne",
            [
                "suche_hier() ist ein Befehl der Drohne. Schreibe deshalb den Namen der Drohne davor.",
                "Rufe die Suche am Fundort mit drohne.suche_hier() auf.",
                "Ersetze suche_hier() durch fund = drohne.suche_hier(). So speicherst du zugleich den Rückgabewert."
            ]
        ),
        FUND_NOT_STORED: issue(
            "FUND_NOT_STORED",
            "Speichere den gefundenen Gegenstand",
            [
                "drohne.suche_hier() liefert den gefundenen Gegenstand zurück. Speichere dieses Ergebnis in der Variablen fund.",
                "Schreibe am Fundort: fund = drohne.suche_hier()",
                "Hänge den gespeicherten Fund danach mit inventar.append(fund) an dein Inventar."
            ]
        ),
        INVENTORY_PARAMETER: issue(
            "INVENTORY_PARAMETER",
            "liste ist nur der Funktionsparameter",
            [
                "liste ist nur der Parametername innerhalb von melde_inventar(). Außerhalb der Funktion gibt es diese Variable nicht.",
                "Beim Aufruf musst du die Liste übergeben, die du wirklich angelegt und gefüllt hast: inventar.",
                "Rufe melde_inventar(inventar) auf. Dann erhält der Parameter liste innerhalb der Funktion dein inventar."
            ]
        ),
        PYTHON_ERROR: issue(
            "PYTHON_ERROR",
            "Der Python-Code wurde gestoppt",
            [
                "Lies zuerst die Fehlermeldung im Missionsbericht. Sie nennt die Stelle, an der Python nicht weiterarbeiten konnte.",
                "Prüfe in der genannten Zeile besonders Schreibweise, Klammern, Anführungszeichen und Einrückung.",
                "Behebe genau diesen Python-Fehler und starte erneut. Erst danach kann die Zentrale Route und Inventar beurteilen."
            ]
        ),
        KEYCARD_ORDER: issue(
            "KEYCARD_ORDER",
            "Die Reihenfolge blockiert das Sternenfragment",
            [
                "Die Drohne hat das Sternenfragment gesucht, bevor eine mit suche_hier() gefundene Schlüsselkarte im Inventar lag.",
                "Suche zuerst bei der Schlüsselkarte und speichere genau den Rückgabewert von drohne.suche_hier().",
                "Baue zuerst fund = drohne.suche_hier() und inventar.append(fund) an der Schlüsselkarte ein. Fliege erst danach zum Sternenfragment."
            ]
        ),
        KEYCARD_MISSING: issue(
            "KEYCARD_MISSING",
            "Die Schlüsselkarte fehlt",
            [
                "Im beobachteten Lauf ist noch keine mit suche_hier() gefundene Schlüsselkarte im Inventar angekommen.",
                "Fliege zum Ort der Schlüsselkarte, rufe dort drohne.suche_hier() auf und bewahre den Fund in einer Variablen auf.",
                "Ergänze nach der Suche inventar.append(fund). Ein selbst geschriebener Text wie \"Schlüsselkarte\" zählt nicht als Fund aus suche_hier()."
            ]
        ),
        ARTIFACT_MISSING: issue(
            "ARTIFACT_MISSING",
            "Das Sternenfragment fehlt",
            [
                "Die Schlüsselkarte ist gesichert, aber das Sternenfragment wurde noch nicht mit suche_hier() gefunden und aufgenommen.",
                "Fliege nach der Schlüsselkarte zum Sternenfragment und rufe auch dort drohne.suche_hier() auf.",
                "Speichere den neuen Rückgabewert wieder in fund und hänge genau fund mit inventar.append(fund) an."
            ]
        ),
        HACK_TOO_EARLY: issue(
            "HACK_TOO_EARLY",
            "Der Hack kam zu früh",
            [
                "Die Drohne hat den Hack versucht, bevor die Aufnahme des Sternenfragments den Alarm ausgelöst hatte.",
                "Ordne den Hackaufruf hinter der erfolgreichen Suche nach dem Sternenfragment ein.",
                "Sichere zuerst das Sternenfragment, fliege danach zur Alarmkonsole und rufe erst dort alarm_hacken(...) auf."
            ]
        ),
        HACK_WRONG_PLACE: issue(
            "HACK_WRONG_PLACE",
            "Der Hack wurde am falschen Ort versucht",
            [
                "Der Hackaufruf wurde beobachtet, die Drohne stand dabei aber nicht an der Alarmkonsole.",
                "Prüfe, ob der Flug zur Alarmkonsole wirklich vor alarm_hacken(...) beendet wird.",
                "Steuere zuerst die Koordinaten der Alarmkonsole an und rufe unmittelbar danach alarm_hacken(...) mit deinem Passwort auf."
            ]
        ),
        HACK_WRONG_CODE: issue(
            "HACK_WRONG_CODE",
            "Der Hackcode ist falsch",
            [
                "Ort und Zeitpunkt können stimmen, aber die Alarmkonsole hat den gesendeten Code abgelehnt.",
                "Öffne unter dem Editor den Museum-Quelltext. Das funktioniert auch auf einem Tablet.",
                "Suche dort nach data-alarm-code und übergib genau dessen Wert an alarm_hacken(...)."
            ]
        ),
        HACK_TOO_LATE: issue(
            "HACK_TOO_LATE",
            "Der Hack kam zu spät",
            [
                "Der Alarm hatte seine letzte Stufe erreicht, bevor der Hack abgeschlossen war.",
                "Prüfe, ob zwischen Sternenfragment und Alarmkonsole unnötige Flugwege liegen.",
                "Fliege nach der Aufnahme direkt zur Konsole und starte dort sofort alarm_hacken(...). Der Hack braucht eine Sekunde."
            ]
        ),
        PORTAL_LOCKED: issue(
            "PORTAL_LOCKED",
            "Das Portal war bereits verriegelt",
            [
                "Mit der Aufnahme des Sternenfragments startet der Alarm. Ab Alarmstufe 2 ist das Portal verriegelt.",
                "Bevor du zum Portal fliegst, musst du den Alarm an der Konsole ausschalten.",
                "Fliege nach der Aufnahme zu (250, -60), rufe dort alarm_hacken(...) mit deinem Passwort auf und steuere erst danach das Portal an."
            ]
        ),
        ALARM_TOO_SLOW: issue(
            "ALARM_TOO_SLOW",
            "Die Alarmzeit ist abgelaufen",
            [
                "Der Alarm erreichte die letzte Stufe, ohne dass eine gültige Fluchtstrategie abgeschlossen war.",
                "Nach dem Sternenfragment zählt die Zeit sichtbar hoch. Vermeide unnötige Wege.",
                "Fliege direkt zur Alarmkonsole, starte dort den gültigen Hack und warte auf die Freigabe des Portals."
            ]
        ),
        ALARM_STRATEGY: issue(
            "ALARM_STRATEGY",
            "Eine Alarmstrategie fehlt noch",
            [
                "Das Sternenfragment ist gesichert. Jetzt muss die Drohne den Alarm an der Konsole hacken.",
                "Für den Hack brauchst du den richtigen Ort, den Code aus dem Quelltext und einen Aufruf nach Alarmbeginn.",
                "Programmiere: Alarmkonsole → alarm_hacken(...) mit deinem Passwort → Portal."
            ]
        ),
        PORTAL_NOT_REACHED: issue(
            "PORTAL_NOT_REACHED",
            "Der Ausgang wurde noch nicht erreicht",
            [
                "Der Alarm ist kein Hindernis mehr, aber die Drohne ist noch nicht durch das Portal entkommen.",
                "Ergänze den Flug vom letzten Missionspunkt zum Portal.",
                "Steuere nach deiner erfolgreichen Sicherheitsstrategie die Portal-Koordinaten an und beende dort die Route."
            ]
        ),
        INVENTORY_OUTPUT: issue(
            "INVENTORY_OUTPUT",
            "Die echte Inventarliste fehlt in der Ausgabe",
            [
                "Schau dir die vorbereitete Funktion melde_inventar(liste) an. Sie erzeugt die passende Ausgabe aus einer Liste.",
                "Schau dir die Funktion melde_inventar an und setze sie ein!",
                "Rufe am Ende melde_inventar(inventar) auf."
            ]
        ),
        COMPLETE: issue(
            "COMPLETE",
            "Die Mission ist vollständig",
            [
                "Alle beobachteten Missionsziele sind erfüllt. Du brauchst für diesen Lauf keine weitere Hilfe.",
                "Schlüsselkarte, Sternenfragment, Fluchtstrategie und Inventarausgabe wurden bestätigt.",
                "Du kannst deinen erfolgreichen Fluchtplan jetzt abschließen und zur nächsten Mission weitergehen."
            ],
            { countable: false }
        )
    });

    function booleanFrom(context, names) {
        for (const name of names) {
            if (typeof context?.[name] === "boolean") return context[name];
        }
        return null;
    }

    function normalizedFailure(value) {
        return typeof value === "string"
            ? value.trim().toUpperCase().replace(/[\s-]+/g, "_")
            : "";
    }

    function resolveIssue(context = {}) {
        if (context?.running === true) return ISSUES.WAIT_FOR_RUN;

        const hasRun = booleanFrom(context, ["hasRun", "runCompleted"]);
        if (hasRun !== true) return ISSUES.RUN_FIRST;

        const revisionChanged = (
            context.editorRevision !== undefined &&
            context.runRevision !== undefined &&
            context.editorRevision !== context.runRevision
        );
        if (context.dirty === true || context.codeDirty === true || context.editorDirty === true || revisionChanged) {
            return ISSUES.RUN_AGAIN;
        }

        const pythonError = context.pythonError ?? context.runtimeError ?? context.lastError;
        if (pythonError) {
            const detail = String(pythonError?.message || pythonError);
            if (/\bname\s+['\"]suche_hier['\"]\s+is not defined\b/i.test(detail)) {
                return ISSUES.SEARCH_NEEDS_DRONE;
            }
            if (/\bname\s+['\"]fund['\"]\s+is not defined\b/i.test(detail)) {
                return ISSUES.FUND_NOT_STORED;
            }
            if (/\bname\s+['\"]liste['\"]\s+is not defined\b/i.test(detail)) {
                return ISSUES.INVENTORY_PARAMETER;
            }
            return Object.freeze({
                ...ISSUES.PYTHON_ERROR,
                detail
            });
        }

        if (context.pendingItem) return ISSUES.FUND_NOT_STORED;

        const inventory = Array.isArray(context.runtimeInventory)
            ? context.runtimeInventory
            : (Array.isArray(context.inventory) ? context.inventory : null);
        const hasKeycardFlag = booleanFrom(context, ["hasKeycard", "keycardCollected"]);
        const hasKeycard = hasKeycardFlag === null
            ? Boolean(inventory?.includes("Schlüsselkarte"))
            : hasKeycardFlag;
        const searchFailure = normalizedFailure(
            context.lastSearchFailure ?? context.lastFindFailure ?? context.orderFailure
        );
        const orderFailed = context.orderFailure === true || context.artifactBeforeKeycard === true || [
            "KEYCARD_REQUIRED",
            "MISSING_KEYCARD",
            "ARTIFACT_BEFORE_KEYCARD",
            "WRONG_ORDER"
        ].includes(searchFailure);
        if (orderFailed && !hasKeycard) return ISSUES.KEYCARD_ORDER;
        if (!hasKeycard) return ISSUES.KEYCARD_MISSING;

        const artifactFlag = booleanFrom(context, ["artifactSecured", "hasArtifact", "artifactCollected"]);
        const hasArtifact = artifactFlag === null
            ? Boolean(inventory?.includes("Sternenfragment"))
            : artifactFlag;
        if (!hasArtifact) return ISSUES.ARTIFACT_MISSING;

        if (context.stage === "briefing") {
            return context.inventoryOutputPassed === true ? ISSUES.COMPLETE : ISSUES.INVENTORY_OUTPUT;
        }

        const escaped = booleanFrom(context, ["escaped", "exitUnlocked"]) === true;
        const hackFailure = normalizedFailure(context.lastHackFailure);
        if (!escaped) {
            if (["TOO_EARLY", "HACK_TOO_EARLY"].includes(hackFailure)) return ISSUES.HACK_TOO_EARLY;
            if (["WRONG_PLACE", "HACK_WRONG_PLACE"].includes(hackFailure)) return ISSUES.HACK_WRONG_PLACE;
            if (["WRONG_CODE", "HACK_WRONG_CODE"].includes(hackFailure)) return ISSUES.HACK_WRONG_CODE;
            if (["TOO_LATE", "HACK_TOO_LATE"].includes(hackFailure)) return ISSUES.HACK_TOO_LATE;
        }
        const portalLocked = context.portalTrapped === true || (
            context.portalReached === true &&
            context.portalOpen === false &&
            !escaped
        );
        if (portalLocked) return ISSUES.PORTAL_LOCKED;

        if (context.alarmFailed === true) {
            return context.hackRequested === true ? ISSUES.HACK_TOO_LATE : ISSUES.ALARM_TOO_SLOW;
        }

        if (!escaped) {
            const alarmDisabled = booleanFrom(context, ["alarmDisabled", "hackCompleted"]) === true;
            return alarmDisabled ? ISSUES.PORTAL_NOT_REACHED : ISSUES.ALARM_STRATEGY;
        }

        if (context.inventoryOutputPassed !== true) return ISSUES.INVENTORY_OUTPUT;
        return ISSUES.COMPLETE;
    }

    function parseProgress(payload) {
        if (typeof payload !== "string") return payload;
        try {
            return JSON.parse(payload);
        } catch (_error) {
            return null;
        }
    }

    function normalizedLevel(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(MAX_HELP_LEVEL, Math.trunc(numeric)));
    }

    function normalizeProgress(payload) {
        const source = parseProgress(payload);
        const candidateLevels = source && typeof source === "object" && !Array.isArray(source)
            ? (source.levels ?? source.issues)
            : null;
        const levels = {};

        if (candidateLevels && typeof candidateLevels === "object" && !Array.isArray(candidateLevels)) {
            Object.entries(candidateLevels).forEach(([issueId, value]) => {
                const knownIssue = ISSUES[issueId];
                if (!knownIssue?.countable) return;
                const level = normalizedLevel(value);
                if (level > 0) levels[issueId] = level;
            });
        }

        return {
            version: PROGRESS_VERSION,
            count: Object.values(levels).reduce((sum, level) => sum + level, 0),
            levels
        };
    }

    function reveal(progress, issueId) {
        const normalized = normalizeProgress(progress);
        const selectedIssue = ISSUES[issueId];
        if (!selectedIssue) {
            return {
                progress: normalized,
                issue: null,
                level: 0,
                hint: "",
                counted: false
            };
        }

        if (!selectedIssue.countable) {
            return {
                progress: normalized,
                issue: selectedIssue,
                level: 1,
                hint: selectedIssue.levels[0],
                counted: false
            };
        }

        const currentLevel = normalized.levels[selectedIssue.id] || 0;
        const nextLevel = Math.min(MAX_HELP_LEVEL, currentLevel + 1);
        const counted = nextLevel > currentLevel;
        const levels = { ...normalized.levels, [selectedIssue.id]: nextLevel };
        const nextProgress = {
            version: PROGRESS_VERSION,
            count: normalized.count + (counted ? 1 : 0),
            levels
        };

        return {
            progress: nextProgress,
            issue: selectedIssue,
            level: nextLevel,
            hint: selectedIssue.levels[nextLevel - 1],
            counted
        };
    }

    window.PixelmuseumHelpCore = Object.freeze({
        MAX_HELP_LEVEL,
        normalizeProgress,
        resolveIssue,
        reveal
    });
})();
