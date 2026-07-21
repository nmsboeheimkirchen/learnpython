import { expect, test } from "@playwright/test";

const setup = `import turtle

status = {"DROHNE": "PICO", "TRANSPONDER": "suche"}
ausruestung = []

drohne = turtle.Turtle()
drohne.shape("turtle")
drohne.color("#55f6ff")
drohne.speed(0)
drohne.hideturtle()
drohne.penup()
drohne.goto(-365, 55)
drohne.speed(3)
drohne.showturtle()
drohne.pendown()
turtle.Screen().delay(35)

def fahre_zu(x, y):
    drohne.goto(x, y)

status["DROHNE"] = "NOVA"
`;

const directCode = `${setup}
fahre_zu(340, 15)
`;

const cellCode = `${setup}
fahre_zu(-380, -90)
`;

const chargeCode = `${cellCode}
fund = drohne.suche_hier()
print("Gefunden:", fund)
ausruestung.append(fund)
`;

const sendCode = `${chargeCode}
fahre_zu(0, -90)
fahre_zu(340, 15)
signal_erfolgreich = drohne.sende()
print("Signal:", signal_erfolgreich)
`;

const fullStatusCode = `${chargeCode}
status["TRANSPONDER"] = "aufgeladen"
fahre_zu(340, 15)
signal_erfolgreich = drohne.sende()
if signal_erfolgreich:
    status["TRANSPONDER"] = "gesendet"
`;

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

async function openLevel(page, path) {
    await page.goto(`${path}?e2e`);
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
}

async function runCode(page, code) {
    return page.evaluate(async source => {
        window.DroneMissionRuntime.editor.setValue(source);
        return window.DroneMissionRuntime.run();
    }, code);
}

test("@ipad PICO level 1 names the drone, reveals its clickable second phase and carries code forward", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level1.html");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reicht die Energie?");
    await expect(page.locator(".drone-mission-intro")).toContainText(
        "Gib deiner Drohne einen Namen und programmiere diesen Flug."
    );
    expect(await page.evaluate(() => Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1);
    const starter = await page.evaluate(() => window.DroneMissionRuntime.editor.getValue());
    expect(starter).toContain('status = {"DROHNE": "PICO", "TRANSPONDER": "suche"}');
    expect(starter).toContain('status["DROHNE"] = "PICO"');
    expect(starter).not.toContain("FUNK");

    const discovery = await runCode(page, directCode);
    expect(discovery.passed).toBe(true);
    expect(discovery.levelComplete).toBe(false);
    await expect(page.locator("#run-status")).toHaveText("Energieproblem erkannt");
    await expect(page.locator("#drone-name")).toHaveText("NOVA");
    await expect(page.locator("#transponder-state")).toHaveText("suche");
    await expect(page.locator("#energy-advice")).toBeVisible();
    await expect(page.locator("#energy-advice")).toHaveCSS("animation-name", "pico-discovery-pulse");
    await expect(page.locator("#next-level-container")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pico_level1_navigation)).toBeUndefined();

    await page.locator("#energy-advice").click();
    await expect(page.locator("#level1-direct-task")).toBeHidden();
    await expect(page.locator("#level1-cell-task")).toBeVisible();
    await expect(page.locator("#energy-advice")).toHaveAttribute("aria-expanded", "true");

    const arrival = await runCode(page, cellCode);
    expect(arrival.passed).toBe(true);
    expect(arrival.levelComplete).toBe(true);
    await expect(page.locator("#run-status")).toHaveText("Level 1 geschafft");
    await expect(page.locator("#next-level-container")).toBeVisible();
    await expect(page.locator("#next-level-container a")).toHaveAttribute("href", "pico_level2.html");

    await page.locator("#next-level-container a").click();
    await expect(page).toHaveURL(/\/pico_level2\.html$/);
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.DroneMissionRuntime.editor.getValue())).toContain(
        'status["DROHNE"] = "NOVA"'
    );
    expect(pageErrors).toEqual([]);
});

test("an independent learner can use search, charging and sending already in level 1", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level1.html");

    const result = await runCode(page, fullStatusCode);
    expect(result.passed).toBe(true);
    const state = await page.evaluate(() => window.DroneMissionRuntime.getState());
    expect(state.visitedCell).toBe(true);
    expect(state.searchFound).toBe(true);
    expect(state.charged).toBe(true);
    expect(state.signalSent).toBe(true);
    expect(state.transponderHistory).toEqual(["suche", "aufgeladen", "gesendet"]);
    await expect(page.locator("#pico-result-message")).toContainText("gerettet");
    await expect(page.locator("#next-level-container")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("PICO level 2 charges only after a real search result is collected", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level2.html");

    const forgedCode = `${cellCode}
print("Gefunden: Energiezelle")
ausruestung.append("Energiezelle")
`;
    const forged = await runCode(page, forgedCode);
    expect(forged.passed).toBe(false);
    let state = await page.evaluate(() => window.DroneMissionRuntime.getState());
    expect(state.searchFound).toBe(false);
    expect(state.charged).toBe(false);
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");

    const charged = await runCode(page, chargeCode);
    expect(charged.passed).toBe(true);
    state = await page.evaluate(() => window.DroneMissionRuntime.getState());
    expect(state.searchFound).toBe(true);
    expect(state.charged).toBe(true);
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.locator("#next-level-container")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("optional level 2a reads an executed TRANSPONDER update and can be skipped", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level2a.html");
    await expect(page.getByRole("link", { name: /Level 2a überspringen/ })).toHaveAttribute("href", "pico_level3.html");

    const printedClaim = await runCode(page, `${chargeCode}\nprint("TRANSPONDER: aufgeladen")\n`);
    expect(printedClaim.passed).toBe(false);
    await expect(page.locator("#transponder-state")).toHaveText("suche");

    const actualUpdate = await runCode(page, `${chargeCode}\nstatus["TRANSPONDER"] = "aufgeladen"\n`);
    expect(actualUpdate.passed).toBe(true);
    await expect(page.locator("#transponder-state")).toHaveText("aufgeladen");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(3);
    await expect(page.locator("#next-level-container")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("levels 3 and 4 keep status optional while requiring the real rescue chain", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level3.html");

    const level3 = await runCode(page, sendCode);
    expect(level3.passed).toBe(true);
    await expect(page.locator("#transponder-state")).toHaveText("suche");
    await expect(page.locator("#checks-list .is-missing.is-optional")).toHaveCount(1);
    await expect(page.locator("#next-level-container")).toBeVisible();

    await page.locator("#next-level-container a").click();
    await expect(page).toHaveURL(/\/pico_level4\.html$/);
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    expect(await page.evaluate(() => window.DroneMissionRuntime.editor.getValue())).toContain(
        "signal_erfolgreich = drohne.sende()"
    );

    const finale = await page.evaluate(() => window.DroneMissionRuntime.run());
    expect(finale.passed).toBe(true);
    await expect(page.locator("#success-overlay")).toBeVisible();
    await expect(page.locator("#success-overlay h1")).toHaveText("PICO GERETTET");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(4);
    await expect(page.locator("#checks-list .is-missing.is-optional")).toHaveCount(2);
    expect(pageErrors).toEqual([]);
});
