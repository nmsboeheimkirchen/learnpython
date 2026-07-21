import { expect, test } from "@playwright/test";

async function openExplorer(page) {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.goto("/pico_level1.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    return pageErrors;
}

async function runWithSuffix(page, suffix) {
    return page.evaluate(async addition => {
        const code = `${window.DRONE_MISSION_CONFIG.defaultCode}\n${addition}\n`;
        window.DroneMissionRuntime.editor.setValue(code);
        return window.DroneMissionRuntime.run();
    }, suffix);
}

test("@ipad PICO explorer reveals the charging advice only after the real direct-flight energy stop", async ({ page }) => {
    const pageErrors = await openExplorer(page);

    await expect(page.locator("#energy-advice")).toBeHidden();
    await expect(page.locator("#energy-cell-reveal")).toBeHidden();
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "10");

    const result = await runWithSuffix(page, "fahre_zu(340, 15)");
    expect(result.passed).toBe(true);
    await expect(page.locator("#run-status")).toHaveText("Energieproblem erkannt");
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("#energy-advice")).toBeVisible();
    await expect(page.locator("#energy-advice")).toContainText("erst aufladen");
    await expect(page.locator("#energy-cell-reveal")).toBeVisible();
    await expect(page.locator("#stage-discovery-message")).toBeVisible();
    await expect(page.locator("#checks-list .is-passed")).toHaveCount(2);
    await expect(page.locator("#console-output")).toContainText("direkte Weg zur Funkbase");
    await expect(page.locator("body")).toHaveClass(/mission-passed/);

    const savedCode = await page.evaluate(() => JSON.parse(
        localStorage.getItem("completedLevelCode_v1") || "{}"
    ).pico_level1);
    expect(savedCode).toContain("fahre_zu(340, 15)");

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    await expect(page.locator("#energy-advice")).toBeVisible();
    await expect(page.locator("#run-status")).toHaveText("Energieproblem erkannt");
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");
    expect(pageErrors).toEqual([]);
});

test("PICO explorer rejects an exhausted wrong route and a printed success claim", async ({ page }) => {
    const pageErrors = await openExplorer(page);

    const wrongRoute = await runWithSuffix(page, "fahre_zu(0, 0)");
    expect(wrongRoute.passed).toBe(false);
    await expect(page.locator("#run-status")).toHaveText("Direktflug fehlt");
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("#energy-advice")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/mission-passed/);

    await page.evaluate(() => window.DroneMissionRuntime.reset());
    const printedClaim = await runWithSuffix(page, 'print("Energieproblem erkannt")');
    expect(printedClaim.passed).toBe(false);
    await expect(page.locator("#run-status")).toHaveText("Direktflug fehlt");
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "10");
    await expect(page.locator("#energy-advice")).toBeHidden();
    expect(pageErrors).toEqual([]);
});
