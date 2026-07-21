import { expect, test } from "@playwright/test";

const passingCode = `import turtle

drohne = turtle.Turtle()
drohne.shape("triangle")
drohne.color("#71edf4")
drohne.speed(2)
drohne.penup()

drohne.pendown()
drohne.goto(160, 80)
drohne.penup()
drohne.dot(30, "#7df2a9")
print("Position:", drohne.position())
drohne.goto(160, 180)`;

const level2PassingCode = `import turtle

drohne = turtle.Turtle()
drohne.shape("triangle")
drohne.color("#71edf4")
drohne.speed(2)
drohne.penup()

def gehe_zu(x, y):
    drohne.goto(x, y)

def markiere():
    drohne.dot(30, "#7df2a9")

gehe_zu(-160, 40)
markiere()
gehe_zu(80, 130)
markiere()`;

const level3GuardedCode = `import turtle

drohne = turtle.Turtle()
drohne.shape("triangle")
drohne.color("#71edf4")
drohne.speed(2)
drohne.penup()

def gehe_zu(x, y):
    drohne.goto(x, y)

def markiere():
    drohne.dot(30, "#7df2a9")

inventar = []
gehe_zu(-210, -65)
markiere()
fund = drohne.suche_hier()
print("Gefunden:", fund)
if fund == "Datenchip":
    inventar.append(fund)`;

const level3DirectCode = level3GuardedCode.replace(
    'print("Gefunden:", fund)\nif fund == "Datenchip":\n    inventar.append(fund)',
    "print(fund)\ninventar.append(fund)"
);

const level3InventedItemCode = level3DirectCode.replace(
    "print(fund)\ninventar.append(fund)",
    'print(fund)\nfund = "Datenchip"\ninventar.append(fund)'
);

const level3DeadGuardCode = level3DirectCode.replace(
    "print(fund)\ninventar.append(fund)",
    `print(fund)
def nie_aufgerufen():
    if fund == "Datenchip":
        inventar.append(fund)
inventar.append(fund)`
);

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

async function documentOverflow(page) {
    return page.evaluate(() => ({
        body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }));
}

