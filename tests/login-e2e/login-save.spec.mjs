import { expect, test } from '@playwright/test';
const password = 'Synthetic-browser-password-123!';
const passed = 'print("Verbindung wird hergestellt...")';
test('the Hostinger layout exposes only the public entrypoint, never private files', async ({ request }) => {
    const homepage = await (await request.get('/')).text();
    for (const path of ['/agentpy-private/database-password.txt', '/agentpy-private/config.php', '/app/src/bootstrap.php', '/server/schema.sql', '/manifest.json']) {
        const response = await request.get(path);
        const body = await response.text();
        // PHP's development server falls back to index.html for some missing paths.
        // That is not a disclosure: a 200 must be exactly the public homepage.
        if (response.status() === 200) expect(body, path).toBe(homepage);
        else expect(response.status(), path).toBe(404);
        expect(body, path).not.toContain('Synthetic-not-public');
    }
    const release = await request.get('/release.json');
    expect((await release.json()).releaseId).toBe('browser-test');
    const session = await request.get('/api/index.php?action=session');
    expect(session.status()).toBe(200);
    expect(session.headers()['cache-control']).toContain('no-store');
});
async function login(page, account = 'student-a') {
    await page.goto('/');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(`${account}-${test.info().project.name}@example.test`);
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('dialog').getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('button', { name: 'Benutzermenü' }).click();
    await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toBeVisible();
    await expect(page.locator('.account-panel')).toContainText(`${account} · Klasse Browser Test`);
}
async function mission(page, path = '/mission1_level1.html') {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => Boolean(window.AgentLearningData && window.editor))).toBe(true);
    await expect(page.locator('html')).not.toHaveClass(/account-blocked/);
}
async function reset(page) {
    expect(await page.evaluate(() => window.AgentLearningData.resetLearningData())).toBe(true);
}
test('real login: a completed mission and exact code follow a student to another device; guests stay untouched', async ({ page, browser }) => {
    await page.goto('/mission1_level1.html');
    await page.evaluate(() => localStorage.setItem('attemptedLevelCode_v1', JSON.stringify({ mission1_level1: 'GAST BLEIBT' })));
    await login(page); await mission(page); await reset(page);
    await page.evaluate(code => window.editor.setValue(code), passed);
    await page.getByRole('button', { name: /Code Ausführen/ }).click();
    await expect(page.locator('.account-panel')).toContainText('Zentral gespeichert');
    await expect.poll(() => page.evaluate(() => window.AgentLearningData.getCompletedCode('mission1_level1'))).toBe(passed);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('attemptedLevelCode_v1')).mission1_level1)).toBe('GAST BLEIBT');
    const other = await browser.newContext(); const laptop = await other.newPage();
    try {
        await login(laptop); await mission(laptop);
        expect(await laptop.evaluate(() => window.editor.getValue())).toBe(passed);
        expect(await laptop.evaluate(() => window.AgentLearningData.getUnlockedLevelIds())).toContain('link-level2');
    } finally { await other.close(); }
    await page.getByRole('button', { name: 'Benutzermenü' }).click();
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await expect(page.locator('.account-panel')).toContainText('Gastmodus');
    await expect(page).toHaveURL(/\/index\.html$/);
    await mission(page); // Logout goes home; guest code is still available when reopening the lesson.
    await expect.poll(() => page.evaluate(() => window.editor?.getValue())).toBe('GAST BLEIBT');
    await login(page, 'student-b'); await mission(page); await reset(page);
    expect(await page.evaluate(() => window.AgentLearningData.getCompletedCode('mission1_level1'))).toBeNull();
});
test('startup failure blocks the lesson without ever opening guest storage', async ({ page }) => {
    await page.addInitScript(() => {
        window.__reads = 0;
        Storage.prototype.getItem = () => { window.__reads++; throw new Error('No guest reads allowed'); };
    });
    await page.route('**/api/index.php?*', route => route.abort());
    await page.goto('/mission1_level1.html');
    await expect(page.locator('.account-panel')).toContainText('Keine Serverbestätigung');
    await expect(page.locator('html')).toHaveClass(/account-blocked/);
    expect(await page.evaluate(() => window.__reads)).toBe(0);
    expect(await page.evaluate(() => Boolean(window.AgentLearningData))).toBe(false);
});
test('lost acknowledgement retries the identical completion; conflict does not overwrite another device', async ({ page, browser }) => {
    await login(page); await mission(page); await reset(page);
    let lost = false; const requests = [];
    await page.route('**/api/index.php?action=write', async route => {
        requests.push(route.request().postDataJSON());
        if (!lost) { lost = true; await route.fetch(); await route.abort(); }
        else await route.continue();
    });
    expect(await page.evaluate(code => window.AgentLearningData.completeLevel({ levelId: 'mission1_level1', code }), passed)).toBe(false);
    await page.getByRole('button', { name: 'Speichern erneut versuchen' }).click();
    await expect(page.locator('.account-panel')).toContainText('Zentral gespeichert');
    expect(requests[0]).toEqual(requests[1]);
    const other = await browser.newContext(); const laptop = await other.newPage();
    try {
        await login(laptop); await mission(laptop);
        expect(await laptop.evaluate(() => window.AgentLearningData.recordAttempt('mission1_level1', 'anderes Gerät'))).toBe(true);
        expect(await page.evaluate(() => window.AgentLearningData.recordAttempt('mission1_level1', 'alter Tab'))).toBe(false);
        await expect(page.locator('.account-panel')).toContainText('anderen Tab oder Gerät');
        await laptop.reload(); await expect.poll(() => laptop.evaluate(() => window.editor?.getValue())).toBe('anderes Gerät');
    } finally { await other.close(); }
});
test('an account switch locks and clears an already open tab', async ({ page, context }) => {
    await login(page); await mission(page); await reset(page);
    await page.evaluate(() => window.editor.setValue('private account A'));
    const other = await context.newPage(); await other.goto('/');
    await other.getByRole('button', { name: 'Benutzermenü' }).click();
    await other.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/account-blocked/);
    expect(await page.evaluate(() => window.editor.getValue())).toBe('');
    await login(other, 'student-b');
    expect(await page.evaluate(() => window.AgentLearningData.recordAttempt('mission1_level1', 'must not reach B'))).toBe(false);
    await other.close();
});
test('completion-only mode sends no attempts and help/skip progress survives reload', async ({ page }) => {
    await page.addInitScript(() => { window.AgentAccountConfig = { enabled: true, endpoint: 'api/index.php', saveMode: 'completion-only' }; });
    await login(page); await mission(page); await reset(page);
    let writes = 0; page.on('request', request => { if (request.url().includes('action=write')) writes++; });
    await page.evaluate(() => window.AgentLearningData.recordAttempt('mission1_level1', 'nur im Tab'));
    expect(writes).toBe(0);
    await expect(page.locator('.account-panel')).toContainText('Nur in diesem Tab');
    expect(await page.evaluate(() => window.AgentLearningData.completeLevel({ levelId: 'mission1_level1', code: 'fertig' }))).toBe(true);
    expect(writes).toBe(1);
    expect(await page.evaluate(() => window.AgentLearningData.setFeatureProgress('pixelmuseum', { version: 1, count: 2, levels: { KEYCARD_MISSING: 2 } }))).toBe(true);
    await mission(page, '/pixelmuseum_briefing.html');
    await expect(page.locator('#museum-help-count')).toContainText('2-mal');
    await mission(page, '/mission2_level3.html');
    await page.locator('[data-skip-unlocks]').click();
    await expect(page).toHaveURL(/mission3_start.html/);
    await expect.poll(() => page.evaluate(() => window.AgentLearningData?.getUnlockedLevelIds())).toContain('link-m3-l1');
});

