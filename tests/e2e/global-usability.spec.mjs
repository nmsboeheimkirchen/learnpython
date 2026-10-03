import { chromium, expect, test } from "@playwright/test";

test("clicked Python hints stay while typing and reject copying only the hint", async ({ page, context }, testInfo) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    for (const route of ["mission1_level1.html", "mission2_level2.html", "agent_training_level2.html"]) {
        await page.goto(`/${route}`);
        await page.waitForFunction(() => window.editor);
        const block = page.locator(".block-tooltip").first();
        const hint = block.locator(".tooltiptext");
        await block.click();
        await expect(block).toHaveAttribute("aria-pressed", "true");
        await page.locator(".CodeMirror-code").click();
        await page.keyboard.type('# selbst getippt');
        await expect(hint).toBeVisible();
        await expect(block).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => window.editor.getValue())).toContain("# selbst getippt");

        // Ordinary mouse selection cannot select the hint text.
        await hint.scrollIntoViewIfNeeded();
        const box = await hint.boundingBox();
        await page.mouse.move(box.x + 8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
        expect(await page.evaluate(() => window.getSelection().toString())).toBe("");

        // Also reject copying a selection made through Select All / a Range.
        await page.evaluate(() => navigator.clipboard.writeText("clipboard unchanged"));
        await hint.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });
        await page.keyboard.press("Control+c");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("clipboard unchanged");
        expect(await hint.evaluate(element => !element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })))).toBe(true);

        // The learner can still select/copy/paste their own editor text.
        await page.evaluate(() => {
            window.getSelection().removeAllRanges();
            window.editor.setValue('print("Mein eigener Code")');
            window.editor.focus();
            window.editor.execCommand("selectAll");
        });
        await page.keyboard.press("Control+c");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('print("Mein eigener Code")');
        await page.evaluate(() => navigator.clipboard.writeText('print("Eingefügt")'));
        await page.keyboard.press("Control+v");
        await expect.poll(() => page.evaluate(() => window.editor.getValue())).toBe('print("Eingefügt")');
        await expect(hint).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`${route}-pinned.png`), fullPage: true });
        await page.keyboard.press("Escape");
        await page.mouse.move(0, 0);
        await expect(hint).toBeHidden();

        await block.focus();
        await page.keyboard.press("Enter");
        await expect(block).toHaveAttribute("aria-pressed", "true");
        const other = page.locator(".block-tooltip").nth(1);
        if (await other.count()) {
            await other.click();
            await expect(block).toHaveAttribute("aria-pressed", "false");
            await expect(other).toHaveAttribute("aria-pressed", "true");
        }
    }
});

test("touch pins and unpins a Python block hint @ipad", async ({ page }) => {
    await page.goto("/agent_training_level2.html");
    const block = page.locator(".block-tooltip").first();
    await block.click();
    await page.locator(".CodeMirror-code").click();
    await expect(block.locator(".tooltiptext")).toBeVisible();
    await block.click();
    await expect(block).toHaveAttribute("aria-pressed", "false");
    await page.locator(".CodeMirror-code").click();
    await expect(block.locator(".tooltiptext")).toBeHidden();
});

