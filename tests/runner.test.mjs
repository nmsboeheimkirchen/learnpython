import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { TextDecoder } from "node:util";
import vm from "node:vm";

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.attributes = new Map();
        this.children = [];
        this.disabled = false;
        this.focused = false;
        this.listeners = new Map();
        this.parentNode = null;
        this.style = {};
        this.classList = {
            add() {},
            contains() { return false; },
            remove() {}
        };
        this.textContent = "";
        this.value = "";
    }

    appendChild(child) {
        this.children.push(child);
        if (child && typeof child === "object") child.parentNode = this;
        return child;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, init = {}) {
        const event = {
            preventDefault() {},
            target: this,
            type,
            ...init
        };
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }

    focus() { this.focused = true; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    removeAttribute(name) { this.attributes.delete(name); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    querySelector() { return new FakeElement(); }
}

function createRunnerContext(initialStorage = {}) {
    const storage = new Map(Object.entries(initialStorage));
    const timers = [];
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
        clearInterval(timerId) {
            const timer = timers[timerId - 1];
            if (timer) timer.cleared = true;
        },
        clearTimeout(timerId) {
            const timer = timers[timerId - 1];
            if (timer) timer.cleared = true;
        },
        setInterval(callback, delay) {
            timers.push({ callback, cleared: false, delay, type: "interval" });
            return timers.length;
        },
        setTimeout(callback, delay) {
            timers.push({ callback, cleared: false, delay, type: "timeout" });
            return timers.length;
        },
        window: {
            location: { hash: "", pathname: "/mission3_level3.html" }
        }
    });

    const source = readFileSync(new URL("../assets/runner.js", import.meta.url), "utf8");
    vm.runInContext(source, context);
    return { context, elements, storage, timers };
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

test("an old PICO level 4 completion cannot bypass the new ordered memory task", () => {
    const { context, storage } = createRunnerContext({
        unlockedLevels_v2: JSON.stringify(["link-level1", "link-pico-l4"]),
        completedLevelCode_v1: JSON.stringify({
            pico_level4: '# Alter Abschluss ohne verbindliche Reihenfolge\nprint("fertig")'
        })
    });

    vm.runInContext("applyUnlocks()", context);

    const unlocked = JSON.parse(storage.get("unlockedLevels_v2"));
    assert.equal(unlocked.includes("link-pico-l4"), true);
    assert.equal(unlocked.includes("link-helicopter-escape"), false);
    assert.equal(vm.runInContext('getCompletedLevelCode("pico_level4_memory")', context), null);
    assert.equal(storage.get("completedLevelCode_v1"), "{}");
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

test("stored Agent-training code migrates from agent to drohne when restored", () => {
    const legacyCode = [
        "agent = turtle.Turtle()",
        "agent.pendown()",
        "agent.goto(160, 80)",
        'print("Position:", agent.position())'
    ].join("\n");
    const { context, storage } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({ agent_training_level1: legacyCode })
    });
    const editor = {
        value: "",
        setValue(value) { this.value = value; }
    };
    context.window.editor = editor;

    assert.equal(
        vm.runInContext('restoreCompletedLevelCode("agent_training_level1")', context),
        true
    );
    assert.match(editor.value, /drohne = turtle\.Turtle\(\)/);
    assert.match(editor.value, /drohne\.goto\(160, 80\)/);
    assert.doesNotMatch(editor.value, /\bagent\b/);
    assert.equal(
        JSON.parse(storage.get("completedLevelCode_v1")).agent_training_level1,
        editor.value
    );
});

test("legacy Mission 1 level 4 code migrates into the combined level 3", () => {
    const legacyCode = [
        'agent_name = input("Gib deinen Namen ein: ")',
        'print("Willkommen im System,", agent_name)'
    ].join("\n");
    const { context, storage } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({ mission1_level4: legacyCode })
    });
    const editor = {
        value: "",
        setValue(value) { this.value = value; }
    };
    context.window.editor = editor;

    assert.equal(
        vm.runInContext('restoreCompletedLevelCode("mission1_level3")', context),
        true
    );
    assert.match(editor.value, /^name = input\("Wie heißt du\? "\)$/m);
    assert.match(editor.value, /^print\("Willkommen im System,", name\)$/m);
    assert.doesNotMatch(editor.value, /agent_name|Gib deinen Namen ein/);
    assert.equal(
        JSON.parse(storage.get("completedLevelCode_v1")).mission1_level3,
        editor.value
    );
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

test("Mission 1 waits four seconds before showing its success popup", () => {
    const { context, elements, timers } = createRunnerContext();
    const passingCode = 'print("Verbindung wird hergestellt...")\n';
    let runCount = 0;
    context.runit = callback => {
        runCount += 1;
        callback(passingCode, "Verbindung wird hergestellt...\n");
    };
    context.successEvents = [];
    vm.runInContext("triggerSuccess = (...args) => successEvents.push(args)", context);

    vm.runInContext('setupLevel("mission1_level1")', context);
    const runButton = elements.get("run-btn");
    runButton.dispatch("click");

    assert.equal(vm.runInContext("SUCCESS_POPUP_DELAY_MS", context), 2000);
    assert.equal(vm.runInContext("MISSION1_SUCCESS_POPUP_DELAY_MS", context), 4000);
    for (const levelId of ["mission1_level1", "mission1_level2", "mission1_level3"]) {
        context.levelId = levelId;
        assert.equal(vm.runInContext("successPopupDelayForLevel(levelId)", context), 4000);
    }
    context.levelId = "mission2_level1";
    assert.equal(vm.runInContext("successPopupDelayForLevel(levelId)", context), 2000);
    assert.equal(runCount, 1);
    assert.equal(runButton.disabled, true);
    assert.equal(elements.get("status-text").textContent, "✓ Geschafft – lies kurz dein Ergebnis.");
    assert.equal(context.successEvents.length, 0);

    const popupTimers = timers.filter(timer => timer.type === "timeout");
    assert.equal(popupTimers.length, 1);
    assert.equal(popupTimers[0].delay, 4000);

    runButton.dispatch("click");
    assert.equal(runCount, 1, "Während der Wartezeit darf kein zweiter Lauf starten");
    assert.equal(context.successEvents.length, 0);

    popupTimers[0].callback();
    assert.equal(runButton.disabled, false);
    assert.equal(context.successEvents.length, 1);
    assert.equal(context.successEvents[0][0], false);
});

test("Mission 3 level 2 keeps both required guesses across consecutive runs", () => {
    const { context, elements, storage, timers } = createRunnerContext();
    const code = [
        'tipp = input("Tipp: ")',
        "tipp = int(tipp)",
        "if tipp < 50:",
        '    print("zu niedrig!")',
        "elif tipp > 50:",
        '    print("zu hoch!")'
    ].join("\n");
    const outputs = ["Tipp: 25\nzu niedrig!\n", "Tipp: 75\nzu hoch!\n"];
    context.runit = callback => callback(code, outputs.shift());
    context.successEvents = [];
    vm.runInContext("triggerSuccess = (...args) => successEvents.push(args)", context);

    vm.runInContext('setupLevel("mission3_level2")', context);
    const runButton = elements.get("run-btn");
    runButton.dispatch("click");

    assert.match(elements.get("status-text").textContent, /Zahl über 50/);
    assert.equal(storage.has("completedLevelCode_v1"), false);
    assert.equal(timers.filter(timer => timer.type === "timeout").length, 0);
    assert.equal(runButton.disabled, false);

    runButton.dispatch("click");
    assert.deepEqual(JSON.parse(storage.get("completedLevelCode_v1")), {
        mission3_level2: code
    });
    assert.equal(elements.get("status-text").textContent, "✓ Geschafft – lies kurz dein Ergebnis.");
    assert.equal(timers.filter(timer => timer.type === "timeout").length, 1);
});

