import { expect, test } from "@playwright/test";

async function openBriefing(page) {
    await page.goto("/pixelmuseum_briefing.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
}

async function runBriefingCode(page, code) {
    await page.evaluate(async source => {
        window.DroneMissionRuntime.editor.setValue(source);
        await window.DroneMissionRuntime.run();
    }, code);
}

async function openFinale(page, query = "?e2e") {
    await page.goto(`/pixelmuseum_finale.html${query}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype && window.PixelmuseumPath))).toBe(true);
}

async function runFinaleCode(page, code) {
    await page.evaluate(async source => {
        window.finalePrototype.editor.setValue(source);
        await window.finalePrototype.run();
    }, code);
}

const FAST_ESCAPE_CODE = `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(0, -210)
drohne.speed(8)
inventar = []

drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(0, 115)
print("INVENTARLISTE: " + ",".join(inventar))`;

const HACK_ESCAPE_CODE = `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(0, -210)
drohne.speed(4)
turtle.Screen().delay(30)
inventar = []

def gehe_zu(x, y):
    drohne.goto(x, y)

def alarm_hacken(code):
    print("ALARM_HACK|" + code)

gehe_zu(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)

gehe_zu(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)

gehe_zu(250, -60)
alarm_hacken("SERU-7")
gehe_zu(0, 115)
print("INVENTARLISTE: " + ",".join(inventar))`;

test("@ipad Pixelmuseum briefing rejects invented items and rewards the real ordered chain", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await openBriefing(page);

    await runBriefingCode(page, `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
inventar = ["Zugangskarte", "Testfragment"]
print("BRIEFING-INVENTAR: " + ",".join(inventar))`);

    await expect(page.locator("body")).not.toHaveClass(/mission-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await expect(page.locator("#checks-list")).toContainText("Zugangskarte durch echte Suche aufgenommen");

    const solutionLoaded = await page.evaluate(() => window.TeacherSolutions.load("pixelmuseum_briefing"));
    expect(solutionLoaded).toBe(true);
    await page.evaluate(async () => window.DroneMissionRuntime.run());

    await expect(page.locator("body")).toHaveClass(/mission-passed/);
    await expect(page.locator("#briefing-stage-message")).toHaveText("BRIEFING BEREIT");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(3);
    await expect(page.locator("#success-overlay .success-btn")).toHaveAttribute("href", "pixelmuseum_finale.html");
    await expect(page.locator("#next-level-btn")).toHaveAttribute("href", "pixelmuseum_finale.html");
    await expect(page.locator("#next-level-btn")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum central help follows runtime evidence, marks edited code stale and persists its count", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await openFinale(page);
    await page.evaluate(() => localStorage.removeItem("pixelmuseumHelp_v1"));
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.PixelmuseumPath))).toBe(true);

    const sourceInspector = page.locator(".museum-source-inspector");
    await expect(sourceInspector).not.toHaveAttribute("open", "");
    await sourceInspector.locator("summary").click();
    await expect(sourceInspector).toHaveAttribute("open", "");
    await expect(sourceInspector.locator("code")).toContainText('data-alarm-code="SERU-7"');

    const helpButton = page.locator("#museum-help-btn");
    const helpPanel = page.locator("#museum-help-panel");
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "RUN_FIRST");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "0");

    await runFinaleCode(page, `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
inventar = []
drohne.goto(-390, 45)
fund = drohne.suche_hier()
print("Fund:", fund)`);

    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "KEYCARD_ORDER");
    await expect(page.locator("#museum-help-level")).toHaveText("Hilfe 1 von 3");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "1");

    await helpButton.click();
    await expect(page.locator("#museum-help-level")).toHaveText("Hilfe 2 von 3");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");

    await page.evaluate(() => window.finalePrototype.editor.setValue('print("geändert")'));
    await expect(helpPanel).toBeHidden();
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "RUN_AGAIN");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.PixelmuseumPath))).toBe(true);
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");
    await page.locator("#museum-help-btn").click();
    await expect(page.locator("#museum-help-panel")).toHaveAttribute("data-help-issue", "RUN_FIRST");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum finale accepts a real fast strategy without source-shape checks and hands off to escape B", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.addInitScript(() => {
        localStorage.removeItem("pixelmuseumHelp_v1");
        localStorage.removeItem("completedLevelCode_v1");
    });
    await openFinale(page);

    await page.evaluate(async () => window.finalePrototype.run());
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();

    await runFinaleCode(page, FAST_ESCAPE_CODE);

    await expect(page.locator("#museum-success")).toHaveText("MISSION ERFOLGREICH – DU BIST ENTKOMMEN!");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect(page.locator("#checks-list")).toContainText("Portal rechtzeitig vor Alarmstufe 1 erreicht");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(3);
    await expect(page.locator("#success-overlay .success-btn")).toHaveAttribute("href", "helikopter_flucht-b.html");
    await expect(page.locator("#next-level-btn")).toHaveAttribute("href", "helikopter_flucht-b.html");
    await expect(page.locator("#next-level-btn")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum production finale completes the touch-accessible hack strategy", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.addInitScript(() => {
        localStorage.removeItem("pixelmuseumHelp_v1");
        localStorage.removeItem("completedLevelCode_v1");
    });
    await openFinale(page, "");

    await runFinaleCode(page, HACK_ESCAPE_CODE);

    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.hackCompleted)).toBe(true);
    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.completedStrategy)).toBe("hack");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum production runtime reports exact hack blockers and clears an obsolete portal trap", async ({ page }) => {
    await openFinale(page);

    const evidence = await page.evaluate(() => {
        const mission = window.FINALE_CONFIG;
        const alarmCode = document.getElementById("museum-system-log").dataset.alarmCode;
        const armMuseum = () => {
            mission.resetHud();
            mission.collectItem("Schlüsselkarte");
            mission.collectItem("Artefakt");
        };

        mission.resetHud();
        mission.requestAlarmHack(alarmCode);
        const tooEarly = mission.lastHackFailure;

        armMuseum();
        mission.atAlarmConsole = true;
        mission.requestAlarmHack("FALSCH");
        const wrongCode = mission.lastHackFailure;

        armMuseum();
        mission.atAlarmConsole = false;
        mission.requestAlarmHack(alarmCode);
        const wrongPlace = mission.lastHackFailure;

        armMuseum();
        mission.alarmFailed = true;
        mission.atAlarmConsole = true;
        mission.requestAlarmHack(alarmCode);
        const tooLate = mission.lastHackFailure;

        armMuseum();
        mission.atAlarmConsole = true;
        mission.requestAlarmHack(alarmCode);
        mission.renderAlarm(1);
        mission.updateExitState();
        mission.showTrappedWarning();
        mission.finishAlarmHack();
        const resolvedIssue = window.PixelmuseumHelpCore.resolveIssue({
            ...window.PixelmuseumPath.getHelpContext(),
            hasRun: true
        }).id;
        mission.stopMissionTimers();

        return {
            tooEarly,
            wrongCode,
            wrongPlace,
            tooLate,
            portalTrapped: mission.portalTrapped,
            portalOpen: mission.portalOpen,
            resolvedIssue
        };
    });

    expect(evidence).toEqual({
        tooEarly: "TOO_EARLY",
        wrongCode: "WRONG_CODE",
        wrongPlace: "WRONG_PLACE",
        tooLate: "TOO_LATE",
        portalTrapped: false,
        portalOpen: true,
        resolvedIssue: "PORTAL_NOT_REACHED"
    });
});

test("Pixelmuseum never rewards or stores code edited during its active run", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("completedLevelCode_v1"));
    await openFinale(page, "");

    await page.evaluate(source => {
        window.finalePrototype.editor.setValue(source);
        window.__activePixelmuseumRun = window.finalePrototype.run();
    }, HACK_ESCAPE_CODE);
    await expect(page.locator("body")).toHaveClass(/program-running/);
    await page.evaluate(() => window.finalePrototype.editor.setValue('print("noch nicht getestet")'));
    await page.evaluate(() => window.__activePixelmuseumRun);

    await expect(page.locator("#validation-title")).toHaveText("Geänderten Code erneut starten", { timeout: 12_000 });
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await expect(page.locator("#museum-help-btn")).toBeEnabled();
    const stored = await page.evaluate(() => localStorage.getItem("completedLevelCode_v1") || "");
    expect(stored).not.toContain("pixelmuseum_finale");
    const attempted = await page.evaluate(() => JSON.parse(
        localStorage.getItem("attemptedLevelCode_v1") || "{}"
    ).pixelmuseum_finale);
    expect(attempted).toBe(HACK_ESCAPE_CODE);
    expect(attempted).not.toContain("noch nicht getestet");
});

test("reset cancels the delayed Pixelmuseum reward UI", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("completedLevelCode_v1"));
    await openFinale(page);
    await runFinaleCode(page, FAST_ESCAPE_CODE);

    await expect(page.locator("#next-level-btn")).toBeVisible();
    await page.evaluate(() => window.finalePrototype.reset());
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await expect(page.locator("#museum-help-btn")).toBeEnabled();
    await page.waitForTimeout(4_150);
    await expect(page.locator("#success-overlay")).toBeHidden();
});
