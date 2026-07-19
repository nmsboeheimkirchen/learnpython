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

function createMuseumConfig() {
    const html = readFileSync(new URL("../prototypes/pixelmuseum_finale.html", import.meta.url), "utf8");
    const code = html.match(/<textarea id="python-editor"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "";
    const configScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(match => match[1])
        .find(source => source.includes("window.FINALE_CONFIG"));
    assert.ok(configScript, "Pixelmuseum-Konfiguration fehlt");

    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) {
            elements.set(id, {
                appendChild() {},
                classList: createClassList(),
                dataset: {},
                innerHTML: "",
                textContent: "",
                value: id === "python-editor" ? code : ""
            });
        }
        return elements.get(id);
    };
    element("museum-system-log").dataset.alarmCode = "SERU-7";

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
    vm.runInContext(configScript, context);
    return { config: window.FINALE_CONFIG, document, elements, timers };
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
    ["mission4_level3", /geheimtext = geheimtext \+ chr\(zahl\)/]
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
    "mission4_level3.html"
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
    let renderedSidebar = null;
    const root = {
        replaceWith(element) { renderedSidebar = element; }
    };
    class NavigationElement {
        constructor(tagName) {
            this.tagName = tagName;
            this.children = [];
            this.className = "";
            this.href = "";
            this.id = "";
            this.textContent = "";
        }

        appendChild(child) {
            this.children.push(child);
            return child;
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

    assert.equal(renderedSidebar.id, "mySidebar");
    assert.equal(renderedSidebar.className, "sidebar active");

    const elementsById = new Map();
    function collectElements(element) {
        if (element.id) elementsById.set(element.id, element);
        element.children.forEach(collectElements);
    }
    collectElements(renderedSidebar);

    assert.equal(elementsById.size, 19);
    assert.equal(elementsById.get("link-level1").className.includes("locked"), false);
    assert.equal(elementsById.get("link-level2").className.includes("locked"), true);
    assert.equal(elementsById.get("link-m2-title").textContent.endsWith("🔒"), true);
    assert.equal(elementsById.get("link-m3-l3").textContent, "Level 3: Safe knacken 🔒");
    assert.equal(elementsById.get("link-m4-title").textContent.endsWith("🔒"), true);
    assert.equal(elementsById.get("link-m4-l3").textContent, "Level 3: Caesar-Code 🔒");
    assert.equal(elementsById.get("reset-progress-btn").textContent, "Fortschritt zurücksetzen");

    for (const page of missionPages) {
        const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
        assert.match(html, /<div id="navigation-root"><\/div>/);
        assert.match(html, /<script src="assets\/navigation\.js"><\/script>/);
        assert.doesNotMatch(html, /id="mySidebar"/);
    }
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

    for (const page of prototypes) {
        assert.doesNotMatch(navigation, new RegExp(page.replace(".", "\\.")));

        const html = readFileSync(new URL(`../prototypes/${page}`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /https?:\/\//);
        assert.doesNotMatch(html, /localStorage|navigation\.js|runner\.js/);
        assert.match(html, /class="turtle-target"/);
        assert.match(html, /window\.FINALE_CONFIG/);
        assert.match(html, /src="finale\.js\?v=museum-physics-v2"/);
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
    assert.match(pico, /Eigene Funktion wird verwendet/);
    assert.match(pico, /id="energy-value">10 %/);
    assert.match(pico, /fund = pico\.suche_hier\(\)/);
    assert.match(pico, /print\("Gefunden: " \+ str\(fund\)\)/);
    assert.match(pico, /ausruestung\.append\(fund\)/);
    assert.doesNotMatch(pico, /if fund == "Energiezelle":/);
    assert.match(pico, /if pico\.sende\(\):/);
    assert.match(pico, /Keine Funkbase in Reichweite\./);
    assert.match(pico, /onTurtleFrame\(point\)/);
    assert.match(pico, /syncPythonState\(context\)/);
    assert.match(pico, /this\.signalSent = success/);
    assert.doesNotMatch(pico, /pickupProgrammed/);
    assert.match(pico, /return \{ stop: true, reason: "PICO_ENERGY_DEPLETED" \}/);
    assert.match(pico, /getAutomaticStop\(\)/);
    assert.doesNotMatch(pico, /else:\s*\n\s*print\("Ohne Energiezelle/);
    assert.match(pico, /this\.energy = 10/);
    assert.doesNotMatch(pico, /status\s*=\s*\{[^\n}]*"energie"/);
    assert.match(pico, /\.speed\(3\)/);
    assert.match(pico, /turtle\.Screen\(\)\.delay\(35\)/);

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
    assert.match(museum, /setTimeout\(\(\) => this\.finishAlarmHack\(\), 1000\)/);
    assert.match(museum, /DU BIST GEFANGEN!/);
    assert.match(museum, /MISSION ERFOLGREICH – DU BIST ENTKOMMEN!/);
    assert.doesNotMatch(museum, /Energiezelle|museum-energy|"energie"/);
    assert.match(museum, /\.speed\(4\)/);
    assert.match(museum, /turtle\.Screen\(\)\.delay\(30\)/);
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

test("museum accepts the hidden speed-8 escape before the first alarm tick", () => {
    const { config } = createMuseumConfig();
    const fastCode = config.defaultCode.replace("agent.speed(4)", "agent.speed(8)");
    assert.match(fastCode, /agent\.speed\(8\)/);
    assert.equal(config.getTurtleSpeedMultiplier(8), 3);
    assert.equal(config.getTurtleSpeedMultiplier(4), 1);

    config.runtimeInventory = ["Schlüsselkarte", "Artefakt"];
    config.artifactSecured = true;
    config.escaped = true;
    config.exitUnlocked = true;
    config.alarmLevel = 0;
    config.alarmDisabled = false;
    config.hackRequested = false;

    const result = config.validate(fastCode);
    assert.equal(result.passed, true);
    assert.equal(config.hackRequested, false);
});

test("museum reports an early hack and completes a valid hack in one second", () => {
    const { config, elements, timers } = createMuseumConfig();
    config.alarmStarted = false;
    config.requestAlarmHack("SERU-7");
    assert.match(elements.get("alarm-console-label").innerHTML, /Noch kein Alarm ausgelöst – Hack nicht möglich!/);

    config.alarmStarted = true;
    config.atAlarmConsole = true;
    config.alarmFailed = false;
    config.alarmDisabled = false;
    config.hackFinishTimer = null;
    config.requestAlarmHack("SERU-7");

    const hackTimer = timers.find(timer => timer.type === "timeout" && timer.delay === 1000);
    assert.ok(hackTimer, "Der Alarm-Hack muss genau eine Sekunde dauern");
    hackTimer.callback();
    assert.equal(config.alarmDisabled, true);
    assert.equal(config.hackCompleted, true);
});

test("finale runtime guards creative code and optimized artwork stays small", () => {
    const runtime = readFileSync(new URL("../prototypes/finale.js", import.meta.url), "utf8");
    const finaleCss = readFileSync(new URL("../prototypes/finale.css", import.meta.url), "utf8");
    assert.match(runtime, /execLimit:\s*8000/);
    assert.match(runtime, /killableWhile:\s*true/);
    assert.match(runtime, /killableFor:\s*true/);
    assert.match(runtime, /lineWrapping:\s*true/);
    assert.match(runtime, /runGeneration/);
    assert.match(runtime, /classList\.toggle\("program-running", nextRunning\)/);
    assert.match(runtime, /config\.onOutput\?\.\(chunk, outputText\)/);
    assert.match(runtime, /installTurtleObserver/);
    assert.match(runtime, /config\.getTurtleSpeedMultiplier/);
    assert.match(runtime, /installTurtleAgentApi/);
    assert.match(runtime, /defineMethod\("suche_hier"\)/);
    assert.match(runtime, /defineMethod\("sende"\)/);
    assert.match(runtime, /Sk\.abstr\.sattr/);
    assert.match(runtime, /syncPythonState/);
    assert.match(runtime, /config\.onTurtleFrame\?\.\(\{ x: state\.x, y: state\.y \}\)/);
    assert.match(runtime, /config\.onRunStart\?\.\(code\)/);
    assert.match(runtime, /this\.__finaleMovementBlocked/);
    assert.match(runtime, /config\.getAutomaticStop/);
    assert.match(runtime, /refresh: refreshValidation/);
    assert.match(runtime, /turtleTarget\.replaceChildren\(\)/);
    assert.doesNotMatch(runtime, /localStorage/);
    assert.match(finaleCss, /\.alarm-active \.alarm-flash/);
    assert.match(finaleCss, /\.portal-locked \.portal-gate/);
    assert.match(finaleCss, /\.portal-trapped \.museum-warning/);
    assert.match(finaleCss, /\.escape-success \.museum-success/);

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
