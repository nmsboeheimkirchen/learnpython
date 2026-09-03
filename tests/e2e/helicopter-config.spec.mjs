import { expect, test } from "@playwright/test";

const successfulConfig = JSON.stringify({
    hangar: {
        tor_offen: true
    },
    cockpit: {
        rotor_online: false,
        navigation_online: false,
        hauptdisplay_online: true
    },
    heli: {
        zugang_offen: true
    }
});

async function openLevel(page) {
    await page.goto("/helikopter_flucht_level2.html?e2e");
    await expect.poll(() => page.evaluate(() => Boolean(window.HelicopterConfigRuntime))).toBe(true);
}

async function applyConfig(page, source) {
    return page.evaluate(async configText => {
        window.HelicopterConfigRuntime.editor.setValue(configText);
        const result = await window.HelicopterConfigRuntime.run();
        return {
            output: document.getElementById("console-output").textContent,
            result,
            state: window.HelicopterConfigRuntime.getState()
        };
    }, source);
}

function layoutSnapshot(page) {
    return page.evaluate(() => {
        const rect = selector => {
            const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
            return { x, y, width, height, right, bottom };
        };
        const buttonRects = [...document.querySelectorAll("[data-config-run], #run-btn, #reset-btn")]
            .map(button => button.getBoundingClientRect())
            .map(({ x, y, width, height, right, bottom }) => ({ x, y, width, height, right, bottom }));

        return {
            viewportWidth: window.innerWidth,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            hero: rect(".helicopter-access-hero"),
            title: rect(".helicopter-hero-title"),
            briefing: rect(".agent-briefing"),
            status: rect(".access-display"),
            panel: rect(".helicopter-code-panel"),
            editor: rect(".CodeMirror"),
            output: rect(".helicopter-output-card"),
            help: rect(".helicopter-help-column"),
            controls: rect(".helicopter-controls"),
            buttonRects
        };
    });
}

test("@ipad the JSON mission stays clear on laptops, tablets and phones", async ({ page }) => {
    await openLevel(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Öffne Zugang und Hangartor");
    const briefing = page.getByLabel("Nachricht von Agent PY");
    await expect(briefing).toContainText("Notzugang hergestellt");
    await expect(briefing).toContainText("Startkonfiguration unvollständig");
    await expect(briefing).toContainText("heli_config.json");
    await expect(page.locator(".CodeMirror")).toHaveCount(1);
    await expect(page.locator("#python-editor")).toHaveCount(0);
    await expect(page.getByText("json.loads()", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Konfiguration anwenden" })).toHaveCount(2);
    await expect(page.locator(".helicopter-config-status > div")).toHaveCount(3);

    const layout = await layoutSnapshot(page);
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.buttonRects.every(button => button.height >= 44)).toBe(true);
    expect(layout.editor.height).toBeGreaterThanOrEqual(300);
    expect(layout.buttonRects[0].bottom).toBeLessThanOrEqual(layout.editor.y + 1);
    expect(layout.editor.bottom).toBeLessThanOrEqual(layout.output.y + 1);
    if (layout.viewportWidth > 1100) {
        expect(layout.panel.right).toBeLessThanOrEqual(layout.help.x + 1);
    } else {
        expect(layout.panel.bottom).toBeLessThanOrEqual(layout.help.y + 1);
    }

    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#config-panel")).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".helicopter-help-column")).toBeVisible();
    const phoneLayout = await layoutSnapshot(page);
    expect(phoneLayout.overflow).toBeLessThanOrEqual(1);
    expect(phoneLayout.hero.width).toBeLessThanOrEqual(390);
    expect(phoneLayout.title.right).toBeLessThanOrEqual(phoneLayout.hero.right + 1);
    expect(phoneLayout.briefing.right).toBeLessThanOrEqual(phoneLayout.hero.right + 1);
    expect(phoneLayout.status.right).toBeLessThanOrEqual(phoneLayout.hero.right + 1);
    expect(phoneLayout.panel.bottom).toBeLessThanOrEqual(phoneLayout.help.y + 1);
    expect(phoneLayout.buttonRects.every(button => button.height >= 44)).toBe(true);
    expect(phoneLayout.buttonRects[1].bottom).toBeLessThanOrEqual(phoneLayout.buttonRects[2].y + 1);
});

test("the mission starts with the closed hangar and unchanged cockpit status", async ({ page }) => {
    await openLevel(page);

    await expect(page.locator("body")).toHaveAttribute("data-access-state", "locked");
    await expect(page.locator("body")).toHaveAttribute("data-hangar-state", "closed");
    await expect(page.locator(".hangar-closed-image")).toHaveCSS("opacity", "1");
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "0");
    await expect(page.locator(".hangar-closed-image")).toHaveJSProperty("naturalWidth", 1717);
    await expect(page.locator(".hangar-closed-image")).toHaveJSProperty("naturalHeight", 916);
    await expect(page.locator(".hangar-open-image")).toHaveJSProperty("naturalWidth", 1717);
    await expect(page.locator(".hangar-open-image")).toHaveJSProperty("naturalHeight", 916);
    await expect(page.locator("#heli-status")).toHaveText("Zugang geschlossen");
    await expect(page.locator("#cockpit-status")).toHaveText("Hauptdisplay online · Navigation offline · Rotor offline");
    await expect(page.locator("#hangar-status")).toHaveText("Tor geschlossen");
});

test("semantic JSON with both targets open succeeds while the cockpit stays offline", async ({ page }) => {
    await openLevel(page);

    await page.locator("#console-output").scrollIntoViewIfNeeded();
    const scrollBeforeRun = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeRun).toBeGreaterThan(0);

    const run = await applyConfig(page, successfulConfig);
    expect(run.result).toEqual({ passed: true, failure: null });
    expect(run.state).toEqual({ accessState: "granted", hangarState: "open" });
    expect(run.output).toContain("HELIKOPTERZUGANG OFFEN");
    expect(run.output).toContain("HANGARTOR OFFEN");
    expect(run.output).toContain("Hauptdisplay online · Navigation offline · Rotor offline");
    await expect(page.locator("body")).toHaveAttribute("data-access-state", "granted");
    await expect(page.locator("body")).toHaveAttribute("data-hangar-state", "open");
    await expect(page.locator(".hangar-closed-image")).toHaveCSS("opacity", "0");
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "1");
    await expect(page.locator("#config-message")).toHaveText("ZUGANG & TOR OFFEN");
    await expect(page.locator("#heli-status")).toHaveText("Zugang offen");
    await expect(page.locator("#cockpit-status")).toHaveText("Hauptdisplay online · Navigation offline · Rotor offline");
    await expect(page.locator("#hangar-status")).toHaveText("Tor offen");
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrollBeforeRun - 1);
});