test('all mission runtimes wait for authenticated data without touching browser storage', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await login(page); await mission(page); await reset(page);
    await page.addInitScript(() => {
        Storage.prototype.getItem = () => { throw new Error('Authenticated mode touched guest storage'); };
        Storage.prototype.setItem = () => { throw new Error('Authenticated mode wrote guest storage'); };
    });
    for (const [levelId, path] of [
        ['mission1_level2', '/mission1_level2.html'],
        ['agent_training_level2', '/agent_training_level2.html'],
        ['pico_level3', '/pico_level3.html'],
        ['pixelmuseum_briefing', '/pixelmuseum_briefing.html'],
        ['pixelmuseum_finale', '/pixelmuseum_finale.html'],
        ['helikopter_flucht_level1', '/helikopter_flucht_level1.html'],
        ['helikopter_flucht_level2', '/helikopter_flucht_level2.html'],
    ]) {
        const code = `# gespeichert: ${levelId}`;
        expect(await page.evaluate(({ levelId, code }) => window.AgentLearningData.recordAttempt(levelId, code), { levelId, code })).toBe(true);
        await mission(page, path);
        // Museum intentionally starts with the briefing; its saved finale is an explicit recovery action.
        if (levelId === 'pixelmuseum_finale') await page.locator('#restore-finale-attempt').click();
        await expect.poll(() => page.evaluate(() => window.editor?.getValue())).toBe(code);
    }
    expect(errors).toEqual([]);
});

test('login controls and dialog fit the school viewport and retain accessible labels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Passwort', { exact: true })).toBeVisible();
    for (const selector of ['.account-person', '.account-dialog']) {
        const bounds = await page.locator(selector).boundingBox();
        const viewport = page.viewportSize();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await page.screenshot({ path: test.info().outputPath('login-dialog.png') });
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeFocused();
});
