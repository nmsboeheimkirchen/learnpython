import { expect, test } from "@playwright/test";

const variants = [
    {
        path: "index-a.html",
        bodyClass: "home-path",
        artwork: "python-path-hero.webp",
        heroText: "Vier Missionen.",
        leadText: "Jeder Auftrag bringt dir neue Werkzeuge bei.",
        brandLabel: "Agent PY – Startseite A",
        currentVariant: "A"
    },
    {
        path: "index-b.html",
        bodyClass: "home-agent-path",
        artwork: "python-agent-path-hero.webp",
        heroText: "Entdecke,",
        leadText: "Vier Missionen und dein Weg beginnt hier.",
        brandLabel: "agent.py – Startseite B",
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
        await expect(page.locator(".course-brand")).toHaveAttribute("href", variant.path);
        await expect(page.locator(".course-brand")).toHaveAttribute("aria-label", variant.brandLabel);
        await expect(primaryAction).toBeVisible();
        await expect(primaryAction).toHaveAttribute("href", "mission1_start.html");
        await expect(missionCards).toHaveCount(4);

        const links = await missionCards.evaluateAll(cards => cards.map(card => card.getAttribute("href")));
        expect(links).toEqual(missionTargets);

        for (const target of missionTargets) {
            const response = await page.request.get(`/${target}`);
            expect(response.ok(), `${target} ist nicht erreichbar`).toBe(true);
        }

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

        const artworkResponse = await page.request.get(`/assets/images/home/${variant.artwork}`);
        expect(artworkResponse.ok()).toBe(true);
        expect(artworkResponse.headers()["content-type"]).toContain("image/webp");
        expect(pageErrors).toEqual([]);
    });
}

test("the two home options share the mission structure but keep distinct branding and hero art", async ({ page }, testInfo) => {
    const snapshots = [];

    for (const variant of variants) {
        await page.goto(`/${variant.path}`);
        snapshots.push(await page.evaluate(() => ({
            hero: document.querySelector("h1")?.textContent.trim(),
            brand: document.querySelector(".course-brand")?.getAttribute("aria-label"),
            facts: [...document.querySelectorAll(".course-facts dt")].map(node => node.textContent.trim()),
            section: document.querySelector("#missions-title")?.textContent.trim(),
            columns: getComputedStyle(document.querySelector(".course-mission-grid")).gridTemplateColumns,
            artwork: getComputedStyle(document.querySelector(".course-hero-art")).backgroundImage
        })));
    }

    expect(snapshots[0].hero).not.toBe(snapshots[1].hero);
    expect(snapshots[0].brand).not.toBe(snapshots[1].brand);
    expect(snapshots[0].artwork).not.toBe(snapshots[1].artwork);
    expect(snapshots[0].facts).toEqual(snapshots[1].facts);
    expect(snapshots[0].section).toBe(snapshots[1].section);

    if (testInfo.project.name === "chromium-school-laptop") {
        expect(snapshots[0].columns.split(" ")).toHaveLength(4);
        expect(snapshots[1].columns.split(" ")).toHaveLength(4);
    }
});

test("both home variants stay readable and contained on laptop and iPad", async ({ page }, testInfo) => {
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

        const overflow = await documentOverflow(page);
        expect(overflow.body, `${variant.path} body overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);
        expect(overflow.document, `${variant.path} document overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);

        await page.locator("#missionen").scrollIntoViewIfNeeded();
        await expect(page.locator(".course-mission-card").first()).toBeVisible();
        expect(pageErrors).toEqual([]);
    }
});

test("home glass remains legible and reduced motion is respected", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const variant of variants) {
        await page.goto(`/${variant.path}`);
        const material = await page.locator(".course-hero-card").evaluate(element => {
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
        const alpha = Number.parseFloat(style.backgroundColor.match(/[\d.]+(?=\))/g)?.at(-1) ?? "1");

        expect(alpha).toBeLessThanOrEqual(0.22);
        expect(style.backgroundImage).toContain("linear-gradient");
        expect(style.backdropFilter).toContain("blur(5px)");
        await expect(brand).toBeVisible();
        await expect(brand).toHaveAttribute("href", variant.path);

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
