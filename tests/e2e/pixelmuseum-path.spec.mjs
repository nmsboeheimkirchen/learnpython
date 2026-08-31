import { expect, test } from "@playwright/test";

async function openBriefing(page) {
    await page.goto("/pixelmuseum_briefing.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(
        window.DroneMissionRuntime && window.PixelmuseumBriefingHelp
    ))).toBe(true);
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

const DIRECT_ESCAPE_CODE = `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(260, -170)
drohne.speed(4)
drohne.pendown()
turtle.Screen().delay(30)
inventar = []

drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)

print("INVENTARLISTE: " + ",".join(inventar))
drohne.speed(20)
drohne.goto(0, 115)`;

const INVENTORY_REPORT = 'print("INVENTARLISTE: " + ",".join(inventar))';
const LATE_ESCAPE_CODE = `import time\n${DIRECT_ESCAPE_CODE.replace(
    "drohne.speed(20)\ndrohne.goto(0, 115)",
    "time.sleep(1.25)\ndrohne.speed(20)\ndrohne.goto(0, 115)"
)}`;

const HACK_ESCAPE_CODE = `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(0, -210)
drohne.speed(4)
turtle.Screen().delay(30)
inventar = []

def melde_inventar(liste):
    print("INVENTARLISTE: " + ",".join(liste))

def alarm_hacken(code):
    print("ALARM_HACK|" + code)

drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(250, -60)
alarm_hacken("SERU-7")
drohne.goto(0, 115)
melde_inventar(inventar)`;

const OWN_BRIEFING_CODE = `import turtle

drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(260, -170)
inventar = []

def melde_inventar(liste):
    print("INVENTARLISTE: " + ",".join(liste))

# Mein eigener Briefing-Plan
drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)

drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)

melde_inventar(inventar)`;

