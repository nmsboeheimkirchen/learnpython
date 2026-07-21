(() => {
    "use strict";

    const core = window.DroneMissionCore;
    if (!core) throw new Error("Der gemeinsame Drohnen-Missionskern fehlt.");

    const START = Object.freeze({ x: -365, y: 55 });
    const ENERGY_CELL = Object.freeze({ x: -380, y: -90 });
    const BEACON = Object.freeze({ x: 340, y: 15 });
    const START_ENERGY = 10;
    const COST_PER_UNIT = START_ENERGY / core.distance(START, ENERGY_CELL);

    function discoveryResult(passed) {
        return {
            passed,
            title: passed ? "Entdeckung gemacht: Energie reicht nicht" : "Teste zuerst den Direktflug",
            message: passed
                ? "Der direkte Weg zur Funkbase ist zu weit. Im nächsten Level planst du zuerst den kurzen Flug zur Energiezelle bei (−380, −90)."
                : "Ergänze fahre_zu(340, 15), damit PICO die Funkbase direkt ansteuert.",
            status: passed ? "Energieproblem erkannt" : "Direktflug fehlt",
            statusState: passed ? "success" : "warning",
            checks: [
                { label: "Direkten Flug zur Funkbase gestartet", passed },
                { label: "Reales Energielimit beobachtet", passed }
            ]
        };
    }

    window.DRONE_MISSION_CONFIG = {
        levelId: "pico_level1",
        targetId: "pico-explorer-turtle",
        runningLabel: "PICO fliegt zur Funkbase",
        runLabel: "Direktflug testen",
        readyLabel: "Bereit für deine Idee",
        resetLabel: "↺ Explorer-Code laden",
        resetOutput: "PICO wartet am Aufzug auf deinen Direktflug.",
        emptyOutput: "Direktflug beendet – beobachte Energie und Missionsfeedback.",
        initialMessage: "Steuere PICO direkt zur Funkbase. Der Kontrollraum verrät vorher nicht, ob die Energie reicht.",
        initialChecks: [
            "Direkten Flug zur Funkbase starten",
            "Energielimit selbst beobachten"
        ],
        defaultCode: document.getElementById("python-editor").value,

        renderEnergy(percent) {
            const energy = Math.max(0, Math.min(100, Number(percent) || 0));
            document.getElementById("energy-value").textContent = Math.round(energy) + " %";
            document.getElementById("energy-fill").style.width = energy + "%";
            document.getElementById("energy-meter").setAttribute("aria-valuenow", String(Math.round(energy)));
        },

        setDiscoveryVisible(visible) {
            document.getElementById("energy-advice").hidden = !visible;
            document.getElementById("energy-cell-reveal").hidden = !visible;
            document.getElementById("next-level-preview").hidden = !visible;
            document.getElementById("stage-discovery-message").hidden = !visible;
            document.body.classList.toggle("pico-discovery-complete", visible);
        },

        resetHud() {
            this.energy = START_ENERGY;
            this.lastPoint = null;
            this.movementLimitPoint = null;
            this.directBeaconAttempted = false;
            this.depleted = false;
            this.renderEnergy(this.energy);
            this.setDiscoveryVisible(false);
            document.getElementById("coordinate-x").textContent = String(START.x);
            document.getElementById("coordinate-y").textContent = String(START.y);
        },

        limitTurtleMovement(start, target) {
            if (!this.lastPoint || this.depleted) return null;
            if (core.isNear(target, BEACON, 45)) this.directBeaconAttempted = true;

            const movement = core.clampMovementByBudget(start, target, this.energy, COST_PER_UNIT);
            if (!movement) return null;
            if (!movement.stopped) return null;

            this.movementLimitPoint = { ...movement.point };
            return { ...movement.point, stop: true };
        },

        onTurtleFrame(point) {
            document.getElementById("coordinate-x").textContent = String(Math.round(point.x));
            document.getElementById("coordinate-y").textContent = String(Math.round(point.y));

            if (!this.lastPoint) {
                if (core.isNear(point, START, 5)) this.lastPoint = { ...point };
                return null;
            }

            const travelled = core.distance(this.lastPoint, point);
            if (travelled <= core.EPSILON) return null;
            this.energy = Math.max(0, this.energy - travelled * COST_PER_UNIT);
            if (this.energy <= core.EPSILON) {
                this.energy = 0;
                this.depleted = true;
            }
            if (
                this.movementLimitPoint &&
                core.isNear(point, this.movementLimitPoint, core.EPSILON * 2)
            ) {
                this.energy = 0;
                this.depleted = true;
                this.movementLimitPoint = null;
            }
            this.renderEnergy(this.energy);
            this.lastPoint = { ...point };
            return this.depleted ? { stop: true, reason: "PICO_ENERGY_DEPLETED" } : null;
        },

        getRunNotice() {
            if (!this.depleted) return "PICO hat noch Energie – prüfe das Ziel deines Direktflugs.";
            return this.directBeaconAttempted
                ? "PICO stoppt: Der direkte Weg zur Funkbase verbraucht die gesamte Energie."
                : "PICO stoppt: Die Energie ist leer, aber die Funkbase wurde nicht direkt angesteuert.";
        },

        validate() {
            const discoveryPassed = this.directBeaconAttempted && this.depleted;
            return discoveryResult(discoveryPassed);
        },

        onResult(result) {
            this.setDiscoveryVisible(Boolean(result.passed));
        },

        restoreCompletedState() {
            this.energy = 0;
            this.directBeaconAttempted = true;
            this.depleted = true;
            this.renderEnergy(0);
            this.setDiscoveryVisible(true);
        },

        getRestoredResult() {
            return discoveryResult(true);
        }
    };
})();
