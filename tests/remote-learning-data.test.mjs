import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/data/remote-learning-data.js', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../assets/data/learning-data-core.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const initial = () => ({ revision: 0, data: { attemptedCodes: {}, completedCodes: {}, unlockedIds: ['link-level1'], featureProgress: {} } });
function harness(options = {}) {
    const window = { crypto: { randomUUID }, location: { href: 'https://example.test/mission.html' }, fetch };
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Guest store must never be accessed'); } });
    const context = vm.createContext({ window, URL, URLSearchParams, AbortController, setTimeout, clearTimeout });
    vm.runInContext(source + coreSource, context);
    const api = window.AgentPyRemoteLearningData;
    let server = initial();
    const writes = [];
    const receipts = new Set();
    let failAfterCommit = false;
    const client = { async request(action, request) {
        assert.equal(action, 'write'); assert.equal(request.profileId, 'profile-a');
        const body = clone(request.body); writes.push(body);
        if (!receipts.has(body.operationId)) {
            if (body.expectedRevision !== server.revision) throw api.error('REVISION_CONFLICT', 409);
            server.revision++;
            if (body.command.type === 'attempt') server.data.attemptedCodes[body.command.levelId] = body.command.code;
            if (body.command.type === 'complete') {
                server.data.completedCodes[body.command.levelId] = body.command.code;
                server.data.attemptedCodes[body.command.levelId] = body.command.code;
                server.data.unlockedIds.push('link-level2');
            }
            receipts.add(body.operationId);
        }
        if (failAfterCommit) { failAfterCommit = false; throw api.error('NETWORK_ERROR'); }
        return { profile: { id: 'profile-a' }, state: clone(server) };
    } };
    const stores = api.createRemoteLearningStores({ client, profile: { id: 'profile-a' }, csrfToken: 'token', initialState: server, ...options });
    const session = window.AgentLearningDataCore.createLearningSession({ context: { kind: 'authenticated', profileId: 'profile-a' }, ...stores });
    return { api, stores, session, client, writes, mutate: fn => fn(server), loseResponse: () => { failAfterCommit = true; } };
}
test('remote: serialized attempts and completions use confirmed revisions, not guest storage', async () => {
    const h = harness();
    const attempt = h.session.recordAttempt('mission1_level1', 'attempt');
    const completed = h.session.completeLevel({ levelId: 'mission1_level1', code: 'success' });
    assert.equal(await attempt, true); assert.equal(await completed, true);
    assert.deepEqual(h.writes.map(body => body.expectedRevision), [0, 1]);
    assert.equal(h.session.getCompletedCode('mission1_level1'), 'success');
    await h.session.recordAttempt('mission1_level1', 'new draft');
    assert.equal(h.session.getCompletedCode('mission1_level1'), 'success');
    const codes = h.session.getCompletedLevelCodes(); codes.mission1_level1 = 'tampered';
    assert.equal(h.session.getCompletedCode('mission1_level1'), 'success');
});
test('remote: lost response repeats identical operation; blocked writes cannot silently overtake it', async () => {
    const h = harness(); h.loseResponse();
    assert.equal(await h.session.completeLevel({ levelId: 'mission1_level1', code: 'success' }), false);
    assert.equal(h.session.getCompletedCode('mission1_level1'), null);
    assert.equal(h.stores.controls.hasUnconfirmed(), true);
    assert.equal(await h.session.recordAttempt('mission1_level1', 'later'), false);
    assert.equal(h.writes.length, 1);
    assert.equal((await h.stores.controls.retry()).ok, true);
    assert.deepEqual(h.writes[1], h.writes[0]);
    assert.equal(h.session.getCompletedCode('mission1_level1'), 'success');
});
test('remote: device conflict preserves snapshot and refuses automatic retry/overwrite', async () => {
    const h = harness(); h.mutate(server => { server.revision = 8; });
    assert.equal(await h.session.recordAttempt('mission1_level1', 'local'), false);
    assert.equal(h.session.getLastError().code, 'REVISION_CONFLICT');
    assert.equal((await h.stores.controls.retry()).ok, false);
    assert.equal(h.writes.length, 1);
});
test('remote: disposal invalidates in-flight responses and prevents queued requests', async () => {
    let finish;
    const h = harness({ client: { request: () => new Promise(resolve => { finish = resolve; }) } });
    const a = h.session.recordAttempt('mission1_level1', 'private');
    const b = h.session.recordAttempt('mission1_level1', 'also private');
    await Promise.resolve(); h.session.dispose();
    finish({ profile: { id: 'profile-a' }, state: initial() });
    assert.equal(await a, false); assert.equal(await b, false);
    assert.equal(h.session.getAttemptedCode('mission1_level1'), null);
});
test('remote: foreign or malformed responses never replace the loaded snapshot', async () => {
    for (const response of [{ profile: { id: 'profile-b' }, state: initial() }, { profile: { id: 'profile-a' }, state: {} }]) {
        const h = harness({ client: { request: async () => response } });
        assert.equal(await h.session.recordAttempt('mission1_level1', 'private'), false);
        assert.equal(h.session.getAttemptedCode('mission1_level1'), null);
    }
});
test('remote: completion-only mode is explicitly volatile and never reports attempt as centrally saved', async () => {
    const h = harness({ saveMode: 'completion-only' });
    assert.equal(await h.session.recordAttempt('mission1_level1', 'unfinished'), true);
    assert.equal(h.writes.length, 0);
    assert.equal(h.stores.controls.getStatus().type, 'local-only');
    assert.equal(h.session.getAttemptedCode('mission1_level1'), 'unfinished');
    assert.equal(await h.session.completeLevel({ levelId: 'mission1_level1', code: 'done' }), true);
    assert.equal(h.writes.length, 1);
    assert.equal(h.session.getAttemptedCode('mission1_level1'), 'done');
    assert.equal(h.stores.controls.hasUnconfirmed(), false);
});
test('remote HTTP: same-origin credentials, no redirects, CSRF/profile headers and no password persistence', async () => {
    const h = harness(); let sent;
    const client = h.api.createClient({ baseURL: 'https://example.test/mission.html', fetch: async (url, init) => {
        sent = { url, init }; return { ok: true, json: async () => ({ ok: true }) };
    } });
    await client.request('write', { body: { command: {} }, csrfToken: 'token', profileId: 'a' });
    assert.equal(sent.url, 'https://example.test/api/index.php?action=write');
    assert.equal(sent.init.credentials, 'same-origin'); assert.equal(sent.init.redirect, 'error');
    assert.equal(sent.init.headers['X-CSRF-Token'], 'token'); assert.equal(sent.init.headers['X-Agentpy-Profile'], 'a');
    assert.throws(() => h.api.createClient({ endpoint: 'https://foreign.test/api' }), /bestätigt/);
});

