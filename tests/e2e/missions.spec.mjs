import { expect, test } from "@playwright/test";

const missionPages = [
    "mission1_start.html",
    "mission1_level1.html",
    "mission1_level2.html",
    "mission1_level3.html",
    "mission1_level4.html",
    "mission2_start.html",
    "mission2_level1.html",
    "mission2_level2.html",
    "mission2_level3.html",
    "mission3_start.html",
    "mission3_level1.html",
    "mission3_level2.html",
    "mission3_level3.html",
    "mission4_start.html",
    "mission4_level1.html",
    "mission4_level2.html",
    "mission4_level3.html"
];

const missionLandings = [
    {
        path: "mission1_start.html",
        artwork: "mission-1-system-access.webp"
    },
    {
        path: "mission2_start.html",
        artwork: "mission-2-cable-lab.webp"
    },
    {
        path: "mission3_start.html",
        artwork: "mission-3-vault.webp"
    },
    {
        path: "mission4_start.html",
        artwork: "mission-4-signal-room.webp"
    }
];

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

async function elementRect(locator) {
    return locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width
        };
    });
}

async function documentOverflow(page) {
    return page.evaluate(() => ({
        body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }));
}

test("the public root opens the redesigned first mission", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.goto("/");

    await expect(page).toHaveURL(/\/mission1_start\.html$/);
    await expect(page.locator("body")).toHaveClass(/mission-start-page/);
    await expect(page.locator(".mission-hero-card")).toBeVisible();
    await expect(page.locator(".mission-start-action")).toHaveAttribute("href", "mission1_level1.html");
    expect(pageErrors).toEqual([]);
});

test("the learning-path drawer overlays the workspace without moving it", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    // Geometrie wird im stabilen Endzustand geprüft; die Animation hat einen eigenen Designtest.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/mission1_level1.html");

    const main = page.locator("#main-content");
    const menuButton = page.locator("#menu-btn");
    const drawer = page.locator("dialog#mySidebar");
    await expect(main).toBeVisible();
    await expect(menuButton).toBeVisible();
    await expect(drawer).toBeHidden();

    const before = await elementRect(main);
    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("open", "");
    await expect.poll(async () => (await elementRect(drawer)).left).toBeGreaterThanOrEqual(0);
    const after = await elementRect(main);

    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);

    const drawerRect = await elementRect(drawer);
    const viewport = page.viewportSize();
    expect(drawerRect.left).toBeGreaterThanOrEqual(0);
    expect(drawerRect.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(drawerRect.width).toBeLessThan(before.width);

    const overflow = await documentOverflow(page);
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
});

test("the drawer exposes truthful ARIA state and restores focus after Escape", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.goto("/mission1_level1.html");

    const menuButton = page.locator("#menu-btn");
    const drawer = page.locator("dialog#mySidebar");
    const closeButton = page.locator("#navigation-close-btn");
    const activeLevel = page.locator("#link-level1");
    const lockedLevel = page.locator("#link-level2");

    await expect(menuButton).toHaveAttribute("aria-controls", "mySidebar");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveAttribute("aria-labelledby", "sidebar-title");
    await expect(activeLevel).toHaveAttribute("aria-current", "page");
    await expect(lockedLevel).toHaveAttribute("aria-disabled", "true");
    await expect(lockedLevel).toHaveAttribute("tabindex", "-1");

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
    expect(pageErrors).toEqual([]);
});

test("all mission pages avoid horizontal document overflow", async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);

    for (const missionPage of missionPages) {
        await page.goto(`/${missionPage}`);
        await expect(page.locator("#main-content")).toBeVisible();
        const overflow = await documentOverflow(page);
        expect(
            overflow.body,
            `${missionPage} overflows the body in ${testInfo.project.name}`
        ).toBeLessThanOrEqual(1);
        expect(
            overflow.document,
            `${missionPage} overflows the document in ${testInfo.project.name}`
        ).toBeLessThanOrEqual(1);
    }

    expect(pageErrors).toEqual([]);
});

for (const { path, artwork } of missionLandings) {
    test(`${path} shows its assigned mission artwork and start action`, async ({ page }) => {
        const pageErrors = capturePageErrors(page);
        await page.goto(`/${path}`);

        const landing = page.locator(".mission-landing");
        const startAction = page.locator(".mission-start-action");
        await expect(landing).toBeVisible();
        await expect(startAction).toBeVisible();

        const landingRect = await elementRect(landing);
        expect(landingRect.height).toBeGreaterThan(180);

        const renderedImages = await landing.evaluate(element => {
            const values = [];
            const candidates = [
                document.documentElement,
                document.body,
                element,
                ...element.querySelectorAll("*")
            ];

            for (const candidate of candidates) {
                if (candidate.currentSrc) values.push(candidate.currentSrc);
                if (candidate.src) values.push(candidate.src);
                if (candidate.srcset) values.push(candidate.srcset);

                const style = getComputedStyle(candidate);
                values.push(style.backgroundImage);
                values.push(style.getPropertyValue("--mission-image"));
                values.push(style.getPropertyValue("--mission-art"));
            }

            for (const candidate of [document.body, element]) {
                values.push(getComputedStyle(candidate, "::before").backgroundImage);
                values.push(getComputedStyle(candidate, "::after").backgroundImage);
            }
            return values.filter(Boolean).join("\n");
        });

        expect(renderedImages).toContain(artwork);
        expect(pageErrors).toEqual([]);
    });
}
