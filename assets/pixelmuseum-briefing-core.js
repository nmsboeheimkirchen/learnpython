(() => {
    "use strict";

    const core = window.DroneMissionCore;
    if (!core) throw new Error("Der gemeinsame Drohnen-Missionskern fehlt.");

    const START = Object.freeze({ x: 260, y: -170 });
    const ACCESS_CARD = Object.freeze({ x: -230, y: 70 });
    const TEST_FRAGMENT = Object.freeze({ x: -70, y: -75 });
    const SEARCH_RADIUS = 16;
    const ACCESS_CARD_ITEM = "Zugangskarte";
    const TEST_FRAGMENT_ITEM = "Testfragment";
    const FAILURES = Object.freeze({
        ACCESS_CARD_REQUIRED: "ACCESS_CARD_REQUIRED",
        ALREADY_COLLECTED: "ALREADY_COLLECTED",
        PENDING_EXPIRED: "PENDING_EXPIRED",
        WRONG_PLACE: "WRONG_PLACE"
    });

    function countItem(items, item) {
        return Array.isArray(items)
            ? items.filter(entry => entry === item).length
            : 0;
    }

    function createState() {
        let current;
        let accessCardCollected;
        let testFragmentCollected;
        let collectedItems;
        let collectionOrder;
        let pendingFind;
        let searchAttempted;
        let searchFound;
        let lastSearchFailure;

        function reset() {
            current = { ...START };
            accessCardCollected = false;
            testFragmentCollected = false;
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
            if (!validPoint) return { pendingExpired: false };

            current = validPoint;
            const pendingExpired = Boolean(
                pendingFind && !core.isNear(validPoint, pendingFind.point, SEARCH_RADIUS)
            );
            if (pendingExpired) {
                pendingFind = null;
                lastSearchFailure = FAILURES.PENDING_EXPIRED;
            }
            return { pendingExpired };
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
                pendingFind = null;
                lastSearchFailure = FAILURES.WRONG_PLACE;
                return null;
            }

            recordFrame(validPoint);
            if (core.isNear(validPoint, ACCESS_CARD, SEARCH_RADIUS)) {
                if (accessCardCollected) {
                    pendingFind = null;
                    lastSearchFailure = FAILURES.ALREADY_COLLECTED;
                    return null;
                }
                return issueFind(ACCESS_CARD_ITEM, validPoint, inventory);
            }

            if (core.isNear(validPoint, TEST_FRAGMENT, SEARCH_RADIUS)) {
                if (!accessCardCollected) {
                    pendingFind = null;
                    lastSearchFailure = FAILURES.ACCESS_CARD_REQUIRED;
                    return null;
                }
                if (testFragmentCollected) {
                    pendingFind = null;
                    lastSearchFailure = FAILURES.ALREADY_COLLECTED;
                    return null;
                }
                return issueFind(TEST_FRAGMENT_ITEM, validPoint, inventory);
            }

            pendingFind = null;
            lastSearchFailure = FAILURES.WRONG_PLACE;
            return null;
        }

        function syncInventory(inventory) {
            if (!pendingFind) return false;
            const currentCount = countItem(inventory, pendingFind.item);
            if (currentCount <= pendingFind.baselineCount) return false;

            const item = pendingFind.item;
            pendingFind = null;
            if (item === ACCESS_CARD_ITEM) {
                if (accessCardCollected) return false;
                accessCardCollected = true;
            } else if (item === TEST_FRAGMENT_ITEM) {
                if (!accessCardCollected || testFragmentCollected) return false;
                testFragmentCollected = true;
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
                accessCardCollected,
                testFragmentCollected,
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
        ACCESS_CARD,
        ACCESS_CARD_ITEM,
        FAILURES,
        SEARCH_RADIUS,
        START,
        TEST_FRAGMENT,
        TEST_FRAGMENT_ITEM,
        createState
    });
})();
