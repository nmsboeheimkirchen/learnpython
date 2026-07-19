import { expect, test } from "@playwright/test";

async function openFinale(page, path) {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype))).toBe(true);
    return pageErrors;
}

async function runCode(page, code) {
    await page.evaluate(async source => {
        window.finalePrototype.editor.setValue(source);
        await window.finalePrototype.run();
    }, code);
}

test("PICO clamps an oversized speed-0 move to the real energy range", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html?e2e");
    await runCode(page, `import turtle
pico = turtle.Turtle()
pico.speed(0)
pico.penup()
pico.goto(-365, 55)
pico.goto(1000, 55)
print("POSITION:" + str(pico.position()))`);

    const output = await page.locator("#console-output").textContent();
    const x = Number(output.match(/POSITION:\(([-\d.]+),/)?.[1]);
    expect(x).toBeGreaterThan(-220);
    expect(x).toBeLessThan(-218);
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("#run-status")).toHaveText("Energie leer");
    expect(pageErrors).toEqual([]);
});

test("PICO accepts a creative direct route and clears stale checks after an error", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html?e2e");
    const spoofedStructure = await page.evaluate(() => window.FinalePythonAnalysis.analyze(`def dekorativ():
    pass
# dekorativ()
# if signal:
text = "if signal:"`));
    expect(spoofedStructure.hasIf).toBe(false);
    expect(spoofedStructure.topLevelCalledFunctionNames).not.toContain("dekorativ");
    const creativeCode = await page.evaluate(() => (
        window.FINALE_CONFIG.defaultCode.replace("fahre_zu(0, -90)\n", "")
    ));
    await runCode(page, creativeCode);

    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect(page.locator("#pico-result-message")).toHaveText("Signal gesendet - gerettet!");
    await expect(page.locator("#agent-name")).toHaveText("PICO");
    await expect(page.locator("#checks-list")).not.toContainText("Route nutzt einen Wegpunkt");

    await runCode(page, "if :\n    pass");
    await expect(page.locator("#validation-title")).toHaveText("Programm gestoppt");
    await expect(page.locator("#checks-list")).toHaveText("Programmfehler beheben");
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("PICO default route also succeeds with real Turtle animation", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html");
    const defaultCode = await page.evaluate(() => window.FINALE_CONFIG.defaultCode);
    await runCode(page, defaultCode);

    await expect(page.locator("#pico-result-message")).toHaveText("Signal gesendet - gerettet!");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum completes the one-second source-code hack with truthful inventory", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");
    const solution = await page.evaluate(() => {
        const code = document.getElementById("museum-system-log").dataset.alarmCode;
        return window.FINALE_CONFIG.defaultCode.replace("CODE_AUS_DEM_QUELLTEXT", code);
    });
    const startedAt = Date.now();
    await runCode(page, solution);
    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.hackCompleted)).toBe(true);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
    await expect(page.locator("#console-output")).toContainText("INVENTARLISTE: Schlüsselkarte,Artefakt");
    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum speed 8 escapes before the first animated alarm tick", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html");
    const fastRoute = await page.evaluate(() => (
        window.FINALE_CONFIG.defaultCode.replace("agent.speed(4)", "agent.speed(8)")
    ));
    await runCode(page, fastRoute);

    await expect(page.locator("#museum-success")).toHaveText("MISSION ERFOLGREICH – DU BIST ENTKOMMEN!");
    await expect(page.locator("#alarm-value")).toHaveText("0");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum renders alarm level 8 after Python has already ended", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");
    await runCode(page, `import turtle
agent = turtle.Turtle()
agent.speed(0)
agent.penup()
inventar = []
agent.goto(-250, 60)
fund = agent.suche_hier()
inventar.append(fund)
agent.goto(-390, 45)
fund = agent.suche_hier()
inventar.append(fund)
print("INVENTARLISTE: " + ",".join(inventar))`);

    await expect(page.locator("#run-status")).toHaveText("Mission gestoppt", { timeout: 10_000 });
    await expect(page.locator("#validation-title")).toHaveText("Alarm ausgelöst");
    await expect(page.locator("#alarm-value")).toHaveText("8");
    await page.evaluate(() => {
        window.finalePrototype.refresh();
        window.finalePrototype.refresh();
    });
    const output = await page.locator("#console-output").textContent();
    expect(output.match(/Das Museum verriegelt automatisch alle Wege\./g)).toHaveLength(1);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum cannot finish a pending hack after terminal alarm failure", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");
    await page.evaluate(() => {
        const config = window.FINALE_CONFIG;
        config.resetHud();
        config.alarmStarted = true;
        config.artifactSecured = true;
        config.atAlarmConsole = true;
        config.requestAlarmHack(document.getElementById("museum-system-log").dataset.alarmCode);
        config.failAlarm();
    });
    await page.waitForTimeout(1100);

    expect(await page.evaluate(() => ({
        failed: window.FINALE_CONFIG.alarmFailed,
        disabled: window.FINALE_CONFIG.alarmDisabled,
        completed: window.FINALE_CONFIG.hackCompleted
    }))).toEqual({ failed: true, disabled: false, completed: false });
    expect(pageErrors).toEqual([]);
});

test("small screens keep target names and an accessible Python editor", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");

    await expect(page.locator(".mobile-target-legend")).toBeVisible();
    await expect(page.locator(".mobile-target-legend")).toContainText("Schlüsselkarte");
    await expect(page.locator(".mobile-target-legend")).toContainText("Alarmkonsole");
    await expect(page.locator(".stage-label").first()).toBeHidden();
    await expect(page.locator('.CodeMirror [aria-label="Python-Code für das Pixelmuseum"]')).toHaveCount(1);
    const inventoryFontSize = await page.locator("#inventory-items span").evaluate(element => (
        Number.parseFloat(getComputedStyle(element).fontSize)
    ));
    expect(inventoryFontSize).toBeGreaterThanOrEqual(10);
    expect(pageErrors).toEqual([]);
});