test("console input explains Enter and disables Run until Enter is pressed", async () => {
    const { context, elements } = createRunnerContext();
    const runButton = elements.get("run-btn");
    const consoleOutput = elements.get("console-output");

    const answerPromise = vm.runInContext('customInput("Wie heißt du? ")', context);
    const inputWrapper = consoleOutput.children.find(child => child.className === "console-input-wrap");
    assert.ok(inputWrapper);
    const hint = inputWrapper.children.find(child => child.className === "console-enter-hint");
    const input = inputWrapper.children.find(child => child.className === "console-input");

    assert.equal(hint.textContent, "Hier eingeben · Enter drücken ↵");
    assert.equal(hint.getAttribute("role"), "status");
    assert.equal(input.getAttribute("aria-label"), "Eingabe; mit Enter bestätigen");
    assert.equal(input.getAttribute("aria-describedby"), "console-enter-hint");
    assert.equal(input.focused, true);
    assert.equal(runButton.disabled, true);
    assert.equal(runButton.getAttribute("aria-describedby"), "console-enter-hint");

    input.value = "Ada";
    input.dispatch("keydown", { key: "Enter" });

    assert.equal(await answerPromise, "Ada");
    assert.equal(runButton.disabled, false);
    assert.equal(runButton.getAttribute("aria-describedby"), null);
    assert.equal(consoleOutput.children.includes(inputWrapper), false);
    assert.equal(vm.runInContext("currentOutput", context), "Wie heißt du? Ada\n");
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

test("PICO carries code through optional level 2a without making it a gate", () => {
    const level2Code = '# Level 2\nstatus["TRANSPONDER"] = "suche"';
    const level2aCode = '# Level 2a\nstatus["TRANSPONDER"] = "aufgeladen"';
    const skipped = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({ pico_level2: level2Code })
    });
    const completed = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({
            pico_level2: level2Code,
            pico_level2a: level2aCode
        })
    });

    assert.equal(
        vm.runInContext('buildInheritedLevelCode("pico_level3")', skipped.context),
        level2Code
    );
    assert.equal(
        vm.runInContext('buildInheritedLevelCode("pico_level3")', completed.context),
        level2aCode
    );
});

test("the earlier PICO discovery checkpoint is not mistaken for the new navigation completion", () => {
    const { context, storage } = createRunnerContext({
        completedLevelCode_v1: JSON.stringify({
            pico_level1: "fahre_zu(340, 15)"
        })
    });

    assert.equal(
        vm.runInContext('getCompletedLevelCode("pico_level1_navigation")', context),
        null
    );
    assert.deepEqual(JSON.parse(storage.get("completedLevelCode_v1")), {});
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

test("Mission 3 starter bonuses match the beginner progression", () => {
    const mission1Level2 = readFileSync(new URL("../mission1_level2.html", import.meta.url), "utf8");
    const mission3Level2 = readFileSync(new URL("../mission3_level2.html", import.meta.url), "utf8");
    const mission3Level3 = readFileSync(new URL("../mission3_level3.html", import.meta.url), "utf8");
    const level2Starter = mission3Level2.match(/<textarea id="python-editor">([\s\S]*?)<\/textarea>/)?.[1]
        .replace(/\r/g, "");
    const level3Starter = mission3Level3.match(/<textarea id="python-editor">([\s\S]*?)<\/textarea>/)?.[1]
        .replace(/\r/g, "");

    assert.match(mission1Level2, /<h1>Level 2: Pause<\/h1>/);
    assert.doesNotMatch(mission1Level2, /Einen Hack simulieren/);
    assert.equal(
        level2Starter,
        'tipp = input("Tipp: ")\ntipp = int(tipp)\n# Setze hier fort!\n'
    );
    assert.match(mission3Level2, /kurze Schreibweise[\s\S]*tipp = int\(input\("Tipp: "\)\)[\s\S]*ebenfalls akzeptiert/);
    assert.doesNotMatch(mission3Level2, /<h2>Startbonus<\/h2>/);
    assert.ok(
        mission3Level2.indexOf("<h2>Zahlen aus Text machen</h2>") <
            mission3Level2.indexOf("<h2>Zu hoch, zu niedrig</h2>")
    );
    assert.match(mission3Level2, /50 ist der voreingestellte Code/);
    assert.match(mission3Level2, /einmal mit einer Zahl unter 50[\s\S]*noch einmal mit einer Zahl über 50/);
    assert.equal(
        level3Starter,
        [
            "# Ergänze hier den Start",
            "",
            "while tipp != geheim:",
            '    tipp = int(input("Code eingeben: "))',
            "    if tipp < geheim:",
            '        print("Zu niedrig!")',
            "    elif tipp > geheim:",
            '        print("Zu hoch!")',
            "",
            "# Ergänze hier den Abschluss",
            ""
        ].join("\n")
    );
    assert.match(mission3Level3, /Jetzt musst du den gemeinen Code herausfinden/);
    assert.match(mission3Level3, /<h2>Startbonus<\/h2>/);
    assert.doesNotMatch(level3Starter, /import random|random\.randint|tipp\s*=\s*0|print\("Knack!"\)/);
});

test("Mission 1 level 2 teaches the five-second ready sequence and level 3 carries it forward", () => {
    const level2 = readFileSync(new URL("../mission1_level2.html", import.meta.url), "utf8");
    const level3 = readFileSync(new URL("../mission1_level3.html", import.meta.url), "utf8");
    const level3Starter = level3.match(/<textarea id="python-editor">([\s\S]*?)<\/textarea>/)?.[1]
        .replace(/\r/g, "") ?? "";

    assert.match(level2, /lade Werkzeugkiste[\s\S]*>time</);
    assert.match(level2, /zeige Text[\s\S]*Verbindung wird hergestellt/);
    assert.match(level2, /pausiere \(s\)[\s\S]*>5</);
    assert.match(level2, /print\("System bereit!"\)/);
    assert.match(level2, /Python-Codeausschnitt:[\s\S]*import time[\s\S]*time\.sleep\(5\)/);
    assert.match(level2, /Das Python-Modul <code>time<\/code> zählt in Sekunden/);
    assert.match(level3, /<h1>Level 3: Weiter geht‘s mit der Indentification<\/h1>/);
    assert.match(level3Starter, /^import time\nprint\("Verbindung wird hergestellt\.\.\."\)\ntime\.sleep\(5\)\nprint\("System bereit!"\)/);
});

const validSolutions = [
    {
        level: "mission1_level1",
        code: 'print("Verbindung wird hergestellt...")',
        output: "Verbindung wird hergestellt...\n"
    },
    {
        level: "mission1_level2",
        code: 'import time\nprint("Verbindung wird hergestellt...")\ntime.sleep(5)\nprint("System bereit!")',
        output: "Verbindung wird hergestellt...\nSystem bereit!\n"
    },
    {
        level: "mission1_level3",
        code: 'name = input("Wie heißt du? ")\nprint("Willkommen im System,", name)',
        output: "Wie heißt du? Ada\nWillkommen im System, Ada\n"
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
        code: 'kabel = input("Welches Kabel? ")\nif kabel == "rot":\n    print("Entschärft!")\nelif kabel == "blau":\n    print("Nichts passiert.")\nelse:\n    print("KABUMM!")',
        output: "Welches Kabel? blau\nNichts passiert.\n"
    },
    {
        level: "mission3_level1",
        code: 'tipp = ""\nwhile tipp != "123":\n    tipp = input("Code eingeben: ")',
        output: "Code eingeben: 123\n"
    },
    {
        level: "mission3_level2",
        code: 'tipp = input("Tipp: ")\ntipp = int(tipp)\nif tipp < 50:\n    print("zu niedrig!")\nelif tipp > 50:\n    print("zu hoch!")',
        output: "Tipp: 75\nzu hoch!\n",
        evidence: { sawLowerHint: true }
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
        code: 'drohne.pendown()\ndrohne.goto(160, 80)\ndrohne.penup()\ndrohne.dot(30)\nprint("Position:", drohne.position())',
        output: "Position: (160.00,80.00)\n"
    },
    {
        level: "agent_training_level2",
        code: [
            "def gehe_zu(x, y):",
            "    drohne.goto(x, y)",
            "def markiere():",
            "    drohne.dot(30)",
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
            "fund = drohne.suche_hier()",
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
            context.evidence = solution.evidence || {};
            const result = vm.runInContext("validateLevelSolution(levelId, code, output, evidence)", context);
            assert.equal(result.passed, true, result.message);
        });
    }
});