test("@ipad Pixelmuseum briefing rejects invented items and rewards the real ordered chain", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await openBriefing(page);

    await runBriefingCode(page, `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
inventar = ["Schlüsselkarte", "Sternenfragment"]
print("INVENTARLISTE: " + ",".join(inventar))`);

    await expect(page.locator("body")).not.toHaveClass(/mission-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await expect(page.locator("#checks-list")).toContainText("Schlüsselkarte mit suche_hier() gefunden");
    await expect(page.locator("[data-mission-run]")).toBeVisible();
    await expect(page.locator("[data-mission-reset]")).toBeVisible();

    const solutionLoaded = await page.evaluate(() => window.TeacherSolutions.load("pixelmuseum_briefing"));
    expect(solutionLoaded).toBe(true);
    await page.locator("[data-mission-run]").click();

    await expect(page.locator("body")).toHaveClass(/mission-passed/);
    await expect(page.locator("#briefing-stage-message")).toHaveText("BRIEFING BEREIT");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(3);
    await expect(page.locator("#success-overlay .success-btn")).toHaveAttribute("href", "pixelmuseum_finale.html");
    await expect(page.locator("#next-level-btn")).toHaveAttribute("href", "pixelmuseum_finale.html");
    await expect(page.locator("#next-level-btn")).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test("successful personal briefing code becomes the finale baseline and survives reset", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.goto("/");
    await page.evaluate(() => {
        localStorage.removeItem("completedLevelCode_v1");
        localStorage.removeItem("attemptedLevelCode_v1");
    });
    await openBriefing(page);

    await runBriefingCode(page, OWN_BRIEFING_CODE);
    await expect(page.locator("body")).toHaveClass(/mission-passed/);
    const storedBriefingCode = await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pixelmuseum_briefing);
    expect(storedBriefingCode).toBe(OWN_BRIEFING_CODE);

    await openFinale(page);
    const inheritedCode = await page.evaluate(() => window.finalePrototype.editor.getValue());
    expect(inheritedCode).toContain("# Mein eigener Briefing-Plan");
    expect(inheritedCode).toContain("drohne.goto(-250, 60)");
    expect(inheritedCode).toContain("drohne.goto(-390, 45)");
    expect(inheritedCode).toContain("def melde_inventar(liste):");
    expect(inheritedCode).not.toContain("def alarm_hacken(code):");
    expect(inheritedCode).not.toContain("drohne.goto(0, 115)");

    await page.evaluate(() => {
        window.finalePrototype.editor.setValue('print("nur eine vorläufige Änderung")');
        window.finalePrototype.reset();
    });
    await expect.poll(() => page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(inheritedCode);
    expect(pageErrors).toEqual([]);
});

test("finale starts with the briefing even when an older finale attempt includes a portal flight", async ({ page }) => {
    const attemptedCode = `${OWN_BRIEFING_CODE}\ndrohne.goto(0, 115)`;
    await page.addInitScript(({ briefing, attempt }) => {
        localStorage.setItem("completedLevelCode_v1", JSON.stringify({ pixelmuseum_briefing: briefing }));
        localStorage.setItem("attemptedLevelCode_v1", JSON.stringify({ pixelmuseum_finale: attempt }));
    }, { briefing: OWN_BRIEFING_CODE, attempt: attemptedCode });
    await openFinale(page);

    expect(await page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(OWN_BRIEFING_CODE);
    await page.locator("#restore-finale-attempt").click();
    expect(await page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(attemptedCode);
    await page.locator("[data-finale-reset]").click();
    expect(await page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(OWN_BRIEFING_CODE);
    await expect(page.locator("#validation-message")).toContainText("Dein Code aus dem Briefing");
});

test("Pixelmuseum central help explains drohne, fund and the function argument exactly", async ({ page }) => {
    await openBriefing(page);
    const helpButton = page.locator("#museum-help-btn");
    const helpPanel = page.locator("#museum-help-panel");

    await runBriefingCode(page, `import turtle
drohne = turtle.Turtle()
suche_hier()`);
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "SEARCH_NEEDS_DRONE");
    await expect(page.locator("#museum-help-message")).toContainText("Namen der Drohne");

    await runBriefingCode(page, `import turtle
drohne = turtle.Turtle()
inventar = []
drohne.goto(-250, 60)
drohne.suche_hier()
inventar.append(fund)`);
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "FUND_NOT_STORED");
    await expect(page.locator("#museum-help-message")).toContainText("Variablen fund");

    const completeWithoutReport = `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
inventar = []
def melde_inventar(liste):
    print("INVENTARLISTE: " + ",".join(liste))
drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)
drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)`;
    await runBriefingCode(page, completeWithoutReport);
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "INVENTORY_OUTPUT");
    await expect(page.locator("#museum-help-message")).toContainText("melde_inventar(liste)");
    await helpButton.click();
    await expect(page.locator("#museum-help-message")).toHaveText("Schau dir die Funktion melde_inventar an und setze sie ein!");

    await runBriefingCode(page, `${completeWithoutReport}\nmelde_inventar(liste)`);
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "INVENTORY_PARAMETER");
    await expect(page.locator("#museum-help-message")).toContainText("Parametername");
});

