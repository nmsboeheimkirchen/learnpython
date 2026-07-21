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

const cellCode = `${setup}
fahre_zu(-380, -90)
`;

const chargeCode = `${cellCode}
fund = drohne.suche_hier()
print("Gefunden:", fund)
ausruestung.append(fund)
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

async function runTeacherSolution(page, solutionId) {
    return page.evaluate(async id => {
        if (!window.TeacherSolutions?.load(id)) {
            throw new Error(`Lehrerlösung ${id} konnte nicht geladen werden.`);
        }
        const result = await window.DroneMissionRuntime.run();
        window.__lastTeacherRun = {
            resolvedAt: performance.now(),
            message: document.getElementById("pico-result-message")?.textContent || "",
            popupVisible: Boolean(document.getElementById("success-overlay")?.offsetParent)
        };
        return result;
    }, solutionId);
}

async function armSuccessTiming(page) {
    await page.evaluate(() => {
        const triggerSuccess = window.triggerSuccess;
        window.__successTriggeredAt = null;
        window.triggerSuccess = (...args) => {
            window.__successTriggeredAt = performance.now();
            return triggerSuccess(...args);
        };
    });
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

    const discovery = await runTeacherSolution(page, "pico_level1");
    expect(discovery.passed).toBe(true);
    expect(discovery.levelComplete).toBe(false);
    await expect(page.locator("#run-status")).toHaveText("Energieproblem erkannt");
    await expect(page.locator("#drone-name")).toHaveText("PICO");
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

    const arrival = await runTeacherSolution(page, "pico_level1_cell");
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
        'status["DROHNE"] = "PICO"'
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

    const charged = await runTeacherSolution(page, "pico_level2");
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

    const actualUpdate = await runTeacherSolution(page, "pico_level2a");
    expect(actualUpdate.passed).toBe(true);
    await expect(page.locator("#transponder-state")).toHaveText("aufgeladen");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(3);
    await expectReward(page, 3, "pico_level3.html");
    await expect(page.getByRole("link", { name: "Überspringen" })).toBeHidden();
    expect(pageErrors).toEqual([]);
});

test("level 3 sends visibly and level 4 destroys the drone only after that signal", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level3.html");

    await armSuccessTiming(page);
    const level3 = await runTeacherSolution(page, "pico_level3");
    expect(level3.passed).toBe(true);
    expect(await page.evaluate(() => window.__lastTeacherRun)).toMatchObject({
        message: "SIGNAL GESENDET",
        popupVisible: false
    });
    await expect(page.locator("#transponder-state")).toHaveText("aufgeladen");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(4);
    await expect(page.locator("#pico-result-message")).toHaveText("SIGNAL GESENDET");
    await expect(page.locator("#pico-result-message")).toHaveCSS("color", "rgb(125, 242, 169)");
    expect(await page.locator("#pico-result-message").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(18);
    await expectReward(page, 3, "pico_level4.html");
    expect(await page.evaluate(() => (
        window.__successTriggeredAt - window.__lastTeacherRun.resolvedAt
    ))).toBeGreaterThanOrEqual(900);

    await page.getByRole("button", { name: "Zurück zum Editor" }).click();
    await page.locator("#next-level-btn").evaluate(link => {
        link.href = "pico_level4.html?e2e";
    });
    await page.locator("#next-level-btn").click();
    await expect(page).toHaveURL(/\/pico_level4\.html\?e2e$/);
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
    await expect(page.locator("#pico-result-message")).not.toHaveText("DELETING");
    await expect(page.locator("body")).not.toHaveClass(/pico-deleting/);
    await expect(page.locator("#success-overlay")).toBeHidden();
    await expect(page.locator("#next-level-btn")).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 600 });
    await armSuccessTiming(page);
    const finale = await runTeacherSolution(page, "pico_level4");
    expect(finale.passed).toBe(true);
    expect(await page.evaluate(() => window.__lastTeacherRun)).toMatchObject({
        message: "DELETING",
        popupVisible: false
    });
    expect(await page.evaluate(() => window.DroneMissionRuntime.getState().memoryDeletedAfterSignal)).toBe(true);
    await expect(page.locator("#pico-result-message")).toHaveText("DELETING");
    await expect(page.locator("body")).toHaveClass(/pico-deleting/);
    await expect(page.locator("#pico-result-message")).toHaveCSS("color", "rgb(255, 98, 92)");
    await expect(page.locator("#pico-result-message")).toHaveCSS("animation-name", "pico-deleting-blink");
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(5);
    await expectReward(page, 7, "helikopter_flucht.html");
    expect(await page.evaluate(() => (
        window.__successTriggeredAt - window.__lastTeacherRun.resolvedAt
    ))).toBeGreaterThanOrEqual(900);
    await expect(page.locator("#success-overlay h1")).toHaveText("DROHNE ZERSTÖRT");
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

test("starting PICO code brings the live cockpit back into view", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 720 });
    await openLevel(page, "/pico_level3.html");
    await page.evaluate(() => {
        window.DroneMissionRuntime.editor.setValue('print("Scrolltest")');
        window.scrollTo(0, document.documentElement.scrollHeight);
    });

    await page.locator("#run-btn").click();
    await expect.poll(() => page.evaluate(() => {
        const stage = document.querySelector(".mission-stage-panel")?.getBoundingClientRect();
        const cockpit = document.querySelector(".pico-mission-hud")?.getBoundingClientRect();
        return Boolean(stage && cockpit &&
            stage.top >= 0 && stage.top <= 110 &&
            cockpit.top >= 0 && cockpit.bottom <= window.innerHeight);
    })).toBe(true);
});
