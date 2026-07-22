import { expect, test } from "@playwright/test";

const sharedAssetVersion = "20260722-1";
const styleAssetVersion = "20260722-2";
const runnerAssetVersion = "20260722-4";
const logoAssetVersion = "20260720-2";

const missionPages = [
    "mission1_start.html",
    "mission1_level1.html",
    "mission1_level2.html",
    "mission1_level3.html",
    "mission2_start.html",
    "mission2_level1.html",
    "mission2_level2.html",
    "mission2_level3.html",
    "mission3_start.html",
    "mission3_level1.html",
    "mission3_level2.html",
    "mission3_level3.html",
    "mission4_start.html",
    "mission4_level1.html",
    "mission4_level2.html",
    "mission4_level3.html",
    "agent_training_start.html",
    "agent_training_level1.html"
];

const ipadMissionPages = new Set([
    "mission1_start.html",
    "mission1_level1.html",
    "mission2_level1.html",
    "mission3_level3.html",
    "mission4_level3.html",
    "agent_training_level1.html"
]);

const activeIntroMissionLevelPages = missionPages.filter(pageName =>
    /^mission[123]_level[123]\.html$/.test(pageName)
);

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

async function elementRect(locator) {
    return locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width
        };
    });
}

async function documentOverflow(page) {
    return page.evaluate(() => ({
        body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }));
}

test("mission pages expose the shared Agent PY dock without horizontal overflow", { tag: "@ipad" }, async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    const logoResponse = await page.request.get(`/assets/brand/agent-py-logo.png?v=${logoAssetVersion}`);
    expect(logoResponse.ok()).toBe(true);
    expect(logoResponse.headers()["content-type"]).toContain("image/png");

    const useIpadSample = testInfo.project.name === "webkit-ipad" && process.env.PLAYWRIGHT_FULL_MATRIX !== "1";
    const pages = useIpadSample
        ? missionPages.filter(pageName => ipadMissionPages.has(pageName))
        : missionPages;

    for (const missionPage of pages) {
        await page.goto(`/${missionPage}`);
        await expect(page.locator("#main-content")).toBeVisible();

        const dock = page.locator("#learning-nav-dock");
        const home = page.locator("#agent-py-home");
        const menu = page.locator("#menu-btn");
        await expect(dock).toBeVisible();
        await expect(home).toBeVisible();
        await expect(home).toHaveAttribute("href", "index.html");
        await expect(home).toHaveAttribute("aria-label", "Agent PY – zur Startseite");
        await expect(home.locator(".mission-home-logo")).toHaveAttribute(
            "src",
            `assets/brand/agent-py-logo.png?v=${logoAssetVersion}`
        );
        await expect(menu).toBeVisible();
        await expect(page.locator(`link[href="assets/style.css?v=${styleAssetVersion}"]`)).toHaveCount(1);
        await expect(page.locator(`script[src="assets/runner.js?v=${runnerAssetVersion}"]`)).toHaveCount(1);
        await expect(page.locator(`script[src="assets/navigation.js?v=${sharedAssetVersion}"]`)).toHaveCount(1);
        if (missionPage.includes("_level")) {
            await expect(page.locator(`script[src="assets/editor.js?v=${sharedAssetVersion}"]`)).toHaveCount(1);
        }

        const dockRect = await elementRect(dock);
        const homeRect = await elementRect(home);
        const menuRect = await elementRect(menu);
        const viewport = page.viewportSize();
        expect(dockRect.left).toBeGreaterThanOrEqual(0);
        expect(dockRect.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(homeRect.right).toBeLessThanOrEqual(menuRect.left + 1);

        const overflow = await documentOverflow(page);
        expect(
            overflow.body,
            `${missionPage} overflows the body in ${testInfo.project.name}`
        ).toBeLessThanOrEqual(1);
        expect(
            overflow.document,
            `${missionPage} overflows the document in ${testInfo.project.name}`
        ).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
});

test("the mission home button uses the supplied logo compactly on phones and returns to A", { tag: "@ipad" }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mission1_level1.html");

    await expect(page.locator(".mission-home-logo")).toBeVisible();
    const logoRect = await elementRect(page.locator(".mission-home-logo"));
    expect(logoRect.width).toBeLessThanOrEqual(96.5);
    const dockRect = await elementRect(page.locator("#learning-nav-dock"));
    expect(dockRect.left).toBeGreaterThanOrEqual(0);
    expect(dockRect.right).toBeLessThanOrEqual(390);

    await page.locator("#agent-py-home").click();
    await expect(page.locator("body")).toHaveClass(/home-path/);
    await expect(page.locator("h1")).toContainText("Entdecke,");
});

