import { expect, test } from "@playwright/test";

async function openLearningPage(page, path) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => Boolean(window.AgentLearningData))).toBe(true);
}

test("@ipad two guest tabs retain different level completions in their shared local stand", async ({ context, page }) => {
    const secondTab = await context.newPage();
    await Promise.all([
        openLearningPage(page, "/mission1_level1.html"),
        openLearningPage(secondTab, "/mission2_level1.html")
    ]);
    expect(await page.evaluate(() => typeof navigator.locks?.request === "function")).toBe(true);

    const [savedA, savedB] = await Promise.all([
        page.evaluate(() => window.AgentLearningData.completeLevel({
            levelId: "mission1_level1",
            code: "Code aus Tab A",
            unlockIds: ["link-level2"]
        })),
        secondTab.evaluate(() => window.AgentLearningData.completeLevel({
            levelId: "mission2_level1",
            code: "Code aus Tab B",
            unlockIds: ["link-m2-l2"]
        }))
    ]);

    expect(savedA).toBe(true);
    expect(savedB).toBe(true);
    await expect.poll(() => page.evaluate(() => ({
        first: window.AgentLearningData.getCompletedCode("mission1_level1"),
        second: window.AgentLearningData.getCompletedCode("mission2_level1")
    }))).toEqual({
        first: "Code aus Tab A",
        second: "Code aus Tab B"
    });
    await expect.poll(() => secondTab.evaluate(() => ({
        first: window.AgentLearningData.getCompletedCode("mission1_level1"),
        second: window.AgentLearningData.getCompletedCode("mission2_level1")
    }))).toEqual({
        first: "Code aus Tab A",
        second: "Code aus Tab B"
    });

    const raw = await page.evaluate(() => ({
        codes: JSON.parse(localStorage.getItem("completedLevelCode_v1")),
        unlocks: JSON.parse(localStorage.getItem("unlockedLevels_v2"))
    }));
    expect(raw.codes).toEqual({
        mission1_level1: "Code aus Tab A",
        mission2_level1: "Code aus Tab B"
    });
    expect(raw.unlocks).toEqual(expect.arrayContaining(["link-level1", "link-level2", "link-m2-l2"]));
});