test("Agent training level 1 observes the real Turtle route, mark and position output", { tag: "@ipad" }, async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    const fastSuffix = testInfo.project.name === "webkit-ipad" ? "?e2e" : "";
    await page.goto(`/agent_training_level1.html${fastSuffix}`);

    await expect(page.locator(".training-stage")).toBeVisible();
    await page.evaluate(code => window.editor.setValue(code), passingCode);
    await page.locator("#run-btn").click();

    if (testInfo.project.name === "chromium-school-laptop") {
        await page.waitForFunction(() => {
            const state = window.AgentTrainingLevel?.getState?.();
            return state?.running && state.marks.length === 1 && state.current.y > 90 && state.current.y < 175;
        }, null, { timeout: 12_000 });
        await expect(page.locator("#run-btn")).toHaveAttribute("aria-busy", "true");
        await expect(page.locator("#training-marks-layer .training-live-dot")).toBeVisible();
    }

    await expect(page.locator("#run-status")).toHaveText("Geschafft", { timeout: 12_000 });
    await expect(page.locator("#training-stage-message")).toBeVisible();
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#console-output")).toContainText("Position:");
    const visibleTrail = page.locator("#training-marks-layer .training-live-trail");
    const visibleTrailCount = await visibleTrail.count();
    expect(visibleTrailCount).toBeGreaterThan(0);
    await expect(visibleTrail.first()).toBeVisible();
    await expect(page.locator("#next-level-btn")).toHaveText("Nächstes Level");
    await expect(page.locator("#next-level-btn")).toBeVisible();
    const completion = page.locator("#success-overlay");
    await expect(completion).toBeVisible();
    await expect(completion).toHaveAttribute("role", "dialog");
    await expect(completion.locator('[data-success-symbol="graduation-cap"]')).toBeVisible();
    await expect(completion.locator(".success-btn")).toHaveText("Nächstes Level");
    await expect(completion.locator(".close-overlay-btn")).toHaveText("Im Editor weiterspielen");

    const completionBox = await completion.locator(".success-badge").boundingBox();
    expect(completionBox).not.toBeNull();
    expect(completionBox.y).toBeGreaterThanOrEqual(0);
    expect(completionBox.y + completionBox.height).toBeLessThanOrEqual(page.viewportSize().height + 1);

    const state = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(state.visitedTarget).toBe(true);
    expect(state.markedAtTarget).toBe(true);
    expect(state.current.x).toBeCloseTo(160, 0);
    expect(state.current.y).toBeCloseTo(180, 0);
    expect(state.marks).toHaveLength(1);

    const liveDot = page.locator("#training-marks-layer .training-live-dot");
    const targetCore = page.locator(".training-target-core");
    const targetHalo = page.locator(".training-target-halo");
    await expect(liveDot).toHaveCount(1);
    await expect(liveDot).toBeVisible();
    const markerVisual = await liveDot.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            fill: style.fill,
            animation: style.animationName,
            x: element.dataset.x,
            y: element.dataset.y
        };
    });
    expect(markerVisual.fill).toBe("rgb(125, 242, 169)");
    expect(markerVisual.animation).toBe("none");
    expect(markerVisual.x).toBe("160");
    expect(markerVisual.y).toBe("80");
    await expect(liveDot).toHaveAttribute("data-size", "30");

    const targetVisual = await targetCore.evaluate(element => ({
        fill: getComputedStyle(element).fill
    }));
    const haloVisual = await targetHalo.evaluate(element => ({
        animation: getComputedStyle(element).animationName,
        stroke: getComputedStyle(element).stroke
    }));
    expect(targetVisual.fill).toBe("rgb(241, 200, 255)");
    expect(haloVisual.animation).toContain("training-target-pulse");
    expect(haloVisual.stroke).toBe("rgba(225, 157, 255, 0.72)");

    const dotBox = await liveDot.boundingBox();
    const targetBox = await targetCore.boundingBox();
    expect(dotBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    expect(Math.abs(dotBox.x + dotBox.width / 2 - (targetBox.x + targetBox.width / 2))).toBeLessThanOrEqual(2);
    expect(Math.abs(dotBox.y + dotBox.height / 2 - (targetBox.y + targetBox.height / 2))).toBeLessThanOrEqual(2);
    const completedCode = await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ));
    expect(completedCode.agent_training_level1).toContain("drohne.goto(160, 80)");
    const canvasCount = await page.locator("#agent-training-turtle canvas").count();
    expect(canvasCount).toBeGreaterThan(0);
    expect(canvasCount).toBeLessThanOrEqual(2);

    await completion.locator(".close-overlay-btn").click();
    await expect(completion).toBeHidden();
    expect(await page.evaluate(() => window.editor.hasFocus())).toBe(true);
    await page.locator("#reset-btn").click();
    await expect(page.locator("#agent-training-turtle canvas")).toHaveCount(0);
    await expect(page.locator("#training-marks-layer .training-live-dot")).toHaveCount(0);
    await expect(page.locator("#training-marks-layer .training-live-trail")).toHaveCount(0);
    await expect(page.locator("#coordinate-x")).toHaveText("0");
    await expect(page.locator("#coordinate-y")).toHaveText("0");
    await expect(page.locator("#training-stage-message")).toBeHidden();
    await expect(page.locator("#status-text")).not.toHaveCSS("color", "rgb(52, 168, 83)");

    await page.goto("/agent_training_level1.html?e2e");
    await page.evaluate(() => window.editor.setValue(`import turtle
drohne = turtle.Turtle()
drohne.pendown()
drohne.goto(0, 10)
drohne.penup()
drohne.pendown()
drohne.goto(160, 80)
drohne.dot(30)
print("Position:", drohne.position())`));
    await page.locator("#run-btn").click();
    await expect(page.locator("#run-status")).toHaveText("Code prüfen");
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(2);
    await expect(page.locator("#training-feedback-message")).toContainText("Spur ein");
    expect(pageErrors).toEqual([]);
});

