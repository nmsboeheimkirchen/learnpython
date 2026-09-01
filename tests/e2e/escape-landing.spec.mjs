import { expect, test } from "@playwright/test";

test("@ipad the final helicopter landing is responsive and uses the approved handoff", async ({ page }) => {
    await page.goto("/helikopter_flucht.html");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Der Lord kommt zurück.");
    await expect(page.locator(".escape-lead")).toHaveText("Die Drohne hat ihren Auftrag erfüllt. Jetzt musst du schnell aus der Basis des bösen Lords verschwinden.");
    await expect(page.locator(".escape-order")).toContainText("Im Hangar wartet sein neuer Helikopter.");
    await expect(page.locator(".escape-order")).toContainText("Entsperre den Bordcomputer");
    await expect(page.locator(".escape-order")).toContainText("öffne das Hangartor. Dann kannst du abheben");
    await expect(page.locator(".escape-order")).toContainText("bevor der Lord den Hangar erreicht");
    await expect(page.locator(".escape-main")).toHaveAttribute("data-hangar-state", "closed");
    await expect(page.locator(".escape-status-grid div").filter({ hasText: "Hangartor" }).locator("dd")).toHaveText("geschlossen");
    await expect(page.locator(".escape-art")).toHaveAttribute("src", /helicopter-hangar-closed\.webp/);
    await expect(page.locator(".escape-art")).toHaveAttribute("alt", /geschlossenen Hangartor/);
    await expect(page.locator(".escape-art")).toHaveJSProperty("naturalWidth", 1717);
    await expect(page.locator(".escape-art")).toHaveJSProperty("naturalHeight", 916);
    await expect(page.locator(".escape-variant-switch")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zur Projektwahl" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nächsten Auftrag starten: Bordcomputer entsperren" }))
        .toHaveAttribute("href", "helikopter_flucht_level1.html");
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
