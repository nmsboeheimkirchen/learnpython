(() => {
    "use strict";

    const TARGET_RADIUS = 22;
    const LEVEL_CONFIGS = Object.freeze({
        agent_training_level1: Object.freeze({
            id: "agent_training_level1",
            targets: Object.freeze([
                Object.freeze({ id: "signal", x: 160, y: 80 })
            ]),
            checkLabels: Object.freeze([
                "Ziel mit sichtbarer Spur erreicht",
                "Punkt direkt am Ziel markiert",
                "Aktuelle Position mit print() ausgegeben"
            ]),
            successTitle: "Signalpunkt kalibriert",
            successMessage: "Signalpunkt kalibriert. Deine Drohne ist bereit für das nächste Level.",
            stageMessage: "SIGNALPUNKT KALIBRIERT",
            unlockId: "link-agent-training-l2"
        }),
        agent_training_level2: Object.freeze({
            id: "agent_training_level2",
            targets: Object.freeze([
                Object.freeze({ id: "alpha", x: -160, y: 40 }),
                Object.freeze({ id: "beta", x: 80, y: 130 })
            ]),
            checkLabels: Object.freeze([
                "Eigene Funktion bewegt die Drohne",
                "Eigene Funktion setzt Markierungen",
                "Beide Signalpunkte erreicht und markiert"
            ]),
            successTitle: "Drohnenfunktionen einsatzbereit",
            successMessage: "Beide eigenen Funktionen funktionieren. Du kannst Routen nun kurz und lesbar bauen.",
            stageMessage: "BEIDE SIGNALE MARKIERT",
            unlockId: "link-agent-training-l3"
        }),
        agent_training_level3: Object.freeze({
            id: "agent_training_level3",
            targets: Object.freeze([
                Object.freeze({ id: "datachip", x: -210, y: -65, item: "Datenchip" })
            ]),
            checkLabels: Object.freeze([
                "Datenchip am Fundort gefunden",
                "Gefundenes Ergebnis mit print() ausgegeben",
                "Genau diesen Fund ins Inventar aufgenommen",
                "Fund direkt ins Inventar aufnehmen"
            ]),
            successTitle: "Fundstück gesichert",
            successMessage: "Dein Datenchip stammt aus einer Suche und liegt nachweislich im Inventar.",
            stageMessage: "DATENCHIP GESICHERT",
            unlockId: null
        })
    });

    const TARGET = LEVEL_CONFIGS.agent_training_level1.targets[0];

    function getLevelConfig(levelId) {
        return LEVEL_CONFIGS[levelId] || LEVEL_CONFIGS.agent_training_level1;
    }

    function finitePoint(point) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    }

    function distance(point, target) {
        const validPoint = finitePoint(point);
        if (!validPoint || !target) return Number.POSITIVE_INFINITY;
        return Math.hypot(validPoint.x - target.x, validPoint.y - target.y);
    }

    function distanceToTarget(point) {
        return distance(point, TARGET);
    }

    function isAtTarget(point, target = TARGET) {
        return distance(point, target) <= TARGET_RADIUS;
    }

    function addUnique(list, value) {
        if (!list.includes(value)) list.push(value);
    }

    function createState(levelId = "agent_training_level1") {
        return {
            levelId: getLevelConfig(levelId).id,
            current: { x: 0, y: 0 },
            visitedTarget: false,
            visitedTargetWithTrail: false,
            trailClosedAfterTarget: false,
            markedAtTarget: false,
            visitedTargetIds: [],
            trailTargetIds: [],
            markedTargetIds: [],
            marks: [],
            searches: [],
            foundItem: null,
            collectedRealFind: false
        };
    }

    function recordPosition(state, point, options = {}) {
        const validPoint = finitePoint(point);
        if (!state || !validPoint) return false;

        state.current = validPoint;
        const config = getLevelConfig(state.levelId);
        config.targets.forEach(target => {
            if (!isAtTarget(validPoint, target)) return;
            addUnique(state.visitedTargetIds, target.id);
            if (options.trailDown) addUnique(state.trailTargetIds, target.id);
        });
        state.visitedTarget = state.visitedTargetIds.includes(config.targets[0]?.id);
        state.visitedTargetWithTrail = state.trailTargetIds.includes(config.targets[0]?.id);
        if (!options.trailDown && state.visitedTargetWithTrail) {
            state.trailClosedAfterTarget = true;
        }
        return true;
    }

    function recordMark(state, point) {
        const validPoint = finitePoint(point);
        if (!state || !validPoint) return false;

        state.marks.push(validPoint);
        const config = getLevelConfig(state.levelId);
        config.targets.forEach(target => {
            if (isAtTarget(validPoint, target)) addUnique(state.markedTargetIds, target.id);
        });
        state.markedAtTarget = state.markedTargetIds.includes(config.targets[0]?.id);
        return true;
    }

    function searchHere(state, point) {
        const validPoint = finitePoint(point);
        if (!state || !validPoint) return null;

        recordPosition(state, validPoint);
        const target = getLevelConfig(state.levelId).targets.find(candidate =>
            candidate.item && isAtTarget(validPoint, candidate)
        );
        const item = target?.item || null;
        state.searches.push({ point: validPoint, item });
        if (item) state.foundItem = item;
        return item;
    }

    function recordCollection(state, collectedRealFind) {
        if (!state) return false;
        state.collectedRealFind = Boolean(collectedRealFind);
        return true;
    }

    function outputContainsTargetPosition(output) {
        return String(output).split(/\r?\n/).some(line => {
            const numbers = [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
            for (let index = 0; index < numbers.length - 1; index += 1) {
                if (
                    Math.abs(numbers[index] - TARGET.x) <= 0.5 &&
                    Math.abs(numbers[index + 1] - TARGET.y) <= 0.5
                ) {
                    return true;
                }
            }
            return false;
        });
    }

    function outputContainsFoundItem(output, item = "Datenchip") {
        return String(output).split(/\r?\n/).some(line => line.includes(item));
    }

    function formatPoint(point) {
        const validPoint = finitePoint(point) || { x: 0, y: 0 };
        return `(${Math.round(validPoint.x)}, ${Math.round(validPoint.y)})`;
    }

    function structureEvidence(structure, name) {
        if (structure === true) return true;
        return Boolean(structure?.evidence?.[name]);
    }

    function validateLevel1(state, output, structure) {
        const config = getLevelConfig(state?.levelId);
        const reachedWithTrail = Boolean(state?.visitedTargetWithTrail) &&
            Boolean(state?.trailClosedAfterTarget) &&
            structureEvidence(structure, "usesTrailControls");
        const checks = [
            { label: config.checkLabels[0], passed: reachedWithTrail },
            { label: config.checkLabels[1], passed: Boolean(state?.markedAtTarget) },
            {
                label: config.checkLabels[2],
                passed: structureEvidence(structure, "printsRealPosition") && outputContainsTargetPosition(output)
            }
        ];
        let message = config.successMessage;
        if (!state?.visitedTarget) {
            message = `Deine Drohne steht bei ${formatPoint(state?.current)}. Das Ziel liegt bei (${TARGET.x}, ${TARGET.y}).`;
        } else if (
            !state?.visitedTargetWithTrail ||
            !state?.trailClosedAfterTarget ||
            !structureEvidence(structure, "usesTrailControls")
        ) {
            message = "Das Ziel ist erreicht. Schalte vor goto() mit pendown() die Spur ein und danach mit penup() wieder aus.";
        } else if (!checks[1].passed) {
            message = "Ziel erreicht – markiere genau diesen Ort jetzt mit drohne.dot(...).";
        } else if (!checks[2].passed) {
            message = "Die Markierung sitzt. Gib nun die aktuelle Position mit print(\"Position:\", drohne.position()) aus.";
        }
        return { passed: checks.every(check => check.passed), checks, message };
    }

    function validateLevel2(state, structure) {
        const config = getLevelConfig(state?.levelId);
        const reachedAny = Boolean(state?.visitedTargetIds?.length);
        const markedAny = Boolean(state?.markedTargetIds?.length);
        const reachedAll = config.targets.every(target => state?.visitedTargetIds?.includes(target.id));
        const markedAll = config.targets.every(target => state?.markedTargetIds?.includes(target.id));
        const checks = [
            {
                label: config.checkLabels[0],
                passed: structureEvidence(structure, "movementFunction") && reachedAny
            },
            {
                label: config.checkLabels[1],
                passed: structureEvidence(structure, "markerFunction") && markedAny
            },
            { label: config.checkLabels[2], passed: reachedAll && markedAll }
        ];
        let message = config.successMessage;
        if (!checks[0].passed) {
            message = "Rufe gehe_zu(x, y) für beide Signalpunkte auf. Die Funktion steuert die Drohne mit goto().";
        } else if (!checks[1].passed) {
            message = "Ersetze pass in markiere() eingerückt durch drohne.dot(30, \"#7df2a9\").";
        } else if (!checks[2].passed) {
            const missing = config.targets.find(target =>
                !state.visitedTargetIds.includes(target.id) || !state.markedTargetIds.includes(target.id)
            );
            message = `Der Signalpunkt ${formatPoint(missing)} fehlt noch. Rufe beide eigenen Funktionen dort auf.`;
        }
        return { passed: checks.every(check => check.passed), checks, message };
    }

    function validateLevel3(state, output, structure, options = {}) {
        const config = getLevelConfig(state?.levelId);
        const phase = options.level3Phase === "direct" ? "direct" : "guarded";
        const searchedCorrectly = state?.foundItem === "Datenchip" &&
            structureEvidence(structure, "searchAssignment");
        const printedRealVariable = outputContainsFoundItem(output) &&
            structureEvidence(structure, "printsFund");
        const collectedRealFind = Boolean(state?.collectedRealFind);
        const collectedWithGuard = collectedRealFind &&
            structureEvidence(structure, "guardedAppend") &&
            !structureEvidence(structure, "directAppend");
        const collectedDirectly = collectedRealFind &&
            structureEvidence(structure, "directAppend") &&
            !structureEvidence(structure, "hasFundGuard");
        const checks = [
            { label: config.checkLabels[0], passed: searchedCorrectly },
            { label: config.checkLabels[1], passed: printedRealVariable },
            {
                label: config.checkLabels[2],
                passed: phase === "direct" ? true : collectedWithGuard
            },
            { label: config.checkLabels[3], passed: phase === "direct" && collectedDirectly }
        ];
        const phaseComplete = phase === "guarded" && checks.slice(0, 3).every(check => check.passed);
        const passed = phase === "direct" && checks.every(check => check.passed);
        let message = config.successMessage;
        if (!checks[0].passed) {
            message = "Suche am markierten Fundort und speichere den Rückgabewert in fund.";
        } else if (!checks[1].passed) {
            message = "Der Datenchip wurde gefunden. Untersuche fund jetzt mit print(fund).";
        } else if (phase === "guarded" && !checks[2].passed) {
            message = "Gefunden, aber noch nicht gesichert: Prüfe fund mit if und hänge genau fund an inventar an.";
        } else if (phaseComplete) {
            message = "Am richtigen Fundort kannst du auch ohne „if“ den Fund ins Inventar aufnehmen.";
        } else if (!checks[3].passed) {
            message = "Entferne die if-Prüfung und rücke inventar.append(fund) ganz nach links.";
        }
        return { passed, checks, message, phase, phaseComplete };
    }

    function validate(state, output = "", structure = true, options = {}) {
        if (state?.levelId === "agent_training_level2") return validateLevel2(state, structure);
        if (state?.levelId === "agent_training_level3") {
            return validateLevel3(state, output, structure, options);
        }
        return validateLevel1(state, output, structure);
    }

    function initialResult(
        levelId,
        message = "Starte deinen Code. Die Prüfung beobachtet den ausgeführten Drohnenweg.",
        options = {}
    ) {
        const config = getLevelConfig(levelId);
        const directPhase = levelId === "agent_training_level3" && options.level3Phase === "direct";
        return {
            passed: false,
            message,
            checks: config.checkLabels.map((label, index) => ({
                label,
                passed: directPhase && index === 2
            }))
        };
    }

    window.AgentTrainingCore = Object.freeze({
        LEVEL_CONFIGS,
        TARGET,
        TARGET_RADIUS,
        createState,
        distanceToTarget,
        formatPoint,
        getLevelConfig,
        initialResult,
        isAtTarget,
        outputContainsFoundItem,
        outputContainsTargetPosition,
        recordCollection,
        recordMark,
        recordPosition,
        searchHere,
        validate
    });
})();