test("an incomplete configuration fails in place and keeps the closed artwork", async ({ page }) => {
    await openLevel(page);

    const incompleteConfig = JSON.stringify({
        heli: { zugang_offen: true },
        cockpit: {
            hauptdisplay_online: true,
            navigation_online: false,
            rotor_online: false
        },
        hangar: { tor_offen: false }
    }, null, 2);

    await page.locator("#console-output").scrollIntoViewIfNeeded();
    const scrollBeforeRun = await page.evaluate(() => window.scrollY);
    const run = await applyConfig(page, incompleteConfig);
    expect(run.result).toEqual({ passed: false, failure: "HANGAR_CLOSED" });
    expect(run.state).toEqual({ accessState: "denied", hangarState: "closed" });
    expect(run.output).toContain("Das Hangartor ist noch geschlossen");
    await expect(page.locator("body")).toHaveAttribute("data-hangar-state", "closed");
    await expect(page.locator(".hangar-closed-image")).toHaveCSS("opacity", "1");
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "0");
    const scrollAfterRun = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfterRun - scrollBeforeRun)).toBeLessThanOrEqual(1);
});

test("changing a cockpit value is rejected even when both targets are open", async ({ page }) => {
    await openLevel(page);

    const mutatedCockpit = JSON.stringify({
        heli: { zugang_offen: true },
        cockpit: {
            hauptdisplay_online: true,
            navigation_online: true,
            rotor_online: false
        },
        hangar: { tor_offen: true }
    });

    const run = await applyConfig(page, mutatedCockpit);
    expect(run.result).toEqual({ passed: false, failure: "COCKPIT_CHANGED" });
    expect(run.state).toEqual({ accessState: "denied", hangarState: "closed" });
    expect(run.output).toContain("Hauptdisplay, Navigation und Rotor bleiben");
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "0");
    await expect(page.locator("#cockpit-status")).toHaveText("Hauptdisplay online · Navigation offline · Rotor offline");
});

test("reset restores the original file and closed visual state", async ({ page }) => {
    await openLevel(page);

    expect((await applyConfig(page, successfulConfig)).result.passed).toBe(true);
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "1");

    await page.getByRole("button", { name: "Startdatei laden" }).click();
    const resetState = await page.evaluate(() => ({
        config: JSON.parse(window.HelicopterConfigRuntime.editor.getValue()),
        output: document.getElementById("console-output").textContent,
        result: window.HelicopterConfigRuntime.getResult(),
        state: window.HelicopterConfigRuntime.getState()
    }));

    expect(resetState.config).toEqual({
        heli: { zugang_offen: false },
        cockpit: {
            hauptdisplay_online: true,
            navigation_online: false,
            rotor_online: false
        },
        hangar: { tor_offen: false }
    });
    expect(resetState.output).toBe("Datei geladen. Helikopterzugang und Hangartor sind noch geschlossen.");
    expect(resetState.result).toBeNull();
    expect(resetState.state).toEqual({ accessState: "locked", hangarState: "closed" });
    await expect(page.locator(".hangar-closed-image")).toHaveCSS("opacity", "1");
    await expect(page.locator(".hangar-open-image")).toHaveCSS("opacity", "0");
    await expect(page.locator("#config-message")).toHaveText("ZUGANG & TOR GESPERRT");
});
