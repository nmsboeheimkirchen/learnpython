import { expect, test } from "@playwright/test";

async function installStorageFaultSwitch(page) {
    await page.addInitScript(() => {
        const original = {
            getItem: Storage.prototype.getItem,
            removeItem: Storage.prototype.removeItem,
            setItem: Storage.prototype.setItem
        };

        for (const operation of Object.keys(original)) {
            Storage.prototype[operation] = function (...args) {
                const fault = window.__agentPyStorageFault;
                if (fault?.operation === operation && fault?.key === args[0]) {
                    throw new DOMException("Absichtlich simulierter Speicherfehler", fault.name);
                }
                return original[operation].apply(this, args);
            };
        }
    });
}

async function openLearningPage(page) {
    await page.goto("/mission1_level1.html");
    await expect.poll(() => page.evaluate(() => Boolean(window.AgentLearningData))).toBe(true);
}

test("@ipad a blocked browser-storage read has a safe fallback and keeps the old bytes", async ({ page }) => {
    await installStorageFaultSwitch(page);
    await openLearningPage(page);

    const result = await page.evaluate(() => {
        const key = "attemptedLevelCode_v1";
        const oldValue = JSON.stringify({ mission1_level1: "alter Code" });
        localStorage.setItem(key, oldValue);
        window.__agentPyStorageFault = { operation: "getItem", key, name: "SecurityError" };
        const value = window.AgentLearningData.getAttemptedCode("mission1_level1");
        const error = window.AgentLearningData.getLastError();
        window.__agentPyStorageFault = null;
        return { error, oldValue, storedValue: localStorage.getItem(key), value };
    });

    expect(result.value).toBeNull();
    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    expect(result.error.operation).toBe("read-attempted-code");
    expect(result.storedValue).toBe(result.oldValue);
    await expect(page.getByRole("alert")).toContainText("nicht gespeichert");
});

test("@ipad a quota failure during completion rolls back and cannot unlock a level", async ({ page }) => {
    await installStorageFaultSwitch(page);
    await openLearningPage(page);

    const result = await page.evaluate(async () => {
        const completedKey = "completedLevelCode_v1";
        const progressKey = "unlockedLevels_v2";
        const oldCodes = JSON.stringify({ mission1_level1: "bisheriger Code" });
        const oldProgress = JSON.stringify(["link-level1"]);
        localStorage.setItem(completedKey, oldCodes);
        localStorage.setItem(progressKey, oldProgress);
        window.__agentPyStorageFault = {
            operation: "setItem",
            key: progressKey,
            name: "QuotaExceededError"
        };
        const saved = await window.AgentLearningData.completeLevel({
            levelId: "mission2_level1",
            code: "neuer Code",
            unlockIds: ["link-m2-l2"]
        });
        const error = window.AgentLearningData.getLastError();
        window.__agentPyStorageFault = null;
        return {
            error,
            oldCodes,
            oldProgress,
            saved,
            storedCodes: localStorage.getItem(completedKey),
            storedProgress: localStorage.getItem(progressKey)
        };
    });

    expect(result.saved).toBe(false);
    expect(result.error.code).toBe("STORAGE_QUOTA_EXCEEDED");
    expect(result.storedCodes).toBe(result.oldCodes);
    expect(result.storedProgress).toBe(result.oldProgress);
    await expect(page.getByRole("alert")).toContainText("Browserspeicher ist voll");
});

test("@ipad a failed remove keeps the learner on the page and leaves unrelated data untouched", async ({ page }) => {
    await installStorageFaultSwitch(page);
    await openLearningPage(page);

    const pageUrl = page.url();
    const seeded = await page.evaluate(() => {
        const key = "completedLevelCode_v1";
        const oldValue = JSON.stringify({ mission1_level1: "behalten" });
        const oldProgress = JSON.stringify(["link-level1", "link-level2"]);
        localStorage.setItem(key, oldValue);
        localStorage.setItem("unlockedLevels_v2", oldProgress);
        localStorage.setItem("unrelated", "fremde Daten");
        window.__agentPyStorageFault = { operation: "removeItem", key, name: "SecurityError" };
        window.confirm = () => true;
        document.getElementById("reset-progress-btn").click();
        return { oldProgress, oldValue };
    });

    await expect(page.getByRole("alert")).toContainText("nicht vollständig zurückgesetzt");
    await expect.poll(() => page.evaluate(() => window.AgentLearningData.getLastError()?.code)).toBe(
        "STORAGE_UNAVAILABLE"
    );
    expect(page.url()).toBe(pageUrl);

    const result = await page.evaluate(() => {
        const key = "completedLevelCode_v1";
        const error = window.AgentLearningData.getLastError();
        window.__agentPyStorageFault = null;
        return {
            error,
            storedProgress: localStorage.getItem("unlockedLevels_v2"),
            storedValue: localStorage.getItem(key),
            unrelated: localStorage.getItem("unrelated")
        };
    });

    expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    expect(result.error.rollbackSucceeded).toBe(true);
    expect(result.storedProgress).toBe(seeded.oldProgress);
    expect(result.storedValue).toBe(seeded.oldValue);
    expect(result.unrelated).toBe("fremde Daten");
});

test("@ipad anonymous legacy data survives reload, normalizes and resets cleanly", async ({ page }) => {
    await openLearningPage(page);
    await page.evaluate(() => {
        localStorage.setItem("unlockedLevels_v2", JSON.stringify([
            "link-level1",
            "link-level2",
            "unknown-link"
        ]));
        localStorage.setItem("completedLevelCode_v1", JSON.stringify({
            mission1_level1: "erfolgreicher Code",
            unknown_level: "nicht übernehmen"
        }));
        localStorage.setItem("attemptedLevelCode_v1", JSON.stringify({
            mission1_level2: "letzter Versuch"
        }));
        localStorage.setItem("pixelmuseumHelp_v1", JSON.stringify({ used: 2 }));
        localStorage.setItem("unrelated", "bleibt erhalten");
    });

    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.AgentLearningData))).toBe(true);
    const restored = await page.evaluate(() => ({
        attempted: window.AgentLearningData.getAttemptedCode("mission1_level2"),
        completed: window.AgentLearningData.getCompletedCode("mission1_level1"),
        completedUnknown: window.AgentLearningData.getCompletedCode("unknown_level"),
        help: window.AgentLearningData.getFeatureProgress("pixelmuseum"),
        unlocks: window.AgentLearningData.getUnlockedLevelIds()
    }));
    expect(restored).toEqual({
        attempted: "letzter Versuch",
        completed: "erfolgreicher Code",
        completedUnknown: null,
        help: { used: 2 },
        unlocks: ["link-level1", "link-level2"]
    });

    expect(await page.evaluate(() => window.AgentLearningData.resetLearningData())).toBe(true);
    const afterReset = await page.evaluate(() => ({
        attempted: localStorage.getItem("attemptedLevelCode_v1"),
        completed: localStorage.getItem("completedLevelCode_v1"),
        help: localStorage.getItem("pixelmuseumHelp_v1"),
        unrelated: localStorage.getItem("unrelated"),
        unlocked: localStorage.getItem("unlockedLevels_v2")
    }));
    expect(afterReset).toEqual({
        attempted: null,
        completed: null,
        help: null,
        unrelated: "bleibt erhalten",
        unlocked: null
    });

    await page.reload();
    await expect.poll(() => page.evaluate(() => window.AgentLearningData.getUnlockedLevelIds())).toEqual([
        "link-level1"
    ]);
});
