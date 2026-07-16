import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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