test("Mission 1 level 3 requires name, the exact question, and the welcome output", () => {
    const { context } = createRunnerContext();
    const invalidSolutions = [
        {
            code: 'agent_name = input("Wie heißt du? ")\nprint("Willkommen im System,", agent_name)',
            output: "Wie heißt du? Ada\nWillkommen im System, Ada\n",
            message: /Variable name/
        },
        {
            code: 'name = input("Name: ")\nprint("Willkommen im System,", name)',
            output: "Name: Ada\nWillkommen im System, Ada\n",
            message: /Wie heißt du/
        },
        {
            code: 'name = input("Wie heißt du? ")',
            output: "Wie heißt du? Ada\nWillkommen im System, Ada\n",
            message: /Text und name/
        }
    ];

    for (const solution of invalidSolutions) {
        context.code = solution.code;
        context.output = solution.output;
        const result = vm.runInContext(
            'validateLevelSolution("mission1_level3", code, output)',
            context
        );
        assert.equal(result.passed, false);
        assert.match(result.message, solution.message);
    }
});

test("Mission 1 level 2 requires five seconds, the ready message, and the target order", () => {
    const { context } = createRunnerContext();
    const invalidSolutions = [
        {
            code: 'import time\nprint("Verbindung wird hergestellt...")\ntime.sleep(1)\nprint("System bereit!")',
            output: "Verbindung wird hergestellt...\nSystem bereit!\n",
            message: /time\.sleep\(5\)/
        },
        {
            code: 'import time\nprint("Verbindung wird hergestellt...")\ntime.sleep(5)',
            output: "Verbindung wird hergestellt...\n",
            message: /System bereit/
        },
        {
            code: 'import time\nprint("System bereit!")\nprint("Verbindung wird hergestellt...")\ntime.sleep(5)',
            output: "System bereit!\nVerbindung wird hergestellt...\n",
            message: /vier Zeilen/
        }
    ];

    for (const solution of invalidSolutions) {
        context.code = solution.code;
        context.output = solution.output;
        const result = vm.runInContext(
            'validateLevelSolution("mission1_level2", code, output)',
            context
        );
        assert.equal(result.passed, false);
        assert.match(result.message, solution.message);
    }
});

test("Mission 2 level 2 accepts several colors other than red", () => {
    const { context } = createRunnerContext();

    for (const color of ["blau", "grün", "gelb"]) {
        context.code = [
            `kabel = ${JSON.stringify(color)}`,
            'if kabel == "rot":',
            '    print("Entschärft!")',
            "else:",
            '    print("KABUMM!")'
        ].join("\n");
        context.output = "KABUMM!\n";
        const result = vm.runInContext(
            'validateLevelSolution("mission2_level2", code, output)',
            context
        );
        assert.equal(result.passed, true, `${color}: ${result.message}`);
    }

    context.code = 'kabel = "rot"\nif kabel == "rot":\n    print("Entschärft!")\nelse:\n    print("KABUMM!")';
    context.output = "KABUMM!\n";
    const red = vm.runInContext(
        'validateLevelSolution("mission2_level2", code, output)',
        context
    );
    assert.equal(red.passed, false);
    assert.match(red.message, /außer.*rot/);
});

test("Mission 2 level 3 consistently requires the blue no-op message", () => {
    const { context } = createRunnerContext();
    context.code = [
        'kabel = input("Welches Kabel? ")',
        'if kabel == "rot":',
        '    print("Entschärft!")',
        'elif kabel == "blau":',
        '    print("Kurzschluss!")',
        "else:",
        '    print("KABUMM!")'
    ].join("\n");
    context.output = "Welches Kabel? blau\nKurzschluss!\n";

    const result = vm.runInContext(
        'validateLevelSolution("mission2_level3", code, output)',
        context
    );
    assert.equal(result.passed, false);
    assert.match(result.message, /Nichts passiert\./);
});

test("Mission 3 level 2 accepts both number conversions but requires both guesses", () => {
    const { context } = createRunnerContext();
    context.code = 'tipp = input("Tipp: ")\ntipp = int(tipp)\nif tipp < 50:\n    print("zu niedrig!")\nelif tipp > 50:\n    print("zu hoch!")';
    context.output = "Tipp: 12\nzu niedrig!\n";
    context.evidence = {};
    const lowerAttempt = vm.runInContext(
        'validateLevelSolution("mission3_level2", code, output, evidence)',
        context
    );
    assert.equal(lowerAttempt.passed, false);
    assert.deepEqual(JSON.parse(JSON.stringify(lowerAttempt.evidence)), {
        sawLowerHint: true,
        sawHigherHint: false
    });
    assert.match(lowerAttempt.message, /Zahl über 50/);

    context.code = 'tipp = int(input("Tipp: "))\nif tipp < 50:\n    print("zu niedrig!")\nelif tipp > 50:\n    print("zu hoch!")';
    context.output = "Tipp: 75\nzu hoch!\n";
    context.evidence = lowerAttempt.evidence;
    const higherAttempt = vm.runInContext(
        'validateLevelSolution("mission3_level2", code, output, evidence)',
        context
    );
    assert.equal(higherAttempt.passed, true, higherAttempt.message);
    assert.deepEqual(JSON.parse(JSON.stringify(higherAttempt.evidence)), {
        sawLowerHint: true,
        sawHigherHint: true
    });

    const rejectedSolutions = [
        'tipp = input("Tipp: ")',
        "tipp = int(tipp)\ntipp = input(\"Tipp: \")"
    ];
    for (const inputCode of rejectedSolutions) {
        context.code = `${inputCode}\nif tipp < 50:\n    print("zu niedrig!")\nelif tipp > 50:\n    print("zu hoch!")`;
        context.output = "Tipp: 12\nzu niedrig!\n";
        context.evidence = { sawLowerHint: true, sawHigherHint: true };
        const result = vm.runInContext(
            'validateLevelSolution("mission3_level2", code, output, evidence)',
            context
        );
        assert.equal(result.passed, false);
        assert.match(result.message, /int\(tipp\)|int\(input/);
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
        "drohne.pendown()",
        "drohne.goto(160, 80)",
        "drohne.penup()",
        "# print(drohne.position())",
        'print("drohne.position()")'
    ].join("\n");
    context.output = "drohne.position()\n";

    const result = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, output)',
        context
    );

    assert.equal(result.passed, false);
    assert.match(result.message, /Drohnenposition/);

    context.code = [
        "drohne.pendown()",
        "drohne.goto(160, 80)",
        "drohne.penup()",
        "def nie_aufgerufen():",
        "    print(drohne.position())",
        'print("Position: (160, 80)")'
    ].join("\n");
    context.output = "Position: (160, 80)\n";
    const deadPositionPrint = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, output)',
        context
    );
    assert.equal(deadPositionPrint.passed, false);
    assert.equal(deadPositionPrint.evidence.printsRealPosition, false);
});

test("Agent training trail checks require real commands in their teaching order", () => {
    const { context } = createRunnerContext();
    context.code = [
        "drohne.penup()",
        "drohne.goto(160, 80)",
        "drohne.pendown()",
        'print("Position:", drohne.position())'
    ].join("\n");

    let result = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, "")',
        context
    );
    assert.equal(result.passed, false);
    assert.match(result.message, /pendown/);

    context.code = [
        "drohne.pendown()",
        "drohne.goto(160, 80)",
        "drohne.penup()",
        'print("Position:", drohne.position())'
    ].join("\n");
    result = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, "")',
        context
    );
    assert.equal(result.passed, true, result.message);
});

test("legacy agent variable is not accepted as a new training solution", () => {
    const { context } = createRunnerContext();
    context.code = [
        "agent = turtle.Turtle()",
        "agent.pendown()",
        "agent.goto(160, 80)",
        "agent.penup()",
        "agent.dot(30)",
        'print("Position:", agent.position())'
    ].join("\n");

    const result = vm.runInContext(
        'validateLevelSolution("agent_training_level1", code, "Position: (160, 80)\\n")',
        context
    );

    assert.equal(result.passed, false);
    assert.equal(result.evidence.usesTrailControls, false);
    assert.equal(result.evidence.printsRealPosition, false);
});

