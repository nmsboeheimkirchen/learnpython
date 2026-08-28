(() => {
    "use strict";

    const core = window.DroneMissionCore;
    if (!core) throw new Error("Der gemeinsame Drohnen-Missionskern fehlt.");

    const START = Object.freeze({ x: 260, y: -170 });
    const KEYCARD = Object.freeze({ x: -230, y: 70 });
    const STAR_FRAGMENT = Object.freeze({ x: -70, y: -75 });
    const SEARCH_RADIUS = 16;
    const KEYCARD_ITEM = "Schlüsselkarte";
    const STAR_FRAGMENT_ITEM = "Sternenfragment";
    const FAILURES = Object.freeze({
        KEYCARD_REQUIRED: "KEYCARD_REQUIRED",
        ALREADY_COLLECTED: "ALREADY_COLLECTED",
        WRONG_PLACE: "WRONG_PLACE"
    });

    function countItem(items, item) {
        return Array.isArray(items)
            ? items.filter(entry => entry === item).length
            : 0;
    }

    function createState() {
        let current;
        let keycardCollected;
        let starFragmentCollected;
        let collectedItems;
        let collectionOrder;
        let pendingFind;
        let searchAttempted;
        let searchFound;
        let lastSearchFailure;

        function reset() {
            current = { ...START };
            keycardCollected = false;
            starFragmentCollected = false;
            collectedItems = [];
            collectionOrder = [];
            pendingFind = null;
            searchAttempted = false;
            searchFound = false;
            lastSearchFailure = null;
            return snapshot();
        }

        function recordFrame(point) {
            const validPoint = core.finitePoint(point);
            if (!validPoint) return { moved: false };

            current = validPoint;
            return { moved: true };
        }

        function issueFind(item, point, inventory) {
            pendingFind = {
                item,
                point: { ...point },
                baselineCount: countItem(inventory, item)
            };
            searchFound = true;
            lastSearchFailure = null;
            return item;
        }

        function searchHere(point, inventory) {
            searchAttempted = true;
            const validPoint = core.finitePoint(point);
            if (!validPoint) {
                lastSearchFailure = FAILURES.WRONG_PLACE;
                return null;
            }

            recordFrame(validPoint);
            if (core.isNear(validPoint, KEYCARD, SEARCH_RADIUS)) {
                if (keycardCollected) {
                    lastSearchFailure = FAILURES.ALREADY_COLLECTED;
                    return null;
                }
                return issueFind(KEYCARD_ITEM, validPoint, inventory);
            }

            if (core.isNear(validPoint, STAR_FRAGMENT, SEARCH_RADIUS)) {
                if (!keycardCollected) {
                    lastSearchFailure = FAILURES.KEYCARD_REQUIRED;
                    return null;
                }
                if (starFragmentCollected) {
                    lastSearchFailure = FAILURES.ALREADY_COLLECTED;
                    return null;
                }
                return issueFind(STAR_FRAGMENT_ITEM, validPoint, inventory);
            }

            lastSearchFailure = FAILURES.WRONG_PLACE;
            return null;
        }

        function syncInventory(inventory) {
            if (!pendingFind) return false;
            const currentCount = countItem(inventory, pendingFind.item);
            if (currentCount <= pendingFind.baselineCount) return false;

            const item = pendingFind.item;
            pendingFind = null;
            if (item === KEYCARD_ITEM) {
                if (keycardCollected) return false;
                keycardCollected = true;
            } else if (item === STAR_FRAGMENT_ITEM) {
                if (!keycardCollected || starFragmentCollected) return false;
                starFragmentCollected = true;
            } else {
                return false;
            }

            collectedItems.push(item);
            collectionOrder.push(item);
            lastSearchFailure = null;
            return true;
        }

        function snapshot() {
            return {
                current: { ...current },
                keycardCollected,
                starFragmentCollected,
                collectedItems: [...collectedItems],
                collectionOrder: [...collectionOrder],
                pendingItem: pendingFind?.item ?? null,
                searchAttempted,
                searchFound,
                lastSearchFailure
            };
        }

        reset();
        return Object.freeze({
            recordFrame,
            reset,
            searchHere,
            snapshot,
            syncInventory
        });
    }

    window.PixelmuseumBriefingCore = Object.freeze({
        FAILURES,
        KEYCARD,
        KEYCARD_ITEM,
        SEARCH_RADIUS,
        START,
        STAR_FRAGMENT,
        STAR_FRAGMENT_ITEM,
        createState
    });
})();
