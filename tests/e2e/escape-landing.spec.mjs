import { expect, test } from "@playwright/test";

const variants = [
    {
        path: "/helikopter_flucht.html",
        heading: "Jetzt musst du selbst raus.",
        current: "Variante A",
        image: "helicopter-hangar-a.webp",
        copy: "Im Hangar wartet sein Helikopter."
    },
    {
        path: "/helikopter_flucht-b.html",
        heading: "Der Lord kommt zurück.",
        current: "Variante B",
        image: "helicopter-rooftop-b.webp",
        copy: "Auf dem Dach steht sein cyanfarbener Helikopter."
    }
];

test("@ipad both shared helicopter landing variants are distinct and responsive", async ({ page }) => {
    for (const variant of variants) {
        await page.goto(variant.path);

        await expect(page.getByRole("heading", { level: 1 })).toHaveText(variant.heading);
        await expect(page.locator(".escape-lead")).toContainText("echte Agent");
        await expect(page.locator(".escape-lead")).toContainText("Basis des bösen Lords");
        await expect(page.locator(".escape-order")).toContainText(variant.copy);
        await expect(page.locator(".escape-art")).toHaveAttribute("src", new RegExp(variant.image));
        await expect(page.getByRole("link", { name: variant.current })).toHaveAttribute("aria-current", "page");
        await expect(page.locator("#menu-btn")).toBeVisible();

        const visual = await page.evaluate(() => {
            const body = getComputedStyle(document.body);
            const kicker = getComputedStyle(document.querySelector(".escape-kicker"));
            const links = [...document.querySelectorAll(".escape-variant-switch a")];
            return {
                background: body.backgroundColor,
                cyan: kicker.color,
                overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
                switchHeights: links.map(link => link.getBoundingClientRect().height)
            };
        });
        expect(visual.background).toBe("rgb(7, 3, 19)");
        expect(visual.cyan).toBe("rgb(88, 244, 255)");
        expect(visual.overflow).toBeLessThanOrEqual(1);
        visual.switchHeights.forEach(height => expect(height).toBeGreaterThanOrEqual(44));
    }
});

test("landing variants use different copy and different local artwork", async ({ page }) => {
    const results = [];
    for (const variant of variants) {
        await page.goto(variant.path);
        results.push(await page.evaluate(() => ({
            copy: document.querySelector("#escape-briefing").innerText,
            image: document.querySelector(".escape-art").getAttribute("src")
        })));
    }

    expect(results[0].copy).not.toBe(results[1].copy);
    expect(results[0].image).not.toBe(results[1].image);
});