test("Agent training level 2 requires called functions instead of direct or unused code", () => {
    const { context } = createRunnerContext();
    const directRoute = [
        "def gehe_zu(x, y):",
        "    drohne.goto(x, y)",
        "def markiere():",
        "    drohne.dot(30)",
        "drohne.goto(-160, 40)",
        "drohne.dot(30)",
        "drohne.goto(80, 130)",
        "drohne.dot(30)"
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
        "    drohne.goto(a, b)",
        "def punkt():",
        "    drohne.dot(30)",
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
        '# fund = drohne.suche_hier()',
        'print("fund = drohne.suche_hier(); Gefunden: Datenchip")',
        '# if fund == "Datenchip": inventar.append(fund)'
    ].join("\n");
    context.output = "fund = drohne.suche_hier(); Gefunden: Datenchip\n";

    const result = vm.runInContext(
        'validateLevelSolution("agent_training_level3", code, output)',
        context
    );
    assert.equal(result.passed, false);
    assert.match(result.message, /suche_hier/);

    context.code = [
        "fund = drohne.suche_hier()",
        'print("Datenchip")',
        "def nie_aufgerufen():",
        "    print(fund)",
        "inventar.append(fund)"
    ].join("\n");
    const deadPrintResult = vm.runInContext(
        'validateLevelSolution("agent_training_level3", code, "Datenchip\\n")',
        context
    );
    assert.equal(deadPrintResult.passed, false);
    assert.equal(deadPrintResult.evidence.printsFund, false);
    assert.match(deadPrintResult.message, /print\(fund\)/);

    context.code = [
        "fund = drohne.suche_hier()",
        "print(fund)",
        'if fund == "Datenchip":',
        "    pass",
        "inventar.append(fund)"
    ].join("\n");
    const danglingGuard = vm.runInContext(
        'validateLevelSolution("agent_training_level3", code, "Datenchip\\n")',
        context
    );
    assert.equal(danglingGuard.evidence.directAppend, true);
    assert.equal(danglingGuard.evidence.guardedAppend, false);
    assert.equal(danglingGuard.evidence.hasFundGuard, true);

    context.code = [
        "fund = drohne.suche_hier()",
        "print(fund)",
        "def nie_aufgerufen():",
        '    if fund == "Datenchip":',
        "        inventar.append(fund)",
        "inventar.append(fund)"
    ].join("\n");
    const deadGuard = vm.runInContext(
        'validateLevelSolution("agent_training_level3", code, "Datenchip\\n")',
        context
    );
    assert.equal(deadGuard.evidence.guardedAppend, false);
    assert.equal(deadGuard.evidence.directAppend, true);
    assert.equal(deadGuard.evidence.hasFundGuard, true);
});

test("Agent training validates real target, mark and position output as one runtime chain", () => {
    const core = createAgentTrainingCore();

    const wrongTarget = core.createState();
    core.recordPosition(wrongTarget, { x: 80, y: 160 });
    core.recordMark(wrongTarget, { x: 80, y: 160 });
    assert.equal(core.validate(wrongTarget, "Position: (160, 80)", true).passed, false);

    const missingMark = core.createState();
    core.recordPosition(missingMark, core.TARGET, { trailDown: true });
    assert.equal(core.validate(missingMark, "Position: (160, 80)", true).passed, false);

    const hardcodedWithoutPositionCall = core.createState();
    core.recordPosition(hardcodedWithoutPositionCall, core.TARGET, { trailDown: true });
    core.recordMark(hardcodedWithoutPositionCall, core.TARGET);
    assert.equal(
        core.validate(hardcodedWithoutPositionCall, "Position: (160, 80)", false).passed,
        false
    );

    const valid = core.createState();
    core.recordPosition(valid, core.TARGET, { trailDown: true });
    core.recordPosition(valid, core.TARGET, { trailDown: false });
    core.recordMark(valid, { x: 161, y: 79 });
    const result = core.validate(valid, "Position: (160.00,80.00)\n", true);
    assert.equal(result.passed, true);
    assert.equal(result.checks.every(check => check.passed), true);

    const targetReachedAfterTrailWasDisabled = core.createState();
    core.recordPosition(targetReachedAfterTrailWasDisabled, { x: 10, y: 10 }, { trailDown: true });
    core.recordPosition(targetReachedAfterTrailWasDisabled, core.TARGET, { trailDown: false });
    core.recordMark(targetReachedAfterTrailWasDisabled, core.TARGET);
    assert.equal(
        core.validate(
            targetReachedAfterTrailWasDisabled,
            "Position: (160, 80)",
            { evidence: { printsRealPosition: true, usesTrailControls: true } }
        ).passed,
        false
    );

    const trailLeftOnAtTarget = core.createState();
    core.recordPosition(trailLeftOnAtTarget, { x: 0, y: 0 }, { trailDown: true });
    core.recordPosition(trailLeftOnAtTarget, core.TARGET, { trailDown: true });
    core.recordMark(trailLeftOnAtTarget, core.TARGET);
    assert.equal(
        core.validate(
            trailLeftOnAtTarget,
            "Position: (160, 80)",
            { evidence: { printsRealPosition: true, usesTrailControls: true } }
        ).passed,
        false
    );

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
    const guardedStructure = {
        evidence: {
            searchAssignment: true,
            printsFund: true,
            guardedAppend: true,
            hasFundGuard: true
        }
    };
    const state = core.createState("agent_training_level3");

    assert.equal(core.searchHere(state, { x: 0, y: 0 }), null);
    assert.equal(core.searchHere(state, { x: -210, y: 65 }), null);
    core.recordCollection(state, true);
    assert.equal(
        core.validate(state, "Datenchip\n", guardedStructure, { level3Phase: "guarded" }).passed,
        false
    );

    assert.equal(core.searchHere(state, { x: -210, y: -65 }), "Datenchip");
    core.recordCollection(state, false);
    assert.equal(
        core.validate(state, "Datenchip\n", guardedStructure, { level3Phase: "guarded" }).passed,
        false
    );

    core.recordCollection(state, true);
    const guardedResult = core.validate(
        state,
        "Datenchip\n",
        guardedStructure,
        { level3Phase: "guarded" }
    );
    assert.equal(guardedResult.passed, false);
    assert.equal(guardedResult.phaseComplete, true);
    assert.deepEqual(Array.from(guardedResult.checks, check => check.passed), [true, true, true, false]);

    const mixedGuardedResult = core.validate(
        state,
        "Datenchip\n",
        { evidence: { ...guardedStructure.evidence, directAppend: true } },
        { level3Phase: "guarded" }
    );
    assert.equal(mixedGuardedResult.phaseComplete, false);
    assert.equal(mixedGuardedResult.checks[2].passed, false);

    const directStructure = {
        evidence: {
            searchAssignment: true,
            printsFund: true,
            guardedAppend: false,
            directAppend: true,
            hasFundGuard: false
        }
    };
    const directResult = core.validate(
        state,
        "Datenchip\n",
        directStructure,
        { level3Phase: "direct" }
    );
    assert.equal(directResult.passed, true);
    assert.equal(directResult.checks.every(check => check.passed), true);

    const mixedResult = core.validate(
        state,
        "Datenchip\n",
        { evidence: { ...directStructure.evidence, guardedAppend: true, hasFundGuard: true } },
        { level3Phase: "direct" }
    );
    assert.equal(mixedResult.passed, false);
    assert.equal(mixedResult.checks[2].passed, true);
    assert.equal(mixedResult.checks[3].passed, false);
});

