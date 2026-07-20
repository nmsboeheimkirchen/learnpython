import { defineConfig, devices } from "@playwright/test";

// Set PLAYWRIGHT_FULL_MATRIX=1 for the optional complete Chromium/WebKit regression run.
const fullBrowserMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === "1";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    timeout: 25_000,
    expect: { timeout: 6_000 },
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI ? "github" : "list",
    webServer: {
        command: "node tests/static-server.mjs",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 10_000
    },
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [
        {
            name: "chromium-school-laptop",
            use: {
                browserName: "chromium",
                viewport: { width: 1366, height: 768 }
            }
        },
        {
            name: "webkit-ipad",
            grep: fullBrowserMatrix ? undefined : /@ipad/,
            use: {
                browserName: "webkit",
                ...devices["iPad (gen 7)"]
            }
        }
    ]
});
