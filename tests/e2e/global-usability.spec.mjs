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

test("compact headings retain their original flow and paint full descenders @ipad", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Original compact typography before MAIN-20. Compare actual text/following
    // content positions, not the enlarged gradient paint rectangle itself.
    const originals = [
        ["index.html", .91, 22], ["projektwahl.html", .93, 20],
        ["mission1_start.html", .94, 15], ["agent_training_start.html", .94, 15],
        ["agent_training_level1.html", 1.1, 10], ["pico_level1.html", 1.05, 13],
        ["pico_level3.html?e2e", 1.05, 13], ["pico_level4.html", .94, 8],
        ["pixelmuseum_briefing.html", .94, 13], ["pixelmuseum_finale.html", .94, 13],
        ["helikopter_flucht.html", .9, 17], ["helikopter_flucht_level1.html", .9, 20]
    ];
    for (const [route, leading, marginBottom] of originals) {
        await page.goto(`/${route}`);
        await page.evaluate(() => document.fonts.ready);
        // Reduced motion shortens the home entrance animation but retains its
        // delay. Compare positions only after finite entrance animations finish.
        await page.evaluate(() => Promise.all(document.getAnimations()
            .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
            .map(animation => animation.finished.catch(() => {}))));
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
        await title.evaluate(element => { element.dataset.headingUnderTest = ""; });
        const flow = () => title.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            let current = element, next = null;
            while (current && !next) {
                for (let sibling = current.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
                    if (sibling.getClientRects().length) { next = sibling; break; }
                }
                current = current.parentElement;
            }
            return { textTop: range.getBoundingClientRect().top + scrollY,
                followingTop: next?.getBoundingClientRect().top + scrollY,
                lineHeight: parseFloat(getComputedStyle(element).lineHeight) };
        });
        const restored = await flow();
        const reference = await page.addStyleTag({ content: `[data-heading-under-test] {
            padding: 0 !important; margin-top: 0 !important;
            margin-bottom: ${marginBottom}px !important; line-height: ${leading} !important;
        }` });
        const original = await flow();
        await reference.evaluate(element => element.remove());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        for (const property of ["textTop", "followingTop", "lineHeight"]) {
            expect(Math.abs(restored[property] - original[property]), `${route}: ${property}, restored ${JSON.stringify(restored)}, original ${JSON.stringify(original)}`).toBeLessThanOrEqual(1);
        }
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
            return { inkBottom: textRect.bottom - glyphs.fontBoundingBoxDescent + glyphs.actualBoundingBoxDescent,
                paintBottom: rect.bottom, paddingBottom: style.paddingBottom,
                clipsToGradient: style.backgroundClip === "text" || style.webkitBackgroundClip === "text" };
        });
        if (geometry.clipsToGradient) expect(geometry.inkBottom, `${route}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.paintBottom + 1);
        await page.screenshot({ path: testInfo.outputPath(`${route.split('?')[0]}-heading.png`), fullPage: true });
        await title.screenshot({ path: testInfo.outputPath(`${route.split('?')[0]}-title.png`) });
    }
});
