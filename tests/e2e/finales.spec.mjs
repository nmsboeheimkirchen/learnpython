import { expect, test } from "@playwright/test";

const finalePages = [
    { path: "/prototypes/pico_finale.html?e2e", pathLabel: "Lernpfad PICO" },
    { path: "/prototypes/pixelmuseum_finale.html?e2e", pathLabel: "Lernpfad Pixelmuseum" }
];

async function openFinale(page, path) {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype))).toBe(true);
    return pageErrors;
}

async function runCode(page, code) {
    await page.evaluate(async source => {
        window.finalePrototype.editor.setValue(source);
        await window.finalePrototype.run();
    }, code);
}

test("both unlinked finales share the Agent PY dock and restrained glass material", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));

    for (const finale of finalePages) {
        await page.goto(finale.path);
        await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype))).toBe(true);

        const dock = page.locator(".prototype-nav-dock");
        const home = page.locator(".prototype-home-link");
        const logo = home.locator("img");
        const pathToken = page.locator(".prototype-path-token");
        const header = page.locator(".prototype-header");
        const card = page.locator(".prototype-main > .briefing-card");

        await expect(dock).toBeVisible();
        await expect(home).toHaveAttribute("href", "../index.html");
        await expect(logo).toHaveAttribute("src", "../assets/brand/agent-py-logo.png?v=20260720-2");
        await expect(pathToken).toContainText("Pfad");
        await expect(pathToken).not.toHaveAttribute("href", /.+/);
        await expect(page.locator(".prototype-kicker")).toHaveText("Unverlinkter Endprototyp");
        await expect(page.locator(".path-badge")).toHaveAttribute("aria-label", finale.pathLabel);

        expect(await logo.evaluate(image => ({
            complete: image.complete,
            width: image.naturalWidth,
            height: image.naturalHeight
        }))).toEqual({ complete: true, width: 1600, height: 232 });

        for (const surface of [dock, header, card]) {
            const glass = await surface.evaluate(element => {
                const style = getComputedStyle(element);
                return {
                    backdrop: style.backdropFilter || style.webkitBackdropFilter,
                    background: style.backgroundImage,
                    border: style.borderTopStyle,
                    radius: Number.parseFloat(style.borderTopLeftRadius)
                };
            });
            expect(glass.backdrop).toContain("blur(");
            expect(glass.background).toContain("linear-gradient");
            expect(glass.border).not.toBe("none");
            expect(glass.radius).toBeGreaterThanOrEqual(19);
        }

        await page.evaluate(() => document.body.classList.add("presentation-mode"));
        await expect(dock).toBeHidden();
        await page.evaluate(() => document.body.classList.remove("presentation-mode"));
    }

    expect(pageErrors).toEqual([]);
});

test("finale mobile branding, target names and editor stay contained and accessible", { tag: "@ipad" }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error)));

    for (const finale of finalePages) {
        await page.goto(finale.path);
        await expect.poll(() => page.evaluate(() => Boolean(window.finalePrototype))).toBe(true);

        const dock = page.locator(".prototype-nav-dock");
        const logo = page.locator(".prototype-home-link img");
        const pathToken = page.locator(".prototype-path-token");
        const header = page.locator(".prototype-header");

        await expect(dock).toBeVisible();
        await expect(header).toBeVisible();
        const geometry = await page.evaluate(() => {
            const rect = element => {
                const box = element.getBoundingClientRect();
                return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
            };
            return {
                dock: rect(document.querySelector(".prototype-nav-dock")),
                logo: rect(document.querySelector(".prototype-home-link img")),
                path: rect(document.querySelector(".prototype-path-token")),
                header: rect(document.querySelector(".prototype-header")),
                overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
            };
        });

        expect(geometry.dock.left).toBeGreaterThanOrEqual(0);
        expect(geometry.dock.right).toBeLessThanOrEqual(390);
        expect(geometry.header.left).toBeGreaterThanOrEqual(0);
        expect(geometry.header.right).toBeLessThanOrEqual(390);
        expect(geometry.logo.width).toBeLessThanOrEqual(108.5);
        expect(geometry.logo.right).toBeLessThanOrEqual(geometry.path.left + 1);
        expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.header.top);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        await expect(pathToken).not.toHaveAttribute("href", /.+/);
    }

    await expect(page.locator(".mobile-target-legend")).toBeVisible();
    await expect(page.locator(".mobile-target-legend")).toContainText("Schlüsselkarte");
    await expect(page.locator(".mobile-target-legend")).toContainText("Alarmkonsole");
    await expect(page.locator(".stage-label").first()).toBeHidden();
    await expect(page.locator('.CodeMirror [aria-label="Python-Code für das Pixelmuseum"]')).toHaveCount(1);
    const inventoryFontSize = await page.locator("#inventory-items span").evaluate(element => (
        Number.parseFloat(getComputedStyle(element).fontSize)
    ));
    expect(inventoryFontSize).toBeGreaterThanOrEqual(10);
    expect(pageErrors).toEqual([]);
});

test("PICO clamps an oversized speed-0 move to the real energy range", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html?e2e");
    await runCode(page, `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
drohne.goto(-365, 55)
drohne.goto(1000, 55)
print("POSITION:" + str(drohne.position()))`);

    const output = await page.locator("#console-output").textContent();
    const x = Number(output.match(/POSITION:\(([-\d.]+),/)?.[1]);
    expect(x).toBeGreaterThan(-220);
    expect(x).toBeLessThan(-218);
    await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("#run-status")).toHaveText("Energie leer");
    expect(pageErrors).toEqual([]);
});

