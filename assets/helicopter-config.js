(() => {
    "use strict";

    const core = window.HelicopterConfigCore;
    if (!core || !window.CodeMirror) {
        throw new Error("Die Konfigurationsmission ist nicht vollständig geladen.");
    }

    const byId = id => document.getElementById(id);
    const textarea = byId("json-editor");
    const consoleOutput = byId("console-output");
    const resetButton = byId("reset-btn");
    const configHero = byId("config-hero");
    const configDisplay = byId("config-display");
    const configMessage = byId("config-message");
    const heliStatus = byId("heli-status");
    const cockpitStatus = byId("cockpit-status");
    const hangarStatus = byId("hangar-status");
    const runButtons = [...document.querySelectorAll("[data-config-run], #run-btn")];
    if (
        !textarea || !consoleOutput || !resetButton || !configHero || !configDisplay ||
        !configMessage || !heliStatus || !cockpitStatus || !hangarStatus || !runButtons.length
    ) {
        throw new Error("Die Oberfläche der Konfigurationsmission ist unvollständig.");
    }

    const editor = window.CodeMirror.fromTextArea(textarea, {
        mode: null,
        theme: "monokai",
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 2,
        tabSize: 2,
        extraKeys: {
            "Ctrl-Enter": () => applyConfig(),
            "Cmd-Enter": () => applyConfig()
        }
    });
    window.editor = editor;
    editor.getInputField?.().setAttribute("aria-label", "Inhalt der Datei heli_config.json");

    const defaultConfig = core.START_CONFIG_TEXT;
    const testMode = new URLSearchParams(window.location.search).has("e2e");
    const failureMessages = Object.freeze({
        [core.FAILURES.INVALID_JSON]: "JSON-FEHLER: Prüfe doppelte Anführungszeichen, Kommas und Klammern.",
        [core.FAILURES.STRUCTURE_CHANGED]: "KONFIGURATION ABGELEHNT: Gruppen und Feldnamen müssen unverändert bleiben.",
        [core.FAILURES.BOOLEAN_REQUIRED]: "KONFIGURATION ABGELEHNT: true und false sind Wahrheitswerte ohne Anführungszeichen.",
        [core.FAILURES.COCKPIT_CHANGED]: "KONFIGURATION ABGELEHNT: Hauptdisplay, Navigation und Rotor bleiben in diesem Auftrag unverändert.",
        [core.FAILURES.TARGETS_CLOSED]: "NOCH GESCHLOSSEN: Öffne den Helikopterzugang und das Hangartor.",
        [core.FAILURES.HELI_CLOSED]: "FAST GESCHAFFT: Der Helikopterzugang ist noch geschlossen.",
        [core.FAILURES.HANGAR_CLOSED]: "FAST GESCHAFFT: Das Hangartor ist noch geschlossen."
    });
    let lastResult = null;

    function setVisualState(state) {
        const granted = state === "granted";
        document.body.dataset.accessState = state;
        document.body.dataset.hangarState = granted ? "open" : "closed";
        configDisplay.className = "access-display is-" + state;
        configMessage.textContent = granted ? "ZUGANG & TOR OFFEN" : (state === "denied" ? "DATEI ABGELEHNT" : "ZUGANG & TOR GESPERRT");
        heliStatus.textContent = granted ? "Zugang offen" : "Zugang geschlossen";
        cockpitStatus.textContent = "Hauptdisplay online · Navigation offline · Rotor offline";
        hangarStatus.textContent = granted ? "Tor offen" : "Tor geschlossen";
    }

    function revealResult() {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        configHero.scrollIntoView?.({
            behavior: testMode || reducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest"
        });
    }

    async function applyConfig() {
        const source = editor.getValue();
        await window.saveAttemptedLevelCode?.("helikopter_flucht_level2", source);
        const validation = core.validate(source);
        lastResult = validation;

        if (validation.passed) {
            const saved = await window.completeLevelProgress?.("helikopter_flucht_level2", source, []);
            if (!saved) {
                consoleOutput.classList.add("is-error");
                consoleOutput.textContent = "NICHT GESPEICHERT: Prüfe den Browserspeicher und versuche es erneut.";
                setVisualState("denied");
                lastResult = { ...validation, persisted: false };
                return lastResult;
            }
            consoleOutput.classList.remove("is-error");
            consoleOutput.textContent = "KONFIGURATION ÜBERNOMMEN · HELIKOPTERZUGANG OFFEN · HANGARTOR OFFEN\n" +
                "Hauptdisplay online · Navigation offline · Rotor offline";
            setVisualState("granted");
            revealResult();
        } else {
            consoleOutput.classList.add("is-error");
            consoleOutput.textContent = failureMessages[validation.failure] || "KONFIGURATION ABGELEHNT.";
            setVisualState("denied");
        }
        return validation;
    }

    async function resetMission() {
        editor.setValue(defaultConfig);
        editor.clearHistory?.();
        await window.saveAttemptedLevelCode?.("helikopter_flucht_level2", defaultConfig);
        consoleOutput.textContent = "Datei geladen. Helikopterzugang und Hangartor sind noch geschlossen.";
        consoleOutput.classList.remove("is-error");
        lastResult = null;
        setVisualState("locked");
        editor.focus();
    }

    runButtons.forEach(button => button.addEventListener("click", applyConfig));
    resetButton.addEventListener("click", resetMission);

    editor.setValue(defaultConfig);
    setVisualState("locked");
    const attemptedRestored = window.restoreAttemptedLevelCode?.("helikopter_flucht_level2");
    const completedRestored = !attemptedRestored && window.restoreCompletedLevelCode?.("helikopter_flucht_level2");
    if ((attemptedRestored || completedRestored) && core.validate(editor.getValue()).passed) {
        consoleOutput.textContent = "Gespeicherte Konfiguration geladen. Helikopterzugang und Hangartor sind offen.";
        setVisualState("granted");
    }

    window.HelicopterConfigRuntime = Object.freeze({
        editor,
        getResult: () => lastResult,
        getState: () => Object.freeze({
            accessState: document.body.dataset.accessState,
            hangarState: document.body.dataset.hangarState
        }),
        reset: resetMission,
        run: applyConfig
    });
})();
