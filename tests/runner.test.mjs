import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TextDecoder } from "node:util";
import vm from "node:vm";

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
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

    addEventListener() {}
    focus() {}
    querySelector() { return new FakeElement(); }
}

function createRunnerContext() {
    const elements = new Map([
        ["console-output", new FakeElement()],
        ["progress-fill", new FakeElement()],
        ["status-text", new FakeElement()]
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
            getItem() { return null; },
            removeItem() {},
            setItem() {}
        },
        setInterval() { return 0; },
        setTimeout() { return 0; },
        window: {
            location: { hash: "", pathname: "/mission3_level3.html" }
        }
    });

    const source = readFileSync(new URL("../assets/runner.js", import.meta.url), "utf8");
    vm.runInContext(source, context);
    return { context, elements };
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
    ["mission3_level3", /random\.randint\(1, 100\)/]
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
    "mission3_level3.html"
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

    assert.equal(elementsById.size, 14);
    assert.equal(elementsById.get("link-level1").className.includes("locked"), false);
    assert.equal(elementsById.get("link-level2").className.includes("locked"), true);
    assert.equal(elementsById.get("link-m2-title").textContent.endsWith("🔒"), true);
    assert.equal(elementsById.get("link-m3-l3").textContent, "Level 3: Safe knacken 🔒");

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
