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

const deleteBeforeSendCode = `${chargeCode}
status["DROHNE"] = "self-destroy"
status["TRANSPONDER"] = "delete"
fahre_zu(340, 15)
signal_erfolgreich = drohne.sende()
`;

const finalMemoryCode = `${sendCode}
if signal_erfolgreich:
    status["DROHNE"] = "self-destroy"
    status["TRANSPONDER"] = "delete"
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

async function expectReward(page, count, nextHref) {
    await expect(page.locator("#success-overlay")).toBeVisible();
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(count);
    await expect(page.locator("#success-overlay .success-coins")).toHaveAttribute("data-reward-count", String(count));
    await expect(page.locator("#success-overlay .success-btn")).toHaveAttribute("href", nextHref);
    await expect(page.locator("#next-level-btn")).toBeVisible();
    await expect(page.locator("#next-level-btn")).toHaveAttribute("href", nextHref);
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
    await expect(page.locator("#success-overlay")).toBeHidden();
    await expect(page.locator("#next-level-btn")).toBeHidden();
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
    await expectReward(page, 3, "pico_level2.html");

    await page.getByRole("button", { name: "Zurück zum Editor" }).click();
    await expect(page.locator("#success-overlay")).toBeHidden();
    await expect(page.locator("#next-level-btn")).toBeVisible();
    await page.locator("#next-level-btn").click();
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
    await expect(page.locator("#pico-result-message")).toHaveText("SIGNAL GESENDET");
    await expectReward(page, 3, "pico_level2.html");
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
    await expect(page.locator("#success-overlay")).toBeHidden();
    await expect(page.locator("#next-level-btn")).toBeHidden();

    const charged = await runCode(page, chargeCode);
    expect(charged.passed).toBe(true);
    state = await page.evaluate(() => window.DroneMissionRuntime.getState());
    expect(state.searchFound).toBe(true);
    expect(state.charged).toBe(true);
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "100");
    await expectReward(page, 3, "pico_level2a.html");
    expect(pageErrors).toEqual([]);
});

test("optional level 2a reads an executed TRANSPONDER update and can be skipped", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level2a.html");
    await expect(page.getByRole("link", { name: "Überspringen" })).toHaveAttribute("href", "pico_level3.html");

    const printedClaim = await runCode(page, `${chargeCode}\nprint("TRANSPONDER: aufgeladen")\n`);
    expect(printedClaim.passed).toBe(false);
    await expect(page.locator("#transponder-state")).toHaveText("suche");
    await expect(page.locator("#success-overlay")).toBeHidden();

    const actualUpdate = await runCode(page, `${chargeCode}\nstatus["TRANSPONDER"] = "aufgeladen"\n`);
    expect(actualUpdate.passed).toBe(true);
    await expect(page.locator("#transponder-state")).toHaveText("aufgeladen");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(3);
    await expectReward(page, 1, "pico_level3.html");
    await expect(page.getByRole("link", { name: "Überspringen" })).toBeHidden();
    expect(pageErrors).toEqual([]);
});

test("level 3 sends visibly and level 4 deletes memory only after that signal", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level3.html");

    const level3 = await runCode(page, sendCode);
    expect(level3.passed).toBe(true);
    await expect(page.locator("#transponder-state")).toHaveText("suche");
    await expect(page.locator("#checks-list .is-missing.is-optional")).toHaveCount(1);
    await expect(page.locator("#pico-result-message")).toHaveText("SIGNAL GESENDET");
    await expect(page.locator("#pico-result-message")).toHaveCSS("color", "rgb(125, 242, 169)");
    expect(await page.locator("#pico-result-message").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(18);
    await expectReward(page, 3, "pico_level4.html");

    await page.getByRole("button", { name: "Zurück zum Editor" }).click();
    await page.locator("#next-level-btn").click();
    await expect(page).toHaveURL(/\/pico_level4\.html$/);
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    expect(await page.evaluate(() => window.DroneMissionRuntime.editor.getValue())).toContain(
        "signal_erfolgreich = drohne.sende()"
    );

    const inheritedWithoutDeletion = await page.evaluate(() => window.DroneMissionRuntime.run());
    expect(inheritedWithoutDeletion.passed).toBe(false);
    await expect(page.locator("#success-overlay")).toBeHidden();

    const wrongOrder = await runCode(page, deleteBeforeSendCode);
    expect(wrongOrder.passed).toBe(false);
    expect(wrongOrder.checks.filter(check => check.label.includes("danach") && !check.passed)).toHaveLength(2);
    await expect(page.locator("#next-level-btn")).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 600 });
    const finale = await runCode(page, finalMemoryCode);
    expect(finale.passed).toBe(true);
    expect(await page.evaluate(() => window.DroneMissionRuntime.getState().memoryDeletedAfterSignal)).toBe(true);
    await expect(page.locator("#success-overlay h1")).toHaveText("MEMORY GELÖSCHT");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(5);
    await expectReward(page, 7, "helikopter_flucht.html");
    const rewardPopup = await page.locator("#success-overlay .success-badge").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top,
            bottom: rect.bottom,
            viewportHeight: window.innerHeight,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight
        };
    });
    expect(rewardPopup.top).toBeGreaterThanOrEqual(0);
    expect(rewardPopup.bottom).toBeLessThanOrEqual(rewardPopup.viewportHeight);
    expect(rewardPopup.clientHeight).toBeLessThanOrEqual(rewardPopup.viewportHeight - 40);
    expect(rewardPopup.scrollHeight).toBeGreaterThan(0);

    await page.locator("#success-overlay .success-btn").click();
    await expect(page).toHaveURL(/\/helikopter_flucht\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jetzt musst du selbst raus.");
    expect(pageErrors).toEqual([]);
});
