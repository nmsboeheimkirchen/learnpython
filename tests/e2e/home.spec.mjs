import { expect, test } from "@playwright/test";

const assetVersion = "20260720-2";

const variants = [
    {
        path: "index-a.html",
        bodyClass: "home-path",
        artwork: "agent-path-cyan-moon.webp",
        heroText: "Entdecke,",
        leadText: "Vier Missionen und dein Weg beginnt hier.",
        brandLabel: "Agent PY – Startseite",
        currentVariant: "A"
    },
    {
        path: "index-b.html",
        bodyClass: "home-agent-path",
        artwork: "agent-path-magenta-portal.webp",
        heroText: "Entdecke,",
        leadText: "Vier Missionen und dein Weg beginnt hier.",
        brandLabel: "Agent PY – Startseite",
        currentVariant: "B"
    }
];

const missionTargets = [
    "mission1_start.html",
    "mission2_start.html",
    "mission3_start.html",
    "mission4_start.html"
];

function capturePageErrors(page) {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    return errors;
}

async function documentOverflow(page) {
    return page.evaluate(() => ({
        body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
        document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }));
}

function durationInMilliseconds(value) {
    const duration = value.split(",")[0].trim();
    if (duration.endsWith("ms")) return Number.parseFloat(duration);
    if (duration.endsWith("s")) return Number.parseFloat(duration) * 1000;
    return Number.POSITIVE_INFINITY;
}

test("the public root is the complete A homepage and keeps B reachable", async ({ page }) => {
    const pageErrors = capturePageErrors(page);
    await page.goto("/");

    await expect(page.locator("body")).toHaveClass(/home-path/);
    await expect(page.locator("h1")).toContainText("Entdecke,");
    await expect(page.locator('.variant-switch a[aria-current="page"]')).toHaveText("A");
    await expect(page.locator('.variant-switch a[href="index-b.html"]')).toBeVisible();
    await expect(page.locator(".course-brand")).toHaveAttribute("href", "index.html");
    await expect(page.locator(".course-brand-logo")).toHaveAttribute("src", `assets/brand/agent-py-logo.png?v=${assetVersion}`);
    const logoResponse = await page.request.get(`/assets/brand/agent-py-logo.png?v=${assetVersion}`);
    expect(logoResponse.ok()).toBe(true);
    expect(logoResponse.headers()["content-type"]).toContain("image/png");
    for (const target of missionTargets) {
        const response = await page.request.get(`/${target}`);
        expect(response.ok(), `${target} ist nicht erreichbar`).toBe(true);
    }
    expect(page.url()).not.toContain("mission1_start.html");
    expect(pageErrors).toEqual([]);
});

for (const variant of variants) {
    test(`${variant.path} presents its approved hero and links all four missions`, async ({ page }) => {
        const pageErrors = capturePageErrors(page);
        await page.goto(`/${variant.path}`);

        const body = page.locator("body");
        const hero = page.locator(".course-hero-card");
        const primaryAction = page.locator(".course-primary-action");
        const missionCards = page.locator(".course-mission-card");

        await expect(body).toHaveClass(/course-home/);
        await expect(body).toHaveClass(new RegExp(`(?:^|\\s)${variant.bodyClass}(?:\\s|$)`));
        await expect(page.locator("h1")).toContainText(variant.heroText);
        await expect(hero).toContainText(variant.leadText);
        await expect(hero).toBeVisible();
        await expect(hero).toHaveCSS("opacity", "1");
        const brand = page.locator(".course-brand");
        const brandLogo = page.locator(".course-brand-logo");
        await expect(brand).toHaveAttribute("href", "index.html");
        await expect(brand).toHaveAttribute("aria-label", variant.brandLabel);
        await expect(brandLogo).toHaveAttribute("src", `assets/brand/agent-py-logo.png?v=${assetVersion}`);
        const brandMaterial = await brand.evaluate(element => {
            const computed = getComputedStyle(element);
            return {
                backgroundImage: computed.backgroundImage,
                borderTopWidth: computed.borderTopWidth,
                boxShadow: computed.boxShadow
            };
        });
        expect(brandMaterial.backgroundImage).toBe("none");
        expect(brandMaterial.borderTopWidth).toBe("0px");
        expect(brandMaterial.boxShadow).toBe("none");
        expect((await brandLogo.boundingBox())?.width).toBeGreaterThanOrEqual(173);
        await expect(primaryAction).toBeVisible();
        await expect(primaryAction).toHaveAttribute("href", "mission1_start.html");
        await expect(missionCards).toHaveCount(4);

        const links = await missionCards.evaluateAll(cards => cards.map(card => card.getAttribute("href")));
        expect(links).toEqual(missionTargets);

        const currentVariant = page.locator(`.variant-switch a[aria-current="page"]`);
        await expect(currentVariant).toHaveText(variant.currentVariant);
        await expect(page.locator(".course-future")).toContainText("PICO");
        await expect(page.locator(".course-future")).toContainText("Pixelmuseum");

        const visibleCopy = await body.innerText();
        expect(visibleCopy).not.toMatch(/checkpoint|observatorium|observation|beobacht/i);

        const sectionOrder = await page.evaluate(() => {
            const branch = document.querySelector(".course-branches");
            const learning = document.querySelector(".course-learning");
            return {
                branchBeforeLearning: Boolean(
                    branch?.compareDocumentPosition(learning) & Node.DOCUMENT_POSITION_FOLLOWING
                ),
                futureTop: document.querySelector(".course-future")?.getBoundingClientRect().top,
                methodTop: document.querySelector(".course-method-grid")?.getBoundingClientRect().top
            };
        });
        expect(sectionOrder.branchBeforeLearning).toBe(true);
        expect(sectionOrder.futureTop).toBeLessThan(sectionOrder.methodTop);

        const prototypeLinks = await page.locator('a[href*="prototypes/"], a[href*="finale"]').count();
        expect(prototypeLinks).toBe(0);

        const artwork = await page.locator(".course-hero-art").evaluate(element =>
            getComputedStyle(element).backgroundImage
        );
        expect(artwork).toContain(variant.artwork);

        const artworkResponse = await page.request.get(`/assets/images/home/${variant.artwork}?v=${assetVersion}`);
        expect(artworkResponse.ok()).toBe(true);
        expect(artworkResponse.headers()["content-type"]).toContain("image/webp");
        expect(pageErrors).toEqual([]);
    });
}

