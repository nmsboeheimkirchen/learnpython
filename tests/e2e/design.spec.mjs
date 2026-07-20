import { expect, test } from "@playwright/test";

const missionThemes = [
    {
        page: "mission1_start.html",
        bodyClass: "mission-1",
        artwork: "mission-1-system-access.webp",
        level: "mission1_level1.html"
    },
    {
        page: "mission2_start.html",
        bodyClass: "mission-2",
        artwork: "mission-2-cable-lab.webp",
        level: "mission2_level1.html"
    },
    {
        page: "mission3_start.html",
        bodyClass: "mission-3",
        artwork: "mission-3-vault.webp",
        level: "mission3_level1.html"
    },
    {
        page: "mission4_start.html",
        bodyClass: "mission-4",
        artwork: "mission-4-signal-room.webp",
        level: "mission4_level1.html"
    }
];

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

function durationInMilliseconds(value) {
    const firstDuration = value.split(",")[0].trim();
    if (firstDuration.endsWith("ms")) return Number.parseFloat(firstDuration);
    if (firstDuration.endsWith("s")) return Number.parseFloat(firstDuration) * 1000;
    return Number.POSITIVE_INFINITY;
}

test("all four mission starts expose their complete visual theme and working CTA", async ({ page }) => {
    const pageErrors = capturePageErrors(page);

    for (const mission of missionThemes) {
        await page.goto(`/${mission.page}`);

        const body = page.locator("body");
        const hero = page.locator(".mission-hero-card");
        const action = page.locator(".mission-start-action");
        await expect(body).toHaveClass(/learning-page/);
        await expect(body).toHaveClass(/mission-start-page/);
        await expect(body).toHaveClass(new RegExp(`(?:^|\\s)${mission.bodyClass}(?:\\s|$)`));
        await expect(hero).toBeVisible();
        await expect(action).toBeVisible();
        await expect(action).toHaveAttribute("href", mission.level);

        const theme = await body.evaluate(element => {
            const style = getComputedStyle(element);
            const background = getComputedStyle(element, "::before");
            return {
                accent: style.getPropertyValue("--mission-accent").trim(),
                artworkVariable: style.getPropertyValue("--mission-image").trim(),
                backgroundImage: background.backgroundImage,
                backgroundFilter: background.filter
            };
        });

        expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
        expect(theme.artworkVariable).toContain(mission.artwork);
        expect(theme.backgroundImage).toContain(mission.artwork);
        expect(theme.backgroundFilter).toBe("none");

        const artworkResponse = await page.request.get(`/assets/images/missions/${mission.artwork}`);
        expect(artworkResponse.ok()).toBe(true);
        expect(artworkResponse.headers()["content-type"]).toContain("image/webp");

        const actionBox = await action.boundingBox();
        expect(actionBox).not.toBeNull();
        expect(actionBox.height).toBeGreaterThanOrEqual(44);
    }

    expect(pageErrors).toEqual([]);
});

test("level pages reuse the mission artwork as a dark blurred background", async ({ page }) => {
    const pageErrors = capturePageErrors(page);

    for (const mission of missionThemes) {
        await page.goto(`/${mission.level}`);
        const body = page.locator("body");
        await expect(body).toHaveClass(/mission-level-page/);
        await expect(page.locator(".guide-panel")).toBeVisible();
        await expect(page.locator(".editor-panel")).toBeVisible();

        const design = await body.evaluate(element => {
            const background = getComputedStyle(element, "::before");
            const panel = getComputedStyle(document.querySelector(".panel"));
            return {
                backgroundImage: background.backgroundImage,
                filter: background.filter,
                panelBackground: panel.backgroundImage,
                panelBorder: panel.borderTopColor
            };
        });

        expect(design.backgroundImage).toContain(mission.artwork);
        expect(design.filter).toContain("blur(");
        expect(design.filter).toContain("brightness(");
        expect(design.panelBackground).not.toBe("none");
        expect(design.panelBorder).not.toBe("rgba(0, 0, 0, 0)");
    }

    expect(pageErrors).toEqual([]);
});

test("the workspace uses two columns on school laptops and one column on iPad", async ({ page }, testInfo) => {
    const pageErrors = capturePageErrors(page);
    await page.goto("/mission1_level1.html");

    const guide = page.locator(".guide-panel");
    const editor = page.locator(".editor-panel");
    await expect(guide).toBeVisible();
    await expect(editor).toBeVisible();

    const guideBox = await guide.boundingBox();
    const editorBox = await editor.boundingBox();
    expect(guideBox).not.toBeNull();
    expect(editorBox).not.toBeNull();

    if (testInfo.project.name === "chromium-school-laptop") {
        expect(Math.abs(guideBox.y - editorBox.y)).toBeLessThanOrEqual(2);
        expect(guideBox.x + guideBox.width).toBeLessThanOrEqual(editorBox.x + 1);
    } else {
        expect(editorBox.y).toBeGreaterThanOrEqual(guideBox.y + guideBox.height - 1);
        expect(Math.abs(guideBox.x - editorBox.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(guideBox.width - editorBox.width)).toBeLessThanOrEqual(2);
    }

    expect(pageErrors).toEqual([]);
});

test("the navigation uses readable glass material and honors reduced motion", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/mission1_level1.html");

    const dock = page.locator("#learning-nav-dock");
    const home = page.locator("#agent-py-home");
    const menuButton = page.locator("#menu-btn");
    const drawer = page.locator("dialog#mySidebar");
    const surface = page.locator(".sidebar-surface");
    const dockBox = await dock.boundingBox();
    const homeBox = await home.boundingBox();
    const menuBox = await menuButton.boundingBox();
    expect(dockBox).not.toBeNull();
    expect(homeBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(dockBox.height).toBeGreaterThanOrEqual(44);
    expect(homeBox.height).toBeGreaterThanOrEqual(44);
    expect(menuBox.height).toBeGreaterThanOrEqual(44);

    const dockGlass = await dock.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderTopColor
        };
    });
    expect(dockGlass.backdropFilter).toContain("blur(");
    expect(dockGlass.backgroundImage).toContain("linear-gradient");
    expect(dockGlass.borderColor).not.toBe("rgba(0, 0, 0, 0)");

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(surface).toBeVisible();

    const glass = await surface.evaluate(element => {
        const style = getComputedStyle(element);
        const dialogStyle = getComputedStyle(element.closest("dialog"));
        const backdrop = getComputedStyle(element.closest("dialog"), "::backdrop");
        return {
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderTopColor,
            color: style.color,
            backdropColor: backdrop.backgroundColor,
            transitionDuration: dialogStyle.transitionDuration
        };
    });

    expect(glass.backdropFilter).toContain("blur(");
    expect(glass.backgroundImage).toContain("linear-gradient");
    expect(glass.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(glass.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(glass.backdropColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(durationInMilliseconds(glass.transitionDuration)).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
});
