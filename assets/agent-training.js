(() => {
    "use strict";

    const core = window.AgentTrainingCore;
    const editor = window.editor;
    const turtleTarget = document.getElementById("agent-training-turtle");
    const marksLayer = document.getElementById("training-marks-layer");
    const runButton = document.getElementById("run-btn");
    const resetButton = document.getElementById("reset-btn");
    const consoleOutput = document.getElementById("console-output");
    const runStatus = document.getElementById("run-status");
    const statusText = document.getElementById("status-text");
    const coordinateX = document.getElementById("coordinate-x");
    const coordinateY = document.getElementById("coordinate-y");
    const feedbackTitle = document.getElementById("training-feedback-title");
    const feedbackMessage = document.getElementById("training-feedback-message");
    const checksList = document.getElementById("training-checks");
    const stageMessage = document.getElementById("training-stage-message");

    if (
        !core || !editor || !window.Sk || !turtleTarget || !marksLayer || !runButton || !resetButton ||
        !consoleOutput || !runStatus || !statusText || !coordinateX || !coordinateY ||
        !feedbackTitle || !feedbackMessage || !checksList || !stageMessage
    ) {
        throw new Error("Das Agenten-Training ist unvollständig aufgebaut.");
    }

    const defaultCode = editor.getValue();
    const searchParams = new URLSearchParams(window.location.search);
    const fastMode = searchParams.has("e2e") || searchParams.has("test");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    let runState = core.createState();
    let outputText = "";
    let activeTurtle = null;
    let runGeneration = 0;
    let running = false;
    let cancelRequested = false;

    function builtinRead(path) {
        const file = Sk.builtinFiles?.files?.[path];
        if (file === undefined) throw new Error("Python-Modul nicht gefunden: " + path);
        return file;
    }

    function setStatus(text, state = "ready") {
        runStatus.textContent = text;
        runStatus.className = "training-run-status is-" + state;
    }

    function setTopStatus(text, state = "ready") {
        statusText.textContent = text;
        statusText.dataset.state = state;
    }

    function setRunning(nextRunning) {
        running = nextRunning;
        document.body.classList.toggle("training-running", nextRunning);
        runButton.disabled = nextRunning;
        runButton.setAttribute("aria-busy", String(nextRunning));
        runButton.innerHTML = nextRunning
            ? '<span class="training-spinner" aria-hidden="true"></span> Agent unterwegs'
            : '<span aria-hidden="true">▶</span> Training starten';
        resetButton.textContent = nextRunning
            ? (cancelRequested ? "Wird gestoppt …" : "■ Training stoppen")
            : "↺ Startcode laden";
    }

    function updateCoordinates(point = runState.current) {
        const x = Number(point?.x ?? 0);
        const y = Number(point?.y ?? 0);
        coordinateX.textContent = String(Math.round(x));
        coordinateY.textContent = String(Math.round(y));
    }

    function appendOutput(text) {
        if (cancelRequested) return;
        outputText += String(text);
        consoleOutput.textContent = outputText;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function clearTurtle() {
        try {
            turtleTarget.turtleInstance?.reset?.();
        } catch (_error) {
            // Ein alter Canvas-Zustand darf einen neuen Lauf nicht blockieren.
        }
        try {
            delete turtleTarget.turtleInstance;
        } catch (_error) {
            turtleTarget.turtleInstance = undefined;
        }
        activeTurtle = null;
        turtleTarget.replaceChildren();
        marksLayer.replaceChildren();
    }

    function safeMarkerColor(value) {
        const candidate = typeof value === "string" ? value.trim() : "";
        if (!candidate || /url\s*\(/i.test(candidate)) return "#7df2a9";
        return window.CSS?.supports?.("color", candidate) ? candidate : "#7df2a9";
    }

    function renderLiveMark(point, requestedSize, requestedColor) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const rawSize = Number(requestedSize);
        const diameter = Number.isFinite(rawSize)
            ? Math.min(40, Math.max(8, Math.abs(rawSize)))
            : 18;
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        marker.classList.add("training-live-dot");
        marker.setAttribute("cx", String(400 + x));
        marker.setAttribute("cy", String(225 - y));
        marker.setAttribute("r", String(diameter / 2));
        marker.setAttribute("fill", safeMarkerColor(requestedColor));
        marker.dataset.x = String(Math.round(x * 100) / 100);
        marker.dataset.y = String(Math.round(y * 100) / 100);
        marker.dataset.size = String(diameter);
        marksLayer.appendChild(marker);
    }

    function recordRawPosition(raw) {
        const state = raw?.getState?.();
        if (!state) return;
        core.recordPosition(runState, { x: state.x, y: state.y });
        updateCoordinates(runState.current);
        document.body.classList.toggle("training-target-visited", runState.visitedTarget);
    }

    function installTurtleObserver() {
        const Turtle = turtleTarget.turtleInstance?.Turtle || Sk.TurtleGraphics?.raw?.Turtle;
        const prototype = Turtle?.prototype;
        if (!prototype || prototype.__agentTrainingObserverInstalled) return;

        const originalAddUpdate = prototype.addUpdate;
        const originalDot = prototype.$dot;
        if (typeof originalAddUpdate !== "function" || typeof originalDot !== "function") return;

        Object.defineProperty(prototype, "__agentTrainingObserverInstalled", {
            value: true,
            configurable: false
        });

        prototype.$dot = function (...args) {
            activeTurtle = this;
            const state = this.getState?.();
            const point = state ? { x: state.x, y: state.y } : null;
            const update = originalDot.apply(this, args);
            if (state) {
                core.recordMark(runState, point);
                renderLiveMark(point, args[0], args[1]);
                document.body.classList.toggle("training-target-marked", runState.markedAtTarget);
            }
            return update;
        };

        prototype.addUpdate = function (...args) {
            if (cancelRequested) return Promise.reject(new Error("AGENT_TRAINING_CANCELLED"));
            activeTurtle = this;
            const update = originalAddUpdate.apply(this, args);
            const notify = value => {
                if (cancelRequested) throw new Error("AGENT_TRAINING_CANCELLED");
                recordRawPosition(this);
                Sk.execStart = new Date();
                return value;
            };
            return update && typeof update.then === "function" ? update.then(notify) : notify(update);
        };
    }

    function configureSkulpt() {
        clearTurtle();
        Sk.TurtleGraphics = Sk.TurtleGraphics || {};
        Object.assign(Sk.TurtleGraphics, {
            target: "agent-training-turtle",
            width: 800,
            height: 450,
            worldWidth: 800,
            worldHeight: 450,
            animate: !fastMode && !reducedMotion,
            bufferSize: fastMode || reducedMotion ? 1000 : 0
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
        Sk.onAfterImport = moduleName => {
            if (moduleName === "turtle") installTurtleObserver();
        };
    }

    function renderChecks(result) {
        checksList.replaceChildren();
        result.checks.forEach(check => {
            const item = document.createElement("li");
            item.className = "training-check " + (check.passed ? "is-passed" : "is-missing");

            const icon = document.createElement("span");
            icon.className = "training-check-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = check.passed ? "✓" : "○";

            const label = document.createElement("span");
            label.textContent = check.label;
            item.append(icon, label);
            checksList.appendChild(item);
        });

        feedbackTitle.textContent = result.passed ? "Signalpunkt kalibriert" : "Nächster sinnvoller Schritt";
        feedbackMessage.textContent = result.message;
        stageMessage.hidden = !result.passed;
        document.body.classList.toggle("training-complete", result.passed);
    }

    function initialResult(message = "Starte deinen Code. Die Prüfung beobachtet den echten Agentenweg.") {
        return {
            passed: false,
            message,
            checks: [
                { label: "Zielpunkt wirklich erreicht", passed: false },
                { label: "Punkt direkt am Ziel markiert", passed: false },
                { label: "Echte Position mit print() ausgegeben", passed: false }
            ]
        };
    }

    function validateRun(code) {
        recordRawPosition(activeTurtle);
        const structure = typeof window.validateLevelSolution === "function"
            ? window.validateLevelSolution("agent_training_level1", code, outputText)
            : { passed: true };
        const result = core.validate(runState, outputText, structure.passed);
        renderChecks(result);

        if (result.passed) {
            window.saveCompletedLevelCode?.("agent_training_level1", code);
            setStatus("Kalibriert", "success");
            setTopStatus("Level 1 geschafft – bitte Umgebung testen", "success");
        } else {
            setStatus("Code prüfen", "warning");
            setTopStatus("Noch nicht ganz – lies den nächsten Hinweis", "warning");
        }
        return result;
    }

    function friendlyError(error) {
        const raw = String(error).replace(/^Error:\s*/, "");
        if (/TimeLimit|timed out|Execution exceeded/i.test(raw)) {
            return "Dein Programm läuft zu lange. Prüfe besonders Schleifen und wiederholte Bewegungen.";
        }
        return raw;
    }

    async function runProgram() {
        if (running) return;

        const generation = ++runGeneration;
        cancelRequested = false;
        runState = core.createState();
        outputText = "";
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove(
            "training-complete",
            "training-target-visited",
            "training-target-marked"
        );
        stageMessage.hidden = true;
        updateCoordinates();
        renderChecks(initialResult("Simulation läuft – Ziel, Markierung und Ausgabe werden live geprüft."));
        setRunning(true);
        setStatus("Agent unterwegs", "running");
        setTopStatus("Simulation läuft …", "running");

        const code = editor.getValue();
        try {
            configureSkulpt();
            await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true));
            if (generation !== runGeneration) return;

            validateRun(code);
            if (!outputText.trim()) consoleOutput.textContent = "Programm beendet – noch ohne Ausgabe.";
        } catch (error) {
            if (generation !== runGeneration || cancelRequested) return;
            consoleOutput.textContent = "FEHLER: " + friendlyError(error);
            consoleOutput.classList.add("is-error");
            renderChecks(initialResult("Verbessere den Python-Fehler und starte die Simulation erneut."));
            feedbackTitle.textContent = "Programm gestoppt";
            setStatus("Fehler gefunden", "error");
            setTopStatus("Python-Fehler – prüfe den Editor", "error");
        } finally {
            if (generation === runGeneration) {
                const restoreStarter = cancelRequested;
                setRunning(false);
                if (restoreStarter) {
                    cancelRequested = false;
                    resetLevel();
                }
            }
        }
    }

    function resetLevel() {
        if (running) {
            cancelRequested = true;
            Sk.execStart = new Date(0);
            setRunning(true);
            setStatus("Training wird gestoppt", "warning");
            setTopStatus("Agent wird zurückgesetzt …", "warning");
            return;
        }

        runGeneration += 1;
        editor.setValue(defaultCode);
        editor.clearHistory?.();
        runState = core.createState();
        outputText = "";
        consoleOutput.textContent = "Bereit für deine ersten Turtle-Befehle.";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove(
            "training-complete",
            "training-target-visited",
            "training-target-marked"
        );
        stageMessage.hidden = true;
        clearTurtle();
        updateCoordinates();
        renderChecks(initialResult());
        setStatus("Bereit", "ready");
        setTopStatus("Warte auf deinen Code", "ready");
        editor.focus();
    }

    runButton.addEventListener("click", runProgram);
    resetButton.addEventListener("click", resetLevel);
    editor.addKeyMap?.({
        "Ctrl-Enter": runProgram,
        "Cmd-Enter": runProgram
    });

    window.restoreCompletedLevelCode?.("agent_training_level1");
    renderChecks(initialResult());
    updateCoordinates();
    setStatus("Bereit", "ready");
    setTopStatus("Warte auf deinen Code", "ready");

    window.AgentTrainingLevel = Object.freeze({
        getState() {
            return {
                ...runState,
                current: { ...runState.current },
                marks: runState.marks.map(mark => ({ ...mark })),
                output: outputText,
                running
            };
        },
        reset: resetLevel,
        run: runProgram
    });
})();
