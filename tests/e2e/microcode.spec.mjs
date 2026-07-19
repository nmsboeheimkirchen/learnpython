import { expect, test } from "@playwright/test";

const stackedBlockPages = [
    "mission2_level1.html",
    "mission3_level2.html",
    "mission3_level3.html",
    "mission4_level1.html",
    "mission4_level2.html",
    "mission4_level3.html"
];

const indentationPlans = [
    { page: "mission3_level2.html", offsets: [0, 0, 20, 0, 20] },
    { page: "mission3_level3.html", offsets: [0, 0, 0, 0, 20, 20, 40, 20, 40, 0] },
    { page: "mission4_level3.html", offsets: [0, 0, 0, 20, 20, 0] }
];

async function blockGeometry(hint) {
    return hint.evaluate(element => [...element.children]
        .filter(child => child.matches(".makecode-block, .makecode-block-var"))
        .map(child => {
            const rect = child.getBoundingClientRect();
            return {
                bottom: rect.bottom,
                classes: child.className,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        }));
}

test("microcode modules form one vertical sequence on every multi-block plan", async ({ page }) => {
    for (const missionPage of stackedBlockPages) {
        await page.goto(`/${missionPage}`);
        const hint = page.locator(".block-hint").first();
        await expect(hint).toBeVisible();

        const blocks = await blockGeometry(hint);
        expect(blocks.length, `${missionPage} needs at least two microcode modules`).toBeGreaterThanOrEqual(2);

        for (let index = 1; index < blocks.length; index += 1) {
            expect(
                blocks[index].top,
                `${missionPage}: module ${index + 1} overlaps module ${index}`
            ).toBeGreaterThanOrEqual(blocks[index - 1].bottom - 1);
        }
    }
});

test("nested microcode keeps its one- and two-step indentation", async ({ page }) => {
    for (const plan of indentationPlans) {
        await page.goto(`/${plan.page}`);
        const blocks = await blockGeometry(page.locator(".block-hint").first());
        expect(blocks).toHaveLength(plan.offsets.length);

        const baseline = blocks[0].left;
        const actualOffsets = blocks.map(block => Math.round(block.left - baseline));
        expect(actualOffsets, `${plan.page} has the wrong visual nesting`).toEqual(plan.offsets);

        blocks.forEach((block, index) => {
            if (plan.offsets[index] === 20) expect(block.classes).toContain("microcode-indent-1");
            if (plan.offsets[index] === 40) expect(block.classes).toContain("microcode-indent-2");
        });
    }
});

test("a focused block helper opens below the module without being clipped", async ({ page }) => {
    await page.goto("/mission3_level2.html");

    const hint = page.locator(".block-hint").first();
    const block = hint.locator(":scope > .block-tooltip").first();
    const bubble = block.locator(":scope > .tooltiptext");
    const guide = page.locator(".guide-panel");

    await block.focus();
    await expect(block).toBeFocused();
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveCSS("visibility", "visible");
    await expect(bubble).toHaveCSS("opacity", "1");
    await expect(bubble).toContainText('tipp = int(input("Tipp: "))');

    const [hintBox, blockBox, bubbleBox, guideBox] = await Promise.all([
        hint.boundingBox(),
        block.boundingBox(),
        bubble.boundingBox(),
        guide.boundingBox()
    ]);
    expect(hintBox).not.toBeNull();
    expect(blockBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    expect(guideBox).not.toBeNull();

    expect(bubbleBox.y).toBeGreaterThanOrEqual(blockBox.y + blockBox.height);
    expect(bubbleBox.y).toBeGreaterThanOrEqual(hintBox.y);
    expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(hintBox.y + hintBox.height + 1);
    expect(bubbleBox.x).toBeGreaterThanOrEqual(guideBox.x);
    expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(guideBox.x + guideBox.width + 1);

    const styles = await bubble.evaluate(element => {
        const bubbleStyle = getComputedStyle(element);
        const blockStyle = getComputedStyle(element.parentElement);
        const hintStyle = getComputedStyle(element.closest(".block-hint"));
        return {
            backdropFilter: bubbleStyle.backdropFilter || bubbleStyle.webkitBackdropFilter,
            blockRadius: Number.parseFloat(blockStyle.borderTopLeftRadius),
            bubbleRadius: Number.parseFloat(bubbleStyle.borderTopLeftRadius),
            hintOverflow: hintStyle.overflow
        };
    });

    expect(styles.bubbleRadius).toBeGreaterThanOrEqual(18);
    expect(styles.bubbleRadius).toBeGreaterThan(styles.blockRadius);
    expect(styles.backdropFilter).toContain("blur(");
    expect(styles.hintOverflow).toBe("visible");
});

test("inline helpers use the same rounded glass language", async ({ page }) => {
    await page.goto("/mission2_level1.html");

    const trigger = page.locator(".tooltip").first();
    const bubble = trigger.locator(".tooltiptext");
    await trigger.focus();
    await expect(bubble).toBeVisible();

    const design = await bubble.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            borderRadius: Number.parseFloat(style.borderTopLeftRadius),
            backgroundImage: style.backgroundImage
        };
    });

    expect(design.borderRadius).toBeGreaterThanOrEqual(18);
    expect(design.backdropFilter).toContain("blur(");
    expect(design.backgroundImage).toContain("linear-gradient");
});
