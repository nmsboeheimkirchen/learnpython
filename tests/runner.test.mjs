import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { TextDecoder } from "node:util";
import vm from "node:vm";

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
        this.listeners = new Map();
        this.style = {};
        this.classList = {
            add() {},
            contains() { return false; },
            remove() {}
        };
        this.textContent = "";
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type) {
        for (const listener of this.listeners.get(type) ?? []) {
            listener({ type, target: this });
        }
    }

    focus() {}
    querySelector() { return new FakeElement(); }
}

function createRunnerContext(initialStorage = {}) {
    const storage = new Map(Object.entries(initialStorage));
    const elements = new Map([
        ["console-output", new FakeElement()],
        ["progress-fill", new FakeElement()],
        ["status-text", new FakeElement()],
        ["run-btn", new FakeElement("button")]
    ]);

    const document = {
        addEventListener() {},
        body: new FakeElement("body"),
        createElement(tagName) { return new FakeElement(tagName); },
        createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
        getElementById(id) { return elements.get(id) ?? null; },
        querySelectorAll() { return []; }
    };

    const originalAppendChild = document.body.appendChild.bind(document.body);
    document.body.appendChild = (element) => {
        if (element.id) elements.set(element.id, element);
        return originalAppendChild(element);
    };

    const context = vm.createContext({
        Sk: {},
        confetti() {},
        document,
        localStorage: {
            getItem(key) { return storage.get(key) ?? null; },
            removeItem(key) { storage.delete(key); },
            setItem(key, value) { storage.set(key, String(value)); }
        },
        setInterval() { return 0; },
        setTimeout() { return 0; },
        window: {
            location: { hash: "", pathname: "/mission3_level3.html" }
        }
    });

    const source = readFileSync(new URL("../assets/runner.js", import.meta.url), "utf8");
    vm.runInContext(source, context);
    return { context, elements, storage };
}

function createAgentTrainingCore() {
    const window = {};
    const context = vm.createContext({ window });
    const source = readFileSync(new URL("../assets/agent-training-core.js", import.meta.url), "utf8");
    vm.runInContext(source, context);
    return window.AgentTrainingCore;
}

function createClassList() {
    const values = new Set();
    return {
        add(...names) { names.forEach(name => values.add(name)); },
        contains(name) { return values.has(name); },
        remove(...names) { names.forEach(name => values.delete(name)); },
        toggle(name, force) {
            const enabled = force === undefined ? !values.has(name) : Boolean(force);
            if (enabled) values.add(name);
            else values.delete(name);
            return enabled;
        }
    };
}

function createFinaleConfig(fileName) {
    const html = readFileSync(new URL(`../prototypes/${fileName}`, import.meta.url), "utf8");
    const code = html.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    const configScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(match => match[1])
        .find(source => source.includes("window.FINALE_CONFIG"));
    assert.ok(configScript, `Finale-Konfiguration fehlt: ${fileName}`);

    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) {
            elements.set(id, {
                appendChild() {},
                classList: createClassList(),
                dataset: {},
                innerHTML: "",
                setAttribute(name, value) { this[name] = String(value); },
                style: {},
                textContent: "",
                value: id === "python-editor" ? code : ""
            });
        }
        return elements.get(id);
    };
    if (fileName === "pixelmuseum_finale.html") {
        element("museum-system-log").dataset.alarmCode = "SERU-7";
    }

    const timers = [];
    const document = {
        body: { classList: createClassList() },
        createElement() { return { textContent: "" }; },
        getElementById(id) { return element(id); },
        querySelectorAll() { return []; }
    };
    const window = {
        clearInterval() {},
        clearTimeout() {},
        setInterval(callback, delay) {
            timers.push({ callback, delay, type: "interval" });
            return timers.length;
        },
        setTimeout(callback, delay) {
            timers.push({ callback, delay, type: "timeout" });
            return timers.length;
        }
    };
    const context = vm.createContext({ document, window });
    const analysisSource = readFileSync(new URL("../prototypes/finale-analysis.js", import.meta.url), "utf8");
    vm.runInContext(analysisSource, context);
    vm.runInContext(configScript, context);
    return { config: window.FINALE_CONFIG, document, elements, timers };
}

function createMuseumConfig() {
    return createFinaleConfig("pixelmuseum_finale.html");
}

function createPicoConfig() {
    return createFinaleConfig("pico_finale.html");
}

test("final success works without a next-level button", () => {
    const { context, elements } = createRunnerContext();

    vm.runInContext("triggerSuccess(true)", context);

    assert.equal(elements.get("success-overlay").style.display, "flex");
});

test("student output is appended as text instead of HTML", () => {
    const { context, elements } = createRunnerContext();
    const payload = '<img src=x onerror="alert(1)">';

    context.payload = payload;
    vm.runInContext('outf(payload)', context);

    const consoleOutput = elements.get("console-output");
    assert.equal(consoleOutput.children.length, 1);
    assert.equal(consoleOutput.children[0].nodeType, 3);
    assert.equal(consoleOutput.children[0].textContent, payload);
});

test("corrupted progress data falls back safely", () => {
    const { context, storage } = createRunnerContext({
        unlockedLevels_v2: "not valid JSON",
        completedLevelCode_v1: JSON.stringify({ mission1_level1: 'print("Alt")' }),
        cheatMode: "true"
    });

    const levels = vm.runInContext("readUnlockedLevels()", context);
    assert.deepEqual(JSON.parse(JSON.stringify(levels)), ["link-level1"]);
    assert.equal(storage.has("unlockedLevels_v2"), false);

    vm.runInContext("clearProgress()", context);
    assert.equal(storage.has("completedLevelCode_v1"), false);
    assert.equal(storage.has("cheatMode"), false);
});

test("progress data is normalized and unknown levels are ignored", () => {
    const { context, storage } = createRunnerContext({
        unlockedLevels_v2: JSON.stringify(["unknown-level", "link-level2", "link-level2", 42])
    });

    const levels = vm.runInContext("readUnlockedLevels()", context);
    assert.deepEqual(JSON.parse(JSON.stringify(levels)), ["link-level1", "link-level2"]);
    assert.equal(storage.get("unlockedLevels_v2"), JSON.stringify(["link-level1", "link-level2"]));

    assert.equal(vm.runInContext('unlockLevel("unknown-level")', context), false);
    assert.equal(vm.runInContext('unlockLevel("link-level3")', context), true);
    assert.equal(
        storage.get("unlockedLevels_v2"),
        JSON.stringify(["link-level1", "link-level2", "link-level3"])
    );
});

test("completed mission 4 restores the new Agent training unlock for existing learners", () => {
    const { context, storage } = createRunnerContext({
        unlockedLevels_v2: JSON.stringify(["link-level1", "link-m4-l3"]),
        completedLevelCode_v1: JSON.stringify({
            mission4_level3: '# Bereits bestanden\nprint("JHKHLP")'
        })
    });

    vm.runInContext("applyUnlocks()", context);

    const unlocked = JSON.parse(storage.get("unlockedLevels_v2"));
    assert.equal(unlocked.includes("link-agent-training-title"), true);
    assert.equal(unlocked.includes("link-agent-training-l1"), true);
});

test("completed Agent training steps restore the next unlocked step", () => {
    const { context, storage } = createRunnerContext({
        unlockedLevels_v2: JSON.stringify(["link-level1", "link-agent-training-l1"]),
        completedLevelCode_v1: JSON.stringify({
            agent_training_level1: "# Schritt 1 bestanden",
            agent_training_level2: "# Schritt 2 bestanden"
        })
    });

    vm.runInContext("applyUnlocks()", context);

    const unlocked = JSON.parse(storage.get("unlockedLevels_v2"));
    assert.equal(unlocked.includes("link-agent-training-l2"), true);
    assert.equal(unlocked.includes("link-agent-training-l3"), true);
});

test("the exact passing code is stored and restored per level", () => {
    const { context, storage } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({
            mission1_level1: 'print("Vorher")',
            unknown_level: "ignore me",
            mission2_level1: 42
        })
    });
    const passingCode = '# Mein bestandener Code\nprint("Grüße aus Böheimkirchen")\n';
    const editor = {
        value: "",
        setValue(value) { this.value = value; }
    };

    context.passingCode = passingCode;
    context.window.editor = editor;

    assert.equal(
        vm.runInContext('saveCompletedLevelCode("mission3_level2", passingCode)', context),
        true
    );
    assert.equal(
        vm.runInContext('getCompletedLevelCode("mission3_level2")', context),
        passingCode
    );
    assert.equal(
        vm.runInContext('restoreCompletedLevelCode("mission3_level2")', context),
        true
    );
    assert.equal(editor.value, passingCode);
    assert.equal(
        vm.runInContext('saveCompletedLevelCode("unknown_level", passingCode)', context),
        false
    );
    assert.deepEqual(JSON.parse(storage.get("completedLevelCode_v1")), {
        mission1_level1: 'print("Vorher")',
        mission3_level2: passingCode
    });
});

test("corrupted completed-code data is discarded safely", () => {
    const { context, storage } = createRunnerContext({
        completedLevelCode_v1: "not valid JSON"
    });

    assert.equal(vm.runInContext('getCompletedLevelCode("mission1_level1")', context), null);
    assert.equal(storage.has("completedLevelCode_v1"), false);
});

test("a level stores code through the normal success path", () => {
    const { context, elements, storage } = createRunnerContext();
    const passingCode = 'print("Verbindung wird hergestellt...")\n';

    context.passingCode = passingCode;
    context.runit = callback => callback(passingCode, "Verbindung wird hergestellt...\n");
    vm.runInContext('setupLevel("mission1_level1")', context);
    elements.get("run-btn").dispatch("click");

    assert.deepEqual(JSON.parse(storage.get("completedLevelCode_v1")), {
        mission1_level1: passingCode
    });
});

