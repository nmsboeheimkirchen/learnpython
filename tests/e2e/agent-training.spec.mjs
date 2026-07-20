import { expect, test } from "@playwright/test";

const passingCode = `import turtle

agent = turtle.Turtle()
agent.shape("triangle")
agent.color("#71edf4")
agent.speed(4)
agent.penup()

agent.goto(160, 80)
agent.dot(18, "#ffd479")
print("Position:", agent.position())`;

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

    await expect(page.locator("#run-status")).toHaveText("Kalibriert", { timeout: 12_000 });
    await expect(page.locator("#training-stage-message")).toBeVisible();
    await expect(page.locator("#training-checks .is-passed")).toHaveCount(3);
    await expect(page.locator("#console-output")).toContainText("Position:");

    const state = await page.evaluate(() => window.AgentTrainingLevel.getState());
    expect(state.visitedTarget).toBe(true);
    expect(state.markedAtTarget).toBe(true);
    expect(state.current.x).toBeCloseTo(160, 0);
    expect(state.current.y).toBeCloseTo(80, 0);
    expect(state.marks).toHaveLength(1);
    const completedCode = await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ));
    expect(completedCode.agent_training_level1).toContain("agent.goto(160, 80)");
    const canvasCount = await page.locator("#agent-training-turtle canvas").count();
    expect(canvasCount).toBeGreaterThan(0);
    expect(canvasCount).toBeLessThanOrEqual(2);

    await page.locator("#reset-btn").click();
    await expect(page.locator("#agent-training-turtle canvas")).toHaveCount(0);
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
