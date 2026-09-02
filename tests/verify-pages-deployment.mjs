import assert from "node:assert/strict";

const pagesUrl = process.env.PAGES_URL;
const expectedSha = process.env.EXPECTED_SHA;
const maxAttempts = 12;
const retryDelayMs = 5_000;

assert.ok(pagesUrl, "PAGES_URL fehlt.");
assert.match(expectedSha ?? "", /^[0-9a-f]{40}$/i, "EXPECTED_SHA muss ein vollständiger Git-Commit sein.");

function liveUrl(path) {
    const url = new URL(path, pagesUrl.endsWith("/") ? pagesUrl : pagesUrl + "/");
    url.searchParams.set("deployment", expectedSha);
    return url;
}

async function fetchLive(path) {
    const url = liveUrl(path);
    const response = await fetch(url, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(10_000)
    });
    assert.equal(response.status, 200, `${url.pathname} liefert HTTP ${response.status}.`);
    return response;
}

function requireText(source, expected, page) {
    assert.ok(source.includes(expected), `${page} enthält nicht: ${expected}`);
}

async function verifyDeployment() {
    const marker = (await (await fetchLive(`deploy-meta/${expectedSha}.txt`)).text()).trim();
    assert.equal(marker, expectedSha, `GitHub Pages liefert nicht den erwarteten Commit ${expectedSha}.`);

    const [landingResponse, levelResponse, artworkResponse] = await Promise.all([
        fetchLive("helikopter_flucht.html"),
        fetchLive("helikopter_flucht_level1.html"),
        fetchLive("assets/images/escape/helicopter-hangar-closed.webp")
    ]);
    const [landing, level] = await Promise.all([landingResponse.text(), levelResponse.text()]);

    requireText(landing, 'data-hangar-state="closed"', "helikopter_flucht.html");
    requireText(landing, "helicopter-hangar-closed.webp", "helikopter_flucht.html");
    requireText(landing, "öffne das Hangartor", "helikopter_flucht.html");
    requireText(landing, 'href="helikopter_flucht_level1.html"', "helikopter_flucht.html");
    assert.ok(!landing.includes("Zur Projektwahl"), "helikopter_flucht.html enthält weiterhin Zur Projektwahl.");
    assert.ok(!landing.includes("Hangartore verriegelt"), "helikopter_flucht.html beschreibt weiterhin das Verriegeln der Tore.");

    requireText(level, "Entsperre den Bordcomputer", "helikopter_flucht_level1.html");
    requireText(level, "signal = bordcomputer.receive()", "helikopter_flucht_level1.html");
    requireText(level, "passwort.replace", "helikopter_flucht_level1.html");
    assert.match(artworkResponse.headers.get("content-type") ?? "", /^image\/webp(?:;|$)/i);
}

let lastError;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
        await verifyDeployment();
        console.log(`GitHub Pages liefert Commit ${expectedSha} und beide Helikopter-Seiten korrekt aus.`);
        lastError = undefined;
        break;
    } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
            console.log(`Live-Prüfung ${attempt}/${maxAttempts} noch nicht erfolgreich: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }
}

if (lastError) {
    throw new Error(`GitHub Pages war nach ${maxAttempts} Versuchen nicht aktuell: ${lastError.message}`);
}