test("PICO accepts a creative direct route and clears stale checks after an error", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html?e2e");
    const creativeCode = await page.evaluate(() => (
        window.FINALE_CONFIG.defaultCode.replace("fahre_zu(0, -90)\n", "")
    ));
    await runCode(page, creativeCode);

    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    await expect(page.locator("#pico-result-message")).toHaveText("Signal gesendet - gerettet!");
    await expect(page.locator("#agent-name")).toHaveText("PICO");
    await expect(page.locator("#checks-list")).not.toContainText("Route nutzt einen Wegpunkt");

    await runCode(page, "if :\n    pass");
    await expect(page.locator("#validation-title")).toHaveText("Programm gestoppt");
    await expect(page.locator("#checks-list")).toHaveText("Programmfehler beheben");
    await expect(page.locator("body")).not.toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("PICO default route succeeds with real Turtle animation", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html");
    const defaultCode = await page.evaluate(() => window.FINALE_CONFIG.defaultCode);
    await runCode(page, defaultCode);

    await expect(page.locator("#pico-result-message")).toHaveText("Signal gesendet - gerettet!");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("a running Turtle mission can be stopped and reset from the UI", { tag: "@ipad" }, async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pico_finale.html");
    const defaultCode = await page.evaluate(() => window.FINALE_CONFIG.defaultCode);
    await page.evaluate(source => {
        window.finalePrototype.editor.setValue(source);
        void window.finalePrototype.run();
    }, defaultCode);
    await expect(page.locator("#reset-btn")).toHaveText("■ Mission stoppen");
    await page.locator("#reset-btn").click();
    await expect(page.locator("#run-status")).toHaveText("Bereit", { timeout: 6_000 });
    await expect(page.locator("#reset-btn")).toHaveText("↺ Beispiel laden");
    await expect(page.locator("#console-output")).toHaveText("Bereit für PICOs Rettungsmission.");
    await expect.poll(() => page.evaluate(() => window.finalePrototype.editor.getValue())).toBe(defaultCode);
    await expect(page.locator("body")).not.toHaveClass(/program-running/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum completes the one-second source-code hack with truthful inventory", { tag: "@ipad" }, async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html");
    const solution = await page.evaluate(() => {
        const code = document.getElementById("museum-system-log").dataset.alarmCode;
        return window.FINALE_CONFIG.defaultCode.replace("CODE_AUS_DEM_QUELLTEXT", code);
    });
    const startedAt = Date.now();
    await runCode(page, solution);
    await expect.poll(() => page.evaluate(() => window.FINALE_CONFIG.hackCompleted)).toBe(true);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
    await expect(page.locator("#console-output")).toContainText("INVENTARLISTE: Schlüsselkarte,Artefakt");
    await expect(page.locator("#alarm-console-label")).toContainText("Alarm gehackt");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum speed 8 escapes before the first animated alarm tick", { tag: "@ipad" }, async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html");
    const fastRoute = await page.evaluate(() => (
        window.FINALE_CONFIG.defaultCode.replace("drohne.speed(4)", "drohne.speed(8)")
    ));
    await runCode(page, fastRoute);

    await expect(page.locator("#museum-success")).toHaveText("MISSION ERFOLGREICH – DU BIST ENTKOMMEN!");
    await expect(page.locator("#alarm-value")).toHaveText("0");
    await expect(page.locator("body")).toHaveClass(/validation-passed/);
    expect(pageErrors).toEqual([]);
});

test("Pixelmuseum renders terminal alarm state after Python has already ended", async ({ page }) => {
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");
    await runCode(page, `import turtle
drohne = turtle.Turtle()
drohne.speed(0)
drohne.penup()
inventar = []
drohne.goto(-250, 60)
fund = drohne.suche_hier()
inventar.append(fund)
drohne.goto(-390, 45)
fund = drohne.suche_hier()
inventar.append(fund)
print("INVENTARLISTE: " + ",".join(inventar))`);

    await page.evaluate(() => {
        window.FINALE_CONFIG.renderAlarm(7);
        window.FINALE_CONFIG.updateExitState();
    });
    await expect(page.locator("#run-status")).toHaveText("Mission gestoppt", { timeout: 3_000 });
    await expect(page.locator("#validation-title")).toHaveText("Alarm ausgelöst");
    await expect(page.locator("#alarm-value")).toHaveText("8");
    await page.evaluate(() => {
        window.finalePrototype.refresh();
        window.finalePrototype.refresh();
    });
    const output = await page.locator("#console-output").textContent();
    expect(output.match(/Alarmstufe 8: Das Museum stoppt die Mission\./g)).toHaveLength(1);
    expect(pageErrors).toEqual([]);
});

test("starting Pixelmuseum code brings the live cockpit back into view", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 720 });
    const pageErrors = await openFinale(page, "/prototypes/pixelmuseum_finale.html?e2e");
    await page.evaluate(() => {
        window.finalePrototype.editor.setValue('print("Scrolltest")');
        window.scrollTo(0, document.documentElement.scrollHeight);
    });

    await page.locator("#run-btn").click();
    await expect.poll(() => page.evaluate(() => {
        const stage = document.querySelector(".game-column")?.getBoundingClientRect();
        const cockpit = document.querySelector(".museum-hud")?.getBoundingClientRect();
        return Boolean(stage && cockpit &&
            stage.top >= 0 && stage.top <= 110 &&
            cockpit.top >= 0 && cockpit.bottom <= window.innerHeight);
    })).toBe(true);
    expect(pageErrors).toEqual([]);
});
