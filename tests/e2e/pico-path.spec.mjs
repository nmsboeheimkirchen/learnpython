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

// Level 4 calibration and the helicopter transition are covered by nullpunkt-level4.spec.mjs.

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
