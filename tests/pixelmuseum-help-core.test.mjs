import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadHelpCore() {
    const window = {};
    const context = vm.createContext({
        Array,
        Boolean,
        JSON,
        Math,
        Number,
        Object,
        String,
        window
    });
    vm.runInContext(
        readFileSync(new URL("../assets/pixelmuseum-help-core.js", import.meta.url), "utf8"),
        context
    );
    return window.PixelmuseumHelpCore;
}

const completedRun = Object.freeze({
    hasRun: true,
    runtimeInventory: ["Schlüsselkarte", "Sternenfragment"],
    artifactSecured: true,
    escaped: true,
    inventoryOutputPassed: true
});

test("Pixelmuseum help routes the most specific current runtime blocker", () => {
    const help = loadHelpCore();
    const cases = [
        [{ ...completedRun, running: true }, "WAIT_FOR_RUN"],
        [{ hasRun: false, dirty: true, pythonError: "SyntaxError" }, "RUN_FIRST"],
        [{ ...completedRun, dirty: true, pythonError: "SyntaxError" }, "RUN_AGAIN"],
        [{ ...completedRun, editorRevision: 3, runRevision: 2 }, "RUN_AGAIN"],
        [{ hasRun: true, runtimeInventory: [], pythonError: "NameError: name 'suche_hier' is not defined on line 20" }, "SEARCH_NEEDS_DRONE"],
        [{ hasRun: true, runtimeInventory: [], pythonError: "NameError: name 'fund' is not defined on line 21" }, "FUND_NOT_STORED"],
        [{ hasRun: true, runtimeInventory: [], pythonError: "NameError: name 'liste' is not defined on line 26" }, "INVENTORY_PARAMETER"],
        [{ hasRun: true, runtimeInventory: [], pendingItem: "Schlüsselkarte", searchFound: true }, "FUND_NOT_STORED"],
        [{ hasRun: true, runtimeInventory: [], pythonError: "SyntaxError: bad input" }, "PYTHON_ERROR"],
        [{ hasRun: true, runtimeInventory: [], lastSearchFailure: "KEYCARD_REQUIRED" }, "KEYCARD_ORDER"],
        [{ hasRun: true, runtimeInventory: [], orderFailure: true }, "KEYCARD_ORDER"],
        [{ hasRun: true, runtimeInventory: [] }, "KEYCARD_MISSING"],
        [{ hasRun: true, runtimeInventory: ["Schlüsselkarte"] }, "ARTIFACT_MISSING"],
        [{ ...completedRun, stage: "briefing", escaped: false, inventoryOutputPassed: false }, "INVENTORY_OUTPUT"],
        [{ ...completedRun, stage: "briefing", escaped: false }, "COMPLETE"],
        [{ ...completedRun, escaped: false, lastHackFailure: "TOO_EARLY" }, "HACK_TOO_EARLY"],
        [{ ...completedRun, escaped: false, lastHackFailure: "WRONG_PLACE" }, "HACK_WRONG_PLACE"],
        [{ ...completedRun, escaped: false, lastHackFailure: "WRONG_CODE" }, "HACK_WRONG_CODE"],
        [{ ...completedRun, escaped: false, lastHackFailure: "TOO_LATE" }, "HACK_TOO_LATE"],
        [{ ...completedRun, escaped: false, portalReached: true, portalOpen: false }, "PORTAL_LOCKED"],
        [{ ...completedRun, escaped: false, alarmFailed: true }, "ALARM_TOO_SLOW"],
        [{ ...completedRun, escaped: false, alarmFailed: true, hackRequested: true }, "HACK_TOO_LATE"],
        [{ ...completedRun, escaped: false, alarmDisabled: false }, "ALARM_STRATEGY"],
        [{ ...completedRun, escaped: false, alarmDisabled: true }, "PORTAL_NOT_REACHED"],
        [{ ...completedRun, inventoryOutputPassed: false }, "INVENTORY_OUTPUT"],
        [completedRun, "COMPLETE"]
    ];

    for (const [context, expectedId] of cases) {
        const issue = help.resolveIssue(context);
        assert.equal(issue.id, expectedId, JSON.stringify(context));
        assert.equal(issue.levels.length, 3, `${expectedId} braucht drei Hilfestufen`);
    }
});