const teacherSolutionExpectations = new Map([
    ["mission1_level1", /Verbindung wird hergestellt/],
    ["mission1_level2", /time\.sleep\(5\)[\s\S]*System bereit!/],
    ["mission1_level3", /time\.sleep\(5\)[\s\S]*System bereit![\s\S]*name = input\("Wie heißt du\? "\)[\s\S]*Willkommen im System/],
    ["mission2_level1", /kabel = "rot"/],
    ["mission2_level2", /else:/],
    ["mission2_level3", /elif kabel == "blau":[\s\S]*Nichts passiert\./],
    ["mission3_level1", /while tipp != "123":/],
    ["mission3_level2", /tipp = input\("Tipp: "\)[\s\S]*tipp = int\(tipp\)[\s\S]*elif tipp > 50:/],
    ["mission3_level3", /random\.randint\(1, 100\)/],
    ["mission4_level1", /for buchstabe in nachricht:/],
    ["mission4_level2", /ord\(buchstabe\)/],
    ["mission4_level3", /geheimtext = geheimtext \+ chr\(zahl\)/],
    ["agent_training_level1", /drohne\.pendown\(\)[\s\S]*drohne\.goto\(160, 80\)[\s\S]*drohne\.penup\(\)[\s\S]*drohne\.dot\(30,/],
    ["agent_training_level2", /def markiere\(\):[\s\S]*gehe_zu\(80, 130\)/],
    ["agent_training_level3", /gehe_zu\(-210, -65\)[\s\S]*if fund == "Datenchip":[\s\S]*inventar\.append\(fund\)/],
    ["pico_level1", /fahre_zu\(340, 15\)/],
    ["pico_level2", /fund = drohne\.suche_hier\(\)[\s\S]*ausruestung\.append\(fund\)/],
    ["pico_level2a", /status\["TRANSPONDER"\] = "aufgeladen"/],
    ["pico_level3", /signal_erfolgreich = drohne\.sende\(\)/],
    ["pico_level4", /if signal_erfolgreich:[\s\S]*status\["DROHNE"\] = "self-destroy"[\s\S]*status\["TRANSPONDER"\] = "delete"/],
    ["pixelmuseum_briefing", /gehe_zu\(-230, 70\)[\s\S]*inventar\.append\(fund\)[\s\S]*gehe_zu\(-70, -75\)/]
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

    assert.equal(window.TeacherSolutions.load("pico_level1_cell"), true);
    assert.match(editor.value, /fahre_zu\(-380, -90\)/);
});

test("stored teacher mode keeps PICO solutions visible after hashless navigation", () => {
    const editor = {
        value: "",
        focus() {},
        setValue(value) { this.value = value; }
    };
    const button = {
        dataset: { teacherSolution: "pico_level2" },
        style: { display: "none" },
        addEventListener(type, listener) {
            if (type === "click") this.click = listener;
        }
    };
    let domReady;
    const document = {
        addEventListener(type, listener) {
            if (type === "DOMContentLoaded") domReady = listener;
        },
        querySelectorAll() { return [button]; }
    };
    const window = {
        atob(encoded) { return Buffer.from(encoded, "base64").toString("binary"); },
        editor,
        location: { hash: "" },
        localStorage: { getItem(key) { return key === "cheatMode" ? "true" : null; } }
    };
    const context = vm.createContext({ document, TextDecoder, Uint8Array, window });
    const source = readFileSync(new URL("../assets/teacher-solutions.js", import.meta.url), "utf8");
    vm.runInContext(source, context);

    domReady();
    assert.equal(button.style.display, "block");
    button.click();
    assert.match(editor.value, /fund = drohne\.suche_hier\(\)/);
});

const missionPages = [
    "mission1_start.html",
    "mission1_level1.html",
    "mission1_level2.html",
    "mission1_level3.html",
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

const activeIntroMissionLevelPages = [
    "mission1_level1.html",
    "mission1_level2.html",
    "mission1_level3.html",
    "mission2_level1.html",
    "mission2_level2.html",
    "mission2_level3.html",
    "mission3_level1.html",
    "mission3_level2.html",
    "mission3_level3.html"
];

test("Mission 1 exposes three active levels and keeps level 4 only as a legacy redirect", () => {
    const legacy = readFileSync(new URL("../mission1_level4.html", import.meta.url), "utf8");
    const navigation = readFileSync(new URL("../assets/navigation.js", import.meta.url), "utf8");

    assert.equal(missionPages.includes("mission1_level4.html"), false);
    assert.match(legacy, /http-equiv="refresh" content="0; url=mission1_level3\.html"/);
    assert.match(legacy, /window\.location\.replace\("mission1_level3\.html" \+ window\.location\.hash\)/);
    assert.match(legacy, /Level 4 ist jetzt Teil von Level 3/);
    assert.doesNotMatch(navigation, /link-level4|mission1_level4\.html/);
});

test("Missions 1 to 3 use clear code and result labels without legacy wording", () => {
    for (const page of activeIntroMissionLevelPages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.match(html, /<h2>Python-Code<\/h2>/, `${page}: Python-Code fehlt`);
        assert.match(
            html,
            /<h2 class="console-heading" id="console-heading">Ergebnis<\/h2>/,
            `${page}: Ergebnis fehlt`
        );
        assert.doesNotMatch(
            html,
            /Python Terminal|Bereit für deine Befehle|schwarzen? Fenster|Drohnencode/i,
            `${page} enthält noch eine alte Bezeichnung`
        );
    }

    const missionOne = activeIntroMissionLevelPages
        .filter(page => page.startsWith("mission1_"))
        .map(page => readFileSync(new URL(`../${page}`, import.meta.url), "utf8"))
        .join("\n");
    const missionTwo = activeIntroMissionLevelPages
        .filter(page => page.startsWith("mission2_"))
        .map(page => readFileSync(new URL(`../${page}`, import.meta.url), "utf8"))
        .join("\n");
    assert.doesNotMatch(missionOne, /agent_name|Gib deinen Namen ein/);
    assert.doesNotMatch(missionTwo, /Fallback|Kurzschluss/);

    const runner = readFileSync(new URL("../assets/runner.js", import.meta.url), "utf8");
    assert.doesNotMatch(runner, /Sehr starker Drohnencode/);
});

test("the first three mission finales point to the following mission", () => {
    const handoffs = new Map([
        ["mission1_level3.html", "mission2_start.html"],
        ["mission2_level3.html", "mission3_start.html"],
        ["mission3_level3.html", "mission4_start.html"]
    ]);
    const { context } = createRunnerContext();
    const outcomes = JSON.parse(vm.runInContext("JSON.stringify(LEVEL_OUTCOMES)", context));

    for (const [page, target] of handoffs) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.match(
            html,
            new RegExp(`<button id="next-level-btn"[^>]*window\\.location\\.href='${target}'[^>]*>Nächste Mission<\\/button>`)
        );
    }

    assert.deepEqual(outcomes.mission1_level3, {
        unlocks: ["link-m2-title", "link-m2-l1"],
        finale: true
    });
    assert.deepEqual(outcomes.mission2_level3, {
        unlocks: ["link-m3-title", "link-m3-l1"],
        finale: true
    });
    assert.deepEqual(outcomes.mission3_level3, {
        unlocks: ["link-m4-title", "link-m4-l1"],
        finale: true
    });
});

test("Mission 2 level 3 is optional and starts before the elif is added", () => {
    const html = readFileSync(new URL("../mission2_level3.html", import.meta.url), "utf8");
    const starter = html.match(/<textarea id="python-editor">([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    const { context } = createRunnerContext();
    const outcomes = JSON.parse(vm.runInContext("JSON.stringify(LEVEL_OUTCOMES)", context));

    assert.match(html, /Dieses Level ist optional/);
    assert.match(html, /data-skip-unlocks="link-m3-title link-m3-l1"/);
    assert.match(html, /elif kabel == "blau":[\s\S]*print\("Nichts passiert\."\)/);
    assert.match(starter, /kabel = input\("Welches Kabel\? "\)/);
    assert.match(starter, /if kabel == "rot":/);
    assert.match(starter, /else:/);
    assert.doesNotMatch(starter, /\belif\b|Nichts passiert\./);
    assert.deepEqual(outcomes.mission2_level2.unlocks, [
        "link-m2-l3",
        "link-m3-title",
        "link-m3-l1"
    ]);
});

test("Mission 3 level 1 explains Python != as mathematical not-equal", () => {
    const html = readFileSync(new URL("../mission3_level1.html", import.meta.url), "utf8");
    assert.match(html, /<code>!=<\/code> bedeutet <strong>ungleich<\/strong>/);
    assert.match(html, /mathematischen Zeichen <strong>≠<\/strong>/);
});

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

    assert.equal(referencedVendorFiles.size, 8);

    const checksumFile = readFileSync(new URL("../assets/vendor/SHA256SUMS", import.meta.url), "utf8");
    const expectedChecksums = new Map(
        checksumFile.trim().split(/\r?\n/).map(line => {
            const [hash, relativePath] = line.split(/\s{2,}/);
            return [relativePath, hash];
        })
    );
    assert.equal(expectedChecksums.size, 12);

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
        "link-museum-title",
        "link-museum-briefing",
        "link-museum-finale",
        "link-helicopter-escape",
        "reset-progress-btn"
    ];
    for (const id of expectedNavigationIds) {
        assert.equal(elementsById.has(id), true, `${id} fehlt in der zentralen Navigation`);
    }
    assert.equal(elementsById.has("link-level4"), false);

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
        assert.match(html, /<script src="assets\/navigation\.js\?v=20260722-1"><\/script>/);
        assert.match(html, /<link rel="stylesheet" href="assets\/style\.css\?v=20260722-2">/);
        assert.match(html, /<script src="assets\/runner\.js\?v=20260722-4"><\/script>/);
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
        "link-agent-training-l3": "agent_training_level3.html",
        "link-project-choice": "projektwahl.html",
        "link-pico-title": "pico_level1.html",
        "link-pico-l1": "pico_level1.html",
        "link-pico-l2": "pico_level2.html",
        "link-pico-l2a": "pico_level2a.html",
        "link-pico-l3": "pico_level3.html",
        "link-pico-l4": "pico_level4.html",
        "link-museum-title": "pixelmuseum_briefing.html",
        "link-museum-briefing": "pixelmuseum_briefing.html",
        "link-museum-finale": "pixelmuseum_finale.html",
        "link-helicopter-escape": "helikopter_flucht-b.html"
    });
});

