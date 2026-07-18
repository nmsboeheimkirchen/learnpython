(() => {
    "use strict";

    const config = window.FINALE_CONFIG;
    if (!config) {
        throw new Error("FINALE_CONFIG fehlt.");
    }

    const textarea = document.getElementById("python-editor");
    const runButton = document.getElementById("run-btn");
    const resetButton = document.getElementById("reset-btn");
    const presentationButton = document.getElementById("presentation-btn");
    const exitPresentationButton = document.getElementById("exit-presentation-btn");
    const consoleOutput = document.getElementById("console-output");
    const runStatus = document.getElementById("run-status");
    const validationTitle = document.getElementById("validation-title");
    const validationMessage = document.getElementById("validation-message");
    const checksList = document.getElementById("checks-list");
    const turtleTarget = document.getElementById(config.targetId);

    if (
        !textarea || !runButton || !resetButton || !presentationButton ||
        !exitPresentationButton || !consoleOutput || !runStatus ||
        !validationTitle || !validationMessage || !checksList || !turtleTarget
    ) {
        throw new Error("Der Finale-Prototyp ist unvollständig aufgebaut.");
    }

    if (!window.CodeMirror || !window.Sk) {
        throw new Error("CodeMirror oder Skulpt konnte nicht geladen werden.");
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

    const testMode = new URLSearchParams(window.location.search).has("test");
    let outputText = "";
    let runGeneration = 0;
    let running = false;

    function builtinRead(path) {
        if (!Sk.builtinFiles || !Sk.builtinFiles.files || !Sk.builtinFiles.files[path]) {
            throw new Error("Python-Modul nicht gefunden: " + path);
        }
        return Sk.builtinFiles.files[path];
    }

    function setStatus(text, state) {
        runStatus.textContent = text;
        runStatus.className = "run-status is-" + state;
    }

    function setRunning(nextRunning) {
        running = nextRunning;
        document.body.classList.toggle("program-running", nextRunning);
        runButton.disabled = nextRunning;
        resetButton.disabled = nextRunning;
        runButton.setAttribute("aria-busy", String(nextRunning));
        runButton.innerHTML = nextRunning
            ? '<span class="button-spinner" aria-hidden="true"></span> ' + (config.runningLabel || "Programm läuft")
            : '<span aria-hidden="true">▶</span> ' + (document.body.classList.contains("museum-theme") ? "Flucht starten" : "Mission starten");
    }

    function appendOutput(text) {
        const chunk = String(text);
        outputText += chunk;
        consoleOutput.textContent = outputText;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        config.onOutput?.(chunk, outputText);
    }

    function clearTurtle() {
        try {
            if (turtleTarget.turtleInstance && typeof turtleTarget.turtleInstance.reset === "function") {
                turtleTarget.turtleInstance.reset();
            }
        } catch (_error) {
            // Ein alter Animationszustand darf den nächsten Lauf nicht blockieren.
        }

        try {
            delete turtleTarget.turtleInstance;
        } catch (_error) {
            turtleTarget.turtleInstance = undefined;
        }
        turtleTarget.replaceChildren();
    }

    function configureSkulpt() {
        clearTurtle();
        Sk.TurtleGraphics = Sk.TurtleGraphics || {};
        Object.assign(Sk.TurtleGraphics, {
            target: config.targetId,
            width: 960,
            height: 540,
            worldWidth: 960,
            worldHeight: 540,
            animate: !testMode,
            bufferSize: testMode ? 1000 : 0
        });

        Sk.pre = "console-output";
        Sk.configure({
            output: appendOutput,
            read: builtinRead,
            execLimit: 8000,
            yieldLimit: 100,
            killableWhile: true,
            killableFor: true,
            __future__: Sk.python3
        });
    }

    function renderChecks(result) {
        checksList.textContent = "";
        result.checks.forEach(check => {
            const item = document.createElement("li");
            item.className = "check-item " + (check.passed ? "is-passed" : "is-missing");
            if (check.optional) item.classList.add("is-optional");

            const label = document.createElement("span");
            label.textContent = check.label;
            item.appendChild(label);

            if (check.optional) {
                const badge = document.createElement("small");
                badge.textContent = check.passed ? "Bonus geschafft" : "freiwillig";
                item.appendChild(badge);
            }
            checksList.appendChild(item);
        });

        validationTitle.textContent = result.passed ? "Bereit zur Präsentation" : "Noch nicht ganz bereit";
        validationMessage.textContent = result.message;
        document.body.classList.toggle("validation-passed", result.passed);
    }

    function friendlyError(error) {
        const raw = String(error);
        if (/TimeLimit|timed out|Execution exceeded/i.test(raw)) {
            return "Dein Programm läuft zu lange. Prüfe besonders deine Schleifen.";
        }
        return raw.replace(/^Error:\s*/, "");
    }

    async function runProgram() {
        if (running) return;

        const generation = ++runGeneration;
        const code = editor.getValue();
        outputText = "";
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove("validation-passed", "mission-complete");
        config.resetHud?.();
        setRunning(true);
        setStatus(config.runningLabel || "Programm läuft", "running");

        try {
            configureSkulpt();
            await Sk.misceval.asyncToPromise(() => (
                Sk.importMainWithBody("<stdin>", false, code, true)
            ));

            if (generation !== runGeneration) return;

            const hudData = config.parseOutput?.(outputText);
            if (hudData) config.applyHud?.(hudData);

            const result = config.validate(code, outputText);
            renderChecks(result);
            setStatus(result.passed ? "Technisch bereit" : "Code prüfen", result.passed ? "success" : "warning");

            if (!outputText.trim()) {
                consoleOutput.textContent = "Programm beendet – noch ohne Textausgabe.";
            }
        } catch (error) {
            if (generation !== runGeneration) return;
            const message = friendlyError(error);
            consoleOutput.textContent = "FEHLER: " + message;
            consoleOutput.classList.add("is-error");
            validationTitle.textContent = "Programm gestoppt";
            validationMessage.textContent = "Verbessere den markierten Code und starte erneut.";
            setStatus("Fehler gefunden", "error");
        } finally {
            if (generation === runGeneration) setRunning(false);
        }
    }

    function resetPrototype() {
        if (running) return;
        runGeneration += 1;
        editor.setValue(config.defaultCode);
        editor.clearHistory();
        outputText = "";
        consoleOutput.textContent = document.body.classList.contains("museum-theme")
            ? "Das Museum wartet auf deinen Fluchtplan."
            : "Bereit für PICOs Rettungsmission.";
        consoleOutput.classList.remove("is-error");
        checksList.innerHTML = "<li class=\"check-item\">Noch keine Prüfung</li>";
        validationTitle.textContent = "Beispiel wiederhergestellt";
        validationMessage.textContent = "Du kannst den Code direkt starten oder kreativ verändern.";
        config.resetHud?.();
        clearTurtle();
        setStatus("Bereit", "ready");
        editor.focus();
    }

    function setPresentationMode(enabled) {
        document.body.classList.toggle("presentation-mode", enabled);
        presentationButton.setAttribute("aria-pressed", String(enabled));
        presentationButton.textContent = enabled ? "Editor anzeigen" : "◫ Präsentieren";
        window.setTimeout(() => editor.refresh(), 0);
    }

    runButton.addEventListener("click", runProgram);
    resetButton.addEventListener("click", resetPrototype);
    presentationButton.addEventListener("click", () => {
        setPresentationMode(!document.body.classList.contains("presentation-mode"));
    });
    exitPresentationButton.addEventListener("click", () => setPresentationMode(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.body.classList.contains("presentation-mode")) {
            setPresentationMode(false);
        }
    });

    config.resetHud?.();
    setStatus("Bereit", "ready");
    window.finalePrototype = { editor, run: runProgram, reset: resetPrototype };

    if (testMode) {
        window.setTimeout(runProgram, 60);
    }
})();
