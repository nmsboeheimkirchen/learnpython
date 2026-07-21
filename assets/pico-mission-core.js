(() => {
    "use strict";

    const core = window.DroneMissionCore;
    if (!core) throw new Error("Der gemeinsame Drohnen-Missionskern fehlt.");

    const START = Object.freeze({ x: -365, y: 55 });
    const ENERGY_CELL = Object.freeze({ x: -380, y: -90 });
    const BEACON = Object.freeze({ x: 340, y: 15 });
    const START_ENERGY = 10;
    const FULL_ENERGY = 100;
    const CELL_RADIUS = 16;
    const BEACON_RADIUS = 45;
    const UNCHARGED_COST_PER_UNIT = START_ENERGY / core.distance(START, ENERGY_CELL);
    const CHARGED_COST_PER_UNIT = 1 / 8.2;
    const ENERGY_ITEM = "Energiezelle";

    function countItem(items, item) {
        return Array.isArray(items) ? items.filter(entry => entry === item).length : 0;
    }

    function cleanStatusValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function createState() {
        let energy;
        let charged;
        let depleted;
        let lastPoint;
        let movementLimitPoint;
        let visitedCell;
        let beaconReached;
        let directBeaconAttempted;
        let searchAttempted;
        let searchFound;
        let pendingFind;
        let signalAttempted;
        let signalSent;
        let lastSignalFailure;
        let droneName;
        let transponder;
        let droneNameHistory;
        let transponderHistory;
        let statusEvents;
        let eventSequence;
        let successfulSignalSequence;

        function reset() {
            energy = START_ENERGY;
            charged = false;
            depleted = false;
            lastPoint = null;
            movementLimitPoint = null;
            visitedCell = false;
            beaconReached = false;
            directBeaconAttempted = false;
            searchAttempted = false;
            searchFound = false;
            pendingFind = null;
            signalAttempted = false;
            signalSent = false;
            lastSignalFailure = null;
            droneName = "";
            transponder = "";
            droneNameHistory = new Set();
            transponderHistory = new Set();
            statusEvents = [];
            eventSequence = 0;
            successfulSignalSequence = null;
        }

        function recordStatusChange(key, previousValue, nextValue) {
            if (previousValue === nextValue) return;
            eventSequence += 1;
            statusEvents.push({ key, value: nextValue, sequence: eventSequence });
        }

        function recordStatus(status) {
            if (!status || typeof status !== "object" || Array.isArray(status)) {
                recordStatusChange("DROHNE", droneName, "");
                recordStatusChange("TRANSPONDER", transponder, "");
                droneName = "";
                transponder = "";
                return snapshot();
            }

            const nextDroneName = cleanStatusValue(status.DROHNE);
            const nextTransponder = cleanStatusValue(status.TRANSPONDER);
            recordStatusChange("DROHNE", droneName, nextDroneName);
            recordStatusChange("TRANSPONDER", transponder, nextTransponder);
            droneName = nextDroneName;
            transponder = nextTransponder;
            if (droneName) droneNameHistory.add(droneName);
            if (transponder) transponderHistory.add(transponder);
            return snapshot();
        }

        function limitMovement(start, target) {
            if (core.isNear(target, BEACON, BEACON_RADIUS)) directBeaconAttempted = true;
            if (!lastPoint || depleted) return null;

            const movement = core.clampMovementByBudget(
                start,
                target,
                energy,
                charged ? CHARGED_COST_PER_UNIT : UNCHARGED_COST_PER_UNIT
            );
            if (!movement || !movement.stopped) return null;
            movementLimitPoint = { ...movement.point };
            return { ...movement.point, stop: true };
        }

        function recordFrame(point) {
            const validPoint = core.finitePoint(point);
            if (!validPoint) return { stop: depleted };

            if (core.isNear(validPoint, ENERGY_CELL, CELL_RADIUS)) visitedCell = true;
            if (core.isNear(validPoint, BEACON, BEACON_RADIUS)) beaconReached = true;
            if (pendingFind && !core.isNear(validPoint, pendingFind, CELL_RADIUS)) pendingFind = null;

            if (!lastPoint) {
                if (core.isNear(validPoint, START, 5)) lastPoint = validPoint;
                return { stop: false };
            }

            const travelled = core.distance(lastPoint, validPoint);
            if (travelled <= core.EPSILON) return { stop: depleted };
            const costPerUnit = charged ? CHARGED_COST_PER_UNIT : UNCHARGED_COST_PER_UNIT;
            energy = Math.max(0, energy - travelled * costPerUnit);
            if (energy <= core.EPSILON) {
                energy = 0;
                depleted = true;
            }
            if (
                movementLimitPoint &&
                core.isNear(validPoint, movementLimitPoint, 0.02)
            ) {
                energy = 0;
                depleted = true;
                movementLimitPoint = null;
            }
            lastPoint = validPoint;
            return { stop: depleted, reason: depleted ? "PICO_ENERGY_DEPLETED" : null };
        }

        function searchHere(point, equipment) {
            searchAttempted = true;
            const validPoint = core.finitePoint(point);
            if (!validPoint || !core.isNear(validPoint, ENERGY_CELL, CELL_RADIUS)) {
                pendingFind = null;
                return null;
            }

            visitedCell = true;
            searchFound = true;
            if (!charged) {
                pendingFind = {
                    ...validPoint,
                    item: ENERGY_ITEM,
                    baselineCount: countItem(equipment, ENERGY_ITEM)
                };
            }
            return ENERGY_ITEM;
        }

        function syncEquipment(equipment) {
            if (!pendingFind || charged) return false;
            const currentCount = countItem(equipment, pendingFind.item);
            if (currentCount <= pendingFind.baselineCount) return false;

            charged = true;
            depleted = false;
            energy = FULL_ENERGY;
            pendingFind = null;
            movementLimitPoint = null;
            return true;
        }

        function send(point) {
            signalAttempted = true;
            eventSequence += 1;
            const atBeacon = core.isNear(point, BEACON, BEACON_RADIUS);
            if (atBeacon) beaconReached = true;
            const attemptSucceeded = Boolean(atBeacon && charged && !depleted && energy > 0);
            if (attemptSucceeded) {
                signalSent = true;
                if (successfulSignalSequence === null) successfulSignalSequence = eventSequence;
                lastSignalFailure = null;
            } else if (!signalSent) {
                lastSignalFailure = !atBeacon
                    ? "BEACON_OUT_OF_RANGE"
                    : (!charged ? "CELL_MISSING" : "ENERGY_EMPTY");
            }
            return attemptSucceeded;
        }

        function statusReachedAfterSignal(key, value) {
            if (!signalSent || successfulSignalSequence === null) return false;
            return statusEvents.some(event => (
                event.key === key &&
                event.value === value &&
                event.sequence > successfulSignalSequence
            ));
        }

        function memoryDeletedAfterSignal() {
            return Boolean(
                droneName === "self-destroy" &&
                transponder === "delete" &&
                statusReachedAfterSignal("DROHNE", "self-destroy") &&
                statusReachedAfterSignal("TRANSPONDER", "delete")
            );
        }

        function restore(checkpoint = {}) {
            reset();
            if (checkpoint.visitedCell) {
                visitedCell = true;
                lastPoint = { ...ENERGY_CELL };
                energy = 0;
                depleted = true;
            }
            if (checkpoint.charged) {
                visitedCell = true;
                lastPoint = { ...ENERGY_CELL };
                charged = true;
                depleted = false;
                energy = FULL_ENERGY;
                searchAttempted = true;
                searchFound = true;
            }
            if (checkpoint.beaconReached || checkpoint.signalSent) {
                visitedCell = true;
                charged = true;
                depleted = false;
                beaconReached = true;
                lastPoint = { ...BEACON };
                energy = 10;
            }
            if (checkpoint.signalSent) {
                signalAttempted = true;
                signalSent = true;
                eventSequence += 1;
                successfulSignalSequence = eventSequence;
            }
            if (checkpoint.status) recordStatus(checkpoint.status);
            return snapshot();
        }

        function snapshot() {
            return {
                energy,
                charged,
                depleted,
                current: lastPoint ? { ...lastPoint } : { ...START },
                visitedCell,
                beaconReached,
                directBeaconAttempted,
                searchAttempted,
                searchFound,
                signalAttempted,
                signalSent,
                lastSignalFailure,
                droneName,
                transponder,
                droneNameHistory: [...droneNameHistory],
                transponderHistory: [...transponderHistory],
                statusEvents: statusEvents.map(event => ({ ...event })),
                successfulSignalSequence,
                memoryDeletedAfterSignal: memoryDeletedAfterSignal()
            };
        }

        reset();
        return Object.freeze({
            limitMovement,
            recordFrame,
            recordStatus,
            reset,
            restore,
            searchHere,
            send,
            snapshot,
            statusReachedAfterSignal,
            syncEquipment
        });
    }

    window.PicoMissionCore = Object.freeze({
        BEACON,
        BEACON_RADIUS,
        CELL_RADIUS,
        ENERGY_CELL,
        ENERGY_ITEM,
        FULL_ENERGY,
        START,
        START_ENERGY,
        createState
    });
})();