test("mission 4 carries successful code forward without discarding student lines", () => {
    const level1Code = [
        "# Mein eigener Kommentar",
        'nachricht = "GEHEIM"',
        "for buchstabe in nachricht:",
        "    print(buchstabe)"
    ].join("\n");
    const level2Code = [
        "# Mein eigener Kommentar",
        'nachricht = "GEHEIM"',
        "for buchstabe in nachricht:",
        "    print(ord(buchstabe))"
    ].join("\n");
    const { context } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({
            mission4_level1: level1Code,
            mission4_level2: level2Code
        })
    });

    assert.equal(
        vm.runInContext('buildInheritedLevelCode("mission4_level2")', context),
        level1Code
    );

    const finaleStarter = vm.runInContext('buildInheritedLevelCode("mission4_level3")', context);
    let previousPosition = -1;
    for (const originalLine of level2Code.split("\n")) {
        const position = finaleStarter.indexOf(originalLine, previousPosition + 1);
        assert.notEqual(position, -1, `Übernommene Zeile fehlt: ${originalLine}`);
        previousPosition = position;
    }
    assert.equal((finaleStarter.match(/geheimtext = ""  # Startbonus/g) ?? []).length, 1);
    assert.equal((finaleStarter.match(/print\(geheimtext\)  # Startbonus/g) ?? []).length, 1);

    context.finaleStarter = finaleStarter;
    assert.equal(
        vm.runInContext("addMission4FinaleBonuses(finaleStarter)", context),
        finaleStarter,
        "Startbonus darf bei erneutem Aufbau nicht doppelt erscheinen"
    );
});

test("a completed current level takes priority over inherited code", () => {
    const inheritedCode = 'nachricht = "GEHEIM"\nfor buchstabe in nachricht:\n    print(buchstabe)';
    const completedCurrentCode = '# Meine bestandene Variante\nnachricht = "GEHEIM"\nfor buchstabe in nachricht:\n    print(ord(buchstabe))';
    const { context } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({
            mission4_level1: inheritedCode,
            mission4_level2: completedCurrentCode
        })
    });
    const editor = {
        value: "",
        setValue(value) { this.value = value; }
    };
    context.window.editor = editor;

    assert.equal(vm.runInContext('restoreLevelCode("mission4_level2")', context), true);
    assert.equal(editor.value, completedCurrentCode);
});

test("assignment microcode consistently uses setze auf", () => {
    const mission3Level2 = readFileSync(new URL("../mission3_level2.html", import.meta.url), "utf8");
    const mission3Level3 = readFileSync(new URL("../mission3_level3.html", import.meta.url), "utf8");

    for (const html of [mission3Level2, mission3Level3]) {
        assert.doesNotMatch(html, /<div class="makecode-block block-tooltip"[^>]*>mach\s/i);
    }

    assert.match(mission3Level2, />setze <span[^>]*>tipp<\/span> auf die Zahl aus /);
    assert.match(mission3Level3, />setze <span[^>]*>geheim<\/span> auf eine Zufallszahl /);
    assert.match(mission3Level3, />setze <span[^>]*>tipp<\/span> auf <span[^>]*>0<\/span>/);
    assert.match(mission3Level3, />setze <span[^>]*>tipp<\/span> auf die Zahl aus /);
});

const validSolutions = [
    {
        level: "mission1_level1",
        code: 'print("Verbindung wird hergestellt...")',
        output: "Verbindung wird hergestellt...\n"
    },
    {
        level: "mission1_level2",
        code: 'import time\nprint("Verbindung wird hergestellt...")\ntime.sleep(1)',
        output: "Verbindung wird hergestellt...\n"
    },
    {
        level: "mission1_level3",
        code: 'agent_name = input("Gib deinen Namen ein: ")',
        output: "Gib deinen Namen ein: Ada\n"
    },
    {
        level: "mission1_level4",
        code: 'print("Verbindung wird hergestellt...")\nagent_name = input("Name: ")\nprint("Willkommen im System,", agent_name)',
        output: "Verbindung wird hergestellt...\nName: Ada\nWillkommen im System, Ada\n"
    },
    {
        level: "mission2_level1",
        code: 'kabel = "rot"\nif kabel == "rot":\n    print("Entschärft!")',
        output: "Entschärft!\n"
    },
    {
        level: "mission2_level2",
        code: 'kabel = "blau"\nif kabel == "rot":\n    print("Entschärft!")\nelse:\n    print("KABUMM!")',
        output: "KABUMM!\n"
    },
    {
        level: "mission2_level3",
        code: 'kabel = input("Welches Kabel? ")\nif kabel == "rot":\n    print("Entschärft!")\nelif kabel == "blau":\n    print("Kurzschluss!")\nelse:\n    print("KABUMM!")',
        output: "Welches Kabel? rot\nEntschärft!\n"
    },
    {
        level: "mission3_level1",
        code: 'tipp = ""\nwhile tipp != "123":\n    tipp = input("Code eingeben: ")',
        output: "Code eingeben: 123\n"
    },
    {
        level: "mission3_level2",
        code: 'tipp = int(input("Code eingeben: "))\nif tipp < 50:\n    print("Zu niedrig!")\nelif tipp > 50:\n    print("Zu hoch!")',
        output: "Code eingeben: 25\nZu niedrig!\n"
    },
    {
        level: "mission3_level3",
        code: 'import random\ngeheim = random.randint(1, 100)\ntipp = 0\nwhile tipp != geheim:\n    tipp = int(input("Code eingeben: "))\n    if tipp < geheim:\n        print("Zu niedrig!")\n    elif tipp > geheim:\n        print("Zu hoch!")\nprint("Knack!")',
        output: "Code eingeben: 42\nKnack!\n"
    },
    {
        level: "mission4_level1",
        code: 'nachricht = "GEHEIM"\nfor buchstabe in nachricht:\n    print(buchstabe)',
        output: "G\nE\nH\nE\nI\nM\n"
    },
    {
        level: "mission4_level2",
        code: 'nachricht = "GEHEIM"\nfor buchstabe in nachricht:\n    print(ord(buchstabe))',
        output: "71\n69\n72\n69\n73\n77\n"
    },
    {
        level: "mission4_level3",
        code: 'nachricht = "GEHEIM"\ngeheimtext = ""\nfor buchstabe in nachricht:\n    zahl = ord(buchstabe) + 3\n    geheimtext = geheimtext + chr(zahl)\nprint(geheimtext)',
        output: "JHKHLP\n"
    },
    {
        level: "agent_training_level1",
        code: 'agent.goto(160, 80)\nagent.dot(30)\nprint("Position:", agent.position())',
        output: "Position: (160.00,80.00)\n"
    },
    {
        level: "agent_training_level2",
        code: [
            "def gehe_zu(x, y):",
            "    agent.goto(x, y)",
            "def markiere():",
            "    agent.dot(30)",
            "gehe_zu(-160, 40)",
            "markiere()",
            "gehe_zu(80, 130)",
            "markiere()"
        ].join("\n"),
        output: ""
    },
    {
        level: "agent_training_level3",
        code: [
            "fund = agent.suche_hier()",
            'print("Gefunden:", fund)',
            'if fund == "Datenchip":',
            "    inventar.append(fund)"
        ].join("\n"),
        output: "Gefunden: Datenchip\n"
    }
];

test("all documented solutions pass their central validators", async (t) => {
    const { context } = createRunnerContext();

    for (const solution of validSolutions) {
        await t.test(solution.level, () => {
            context.levelId = solution.level;
            context.code = solution.code;
            context.output = solution.output;
            const result = vm.runInContext("validateLevelSolution(levelId, code, output)", context);
            assert.equal(result.passed, true, result.message);
        });
    }
});

test("keywords in comments or strings cannot bypass validators", () => {
    const { context } = createRunnerContext();
    context.levelId = "mission3_level3";
    context.code = [
        '# import random; geheim = random.randint(1, 100)',
        'print("while tipp != geheim: int(input) if elif randint")',
        'print("Knack!")'
    ].join("\n");
    context.output = "while tipp != geheim: int(input) if elif randint\nKnack!\n";

    const result = vm.runInContext("validateLevelSolution(levelId, code, output)", context);

    assert.equal(result.passed, false);
    assert.match(result.message, /random/);
});

test("nested loop requirements reject unindented input", () => {
    const { context } = createRunnerContext();
    context.levelId = "mission3_level1";
    context.code = 'tipp = ""\nwhile tipp != "123":\n    print("Warte")\ntipp = input("Code: ")';
    context.output = "Warte\nCode: 123\n";

    const result = vm.runInContext("validateLevelSolution(levelId, code, output)", context);

    assert.equal(result.passed, false);
    assert.match(result.message, /eingerückt/);
});

test("mission 4 rejects Caesar steps outside the for loop", () => {
    const { context } = createRunnerContext();
    context.levelId = "mission4_level3";
    context.code = [
        'nachricht = "GEHEIM"',
        'geheimtext = ""',
        "for buchstabe in nachricht:",
        "    print(buchstabe)",
        "zahl = ord(buchstabe) + 3",
        "geheimtext = geheimtext + chr(zahl)",
        "print(geheimtext)"
    ].join("\n");
    context.output = "JHKHLP\n";

    const result = vm.runInContext("validateLevelSolution(levelId, code, output)", context);

    assert.equal(result.passed, false);
    assert.match(result.message, /eingerückt/);
});

test("Agent training position checks ignore comments and string literals", () => {
    const { context } = createRunnerContext();
    context.code = [
        "# print(agent.position())",
        'print("agent.position()")'
    ].join("\n");
    context.output = "agent.position()\n";

    const result = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, output)',
        context
    );

    assert.equal(result.passed, false);
    assert.match(result.message, /echte Agentenposition/);
});

test("Agent training level 2 requires called functions instead of direct or unused code", () => {
    const { context } = createRunnerContext();
    const directRoute = [
        "def gehe_zu(x, y):",
        "    agent.goto(x, y)",
        "def markiere():",
        "    agent.dot(30)",
        "agent.goto(-160, 40)",
        "agent.dot(30)",
        "agent.goto(80, 130)",
        "agent.dot(30)"
    ].join("\n");
    context.code = directRoute;
    let result = vm.runInContext(
        'validateLevelSolution("agent_training_level2", code, "")',
        context
    );
    assert.equal(result.passed, false);
    assert.match(result.message, /eigenen/);

    context.code = [
        "def route(a, b):",
        "    agent.goto(a, b)",
        "def punkt():",
        "    agent.dot(30)",
        "route(-160, 40)",
        "punkt()",
        "route(80, 130)",
        "punkt()"
    ].join("\n");
    result = vm.runInContext(
        'validateLevelSolution("agent_training_level2", code, "")',
        context
    );
    assert.equal(result.passed, true, result.message);
});

