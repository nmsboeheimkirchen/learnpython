import { expect, test } from "@playwright/test";

const passingCode = `import turtle

agent = turtle.Turtle()
agent.shape("triangle")
agent.color("#71edf4")
agent.speed(2)
agent.penup()

agent.goto(160, 80)
agent.dot(18, "#7df2a9")
print("Position:", agent.position())
agent.goto(160, 180)`;

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

    await expect(page.locator("#run-status")).toHaveText("Kalibriert", { timeout: 12_000 });
    await expect(page.locator("#training-stage-message")).toBeVisible();
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#console-output")).toContainText("Position:");

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
    expect(completedCode.agent_training_level1).toContain("agent.goto(160, 80)");
    const canvasCount = await page.locator("#agent-training-turtle canvas").count();
    expect(canvasCount).toBeGreaterThan(0);
    expect(canvasCount).toBeLessThanOrEqual(2);

    await page.locator("#reset-btn").click();
    await expect(page.locator("#agent-training-turtle canvas")).toHaveCount(0);
    await expect(page.locator("#training-marks-layer .training-live-dot")).toHaveCount(0);
    await expect(page.locator("#coordinate-x")).toHaveText("0");
    await expect(page.locator("#coordinate-y")).toHaveText("0");
    await expect(page.locator("#training-stage-message")).toBeHidden();

    await page.goto("/agent_training_level1.html?e2e");
    await page.evaluate(() => window.editor.setValue(`import turtle
agent = turtle.Turtle()
agent.penup()
agent.goto(80, 160)
agent.dot(18)
print("Position: (160, 80)")`));
    await page.locator("#run-btn").click();
    await expect(page.locator("#run-status")).toHaveText("Code prüfen");
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(0);
    await expect(page.locator("#training-feedback-message")).toContainText("(80, 160)");
    expect(pageErrors).toEqual([]);
});

test("Agent training keeps its glass workspace contained on laptop and iPad", { tag: "@ipad" }, async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/agent_training_start.html");
    await expect(page.locator("body")).toHaveClass(/agent-training/);
    await expect(page.locator("body")).toHaveClass(/mission-start-page/);
    await expect(page.locator("#mission-start-action")).toHaveAttribute("href", "agent_training_level1.html");

    await page.goto("/agent_training_level1.html?e2e");

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

    const overflow = await documentOverflow(page);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
});
