(() => {
    "use strict";

    const TARGET = Object.freeze({ x: 160, y: 80 });
    const TARGET_RADIUS = 22;

    function finitePoint(point) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    }

    function distanceToTarget(point) {
        const validPoint = finitePoint(point);
        if (!validPoint) return Number.POSITIVE_INFINITY;
        return Math.hypot(validPoint.x - TARGET.x, validPoint.y - TARGET.y);
    }

    function isAtTarget(point) {
        return distanceToTarget(point) <= TARGET_RADIUS;
    }

    function createState() {
        return {
            current: { x: 0, y: 0 },
            visitedTarget: false,
            markedAtTarget: false,
            marks: []
        };
    }

    function recordPosition(state, point) {
        const validPoint = finitePoint(point);
        if (!state || !validPoint) return false;
        state.current = validPoint;
        if (isAtTarget(validPoint)) state.visitedTarget = true;
        return true;
    }

    function recordMark(state, point) {
        const validPoint = finitePoint(point);
        if (!state || !validPoint) return false;
        state.marks.push(validPoint);
        if (isAtTarget(validPoint)) state.markedAtTarget = true;
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

    function formatPoint(point) {
        const validPoint = finitePoint(point) || { x: 0, y: 0 };
        return `(${Math.round(validPoint.x)}, ${Math.round(validPoint.y)})`;
    }

    function validate(state, output, structurePassed = true) {
        const checks = [
            { label: "Zielpunkt wirklich erreicht", passed: Boolean(state?.visitedTarget) },
            { label: "Punkt direkt am Ziel markiert", passed: Boolean(state?.markedAtTarget) },
            {
                label: "Echte Position mit print() ausgegeben",
                passed: Boolean(structurePassed) && outputContainsTargetPosition(output)
            }
        ];
        const passed = checks.every(check => check.passed);
        let message = "Signalpunkt kalibriert. Dein Agent ist bereit für den nächsten Trainingsschritt.";

        if (!checks[0].passed) {
            message = `Dein Agent steht bei ${formatPoint(state?.current)}. Das Ziel liegt bei (${TARGET.x}, ${TARGET.y}).`;
        } else if (!checks[1].passed) {
            message = "Ziel erreicht – markiere genau diesen Ort jetzt mit agent.dot(...).";
        } else if (!checks[2].passed) {
            message = "Die Markierung sitzt. Gib nun die echte Position mit print(\"Position:\", agent.position()) aus.";
        }

        return { passed, checks, message };
    }

    window.AgentTrainingCore = Object.freeze({
        TARGET,
        TARGET_RADIUS,
        createState,
        distanceToTarget,
        formatPoint,
        isAtTarget,
        outputContainsTargetPosition,
        recordMark,
        recordPosition,
        validate
    });
})();