test("Agent training level 3 ignores fake search, print and append text", () => {
    const { context } = createRunnerContext();
    context.code = [
        '# fund = agent.suche_hier()',
        'print("fund = agent.suche_hier(); Gefunden: Datenchip")',
        '# if fund == "Datenchip": inventar.append(fund)'
    ].join("\n");
    context.output = "fund = agent.suche_hier(); Gefunden: Datenchip\n";

    const result = vm.runInContext(
        'validateLevelSolution("agent_training_level3", code, output)',
        context
    );
    assert.equal(result.passed, false);
    assert.match(result.message, /suche_hier/);
});

test("Agent training validates real target, mark and position output as one runtime chain", () => {
    const core = createAgentTrainingCore();

    const wrongTarget = core.createState();
    core.recordPosition(wrongTarget, { x: 80, y: 160 });
    core.recordMark(wrongTarget, { x: 80, y: 160 });
    assert.equal(core.validate(wrongTarget, "Position: (160, 80)", true).passed, false);

    const missingMark = core.createState();
    core.recordPosition(missingMark, core.TARGET);
    assert.equal(core.validate(missingMark, "Position: (160, 80)", true).passed, false);

    const hardcodedWithoutPositionCall = core.createState();
    core.recordPosition(hardcodedWithoutPositionCall, core.TARGET);
    core.recordMark(hardcodedWithoutPositionCall, core.TARGET);
    assert.equal(
        core.validate(hardcodedWithoutPositionCall, "Position: (160, 80)", false).passed,
        false
    );

    const valid = core.createState();
    core.recordPosition(valid, core.TARGET);
    core.recordMark(valid, { x: 161, y: 79 });
    const result = core.validate(valid, "Position: (160.00,80.00)\n", true);
    assert.equal(result.passed, true);
    assert.equal(result.checks.every(check => check.passed), true);

    const reset = core.createState();
    assert.equal(core.validate(reset, "", true).passed, false);
    assert.equal(reset.marks.length, 0);
});

test("Agent training level 2 validates both real targets together with function evidence", () => {
    const core = createAgentTrainingCore();
    const structure = {
        evidence: { movementFunction: true, markerFunction: true }
    };
    const state = core.createState("agent_training_level2");
    core.recordPosition(state, { x: -160, y: 40 });
    core.recordMark(state, { x: -160, y: 40 });
    assert.equal(core.validate(state, "", structure).passed, false);

    core.recordPosition(state, { x: 80, y: 130 });
    core.recordMark(state, { x: 80, y: 130 });
    const result = core.validate(state, "", structure);
    assert.equal(result.passed, true);
    assert.deepEqual([...state.visitedTargetIds].sort(), ["alpha", "beta"]);
    assert.deepEqual([...state.markedTargetIds].sort(), ["alpha", "beta"]);

    const directOnly = core.createState("agent_training_level2");
    core.recordPosition(directOnly, { x: -160, y: 40 });
    core.recordMark(directOnly, { x: -160, y: 40 });
    core.recordPosition(directOnly, { x: 80, y: 130 });
    core.recordMark(directOnly, { x: 80, y: 130 });
    assert.equal(core.validate(directOnly, "", { evidence: {} }).passed, false);
});

test("Agent training level 3 needs a real search and provenance-backed collection", () => {
    const core = createAgentTrainingCore();
    const structure = {
        evidence: { searchAssignment: true, printsFund: true, guardedAppend: true }
    };
    const state = core.createState("agent_training_level3");

    assert.equal(core.searchHere(state, { x: 0, y: 0 }), null);
    core.recordCollection(state, true);
    assert.equal(core.validate(state, "Gefunden: Datenchip\n", structure).passed, false);

    assert.equal(core.searchHere(state, { x: -210, y: 65 }), "Datenchip");
    core.recordCollection(state, false);
    assert.equal(core.validate(state, "Gefunden: Datenchip\n", structure).passed, false);

    core.recordCollection(state, true);
    const result = core.validate(state, "Gefunden: Datenchip\n", structure);
    assert.equal(result.passed, true);
    assert.equal(result.checks.every(check => check.passed), true);
});

const teacherSolutionExpectations = new Map([
    ["mission1_level1", /Verbindung wird hergestellt/],
    ["mission1_level2", /time\.sleep\(1\)/],
    ["mission1_level3", /agent_name = input/],
    ["mission1_level4", /Willkommen im System/],
    ["mission2_level1", /kabel = "rot"/],
    ["mission2_level2", /else:/],
    ["mission2_level3", /elif kabel == "blau":/],
    ["mission3_level1", /while tipp != "123":/],
    ["mission3_level2", /elif tipp > 50:/],
    ["mission3_level3", /random\.randint\(1, 100\)/],
    ["mission4_level1", /for buchstabe in nachricht:/],
    ["mission4_level2", /ord\(buchstabe\)/],
    ["mission4_level3", /geheimtext = geheimtext \+ chr\(zahl\)/],
    ["agent_training_level1", /agent\.speed\(2\)[\s\S]*agent\.dot\(30,/],
    ["agent_training_level2", /def markiere\(\):[\s\S]*gehe_zu\(80, 130\)/],
    ["agent_training_level3", /fund = agent\.suche_hier\(\)[\s\S]*inventar\.append\(fund\)/]
]);

test("teacher solutions are centralized and available for every level", () => {
    const editor = {
        focused: false,
        value: "",
        focus() { this.focused = true; },
        setValue(value) { this.value = value; }
    };
    const document = {
        addEventListener() {},
        querySelectorAll() { return []; }
    };
    const window = {
        atob(encoded) { return Buffer.from(encoded, "base64").toString("binary"); },
        editor,
        location: { hash: "#l" }
    };
    const context = vm.createContext({ document, TextDecoder, Uint8Array, window });
    const source = readFileSync(new URL("../assets/teacher-solutions.js", import.meta.url), "utf8");
    vm.runInContext(source, context);

    for (const [levelId, expectedCode] of teacherSolutionExpectations) {
        editor.value = "";
        editor.focused = false;

        assert.equal(window.TeacherSolutions.load(levelId), true, `${levelId} fehlt`);
        assert.match(editor.value, expectedCode);
        assert.equal(editor.focused, true);

        const html = readFileSync(new URL(`../${levelId}.html`, import.meta.url), "utf8");
        assert.match(html, /assets\/teacher-solutions\.js/);
        assert.match(html, new RegExp(`data-teacher-solution="${levelId}"`));
        assert.doesNotMatch(html, /onclick="[^"]*(?:atob|editor\.setValue)/);
    }
});

const missionPages = [
    "mission1_start.html",
    "mission1_level1.html",
    "mission1_level2.html",
    "mission1_level3.html",
    "mission1_level4.html",
    "mission2_start.html",
    "mission2_level1.html",
    "mission2_level2.html",
    "mission2_level3.html",
    "mission3_start.html",
    "mission3_level1.html",
    "mission3_level2.html",
    "mission3_level3.html",
    "mission4_start.html",
    "mission4_level1.html",
    "mission4_level2.html",
    "mission4_level3.html",
    "agent_training_start.html",
    "agent_training_level1.html",
    "agent_training_level2.html",
    "agent_training_level3.html"
];

test("browser dependencies are local and checksum-protected", () => {
    const referencedVendorFiles = new Set();

    for (const page of missionPages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.doesNotMatch(
            html,
            /https:\/\/(?:ajax\.googleapis\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/,
            `${page} enthält noch eine externe Browserbibliothek`
        );

        for (const match of html.matchAll(/(?:src|href)="(assets\/vendor\/[^"]+)"/g)) {
            referencedVendorFiles.add(match[1]);
        }
    }

    assert.equal(referencedVendorFiles.size, 7);

    const checksumFile = readFileSync(new URL("../assets/vendor/SHA256SUMS", import.meta.url), "utf8");
    const expectedChecksums = new Map(
        checksumFile.trim().split(/\r?\n/).map(line => {
            const [hash, relativePath] = line.split(/\s{2,}/);
            return [relativePath, hash];
        })
    );
    assert.equal(expectedChecksums.size, 10);

    for (const [relativePath, expectedHash] of expectedChecksums) {
        const contents = readFileSync(new URL(`../${relativePath}`, import.meta.url));
        const actualHash = createHash("sha256").update(contents).digest("hex");
        assert.equal(actualHash, expectedHash, `${relativePath} wurde unerwartet verändert`);
    }

    for (const relativePath of referencedVendorFiles) {
        assert.equal(expectedChecksums.has(relativePath), true, `${relativePath} fehlt in SHA256SUMS`);
    }
});

