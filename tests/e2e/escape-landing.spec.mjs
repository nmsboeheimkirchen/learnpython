import { expect, test } from "@playwright/test";

test("@ipad the final helicopter landing is responsive and uses the approved handoff", async ({ page }) => {
    await page.goto("/helikopter_flucht.html");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Der Lord kommt zurück.");
    await expect(page.locator(".escape-lead")).toHaveText("Die Drohne hat ihren Auftrag erfüllt. Jetzt musst du schnell aus der Basis des bösen Lords verschwinden.");
    await expect(page.locator(".escape-order")).toContainText("Im Hangar wartet sein neuer Helikopter.");
    await expect(page.locator(".escape-order")).toContainText("Entschlüssle den Zugangscode");
    await expect(page.locator(".escape-order")).toContainText("bevor die Hangartore verriegelt werden");
    await expect(page.locator(".escape-art")).toHaveAttribute("src", /helicopter-hangar-final\.webp/);
    await expect(page.locator(".escape-variant-switch")).toHaveCount(0);
    await expect(page.locator("#menu-btn")).toBeVisible();

    const visual = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const kicker = getComputedStyle(document.querySelector(".escape-kicker"));
        const briefing = document.querySelector(".escape-briefing").getBoundingClientRect();
        return {
            background: body.backgroundColor,
            cyan: kicker.color,
            overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            briefingWidth: briefing.width,
            viewportWidth: window.innerWidth
        };
    });
    expect(visual.background).toBe("rgb(7, 3, 19)");
    expect(visual.cyan).toBe("rgb(88, 244, 255)");
    expect(visual.overflow).toBeLessThanOrEqual(1);
    expect(visual.briefingWidth).toBeLessThanOrEqual(visual.viewportWidth);
});

test("the former B URL redirects to the final helicopter landing", async ({ page }) => {
    await page.goto("/helikopter_flucht-b.html");
    await expect(page).toHaveURL(/\/helikopter_flucht\.html$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Der Lord kommt zurück.");
});