test("Agent training levels 2 and 3 validate reusable commands and a real found item", async ({ page }) => {
    const pageErrors = capturePageErrors(page);

    await page.goto("/agent_training_level2.html?e2e");
    await page.evaluate(code => window.editor.setValue(code), level2PassingCode);
    await page.locator("#run-btn").click();

    await expect(page.locator("#run-status")).toHaveText("Geschafft", { timeout: 12_000 });
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#training-marks-layer .training-live-dot")).toHaveCount(2);
    const level2State = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(level2State.visitedTargetIds.sort()).toEqual(["alpha", "beta"]);
    expect(level2State.markedTargetIds.sort()).toEqual(["alpha", "beta"]);
    const markerSizes = await page.locator("#training-marks-layer .training-live-dot").evaluateAll(
        markers => markers.map(marker => marker.dataset.size)
    );
    expect(markerSizes).toEqual(["30", "30"]);
    await expect(page.locator("#next-level-btn")).toBeVisible();
    await expect(page.locator("#next-level-btn")).toHaveText("Nächstes Level");
    await expect(page.locator('#success-overlay [data-success-symbol="graduation-cap"]')).toBeVisible();

    await page.goto("/agent_training_level3.html?e2e");
    await page.evaluate(code => window.editor.setValue(code), level3GuardedCode);
    await page.locator("#run-btn").click();

    await expect(page.locator("#run-status")).toHaveText("Weiter ohne if", { timeout: 12_000 });
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#console-output")).toContainText("Gefunden: Datenchip");
    await expect(page.locator("#training-inventory-items")).toHaveText("Datenchip");
    await expect(page.locator('[data-training-phase="guarded"]')).toBeHidden();
    await expect(page.locator('[data-training-phase="direct"]')).toBeVisible();
    await expect(page.locator("#training-feedback-message")).toContainText("ohne „if“");
    await expect(page.locator("body")).not.toHaveClass(/training-complete/);
    await expect(page.locator("#success-overlay")).toHaveCount(0);
    const phaseOneState = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(phaseOneState.level3Phase).toBe("direct");
    expect(phaseOneState.collectedRealFind).toBe(true);
    const phaseOneCompletedCode = await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ));
    expect(phaseOneCompletedCode.agent_training_level3).toBeUndefined();

    await page.evaluate(code => window.editor.setValue(code), level3DirectCode);
    await page.locator("#run-btn").click();

    await expect(page.locator("#run-status")).toHaveText("Geschafft", { timeout: 12_000 });
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(4);
    const finalCompletion = page.locator("#success-overlay");
    await expect(finalCompletion).toBeVisible();
    await expect(finalCompletion.locator('[data-success-symbol="diploma"]')).toBeVisible();
    await expect(finalCompletion.locator("h1")).toHaveText("TRAININGSMISSION ABGESCHLOSSEN");
    await expect(finalCompletion.locator("p")).toHaveText(
        "Dein Datenchip stammt aus einer Suche und liegt nachweislich im Inventar."
    );
    await expect(finalCompletion.locator(".success-btn")).toHaveText("Projekt wählen");
    await expect(finalCompletion.locator(".success-btn")).toHaveAttribute("href", "projektwahl.html");
    const fireworks = page.locator("#training-fireworks");
    await expect(fireworks).toBeVisible();
    await expect(fireworks.locator("canvas")).toHaveCount(1);
    await page.waitForTimeout(1_100);
    await expect(fireworks).toBeVisible();
    const fireworksBox = await fireworks.boundingBox();
    expect(fireworksBox).not.toBeNull();
    expect(fireworksBox.width).toBeGreaterThanOrEqual(page.viewportSize().width - 2);
    expect(fireworksBox.height).toBeGreaterThanOrEqual(page.viewportSize().height - 2);
    const level3State = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(level3State.foundItem).toBe("Datenchip");
    expect(level3State.collectedRealFind).toBe(true);
    expect(level3State.level3Phase).toBe("direct");

    await finalCompletion.locator(".close-overlay-btn").click();
    await expect(page.locator("#training-fireworks")).toHaveCount(0);
    await page.locator("#reset-btn").click();
    await expect(page.locator("#training-inventory-items")).toHaveText("leer");
    await expect(page.locator("#training-marks-layer .training-live-dot")).toHaveCount(0);
    await expect(page.locator('[data-training-phase="guarded"]')).toBeVisible();
    await expect(page.locator('[data-training-phase="direct"]')).toBeHidden();

    await page.evaluate(code => window.editor.setValue(code), level3DeadGuardCode);
    await page.locator("#run-btn").click();
    await expect(page.locator("#run-status")).toHaveText(/Code pr/);
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(2);
    await expect(page.locator('[data-training-phase="guarded"]')).toBeVisible();
    await expect(page.locator('[data-training-phase="direct"]')).toBeHidden();

    await page.evaluate(code => window.editor.setValue(code), level3GuardedCode);
    await page.locator("#run-btn").click();
    await expect(page.locator("#run-status")).toHaveText("Weiter ohne if", { timeout: 12_000 });

    await page.evaluate(code => window.editor.setValue(code), level3InventedItemCode);
    await page.locator("#run-btn").click();
    await expect(page.locator("#run-status")).toHaveText(/Code pr/);
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#training-inventory-items")).toHaveText("Datenchip");
    const inventedState = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(inventedState.foundItem).toBe("Datenchip");
    expect(inventedState.collectedRealFind).toBe(false);
    await expect(page.locator("body")).not.toHaveClass(/training-complete/);
    expect(pageErrors).toEqual([]);
});

