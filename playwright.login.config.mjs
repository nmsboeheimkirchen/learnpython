import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './tests/login-e2e', outputDir: '.cache/login-results', fullyParallel: false, workers: 1, timeout: 60000,
    expect: { timeout: 8000 }, forbidOnly: Boolean(process.env.CI),
    webServer: { command: 'node tests/login-test-server.mjs', url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 30000, stderr: 'ignore' },
    use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [
        { name: 'login-chromium', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } } },
        { name: 'login-webkit', use: { browserName: 'webkit', ...devices['iPad (gen 7)'] } }
    ]
});
