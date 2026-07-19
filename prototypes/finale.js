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

    const editorInput = editor.getInputField?.();
    if (editorInput) {
        const editorLabel = document.querySelector('label[for="python-editor"]')?.textContent?.trim();
        editorInput.setAttribute("aria-label", editorLabel || "Python-Code");
        editorInput.setAttribute("aria-describedby", "editor-shortcut-hint");
    }

    const searchParams = new URLSearchParams(window.location.search);
    const testMode = searchParams.has("test") || searchParams.has("e2e");
    const autoRunTest = searchParams.has("test");
    let outputText = "";
    let runGeneration = 0;
    let running = false;
    let activeTurtle = null;
    let automaticStopRendered = false;
    let cancelRequested = false;

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
        resetButton.disabled = nextRunning && cancelRequested;
        runButton.setAttribute("aria-busy", String(nextRunning));
        runButton.innerHTML = nextRunning
            ? '<span class="button-spinner" aria-hidden="true"></span> ' + (config.runningLabel || "Programm läuft")
            : '<span aria-hidden="true">▶</span> ' + (document.body.classList.contains("museum-theme") ? "Flucht starten" : "Mission starten");
        resetButton.textContent = nextRunning
            ? (cancelRequested ? "Wird gestoppt …" : "■ Mission stoppen")
            : "↺ Beispiel laden";
    }

    function appendOutput(text) {
        if (cancelRequested) return;
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
        activeTurtle = null;
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
        Sk.onAfterImport = moduleName => {
            if (moduleName !== "turtle") return;
            try {
                installTurtleObserver();
                installTurtleAgentApi();
            } catch (error) {
                console.error("Turtle-Agent-API konnte nicht installiert werden", error);
            }
        };
    }

    function getPythonGlobal(name) {
        const value = Sk.globals?.[name];
        return value === undefined ? undefined : Sk.ffi.remapToJs(value);
    }

    function getTurtleContext(raw) {
        const state = raw?.getState?.();
        return {
            x: Number(state?.x ?? 0),
            y: Number(state?.y ?? 0),
            raw,
            getGlobal: getPythonGlobal
        };
    }

    function syncPythonState(raw = activeTurtle) {
        if (cancelRequested || !raw || !config.syncPythonState) return null;
        const result = config.syncPythonState(getTurtleContext(raw)) || null;

        if (result?.resumeMovement && raw.__finaleMovementBlocked) {
            const visibleState = raw.getState?.();
            if (visibleState) {
                raw._x = visibleState.x;
                raw._y = visibleState.y;
            }
            raw.__finaleMovementBlocked = false;
        }
        return result;
    }

    function installTurtleAgentApi() {
        const TurtleClass = Sk.TurtleGraphics?.module?.Turtle;
        if (!TurtleClass || TurtleClass.prototype.__finaleAgentApiInstalled) return;

        const defineMethod = name => {
            const implementation = function (self) {
                const raw = self?.instance;
                activeTurtle = raw || activeTurtle;
                const handler = config.agentApi?.[name];
                const result = typeof handler === "function"
                    ? handler.call(config, getTurtleContext(raw))
                    : null;

                if (name === "suche_hier") {
                    window.queueMicrotask(() => syncPythonState(raw));
                }
                return Sk.ffi.remapToPy(result);
            };
            implementation.co_name = new Sk.builtin.str(name);
            implementation.co_varnames = ["self"];
            Sk.abstr.sattr(
                TurtleClass,
                new Sk.builtin.str(name),
                new Sk.builtin.func(implementation)
            );
        };

        defineMethod("suche_hier");
        defineMethod("sende");
        Object.defineProperty(TurtleClass.prototype, "__finaleAgentApiInstalled", {
            value: true,
            configurable: false
        });
    }

    function installTurtleObserver() {
        const Turtle = turtleTarget.turtleInstance?.Turtle || Sk.TurtleGraphics?.raw?.Turtle;
        const prototype = Turtle?.prototype;
        if (!prototype || prototype.__finaleObserverInstalled) return;

        const originalAddUpdate = prototype.addUpdate;
        const originalSpeed = prototype.$speed;
        const originalTranslate = prototype.translate;
        const originalDot = prototype.$dot;
        Object.defineProperty(prototype, "__finaleObserverInstalled", {
            value: true,
            configurable: false
        });

        if (typeof originalSpeed === "function" && typeof config.getTurtleSpeedMultiplier === "function") {
            prototype.$speed = function (requestedSpeed) {
                const result = originalSpeed.call(this, requestedSpeed);
                const numericSpeed = Number(requestedSpeed?.v ?? requestedSpeed);
                const multiplier = Number(config.getTurtleSpeedMultiplier(numericSpeed));
                if (requestedSpeed !== undefined && Number.isFinite(multiplier) && multiplier > 1) {
                    this._computed_speed *= multiplier;
                }
                return result;
            };
        }

        if (typeof originalTranslate === "function" && typeof config.limitTurtleMovement === "function") {
            prototype.translate = function (startX, startY, deltaX, deltaY, ...rest) {
                if (cancelRequested) throw new Error("FINALE_RUN_CANCELLED");
                activeTurtle = this;
                syncPythonState(this);

                const visibleState = this.getState?.();
                if (this.__finaleMovementBlocked) {
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
                    if (limit.stop) this.__finaleMovementBlocked = true;
                    return position;
                });
            };
        }

        if (typeof originalDot === "function" && typeof config.onTurtleMark === "function") {
            prototype.$dot = function (...args) {
                config.onTurtleMark();
                return originalDot.apply(this, args);
            };
        }

        prototype.addUpdate = function (...args) {
            if (cancelRequested) return Promise.reject(new Error("FINALE_RUN_CANCELLED"));
            activeTurtle = this;
            syncPythonState(this);
            if (this.__finaleMovementBlocked) return Promise.resolve();

            const update = originalAddUpdate.apply(this, args);
            const notify = value => {
                if (cancelRequested) throw new Error("FINALE_RUN_CANCELLED");
                const state = this.getState?.();
                if (state && Number.isFinite(state.x) && Number.isFinite(state.y)) {
                    const frameResult = config.onTurtleFrame?.({ x: state.x, y: state.y });
                    if (frameResult?.stop) this.__finaleMovementBlocked = true;
                    // Animationszeit ist keine Python-Endlosschleife. Echte Schleifen ohne Turtle-Frames
                    // bleiben weiterhin durch execLimit begrenzt.
                    Sk.execStart = new Date();
                }
                return value;
            };

            return update && typeof update.then === "function"
                ? update.then(notify)
                : notify(update);
        };
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
                badge.textContent = check.passed ? "Teilbereich erfüllt" : "Teilbereich prüfen";
                item.appendChild(badge);
            }
            checksList.appendChild(item);
        });

        validationTitle.textContent = result.passed ? "Bereit zur Präsentation" : "Noch nicht ganz bereit";
        validationMessage.textContent = result.message;
        document.body.classList.toggle("validation-passed", result.passed);
    }

    function renderPendingChecks(label = "Prüfung läuft …") {
        checksList.textContent = "";
        const item = document.createElement("li");
        item.className = "check-item is-pending";
        item.textContent = label;
        checksList.appendChild(item);
        validationTitle.textContent = "Programm wird geprüft";
        validationMessage.textContent = "Die Simulation ermittelt gerade die echten Missionszustände.";
        document.body.classList.remove("validation-passed", "mission-complete");
    }

    function friendlyError(error) {
        const raw = String(error);
        if (/TimeLimit|timed out|Execution exceeded/i.test(raw)) {
            return "Dein Programm läuft zu lange. Prüfe besonders deine Schleifen.";
        }
        return raw.replace(/^Error:\s*/, "");
    }

    function finishAutomaticStop(automaticStop, code) {
        if (automaticStop.output && !automaticStopRendered) {
            appendOutput((outputText && !outputText.endsWith("\n") ? "\n" : "") + automaticStop.output + "\n");
        }
        automaticStopRendered = true;
        const result = config.validate(code, outputText);
        renderChecks({ ...result, passed: false, message: automaticStop.message });
        validationTitle.textContent = automaticStop.title || "Mission automatisch gestoppt";
        document.body.classList.remove("validation-passed", "mission-complete");
        setStatus(automaticStop.status || "Automatisch gestoppt", "warning");
    }

    function refreshValidation() {
        if (running) return;
        const code = editor.getValue();
        syncPythonState();
        const hudData = config.parseOutput?.(outputText);
        if (hudData) config.applyHud?.(hudData);
        const automaticStop = config.getAutomaticStop?.(code, outputText);
        if (automaticStop) {
            finishAutomaticStop(automaticStop, code);
            return;
        }
        const result = config.validate(code, outputText);
        renderChecks(result);
        setStatus(result.passed ? "Technisch bereit" : "Code prüfen", result.passed ? "success" : "warning");
    }

    async function runProgram() {
        if (running) return;

        const generation = ++runGeneration;
        cancelRequested = false;
        const code = editor.getValue();
        outputText = "";
        automaticStopRendered = false;
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove("validation-passed", "mission-complete");
        renderPendingChecks();
        config.resetHud?.();
        config.onRunStart?.(code);
        setRunning(true);
        setStatus(config.runningLabel || "Programm läuft", "running");

        try {
            configureSkulpt();
            await Sk.misceval.asyncToPromise(() => (
                Sk.importMainWithBody("<stdin>", false, code, true)
            ));

            if (generation !== runGeneration) return;
            syncPythonState();

            const hudData = config.parseOutput?.(outputText);
            if (hudData) config.applyHud?.(hudData);

            const automaticStop = config.getAutomaticStop?.(code, outputText);
            if (automaticStop) {
                finishAutomaticStop(automaticStop, code);
                return;
            }

            const result = config.validate(code, outputText);
            renderChecks(result);
            setStatus(result.passed ? "Technisch bereit" : "Code prüfen", result.passed ? "success" : "warning");

            if (!outputText.trim()) {
                consoleOutput.textContent = "Programm beendet – noch ohne Textausgabe.";
            }
        } catch (error) {
            if (generation !== runGeneration) return;
            if (cancelRequested) return;
            try {
                config.onRunError?.(error);
            } catch (cleanupError) {
                console.error("Finale-Zustand konnte nach dem Programmfehler nicht gestoppt werden", cleanupError);
            }
            const message = friendlyError(error);
            consoleOutput.textContent = "FEHLER: " + message;
            consoleOutput.classList.add("is-error");
            validationTitle.textContent = "Programm gestoppt";
            validationMessage.textContent = "Verbessere den markierten Code und starte erneut.";
            checksList.innerHTML = '<li class="check-item is-missing">Programmfehler beheben</li>';
            document.body.classList.remove("validation-passed", "mission-complete");
            setStatus("Fehler gefunden", "error");
        } finally {
            if (generation === runGeneration) {
                const restoreExample = cancelRequested;
                setRunning(false);
                if (restoreExample) {
                    cancelRequested = false;
                    resetPrototype();
                }
            }
        }
    }

    function resetPrototype() {
        if (running) {
            cancelRequested = true;
            Sk.execStart = new Date(0);
            setRunning(true);
            setStatus("Mission wird gestoppt", "warning");
            return;
        }
        runGeneration += 1;
        editor.setValue(config.defaultCode);
        editor.clearHistory();
        outputText = "";
        automaticStopRendered = false;
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
    window.finalePrototype = { editor, run: runProgram, reset: resetPrototype, refresh: refreshValidation };

    if (autoRunTest) {
        window.setTimeout(runProgram, 60);
    }
})();