test("mission navigation is rendered from one central definition", () => {
    let renderedNodes = [];
    const root = {
        replaceWith(...elements) { renderedNodes = elements; }
    };
    class NavigationElement {
        constructor(tagName) {
            this.tagName = tagName;
            this.children = [];
            this.attributes = new Map();
            this.className = "";
            this.dataset = {};
            this.href = "";
            this.id = "";
            this.tabIndex = 0;
            this.textContent = "";
        }

        appendChild(child) {
            this.children.push(child);
            return child;
        }

        getAttribute(name) {
            return this.attributes.get(name) ?? null;
        }

        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        }
    }
    const document = {
        createElement(tagName) { return new NavigationElement(tagName); },
        getElementById(id) { return id === "navigation-root" ? root : null; }
    };
    const window = {};
    const context = vm.createContext({ document, Object, window });
    const source = readFileSync(new URL("../assets/navigation.js", import.meta.url), "utf8");
    vm.runInContext(source, context);

    assert.equal(renderedNodes.length, 2);
    const [renderedDock, renderedSidebar] = renderedNodes;
    assert.equal(renderedDock.tagName, "div");
    assert.equal(renderedDock.id, "learning-nav-dock");

    assert.equal(renderedSidebar.tagName, "dialog");
    assert.equal(renderedSidebar.id, "mySidebar");
    assert.equal(renderedSidebar.className, "sidebar");
    assert.equal(renderedSidebar.getAttribute("aria-labelledby"), "sidebar-title");

    const elementsById = new Map();
    function collectElements(element) {
        if (element.id) elementsById.set(element.id, element);
        element.children.forEach(collectElements);
    }
    collectElements(renderedDock);
    collectElements(renderedSidebar);

    const expectedNavigationIds = [
        "learning-nav-dock",
        "agent-py-home",
        "menu-btn",
        "mySidebar",
        "sidebar-title",
        "navigation-close-btn",
        "link-m1-title",
        "link-level1",
        "link-level2",
        "link-level3",
        "link-level4",
        "link-m2-title",
        "link-m2-l1",
        "link-m2-l2",
        "link-m2-l3",
        "link-m3-title",
        "link-m3-l1",
        "link-m3-l2",
        "link-m3-l3",
        "link-m4-title",
        "link-m4-l1",
        "link-m4-l2",
        "link-m4-l3",
        "link-agent-training-title",
        "link-agent-training-l1",
        "link-agent-training-l2",
        "link-agent-training-l3",
        "reset-progress-btn"
    ];
    for (const id of expectedNavigationIds) {
        assert.equal(elementsById.has(id), true, `${id} fehlt in der zentralen Navigation`);
    }

    const renderedMenuButton = elementsById.get("menu-btn");
    assert.equal(renderedMenuButton.tagName, "button");
    assert.equal(renderedMenuButton.getAttribute("aria-controls"), "mySidebar");
    assert.equal(renderedMenuButton.getAttribute("aria-expanded"), "false");

    const homeLink = elementsById.get("agent-py-home");
    assert.equal(homeLink.tagName, "a");
    assert.equal(homeLink.href, "index.html");
    assert.equal(homeLink.getAttribute("aria-label"), "Agent PY – zur Startseite");
    assert.equal(homeLink.children.length, 1);
    assert.equal(homeLink.children[0].getAttribute("src"), "assets/brand/agent-py-logo.png?v=20260720-2");
    assert.equal(homeLink.children[0].getAttribute("width"), "1600");
    assert.equal(homeLink.children[0].getAttribute("height"), "232");

    assert.equal(elementsById.get("link-level1").className.includes("locked"), false);
    assert.equal(elementsById.get("link-level1").href, "mission1_level1.html");
    assert.equal(elementsById.get("link-level1").getAttribute("aria-disabled"), null);
    assert.equal(elementsById.get("link-level2").className.includes("locked"), true);
    assert.equal(elementsById.get("link-level2").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-level2").tabIndex, -1);
    assert.equal(elementsById.get("link-level2").href, "");
    assert.equal(elementsById.get("link-m2-title").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-m3-l3").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-m4-title").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-m4-l3").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-agent-training-title").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("link-agent-training-l1").getAttribute("aria-disabled"), "true");
    assert.equal(elementsById.get("reset-progress-btn").textContent, "Fortschritt zurücksetzen");

    for (const page of missionPages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.match(html, /<div id="navigation-root"><\/div>/);
        assert.match(html, /<script src="assets\/navigation\.js\?v=202607(?:20-[23]|21-1)"><\/script>/);
        assert.match(html, /<link rel="stylesheet" href="assets\/style\.css\?v=20260720-[23]">/);
        assert.doesNotMatch(html, /id="mySidebar"/);
    }
});

test("all progress link ids keep their established unlock routes", () => {
    const { context } = createRunnerContext();
    const routes = JSON.parse(vm.runInContext("JSON.stringify(LEVEL_ROUTES)", context));

    assert.deepEqual(routes, {
        "link-level1": "mission1_level1.html",
        "link-level2": "mission1_level2.html",
        "link-level3": "mission1_level3.html",
        "link-level4": "mission1_level4.html",
        "link-m2-title": "mission2_start.html",
        "link-m2-l1": "mission2_level1.html",
        "link-m2-l2": "mission2_level2.html",
        "link-m2-l3": "mission2_level3.html",
        "link-m3-title": "mission3_start.html",
        "link-m3-l1": "mission3_level1.html",
        "link-m3-l2": "mission3_level2.html",
        "link-m3-l3": "mission3_level3.html",
        "link-m4-title": "mission4_start.html",
        "link-m4-l1": "mission4_level1.html",
        "link-m4-l2": "mission4_level2.html",
        "link-m4-l3": "mission4_level3.html",
        "link-agent-training-title": "agent_training_start.html",
        "link-agent-training-l1": "agent_training_level1.html",
        "link-agent-training-l2": "agent_training_level2.html",
        "link-agent-training-l3": "agent_training_level3.html"
    });
});

