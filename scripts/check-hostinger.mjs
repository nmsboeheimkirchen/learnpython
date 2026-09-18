// Read-only deployment healthcheck. Never print cookies or CSRF tokens.
import assert from 'node:assert/strict';

const [base = 'https://agentpy.bildungdigital.at', expectedRelease] = process.argv.slice(2);
const origin = new URL(base);
if (origin.protocol !== 'https:' || origin.origin !== base || !expectedRelease) throw new Error('Expected HTTPS origin and release ID.');
async function request(path, options = {}) {
    return fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
}
let stage = 'https-redirect';
try {
    const redirect = await fetch(`${base.replace('https:', 'http:')}/`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert.ok([301, 302, 307, 308].includes(redirect.status));
    assert.equal(redirect.headers.get('location'), `${base}/`);
    stage = 'release-and-cache';
    const release = await request(`/release.json?check=${encodeURIComponent(expectedRelease)}`);
    assert.equal(release.status, 200); assert.equal((await release.json()).releaseId, expectedRelease);
    const home = await request('/'); assert.equal(home.status, 200);
    assert.match(home.headers.get('cache-control') || '', /no-cache/);
    assert.match(await home.text(), new RegExp(`release=${expectedRelease}`));
    const config = await request('/assets/data/account-config.js'); assert.equal(config.status, 200);
    assert.match(config.headers.get('cache-control') || '', /no-cache/);
    assert.match(await config.text(), /"enabled":true/);
    stage = 'private-paths';
    for (const path of ['/agentpy-private/database-password.txt', '/agentpy-private/config.php', '/app/src/bootstrap.php', '/manifest.json', '/.htaccess']) {
        // HEAD only: even if the server were misconfigured, no secret body is downloaded.
        const response = await request(path, { method: 'HEAD' });
        assert.ok([403, 404].includes(response.status), 'Private path must not be served');
    }
    stage = 'session-cookies';
    const sessions = [];
    for (let i = 0; i < 2; i++) {
        const response = await request('/api/index.php?action=session');
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control') || '', /no-store/);
        assert.notEqual(response.headers.get('x-litespeed-cache'), 'hit');
        const cookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-agentpy_session='));
        assert.ok(cookie);
        for (const flag of [/;\s*secure(?:;|$)/i, /;\s*httponly(?:;|$)/i, /;\s*samesite=lax(?:;|$)/i, /;\s*path=\/(?:;|$)/i]) assert.match(cookie, flag);
        assert.doesNotMatch(cookie, /;\s*domain=/i);
        const body = await response.json(); assert.equal(body.profile, null); assert.match(body.csrfToken, /^[a-f0-9]{64}$/);
        sessions.push({ cookie: cookie.split(';')[0], csrf: body.csrfToken });
    }
    // Avoid assertion diagnostics containing session secrets on failure.
    if (sessions[0].cookie === sessions[1].cookie || sessions[0].csrf === sessions[1].csrf) throw new Error('Session isolation failed');
    stage = 'anonymous-state-denied';
    const protectedState = await request('/api/index.php?action=state'); assert.equal(protectedState.status, 401);
    assert.equal((await protectedState.json()).error.code, 'AUTH_REQUIRED');
    console.log(JSON.stringify({ ok: true, releaseId: expectedRelease, checks: ['https-redirect', 'release', 'html-js-cache', 'private-paths', 'secure-session-cookie', 'separate-sessions', 'anonymous-state-denied'] }));
} catch {
    console.error(`Hostinger healthcheck failed at ${stage}. Do not confirm this deployment; inspect status or roll back. No secrets logged.`);
    process.exitCode = 1;
}