test("both home variants stay readable, glassy and contained on laptop and iPad", { tag: "@ipad" }, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const variant of variants) {
        const pageErrors = capturePageErrors(page);
        await page.goto(`/${variant.path}`);

        const header = page.locator(".course-header");
        const hero = page.locator(".course-hero-card");
        const action = page.locator(".course-primary-action");
        await expect(header).toBeVisible();
        await expect(hero).toBeVisible();
        await expect(action).toBeVisible();

        const viewport = page.viewportSize();
        const headerBox = await header.boundingBox();
        const heroBox = await hero.boundingBox();
        const actionBox = await action.boundingBox();
        expect(headerBox).not.toBeNull();
        expect(heroBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        expect(headerBox.x).toBeGreaterThanOrEqual(0);
        expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(heroBox.x).toBeGreaterThanOrEqual(0);
        expect(heroBox.x + heroBox.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(actionBox.height).toBeGreaterThanOrEqual(44);

        const material = await hero.evaluate(element => {
            const style = getComputedStyle(element);
            const headerStyle = getComputedStyle(document.querySelector(".course-header"));
            const artStyle = getComputedStyle(document.querySelector(".course-hero-art"));
            return {
                backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
                backgroundImage: style.backgroundImage,
                borderColor: style.borderTopColor,
                headerBackdropFilter: headerStyle.backdropFilter || headerStyle.webkitBackdropFilter,
                animationDuration: artStyle.animationDuration
            };
        });
        expect(material.backdropFilter).toContain("blur(");
        expect(material.headerBackdropFilter).toContain("blur(");
        expect(material.backgroundImage).toContain("linear-gradient");
        expect(material.borderColor).not.toBe("rgba(0, 0, 0, 0)");
        expect(durationInMilliseconds(material.animationDuration)).toBeLessThanOrEqual(1);

        const overflow = await documentOverflow(page);
        expect(overflow.body, `${variant.path} body overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);
        expect(overflow.document, `${variant.path} document overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);

        await page.locator("#missionen").scrollIntoViewIfNeeded();
        await expect(page.locator(".course-mission-card").first()).toBeVisible();
        expect(pageErrors).toEqual([]);
    }
});

test("phone heroes keep the artwork visible through translucent cards and compact home logos", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const variant of variants) {
        await page.goto(`/${variant.path}`);
        const header = page.locator(".course-header");
        const brand = page.locator(".course-brand");
        const start = page.locator(".course-header-action");
        const switcher = page.locator(".variant-switch");
        const hero = page.locator(".course-hero-card");
        const style = await hero.evaluate(element => {
            const computed = getComputedStyle(element);
            return {
                backgroundColor: computed.backgroundColor,
                backgroundImage: computed.backgroundImage,
                backdropFilter: computed.backdropFilter || computed.webkitBackdropFilter
            };
        });
        const brandMaterial = await brand.evaluate(element => {
            const computed = getComputedStyle(element);
            return {
                backgroundImage: computed.backgroundImage,
                borderTopWidth: computed.borderTopWidth,
                boxShadow: computed.boxShadow
            };
        });
        const alpha = Number.parseFloat(style.backgroundColor.match(/[\d.]+(?=\))/g)?.at(-1) ?? "1");

        expect(alpha).toBeLessThanOrEqual(0.22);
        expect(style.backgroundImage).toContain("linear-gradient");
        expect(style.backdropFilter).toContain("blur(5px)");
        await expect(brand).toBeVisible();
        await expect(brand).toHaveAttribute("href", "index.html");
        expect(brandMaterial.backgroundImage).toBe("none");
        expect(brandMaterial.borderTopWidth).toBe("0px");
        expect(brandMaterial.boxShadow).toBe("none");

        const headerBox = await header.boundingBox();
        const brandBox = await brand.boundingBox();
        const startBox = await start.boundingBox();
        const switcherBox = await switcher.boundingBox();
        expect(headerBox).not.toBeNull();
        expect(brandBox).not.toBeNull();
        expect(startBox).not.toBeNull();
        expect(switcherBox).not.toBeNull();
        expect(brandBox.height).toBeGreaterThanOrEqual(44);
        expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
        expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(startBox.x + 1);
        expect(startBox.x + startBox.width).toBeLessThanOrEqual(switcherBox.x + 1);
        await expect(start).toHaveText("Starten");

        const overflow = await documentOverflow(page);
        expect(overflow.body).toBeLessThanOrEqual(1);
        expect(overflow.document).toBeLessThanOrEqual(1);
    }
});