test('remote: explicit draft save in completion-only mode survives retry without completing or unlocking',async()=>{
    const h=harness({saveMode:'completion-only'});
    await h.session.recordAttempt('mission1_level1','old volatile');
    h.loseResponse();
    assert.equal((await h.stores.controls.saveDraft('mission1_level1','explicit draft')).ok,false);
    assert.equal(h.stores.controls.hasUnconfirmed(),true);
    assert.equal((await h.stores.controls.retry()).ok,true);
    assert.deepEqual(h.writes[0],h.writes[1]);
    assert.equal(h.session.getAttemptedCode('mission1_level1'),'explicit draft');
    assert.equal(h.session.getCompletedCode('mission1_level1'),null);
    assert.deepEqual([...h.session.getUnlockedLevelIds()],['link-level1']);
    assert.equal(h.stores.controls.hasUnconfirmed(),false);
});
test('remote HTTP: timeout and invalid JSON are not treated as saved', async () => {
    const h = harness();
    const client = h.api.createClient({ timeoutMs: 5, fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('abort')));
    }) });
    await assert.rejects(client.request('state'), failure => failure.code === 'NETWORK_ERROR');
    const malformed = h.api.createClient({ fetch: async () => ({ ok: true, status: 200, json: async () => { throw new Error('html'); } }) });
    await assert.rejects(malformed.request('state'), failure => failure.code === 'INVALID_RESPONSE');
});
