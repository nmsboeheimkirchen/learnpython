import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const localAdapter = join(repoRoot, "assets", "data", "local-learning-data.js");
const legacyKeys = [
    "unlockedLevels_v2",
    "completedLevelCode_v1",
    "attemptedLevelCode_v1",
    "pixelmuseumHelp_v1"
];

function filesBelow(directory, predicate) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return filesBelow(path, predicate);
        return predicate(path) ? [path] : [];
    });
}

test("productive browser storage access is confined to the local learning-data adapter", () => {
    const javascriptFiles = filesBelow(join(repoRoot, "assets"), path => path.endsWith(".js"));
    const violations = [];

    for (const path of javascriptFiles) {
        if (path === localAdapter) continue;
        const source = readFileSync(path, "utf8");
        if (/\blocalStorage\b/.test(source)) {
            violations.push(`${relative(repoRoot, path)} greift direkt auf localStorage zu`);
        }
        for (const key of legacyKeys) {
            if (source.includes(key)) {
                violations.push(`${relative(repoRoot, path)} kennt den Schlüssel ${key}`);
            }
        }
    }

    assert.deepEqual(violations, []);
    const adapterSource = readFileSync(localAdapter, "utf8");
    assert.match(adapterSource, /window\.localStorage/);
    legacyKeys.forEach(key => assert.match(adapterSource, new RegExp(key)));
});

test("every page using runner loads the core and local adapter first", () => {
    const htmlFiles = readdirSync(repoRoot, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(".html"))
        .map(entry => join(repoRoot, entry.name));
    const runnerPages = htmlFiles.filter(path => readFileSync(path, "utf8").includes("assets/runner.js"));

    assert.equal(runnerPages.length, 30, "Die bekannte Zahl produktiver Runner-Seiten hat sich geändert");
    for (const path of runnerPages) {
        const html = readFileSync(path, "utf8");
        const coreIndex = html.indexOf("assets/data/learning-data-core.js");
        const localIndex = html.indexOf("assets/data/local-learning-data.js");
        const runnerIndex = html.indexOf("assets/runner.js");
        assert.ok(coreIndex >= 0, `${relative(repoRoot, path)} lädt den Daten-Core nicht`);
        assert.ok(localIndex > coreIndex, `${relative(repoRoot, path)} lädt den lokalen Adapter zu früh`);
        assert.ok(runnerIndex > localIndex, `${relative(repoRoot, path)} lädt runner.js vor der Datenkapselung`);
    }
});

test("mission runtimes use one coordinated completion command", () => {
    const missionRuntimes = [
        "agent-training.js",
        "drone-mission.js",
        "helicopter-access.js",
        "helicopter-config.js",
        "pixelmuseum-path.js"
    ];

    for (const name of missionRuntimes) {
        const source = readFileSync(join(repoRoot, "assets", name), "utf8");
        assert.match(source, /completeLevelProgress/, `${name} verwendet den koordinierten Abschluss nicht`);
        assert.doesNotMatch(source, /saveCompletedLevelCode/, `${name} speichert Abschlusscode direkt`);
        assert.doesNotMatch(source, /unlockLevel\?\./, `${name} schaltet nach dem Abschluss einzeln frei`);
    }
});

test("feature progress and device settings also avoid direct browser-storage access", () => {
    const help = readFileSync(join(repoRoot, "assets", "pixelmuseum-briefing-help.js"), "utf8");
    const teacher = readFileSync(join(repoRoot, "assets", "teacher-solutions.js"), "utf8");

    assert.match(help, /AgentLearningData/);
    assert.match(help, /getFeatureProgress/);
    assert.match(help, /setFeatureProgress/);
    assert.doesNotMatch(help, /localStorage/);
    assert.match(teacher, /AgentDeviceSettings/);
    assert.doesNotMatch(teacher, /localStorage/);
});