test("Pixelmuseum central help follows runtime evidence, marks edited code stale and persists its count", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await openBriefing(page);
    await page.evaluate(() => {
        localStorage.removeItem("pixelmuseumHelp_v1");
        localStorage.removeItem("completedLevelCode_v1");
        localStorage.removeItem("attemptedLevelCode_v1");
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.PixelmuseumBriefingHelp))).toBe(true);

    const helpButton = page.locator("#museum-help-btn");
    const helpPanel = page.locator("#museum-help-panel");
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "RUN_FIRST");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "0");

    await runBriefingCode(page, `import turtle
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

    await page.evaluate(() => window.DroneMissionRuntime.editor.setValue('print("geändert")'));
    await expect(helpPanel).toBeHidden();
    await helpButton.click();
    await expect(helpPanel).toHaveAttribute("data-help-issue", "RUN_AGAIN");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.PixelmuseumBriefingHelp))).toBe(true);
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");
    await page.locator("#museum-help-btn").click();
    await expect(page.locator("#museum-help-panel")).toHaveAttribute("data-help-issue", "RUN_FIRST");
    await expect(page.locator("#museum-help-count")).toHaveAttribute("data-help-count", "2");
    expect(pageErrors).toEqual([]);
});

test("@ipad a fast direct escape through the open portal succeeds without falsely completing the hack", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.addInitScript(() => {
        localStorage.removeItem("completedLevelCode_v1");
    });
    // Exercise real Turtle animation, including the student's speed(20) change.
    await openFinale(page, "");
    await expect(page.locator("[data-finale-run]")).toBeVisible();
    await expect(page.locator("[data-finale-reset]")).toBeVisible();

    await runFinaleCode(page, DIRECT_ESCAPE_CODE);
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect(page.locator("body")).not.toHaveClass(/portal-trapped|portal-locked|alarm-failed/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Alarm an der Konsole gehackt" })).toHaveClass(/is-missing/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Gültiger Fluchtweg" })).toHaveClass(/is-passed/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Inventarliste korrekt ausgegeben" })).toHaveClass(/is-passed/);
    await expect(page.locator("#console-output")).toContainText("INVENTARLISTE: Schlüsselkarte,Sternenfragment");
    await expect(page.locator("#console-output")).toContainText("DU BIST ENTKOMMEN!");
    await expect(page.locator("#museum-success")).toContainText("DU BIST ENTKOMMEN!");
    await expect(page.locator("#exit-state")).toHaveText("entkommen");
    await expect(page.locator("#console-output")).not.toContainText("DU BIST GEFANGEN!");
    await expect(page.locator("#next-level-btn")).toBeVisible();
    const escapeState = await page.evaluate(() => ({
        level: window.FINALE_CONFIG.alarmLevel,
        timer: window.FINALE_CONFIG.alarmTimer,
        escaped: window.FINALE_CONFIG.escaped,
        reached: window.FINALE_CONFIG.portalReached,
        hacked: window.FINALE_CONFIG.hackCompleted,
        disabled: window.FINALE_CONFIG.alarmDisabled,
        strategy: window.FINALE_CONFIG.completedStrategy
    }));
    expect(escapeState).toEqual({ level: 1, timer: null, escaped: true, reached: true, hacked: false, disabled: false, strategy: "sprint" });
    expect(await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pixelmuseum_finale)).toBe(DIRECT_ESCAPE_CODE);

    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    await expect(page.locator("#success-overlay .success-coin")).toHaveCount(3);
    expect(await page.evaluate(() => window.FINALE_CONFIG.alarmLevel)).toBe(escapeState.level);
    expect(await page.evaluate(() => window.FINALE_CONFIG.alarmTimer)).toBeNull();
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum locks the portal at alarm level 2 without prematurely awarding success", async ({ page }) => {
    await openFinale(page);
    const states = await page.evaluate(() => {
        const mission = window.FINALE_CONFIG;
        mission.resetHud();
        mission.collectItem("Schlüsselkarte");
        mission.collectItem("Sternenfragment");
        mission.stopMissionTimers();
        const snapshot = () => ({
            level: mission.alarmLevel,
            open: mission.portalOpen,
            alarmVisible: document.body.classList.contains("alarm-active"),
            barred: document.body.classList.contains("portal-locked"),
            escaped: mission.escaped,
            successVisible: document.body.classList.contains("escape-success")
        });
        const first = snapshot();
        mission.applyAlarmSnapshot(mission.alarmState.advance());
        const second = snapshot();
        mission.onTurtleFrame({ x: 0, y: 115 });
        const lateArrival = { ...snapshot(), message: mission.validate("", "").message };
        mission.applyAlarmSnapshot(mission.alarmState.advance());
        const third = snapshot();
        mission.stopMissionTimers();
        return { first, second, lateArrival, third };
    });

    expect(states.first).toEqual({ level: 1, open: true, alarmVisible: true, barred: false, escaped: false, successVisible: false });
    expect(states.second).toMatchObject({ level: 2, open: false, barred: true });
    expect(states.lateArrival).toMatchObject({ open: false, barred: true, escaped: false, successVisible: false });
    expect(states.lateArrival.message).toContain("Du bist gefangen!");
    expect(states.third).toMatchObject({ level: 3, open: false, barred: true });
});

test("a delayed direct escape is trapped after the portal locks", async ({ page }) => {
    await openFinale(page);
    await runFinaleCode(page, LATE_ESCAPE_CODE);

    await expect(page.locator("#console-output")).toContainText("DU BIST GEFANGEN!");
    await expect(page.locator("#exit-state")).toHaveText("gesperrt");
    await expect(page.locator("#checks-list li").filter({ hasText: "Gültiger Fluchtweg" })).toHaveClass(/is-missing/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Alarm an der Konsole gehackt" })).toHaveClass(/is-missing/);
    await expect(page.locator("body")).not.toHaveClass(/validation-passed|escape-success/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    expect(await page.evaluate(() => window.FINALE_CONFIG.escaped)).toBe(false);
    expect(await page.evaluate(() => window.FINALE_CONFIG.completedStrategy)).toBeNull();
});

test("a late direct escape keeps its trapped output after a following Python error", async ({ page }) => {
    await openFinale(page);
    await runFinaleCode(page, `${LATE_ESCAPE_CODE}
def alarm_hacken(code):
    print("ALARM_HACK|" + code)
alarm_hacken(code)`);

    await expect(page.locator("#museum-warning")).toHaveText("DU BIST GEFANGEN!");
    await expect(page.locator("#console-output")).toContainText("DU BIST GEFANGEN!");
    await expect(page.locator("#console-output")).toContainText("NameError");
    await expect(page.locator("#console-output")).toContainText("INVENTARLISTE:");
    expect((await page.evaluate(() => window.finalePrototype.getOutput())).match(/DU BIST GEFANGEN!/g)).toHaveLength(1);
    await expect(page.locator("body")).not.toHaveClass(/validation-passed|escape-success/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
});

test("a fast escape without the inventory report does not award or save a completed mission", async ({ page }) => {
    await openFinale(page);
    await runFinaleCode(page, DIRECT_ESCAPE_CODE.replace(`\n${INVENTORY_REPORT}`, ""));

    expect(await page.evaluate(() => window.FINALE_CONFIG.escaped)).toBe(true);
    await expect(page.locator("#checks-list li").filter({ hasText: "Gültiger Fluchtweg" })).toHaveClass(/is-passed/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Inventarliste korrekt ausgegeben" })).toHaveClass(/is-missing/);
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await page.waitForTimeout(4_150);
    await expect(page.locator("#success-overlay")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pixelmuseum_finale)).toBeUndefined();
});

test("a Python error after a fast escape cancels every pending reward", async ({ page }) => {
    await openFinale(page);
    await runFinaleCode(page, `import time\n${DIRECT_ESCAPE_CODE}\ntime.sleep(0.2)\nprint(nicht_definiert)`);

    await expect(page.locator("#console-output")).toContainText("INVENTARLISTE: Schlüsselkarte,Sternenfragment");
    await expect(page.locator("#console-output")).toContainText("NameError");
    await expect(page.locator("#console-output")).not.toContainText("DU BIST GEFANGEN!");
    await expect(page.locator("#validation-title")).toHaveText("Programm gestoppt");
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await page.waitForTimeout(4_150);
    await expect(page.locator("#success-overlay")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pixelmuseum_finale)).toBeUndefined();
});

test("the hack check turns green at the console before the drone escapes", async ({ page }) => {
    await openFinale(page);
    const hackOnly = HACK_ESCAPE_CODE.replace("drohne.goto(0, 115)\n", "");
    await runFinaleCode(page, hackOnly);

    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    const hackCheck = page.locator("#checks-list li").filter({ hasText: "Alarm an der Konsole gehackt" });
    await expect(hackCheck).toHaveClass(/is-passed/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Gültiger Fluchtweg" })).toHaveClass(/is-missing/);
    await expect(page.locator("body")).not.toHaveClass(/validation-passed|escape-success/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
});

test("a completed hack is shown live during a running program without awarding the whole mission", async ({ page }) => {
    await openFinale(page);
    const liveHack = `import time\n${HACK_ESCAPE_CODE.replace("drohne.goto(0, 115)\n", "")}\ntime.sleep(2.5)`;
    await page.evaluate(source => {
        window.finalePrototype.editor.setValue(source);
        window.liveHackPromise = window.finalePrototype.run();
    }, liveHack);

    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    await expect(page.locator("body")).toHaveClass(/program-running/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Alarm an der Konsole gehackt" })).toHaveClass(/is-passed/);
    await expect(page.locator("#checks-list li").filter({ hasText: "Gültiger Fluchtweg" })).toHaveClass(/is-missing/);
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await page.evaluate(() => window.liveHackPromise);
    await expect(page.locator("#checks-list li").filter({ hasText: "Alarm an der Konsole gehackt" })).toHaveClass(/is-passed/);
});

test("the central message reveals the password hints in order without changing student code", async ({ page }) => {
    await openFinale(page);
    const originalCode = await page.evaluate(() => window.finalePrototype.editor.getValue());
    await page.locator(".museum-tool-card summary").click();
    await expect(page.locator("#alarm-help-panel")).toBeHidden();
    await page.locator("#alarm-help-btn").click();
    await expect(page.locator("#alarm-help-level")).toHaveText("Hinweis 1 von 2");
    await expect(page.locator("#alarm-help-message")).toHaveText("code ist nur der Platzhalter! Du musst ein Passwort unter Anführungszeichen eingeben.");
    await page.locator("#alarm-help-btn").click();
    await expect(page.locator("#alarm-help-level")).toHaveText("Hinweis 2 von 2");
    await expect(page.locator("#alarm-help-message")).toHaveText("Suche das Passwort im Quelltext der Seite!");
    await expect(page.locator("#alarm-help-btn")).toBeDisabled();
    expect(await page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(originalCode);
});

test("Pixelmuseum production finale completes the touch-accessible hack strategy", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.addInitScript(() => {
        localStorage.removeItem("completedLevelCode_v1");
    });
    await openFinale(page, "");

    await expect(page.locator("#alarm-helper-code")).toContainText("def alarm_hacken(code):");
    await expect.poll(() => page.evaluate(() => window.PixelmuseumFinaleTools?.ALARM_HELPER)).toContain("ALARM_HACK|");
    await page.locator(".museum-tool-card summary").click();
    await expect(page.locator(".museum-tool-card")).toHaveAttribute("open", "");
    await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async text => { window.__copiedAlarmHelper = text; } }
        });
    });
    await page.locator("#copy-alarm-helper").click();
    await expect(page.locator("#copy-alarm-status")).toContainText("Funktion kopiert");
    await expect.poll(() => page.evaluate(() => window.__copiedAlarmHelper)).toContain("def alarm_hacken(code):");

    const sourceInspector = page.locator(".museum-source-inspector");
    await expect(sourceInspector).not.toHaveAttribute("open", "");
    await sourceInspector.locator("summary").click();
    await expect(sourceInspector).toHaveAttribute("open", "");
    await expect(sourceInspector.locator("code")).toContainText('data-alarm-code="SERU-7"');

    await runFinaleCode(page, HACK_ESCAPE_CODE);

    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.hackCompleted)).toBe(true);
    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.completedStrategy)).toBe("hack");
    await expect(page.locator("#console-output")).not.toContainText("DU BIST GEFANGEN!");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 7_000 });
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum finale teacher solution loads from its button and completes the hack route", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await openFinale(page, "#l");

    const solutionButton = page.locator('[data-teacher-solution="pixelmuseum_finale"]');
    await expect(solutionButton).toBeVisible();
    await solutionButton.click();
    await expect.poll(() => page.evaluate(() => window.finalePrototype.editor.getValue())).toContain(
        'alarm_hacken("SERU-7")'
    );

    await page.locator("[data-finale-run]").click();
    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.hackCompleted), { timeout: 15_000 }).toBe(true);
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect(page.locator("#next-level-btn")).toBeVisible();
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
            mission.collectItem("Sternenfragment");
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
        mission.stopMissionTimers();

        return {
            tooEarly,
            wrongCode,
            wrongPlace,
            tooLate,
            portalTrapped: mission.portalTrapped,
            portalOpen: mission.portalOpen
        };
    });

    expect(evidence).toEqual({
        tooEarly: "TOO_EARLY",
        wrongCode: "WRONG_CODE",
        wrongPlace: "WRONG_PLACE",
        tooLate: "TOO_LATE",
        portalTrapped: false,
        portalOpen: true
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
    await runFinaleCode(page, HACK_ESCAPE_CODE);

    await expect(page.locator("#next-level-btn")).toBeVisible();
    await page.evaluate(() => window.finalePrototype.reset());
    await expect(page.locator("#next-level-btn")).toBeHidden();
    await page.waitForTimeout(4_150);
    await expect(page.locator("#success-overlay")).toBeHidden();
});