// Run with TEST_INSTALLED_BROWSERS=1 on Windows to include the actual installed
// Chrome and Edge. CSS zoom + DPR deliberately simulate fractional scaling;
// they cannot reproduce every Windows/browser-zoom combination of a pupil's PC.
const channels = process.env.TEST_INSTALLED_BROWSERS === "1" ? ["chrome", "msedge"] : [undefined];
for (const channel of channels) {
    test(`code remains right of line numbers across scaling (${channel || "chromium"})`, async ({}, testInfo) => {
        test.setTimeout(120_000);
        const browser = await chromium.launch({ channel });
        try {
            for (const dpr of [1, 1.25, 1.5]) {
                const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dpr });
                const page = await context.newPage();
                const errors = [];
                page.on("pageerror", error => errors.push(String(error)));
                for (const route of ["mission1_level1.html", "pico_level4.html", "helikopter_flucht_level1.html", "helikopter_flucht_level2.html"]) {
                    await page.goto(`${testInfo.project.use.baseURL || "http://127.0.0.1:4173"}/${route}`);
                    await page.waitForFunction(() => window.editor);
                    await page.evaluate(() => window.editor.setValue(Array.from({ length: 150 }, (_, i) => `print("Zeile ${i + 1}")`).join("\n")));
                    for (const zoom of [0.8, 0.9, 1, 1.25]) {
                        await page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, zoom);
                        await page.locator(".CodeMirror").scrollIntoViewIfNeeded();
                        await page.evaluate(() => {
                            window.editor.scrollIntoView({ line: 110, ch: 0 });
                            window.dispatchEvent(new Event("resize"));
                        });
                        await expect.poll(() => page.evaluate(() => {
                            const editor = window.editor;
                            const gutter = editor.getWrapperElement().querySelector(".CodeMirror-gutters").getBoundingClientRect();
                            const lines = [...editor.getWrapperElement().querySelectorAll(".CodeMirror-code > div")];
                            const overlaps = lines.flatMap(line => {
                                const number = line.querySelector(".CodeMirror-linenumber");
                                const code = line.querySelector("pre.CodeMirror-line > span");
                                if (!number || !code) return [];
                                const nr = number.getBoundingClientRect(), text = code.getBoundingClientRect();
                                const gap = text.left - Math.max(nr.right, gutter.right);
                                return gap >= 1 ? [] : [{ number: number.textContent, gap, codeLeft: text.left, numberRight: nr.right, gutterRight: gutter.right }];
                            });
                            if (!lines.some(line => line.querySelector(".CodeMirror-linenumber")?.textContent === "111")) overlaps.push({ missingLine: 111 });
                            return overlaps.slice(0, 3);
                        }), { message: `${route}: DPR ${dpr}, zoom ${zoom}` }).toEqual([]);
                    }
                    // A hidden editor becoming visible must remeasure even if its
                    // original width is restored; no app-specific refresh call.
                    await page.evaluate(() => window.editor.getWrapperElement().style.display = "none");
                    await page.waitForTimeout(50);
                    await page.evaluate(() => window.editor.getWrapperElement().style.display = "");
                    await expect(page.locator(".CodeMirror-code .CodeMirror-linenumber").first()).toBeVisible();
                }
                expect(errors).toEqual([]);
                await context.close();
            }
            console.log(`Verified ${channel || "chromium"} ${browser.version()}: 48 editor/scaling combinations`);
        } finally { await browser.close(); }
    });
}

test("large headings keep their descenders and leave space before the next paragraph", async ({ page }, testInfo) => {
    for (const route of ["index.html", "projektwahl.html", "mission1_start.html", "pico_level3.html?e2e", "pixelmuseum_briefing.html", "helikopter_flucht.html"]) {
        await page.goto(`/${route}`);
        if (route.startsWith("pico_level3")) {
            await page.waitForFunction(() => window.DroneMissionRuntime);
            await page.evaluate(async () => {
                const runtime = window.DroneMissionRuntime;
                runtime.editor.setValue(runtime.editor.getValue() + '\nfliege_zu(220, 15)\n');
                await runtime.run();
            });
        }
        const title = page.locator("h1:visible").first();
        await expect(title).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        const geometry = await title.evaluate(element => {
            const style = getComputedStyle(element);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const glyphs = ctx.measureText(element.textContent);
            const rect = element.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(element);
            const textRect = range.getBoundingClientRect();
            const sibling = element.nextElementSibling;
            const next = sibling?.getClientRects().length ? sibling.getBoundingClientRect() : null;
            return { inkBottom: textRect.bottom - glyphs.fontBoundingBoxDescent + glyphs.actualBoundingBoxDescent,
                paintBottom: rect.bottom,
                clearBelow: !next || next.top >= rect.bottom };
        });
        expect(geometry.inkBottom).toBeLessThanOrEqual(geometry.paintBottom + 1);
        expect(geometry.clearBelow).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${route.split('?')[0]}-heading.png`), fullPage: true });
        await title.screenshot({ path: testInfo.outputPath(`${route.split('?')[0]}-title.png`) });
    }
});