test("the learning-path drawer overlays accessibly and restores focus", { tag: "@ipad" }, async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/mission1_level1.html");

    const main = page.locator("#main-content");
    const menuButton = page.locator("#menu-btn");
    const drawer = page.locator("dialog#mySidebar");
    const closeButton = page.locator("#navigation-close-btn");
    const activeLevel = page.locator("#link-level1");
    const lockedLevel = page.locator("#link-level2");

    await expect(main).toBeVisible();
    await expect(menuButton).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-controls", "mySidebar");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveAttribute("aria-labelledby", "sidebar-title");
    await expect(activeLevel).toHaveAttribute("aria-current", "page");
    await expect(lockedLevel).toHaveAttribute("aria-disabled", "true");
    await expect(lockedLevel).toHaveAttribute("tabindex", "-1");

    const before = await elementRect(main);
    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("open", "");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(closeButton).toBeFocused();
    await expect.poll(async () => (await elementRect(drawer)).left).toBeGreaterThanOrEqual(0);
    const after = await elementRect(main);

    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);

    const drawerRect = await elementRect(drawer);
    const viewport = page.viewportSize();
    expect(drawerRect.left).toBeGreaterThanOrEqual(0);
    expect(drawerRect.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(drawerRect.width).toBeLessThan(before.width);

    const overflow = await documentOverflow(page);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
    expect(pageErrors).toEqual([]);
});

test("legacy Mission 1 level 4 redirects to the combined level 3", async ({ page }) => {
    await page.goto("/mission1_level4.html#legacy-progress");

    await expect(page).toHaveURL(/\/mission1_level3\.html#legacy-progress$/);
    await expect(page.locator("h1")).toContainText("Weiter geht‘s mit der Indentification");
    await expect(page.locator(".level-badge")).toHaveText("Level 3 von 3");
    await expect(page.locator("#link-level4")).toHaveCount(0);
});

test("Missions 1 to 3 show Python code above a separate result area", async ({ page }) => {
    for (const missionPage of activeIntroMissionLevelPages) {
        await page.goto(`/${missionPage}`);
        await expect(page.locator(".editor-panel > h2").first()).toHaveText("Python-Code");
        await expect(page.locator("#console-heading")).toHaveText("Ergebnis");

        const pageText = await page.locator("body").innerText();
        expect(pageText).not.toMatch(/Python Terminal|Bereit für deine Befehle|schwarzen? Fenster|Drohnencode/i);
    }
});

test("CodeMirror line numbers stay in the gutter and align with code rows", async ({ page }) => {
    await page.goto("/mission1_level2.html");
    await expect(page.locator(".CodeMirror-code > div").first()).toBeVisible();

    const rows = await page.evaluate(() => {
        return [...document.querySelectorAll(".CodeMirror-code > div")]
            .map(row => {
                const line = row.querySelector("pre.CodeMirror-line");
                const number = row.querySelector(".CodeMirror-linenumber");
                if (!line || !number) return null;
                const lineRect = line.getBoundingClientRect();
                const numberRect = number.getBoundingClientRect();
                return {
                    lineLeft: lineRect.left,
                    lineTop: lineRect.top,
                    numberRight: numberRect.right,
                    numberTop: numberRect.top
                };
            })
            .filter(Boolean);
    });

    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (let index = 0; index < 6; index += 1) {
        expect(rows[index].numberRight).toBeLessThanOrEqual(rows[index].lineLeft + 1);
        expect(Math.abs(rows[index].numberTop - rows[index].lineTop)).toBeLessThanOrEqual(1);
    }

    const syntaxColors = await page.evaluate(() => {
        const comment = document.querySelector(".cm-comment");
        const printKeyword = document.querySelector(".cm-builtin");
        return {
            comment: comment ? getComputedStyle(comment).color : null,
            printKeyword: printKeyword ? getComputedStyle(printKeyword).color : null
        };
    });
    expect(syntaxColors.comment).toBe("rgb(63, 191, 127)");
    expect(syntaxColors.comment).not.toBe(syntaxColors.printKeyword);
});

test("Mission finale buttons navigate to the next mission", async ({ page }) => {
    const handoffs = [
        ["mission1_level3.html", "mission2_start.html"],
        ["mission2_level3.html", "mission3_start.html"],
        ["mission3_level3.html", "mission4_start.html"]
    ];

    for (const [source, target] of handoffs) {
        await page.goto(`/${source}`);
        const nextMission = page.locator("#next-level-btn");
        await expect(nextMission).toHaveText("Nächste Mission");
        await expect(nextMission).toHaveAttribute(
            "onclick",
            `window.location.href='${target}'`
        );

        await nextMission.evaluate(button => button.click());
        await expect(page).toHaveURL(new RegExp(`/${target.replace(".", "\\.")}$`));
    }
});

test("optional Mission 2 level 3 starts without elif and can unlock Mission 3", async ({ page }) => {
    await page.goto("/mission2_level3.html");

    const starter = await page.locator("#python-editor").inputValue();
    expect(starter).toContain('kabel = input("Welches Kabel? ")');
    expect(starter).toContain('if kabel == "rot":');
    expect(starter).toContain("else:");
    expect(starter).not.toMatch(/\belif\b|Nichts passiert\./);

    const skip = page.locator("[data-skip-unlocks]");
    await expect(skip).toContainText("direkt mit Mission 3 weitermachen");
    await expect(skip).toHaveAttribute("href", "mission3_start.html");
    await expect(skip).toHaveAttribute("data-skip-unlocks", "link-m3-title link-m3-l1");
    await skip.click();

    await expect(page).toHaveURL(/\/mission3_start\.html$/);
    const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem("unlockedLevels_v2")));
    expect(unlocked).toEqual(expect.arrayContaining(["link-m3-title", "link-m3-l1"]));
});

