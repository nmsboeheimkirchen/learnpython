(() => {
    "use strict";

    const pathCore = window.PicoMissionCore;
    if (!pathCore) throw new Error("Der gemeinsame PICO-Missionskern fehlt.");

    const level = document.body.dataset.picoLevel || "1";
    const state = pathCore.createState();
    const byId = id => document.getElementById(id);
    const nextContainer = byId("next-level-container");
    const energyAdvice = byId("energy-advice");
    const energyCellReveal = byId("energy-cell-reveal");
    const directTask = byId("level1-direct-task");
    const cellTask = byId("level1-cell-task");
    const stageMessage = byId("stage-discovery-message");
    let level1Phase = "direct";
    let finaleCompletionShown = false;

    const LEVEL_SPECS = Object.freeze({
        "1": Object.freeze({
            id: "pico_level1_navigation",
            runningLabel: "Drohne unterwegs",
            runLabel: "Idee testen",
            readyLabel: "Bereit für deine Idee",
            resetLabel: "↺ Explorer-Code laden",
            resetOutput: "Die Drohne wartet am Aufzug auf deinen Plan.",
            initialMessage: "Gib deiner Drohne einen Namen und teste zuerst deine eigene Route.",
            initialChecks: [
                "Drohne über status benannt",
                "Direkten Weg zur Funkbase untersuchen",
                "Energiezelle tatsächlich erreichen"
            ]
        }),
        "2": Object.freeze({
            id: "pico_level2",
            runningLabel: "Drohne untersucht die Energiezelle",
            runLabel: "Finden und aufladen",
            readyLabel: "Bereit zum Untersuchen",
            resetLabel: "↺ Level-Code laden",
            resetOutput: "Die Energiezelle wartet auf ihre Untersuchung.",
            initialMessage: "Erreiche die Energiezelle, untersuche den echten Fund und nimm ihn in die Ausrüstung auf.",
            initialChecks: [
                "Energiezelle mit suche_hier() finden",
                "Echten Fund ausgeben",
                "Echten Fund aufnehmen und laden"
            ]
        }),
        "2a": Object.freeze({
            id: "pico_level2a",
            runningLabel: "Status-Cockpit wird geprüft",
            runLabel: "Status prüfen",
            readyLabel: "Optionale Zwischenstation",
            resetLabel: "↺ Übernommenen Code laden",
            resetOutput: "Das Status-Cockpit ist optional bereit.",
            initialMessage: "Setze den TRANSPONDER nach dem echten Laden von „suche“ auf „aufgeladen“ – oder überspringe diese Zwischenstation.",
            initialChecks: [
                "Energiezelle im selben Lauf geladen",
                "Drohnenname bleibt im Status erhalten",
                "TRANSPONDER erreicht tatsächlich „aufgeladen“"
            ]
        }),
        "3": Object.freeze({
            id: "pico_level3",
            runningLabel: "Drohne fliegt zur Funkbase",
            runLabel: "Rettungssignal testen",
            readyLabel: "Bereit für die Funkbase",
            resetLabel: "↺ Übernommenen Code laden",
            resetOutput: "Die Funkbase wartet auf eine geladene Drohne.",
            initialMessage: "Lade die Energiezelle und erreiche anschließend mit eigener Route die Funkbase.",
            initialChecks: [
                "Energie im selben Programmlauf laden",
                "Funkbase mit Restenergie erreichen",
                "sende() bestätigt das Rettungssignal"
            ]
        }),
        "4": Object.freeze({
            id: "pico_level4",
            runningLabel: "PICO führt die Rettungsmission aus",
            runLabel: "Finale starten",
            readyLabel: "Bereit fürs Finale",
            resetLabel: "↺ Missionscode laden",
            resetOutput: "Die vollständige Rettungsmission ist startklar.",
            initialMessage: "Führe Energieaufnahme und Rettungssignal in einem nachvollziehbaren Programm zusammen.",
            initialChecks: [
                "Benannte Drohne steuern",
                "Energiezelle real finden und laden",
                "Funkbase erreichen und Signal senden",
                "Optional: TRANSPONDER-Status fortschreiben"
            ]
        })
    });

    const spec = LEVEL_SPECS[level] || LEVEL_SPECS["1"];
    const LEVEL_UNLOCKS = Object.freeze({
        "1": Object.freeze(["link-pico-l2"]),
        "2": Object.freeze(["link-pico-l2a", "link-pico-l3"]),
        "2a": Object.freeze(["link-pico-l3"]),
        "3": Object.freeze(["link-pico-l4"]),
        "4": Object.freeze([])
    });

    function setHidden(element, hidden) {
        if (element) element.hidden = Boolean(hidden);
    }

    function renderEnergy(percent) {
        const energy = Math.max(0, Math.min(100, Number(percent) || 0));
        byId("energy-value").textContent = Math.round(energy) + " %";
        byId("energy-fill").style.width = energy + "%";
        byId("energy-meter").setAttribute("aria-valuenow", String(Math.round(energy)));
    }

    function renderState() {
        const snapshot = state.snapshot();
        renderEnergy(snapshot.energy);
        byId("coordinate-x").textContent = String(Math.round(snapshot.current.x));
        byId("coordinate-y").textContent = String(Math.round(snapshot.current.y));
        byId("drone-name").textContent = snapshot.droneName || "–";
        byId("transponder-state").textContent = snapshot.transponder || "–";

        const cellLabel = byId("pico-cell-label");
        if (cellLabel) {
            cellLabel.innerHTML = snapshot.charged
                ? '<span aria-hidden="true">✓</span> Energie geladen'
                : '<span aria-hidden="true">ϟ</span> Energiezelle (−380, −90)';
        }

        const rescueMessage = byId("pico-result-message");
        if (rescueMessage) {
            if (snapshot.signalSent) {
                rescueMessage.textContent = "Signal gesendet – gerettet!";
            } else if (snapshot.signalAttempted) {
                const messages = {
                    BEACON_OUT_OF_RANGE: "SIGNAL FEHLGESCHLAGEN – FUNKBASE AUSSER REICHWEITE",
                    CELL_MISSING: "SIGNAL FEHLGESCHLAGEN – ENERGIEZELLE FEHLT",
                    ENERGY_EMPTY: "SIGNAL FEHLGESCHLAGEN – ENERGIE LEER"
                };
                rescueMessage.textContent = messages[snapshot.lastSignalFailure] || "SIGNAL FEHLGESCHLAGEN";
            } else {
                rescueMessage.textContent = "";
            }
        }

        document.body.classList.toggle("energy-cell-collected", snapshot.charged);
        document.body.classList.toggle("energy-depleted", snapshot.depleted);
        document.body.classList.toggle("rescue-success", snapshot.signalSent);
        document.body.classList.toggle("rescue-failed", snapshot.signalAttempted && !snapshot.signalSent);
        return snapshot;
    }

    function renderLevel1Phase() {
        if (level !== "1") return;
        const cellPhase = level1Phase === "cell";
        setHidden(directTask, cellPhase);
        setHidden(cellTask, !cellPhase);
        if (energyAdvice) {
            energyAdvice.classList.toggle("is-open", cellPhase);
            energyAdvice.setAttribute("aria-expanded", String(cellPhase));
        }
        document.body.classList.toggle("pico-cell-phase", cellPhase);
    }

    function enterCellPhase() {
        if (level !== "1") return;
        level1Phase = "cell";
        setHidden(energyAdvice, false);
        setHidden(energyCellReveal, false);
        renderLevel1Phase();
        if (stageMessage) {
            stageMessage.hidden = false;
            stageMessage.textContent = "NEUES ZIEL: ENERGIEZELLE";
        }
        window.requestAnimationFrame(() => {
            const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
            cellTask?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
        });
    }

    energyAdvice?.addEventListener("click", enterCellPhase);

    function namedDrone(snapshot) {
        return Boolean(snapshot.droneName);
    }

    function level1Result() {
        const snapshot = state.snapshot();
        const named = namedDrone(snapshot);
        if (snapshot.visitedCell) {
            return {
                passed: named,
                levelComplete: named,
                kind: "cell-reached",
                title: named ? "Energiezelle erreicht" : "Gib deiner Drohne noch einen Namen",
                message: named
                    ? "Die Navigation stimmt. Im nächsten Level untersuchst du die Energiezelle und lädst sie wirklich auf."
                    : 'Die Route stimmt. Ergänze jetzt einen Namen in status["DROHNE"].',
                status: named ? "Level 1 geschafft" : "Name fehlt",
                statusState: named ? "success" : "warning",
                checks: [
                    { label: "Drohne über status benannt", passed: named },
                    { label: "Energiezelle tatsächlich erreicht", passed: true }
                ]
            };
        }

        const discovered = snapshot.directBeaconAttempted && snapshot.depleted;
        if (discovered) {
            return {
                passed: true,
                levelComplete: false,
                kind: "energy-discovery",
                title: "Gute Entdeckung: Energie reicht nicht",
                message: "Der direkte Weg ist zu lang. Öffne den blinkenden Hinweis oder steuere selbst zur Energiezelle bei (−380, −90).",
                status: "Energieproblem erkannt",
                statusState: "success",
                checks: [
                    { label: "Drohne über status benannt", passed: named },
                    { label: "Direkten Flug zur Funkbase gestartet", passed: true },
                    { label: "Reales Energielimit beobachtet", passed: true }
                ]
            };
        }

        return {
            passed: false,
            levelComplete: false,
            kind: "route-missing",
            title: level1Phase === "cell" ? "Navigiere zur Energiezelle" : "Teste deine erste Idee",
            message: level1Phase === "cell"
                ? "Steuere die Drohne zur Energiezelle bei (−380, −90). Aufgeladen wird erst im nächsten Level."
                : "Benenne deine Drohne und teste den direkten Flug zur Funkbase bei (340, 15).",
            status: "Route prüfen",
            statusState: "warning",
            checks: [
                { label: "Drohne über status benannt", passed: named },
                { label: level1Phase === "cell" ? "Energiezelle tatsächlich erreichen" : "Direkten Flug zur Funkbase starten", passed: false }
            ]
        };
    }

    function level2Result(output) {
        const snapshot = state.snapshot();
        const printedFind = snapshot.searchFound && String(output).includes(pathCore.ENERGY_ITEM);
        const checks = [
            { label: "Energiezelle mit suche_hier() am Fundort gefunden", passed: snapshot.searchFound },
            { label: "Echten Fund ausgegeben", passed: printedFind },
            { label: "Echten Fund aufgenommen und Energie geladen", passed: snapshot.charged }
        ];
        const passed = checks.every(check => check.passed);
        return {
            passed,
            levelComplete: passed,
            title: passed ? "Energie vollständig geladen" : "Fund untersuchen und sichern",
            message: passed
                ? "Die Energiezelle stammt aus der echten Suche und liegt in deiner Ausrüstung."
                : "Nur eine am richtigen Ort gefundene und anschließend aufgenommene Energiezelle lädt die Drohne.",
            status: passed ? "Aufgeladen" : "Ladevorgang prüfen",
            statusState: passed ? "success" : "warning",
            checks
        };
    }

    function level2aResult() {
        const snapshot = state.snapshot();
        const named = namedDrone(snapshot);
        const reachedLoadedStatus = snapshot.transponderHistory.includes("aufgeladen");
        const checks = [
            { label: "Energiezelle im selben Lauf geladen", passed: snapshot.charged },
            { label: "Drohnenname bleibt im Status erhalten", passed: named },
            { label: "TRANSPONDER wurde zur Laufzeit auf „aufgeladen“ gesetzt", passed: reachedLoadedStatus }
        ];
        const passed = checks.every(check => check.passed);
        return {
            passed,
            levelComplete: passed,
            title: passed ? "Status-Cockpit aktualisiert" : "TRANSPONDER noch auf „suche“",
            message: passed
                ? "Das Cockpit zeigt den echten Ladezustand. Weiter geht es zur Funkbase."
                : "Setze status[\"TRANSPONDER\"] nach dem Laden auf \"aufgeladen\" – oder überspringe diese Zwischenstation.",
            status: passed ? "Status aktuell" : "Optionaler Status",
            statusState: passed ? "success" : "warning",
            checks
        };
    }

    function level3Result() {
        const snapshot = state.snapshot();
        const checks = [
            { label: "Energie im selben Programmlauf geladen", passed: snapshot.charged },
            { label: "Funkbase mit Restenergie erreicht", passed: snapshot.beaconReached && !snapshot.depleted && snapshot.energy > 0 },
            { label: "sende() bestätigt das Rettungssignal", passed: snapshot.signalSent },
            {
                label: "Optional: TRANSPONDER meldete „aufgeladen“",
                passed: snapshot.transponderHistory.includes("aufgeladen"),
                optional: true
            }
        ];
        const passed = checks.filter(check => !check.optional).every(check => check.passed);
        return {
            passed,
            levelComplete: passed,
            title: passed ? "Rettungssignal bestätigt" : "Funkbase noch nicht einsatzbereit",
            message: passed
                ? "Die Energie reicht und das Signal wurde direkt an der Funkbase bestätigt."
                : "Lade zuerst die echte Energiezelle und rufe sende() erst an der Funkbase auf.",
            status: passed ? "Signal bestätigt" : "Signal prüfen",
            statusState: passed ? "success" : "warning",
            checks
        };
    }

    function level4Result() {
        const snapshot = state.snapshot();
        const checks = [
            { label: "Benannte Drohne wird ausgeführt", passed: namedDrone(snapshot) },
            { label: "Energiezelle real gefunden und geladen", passed: snapshot.searchFound && snapshot.charged },
            { label: "Funkbase mit Restenergie erreicht", passed: snapshot.beaconReached && !snapshot.depleted && snapshot.energy > 0 },
            { label: "Rettungssignal bestätigt", passed: snapshot.signalSent },
            {
                label: "Optional: TRANSPONDER meldete „aufgeladen“",
                passed: snapshot.transponderHistory.includes("aufgeladen"),
                optional: true
            },
            {
                label: "Optional: TRANSPONDER meldet „gesendet“",
                passed: snapshot.transponder === "gesendet",
                optional: true
            }
        ];
        const passed = checks.filter(check => !check.optional).every(check => check.passed);
        return {
            passed,
            levelComplete: passed,
            title: passed ? "PICO ist gerettet" : "Rettungsmission noch unvollständig",
            message: passed
                ? "Die vollständige Laufzeitkette stimmt: finden, laden, fliegen und senden."
                : "Die Pflichtchecks beobachten nur das echte Missionsverhalten; das Status-Cockpit bleibt freiwillig.",
            status: passed ? "Mission erfüllt" : "Mission prüfen",
            statusState: passed ? "success" : "warning",
            checks
        };
    }

    function validate(_code, output) {
        if (level === "1") return level1Result();
        if (level === "2") return level2Result(output);
        if (level === "2a") return level2aResult();
        if (level === "3") return level3Result();
        return level4Result();
    }

    function showNext(visible) {
        setHidden(nextContainer, !visible);
    }

    function onResult(result) {
        if (level === "1") {
            if (result.kind === "energy-discovery") {
                setHidden(energyAdvice, false);
                setHidden(energyCellReveal, false);
                energyAdvice?.classList.remove("is-open");
                if (stageMessage) {
                    stageMessage.hidden = false;
                    stageMessage.textContent = "ENERGIEPROBLEM ERKANNT";
                }
            } else if (result.kind === "cell-reached") {
                level1Phase = "cell";
                renderLevel1Phase();
                setHidden(energyAdvice, true);
                setHidden(energyCellReveal, false);
                if (stageMessage) {
                    stageMessage.hidden = false;
                    stageMessage.textContent = "ENERGIEZELLE ERREICHT";
                }
            }
        }
        showNext(Boolean(result.passed && result.levelComplete !== false));

        if (level === "4" && result.passed && !result.restored && !finaleCompletionShown) {
            finaleCompletionShown = true;
            window.triggerSuccess?.(true, "PICO hat die Funkbase mit echter Energie erreicht und das Rettungssignal gesendet.", {
                title: "PICO GERETTET",
                statusLabel: "RETTUNGSMISSION ERFÜLLT!",
                primaryHref: "projektwahl.html",
                primaryLabel: "Zur Projektwahl"
            });
        }
    }

    function restoredResult() {
        const labels = {
            "1": ["Drohne über status benannt", "Energiezelle tatsächlich erreicht"],
            "2": ["Energiezelle mit suche_hier() am Fundort gefunden", "Echten Fund ausgegeben", "Echten Fund aufgenommen und Energie geladen"],
            "2a": ["Energiezelle im selben Lauf geladen", "Drohnenname bleibt im Status erhalten", "TRANSPONDER wurde zur Laufzeit auf „aufgeladen“ gesetzt"],
            "3": ["Energie im selben Programmlauf geladen", "Funkbase mit Restenergie erreicht", "sende() bestätigt das Rettungssignal"],
            "4": ["Benannte Drohne wird ausgeführt", "Energiezelle real gefunden und geladen", "Funkbase mit Restenergie erreicht", "Rettungssignal bestätigt"]
        };
        return {
            passed: true,
            levelComplete: true,
            restored: true,
            kind: level === "1" ? "cell-reached" : "restored",
            title: level === "4" ? "PICO ist gerettet" : "Checkpoint bereits erreicht",
            message: "Dein erfolgreicher Code wurde wiederhergestellt. Du kannst ihn weiter verändern.",
            status: level === "4" ? "Mission erfüllt" : "Checkpoint erreicht",
            statusState: "success",
            checks: labels[level].map(label => ({ label, passed: true }))
        };
    }

    window.DRONE_MISSION_CONFIG = {
        ...spec,
        levelId: spec.id,
        targetId: "pico-mission-turtle",
        defaultCode: byId("python-editor").value,
        unlocks: LEVEL_UNLOCKS[level],
        inheritCode: level !== "1",
        resetToLoadedCode: level !== "1",
        droneApi: {
            suche_hier(context) {
                const item = state.searchHere(context, context.getGlobal("ausruestung"));
                renderState();
                return item;
            },
            sende(context) {
                const sent = state.send(context);
                renderState();
                return sent;
            }
        },
        resetHud(options = {}) {
            state.reset();
            finaleCompletionShown = false;
            if (level === "1" && ["initial", "manual"].includes(options.reason)) {
                level1Phase = "direct";
            }
            renderState();
            showNext(false);
            if (level === "1") {
                setHidden(energyAdvice, true);
                setHidden(energyCellReveal, true);
                setHidden(stageMessage, true);
                renderLevel1Phase();
            }
        },
        syncPythonState(context) {
            state.recordStatus(context.getGlobal("status"));
            const chargedNow = state.syncEquipment(context.getGlobal("ausruestung"));
            renderState();
            return chargedNow ? { resumeMovement: true } : null;
        },
        limitTurtleMovement(start, target) {
            return state.limitMovement(start, target);
        },
        onTurtleFrame(point) {
            const result = state.recordFrame(point);
            renderState();
            return result.stop ? result : null;
        },
        getRunNotice() {
            const snapshot = state.snapshot();
            if (level === "1" && snapshot.directBeaconAttempted && snapshot.depleted && !snapshot.visitedCell) {
                return "Die Drohne stoppt: Der direkte Weg zur Funkbase verbraucht die gesamte Energie.";
            }
            if (level === "1" && snapshot.visitedCell) {
                return "Die Energiezelle ist erreicht. Aufgeladen wird im nächsten Level mit einer echten Suche.";
            }
            if (snapshot.charged) return "Energiezelle gefunden und in die Ausrüstung aufgenommen: Energie 100 %.";
            if (snapshot.searchAttempted && !snapshot.searchFound) return "suche_hier() findet an dieser Position keine Energiezelle.";
            return "Programm beendet – prüfe die echten Missionszustände im Cockpit.";
        },
        validate,
        onResult,
        restoreCompletedState() {
            const checkpoints = {
                "1": { visitedCell: true, status: { DROHNE: "PICO", TRANSPONDER: "suche" } },
                "2": { charged: true, status: { DROHNE: "PICO", TRANSPONDER: "suche" } },
                "2a": { charged: true, status: { DROHNE: "PICO", TRANSPONDER: "aufgeladen" } },
                "3": { signalSent: true, status: { DROHNE: "PICO", TRANSPONDER: "suche" } },
                "4": { signalSent: true, status: { DROHNE: "PICO", TRANSPONDER: "gesendet" } }
            };
            state.restore(checkpoints[level]);
            renderState();
            if (level === "1") level1Phase = "cell";
            renderLevel1Phase();
        },
        getRestoredResult: restoredResult,
        getState: () => state.snapshot()
    };

    window.PicoMissionPath = Object.freeze({
        enterCellPhase,
        getLevel: () => level,
        getState: () => state.snapshot()
    });
})();
