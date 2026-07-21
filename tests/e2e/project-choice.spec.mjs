import { expect, test } from "@playwright/test";

test("@ipad project choice opens PICO and the required Pixelmuseum briefing", async ({ page }, testInfo) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.goto("/projektwahl.html");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welche Mission übernimmst du?");
    await expect(page.getByRole("article", { name: "PICO Das letzte Rettungssignal" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Pixelmuseum Das gestohlene Sternenfragment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PICO erkunden" })).toHaveAttribute("href", "pico_level1.html");
    await expect(page.getByRole("link", { name: "Pixelmuseum-Briefing starten" })).toHaveAttribute("href", "pixelmuseum_briefing.html");
    await expect(page.locator(".project-preview-action[aria-disabled='true']")).toHaveCount(0);
    await expect(page.locator('a[href*="prototypes/"]')).toHaveCount(0);

    const layout = await page.evaluate(() => {
        const pico = document.querySelector(".project-card-pico").getBoundingClientRect();
        const museum = document.querySelector(".project-card-museum").getBoundingClientRect();
        return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            pico: { x: pico.x, y: pico.y, width: pico.width, height: pico.height },
            museum: { x: museum.x, y: museum.y, width: museum.width, height: museum.height }
        };
    });

    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.pico.width - layout.museum.width)).toBeLessThanOrEqual(2);
    if (testInfo.project.name === "webkit-ipad") {
        expect(layout.museum.y).toBeGreaterThan(layout.pico.y + layout.pico.height - 2);
    } else {
        expect(Math.abs(layout.pico.y - layout.museum.y)).toBeLessThanOrEqual(2);
        expect(layout.museum.x).toBeGreaterThan(layout.pico.x + layout.pico.width - 2);
    }

    const decisionText = await page.locator("#project-choice-main").innerText();
    expect(decisionText).toMatch(/Begleitete Projektmission/i);
    expect(decisionText).toMatch(/Offene Projektmission/i);
    expect(decisionText).not.toMatch(/für Schnelle|für Langsame|leichter|schwerer/i);

    await page.getByRole("link", { name: "PICO erkunden" }).click();
    await expect(page).toHaveURL(/\/pico_level1\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reicht die Energie?");
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);

    await page.goto("/projektwahl.html");
    await page.getByRole("link", { name: "Pixelmuseum-Briefing starten" }).click();
    await expect(page).toHaveURL(/\/pixelmuseum_briefing\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zwei Funde. Eine echte Inventarkette.");
    await expect.poll(() => page.evaluate(() => Boolean(window.DroneMissionRuntime))).toBe(true);
    expect(pageErrors).toEqual([]);
});
