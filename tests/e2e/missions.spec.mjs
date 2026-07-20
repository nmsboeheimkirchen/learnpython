import { expect, test } from "@playwright/test";

const assetVersion = "20260720-2";

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
    "mission4_level3.html",
    "agent_training_start.html",
    "agent_training_level1.html"
];

const ipadMissionPages = new Set([
    "mission1_start.html",
    "mission1_level1.html",
    "mission2_level1.html",
    "mission3_level3.html",
    "mission4_level3.html",
    "agent_training_level1.html"
]);

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

test("mission pages expose the shared Agent PY dock without horizontal overflow", { tag: "@ipad" }, async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    const logoResponse = await page.request.get(`/assets/brand/agent-py-logo.png?v=${assetVersion}`);
    expect(logoResponse.ok()).toBe(true);
    expect(logoResponse.headers()["content-type"]).toContain("image/png");

    const useIpadSample = testInfo.project.name === "webkit-ipad" && process.env.PLAYWRIGHT_FULL_MATRIX !== "1";
    const pages = useIpadSample
        ? missionPages.filter(pageName => ipadMissionPages.has(pageName))
        : missionPages;

    for (const missionPage of pages) {
        await page.goto(`/${missionPage}`);
        await expect(page.locator("#main-content")).toBeVisible();

        const dock = page.locator("#learning-nav-dock");
        const home = page.locator("#agent-py-home");
        const menu = page.locator("#menu-btn");
        await expect(dock).toBeVisible();
        await expect(home).toBeVisible();
        await expect(home).toHaveAttribute("href", "index.html");
        await expect(home).toHaveAttribute("aria-label", "Agent PY – zur Startseite");
        await expect(home.locator(".mission-home-logo")).toHaveAttribute(
            "src",
            `assets/brand/agent-py-logo.png?v=${assetVersion}`
        );
        await expect(menu).toBeVisible();

        const dockRect = await elementRect(dock);
        const homeRect = await elementRect(home);
        const menuRect = await elementRect(menu);
        const viewport = page.viewportSize();
        expect(dockRect.left).toBeGreaterThanOrEqual(0);
        expect(dockRect.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(homeRect.right).toBeLessThanOrEqual(menuRect.left + 1);

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

test("the mission home button uses the supplied logo compactly on phones and returns to A", { tag: "@ipad" }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mission1_level1.html");

    await expect(page.locator(".mission-home-logo")).toBeVisible();
    const logoRect = await elementRect(page.locator(".mission-home-logo"));
    expect(logoRect.width).toBeLessThanOrEqual(96.5);
    const dockRect = await elementRect(page.locator("#learning-nav-dock"));
    expect(dockRect.left).toBeGreaterThanOrEqual(0);
    expect(dockRect.right).toBeLessThanOrEqual(390);

    await page.locator("#agent-py-home").click();
    await expect(page.locator("body")).toHaveClass(/home-path/);
    await expect(page.locator("h1")).toContainText("Entdecke,");
});

test("the learning-path drawer overlays accessibly and restores focus", { tag: "@ipad" }, async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/mission1_level1.html");

    const main = page.locator("#main-content");
    const menuButton = page.locator("#menu-btn");
    const drawer = page.locator("dialog#mySidebar");
    const closeButton = page.locator("#navigation-close-btn");
    const activeLevel = page.locator("#link-level1");
    const lockedLevel = page.locator("#link-level2");

    await expect(main).toBeVisible();
    await expect(menuButton).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-controls", "mySidebar");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toHaveAttribute("aria-labelledby", "sidebar-title");
    await expect(activeLevel).toHaveAttribute("aria-current", "page");
    await expect(lockedLevel).toHaveAttribute("aria-disabled", "true");
    await expect(lockedLevel).toHaveAttribute("tabindex", "-1");

    const before = await elementRect(main);
    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("open", "");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(closeButton).toBeFocused();
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

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
    expect(pageErrors).toEqual([]);
});
