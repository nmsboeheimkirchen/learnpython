(() => {
    "use strict";

    const config = window.DRONE_MISSION_CONFIG;
    const core = window.DroneMissionCore;
    if (!config || !core) throw new Error("Die Drohnenmission ist nicht vollständig konfiguriert.");

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
        !textarea || !runButton || !resetButton || !consoleOutput || !runStatus ||
        !validationTitle || !validationMessage || !checksList || !turtleTarget
    ) {
        throw new Error("Die gemeinsame Oberfläche der Drohnenmission ist unvollständig.");
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
    window.editor = editor;

    const editorInput = editor.getInputField?.();
    if (editorInput) {
        const label = document.querySelector('label[for="python-editor"]')?.textContent?.trim();
        editorInput.setAttribute("aria-label", label || "Python-Code für die Drohnenmission");
        editorInput.setAttribute("aria-describedby", "editor-shortcut-hint");
    }

    const searchParams = new URLSearchParams(window.location.search);
    const testMode = searchParams.has("test") || searchParams.has("e2e");
    const autoRunTest = searchParams.has("test");
    const defaultCode = config.defaultCode ?? editor.getValue();
    let outputText = "";
    let runGeneration = 0;
    let running = false;
    let activeTurtle = null;
    let cancelRequested = false;

    function builtinRead(path) {
        const file = Sk.builtinFiles?.files?.[path];
        if (file === undefined) throw new Error("Python-Modul nicht gefunden: " + path);
        return file;
    }

    function setStatus(text, state = "ready") {
        runStatus.textContent = text;
        runStatus.className = "mission-run-status is-" + state;
    }

    function setRunning(nextRunning) {
        running = nextRunning;
        document.body.classList.toggle("program-running", nextRunning);
        runButton.disabled = nextRunning;
        runButton.setAttribute("aria-busy", String(nextRunning));
        runButton.innerHTML = nextRunning
            ? '<span class="mission-spinner" aria-hidden="true"></span> ' + (config.runningLabel || "Drohne unterwegs")
            : '<span aria-hidden="true">▶</span> ' + (config.runLabel || "Mission starten");
        resetButton.textContent = nextRunning
            ? (cancelRequested ? "Wird gestoppt …" : "■ Mission stoppen")
            : (config.resetLabel || "↺ Startcode laden");
    }

    function appendOutput(text) {
        if (cancelRequested) return;
        outputText += String(text);
        consoleOutput.textContent = outputText;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        config.onOutput?.(String(text), outputText);
    }

    function clearTurtle() {
        try {
            turtleTarget.turtleInstance?.reset?.();
        } catch (_error) {
            // Ein alter Canvas-Zustand darf den nächsten Lauf nicht blockieren.
        }
        try {
            delete turtleTarget.turtleInstance;
        } catch (_error) {
            turtleTarget.turtleInstance = undefined;
        }
        activeTurtle = null;
        turtleTarget.replaceChildren();
    }

    function getPythonGlobal(name) {
        const value = Sk.globals?.[name];
        return value === undefined ? undefined : Sk.ffi.remapToJs(value);
    }

    function getTurtleContext(raw = activeTurtle) {
        const state = raw?.getState?.();
        return {
            x: Number(state?.x ?? 0),
            y: Number(state?.y ?? 0),
            raw,
            getGlobal: getPythonGlobal
        };
    }

    function syncPythonState(raw = activeTurtle) {
        if (cancelRequested || !raw || typeof config.syncPythonState !== "function") return null;
        const result = config.syncPythonState(getTurtleContext(raw)) || null;
        if (result?.resumeMovement && raw.__droneMissionMovementBlocked) {
            const visibleState = raw.getState?.();
            if (visibleState) {
                raw._x = visibleState.x;
                raw._y = visibleState.y;
            }
            raw.__droneMissionMovementBlocked = false;
        }
        return result;
    }

    function installTurtleDroneApi() {
        const TurtleClass = Sk.TurtleGraphics?.module?.Turtle;
        if (!TurtleClass || TurtleClass.prototype.__droneMissionApiInstalled) return;

        Object.entries(config.droneApi || {}).forEach(([name, handler]) => {
            if (typeof handler !== "function") return;
            const implementation = function (self, ...args) {
                const raw = self?.instance;
                activeTurtle = raw || activeTurtle;
                const remappedArgs = args.map(argument => Sk.ffi.remapToJs(argument));
                const result = handler.call(config, getTurtleContext(raw), ...remappedArgs);
                window.queueMicrotask(() => syncPythonState(raw));
                return Sk.ffi.remapToPy(result);
            };
            implementation.co_name = new Sk.builtin.str(name);
            implementation.co_varnames = ["self"];
            Sk.abstr.sattr(
                TurtleClass,
                new Sk.builtin.str(name),
                new Sk.builtin.func(implementation)
            );
        });

        Object.defineProperty(TurtleClass.prototype, "__droneMissionApiInstalled", {
            value: true,
            configurable: false
        });
    }

    function installTurtleObserver() {
        const Turtle = turtleTarget.turtleInstance?.Turtle || Sk.TurtleGraphics?.raw?.Turtle;
        const prototype = Turtle?.prototype;
        if (!prototype || prototype.__droneMissionObserverInstalled) return;

        const originalAddUpdate = prototype.addUpdate;
        const originalTranslate = prototype.translate;
        const originalDot = prototype.$dot;
        Object.defineProperty(prototype, "__droneMissionObserverInstalled", {
            value: true,
            configurable: false
        });

        if (typeof originalTranslate === "function" && typeof config.limitTurtleMovement === "function") {
            prototype.translate = function (startX, startY, deltaX, deltaY, ...rest) {
                if (cancelRequested) throw new Error("DRONE_MISSION_CANCELLED");
                activeTurtle = this;
                syncPythonState(this);

                const visibleState = this.getState?.();
                if (this.__droneMissionMovementBlocked) {
                    if (visibleState) {
                        this._x = visibleState.x;
                        this._y = visibleState.y;
                    }
                    return Promise.resolve([this._x, this._y]);
                }

                const target = { x: startX + deltaX, y: startY + deltaY };
                const limit = config.limitTurtleMovement({ x: startX, y: startY }, target);
                if (!limit || !Number.isFinite(limit.x) || !Number.isFinite(limit.y)) {
                    return originalTranslate.call(this, startX, startY, deltaX, deltaY, ...rest);
                }

                const movement = originalTranslate.call(
                    this,
                    startX,
                    startY,
                    limit.x - startX,
                    limit.y - startY,
                    ...rest
                );
                return Promise.resolve(movement).then(position => {
                    if (limit.stop) this.__droneMissionMovementBlocked = true;
                    return position;
                });
            };
        }

        if (typeof originalDot === "function" && typeof config.onTurtleMark === "function") {
            prototype.$dot = function (...args) {
                const state = this.getState?.();
                if (state) config.onTurtleMark({ x: state.x, y: state.y }, ...args);
                return originalDot.apply(this, args);
            };
        }

        if (typeof originalAddUpdate !== "function") return;
        prototype.addUpdate = function (...args) {
            if (cancelRequested) return Promise.reject(new Error("DRONE_MISSION_CANCELLED"));
            activeTurtle = this;
            syncPythonState(this);
            if (this.__droneMissionMovementBlocked) return Promise.resolve();

            const update = originalAddUpdate.apply(this, args);
            const notify = value => {
                if (cancelRequested) throw new Error("DRONE_MISSION_CANCELLED");
                const state = this.getState?.();
                if (state && Number.isFinite(state.x) && Number.isFinite(state.y)) {
                    const frameResult = config.onTurtleFrame?.({ x: state.x, y: state.y });
                    if (frameResult?.stop) this.__droneMissionMovementBlocked = true;
                    Sk.execStart = new Date();
                }
                return value;
            };
            return update && typeof update.then === "function" ? update.then(notify) : notify(update);
        };
    }

    function configureSkulpt() {
        clearTurtle();
        Sk.TurtleGraphics = Sk.TurtleGraphics || {};
        Object.assign(Sk.TurtleGraphics, {
            target: config.targetId,
            width: config.stageWidth || 960,
            height: config.stageHeight || 540,
            worldWidth: config.worldWidth || 960,
            worldHeight: config.worldHeight || 540,
            animate: !testMode,
            bufferSize: testMode ? 1000 : 0
        });
        Sk.pre = "console-output";
        Sk.configure({
            output: appendOutput,
            read: builtinRead,
            execLimit: config.execLimit || 8000,
            yieldLimit: 100,
            killableWhile: true,
            killableFor: true,
            __future__: Sk.python3
        });
        Sk.onAfterImport = moduleName => {
            if (moduleName !== "turtle") return;
            installTurtleObserver();
            installTurtleDroneApi();
        };
    }

    function renderChecks(result) {
        checksList.replaceChildren();
        (result.checks || []).forEach(check => {
            const item = document.createElement("li");
            item.className = "mission-check " + (check.passed ? "is-passed" : "is-missing");
            if (check.optional) item.classList.add("is-optional");

            const icon = document.createElement("span");
            icon.className = "mission-check-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = check.passed ? "✓" : "○";
            const label = document.createElement("span");
            label.textContent = check.label;
            item.append(icon, label);
            checksList.appendChild(item);
        });

        validationTitle.textContent = result.title || (result.passed ? "Checkpoint erreicht" : "Nächster sinnvoller Schritt");
        validationMessage.textContent = result.message || "";
        document.body.classList.toggle("mission-passed", Boolean(result.passed));
        config.onResult?.(result);
    }

    function initialResult(message) {
        return {
            passed: false,
            title: "Noch nicht ausgeführt",
            message: message || config.initialMessage || "Starte deinen Code und beobachte die Drohne.",
            checks: (config.initialChecks || []).map(label => ({ label, passed: false }))
        };
    }

    function friendlyError(error) {
        const raw = String(error).replace(/^Error:\s*/, "");
        if (/TimeLimit|timed out|Execution exceeded/i.test(raw)) {
            return "Dein Programm läuft zu lange. Prüfe besonders Schleifen und wiederholte Bewegungen.";
        }
        return raw;
    }

    function finishRun(code) {
        syncPythonState();
        const notice = config.getRunNotice?.();
        if (notice) appendOutput((outputText && !outputText.endsWith("\n") ? "\n" : "") + notice + "\n");
        const result = config.validate(code, outputText, getTurtleContext());
        renderChecks(result);
        setStatus(
            result.status || (result.passed ? "Checkpoint erreicht" : "Code prüfen"),
            result.statusState || (result.passed ? "success" : "warning")
        );
        if (result.passed && config.levelId) {
            window.saveCompletedLevelCode?.(config.levelId, code);
            (result.unlocks || config.unlocks || []).forEach(id => window.unlockLevel?.(id));
        }
        return result;
    }

    async function runProgram() {
        if (running) return;
        const generation = ++runGeneration;
        cancelRequested = false;
        outputText = "";
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove("mission-passed");
        config.resetHud?.();
        renderChecks(initialResult("Simulation läuft – die Missionszustände werden live geprüft."));
        setRunning(true);
        setStatus(config.runningLabel || "Drohne unterwegs", "running");
        const code = editor.getValue();

        try {
            config.onRunStart?.(code);
            configureSkulpt();
            await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true));
            if (generation !== runGeneration) return null;
            const result = finishRun(code);
            if (!outputText.trim()) consoleOutput.textContent = config.emptyOutput || "Programm beendet – noch ohne Textausgabe.";
            return result;
        } catch (error) {
            if (generation !== runGeneration || cancelRequested) return null;
            config.onRunError?.(error);
            consoleOutput.textContent = "FEHLER: " + friendlyError(error);
            consoleOutput.classList.add("is-error");
            renderChecks(initialResult("Behebe den Python-Fehler und starte die Mission erneut."));
            validationTitle.textContent = "Programm gestoppt";
            setStatus("Fehler gefunden", "error");
            return null;
        } finally {
            if (generation === runGeneration) {
                const restoreStarter = cancelRequested;
                setRunning(false);
                if (restoreStarter) {
                    cancelRequested = false;
                    resetMission();
                }
            }
        }
    }

    function resetMission() {
        if (running) {
            cancelRequested = true;
            Sk.execStart = new Date(0);
            setRunning(true);
            setStatus("Mission wird gestoppt", "warning");
            return;
        }
        runGeneration += 1;
        editor.setValue(defaultCode);
        editor.clearHistory?.();
        outputText = "";
        consoleOutput.textContent = config.resetOutput || "Bereit für deine Drohnenbefehle.";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove("mission-passed");
        config.resetHud?.();
        clearTurtle();
        renderChecks(initialResult());
        setStatus(config.readyLabel || "Bereit", "ready");
        editor.focus();
    }

    function setPresentationMode(enabled) {
        document.body.classList.toggle("presentation-mode", enabled);
        presentationButton?.setAttribute("aria-pressed", String(enabled));
        if (presentationButton) presentationButton.textContent = enabled ? "Editor anzeigen" : "◫ Präsentieren";
        window.setTimeout(() => editor.refresh(), 0);
    }

    runButton.addEventListener("click", runProgram);
    resetButton.addEventListener("click", resetMission);
    presentationButton?.addEventListener("click", () => {
        setPresentationMode(!document.body.classList.contains("presentation-mode"));
    });
    exitPresentationButton?.addEventListener("click", () => setPresentationMode(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && document.body.classList.contains("presentation-mode")) {
            setPresentationMode(false);
        }
    });

    config.resetHud?.();
    setStatus(config.readyLabel || "Bereit", "ready");
    renderChecks(initialResult());

    const restored = config.levelId && window.restoreCompletedLevelCode?.(config.levelId);
    if (restored) {
        config.restoreCompletedState?.();
        const restoredResult = config.getRestoredResult?.();
        if (restoredResult) {
            renderChecks(restoredResult);
            setStatus(restoredResult.status || "Checkpoint erreicht", restoredResult.statusState || "success");
        }
    }

    window.DroneMissionRuntime = Object.freeze({
        editor,
        getOutput: () => outputText,
        reset: resetMission,
        run: runProgram,
        refresh() {
            if (!running) finishRun(editor.getValue());
        }
    });

    if (autoRunTest) window.setTimeout(runProgram, 60);
})();