test("Agent training keeps its glass workspace contained on laptop and iPad", { tag: "@ipad" }, async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/agent_training_start.html");
    await expect(page.locator("body")).toHaveClass(/agent-training/);
    await expect(page.locator("body")).toHaveClass(/mission-start-page/);
    await expect(page.locator("#mission-start-action")).toHaveAttribute("href", "agent_training_level1.html");

    for (const levelPage of [
        "agent_training_level1.html",
        "agent_training_level2.html",
        "agent_training_level3.html"
    ]) {
        await page.goto(`/${levelPage}?e2e`);

        const stagePanel = page.locator(".training-stage-panel");
        const codePanel = page.locator(".training-code-panel");
        const stage = page.locator(".training-stage");
        await expect(stagePanel).toBeVisible();
        await expect(codePanel).toBeVisible();
        await expect(stage).toBeVisible();
        await expect(page.locator("#learning-nav-dock")).toBeVisible();

        const stageBox = await stagePanel.boundingBox();
        const codeBox = await codePanel.boundingBox();
        expect(stageBox).not.toBeNull();
        expect(codeBox).not.toBeNull();
        if (testInfo.project.name === "chromium-school-laptop") {
            expect(Math.abs(stageBox.y - codeBox.y)).toBeLessThanOrEqual(2);
            expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(codeBox.x + 2);
        } else {
            expect(codeBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
            expect(Math.abs(stageBox.x - codeBox.x)).toBeLessThanOrEqual(2);
        }

        const visual = await stagePanel.evaluate(element => {
            const style = getComputedStyle(element);
            return {
                backdrop: style.backdropFilter || style.webkitBackdropFilter,
                border: style.borderTopColor,
                background: style.backgroundImage
            };
        });
        expect(visual.backdrop).toContain("blur(");
        expect(visual.border).not.toBe("rgba(0, 0, 0, 0)");
        expect(visual.background).toContain("linear-gradient");

        for (const selector of ["#run-btn", "#reset-btn", "#menu-btn"]) {
            const box = await page.locator(selector).boundingBox();
            expect(box).not.toBeNull();
            expect(box.height).toBeGreaterThanOrEqual(44);
        }

        if (levelPage !== "agent_training_level1.html") {
            const hint = page.locator(".training-task-card .block-hint");
            const bubbleId = levelPage === "agent_training_level2.html"
                ? "training-l2-tip-def"
                : "training-l3-tip-search";
            const block = hint.locator(`[aria-describedby="${bubbleId}"]`);
            const bubble = block.locator(":scope > .tooltiptext");
            if (testInfo.project.name === "webkit-ipad") {
                await block.tap();
            } else {
                await block.hover();
            }
            await expect(bubble).toBeVisible();
            const [blockBox, bubbleBox] = await Promise.all([block.boundingBox(), bubble.boundingBox()]);
            expect(blockBox).not.toBeNull();
            expect(bubbleBox).not.toBeNull();
            expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(blockBox.y + 1);
            expect(bubbleBox.y).toBeGreaterThanOrEqual(0);
            expect(bubbleBox.x).toBeGreaterThanOrEqual(0);
            expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
            await expect(codePanel).toHaveCSS("overflow", "visible");
        }

        const overflow = await documentOverflow(page);
        expect(overflow.body).toBeLessThanOrEqual(1);
        expect(overflow.document).toBeLessThanOrEqual(1);
    }
    expect(pageErrors).toEqual([]);
});
