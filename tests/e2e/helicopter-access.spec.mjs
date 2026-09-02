import { expect, test } from "@playwright/test";

const correctCode = `import bordcomputer

signal = bordcomputer.receive()
passwort = signal.replace("?", "")
bordcomputer.pruefe(passwort)`;

async function openLevel(page) {
    await page.goto("/helikopter_flucht_level1.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(window.HelicopterAccessRuntime))).toBe(true);
}

async function runCode(page, source) {
    return page.evaluate(async code => {
        window.HelicopterAccessRuntime.editor.setValue(code);
        const result = await window.HelicopterAccessRuntime.run();
        return {
            output: window.HelicopterAccessRuntime.getOutput(),
            result,
            state: window.HelicopterAccessRuntime.getState()
        };
    }, source);
}

test("@ipad the Bordcomputer layout keeps the mission, editor and help clear", async ({ page }) => {
    await openLevel(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entsperre den Bordcomputer");
    await expect(page.getByLabel("Nachricht von Agent PY")).toContainText("receive()");
    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Bordcomputer starten" })).toHaveCount(2);
    await expect(page.locator(".helicopter-hint-card")).toHaveCount(2);
    await expect(page.getByText("Auch für Umlaute")).toHaveCount(0);
    await expect(page.getByText("C?O?D?E", { exact: false })).toHaveCount(0);
    await expect(page.getByText('ort = "Böheimkirchen"', { exact: false })).toBeVisible();
    await page.locator("summary").click();
    await expect(page.getByText('passwort.replace("alt", "neu")', { exact: false })).toBeVisible();
    await expect(page.getByText("das Ergebnis wieder in passwort speicherst", { exact: false })).toBeVisible();
    await expect(page.getByText('passwort = signal.replace("?", "")', { exact: false })).toHaveCount(0);
    await expect(page.locator(".mission-checks, .checks-list, .mission-feedback")).toHaveCount(0);
    await expect(page.locator(".helicopter-access-hero > img")).toHaveJSProperty("naturalWidth", 1717);
    await expect(page.locator(".helicopter-access-hero > img")).toHaveJSProperty("naturalHeight", 916);

    const layout = await page.evaluate(() => {
        const rect = selector => {
            const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
            return { x, y, width, height, right, bottom };
        };
        const buttons = [...document.querySelectorAll("[data-helicopter-run], #run-btn")]
            .map(button => button.getBoundingClientRect())
            .map(({ x, y, width, height, right, bottom }) => ({ x, y, width, height, right, bottom }));
        return {
            width: window.innerWidth,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            title: rect(".helicopter-hero-title"),
            briefing: rect(".agent-briefing"),
            status: rect(".access-display"),
            code: rect(".helicopter-code-panel"),
            help: rect(".helicopter-help-column"),
            editor: rect(".CodeMirror"),
            output: rect(".helicopter-output-card"),
            buttons
        };
    });

    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.title.right).toBeLessThanOrEqual(layout.briefing.right);
    expect(layout.status.y).toBeGreaterThanOrEqual(layout.briefing.bottom - 1);
    expect(layout.buttons.every(button => button.height >= 44)).toBe(true);
    expect(layout.buttons[0].bottom).toBeLessThanOrEqual(layout.editor.y + 1);
    expect(layout.editor.bottom).toBeLessThanOrEqual(layout.output.y + 1);
    expect(layout.output.bottom).toBeLessThanOrEqual(layout.buttons[1].y + 1);
    if (layout.width > 1100) {
        expect(layout.code.right).toBeLessThanOrEqual(layout.help.x + 1);
    } else {
        expect(layout.code.bottom).toBeLessThanOrEqual(layout.help.y + 1);
    }

    await expect(page.locator(".helicopter-help-card")).toHaveAttribute("open", "");

    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#code-panel")).toBeFocused();
});

test("the real receive and replace chain grants access", async ({ page }) => {
    await openLevel(page);

    const glow = page.locator(".helicopter-terminal-glow");
    await expect(glow).toHaveCSS("opacity", "0");
    await page.locator("#console-output").scrollIntoViewIfNeeded();
    const scrollBeforeRun = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeRun).toBeGreaterThan(0);

    const run = await runCode(page, correctCode);
    expect(run.result.passed).toBe(true);
    expect(run.state).toMatchObject({
        receiveCount: 1,
        checkCount: 1,
        accessGranted: true,
        lastFailure: null
    });
    expect(run.output).toContain("SIGNAL EMPFANGEN:");
    expect(run.output).toContain("BORDCOMPUTER: ACCESS GRANTED!");
    await expect(page.locator("body")).toHaveAttribute("data-access-state", "granted");
    await expect(page.locator("#access-message")).toHaveText("ACCESS GRANTED!");
    await expect(page.locator("#access-message")).toHaveCSS("color", "rgb(105, 243, 162)");
    await expect(glow).toHaveCSS("opacity", "0.78");
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrollBeforeRun - 1);
});