test("Pixelmuseum help gives the exact function and return-value hints", () => {
    const help = loadHelpCore();

    const searchIssue = help.resolveIssue({
        hasRun: true,
        pythonError: "NameError: name 'suche_hier' is not defined on line 24"
    });
    assert.equal(searchIssue.id, "SEARCH_NEEDS_DRONE");
    assert.match(searchIssue.levels[1], /drohne\.suche_hier\(\)/);
    assert.match(searchIssue.levels[2], /fund = drohne\.suche_hier\(\)/);

    const fundIssue = help.resolveIssue({
        hasRun: true,
        pythonError: "NameError: name 'fund' is not defined on line 25"
    });
    assert.equal(fundIssue.id, "FUND_NOT_STORED");
    assert.match(fundIssue.levels[1], /fund = drohne\.suche_hier\(\)/);

    const parameterIssue = help.resolveIssue({
        hasRun: true,
        pythonError: "NameError: name 'liste' is not defined on line 26"
    });
    assert.equal(parameterIssue.id, "INVENTORY_PARAMETER");
    assert.match(parameterIssue.levels[0], /nur der Parametername/);
    assert.match(parameterIssue.levels[2], /melde_inventar\(inventar\)/);

    const outputIssue = help.resolveIssue({
        ...completedRun,
        stage: "briefing",
        escaped: false,
        inventoryOutputPassed: false
    });
    assert.equal(outputIssue.id, "INVENTORY_OUTPUT");
    assert.match(outputIssue.levels[0], /melde_inventar\(liste\)/);
    assert.equal(outputIssue.levels[1], "Schau dir die Funktion melde_inventar an und setze sie ein!");
    assert.match(outputIssue.levels[2], /melde_inventar\(inventar\)/);
});

test("Pixelmuseum help does not hide an exact failure behind a generic later hint", () => {
    const help = loadHelpCore();

    const pythonIssue = help.resolveIssue({
        hasRun: true,
        runtimeInventory: [],
        pythonError: "SyntaxError",
        lastHackFailure: "WRONG_CODE"
    });
    assert.equal(pythonIssue.id, "PYTHON_ERROR");
    assert.match(pythonIssue.detail, /SyntaxError/);

    const hackIssue = help.resolveIssue({
        ...completedRun,
        escaped: false,
        inventoryOutputPassed: false,
        lastHackFailure: "WRONG_CODE"
    });
    assert.equal(hackIssue.id, "HACK_WRONG_CODE");

    const staleIssue = help.resolveIssue({
        ...completedRun,
        dirty: true,
        lastHackFailure: "WRONG_CODE"
    });
    assert.equal(staleIssue.id, "RUN_AGAIN");
    assert.equal(staleIssue.countable, false);

    const successfulSprintWithOldHackFailure = help.resolveIssue({
        ...completedRun,
        inventoryOutputPassed: false,
        lastHackFailure: "WRONG_CODE"
    });
    assert.equal(successfulSprintWithOldHackFailure.id, "INVENTORY_OUTPUT");
});

test("Pixelmuseum help counts only newly revealed levels up to level three", () => {
    const help = loadHelpCore();
    let progress = help.normalizeProgress(null);

    assert.deepEqual({ ...progress, levels: { ...progress.levels } }, {
        version: 1,
        count: 0,
        levels: {}
    });

    for (let expectedLevel = 1; expectedLevel <= 3; expectedLevel += 1) {
        const result = help.reveal(progress, "KEYCARD_MISSING");
        assert.equal(result.level, expectedLevel);
        assert.equal(result.counted, true);
        assert.equal(result.progress.count, expectedLevel);
        assert.equal(result.hint, result.issue.levels[expectedLevel - 1]);
        progress = result.progress;
    }

    const repeatedMaximum = help.reveal(progress, "KEYCARD_MISSING");
    assert.equal(repeatedMaximum.level, 3);
    assert.equal(repeatedMaximum.counted, false);
    assert.equal(repeatedMaximum.progress.count, 3);

    const differentIssue = help.reveal(repeatedMaximum.progress, "HACK_WRONG_CODE");
    assert.equal(differentIssue.level, 1);
    assert.equal(differentIssue.counted, true);
    assert.equal(differentIssue.progress.count, 4);
});

test("system guidance never increases the help counter", () => {
    const help = loadHelpCore();
    const initial = help.normalizeProgress({
        levels: { KEYCARD_MISSING: 2 }
    });

    for (const issueId of ["WAIT_FOR_RUN", "RUN_FIRST", "RUN_AGAIN", "COMPLETE"]) {
        const result = help.reveal(initial, issueId);
        assert.equal(result.issue.countable, false);
        assert.equal(result.counted, false);
        assert.equal(result.progress.count, 2);
        assert.deepEqual({ ...result.progress.levels }, { KEYCARD_MISSING: 2 });
    }
});

test("stored Pixelmuseum help progress is normalized without trusting corrupt counts", () => {
    const help = loadHelpCore();
    const normalized = help.normalizeProgress(JSON.stringify({
        version: 99,
        count: 999,
        levels: {
            KEYCARD_MISSING: 2.9,
            HACK_WRONG_CODE: 17,
            RUN_FIRST: 3,
            UNKNOWN_TOPIC: 3,
            ARTIFACT_MISSING: -4
        }
    }));

    assert.deepEqual({ ...normalized, levels: { ...normalized.levels } }, {
        version: 1,
        count: 5,
        levels: {
            KEYCARD_MISSING: 2,
            HACK_WRONG_CODE: 3
        }
    });

    const invalid = help.normalizeProgress("{not-json");
    assert.deepEqual({ ...invalid, levels: { ...invalid.levels } }, {
        version: 1,
        count: 0,
        levels: {}
    });

    const unknown = help.reveal(normalized, "DOES_NOT_EXIST");
    assert.equal(unknown.issue, null);
    assert.equal(unknown.counted, false);
    assert.equal(unknown.progress.count, 5);
});
