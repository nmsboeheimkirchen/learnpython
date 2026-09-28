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

def fliege_zu(x, y):
    drohne.goto(x, y)

status["DROHNE"] = "NOVA"
`;

const cellCode = `${setup}
fliege_zu(-380, -90)
`;

const chargeCode = `${cellCode}
fund = drohne.suche_hier()
print("Gefunden:", fund)
ausruestung.append(fund)
`;

const fullStatusCode = `${chargeCode}
status["TRANSPONDER"] = "aufgeladen"
fliege_zu(340, 15)
signal_erfolgreich = drohne.sende()
if signal_erfolgreich:
    status["TRANSPONDER"] = "gesendet"
`;

const deleteBeforeSendCode = `${chargeCode}
status["DROHNE"] = "self-destroy"
status["TRANSPONDER"] = "delete"
fliege_zu(340, 15)
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
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(count);
    await expect(page.locator("#success-overlay .success-coins")).toHaveAttribute("data-reward-count", String(count));
    await expect(page.locator("#success-overlay .success-btn")).toHaveAttribute("href", nextHref);
    await expect(page.locator("#next-level-btn")).toBeVisible();
    await expect(page.locator("#next-level-btn")).toHaveAttribute("href", nextHref);
}

// Levels 1 and 2 are covered by the dedicated nullpunkt-level*.spec.mjs files.

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

test("legacy level 4 destroys the drone only after its signal", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await openLevel(page, "/pico_level4.html");
    await page.evaluate(code => localStorage.setItem("completedLevelCode_v1", JSON.stringify({pico_level3:code})),fullStatusCode);
    await page.reload();
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
    ))).toBeGreaterThanOrEqual(3_900);
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Der Lord kommt zurück.");
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
        const cockpit = document.querySelector(".nullpunkt-hud")?.getBoundingClientRect();
        return Boolean(stage && cockpit &&
            stage.top >= 0 && stage.top <= 110 &&
            cockpit.top >= 0 && cockpit.bottom <= window.innerHeight);
    })).toBe(true);
});
