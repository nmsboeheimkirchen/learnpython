// Anonymous browser smoke test against the explicitly selected pilot origin.
import { chromium, webkit, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = 'https://agentpy.bildungdigital.at';
const output = '.cache/hostinger-browser';
await mkdir(output, { recursive: true });
for (const [name, engine, options] of [
    ['chromium', chromium, { viewport: { width: 1366, height: 768 } }],
    ['webkit-ipad', webkit, devices['iPad (gen 7)']],
]) {
    const browser = await engine.launch();
    try {
        const context = await browser.newContext(options);
        const page = await context.newPage();
        let scriptErrors = 0;
        const failedAssets = [];
        page.on('pageerror', () => scriptErrors++);
        page.on('response', response => {
            if (response.url().startsWith(base + '/') && response.status() >= 400)
                failedAssets.push(new URL(response.url()).pathname);
        });
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        const account = page.getByRole('complementary', { name: 'Konto und Speicherung' });
        await expect(account.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
        await expect(page.locator('html')).not.toHaveClass(/account-blocked/);
        await account.getByRole('button', { name: 'Anmelden', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Am Schulkonto anmelden' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByLabel('E-Mail-Adresse')).toBeFocused();
        const box = await dialog.boundingBox();
        const viewport = page.viewportSize();
        if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height)
            throw new Error('Login dialog outside viewport');
        await page.screenshot({ path: `${output}/${name}-login.png` });
        await dialog.getByRole('button', { name: 'Abbrechen' }).click();
        await expect(dialog).toHaveCount(0);
        if (scriptErrors || failedAssets.length) throw new Error('Script or asset failures');
        console.log(JSON.stringify({ browser: name, ok: true, checks: ['home-assets', 'guest-ready', 'login-dialog', 'focus', 'dialog-fit', 'cancel'], screenshot: `${output}/${name}-login.png` }));
    } finally { await browser.close(); }
}
