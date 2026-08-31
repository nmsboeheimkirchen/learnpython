import { expect, test } from "@playwright/test";

// Deliberately retain spacing, comments and old names inside comments. A handoff
// must not silently rewrite the student's successfully tested source.
const BRIEFING_CODE = [
    "# Mein eigener Museumsweg",
    "# Ziele: Schlüsselkarte (-230, 70), Sternenfragment (-70, -75)",
    "# Notiz: Zugangskarte, Testfragment, Artefakt",
    "import turtle",
    "",
    "drohne = turtle.Turtle()",
    "drohne.speed(0)",
    "drohne.penup()",
    "drohne.goto(260, -170)",
    "inventar = []",
    "",
    "def melde_inventar(liste):",
    '    print("INVENTARLISTE: " + ",".join(liste))',
    "",
    "",
    "drohne.goto(-250, 60)  ",
    "fund=drohne.suche_hier()",
    "inventar.append(fund)",
    "drohne.goto(-390, 45)",
    "fund = drohne.suche_hier()",
    "inventar.append(fund)",
    "",
    "melde_inventar(inventar)",
    "",
    ""
].join("\n");

const SAVED_ATTEMPT = [
    BRIEFING_CODE,
    "# Mein vorheriger Finale-Versuch",
    "def alarm_hacken(code):",
    '    print("ALARM_HACK|" + code)',
    "drohne.goto(250, -60)",
    'alarm_hacken("SERU-7")',
    "drohne.goto(0, 115)"
].join("\n");

const SAVED_COMPLETED = `${SAVED_ATTEMPT}\n# Alte gespeicherte Endlösung`;

async function openFinale(page, { briefing = BRIEFING_CODE, attempted = null, completed = null } = {}) {
    await page.addInitScript(({ briefing, attempted, completed }) => {
        const completedCodes = {};
        const attemptedCodes = {};
        if (briefing !== null) completedCodes.pixelmuseum_briefing = briefing;
        if (completed !== null) completedCodes.pixelmuseum_finale = completed;
        if (attempted !== null) attemptedCodes.pixelmuseum_finale = attempted;
        localStorage.setItem("completedLevelCode_v1", JSON.stringify(completedCodes));
        localStorage.setItem("attemptedLevelCode_v1", JSON.stringify(attemptedCodes));
    }, { briefing, attempted, completed });
    await page.goto("/pixelmuseum_finale.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(
        window.finalePrototype && window.PixelmuseumFinaleTools
    ))).toBe(true);
}

async function editorCode(page) {
    return page.evaluate(() => window.finalePrototype.editor.getValue());
}

test("@ipad the exact briefing source wins over both a saved finale attempt and completed solution", async ({ page }) => {
    await openFinale(page, { attempted: SAVED_ATTEMPT, completed: SAVED_COMPLETED });

    const loaded = await editorCode(page);
    expect(loaded).toBe(BRIEFING_CODE);
    expect(loaded).not.toContain("def alarm_hacken(");
    expect(loaded).not.toContain("drohne.goto(0, 115)");
    expect(loaded).toContain("# Ziele: Schlüsselkarte (-230, 70)");
    expect(loaded).toContain("# Notiz: Zugangskarte, Testfragment, Artefakt");
    await expect(page.locator("#restore-finale-attempt")).toBeVisible();

    const saved = await page.evaluate(() => ({
        attempted: JSON.parse(localStorage.getItem("attemptedLevelCode_v1")).pixelmuseum_finale,
        completed: JSON.parse(localStorage.getItem("completedLevelCode_v1")).pixelmuseum_finale,
        briefing: JSON.parse(localStorage.getItem("completedLevelCode_v1")).pixelmuseum_briefing
    }));
    expect(saved).toEqual({ attempted: SAVED_ATTEMPT, completed: SAVED_COMPLETED, briefing: BRIEFING_CODE });
});

test("a saved finale attempt loads only on request and reset returns the exact briefing", async ({ page }) => {
    await openFinale(page, { attempted: SAVED_ATTEMPT, completed: SAVED_COMPLETED });
    const recovery = page.locator("#restore-finale-attempt");

    expect(await editorCode(page)).toBe(BRIEFING_CODE);
    await recovery.click();
    expect(await editorCode(page)).toBe(SAVED_ATTEMPT);

    await page.locator("[data-finale-reset]").click();
    expect(await editorCode(page)).toBe(BRIEFING_CODE);

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype))).toBe(true);
    expect(await editorCode(page)).toBe(BRIEFING_CODE);
    await expect(recovery).toBeVisible();
});

test("a completed finale is an explicit recovery fallback, never the default source", async ({ page }) => {
    await openFinale(page, { completed: SAVED_COMPLETED });

    expect(await editorCode(page)).toBe(BRIEFING_CODE);
    await page.locator("#restore-finale-attempt").click();
    expect(await editorCode(page)).toBe(SAVED_COMPLETED);
    await page.locator("[data-finale-reset]").click();
    expect(await editorCode(page)).toBe(BRIEFING_CODE);
});

test("without a saved briefing the starter stays unsolved instead of preloading a saved finale", async ({ page }) => {
    await openFinale(page, { briefing: null, attempted: SAVED_ATTEMPT, completed: SAVED_COMPLETED });
    const starter = await page.evaluate(() => window.FINALE_CONFIG.defaultCode);

    expect(await editorCode(page)).toBe(starter);
    expect(starter).not.toContain("def alarm_hacken(");
    expect(starter).not.toContain("drohne.goto(0, 115)");
    await page.locator("#restore-finale-attempt").click();
    expect(await editorCode(page)).toBe(SAVED_ATTEMPT);
    await page.locator("[data-finale-reset]").click();
    expect(await editorCode(page)).toBe(starter);
});

test("the optional recovery control stays hidden when no distinct finale code exists", async ({ page }) => {
    await openFinale(page);
    expect(await editorCode(page)).toBe(BRIEFING_CODE);
    await expect(page.locator("#restore-finale-attempt")).toBeHidden();
});

test("finale recovery cannot replace code during a run and retains the previous attempt for explicit recovery", async ({ page }) => {
    await openFinale(page, { attempted: SAVED_ATTEMPT });
    const recovery = page.locator("#restore-finale-attempt");
    const runningCode = 'import time\nprint("Lauf gestartet")\ntime.sleep(1.2)\nprint("Lauf beendet")';

    await page.evaluate(source => {
        window.finalePrototype.editor.setValue(source);
        window.handoffRunningPromise = window.finalePrototype.run();
    }, runningCode);
    await expect(recovery).toBeDisabled();
    await page.evaluate(() => document.getElementById("restore-finale-attempt").click());
    expect(await editorCode(page)).toBe(runningCode);

    await page.evaluate(() => window.handoffRunningPromise);
    await expect(recovery).toBeEnabled();
    await recovery.click();
    expect(await editorCode(page)).toBe(SAVED_ATTEMPT);
    await page.locator("[data-finale-reset]").click();
    expect(await editorCode(page)).toBe(BRIEFING_CODE);
});
