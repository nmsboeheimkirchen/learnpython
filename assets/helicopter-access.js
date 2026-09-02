(() => {
    "use strict";

    const core = window.HelicopterAccessCore;
    if (!core || !window.Sk || !window.CodeMirror) {
        throw new Error("Die Bordcomputer-Mission ist nicht vollständig geladen.");
    }

    const byId = id => document.getElementById(id);
    const textarea = byId("python-editor");
    const consoleOutput = byId("console-output");
    const resetButton = byId("reset-btn");
    const accessHero = byId("access-hero");
    const accessDisplay = byId("access-display");
    const accessMessage = byId("access-message");
    const runButtons = [...document.querySelectorAll("[data-helicopter-run], #run-btn")];
    if (!textarea || !consoleOutput || !resetButton || !accessHero || !accessDisplay || !accessMessage || !runButtons.length) {
        throw new Error("Die Oberfläche der Bordcomputer-Mission ist unvollständig.");
    }

    const editor = window.CodeMirror.fromTextArea(textarea, {
        mode: "python",
        theme: "monokai",
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        tabSize: 4,
        extraKeys: {
            "Ctrl-Enter": () => runProgram(),
            "Cmd-Enter": () => runProgram()
        }
    });
    window.editor = editor;
    editor.getInputField?.().setAttribute("aria-label", "Python-Code zum Entsperren des Bordcomputers");

    const defaultCode = textarea.value;
    const testMode = new URLSearchParams(window.location.search).has("e2e");
    const missionPassword = core.createRandomPassword();
    const MODULE_PATH = "src/lib/bordcomputer.js";
    const MODULE_SOURCE = `
var $builtinmodule = function () {
    var module = {};
    module.receive = new Sk.builtin.func(function () {
        return window.__HELICOPTER_ACCESS_BRIDGE__.receive();
    });
    module.pruefe = new Sk.builtin.func(function (candidate) {
        if (!Sk.builtin.checkString(candidate)) {
            throw new Sk.builtin.TypeError("pruefe() erwartet Text als Passwort");
        }
        return window.__HELICOPTER_ACCESS_BRIDGE__.check(candidate)
            ? Sk.builtin.bool.true$
            : Sk.builtin.bool.false$;
    });
    return module;
};`;

    let state = core.createState(missionPassword);
    let outputText = "";
    let running = false;
    let cancelRequested = false;
    let runGeneration = 0;
    let lastResult = null;

    function appendOutput(text) {
        const value = String(text);
        outputText += value;
        consoleOutput.textContent += value;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function builtinRead(path) {
        if (path === MODULE_PATH) return MODULE_SOURCE;
        const file = Sk.builtinFiles?.files?.[path];
        if (file === undefined) throw new Error("Python-Modul nicht gefunden: " + path);
        return file;
    }

    function createBridge() {
        return Object.freeze({
            receive() {
                const signal = state.receive();
                appendOutput("SIGNAL EMPFANGEN: " + signal + "\n");
                return new Sk.builtin.str(signal);
            },
            check(candidate) {
                const accepted = state.check(Sk.ffi.remapToJs(candidate));
                appendOutput("BORDCOMPUTER: " + (accepted ? "ACCESS GRANTED!" : "ACCESS DENIED!") + "\n");
                return accepted;
            }
        });
    }

    function setAccessState(accessState, message) {
        document.body.dataset.accessState = accessState;
        accessDisplay.className = "access-display is-" + accessState;
        accessMessage.textContent = message;
    }

    function setRunning(nextRunning) {
        running = nextRunning;
        document.body.classList.toggle("program-running", nextRunning);
        runButtons.forEach(button => {
            button.disabled = nextRunning;
            button.setAttribute("aria-busy", String(nextRunning));
            button.innerHTML = nextRunning
                ? '<span class="helicopter-spinner" aria-hidden="true"></span> Signal wird geprüft'
                : '<span aria-hidden="true">▶</span> Bordcomputer starten';
        });
        resetButton.textContent = nextRunning ? "■ Programm stoppen" : "↺ Startcode laden";
    }

    function resetRunState() {
        state = core.createState(missionPassword);
        window.__HELICOPTER_ACCESS_BRIDGE__ = createBridge();
    }

    function deniedHint(snapshot) {
        if (snapshot.receiveCount < 1) return "HINWEIS: Empfange das Signal zuerst mit bordcomputer.receive().";
        if (snapshot.checkCount < 1) return "HINWEIS: Übergib dein Ergebnis an bordcomputer.pruefe(passwort).";
        return "HINWEIS: Prüfe, ob du wirklich alle Störzeichen aus dem empfangenen Signal entfernt hast.";
    }

    function revealResult() {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        accessHero.scrollIntoView?.({
            behavior: testMode || reducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest"
        });
    }

    function finishRun(code) {
        const snapshot = state.snapshot();
        const passed = snapshot.accessGranted;
        if (passed) {
            setAccessState("granted", "ACCESS GRANTED!");
            window.saveCompletedLevelCode?.("helikopter_flucht_level1", code);
            revealResult();
        } else {
            setAccessState("denied", "ACCESS DENIED!");
            const hint = deniedHint(snapshot);
            if (hint) appendOutput((outputText.endsWith("\n") ? "" : "\n") + hint + "\n");
        }
        lastResult = Object.freeze({ passed, snapshot });
        return lastResult;
    }

    function configureSkulpt() {
        Sk.pre = "console-output";
        Sk.configure({
            output: appendOutput,
            read: builtinRead,
            execLimit: 4000,
            yieldLimit: 100,
            killableWhile: true,
            killableFor: true,
            __future__: Sk.python3
        });
    }

    async function runProgram() {
        if (running) return null;
        const generation = ++runGeneration;
        const code = editor.getValue();
        cancelRequested = false;
        lastResult = null;
        outputText = "";
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        setAccessState("locked", "CHECKING SIGNAL …");
        setRunning(true);
        resetRunState();
        window.saveAttemptedLevelCode?.("helikopter_flucht_level1", code);

        try {
            configureSkulpt();
            await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true));
            if (generation !== runGeneration) return null;
            if (!outputText.trim()) appendOutput("Programm beendet – kein Signal geprüft.\n");
            return finishRun(code);
        } catch (error) {
            if (generation !== runGeneration || cancelRequested) return null;
            outputText = "PYTHON-FEHLER: " + String(error).replace(/^Error:\s*/, "");
            consoleOutput.textContent = outputText;
            consoleOutput.classList.add("is-error");
            setAccessState("denied", "ACCESS DENIED!");
            lastResult = Object.freeze({ passed: false, error: String(error), snapshot: state.snapshot() });
            return lastResult;
        } finally {
            if (generation === runGeneration) setRunning(false);
        }
    }

    function resetMission() {
        if (running) {
            cancelRequested = true;
            runGeneration += 1;
            Sk.execStart = new Date(0);
            setRunning(false);
        }
        editor.setValue(defaultCode);
        editor.clearHistory?.();
        outputText = "";
        consoleOutput.textContent = "Der Bordcomputer wartet auf dein Programm.";
        consoleOutput.classList.remove("is-error");
        lastResult = null;
        resetRunState();
        setAccessState("locked", "ACCESS LOCKED");
        editor.focus();
    }

    runButtons.forEach(button => button.addEventListener("click", runProgram));
    resetButton.addEventListener("click", resetMission);

    resetRunState();
    setAccessState("locked", "ACCESS LOCKED");
    const attemptedRestored = window.restoreAttemptedLevelCode?.("helikopter_flucht_level1");
    const completedRestored = !attemptedRestored && window.restoreCompletedLevelCode?.("helikopter_flucht_level1");
    if (completedRestored) setAccessState("granted", "ACCESS GRANTED!");

    window.HelicopterAccessRuntime = Object.freeze({
        editor,
        getOutput: () => outputText,
        getResult: () => lastResult,
        getState: () => state.snapshot(),
        isRunning: () => running,
        reset: resetMission,
        run: runProgram
    });
})();