test("the starter failure does not reveal the replace arguments in its output", async ({ page }) => {
    await openLevel(page);

    await page.locator("#console-output").scrollIntoViewIfNeeded();
    const scrollBeforeRun = await page.evaluate(() => window.scrollY);
    const run = await page.evaluate(async () => window.HelicopterAccessRuntime.run());
    expect(run.passed).toBe(false);
    await expect(page.locator("#console-output")).toContainText("ACCESS DENIED!");
    await expect(page.locator("#console-output")).not.toContainText('replace("?", "")');
    await expect(page.locator("#console-output")).not.toContainText("Entferne alle ?");
    const scrollAfterRun = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfterRun - scrollBeforeRun)).toBeLessThanOrEqual(1);
});

test("forged output and cleartext cannot bypass replace provenance", async ({ page }) => {
    await openLevel(page);

    const printed = await runCode(page, 'print("BORDCOMPUTER: ACCESS GRANTED!")');
    expect(printed.result.passed).toBe(false);
    expect(printed.state).toMatchObject({ receiveCount: 0, checkCount: 0, accessGranted: false });
    await expect(page.locator("#access-message")).toHaveText("ACCESS DENIED!");

    const hardcoded = await runCode(page, `import bordcomputer
signal = bordcomputer.receive()
bordcomputer.pruefe("seru#7")`);
    expect(hardcoded.result.passed).toBe(false);
    expect(hardcoded.state).toMatchObject({
        receiveCount: 1,
        checkCount: 1,
        accessGranted: false,
        lastFailure: "TRANSFORM_REQUIRED"
    });

    const assembled = await runCode(page, `import bordcomputer
signal = bordcomputer.receive()
bordcomputer.pruefe("seru" + "#7")`);
    expect(assembled.result.passed).toBe(false);
    expect(assembled.state.lastFailure).toBe("TRANSFORM_REQUIRED");
    await expect(page.locator("body")).toHaveAttribute("data-access-state", "denied");
});

test("every run starts fresh and a Python error cannot preserve access", async ({ page }) => {
    await openLevel(page);

    expect((await runCode(page, correctCode)).result.passed).toBe(true);
    const freshFailure = await runCode(page, "print('noch nicht entschlüsselt')");
    expect(freshFailure.result.passed).toBe(false);
    expect(freshFailure.state).toMatchObject({ receiveCount: 0, checkCount: 0, accessGranted: false });
    await expect(page.locator("body")).toHaveAttribute("data-access-state", "denied");

    const errored = await runCode(page, correctCode + "\nraise Exception('Abbruch')");
    expect(errored.result.passed).toBe(false);
    await expect(page.locator("#console-output")).toContainText("PYTHON-FEHLER:");
    await expect(page.locator("#access-message")).toHaveText("ACCESS DENIED!");
});