test("mission pages use the central drawer without legacy offsets and contain one balanced main", () => {
    assert.equal(missionPages.length, 20);

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
    assert.match(trainingStart, /Eine Python-Turtle ist so etwas wie eine Drohne/);
    assert.doesNotMatch(trainingStart, /Im Code heißt deine Drohne/);
    assert.match(trainingStart, /3 kurze Trainingslevel/);
    assert.match(trainingStart, /markierst wichtige Orte und untersuchst Fundstücke\./);
    assert.doesNotMatch(trainingStart, /später echte Suchergebnisse/);
    assert.match(trainingLevel1, /drohne\.goto\(160, 80\)/);
    assert.match(trainingLevel1, /drohne\.pendown\(\)/);
    assert.match(trainingLevel1, /drohne\.penup\(\)/);
    assert.match(trainingLevel1, /drohne\.dot\(30, &quot;#7df2a9&quot;\)|drohne\.dot\(30, "#7df2a9"\)/);
    assert.match(trainingLevel1, /drohne\.position\(\)/);
    const starter = trainingLevel1.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.match(starter, /drohne\.speed\(2\)\s*\ndrohne\.penup\(\)/);
    assert.doesNotMatch(starter, /drohne\.speed\(4\)/);
    assert.match(trainingLevel1, /id="training-marks-layer" class="training-marks-layer"/);
    assert.match(trainingLevel1, /<code>penup\(\)<\/code>: Spur ausschalten\./);
    assert.match(trainingLevel1, /Nächstes Level/);

    const level2Starter = trainingLevel2.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.match(level2Starter, /def markiere\(\):\s*\n\s+pass/);
    assert.doesNotMatch(level2Starter, /gehe_zu\(80, 130\)\s*\nmarkiere\(\)/);
    assert.match(trainingLevel2, /drohne\.dot\(30, &quot;#7df2a9&quot;\)|drohne\.dot\(30, "#7df2a9"\)/);
    assert.match(trainingLevel2, /class="block-hint"/);
    assert.match(trainingLevel2, /class="microcode-separator" aria-hidden="true"><span>•••<\/span>/);
    assert.match(trainingLevel2, /Deine erste Funktion ist vorbereitet\./);
    assert.match(trainingLevel2, /Danach ergänze die zwei Aufrufe für B\./);

    const level3Starter = trainingLevel3.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.doesNotMatch(level3Starter, /fund\s*=\s*drohne\.suche_hier/);
    assert.match(level3Starter, /gehe_zu\(-210, -65\)/);
    assert.match(trainingLevel3, /fund = drohne\.suche_hier\(\)/);
    assert.match(trainingLevel3, /inventar\.append\(fund\)/);
    assert.match(trainingLevel3, /microcode-indent-1/);
    assert.match(trainingLevel3, /data-training-phase="guarded"/);
    assert.match(trainingLevel3, /data-training-phase="direct" hidden/);
    assert.match(trainingLevel3, /Fund direkt ins Inventar aufnehmen/);
    assert.match(trainingLevel3, /ohne „<code>if<\/code>“/);
    assert.match(trainingLevel3, /id="next-level-btn"[^>]+projektwahl\.html[^>]*>Projekt wählen<\/button>/);

    const trainingRuntime = readFileSync(new URL("../assets/agent-training.js", import.meta.url), "utf8");
    const trainingCore = readFileSync(new URL("../assets/agent-training-core.js", import.meta.url), "utf8");
    const runner = readFileSync(new URL("../assets/runner.js", import.meta.url), "utf8");
    const teacherSolutions = readFileSync(new URL("../assets/teacher-solutions.js", import.meta.url), "utf8");
    assert.match(trainingRuntime, /symbol: "graduation-cap"/);
    assert.match(trainingRuntime, /symbol: "diploma"/);
    assert.match(trainingRuntime, /celebration: "fireworks"/);
    assert.match(trainingRuntime, /primaryHref: "projektwahl\.html"/);
    assert.match(trainingCore, /Dein Datenchip stammt aus einer Suche und liegt nachweislich im Inventar\./);
    assert.doesNotMatch(trainingCore, /Datenchip echt gefunden/);
    assert.match(runner, /function triggerTrainingFireworks\(\)/);
    assert.match(teacherSolutions, /agent_training_level3_direct:/);

    const trainingCss = readFileSync(new URL("../assets/agent-training.css", import.meta.url), "utf8");
    assert.match(trainingCss, /\.training-fireworks canvas/);
    assert.match(trainingLevel3, /assets\/vendor\/fireworks-js\/2\.10\.8\/index\.umd\.js/);
    assert.match(trainingCss, /\.training-live-dot\s*\{[\s\S]*animation:\s*none;/);
    assert.doesNotMatch(trainingCss, /\.training-complete\s+\.training-target-halo/);
    assert.doesNotMatch(trainingStart + trainingLevel1 + trainingLevel2 + trainingLevel3, /pico_finale|pixelmuseum_finale/);
});

test("project choice opens PICO and the required Pixelmuseum briefing", () => {
    const projectChoice = readFileSync(new URL("../projektwahl.html", import.meta.url), "utf8");
    const projectChoiceCss = readFileSync(new URL("../assets/project-choice.css", import.meta.url), "utf8");

    assert.match(projectChoice, /Welche Mission übernimmst du\?/);
    assert.match(projectChoice, /drohne\.goto\(\)/);
    assert.match(projectChoice, /drohne\.dot\(\)/);
    assert.match(projectChoice, /drohne\.suche_hier\(\)/);
    assert.match(projectChoice, /eigene Funktionen/);
    assert.match(projectChoice, /Listen \+ append\(\)/);
    assert.match(projectChoice, /Begleitete Projektmission/);
    assert.match(projectChoice, /Offene Projektmission/);
    assert.equal((projectChoice.match(/class="project-card /g) || []).length, 2);
    assert.equal((projectChoice.match(/aria-disabled="true"/g) || []).length, 0);
    assert.match(projectChoice, /id="link-pico-l1"[^>]+href="pico_level1\.html"/);
    assert.match(projectChoice, /id="link-museum-briefing"[^>]+href="pixelmuseum_briefing\.html"/);
    assert.match(projectChoice, /Gezielte Zentralenhilfe nur auf deinen Wunsch/);
    assert.doesNotMatch(projectChoice, /href="[^"]*prototypes\//);
    assert.doesNotMatch(projectChoice, /für Schnelle|für Langsame|leichter|schwerer/i);
    assert.match(projectChoiceCss, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(projectChoiceCss, /@media \(max-width: 820px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(projectChoiceCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(projectChoiceCss, /@media \(forced-colors: active\)/);
});

test("the public PICO path shares one runtime and uses TRANSPONDER from level 1", () => {
    const pages = [
        "pico_level1.html",
        "pico_level2.html",
        "pico_level2a.html",
        "pico_level3.html",
        "pico_level4.html"
    ];

    for (const page of pages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        const solutionId = page.replace(".html", "");
        assert.match(html, /data-pico-level="(?:1|2|2a|3|4)"/);
        assert.match(html, /assets\/pico-mission-core\.js/);
        assert.match(html, /assets\/pico-mission\.js/);
        assert.match(html, /assets\/teacher-solutions\.js/);
        assert.match(html, new RegExp(`data-teacher-solution="${solutionId}"`));
        assert.match(html, /<small>TRANSPONDER<\/small>/);
        assert.doesNotMatch(html, /\bFUNK\b/);
    }

    const level1 = readFileSync(new URL("../pico_level1.html", import.meta.url), "utf8");
    assert.match(level1, /Reicht die Energie\?/);
    assert.match(level1, /Gib deiner Drohne einen Namen und programmiere diesen Flug\./);
    assert.match(level1, /status = \{"DROHNE": "PICO", "TRANSPONDER": "suche"\}/);
    assert.match(level1, /status\["DROHNE"\] = "PICO"/);
    assert.match(level1, /id="energy-advice"[^>]+type="button"/);

    const level2a = readFileSync(new URL("../pico_level2a.html", import.meta.url), "utf8");
    assert.match(level2a, /Optionales Level 2a/);
    assert.match(level2a, /class="pico-skip-top"[^>]+href="pico_level3\.html"[^>]*>Überspringen<\/a>/);
    assert.match(level2a, /status\["TRANSPONDER"\] = "aufgeladen"/);

    const level4 = readFileSync(new URL("../pico_level4.html", import.meta.url), "utf8");
    assert.match(level4, /Drohne zerstören und die Daten darauf löschen/);
    assert.match(level4, /damit sie dem bösen Lord nicht in die Hände fällt/);
    assert.match(level4, /status\["DROHNE"\] = "self-destroy"/);
    assert.match(level4, /status\["TRANSPONDER"\] = "delete"/);
});

test("both helicopter escape landings use distinct optimized renders and a shared mission handoff", () => {
    const variants = [
        {
            page: "helikopter_flucht.html",
            artwork: "helicopter-hangar-a.webp",
            heading: /Jetzt musst du selbst raus\./,
            currentVariant: /href="helikopter_flucht\.html" aria-current="page"/
        },
        {
            page: "helikopter_flucht-b.html",
            artwork: "helicopter-rooftop-b.webp",
            heading: /Der Lord kommt zurück\./,
            currentVariant: /href="helikopter_flucht-b\.html" aria-current="page"/
        }
    ];
    const hashes = [];

    for (const variant of variants) {
        const html = readFileSync(new URL(`../${variant.page}`, import.meta.url), "utf8");
        const artworkUrl = new URL(`../assets/images/escape/${variant.artwork}`, import.meta.url);
        const bytes = readFileSync(artworkUrl);

        assert.match(html, variant.heading);
        assert.match(html, variant.currentVariant);
        assert.match(html, /echte Agent(?:in| oder die echte Agentin)/);
        assert.match(html, /Basis des bösen Lords/);
        assert.match(html, /Helikopter/);
        assert.match(html, /(?:Hacke|Brich) /);
        assert.match(html, new RegExp(`assets/images/escape/${variant.artwork.replace(".", "\\.")}`));
        assert.doesNotMatch(html, /href="[^"]*(?:prototypes\/|finale)/i);
        assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${variant.artwork} ist kein RIFF-WebP`);
        assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${variant.artwork} ist kein WebP`);
        assert.equal(bytes.subarray(12, 16).toString("ascii"), "VP8X", `${variant.artwork} braucht WebP-Metadaten`);
        const width = bytes.readUIntLE(24, 3) + 1;
        const height = bytes.readUIntLE(27, 3) + 1;
        assert.match(html, new RegExp(`width="${width}" height="${height}"`));
        assert.ok(bytes.length > 50_000, `${variant.artwork} ist unerwartet leer oder zu klein`);
        assert.ok(statSync(artworkUrl).size < 300_000, `${variant.artwork} ist für die Landingpage zu groß`);
        hashes.push(createHash("sha256").update(bytes).digest("hex"));
    }

    assert.notEqual(hashes[0], hashes[1], "A und B brauchen wirklich unterschiedliche Renderings");
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
        assert.match(html, /href="assets\/style\.css\?v=20260722-2"/);
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
        assert.match(html, /<script src="assets\/editor\.js\?v=20260722-1"><\/script>/);
        assert.doesNotMatch(html, /CodeMirror\.fromTextArea/);
    }
});

test("the editor refreshes after layout events and real width changes", () => {
    const textarea = { id: "python-editor" };
    let width = 640;
    const wrapper = {
        getBoundingClientRect() { return { width }; }
    };
    const editor = {
        refreshCount: 0,
        getWrapperElement() { return wrapper; },
        refresh() { this.refreshCount += 1; }
    };
    const frameQueue = [];
    const eventListeners = new Map();
    let fontReadyCallback = null;
    let resizeCallback = null;
    let observedElement = null;
    const document = {
        fonts: {
            ready: {
                then(callback) { fontReadyCallback = callback; }
            }
        },
        getElementById(id) { return id === "python-editor" ? textarea : null; }
    };
    const window = {
        CodeMirror: {
            fromTextArea() { return editor; }
        },
        ResizeObserver: class {
            constructor(callback) { resizeCallback = callback; }
            observe(element) { observedElement = element; }
        },
        addEventListener(type, callback, options) {
            eventListeners.set(type, { callback, options });
        },
        requestAnimationFrame(callback) {
            frameQueue.push(callback);
            return frameQueue.length;
        }
    };
    const context = vm.createContext({ document, Error, Number, window });
    const source = readFileSync(new URL("../assets/editor.js", import.meta.url), "utf8");
    vm.runInContext(source, context);

    assert.equal(frameQueue.length, 1);
    frameQueue.shift()();
    assert.equal(frameQueue.length, 1);
    frameQueue.shift()();
    assert.equal(editor.refreshCount, 1);

    assert.equal(eventListeners.get("load").options.once, true);
    eventListeners.get("load").callback();
    eventListeners.get("pageshow").callback();
    fontReadyCallback();
    assert.equal(editor.refreshCount, 4);

    assert.equal(observedElement, wrapper);
    resizeCallback([{ contentRect: { width } }]);
    assert.equal(editor.refreshCount, 4, "Gleiche Breite darf keinen Refresh-Loop auslösen");
    width = 720;
    resizeCallback([{ contentRect: { width } }]);
    assert.equal(editor.refreshCount, 5);
});

test("the animated Enter callout is positioned above the live input", () => {
    const css = readFileSync(new URL("../assets/style.css", import.meta.url), "utf8");
    assert.match(css, /\.console-enter-hint\s*\{[\s\S]*position:\s*absolute;[\s\S]*right:\s*0;/);
    assert.match(css, /\.console-enter-hint\s*\{[\s\S]*animation:\s*console-hint-pulse/);
    assert.match(css, /\.console-input\s*\{[\s\S]*caret-color:[\s\S]*animation:\s*console-input-glow/);
    assert.match(css, /@keyframes console-hint-pulse/);
});

test("finale prototypes stay isolated while the production Pixelmuseum path is public", () => {
    const prototypes = [
        "pico_finale.html",
        "pixelmuseum_finale.html"
    ];
    const navigation = readFileSync(new URL("../assets/navigation.js", import.meta.url), "utf8");
    const publicPages = [
        "index.html",
        "index-a.html",
        "index-b.html",
        "pico_level1.html",
        "pico_level2.html",
        "pico_level2a.html",
        "pico_level3.html",
        "pico_level4.html",
        "helikopter_flucht.html",
        "helikopter_flucht-b.html",
        ...missionPages
    ];

    for (const publicPage of publicPages) {
        const html = readFileSync(new URL(`../${publicPage}`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /(?:pico|pixelmuseum)_finale\.html/);
    }

    assert.doesNotMatch(navigation, /prototypes\//);
    assert.doesNotMatch(navigation, /pico_finale\.html/);
    assert.match(navigation, /href: "pixelmuseum_finale\.html"/);

    for (const page of prototypes) {

        const html = readFileSync(new URL(`../prototypes/${page}`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /https?:\/\//);
        assert.doesNotMatch(html, /localStorage|navigation\.js|runner\.js/);
        assert.match(html, /Unverlinkter Endprototyp/);
        assert.match(html, /class="prototype-nav-dock"/);
        assert.match(html, /class="prototype-home-link" href="\.\.\/index\.html"/);
        assert.match(html, /src="\.\.\/assets\/brand\/agent-py-logo\.png\?v=20260720-2"/);
        assert.match(html, /class="prototype-path-token"/);
        assert.doesNotMatch(html, /class="prototype-path-token"[^>]*(?:href=|onclick=)/);
        assert.match(html, /href="finale\.css\?v=cockpit-scroll-v1"/);
        assert.match(html, /class="turtle-target"/);
        assert.match(html, /window\.FINALE_CONFIG/);
        assert.match(html, /src="finale\.js\?v=cockpit-scroll-v1"/);
        assert.match(html, /src="finale-analysis\.js\?v=drone-status-v2"/);
        assert.match(html, /assets\/images\/finales\/.+\.webp/);
        assert.match(html, /assets\/vendor\/skulpt\/1\.2\.0\/skulpt\.min\.js/);
        assert.match(html, /assets\/vendor\/codemirror\/5\.65\.2\/codemirror\.min\.js/);
        assert.doesNotMatch(html, /\.speed\(9\)/);
    }

    const productionBriefing = readFileSync(new URL("../pixelmuseum_briefing.html", import.meta.url), "utf8");
    const productionFinale = readFileSync(new URL("../pixelmuseum_finale.html", import.meta.url), "utf8");
    assert.match(productionBriefing, /data-mission-level="pixelmuseum_briefing"/);
    assert.match(productionBriefing, /pixelmuseum-briefing-core\.js/);
    assert.match(productionBriefing, /BRIEFING-INVENTAR/);
    assert.match(productionFinale, /data-mission-level="pixelmuseum_finale"/);
    assert.match(productionFinale, /Fordere von deiner Zentrale Hilfe an/);
    assert.match(productionFinale, /pixelmuseum-help-core\.js/);
    assert.match(productionFinale, /helikopter_flucht-b\.html/);
    assert.doesNotMatch(productionFinale, /analysis\.hasIf/);

    const pico = readFileSync(new URL("../prototypes/pico_finale.html", import.meta.url), "utf8");
    assert.match(pico, /drohne\.goto\(-365, 55\)/);
    assert.match(pico, /fahre_zu\(-380, -90\)/);
    assert.match(pico, /fahre_zu\(0, -90\)/);
    assert.match(pico, /Funkbase/);
    assert.doesNotMatch(pico, /for schritt in range\(4\)/);
    assert.match(pico, /def fahre_zu\(x, y\):/);
    assert.match(pico, /def markiere\(\):\s*\n\s*drohne\.dot\(18, "#55f6ff"\)/);
    const picoCode = pico.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    assert.equal((picoCode.match(/drohne\.dot\(/g) || []).length, 1, "PICO-Punkte sollen nur in markiere() gezeichnet werden");
    assert.equal((picoCode.match(/markiere\(\)/g) || []).length, 3, "PICO soll beide Ziele einheitlich markieren");
    assert.match(pico, /Eigene Funktion und markiere\(\) werden verwendet/);
    assert.match(pico, /id="energy-value">10 %/);
    assert.match(pico, /fund = drohne\.suche_hier\(\)/);
    assert.match(pico, /print\("Gefunden: " \+ str\(fund\)\)/);
    assert.match(pico, /ausruestung\.append\(fund\)/);
    assert.doesNotMatch(pico, /if fund == "Energiezelle":/);
    assert.match(pico, /signal_erfolgreich = drohne\.sende\(\)/);
    assert.match(pico, /status\s*=\s*\{"DROHNE": "PICO", "TRANSPONDER": "suche"\}/);
    assert.match(pico, /status\.update\(\{"TRANSPONDER": "gesendet"\}\)/);
    assert.match(pico, /status\.update\(\{"TRANSPONDER": "fehlgeschlagen"\}\)/);
    assert.doesNotMatch(picoCode, /PICO_STATUS\|/, "Die GUI liest das Dictionary direkt und braucht kein Ausgabeprotokoll");
    assert.match(pico, /Signal konnte nicht gesendet werden\./);
    assert.match(pico, /onTurtleFrame\(point\)/);
    assert.match(pico, /syncPythonState\(context\)/);
    assert.match(pico, /this\.signalSent = success/);
    assert.match(pico, /document\.getElementById\("agent-name"\)\.textContent = drohne/);
    assert.match(pico, /document\.getElementById\("mission-state"\)\.textContent = transponder/);
    assert.match(pico, /liveStatus\.DROHNE/);
    assert.match(pico, /liveStatus\.TRANSPONDER/);
    assert.match(pico, /this\.lastRuntimeStatusData = \{ \.\.\.this\.lastStatusData \}/);
    assert.doesNotMatch(pico, /parseOutput\(output\)/);
    assert.doesNotMatch(pico, /onOutput\(_chunk/);
    assert.match(pico, /<small>DROHNE<\/small>/);
    assert.match(pico, /<small>TRANSPONDER<\/small>/);
    assert.match(pico, /Status-Dictionary füllt DROHNE und TRANSPONDER/);
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
    assert.match(museum, /fund = drohne\.suche_hier\(\)/);
    assert.match(museum, /Noch kein Alarm ausgelöst – Hack nicht möglich!/);
    assert.match(museum, /inventar\.append\(fund\)/);
    assert.match(museum, /baselineCount/);
    assert.doesNotMatch(museum, /PickupProgrammed/);
    assert.match(museum, /def alarm_hacken\(code\):/);
    assert.match(museum, /def markiere\(\):\s*\n\s*drohne\.dot\(18, "#ff78f3"\)/);
    assert.equal((museum.match(/drohne\.dot\(/g) || []).length, 1, "Museumspunkte sollen nur in markiere() gezeichnet werden");
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

test("pico HUD mirrors the DROHNE/TRANSPONDER status dictionary during turtle movement", () => {
    const { config, elements } = createPicoConfig();
    config.signalSent = false;
    config.syncPythonState({
        getGlobal(name) {
            return name === "status" ? { DROHNE: "NOVA", TRANSPONDER: "suche" } : undefined;
        }
    });

    assert.equal(elements.get("agent-avatar").textContent, "N");
    assert.equal(elements.get("agent-name").textContent, "NOVA");
    assert.equal(elements.get("mission-state").textContent, "suche");
});

test("pico dictionary check accepts the DROHNE/TRANSPONDER runtime dictionary", () => {
    const { config } = createPicoConfig();
    config.charged = true;
    config.beaconReached = true;
    config.depleted = false;
    config.energy = 25;
    config.signalSent = true;
    config.syncPythonState({
        getGlobal(name) {
            return name === "status" ? { DROHNE: "NOVA", TRANSPONDER: "gesendet" } : undefined;
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
    for (const { runtimeStatus, expectedDrohne, expectedTransponder } of [
        { runtimeStatus: undefined },
        { runtimeStatus: { name: "NOVA", signal: "gesendet" }, expectedDrohne: "–", expectedTransponder: "–" },
        { runtimeStatus: { AGENT: "NOVA", TRANSPONDER: "gesendet" }, expectedDrohne: "–", expectedTransponder: "gesendet" },
        { runtimeStatus: { DROHNE: "NOVA", FUNK: "gesendet" }, expectedDrohne: "NOVA", expectedTransponder: "–" },
        { runtimeStatus: { DROHNE: "NOVA" }, expectedDrohne: "NOVA", expectedTransponder: "–" }
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
            assert.equal(elements.get("agent-name").textContent, expectedDrohne);
            assert.equal(elements.get("mission-state").textContent, expectedTransponder);
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
            if (name === "status") return { DROHNE: "PICO", TRANSPONDER: "suche" };
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
    config.lastRuntimeStatusData = { drohne: "NOVA", transponder: "gesendet" };
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
        lastRuntimeStatusData: { drohne: "PICO", transponder: "gesendet" }
    });
    const misleadingCode = `import turtle
drohne = turtle.Turtle()
drohne.goto(-380, -90)

def dekorativ():
    pass

def markiere():
    drohne.dot(18)

markiere()
# dekorativ()
# if signal_erfolgreich:
text = "if signal_erfolgreich:"
status = {"DROHNE": "PICO", "TRANSPONDER": "gesendet"}`;

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
            if (name === "status") return { DROHNE: "PICO", TRANSPONDER: "suche" };
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

test("pico expires a found energy cell after the drone leaves its position", () => {
    const { config } = createPicoConfig();
    config.resetHud();
    const equipment = [];
    const context = {
        x: -380,
        y: -90,
        getGlobal(name) {
            if (name === "ausruestung") return equipment;
            if (name === "status") return { DROHNE: "PICO", TRANSPONDER: "suche" };
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
    const fastCode = config.defaultCode.replace("drohne.speed(4)", "drohne.speed(8)");
    assert.match(fastCode, /drohne\.speed\(8\)/);
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
drohne = turtle.Turtle()
drohne.goto(0, 115)
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
