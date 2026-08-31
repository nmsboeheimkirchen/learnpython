import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the MIT license names the confirmed author", () => {
    const license = readProjectFile("LICENSE");
    assert.match(license, /^MIT License/);
    assert.match(license, /Copyright \(c\) 2026 Dipl\. Ing\. Michael Bieglmayer/);
    assert.doesNotMatch(license, /CybershoesVR/);
    assert.match(license, /Permission is hereby granted, free of charge/);
});

test("every homepage links the imprint at the bottom of its footer", () => {
    for (const page of ["index.html", "index-a.html", "index-b.html"]) {
        const html = readProjectFile(page);
        assert.match(
            html,
            /<\/main>\s*<footer\b[^>]*>[\s\S]*<a href="impressum\.html">Impressum<\/a>\s*<\/div>\s*<\/footer>\s*<\/body>/,
            `${page} must keep the imprint accessible without JavaScript`
        );
    }
});

test("the imprint shows only the supplied identity and address with a route home", () => {
    const html = readProjectFile("impressum.html");
    const address = html.match(/<address\b[^>]*>([\s\S]*?)<\/address>/)?.[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    assert.equal(address, "Dipl. Ing. Michael Bieglmayer Lehrer an der NMS Böheimkirchen Hochfeldgasse 5 3071 Böheimkirchen Österreich");
    assert.match(html, /<html lang="de">/);
    assert.match(html, /<title>Impressum – Python Agenten-Training<\/title>/);
    assert.match(html, /<h1 id="impressum-title">Impressum<\/h1>/);
    assert.match(html, /href="#impressum-main"/);
    assert.match(html, /<main id="impressum-main"/);
    assert.match(html, /href="index\.html">Zurück zur Startseite<\/a>/);
    assert.doesNotMatch(html, /<script\b|https?:\/\//i);
});
