import { expect, test } from '@playwright/test';

const pageErrors = new WeakMap();
test.beforeEach(({ page }) => {
    const errors = [];
    pageErrors.set(page, errors);
    page.on('pageerror', error => errors.push(String(error)));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

test('identification runs once through sleeps and input, then identifies a misspelled welcome @ipad', async ({ page }) => {
    await page.goto('/mission1_level3.html');
    await page.waitForFunction(() => window.editor);
    await page.evaluate(() => window.editor.setValue('import time\ntime.sleep(0.6)\nname = input("Wie heißt Du?   ")\ntime.sleep(0.6)\nprint("Wilkommen im System,", name)'));
    const run = page.locator('#run-btn');
    await run.click();
    await expect(run).toBeDisabled();
    // Neither a synthetic second click nor a direct runner call may start again.
    await page.evaluate(() => { document.getElementById('run-btn').click(); runit(); });
    await expect(page.locator('.console-input')).toHaveCount(1);
    await page.locator('.console-input').fill('Ada');
    await page.locator('.console-input').press('Enter');
    await expect(run).toBeDisabled();
    await expect(run).toBeEnabled();
    await expect(page.locator('#status-text')).toContainText('Willkommen');
    await expect(page.locator('#status-text')).not.toContainText('Wie heißt');
    await expect(page.locator('.console-input')).toHaveCount(0);
    expect(await page.locator('#console-output').innerText()).toBe('Wie heißt Du?   Ada\nWilkommen im System, Ada\n');
});

test('Ctrl+C cancels input and sleep without resuming an old program @ipad', async ({ page }) => {
    await page.goto('/mission1_level3.html');
    await page.waitForFunction(() => window.editor);
    for (const code of ['name = input("Warte: ")\nprint("ALTER LAUF")', 'import time\nprint("PAUSE")\ntime.sleep(1.5)\nprint("ALTER LAUF")']) {
        await page.evaluate(code => window.editor.setValue(code), code);
        await page.locator('#run-btn').click();
        if (code.startsWith('name')) await expect(page.locator('.console-input')).toBeVisible();
        else await expect(page.locator('#console-output')).toContainText('PAUSE');
        await page.keyboard.press('Control+c');
        await expect(page.locator('#run-btn')).toBeEnabled();
        await expect(page.locator('.console-input')).toHaveCount(0);
        expect(await page.evaluate(() => window.editor.getValue())).toBe(code);
        await expect(page.locator('#console-output')).toContainText('Programm abgebrochen');
        await page.evaluate(() => window.editor.setValue('print("NEUER LAUF")'));
        await page.locator('#run-btn').click();
        await expect(page.locator('#run-btn')).toBeEnabled();
        // Deliberately outwait the old sleep to catch a stale continuation.
        await page.waitForTimeout(1700);
        await expect(page.locator('#console-output')).toHaveText('NEUER LAUF\n');
    }
});

test('Ctrl+C stops infinite loops across every Python runtime and preserves the code @ipad', async ({ page }) => {
    test.setTimeout(100_000);
    for (const route of ['mission1_level1.html', 'mission2_level2.html', 'mission3_level3.html', 'mission4_level3.html', 'agent_training_level2.html', 'pico_level1.html', 'pixelmuseum_briefing.html', 'helikopter_flucht_level1.html', 'pico_level4.html']) {
        await page.goto('/' + route);
        await page.waitForFunction(() => window.editor);
        const code = '# Endlosschleife für den Abbruchtest\nwhile True:\n    pass';
        await page.evaluate(code => window.editor.setValue(code), code);
        const run = page.locator('#run-btn');
        await run.click();
        await expect(run).toBeDisabled();
        await page.evaluate(() => window.editor.focus());
        await page.keyboard.press('Control+c');
        await expect(run, route).toBeEnabled();
        expect(await page.evaluate(() => window.editor.getValue()), route).toBe(code);
        await page.evaluate(() => window.editor.setValue('print("NEUSTART OK")'));
        await run.click();
        await expect(run, route).toBeEnabled();
        await expect(page.locator('#console-output'), route).toContainText('NEUSTART OK');
    }
});

test('Ctrl+C stops a printing endless loop on Safe level 3 @ipad', async ({ page }) => {
    await page.goto('/mission3_level3.html');
    await page.waitForFunction(() => window.editor);
    await page.evaluate(() => window.editor.setValue('while True:\n    print("Suche weiter")'));
    await page.locator('#run-btn').click();
    await expect(page.locator('#console-output')).toContainText('Suche weiter');
    await page.keyboard.press('Control+c');
    await expect(page.locator('#run-btn')).toBeEnabled();
    const output = await page.locator('#console-output').innerText();
    await page.waitForTimeout(200);
    expect(await page.locator('#console-output').innerText()).toBe(output);
});

test('stopping a Turtle animation cannot update the next flight @ipad', async ({ page }) => {
    test.setTimeout(45_000);
    for (const route of ['agent_training_level1.html', 'pixelmuseum_briefing.html']) {
        await page.goto('/' + route);
        await page.waitForFunction(() => window.editor);
        const code = 'import turtle\ndrohne = turtle.Turtle()\ndrohne.speed(1)\ndrohne.goto(300, 100)\nprint("ALTER FLUG")';
        await page.evaluate(code => window.editor.setValue(code), code);
        await page.locator('#run-btn').click();
        await expect(page.locator('canvas').first()).toBeVisible();
        await page.keyboard.press('Control+c');
        await expect(page.locator('#run-btn')).toBeEnabled();
        expect(await page.evaluate(() => window.editor.getValue())).toBe(code);
        const next = 'import turtle\ndrohne = turtle.Turtle()\ndrohne.speed(0)\ndrohne.goto(10, 20)\nprint("NEUER FLUG", drohne.position())';
        await page.evaluate(code => window.editor.setValue(code), next);
        await page.locator('#run-btn').click();
        await expect(page.locator('#run-btn')).toBeEnabled();
        await expect(page.locator('#console-output')).toContainText('NEUER FLUG');
        const output = await page.locator('#console-output').innerText();
        await page.waitForTimeout(3500);
        expect(await page.locator('#console-output').innerText()).toBe(output);
        expect(await page.evaluate(() => {
            const position = Sk.misceval.callsimArray(Sk.abstr.gattr(Sk.globals.drohne, new Sk.builtin.str('position')));
            return Sk.ffi.remapToJs(position);
        })).toEqual([10, 20]);
    }
});

test('Ctrl+C stops live calibration through the same security path as Stop @ipad', async ({ page }) => {
    await page.goto('/pico_level4.html?e2e');
    await page.waitForFunction(() => window.DroneMissionRuntime);
    const code = 'def kalibrieren(werte):\n    return [0, 0, 0, 0]';
    await page.evaluate(code => { window.editor.setValue(code); window.DroneMissionRuntime.run(); }, code);
    await expect(page.locator('#calibration-alert-text')).toHaveText('Fehler erkannt');
    await page.keyboard.press('Control+c');
    await expect(page.locator('#run-btn')).toBeEnabled();
    expect(await page.evaluate(() => window.DroneMissionRuntime.getState())).toMatchObject({ phase: 'stopped', stoppedErrors: 1, securityLocked: false, complete: false });
    expect(await page.evaluate(() => window.editor.getValue())).toBe(code);
});
