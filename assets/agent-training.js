(() => {
    "use strict";

    const core = window.AgentTrainingCore;
    const editor = window.editor;
    const levelId = document.body.dataset.trainingLevel || "agent_training_level1";
    const levelConfig = core?.getLevelConfig(levelId);
    const turtleTarget = document.getElementById("agent-training-turtle");
    const marksLayer = document.getElementById("training-marks-layer");
    const runButton = document.getElementById("run-btn");
    const resetButton = document.getElementById("reset-btn");
    const nextButton = document.getElementById("next-level-btn");
    const consoleOutput = document.getElementById("console-output");
    const runStatus = document.getElementById("run-status");
    const statusText = document.getElementById("status-text");
    const coordinateX = document.getElementById("coordinate-x");
    const coordinateY = document.getElementById("coordinate-y");
    const feedbackTitle = document.getElementById("training-feedback-title");
    const feedbackMessage = document.getElementById("training-feedback-message");
    const checksList = document.getElementById("training-checks");
    const stageMessage = document.getElementById("training-stage-message");
    const inventoryItems = document.getElementById("training-inventory-items");

    if (
        !core || !levelConfig || !editor || !window.Sk || !turtleTarget || !marksLayer ||
        !runButton || !resetButton || !consoleOutput || !runStatus || !statusText ||
        !coordinateX || !coordinateY || !feedbackTitle || !feedbackMessage ||
        !checksList || !stageMessage
    ) {
        throw new Error("Das Agenten-Training ist unvollständig aufgebaut.");
    }

    const defaultCode = editor.getValue();
    const searchParams = new URLSearchParams(window.location.search);
    const fastMode = searchParams.has("e2e") || searchParams.has("test");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    let runState = core.createState(levelId);
    let outputText = "";
    let activeTurtle = null;
    let runGeneration = 0;
    let running = false;
    let cancelRequested = false;
    let issuedFindTokens = new Set();
    let inventoryAppendEvents = [];

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
        const remapped = value && typeof value === "object" && "v" in value ? value.v : value;
        const candidate = typeof remapped === "string" ? remapped.trim() : "";
        if (!candidate || /url\s*\(/i.test(candidate)) return "#7df2a9";
        return window.CSS?.supports?.("color", candidate) ? candidate : "#7df2a9";
    }

    function renderLiveMark(point, requestedSize, requestedColor) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const rawSize = Number(requestedSize?.v ?? requestedSize);
        const diameter = Number.isFinite(rawSize)
            ? Math.min(48, Math.max(8, Math.abs(rawSize)))
            : 30;
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
        document.body.classList.toggle("training-target-visited", runState.visitedTargetIds.length > 0);
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
                document.body.classList.toggle("training-target-marked", runState.markedTargetIds.length > 0);
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

    function installTurtleAgentApi() {
        if (levelId !== "agent_training_level3") return;
        const TurtleClass = Sk.TurtleGraphics?.module?.Turtle;
        if (!TurtleClass || TurtleClass.prototype.__agentTrainingApiInstalled) return;

        function uniqueStringToken(value) {
            // Skulpt interns equal strings. Clone the Python string so runtime
            // provenance cannot be forged with a separately typed literal.
            const canonical = new Sk.builtin.str(value);
            return Object.create(
                Object.getPrototypeOf(canonical),
                Object.getOwnPropertyDescriptors(canonical)
            );
        }

        const implementation = function (self) {
            const raw = self?.instance;
            activeTurtle = raw || activeTurtle;
            const turtleState = raw?.getState?.();
            const point = { x: Number(turtleState?.x ?? 0), y: Number(turtleState?.y ?? 0) };
            const item = core.searchHere(runState, point);
            updateCoordinates(point);
            document.body.classList.toggle("training-search-found", Boolean(item));

            if (!item) return Sk.builtin.none.none$;
            const token = uniqueStringToken(item);
            issuedFindTokens.add(token);
            return token;
        };
        implementation.co_name = new Sk.builtin.str("suche_hier");
        implementation.co_varnames = ["self"];
        Sk.abstr.sattr(
            TurtleClass,
            new Sk.builtin.str("suche_hier"),
            new Sk.builtin.func(implementation)
        );
        Object.defineProperty(TurtleClass.prototype, "__agentTrainingApiInstalled", {
            value: true,
            configurable: false
        });
    }

    function updateInventoryHud(inventory = Sk.globals?.inventar) {
        if (!inventoryItems) return;
        const values = inventory instanceof Sk.builtin.list ? inventory.v : [];
        const labels = values.map(item => String(Sk.ffi.remapToJs(item)));
        inventoryItems.textContent = labels.length ? labels.join(", ") : "leer";
        inventoryItems.closest(".training-inventory-hud")?.classList.toggle("has-item", labels.length > 0);
    }

    function observeInventoryAppend(list, item) {
        if (levelId !== "agent_training_level3" || !issuedFindTokens.has(item)) return;
        inventoryAppendEvents.push({ list, item });
        if (list === Sk.globals?.inventar) updateInventoryHud(list);
    }

    function installListAppendObserver() {
        const descriptor = Sk.builtin.list?.prototype?.append;
        const definition = descriptor?.d$def;
        if (!descriptor || !definition || typeof definition.$meth !== "function") return;

        if (!descriptor.__agentTrainingAppendWrapped) {
            const originalAppend = definition.$meth;
            const wrappedAppend = function (item) {
                const result = originalAppend.call(this, item);
                descriptor.__agentTrainingAppendObserver?.(this, item);
                return result;
            };
            definition.$meth = wrappedAppend;
            descriptor.$meth = wrappedAppend;
            Object.defineProperty(descriptor, "__agentTrainingAppendWrapped", {
                value: true,
                configurable: false
            });
        }
        descriptor.__agentTrainingAppendObserver = observeInventoryAppend;
    }

    function syncInventoryEvidence() {
        if (levelId !== "agent_training_level3") return;
        const inventory = Sk.globals?.inventar;
        const values = inventory instanceof Sk.builtin.list ? inventory.v : [];
        const validAppend = inventoryAppendEvents.some(event =>
            event.list === inventory &&
            issuedFindTokens.has(event.item) &&
            values.includes(event.item)
        );
        core.recordCollection(runState, validAppend);
        updateInventoryHud(inventory);
    }

    function configureSkulpt() {
        clearTurtle();
        installListAppendObserver();
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
            if (moduleName !== "turtle") return;
            installTurtleObserver();
            installTurtleAgentApi();
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

        feedbackTitle.textContent = result.passed ? levelConfig.successTitle : "Nächster sinnvoller Schritt";
        feedbackMessage.textContent = result.message;
        stageMessage.hidden = !result.passed;
        document.body.classList.toggle("training-complete", result.passed);
    }

    function initialResult(message) {
        return core.initialResult(
            levelId,
            message || "Starte deinen Code. Die Prüfung beobachtet den echten Agentenweg."
        );
    }

    function validateRun(code) {
        recordRawPosition(activeTurtle);
        syncInventoryEvidence();
        const structure = typeof window.validateLevelSolution === "function"
            ? window.validateLevelSolution(levelId, code, outputText)
            : true;
        const result = core.validate(runState, outputText, structure);
        renderChecks(result);

        if (result.passed) {
            window.saveCompletedLevelCode?.(levelId, code);
            if (levelConfig.unlockId) window.unlockLevel?.(levelConfig.unlockId);
            if (nextButton) nextButton.style.display = "block";
            setStatus("Geschafft", "success");
            setTopStatus(levelConfig.successTitle, "success");
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
        runState = core.createState(levelId);
        outputText = "";
        issuedFindTokens = new Set();
        inventoryAppendEvents = [];
        consoleOutput.textContent = "";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove(
            "training-complete",
            "training-target-visited",
            "training-target-marked",
            "training-search-found"
        );
        stageMessage.hidden = true;
        updateInventoryHud(null);
        updateCoordinates();
        renderChecks(initialResult("Simulation läuft – die drei Lernziele werden live geprüft."));
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
        runState = core.createState(levelId);
        outputText = "";
        issuedFindTokens = new Set();
        inventoryAppendEvents = [];
        consoleOutput.textContent = "Bereit für deinen nächsten Agentenbefehl.";
        consoleOutput.classList.remove("is-error");
        document.body.classList.remove(
            "training-complete",
            "training-target-visited",
            "training-target-marked",
            "training-search-found"
        );
        stageMessage.hidden = true;
        clearTurtle();
        updateInventoryHud(null);
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

    const restoredCompletedCode = window.restoreCompletedLevelCode?.(levelId);
    if (restoredCompletedCode && nextButton) nextButton.style.display = "block";
    stageMessage.textContent = levelConfig.stageMessage;
    renderChecks(initialResult());
    updateInventoryHud(null);
    updateCoordinates();
    setStatus("Bereit", "ready");
    setTopStatus("Warte auf deinen Code", "ready");

    window.AgentTrainingLevel = Object.freeze({
        getState() {
            return {
                ...runState,
                current: { ...runState.current },
                marks: runState.marks.map(mark => ({ ...mark })),
                searches: runState.searches.map(search => ({
                    ...search,
                    point: { ...search.point }
                })),
                visitedTargetIds: [...runState.visitedTargetIds],
                markedTargetIds: [...runState.markedTargetIds],
                output: outputText,
                running
            };
        },
        reset: resetLevel,
        run: runProgram
    });
})();
