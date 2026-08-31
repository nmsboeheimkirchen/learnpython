import { expect, test } from "@playwright/test";

const presentationPages = [
    "/pico_level1.html",
    "/pico_level2.html",
    "/pico_level2a.html",
    "/pico_level3.html",
    "/pico_level4.html",
    "/pixelmuseum_briefing.html",
    "/pixelmuseum_finale.html",
    "/prototypes/pico_finale.html",
    "/prototypes/pixelmuseum_finale.html"
];

const demonstrationCode = `import time
print("Präsentation gestartet")
time.sleep(0.8)
print("Präsentation beendet")`;

async function openPresentation(page, path, code = demonstrationCode) {
    await page.goto(path + "?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(
        window.DroneMissionRuntime || window.finalePrototype
    ))).toBe(true);
    await page.evaluate(source => {
        const runtime = window.DroneMissionRuntime || window.finalePrototype;
        runtime.editor.setValue(source);
        window.presentationRuns = 0;
        const eventName = window.DroneMissionRuntime ? "drone:running" : "finale:running";
        document.addEventListener(eventName, event => {
            if (event.detail.running) window.presentationRuns += 1;
        });
    }, code);
    await expect(page.locator("#presentation-run-btn")).toBeHidden();
    await expect(page.locator("#exit-presentation-btn")).toBeHidden();
    await page.locator("#presentation-btn").click();
}

async function expectUncoveredScene(page) {
    const stage = page.locator(".mission-stage, .game-stage").first();
    const controls = page.locator(".presentation-controls");
    const sceneBounds = await stage.boundingBox();
    const controlsBounds = await controls.boundingBox();
    const viewport = page.viewportSize();
    expect(sceneBounds.y).toBeGreaterThanOrEqual(controlsBounds.y + controlsBounds.height);
    expect(sceneBounds.y + sceneBounds.height).toBeLessThanOrEqual(viewport.height);
}

for (const path of presentationPages) {
    test(`presentation keeps a working synchronized start button on ${path}`, async ({ page }) => {
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(String(error)));
        await openPresentation(page, path);

        const start = page.locator("#presentation-run-btn");
        const originalStart = page.locator("#run-btn");
        const exit = page.locator("#exit-presentation-btn");
        await expect(page.locator("body")).toHaveClass(/presentation-mode/);
        await expect(start).toBeVisible();
        await expect(start).toBeInViewport();
        await expect(start).toBeFocused();
        await expect(exit).toBeVisible();
        await expect(exit).toBeInViewport();
        await expect(originalStart).toBeHidden();
        expect((await start.textContent()).trim()).toBe((await originalStart.textContent()).trim());
        await expectUncoveredScene(page);

        for (let run = 1; run <= 2; run += 1) {
            await start.click();
            await expect(start).toBeDisabled();
            await expect(start).toHaveAttribute("aria-busy", "true");
            await expect(originalStart).toBeDisabled();
            await expect.poll(() => page.evaluate(() => window.presentationRuns)).toBe(run);
            await expect.poll(() => page.evaluate(() => (
                window.DroneMissionRuntime || window.finalePrototype
            ).getOutput())).toContain("Präsentation beendet");
            await expect(start).toBeEnabled();
            await expect(start).toHaveAttribute("aria-busy", "false");
            await expect(originalStart).toBeEnabled();
            await expect(page.locator("body")).toHaveClass(/presentation-mode/);
            await expect(start).toBeInViewport();
            await expectUncoveredScene(page);
            expect(await page.evaluate(() => (
                window.DroneMissionRuntime || window.finalePrototype
            ).getLastError())).toBeNull();
        }

        await exit.click();
        await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
        await expect(start).toBeHidden();
        await expect(page.locator("#presentation-btn")).toBeFocused();
        await page.locator("#presentation-btn").click();
        await page.keyboard.press("Escape");
        await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
        await expect(start).toBeHidden();
        expect(pageErrors).toEqual([]);
    });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    for (const path of ["/pico_level4.html", "/pixelmuseum_finale.html"]) {
        test(`presentation controls remain reachable at ${viewport.width}px on ${path}`, { tag: "@ipad" }, async ({ page }) => {
            const pageErrors = [];
            page.on("pageerror", error => pageErrors.push(String(error)));
            await page.setViewportSize(viewport);
            await openPresentation(page, path, 'print("Starttaste erreichbar")');
            const start = page.locator("#presentation-run-btn");
            const exit = page.locator("#exit-presentation-btn");
            const controls = page.locator(".presentation-controls");
            await expect(start).toBeInViewport();
            await expect(exit).toBeInViewport();
            const bounds = await controls.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
            await expectUncoveredScene(page);
            await start.click();
            await expect.poll(() => page.evaluate(() => (
                window.DroneMissionRuntime || window.finalePrototype
            ).getOutput())).toContain("Starttaste erreichbar");
            await expect(page.locator("body")).toHaveClass(/presentation-mode/);
            await expect(start).toBeInViewport();
            await expectUncoveredScene(page);
            await exit.click();
            await expect(controls).toBeHidden();
            expect(pageErrors).toEqual([]);
        });
    }
}