test("Mission 3 levels provide the staged starter bonuses", async ({ page }) => {
    await page.goto("/mission3_level2.html");
    await expect(page.locator("#python-editor")).toHaveValue([
        'tipp = input("Tipp: ")',
        "tipp = int(tipp)",
        "# Setze hier fort!",
        ""
    ].join("\n"));
    await expect(page.locator(".guide-panel")).not.toContainText("Startbonus");
    await expect(page.locator(".guide-panel h2").first()).toHaveText("Zahlen aus Text machen");
    await expect(page.locator(".guide-panel")).toContainText("50 ist der voreingestellte Code");
    await expect(page.locator(".guide-panel")).toContainText("Die kurze Schreibweise");
    await expect(page.locator(".guide-panel")).toContainText("wird ebenfalls akzeptiert");

    await page.goto("/mission3_level3.html");
    const starter = await page.locator("#python-editor").inputValue();
    expect(starter).toContain("while tipp != geheim:");
    expect(starter).toContain('    tipp = int(input("Code eingeben: "))');
    expect(starter).toContain('        print("Zu niedrig!")');
    expect(starter).not.toMatch(/import random|random\.randint|tipp\s*=\s*0|print\("Knack!"\)/);
    await expect(page.locator(".guide-panel")).toContainText("Jetzt musst du den gemeinen Code herausfinden");
    await expect(page.locator(".guide-panel")).toContainText("Startbonus");
});

test("Mission 3 level 2 requires one guess below and one above 50", async ({ page }) => {
    await page.goto("/mission3_level2.html");
    await page.waitForFunction(() => Boolean(window.editor));
    await page.evaluate(() => {
        window.editor.setValue([
            'tipp = input("Tipp: ")',
            "tipp = int(tipp)",
            "if tipp < 50:",
            '    print("zu niedrig!")',
            "elif tipp > 50:",
            '    print("zu hoch!")'
        ].join("\n"));
    });

    const runButton = page.locator("#run-btn");
    await runButton.click();
    await page.locator(".console-input").fill("25");
    await page.locator(".console-input").press("Enter");
    await expect(page.locator("#status-text")).toHaveText(
        "Noch nicht: Teste jetzt noch mit einer Zahl über 50."
    );
    await expect(page.locator("#success-overlay")).toHaveCount(0);

    await runButton.click();
    await page.locator(".console-input").fill("75");
    await page.locator(".console-input").press("Enter");
    await expect(page.locator("#status-text")).toHaveText("✓ Geschafft – lies kurz dein Ergebnis.");
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 3000 });
});

test("interactive input points to Enter and delays Mission 1 success for four seconds", async ({ page }) => {
    await page.goto("/mission1_level3.html");
    await page.waitForFunction(() => Boolean(window.editor));
    await page.evaluate(() => {
        window.editor.setValue([
            'name = input("Wie heißt du? ")',
            'print("Willkommen im System,", name)'
        ].join("\n"));
    });

    const runButton = page.locator("#run-btn");
    await runButton.click();

    const hint = page.locator("#console-enter-hint");
    const input = page.locator(".console-input");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText("Hier eingeben · Enter drücken ↵");
    await expect(input).toBeFocused();
    await expect(runButton).toBeDisabled();
    await expect(runButton).toHaveAttribute("aria-describedby", "console-enter-hint");

    const inputLayout = await page.evaluate(() => {
        const hintRect = document.querySelector("#console-enter-hint").getBoundingClientRect();
        const inputRect = document.querySelector(".console-input").getBoundingClientRect();
        return {
            animationName: getComputedStyle(document.querySelector("#console-enter-hint")).animationName,
            hintBottom: hintRect.bottom,
            hintRight: hintRect.right,
            inputRight: inputRect.right,
            inputTop: inputRect.top
        };
    });
    expect(inputLayout.hintBottom).toBeLessThanOrEqual(inputLayout.inputTop + 1);
    expect(Math.abs(inputLayout.hintRight - inputLayout.inputRight)).toBeLessThanOrEqual(2.5);
    expect(inputLayout.animationName).toContain("console-hint-pulse");

    await input.fill("Ada");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(page.locator("#status-text")).toHaveText("✓ Geschafft – lies kurz dein Ergebnis.");
    await expect(runButton).toBeDisabled();
    await expect(page.locator("#success-overlay")).toHaveCount(0);

    await page.waitForTimeout(2000);
    await expect(page.locator("#success-overlay")).toHaveCount(0);
    await expect(page.locator("#success-overlay")).toBeVisible({ timeout: 3000 });
});
