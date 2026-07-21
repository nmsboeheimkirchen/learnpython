(() => {
    "use strict";

    const EPSILON = 0.001;

    function finitePoint(point) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    }

    function distance(first, second) {
        const start = finitePoint(first);
        const end = finitePoint(second);
        if (!start || !end) return Number.POSITIVE_INFINITY;
        return Math.hypot(end.x - start.x, end.y - start.y);
    }

    function isNear(point, target, radius = 20) {
        const numericRadius = Number(radius);
        return Number.isFinite(numericRadius) && numericRadius >= 0 &&
            distance(point, target) <= numericRadius;
    }

    function clampMovementByBudget(start, target, budget, costPerUnit) {
        const from = finitePoint(start);
        const to = finitePoint(target);
        const availableBudget = Math.max(0, Number(budget) || 0);
        const unitCost = Number(costPerUnit);
        if (!from || !to || !Number.isFinite(unitCost) || unitCost <= 0) return null;

        const segmentDistance = distance(from, to);
        if (segmentDistance <= EPSILON) {
            return {
                point: to,
                distance: 0,
                spent: 0,
                remaining: availableBudget,
                stopped: false
            };
        }

        const affordableDistance = availableBudget / unitCost;
        if (segmentDistance <= affordableDistance + EPSILON) {
            const spent = Math.min(availableBudget, segmentDistance * unitCost);
            return {
                point: to,
                distance: segmentDistance,
                spent,
                remaining: Math.max(0, availableBudget - spent),
                stopped: false
            };
        }

        const ratio = Math.max(0, Math.min(1, affordableDistance / segmentDistance));
        return {
            point: {
                x: from.x + (to.x - from.x) * ratio,
                y: from.y + (to.y - from.y) * ratio
            },
            distance: affordableDistance,
            spent: availableBudget,
            remaining: 0,
            stopped: true
        };
    }

    function createTargetEvidence(targets = [], radius = 20) {
        const normalizedTargets = targets
            .map(target => ({ ...target, ...finitePoint(target) }))
            .filter(target => Number.isFinite(target.x) && Number.isFinite(target.y));
        const visited = new Set();
        const marked = new Set();

        function matchingIds(point) {
            return normalizedTargets
                .filter(target => isNear(point, target, target.radius ?? radius))
                .map(target => target.id);
        }

        return Object.freeze({
            recordVisit(point) {
                matchingIds(point).forEach(id => visited.add(id));
                return [...visited];
            },
            recordMark(point) {
                matchingIds(point).forEach(id => marked.add(id));
                return [...marked];
            },
            reset() {
                visited.clear();
                marked.clear();
            },
            snapshot() {
                return { visited: [...visited], marked: [...marked] };
            }
        });
    }

    function createProvenanceTracker() {
        const issued = new Set();
        const appendEvents = [];

        return Object.freeze({
            issue(token) {
                issued.add(token);
                return token;
            },
            recordAppend(list, token) {
                if (!issued.has(token)) return false;
                appendEvents.push({ list, token });
                return true;
            },
            wasCollected(list, token) {
                return issued.has(token) && appendEvents.some(event => (
                    event.list === list && event.token === token
                ));
            },
            reset() {
                issued.clear();
                appendEvents.length = 0;
            }
        });
    }

    window.DroneMissionCore = Object.freeze({
        EPSILON,
        clampMovementByBudget,
        createProvenanceTracker,
        createTargetEvidence,
        distance,
        finitePoint,
        isNear
    });
})();