test("mission pages use the central drawer without legacy offsets and contain one balanced main", () => {
    assert.equal(missionPages.length, 21);

    for (const page of missionPages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        const mainOpenings = html.match(/<main\b[^>]*>/gi) ?? [];
        const mainClosings = html.match(/<\/main>/gi) ?? [];

        assert.doesNotMatch(html, /id=["']menu-btn["']/i, `${page} enthält noch den alten Menübutton`);
        assert.doesNotMatch(
            html,
            /padding-left\s*:\s*280px/i,
            `${page} enthält noch den alten Sidebar-Abstand`
        );
        assert.equal(mainOpenings.length, 1, `${page} braucht genau ein <main>`);
        assert.equal(mainClosings.length, 1, `${page} braucht genau ein </main>`);
        assert.match(mainOpenings[0], /id=["']main-content["']/i, `${page}: <main> braucht #main-content`);
    }
});

test("mission 4 hands off to the shared Agent training without exposing later project finales", () => {
    const mission4Finale = readFileSync(new URL("../mission4_level3.html", import.meta.url), "utf8");
    const trainingStart = readFileSync(new URL("../agent_training_start.html", import.meta.url), "utf8");
    const trainingLevel1 = readFileSync(new URL("../agent_training_level1.html", import.meta.url), "utf8");
    const trainingLevel2 = readFileSync(new URL("../agent_training_level2.html", import.meta.url), "utf8");
    const trainingLevel3 = readFileSync(new URL("../agent_training_level3.html", import.meta.url), "utf8");

    assert.match(mission4Finale, /id="next-level-btn"[^>]+agent_training_start\.html/);
    assert.match(trainingStart, /href="agent_training_level1\.html"/);
    assert.match(trainingStart, /Gemeinsame Vorbereitung · Große Mission/);
    assert.match(trainingStart, /markierst wichtige Orte und untersuchst Fundstücke\./);
    assert.doesNotMatch(trainingStart, /später echte Suchergebnisse/);
    assert.match(trainingLevel1, /agent\.goto\(160, 80\)/);
    assert.match(trainingLevel1, /agent\.dot\(30, &quot;#7df2a9&quot;\)|agent\.dot\(30, "#7df2a9"\)/);
    assert.match(trainingLevel1, /agent\.position\(\)/);
    const starter = trainingLevel1.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.match(starter, /agent\.speed\(2\)\s*\nagent\.penup\(\)/);
    assert.doesNotMatch(starter, /agent\.speed\(4\)/);
    assert.match(trainingLevel1, /id="training-marks-layer" class="training-marks-layer"/);
    assert.match(trainingLevel1, /<code>penup\(\)<\/code>: Bewegung ohne Spur\./);

    const level2Starter = trainingLevel2.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.match(level2Starter, /def markiere\(\):\s*\n\s+pass/);
    assert.doesNotMatch(level2Starter, /gehe_zu\(80, 130\)\s*\nmarkiere\(\)/);
    assert.match(trainingLevel2, /agent\.dot\(30, &quot;#7df2a9&quot;\)|agent\.dot\(30, "#7df2a9"\)/);
    assert.match(trainingLevel2, /class="block-hint"/);

    const level3Starter = trainingLevel3.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.doesNotMatch(level3Starter, /fund\s*=\s*agent\.suche_hier/);
    assert.match(trainingLevel3, /fund = agent\.suche_hier\(\)/);
    assert.match(trainingLevel3, /inventar\.append\(fund\)/);
    assert.match(trainingLevel3, /microcode-indent-1/);

    const trainingCss = readFileSync(new URL("../assets/agent-training.css", import.meta.url), "utf8");
    assert.match(trainingCss, /\.training-live-dot\s*\{[\s\S]*animation:\s*none;/);
    assert.doesNotMatch(trainingCss, /\.training-complete\s+\.training-target-halo/);
    assert.doesNotMatch(trainingStart + trainingLevel1 + trainingLevel2 + trainingLevel3, /pico_finale|pixelmuseum_finale/);
});

test("all four mission artworks are local, valid and web-sized", () => {
    const artwork = [
        "mission-1-system-access.webp",
        "mission-2-cable-lab.webp",
        "mission-3-vault.webp",
        "mission-4-signal-room.webp"
    ];

    for (const file of artwork) {
        const url = new URL(`../assets/images/missions/${file}`, import.meta.url);
        const bytes = readFileSync(url);
        assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${file} ist kein RIFF-WebP`);
        assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${file} ist kein WebP`);
        assert.ok(bytes.length > 20_000, `${file} ist unerwartet leer oder zu klein`);
        assert.ok(statSync(url).size < 300_000, `${file} ist für die Missionsseite zu groß`);
    }
});

test("both homepage options keep distinct light moods and one shared logo while linking the complete mission path", () => {
    const variants = [
        {
            page: "index-a.html",
            bodyClass: "home-path",
            artwork: "agent-path-cyan-moon.webp",
            concept: /Entdecke,|Vier Missionen und dein Weg beginnt hier\./,
            brand: /aria-label="Agent PY – Startseite"/
        },
        {
            page: "index-b.html",
            bodyClass: "home-agent-path",
            artwork: "agent-path-magenta-portal.webp",
            concept: /Entdecke,|Vier Missionen und dein Weg beginnt hier\./,
            brand: /aria-label="Agent PY – Startseite"/
        }
    ];
    const expectedMissionTargets = [
        "mission1_start.html",
        "mission2_start.html",
        "mission3_start.html",
        "mission4_start.html"
    ];
    const heroTexts = [];

    for (const variant of variants) {
        const html = readFileSync(new URL(`../${variant.page}`, import.meta.url), "utf8");
        const missionTargets = [...html.matchAll(/<a class="course-mission-card[^>]*href="([^"]+)"/g)]
            .map(match => match[1]);
        const hero = html.match(/<h1 id="home-title">([\s\S]*?)<\/h1>/)?.[1]
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();

        assert.match(html, new RegExp(`<body class="course-home ${variant.bodyClass}"`));
        assert.match(html, new RegExp(`assets/images/home/${variant.artwork.replace(".", "\\.")}\\?v=20260720-2`));
        assert.match(html, variant.concept);
        assert.match(html, variant.brand);
        assert.match(html, /src="assets\/brand\/agent-py-logo\.png\?v=20260720-2"/);
        assert.match(html, /href="assets\/style\.css\?v=20260720-2"/);
        assert.match(html, /href="assets\/home\.css\?v=20260720-2"/);
        assert.match(html, /href="index\.html" aria-label="Agent PY – Startseite"/);
        assert.deepEqual(missionTargets, expectedMissionTargets);
        assert.equal((html.match(/<main\b/gi) ?? []).length, 1);
        assert.equal((html.match(/<\/main>/gi) ?? []).length, 1);
        assert.match(html, /<main id="home-main">/);
        assert.doesNotMatch(html, /href="[^"]*(?:prototypes\/|finale)/i);
        assert.doesNotMatch(html, /https?:\/\//i);
        assert.doesNotMatch(html, /checkpoint|observatorium|observation|beobacht/i);
        assert.ok(
            html.indexOf('class="course-future"') < html.indexOf('class="course-method-grid"'),
            `${variant.page}: Die Weggabelung muss vor „So kommst du voran“ stehen`
        );
        assert.ok(hero, `${variant.page} braucht einen Hero-Titel`);
        heroTexts.push(hero);
    }

    assert.equal(heroTexts[0], heroTexts[1], "A und B sollen dieselbe Hero-Erzählung verwenden");
});

test("the public index is the complete A homepage instead of a redirect", () => {
    const root = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const optionA = readFileSync(new URL("../index-a.html", import.meta.url), "utf8");

    assert.match(root, /<body class="course-home home-path"/);
    assert.match(root, /Entdecke,/);
    assert.match(root, /href="index-b\.html"/);
    assert.match(root, /agent-path-cyan-moon\.webp/);
    assert.doesNotMatch(root, /window\.location|http-equiv=["']refresh/i);
    assert.equal(root, optionA);
});

test("both homepage hero renders are valid optimized WebP assets", () => {
    const artwork = [
        "agent-path-cyan-moon.webp",
        "agent-path-magenta-portal.webp"
    ];

    for (const file of artwork) {
        const url = new URL(`../assets/images/home/${file}`, import.meta.url);
        const bytes = readFileSync(url);
        assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${file} ist kein RIFF-WebP`);
        assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${file} ist kein WebP`);
        assert.ok(bytes.length > 50_000, `${file} ist unerwartet leer oder zu klein`);
        assert.ok(statSync(url).size < 300_000, `${file} ist für den Hero zu groß`);
    }
});

test("the supplied transparent Agent PY PNG is the shared optimized logo asset", () => {
    const logoUrl = new URL("../assets/brand/agent-py-logo.png", import.meta.url);
    const logo = readFileSync(logoUrl);

    assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(logo.subarray(12, 16).toString("ascii"), "IHDR");
    assert.equal(logo.readUInt32BE(16), 1600);
    assert.equal(logo.readUInt32BE(20), 232);
    assert.equal(logo[25], 6, "Das Logo muss einen echten Alphakanal behalten");
    assert.ok(statSync(logoUrl).size < 200_000, "Das transparente Logo ist unerwartet groß");
});

test("CodeMirror is initialized from one central editor module", () => {
    const textarea = { id: "python-editor" };
    const createdEditor = { name: "editor" };
    let receivedTextarea = null;
    let receivedOptions = null;
    const document = {
        getElementById(id) { return id === "python-editor" ? textarea : null; }
    };
    const window = {
        CodeMirror: {
            fromTextArea(element, options) {
                receivedTextarea = element;
                receivedOptions = options;
                return createdEditor;
            }
        }
    };
    const context = vm.createContext({ document, Error, window });
    const source = readFileSync(new URL("../assets/editor.js", import.meta.url), "utf8");
    vm.runInContext(source, context);

    assert.equal(receivedTextarea, textarea);
    assert.equal(window.editor, createdEditor);
    assert.deepEqual(
        JSON.parse(JSON.stringify(receivedOptions)),
        { mode: "python", theme: "monokai", lineNumbers: true, indentUnit: 4 }
    );

    for (const page of missionPages.filter(name => name.includes("_level"))) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.match(html, /<script src="assets\/editor\.js"><\/script>/);
        assert.doesNotMatch(html, /CodeMirror\.fromTextArea/);
    }
});

test("finale prototypes stay unlinked, isolated and locally hosted", () => {
    const prototypes = [
        "pico_finale.html",
        "pixelmuseum_finale.html"
    ];
    const navigation = readFileSync(new URL("../assets/navigation.js", import.meta.url), "utf8");
    const publicPages = ["index.html", "index-a.html", "index-b.html", ...missionPages];

    for (const publicPage of publicPages) {
        const html = readFileSync(new URL(`../${publicPage}`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /(?:pico|pixelmuseum)_finale\.html/);
    }

    for (const page of prototypes) {
        assert.doesNotMatch(navigation, new RegExp(page.replace(".", "\\.")));

        const html = readFileSync(new URL(`../prototypes/${page}`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /https?:\/\//);
        assert.doesNotMatch(html, /localStorage|navigation\.js|runner\.js/);
        assert.match(html, /Unverlinkter Endprototyp/);
        assert.match(html, /class="prototype-nav-dock"/);
        assert.match(html, /class="prototype-home-link" href="\.\.\/index\.html"/);
        assert.match(html, /src="\.\.\/assets\/brand\/agent-py-logo\.png\?v=20260720-2"/);
        assert.match(html, /class="prototype-path-token"/);
        assert.doesNotMatch(html, /class="prototype-path-token"[^>]*(?:href=|onclick=)/);
        assert.match(html, /href="finale\.css\?v=p3-glass-v1"/);
        assert.match(html, /class="turtle-target"/);
        assert.match(html, /window\.FINALE_CONFIG/);
        assert.match(html, /src="finale\.js\?v=p2-audit-v1"/);
        assert.match(html, /src="finale-analysis\.js\?v=p2-audit-v1"/);
        assert.match(html, /assets\/images\/finales\/.+\.webp/);
        assert.match(html, /assets\/vendor\/skulpt\/1\.2\.0\/skulpt\.min\.js/);
        assert.match(html, /assets\/vendor\/codemirror\/5\.65\.2\/codemirror\.min\.js/);
        assert.doesNotMatch(html, /\.speed\(9\)/);
    }

    const pico = readFileSync(new URL("../prototypes/pico_finale.html", import.meta.url), "utf8");
    assert.match(pico, /pico\.goto\(-365, 55\)/);
    assert.match(pico, /fahre_zu\(-380, -90\)/);
    assert.match(pico, /fahre_zu\(0, -90\)/);
    assert.match(pico, /Funkbase/);
    assert.doesNotMatch(pico, /for schritt in range\(4\)/);
    assert.match(pico, /def fahre_zu\(x, y\):/);
    assert.match(pico, /def markiere\(\):\s*\n\s*pico\.dot\(18, "#55f6ff"\)/);
    const picoCode = pico.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.equal((picoCode.match(/pico\.dot\(/g) || []).length, 1, "PICO-Punkte sollen nur in markiere() gezeichnet werden");
    assert.equal((picoCode.match(/markiere\(\)/g) || []).length, 3, "PICO soll beide Ziele einheitlich markieren");
    assert.match(pico, /Eigene Funktion und markiere\(\) werden verwendet/);
    assert.match(pico, /id="energy-value">10 %/);
    assert.match(pico, /fund = pico\.suche_hier\(\)/);
    assert.match(pico, /print\("Gefunden: " \+ str\(fund\)\)/);
    assert.match(pico, /ausruestung\.append\(fund\)/);
    assert.doesNotMatch(pico, /if fund == "Energiezelle":/);
    assert.match(pico, /signal_erfolgreich = pico\.sende\(\)/);
    assert.match(pico, /status\s*=\s*\{"AGENT": "PICO", "FUNK": "suche"\}/);
    assert.match(pico, /status\.update\(\{"FUNK": "gesendet"\}\)/);
    assert.match(pico, /status\.update\(\{"FUNK": "fehlgeschlagen"\}\)/);
    assert.doesNotMatch(picoCode, /PICO_STATUS\|/, "Die GUI liest das Dictionary direkt und braucht kein Ausgabeprotokoll");
    assert.match(pico, /Signal konnte nicht gesendet werden\./);
    assert.match(pico, /onTurtleFrame\(point\)/);
    assert.match(pico, /syncPythonState\(context\)/);
    assert.match(pico, /this\.signalSent = success/);
    assert.match(pico, /document\.getElementById\("agent-name"\)\.textContent = agent/);
    assert.match(pico, /document\.getElementById\("mission-state"\)\.textContent = funk/);
    assert.match(pico, /liveStatus\.AGENT/);
    assert.match(pico, /liveStatus\.FUNK/);
    assert.match(pico, /this\.lastRuntimeStatusData = \{ \.\.\.this\.lastStatusData \}/);
    assert.doesNotMatch(pico, /parseOutput\(output\)/);
    assert.doesNotMatch(pico, /onOutput\(_chunk/);
    assert.match(pico, /<small>AGENT<\/small>/);
    assert.match(pico, /<small>FUNK<\/small>/);
    assert.match(pico, /Status-Dictionary füllt AGENT und FUNK/);
    assert.match(pico, /optional: true/);
    assert.match(pico, /checks\.filter\(check => !check\.optional\)\.every/);
    assert.match(pico, /Signal gesendet - gerettet!/);
    assert.match(pico, /NICHT GERETTET – SIGNAL FEHLGESCHLAGEN/);
    assert.doesNotMatch(pico, /pickupProgrammed/);
    assert.match(pico, /return \{ stop: true, reason: "PICO_ENERGY_DEPLETED" \}/);
    assert.match(pico, /limitTurtleMovement\(start, target\)/);
    assert.match(pico, /getAutomaticStop\(\)/);
    assert.doesNotMatch(pico, /else:\s*\n\s*print\("Ohne Energiezelle/);
    assert.match(pico, /this\.energy = 10/);
    assert.doesNotMatch(pico, /status\s*=\s*\{[^\n}]*"energie"/);
    assert.doesNotMatch(pico, /status\s*=\s*\{[^\n}]*"name"/);
    assert.doesNotMatch(pico, /status\s*=\s*\{[^\n}]*"signal"/);
    assert.doesNotMatch(pico, /liveStatus\.(?:name|signal)/);
    assert.match(pico, /\.speed\(3\)/);
    assert.match(pico, /turtle\.Screen\(\)\.delay\(35\)/);
    assert.doesNotMatch(pico, /<li><span aria-hidden="true">○<\/span> Wegpunkt<\/li>/);
    assert.match(pico, /Status-Dictionary \(Teilbereich\)/);

    const museum = readFileSync(new URL("../prototypes/pixelmuseum_finale.html", import.meta.url), "utf8");
    assert.match(museum, /Der böse Lord darf das Artefakt nicht behalten\./);
    assert.match(museum, /pixel-museum-recovered\.webp/);
    assert.match(museum, /gehe_zu\(-250, 60\)/);
    assert.match(museum, /if fund == "Artefakt":/);
    assert.doesNotMatch(museum, /Seruianer-Artefakt/);
    assert.doesNotMatch(museum, /if "Schlüsselkarte" in inventar:/);
    assert.doesNotMatch(museum, /if "Artefakt" in inventar:/);
    assert.match(museum, /fund = agent\.suche_hier\(\)/);
    assert.match(museum, /Noch kein Alarm ausgelöst – Hack nicht möglich!/);
    assert.match(museum, /inventar\.append\(fund\)/);
    assert.match(museum, /baselineCount/);
    assert.doesNotMatch(museum, /PickupProgrammed/);
    assert.match(museum, /def alarm_hacken\(code\):/);
    assert.match(museum, /def markiere\(\):\s*\n\s*agent\.dot\(18, "#ff78f3"\)/);
    assert.equal((museum.match(/agent\.dot\(/g) || []).length, 1, "Museumspunkte sollen nur in markiere() gezeichnet werden");
    assert.equal((museum.match(/markiere\(\)/g) || []).length, 5, "Alle Museumsziele sollen einheitlich markiert werden");
    assert.match(museum, /ALARM_HACK\|/);
    assert.match(museum, /this\.alarmMax = 8/);
    assert.match(museum, /window\.setInterval/);
    assert.match(museum, /this\.runtimeInventory\.includes\("Schlüsselkarte"\)/);
    assert.match(museum, /document\.body\.classList\.add\("artifact-secured"\)/);
    assert.doesNotMatch(museum, /\bstatus\s*=\s*\{/);
    assert.doesNotMatch(museum, /status\[/);
    assert.match(museum, /print\("INVENTARLISTE: " \+ ","\.join\(inventar\)\)/);
    assert.match(museum, /data-alarm-code="SERU-7"/);
    assert.equal((museum.match(/SERU-7/g) || []).length, 1, "Der Hackcode soll nur als Quelltext-Spur vorkommen");
    assert.match(museum, /alarm_hacken\("CODE_AUS_DEM_QUELLTEXT"\)/);
    assert.match(museum, /dataset\.alarmCode/);
    assert.match(museum, /playOneShotSound\("alarm"\)/);
    assert.match(museum, /playOneShotSound\("trapped"\)/);
    assert.match(museum, /this\.portalOpen = !this\.artifactSecured \|\| this\.alarmLevel < 1 \|\| this\.alarmDisabled/);
    assert.match(museum, /this\.renderAlarm\(0\);\s*this\.updateExitState\(\);\s*this\.playOneShotSound\("alarm"\)/);
    assert.match(museum, /this\.finishAlarmHack\(\);[\s\S]*?\}, 1000\)/);
    assert.match(museum, /DU BIST GEFANGEN!/);
    assert.match(museum, /MISSION ERFOLGREICH – DU BIST ENTKOMMEN!/);
    assert.doesNotMatch(museum, /Energiezelle|museum-energy|"energie"/);
    assert.match(museum, /\.speed\(4\)/);
    assert.match(museum, /turtle\.Screen\(\)\.delay\(30\)/);
    assert.match(museum, /Inventarliste ausgeben/);
    assert.match(museum, /Alarm hacken oder umgehen/);
});

test("pico HUD mirrors the status dictionary during turtle movement", () => {
    const { config, elements } = createPicoConfig();
    config.signalSent = false;
    config.syncPythonState({
        getGlobal(name) {
            return name === "status" ? { AGENT: "NOVA", FUNK: "suche" } : undefined;
        }
    });

    assert.equal(elements.get("agent-avatar").textContent, "N");
    assert.equal(elements.get("agent-name").textContent, "NOVA");
    assert.equal(elements.get("mission-state").textContent, "suche");
});

test("pico dictionary check accepts the real AGENT/FUNK runtime dictionary", () => {
    const { config } = createPicoConfig();
    config.charged = true;
    config.beaconReached = true;
    config.depleted = false;
    config.energy = 25;
    config.signalSent = true;
    config.syncPythonState({
        getGlobal(name) {
            return name === "status" ? { AGENT: "NOVA", FUNK: "gesendet" } : undefined;
        }
    });

    config.turtleMarks = 2;
    const result = config.validate(config.defaultCode, "PICO_STATUS|gefälscht|falsch\n");
    const dictionaryCheck = result.checks.find(check => check.label.includes("Status-Dictionary"));
    assert.equal(dictionaryCheck.optional, true);
    assert.equal(dictionaryCheck.passed, true);
    assert.equal(result.passed, true);
});

test("pico rejects legacy or forged status data without failing the whole mission", () => {
    for (const { runtimeStatus, expectedAgent, expectedFunk } of [
        { runtimeStatus: undefined },
        { runtimeStatus: { name: "NOVA", signal: "gesendet" }, expectedAgent: "–", expectedFunk: "–" },
        { runtimeStatus: { AGENT: "NOVA" }, expectedAgent: "NOVA", expectedFunk: "–" }
    ]) {
        const { config, elements } = createPicoConfig();
        config.charged = true;
        config.beaconReached = true;
        config.depleted = false;
        config.energy = 25;
        config.signalSent = true;
        if (runtimeStatus) {
            config.syncPythonState({
                getGlobal(name) { return name === "status" ? runtimeStatus : undefined; }
            });
            assert.equal(elements.get("agent-name").textContent, expectedAgent);
            assert.equal(elements.get("mission-state").textContent, expectedFunk);
        }

        config.turtleMarks = 2;
        const result = config.validate(config.defaultCode, "PICO_STATUS|NOVA|gesendet\n");
        const dictionaryCheck = result.checks.find(check => check.label.includes("Status-Dictionary"));
        assert.equal(dictionaryCheck.passed, false);
        assert.equal(dictionaryCheck.optional, true);
        assert.equal(result.passed, true);
    }
});

test("pico only charges after a real search result is appended", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    const equipment = [];
    const contextAt = (x, y) => ({
        x,
        y,
        getGlobal(name) {
            if (name === "status") return { AGENT: "PICO", FUNK: "suche" };
            if (name === "ausruestung") return equipment;
            return undefined;
        }
    });

    assert.equal(config.agentApi.suche_hier.call(config, contextAt(-340, -90)), null);
    equipment.push("Energiezelle");
    config.syncPythonState(contextAt(-340, -90));
    assert.equal(config.charged, false, "Ein erfundener Inventareintrag darf nicht laden");

    equipment.length = 0;
    const cellContext = contextAt(-380, -90);
    const found = config.agentApi.suche_hier.call(config, cellContext);
    assert.equal(found, "Energiezelle");
    config.syncPythonState(cellContext);
    assert.equal(config.charged, false, "Suchen allein darf die Zelle nicht aufnehmen");

    equipment.push(found);
    const result = config.syncPythonState(cellContext);
    assert.equal(result.resumeMovement, true);
    assert.equal(config.charged, true);
    assert.equal(config.energy, 100);
});

test("pico send is confirmed only at the powered Funkbase", () => {
    const { config, elements } = createPicoConfig();
    config.resetHud();

    assert.equal(config.agentApi.sende.call(config, { x: 340, y: 15 }), false);
    assert.equal(config.signalSent, false);

    config.charged = true;
    config.depleted = false;
    config.energy = 30;
    assert.equal(config.agentApi.sende.call(config, { x: 200, y: 15 }), false);
    assert.equal(config.signalSent, false);

    assert.equal(config.agentApi.sende.call(config, { x: 340, y: 15 }), true);
    assert.equal(config.signalSent, true);
    assert.equal(elements.get("pico-result-message").textContent, "Signal gesendet - gerettet!");

    config.depleted = true;
    config.energy = 0;
    assert.equal(config.agentApi.sende.call(config, { x: 340, y: 15 }), false);
    assert.equal(config.signalSent, false);
});

test("pico energy drain stops movement before an uncollected cell", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    config.onTurtleFrame({ x: -365, y: 55 });
    const stop = config.onTurtleFrame({ x: -330, y: -90 });

    assert.equal(config.energy, 0);
    assert.equal(config.depleted, true);
    assert.equal(stop.stop, true);
    assert.equal(stop.reason, "PICO_ENERGY_DEPLETED");
    assert.match(config.getAutomaticStop().output, /Energiezelle nicht aufgenommen/);
});

test("pico also stops after an excessively long detour with a charged cell", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    config.charged = true;
    config.energy = 100;
    config.onTurtleFrame({ x: -365, y: 55 });
    const stop = config.onTurtleFrame({ x: 500, y: 55 });

    assert.equal(config.energy, 0);
    assert.equal(config.depleted, true);
    assert.equal(stop.stop, true);
    assert.match(config.getAutomaticStop().output, /Weg war zu lang/);
});

test("pico clamps a single oversized turtle move to the reachable endpoint", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    const start = { x: -365, y: 55 };
    const target = { x: 1000, y: 55 };
    config.onTurtleFrame(start);

    const limit = config.limitTurtleMovement(start, target);
    const initialRange = Math.hypot(-380 - start.x, -90 - start.y);
    assert.equal(limit.stop, true);
    assert.ok(Math.abs(limit.x - (start.x + initialRange)) < 0.001);
    assert.equal(limit.y, start.y);

    const stop = config.onTurtleFrame({ x: limit.x, y: limit.y });
    assert.equal(config.energy, 0);
    assert.equal(config.depleted, true);
    assert.equal(stop.stop, true);
});

test("pico accepts a successful creative route without the sample midpoint", () => {
    const { config } = createPicoConfig();
    config.charged = true;
    config.beaconReached = true;
    config.depleted = false;
    config.energy = 30;
    config.signalSent = true;
    config.turtleMarks = 2;
    config.lastRuntimeStatusData = { agent: "NOVA", funk: "gesendet" };
    const creativeCode = config.defaultCode.replace("fahre_zu(0, -90)\n", "");

    const result = config.validate(creativeCode);
    assert.equal(result.passed, true);
    assert.equal(result.checks.some(check => check.label.includes("Wegpunkt")), false);
});

test("pico structure checks ignore comments, strings and unused functions", () => {
    const { config } = createPicoConfig();
    Object.assign(config, {
        charged: true,
        beaconReached: true,
        depleted: false,
        energy: 30,
        signalSent: true,
        turtleMarks: 1,
        lastRuntimeStatusData: { agent: "PICO", funk: "gesendet" }
    });
    const misleadingCode = `import turtle
pico = turtle.Turtle()
pico.goto(-380, -90)

def dekorativ():
    pass

def markiere():
    pico.dot(18)

markiere()
# dekorativ()
# if signal_erfolgreich:
text = "if signal_erfolgreich:"
status = {"AGENT": "PICO", "FUNK": "gesendet"}`;

    const result = config.validate(misleadingCode);
    assert.equal(result.checks.find(check => check.label.includes("Entscheidung")).passed, false);
    assert.equal(result.checks.find(check => check.label.includes("Eigene Funktion")).passed, false);
    assert.equal(result.passed, false);
});

test("pico cannot pass by printing a success marker", () => {
    const { config } = createPicoConfig();
    config.charged = true;
    config.beaconReached = true;
    config.depleted = false;
    config.energy = 25;
    config.signalSent = false;

    const result = config.validate(config.defaultCode, "PICO_STATUS|PICO|gesendet\nSignal gesendet - gerettet!\n");
    assert.equal(result.passed, false);
    assert.equal(result.checks.find(check => check.label.includes("Rettungssignal")).passed, false);
});

test("pico shows truthful green rescue and red failure messages", () => {
    const { config, document, elements } = createPicoConfig();
    config.showRescueResult(true);
    assert.equal(elements.get("pico-result-message").textContent, "Signal gesendet - gerettet!");
    assert.equal(document.body.classList.contains("rescue-success"), true);
    assert.equal(document.body.classList.contains("rescue-failed"), false);

    config.showRescueResult(false);
    assert.equal(elements.get("pico-result-message").textContent, "NICHT GERETTET – SIGNAL FEHLGESCHLAGEN");
    assert.equal(document.body.classList.contains("rescue-success"), false);
    assert.equal(document.body.classList.contains("rescue-failed"), true);
});

test("pico clears a provisional energy warning when the cell is collected", () => {
    const { config, document, elements } = createPicoConfig();
    config.showRescueResult(false, "NICHT GERETTET – ENERGIE LEER");
    config.pendingFind = { item: "Energiezelle", baselineCount: 0 };
    config.charged = false;
    config.depleted = true;
    config.energy = 0;

    const result = config.syncPythonState({
        getGlobal(name) {
            if (name === "status") return { AGENT: "PICO", FUNK: "suche" };
            if (name === "ausruestung") return ["Energiezelle"];
            return undefined;
        }
    });

    assert.equal(result.resumeMovement, true);
    assert.equal(config.charged, true);
    assert.equal(config.depleted, false);
    assert.equal(config.energy, 100);
    assert.equal(elements.get("pico-result-message").textContent, "");
    assert.equal(document.body.classList.contains("rescue-failed"), false);
});

test("pico expires a found energy cell after the agent leaves its position", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    const equipment = [];
    const context = {
        x: -380,
        y: -90,
        getGlobal(name) {
            if (name === "ausruestung") return equipment;
            if (name === "status") return { AGENT: "PICO", FUNK: "suche" };
            return undefined;
        }
    };

    const found = config.agentApi.suche_hier.call(config, context);
    assert.equal(found, "Energiezelle");
    config.onTurtleFrame({ x: -350, y: -90 });
    equipment.push(found);
    config.syncPythonState(context);

    assert.equal(config.pendingFind, null);
    assert.equal(config.charged, false);
    assert.equal(config.energy, 10);
});

test("museum keeps the portal open until alarm level 1, then locks it", () => {
    const { config } = createMuseumConfig();
    config.artifactSecured = true;
    config.alarmDisabled = false;
    config.exitUnlocked = false;

    config.alarmLevel = 0;
    config.renderPortal();
    assert.equal(config.portalOpen, true);

    config.alarmLevel = 1;
    config.renderPortal();
    assert.equal(config.portalOpen, false);
});

test("museum requires real searches and collects keycard before artifact", () => {
    const { config, document, timers } = createMuseumConfig();
    config.resetHud();
    const inventory = [];
    const contextAt = (x, y) => ({
        x,
        y,
        getGlobal(name) { return name === "inventar" ? inventory : undefined; }
    });

    inventory.push("Schlüsselkarte");
    config.syncPythonState(contextAt(0, 0));
    assert.equal(JSON.stringify(config.runtimeInventory), "[]", "Inventar darf ohne Fund nicht gefälscht werden");
    inventory.length = 0;

    const artifactWithoutKey = config.agentApi.suche_hier.call(config, contextAt(-390, 45));
    assert.equal(artifactWithoutKey, null);
    assert.equal(config.artifactSecured, false);

    const keycardContext = contextAt(-250, 60);
    const keycard = config.agentApi.suche_hier.call(config, keycardContext);
    assert.equal(keycard, "Schlüsselkarte");
    config.syncPythonState(keycardContext);
    assert.equal(JSON.stringify(config.runtimeInventory), "[]");
    inventory.push(keycard);
    config.syncPythonState(keycardContext);
    assert.equal(JSON.stringify(config.runtimeInventory), JSON.stringify(["Schlüsselkarte"]));

    const artifactContext = contextAt(-390, 45);
    const artifact = config.agentApi.suche_hier.call(config, artifactContext);
    assert.equal(artifact, "Artefakt");
    inventory.push(artifact);
    config.syncPythonState(artifactContext);
    assert.equal(JSON.stringify(config.runtimeInventory), JSON.stringify(["Schlüsselkarte", "Artefakt"]));
    assert.equal(config.artifactSecured, true);
    assert.equal(config.alarmStarted, true);
    assert.equal(config.alarmLevel, 0);
    assert.equal(config.portalOpen, true);
    assert.equal(document.body.classList.contains("alarm-sound-played"), true);
    assert.equal(timers.filter(timer => timer.type === "interval" && timer.delay === 1000).length, 1);
    config.startAlarm();
    assert.equal(timers.filter(timer => timer.type === "interval" && timer.delay === 1000).length, 1);
});

test("museum locks at alarm level 1 and traps an agent at the portal", () => {
    const { config, document, elements, timers } = createMuseumConfig();
    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte"];
    config.collectItem("Artefakt");
    const alarmTimer = timers.find(timer => timer.type === "interval" && timer.delay === 1000);
    assert.ok(alarmTimer);

    alarmTimer.callback();
    assert.equal(config.alarmLevel, 1);
    assert.equal(config.portalOpen, false);

    config.onTurtleFrame({ x: 0, y: 115 });
    assert.equal(config.escaped, false);
    assert.equal(config.exitUnlocked, false);
    assert.equal(elements.get("museum-warning").textContent, "DU BIST GEFANGEN!");
    assert.equal(document.body.classList.contains("portal-trapped"), true);
    assert.equal(document.body.classList.contains("trapped-sound-played"), true);
});

test("museum rejects wrong-place and wrong-code hacks", () => {
    const { config, elements, timers } = createMuseumConfig();
    config.resetHud();
    config.requestAlarmHack("SERU-7");
    assert.match(elements.get("alarm-console-label").innerHTML, /Noch kein Alarm ausgelöst/);
    assert.equal(config.hackRequested, false);
    assert.equal(timers.filter(timer => timer.type === "timeout" && timer.delay === 1000).length, 0);

    config.alarmStarted = true;
    config.atAlarmConsole = false;
    config.requestAlarmHack("SERU-7");
    assert.match(elements.get("alarm-console-label").innerHTML, /Hack nicht möglich/);
    assert.equal(config.hackRequested, false);

    config.atAlarmConsole = true;
    config.requestAlarmHack("FALSCH");
    assert.match(elements.get("alarm-console-label").innerHTML, /Hackcode falsch/);
    assert.equal(config.hackRequested, false);
    assert.equal(timers.filter(timer => timer.type === "timeout" && timer.delay === 1000).length, 0);
});

test("museum alarm level 8 stops the mission", () => {
    const { config, timers } = createMuseumConfig();
    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte"];
    config.collectItem("Artefakt");
    const alarmTimer = timers.find(timer => timer.type === "interval" && timer.delay === 1000);
    assert.ok(alarmTimer);

    for (let level = 1; level <= 8; level += 1) alarmTimer.callback();
    assert.equal(config.alarmLevel, 8);
    assert.equal(config.alarmFailed, true);
    assert.equal(config.getAutomaticStop().status, "Mission gestoppt");
});

test("museum automatic stop explains the actual hack failure", () => {
    const { config } = createMuseumConfig();
    config.resetHud();
    config.alarmFailed = true;

    assert.match(config.getAutomaticStop().message, /Kein gültiger Hack/);
    config.lastHackFailure = "WRONG_CODE";
    assert.match(config.getAutomaticStop().message, /Hackcode war falsch/);
    config.lastHackFailure = "WRONG_PLACE";
    assert.match(config.getAutomaticStop().message, /nicht an der Alarmkonsole/);
    config.lastHackFailure = "TOO_EARLY";
    assert.match(config.getAutomaticStop().message, /vor dem Alarm/);
    config.hackRequested = true;
    assert.match(config.getAutomaticStop().message, /kam aber zu spät/);
    assert.match(config.getAutomaticStop().output, /Alarmstufe 8/);
});

test("museum reset invalidates already queued alarm and hack callbacks", () => {
    const { config, timers } = createMuseumConfig();
    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte"];
    config.collectItem("Artefakt");
    config.atAlarmConsole = true;
    config.requestAlarmHack("SERU-7");
    const alarmTimer = timers.find(timer => timer.type === "interval" && timer.delay === 1000);
    const hackTimer = timers.find(timer => timer.type === "timeout" && timer.delay === 1000);
    assert.ok(alarmTimer);
    assert.ok(hackTimer);

    config.resetHud();
    alarmTimer.callback();
    hackTimer.callback();

    assert.equal(config.alarmLevel, 0);
    assert.equal(config.alarmFailed, false);
    assert.equal(config.alarmDisabled, false);
    assert.equal(config.hackCompleted, false);
});

test("museum runtime errors stop the active countdown", () => {
    const { config, document, timers } = createMuseumConfig();
    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte"];
    config.collectItem("Artefakt");
    const alarmTimer = timers.find(timer => timer.type === "interval" && timer.delay === 1000);
    assert.ok(alarmTimer);

    config.onRunError(new Error("Python-Fehler"));
    alarmTimer.callback();

    assert.equal(config.alarmLevel, 0);
    assert.equal(config.alarmFailed, false);
    assert.equal(document.body.classList.contains("alarm-active"), false);
});

test("museum terminal escape invalidates a pending hack", () => {
    const { config, timers } = createMuseumConfig();
    config.resetHud();
    config.alarmStarted = true;
    config.artifactSecured = true;
    config.atAlarmConsole = true;
    config.requestAlarmHack("SERU-7");
    const hackTimer = timers.find(timer => timer.type === "timeout" && timer.delay === 1000);
    assert.ok(hackTimer);

    config.escaped = true;
    config.showEscapeSuccess();
    hackTimer.callback();

    assert.equal(config.alarmDisabled, false);
    assert.equal(config.hackCompleted, false);
});

test("museum alarm failure cancels and invalidates a pending hack", () => {
    const { config, timers } = createMuseumConfig();
    config.resetHud();
    config.alarmStarted = true;
    config.artifactSecured = true;
    config.atAlarmConsole = true;
    config.requestAlarmHack("SERU-7");
    const hackTimer = timers.find(timer => timer.type === "timeout" && timer.delay === 1000);
    assert.ok(hackTimer);

    config.failAlarm();
    hackTimer.callback();

    assert.equal(config.alarmFailed, true);
    assert.equal(config.alarmDisabled, false);
    assert.equal(config.hackCompleted, false);
    assert.equal(config.hackFinishTimer, null);
});

test("museum opens the portal after a successful hack and confirms escape", () => {
    const { config, document, elements } = createMuseumConfig();
    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte", "Artefakt"];
    config.artifactSecured = true;
    config.alarmLevel = 3;
    config.alarmDisabled = true;
    config.updateExitState();
    assert.equal(config.portalOpen, true);

    config.onTurtleFrame({ x: 0, y: 115 });
    assert.equal(config.escaped, true);
    assert.equal(config.exitUnlocked, true);
    assert.equal(elements.get("museum-success").textContent, "MISSION ERFOLGREICH – DU BIST ENTKOMMEN!");
    assert.equal(document.body.classList.contains("escape-success"), true);
});

test("museum cannot escape through an open portal without the artifact", () => {
    const { config } = createMuseumConfig();
    config.resetHud();
    assert.equal(config.portalOpen, true);

    config.onTurtleFrame({ x: 0, y: 115 });
    assert.equal(config.portalReached, false);
    assert.equal(config.escaped, false);
    assert.equal(config.exitUnlocked, false);
});

test("museum accepts a speed-8 portal arrival before the first alarm tick", () => {
    const { config } = createMuseumConfig();
    const fastCode = config.defaultCode.replace("agent.speed(4)", "agent.speed(8)");
    assert.match(fastCode, /agent\.speed\(8\)/);
    assert.equal(config.getTurtleSpeedMultiplier(8), 12);
    assert.equal(config.getTurtleSpeedMultiplier(4), 1);

    config.resetHud();
    config.runtimeInventory = ["Schlüsselkarte", "Artefakt"];
    config.artifactSecured = true;
    config.alarmLevel = 0;
    config.alarmDisabled = false;
    config.hackRequested = false;
    config.updateExitState();
    assert.equal(config.portalOpen, true);

    config.onTurtleFrame({ x: 0, y: 115 });
    assert.equal(config.escaped, true);
    assert.equal(config.exitUnlocked, true);

    const result = config.validate(fastCode, "INVENTARLISTE: Schlüsselkarte,Artefakt\n");
    assert.equal(result.passed, true);
    assert.equal(config.hackRequested, false);
});

test("museum validator requires the real inventory line and has no duplicate strategy check", () => {
    const { config } = createMuseumConfig();
    config.resetHud();
    Object.assign(config, {
        runtimeInventory: ["Schlüsselkarte", "Artefakt"],
        artifactSecured: true,
        alarmDisabled: true,
        escaped: true,
        exitUnlocked: true
    });

    const missing = config.validate(config.defaultCode, "Fluchtweg programmiert.\n");
    assert.equal(missing.checks.find(check => check.label.includes("Inventarliste")).passed, false);
    assert.equal(missing.passed, false);

    const exact = config.validate(config.defaultCode, "INVENTARLISTE: Schlüsselkarte,Artefakt\n");
    assert.equal(exact.checks.find(check => check.label.includes("Inventarliste")).passed, true);
    assert.equal(exact.checks.filter(check => check.label.includes("Strategie") || check.label.includes("Alarm gehackt")).length, 1);
    assert.equal(exact.passed, true);
});

test("museum decision check ignores comments and string literals", () => {
    const { config } = createMuseumConfig();
    config.resetHud();
    Object.assign(config, {
        runtimeInventory: ["Schlüsselkarte", "Artefakt"],
        artifactSecured: true,
        alarmDisabled: true,
        escaped: true,
        exitUnlocked: true
    });
    const codeWithoutDecision = `import turtle
agent = turtle.Turtle()
agent.goto(0, 115)
# if fund == "Artefakt":
hinweis = "if fund == 'Artefakt':"`;

    const result = config.validate(codeWithoutDecision, "INVENTARLISTE: Schlüsselkarte,Artefakt\n");
    assert.equal(result.checks.find(check => check.label === "Eigene Entscheidung").passed, false);
    assert.equal(result.passed, false);
});

test("museum reports an early hack and completes a valid hack in one second", () => {
    const { config, elements, timers } = createMuseumConfig();
    config.resetHud();
    config.requestAlarmHack("SERU-7");
    assert.match(elements.get("alarm-console-label").innerHTML, /Noch kein Alarm ausgelöst – Hack nicht möglich!/);

    config.alarmStarted = true;
    config.artifactSecured = true;
    config.alarmLevel = 4;
    config.atAlarmConsole = true;
    config.alarmFailed = false;
    config.alarmDisabled = false;
    config.hackFinishTimer = null;
    config.requestAlarmHack("SERU-7");

    const hackTimers = timers.filter(timer => timer.type === "timeout" && timer.delay === 1000);
    assert.equal(hackTimers.length, 1);
    const hackTimer = hackTimers[0];
    assert.ok(hackTimer, "Der Alarm-Hack muss genau eine Sekunde dauern");
    hackTimer.callback();
    assert.equal(config.alarmDisabled, true);
    assert.equal(config.hackCompleted, true);
    assert.equal(config.alarmLevel, 0);
    assert.equal(config.portalOpen, true);
});

test("finale runtime guards creative code and optimized artwork stays small", () => {
    const runtime = readFileSync(new URL("../prototypes/finale.js", import.meta.url), "utf8");
    const finaleCss = readFileSync(new URL("../prototypes/finale.css", import.meta.url), "utf8");
    assert.match(runtime, /execLimit:\s*8000/);
    assert.match(runtime, /Sk\.execStart = new Date\(\)/);
    assert.match(runtime, /killableWhile:\s*true/);
    assert.match(runtime, /killableFor:\s*true/);
    assert.match(runtime, /lineWrapping:\s*true/);
    assert.match(runtime, /runGeneration/);
    assert.match(runtime, /classList\.toggle\("program-running", nextRunning\)/);
    assert.match(runtime, /resetButton\.disabled = nextRunning && cancelRequested/);
    assert.match(runtime, /■ Mission stoppen/);
    assert.match(runtime, /Sk\.execStart = new Date\(0\)/);
    assert.match(runtime, /config\.onRunError\?\.\(error\)/);
    assert.match(runtime, /config\.onOutput\?\.\(chunk, outputText\)/);
    assert.match(runtime, /installTurtleObserver/);
    assert.match(runtime, /config\.getTurtleSpeedMultiplier/);
    assert.match(runtime, /Teilbereich erfüllt/);
    assert.match(runtime, /Teilbereich prüfen/);
    assert.match(runtime, /installTurtleAgentApi/);
    assert.match(runtime, /defineMethod\("suche_hier"\)/);
    assert.match(runtime, /defineMethod\("sende"\)/);
    assert.match(runtime, /Sk\.abstr\.sattr/);
    assert.match(runtime, /syncPythonState/);
    assert.match(runtime, /config\.onTurtleFrame\?\.\(\{ x: state\.x, y: state\.y \}\)/);
    assert.match(runtime, /config\.onRunStart\?\.\(code\)/);
    assert.match(runtime, /this\.__finaleMovementBlocked/);
    assert.match(runtime, /config\.getAutomaticStop/);
    assert.match(runtime, /finishAutomaticStop\(automaticStop, code\)/);
    assert.match(runtime, /renderPendingChecks/);
    assert.match(runtime, /originalTranslate/);
    assert.match(runtime, /refresh: refreshValidation/);
    assert.match(runtime, /turtleTarget\.replaceChildren\(\)/);
    assert.doesNotMatch(runtime, /localStorage/);
    assert.match(finaleCss, /\.alarm-active \.alarm-flash/);
    assert.match(finaleCss, /\.portal-locked \.portal-gate/);
    assert.match(finaleCss, /\.portal-trapped \.museum-warning/);
    assert.match(finaleCss, /\.escape-success \.museum-success/);
    assert.match(finaleCss, /\.rescue-success \.pico-result-message/);
    assert.match(finaleCss, /\.rescue-failed \.pico-result-message/);
    assert.match(finaleCss, /\.mobile-target-legend/);
    assert.match(finaleCss, /\.prototype-nav-dock/);
    assert.match(finaleCss, /--prototype-glass-surface:/);
    assert.match(finaleCss, /-webkit-backdrop-filter:\s*blur\(/);
    assert.match(finaleCss, /backdrop-filter:\s*blur\(/);
    assert.match(finaleCss, /\.presentation-mode \.prototype-nav-dock/);

    const artwork = [
        "pico-rescue-station.webp",
        "pixel-museum.webp",
        "pixel-museum-recovered.webp"
    ];
    for (const file of artwork) {
        const url = new URL(`../assets/images/finales/${file}`, import.meta.url);
        const bytes = readFileSync(url);
        assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
        assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
        assert.ok(statSync(url).size < 350_000, `${file} ist für die Webseite zu groß`);
    }
});
