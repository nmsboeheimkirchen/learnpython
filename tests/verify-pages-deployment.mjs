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

    const [
        landingResponse,
        levelOneResponse,
        levelTwoResponse,
        closedArtworkResponse,
        openArtworkResponse
    ] = await Promise.all([
        fetchLive("helikopter_flucht.html"),
        fetchLive("helikopter_flucht_level1.html"),
        fetchLive("helikopter_flucht_level2.html"),
        fetchLive("assets/images/escape/helicopter-hangar-closed.webp"),
        fetchLive("assets/images/escape/helicopter-hangar-final.webp")
    ]);
    const [landing, levelOne, levelTwo] = await Promise.all([
        landingResponse.text(),
        levelOneResponse.text(),
        levelTwoResponse.text()
    ]);

    requireText(landing, 'data-hangar-state="closed"', "helikopter_flucht.html");
    requireText(landing, "helicopter-hangar-closed.webp", "helikopter_flucht.html");
    requireText(landing, "öffne das Hangartor", "helikopter_flucht.html");
    requireText(landing, 'href="helikopter_flucht_level1.html"', "helikopter_flucht.html");
    assert.ok(!landing.includes("Zur Projektwahl"), "helikopter_flucht.html enthält weiterhin Zur Projektwahl.");
    assert.ok(!landing.includes("Hangartore verriegelt"), "helikopter_flucht.html beschreibt weiterhin das Verriegeln der Tore.");

    requireText(levelOne, "Entsperre den Bordcomputer", "helikopter_flucht_level1.html");
    requireText(levelOne, "signal = bordcomputer.receive()", "helikopter_flucht_level1.html");
    requireText(levelOne, "passwort.replace", "helikopter_flucht_level1.html");
    requireText(levelOne, "256 zufällige Passwortzeichen", "helikopter_flucht_level1.html");
    requireText(levelOne, "255 <code>?</code>", "helikopter_flucht_level1.html");
    requireText(levelOne, "Sonderzeichen", "helikopter_flucht_level1.html");
    requireText(levelOne, 'href="helikopter_flucht_level2.html"', "helikopter_flucht_level1.html");
    requireText(levelOne, "Nächster Auftrag", "helikopter_flucht_level1.html");
    assert.ok(!levelOne.includes("Das Passwort darf nicht im Klartext"), "Das alte Klartextverbot ist noch veröffentlicht.");

    requireText(levelTwo, "Öffne Zugang und Hangartor", "helikopter_flucht_level2.html");
    requireText(levelTwo, "Notzugang hergestellt. Startkonfiguration unvollständig. Manueller Systemstart erforderlich.", "helikopter_flucht_level2.html");
    requireText(levelTwo, "heli_config.json", "helikopter_flucht_level2.html");
    requireText(levelTwo, '"heli": {', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"zugang_offen": false', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"cockpit": {', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"hauptdisplay_online": true', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"navigation_online": false', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"rotor_online": false', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"hangar": {', "helikopter_flucht_level2.html");
    requireText(levelTwo, '"tor_offen": false', "helikopter_flucht_level2.html");
    requireText(levelTwo, "helicopter-hangar-closed.webp", "helikopter_flucht_level2.html");
    requireText(levelTwo, "helicopter-hangar-final.webp", "helikopter_flucht_level2.html");
    requireText(levelTwo, "assets/helicopter-config-core.js", "helikopter_flucht_level2.html");
    requireText(levelTwo, "assets/helicopter-config.js", "helikopter_flucht_level2.html");
    assert.ok(!levelTwo.includes("json.loads"), "Die reine JSON-Einstiegsstufe greift json.loads() vor.");

    assert.match(closedArtworkResponse.headers.get("content-type") ?? "", /^image\/webp(?:;|$)/i);
    assert.match(openArtworkResponse.headers.get("content-type") ?? "", /^image\/webp(?:;|$)/i);
}

let lastError;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
        await verifyDeployment();
        console.log(`GitHub Pages liefert Commit ${expectedSha}, alle drei Helikopter-Seiten und beide Hangarbilder korrekt aus.`);
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
