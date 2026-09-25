import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { registrationTests } from './registration-cases.mjs';
import { recoveryTests } from './recovery-cases.mjs';
import { teacherTests } from './teacher-cases.mjs';
import { membershipTests } from './teacher-membership-cases.mjs';
import { rolesTests } from './roles-cases.mjs';
import { managementTests } from './management-cases.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portable = join(root, '.cache/php-runtime/php-8.5.10/php.exe');
const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php');
const phpArgs = php === portable
    ? ['-n', '-d', `extension_dir=${dirname(php)}/ext`, '-d', 'extension=pdo_sqlite', '-d', 'extension=pdo_mysql', '-d', 'extension=openssl']
    : [];
const password = 'Synthetic-test-passphrase-123!';
const backends = [{ name: 'SQLite', dsn: null }];
if (process.env.AGENTPY_TEST_MYSQL_DSN) {
    assert.match(process.env.AGENTPY_TEST_MYSQL_DSN, /dbname=[A-Za-z0-9_]*_test(?:;|$)/,
        'Use a dedicated database whose name ends in _test');
    backends.push({ name: 'MySQL/MariaDB', dsn: process.env.AGENTPY_TEST_MYSQL_DSN });
}

function phpCall(args, env, input = {}) {
    const result = spawnSync(php, [...phpArgs, ...args], {
        cwd: root, env, encoding: 'utf8', input: JSON.stringify(input), windowsHide: true,
    });
    assert.equal(result.status, 0, `PHP command failed: ${result.error?.message || result.stderr || result.stdout}`);
    return result.stdout;
}

async function freePort() {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolveClose => server.close(resolveClose));
    return port;
}

async function startServer(env, port) {
    const child = spawn(php, [...phpArgs, '-S', `127.0.0.1:${port}`, '-t', 'server/public'], {
        cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const url = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 80; attempt++) {
        if (child.exitCode !== null) throw new Error(`PHP exited: ${output}`);
        try {
            const response = await fetch(`${url}/api/index.php?action=session`);
            if (response.ok) return { child, url };
            throw new Error(`Unexpected startup response: ${response.status} ${await response.text()} ${output}`);
        } catch (error) {
            if (error.name !== 'TypeError') { child.kill(); throw error; }
        }
        await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
    child.kill();
    throw new Error(`PHP startup timed out: ${output}`);
}

class BrowserSession {
    constructor(url, origin = url) { this.url = url; this.origin = origin; this.cookie = ''; this.csrf = ''; this.profile = null; }
    async request(action, body, extra = {}) {
        const headers = { Cookie: this.cookie, ...extra.headers };
        if (body !== undefined) Object.assign(headers, {
            'Content-Type': 'application/json', Origin: this.origin, 'X-CSRF-Token': this.csrf, ...extra.headers,
        });
        if (this.profile && !Object.hasOwn(headers, 'X-Agentpy-Profile')) headers['X-Agentpy-Profile'] = this.profile.id;
        const response = await fetch(`${this.url}/api/index.php?action=${action}`, {
            method: body === undefined ? 'GET' : 'POST', headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        for (const cookie of response.headers.getSetCookie()) this.cookie = cookie.split(';')[0];
        const data = await response.json();
        if (data.csrfToken) this.csrf = data.csrfToken;
        if (Object.hasOwn(data, 'profile')) this.profile = data.profile;
        return { status: response.status, headers: response.headers, data };
    }
    async login(email) {
        await this.request('session');
        const result = await this.request('login', { email, password });
        assert.equal(result.status, 200, JSON.stringify(result.data));
        return result;
    }
    write(command, expectedRevision, operationId = randomUUID()) {
        return this.request('write', { command, expectedRevision, operationId });
    }
}

for (const backend of backends) {
    test(`real PHP API (${backend.name}): account isolation, saves and recovery`, async t => {
        mkdirSync(join(root, '.cache'), { recursive: true });
        const dir = mkdtempSync(join(root, '.cache/login-test-'));
        const sessions = join(dir, 'sessions');
        mkdirSync(sessions);
        const port = await freePort();
        const env = {
            ...process.env, AGENTPY_CONFIG: '', AGENTPY_ENVIRONMENT: 'development',
            AGENTPY_ORIGIN: `http://127.0.0.1:${port}`, AGENTPY_SESSION_PATH: sessions,
            AGENTPY_DSN: backend.dsn || `sqlite:${join(dir, 'test.sqlite')}`,
            AGENTPY_DB_USER: backend.dsn ? (process.env.AGENTPY_TEST_MYSQL_USER || '') : '',
            AGENTPY_DB_PASSWORD: backend.dsn ? (process.env.AGENTPY_TEST_MYSQL_PASSWORD || '') : '',
            AGENTPY_REGISTRATION_ENABLED: 'true', AGENTPY_MAIL_TRANSPORT: 'test', AGENTPY_MAIL_FROM: 'noreply@example.test',
            AGENTPY_PASSWORD_RESET_ENABLED: 'true',
        };
        const fixture = (action, input = {}) => phpCall(['tests/backend-fixture.php', action], env, input);
        const ids = [];
        await t.test('restricted rollout uses existing v2 accounts without registration tables or mail', async () => {
            fixture('init-v2-only');
            const disabled = {...env, AGENTPY_REGISTRATION_ENABLED:'false', AGENTPY_PASSWORD_RESET_ENABLED:'false', AGENTPY_MAIL_TRANSPORT:'disabled', AGENTPY_MAIL_FROM:''};
            const group = JSON.parse(phpCall(['server/bin/manage.php', 'create-class'], disabled, {name:'Restricted rollout'}));
            const user = JSON.parse(phpCall(['server/bin/manage.php', 'create-user'], disabled, {email:'restricted@example.test', password, name:'Existing learner', classId:group.id}));
            const {child, url} = await startServer(disabled, port);
            try {
                const client = new BrowserSession(url);
                assert.equal((await client.request('session')).data.registration.enabled, false);
                assert.equal((await client.request('session')).data.recovery.enabled, false);
                for(const action of ['request-password-reset','reset-password']) assert.equal((await client.request(action,{})).status,503);
                for (const action of ['check-invitation', 'register', 'verify-email']) {
                    const result = await client.request(action, {});
                    assert.equal(result.status, 503);
                    assert.equal(result.data.error.code, 'REGISTRATION_UNAVAILABLE');
                }
                await client.login(user.email);
                assert.equal(client.profile.name, 'Existing learner');
                assert.equal((await client.request('state')).data.state.revision, 0);
                const code = 'print("Existing account still saves")';
                assert.equal((await client.write({type:'complete', levelId:'mission1_level1', code},0)).status,200);
                assert.equal((await client.request('state')).data.state.data.completedCodes.mission1_level1,code);
                assert.equal((await client.request('logout',{})).status,200);
                assert.deepEqual(JSON.parse(fixture('inspect-v2-only')), {schema:2,hasRegistrationTables:false});
            } finally {
                const exited = once(child,'exit'); child.kill(); await exited;
                fixture('cleanup',{ids:[user.id],classId:group.id});
            }
        });
        await t.test('v2 migration rejects populated legacy databases, upgrades empty ones and repeats safely', () => {
            assert.equal(JSON.parse(fixture('test-profile-migration')).ok, true);
        });
        phpCall(['server/bin/manage.php', 'migrate'], env);
        const classInfo = JSON.parse(phpCall(['server/bin/manage.php', 'create-class'], env, { name: `Test ${randomUUID()}` }));
        const newUser = (overrides = {}) => {
            const email = `${randomUUID()}@example.test`;
            const user = JSON.parse(phpCall(['server/bin/manage.php', 'create-user'], env, { email, password, name: 'Synthetic learner', classId: classInfo.id, ...overrides }));
            ids.push(user.id);
            return user;
        };
        const userA = newUser();
        const userB = newUser();
        await t.test('additive v6 migration preserves populated accounts and learning states and repeats without confirming unverified email',()=>{
            assert.deepEqual(JSON.parse(fixture('test-membership-migration',{id:userA.id})),{ok:true,confirmed:false,version:8});
        });
        await t.test('additive v7 migration preserves populated v6 data, grants no roles and is idempotent',()=>{
            assert.deepEqual(JSON.parse(fixture('test-roles-migration')),{preserved:true,superadmins:0,version:8});
        });
        const { child, url } = await startServer(env, port);
        const children = [child];
        t.after(async () => {
            for (const process of children) {
                if (process.exitCode === null) { const exited = once(process, 'exit'); process.kill(); await exited; }
            }
            fixture('cleanup', { ids, classId: classInfo.id });
        });
        // Two actual PHP processes exercise database locking, even on Windows where
        // PHP_CLI_SERVER_WORKERS is unavailable. Both represent the same app origin.
        const worker2 = await startServer(env, await freePort());
        children.push(worker2.child);
        const a = new BrowserSession(url);
        const b = new BrowserSession(url);
        const laptop2 = new BrowserSession(worker2.url, url);

        await t.test('provisioning requires eight characters, a name and an existing class', async () => {
            const valid = { email: `${randomUUID()}@example.test`, password: 'Test!888', name: 'Synthetic learner', classId: classInfo.id };
            for (const input of [
                { ...valid, password: 'Short77' }, { ...valid, password: 'ä'.repeat(7) },
                { ...valid, password: 'x'.repeat(73) }, { ...valid, password: 'ab\0cdefgh' },
                { ...valid, name: '' }, { ...valid, name: 'x'.repeat(101) }, { ...valid, name: 'Bad\nname' },
                { ...valid, classId: null }, { ...valid, classId: '' }, { ...valid, classId: 'f'.repeat(32) },
                { email: valid.email, password: valid.password },
            ]) {
                const result = spawnSync(php, [...phpArgs, 'server/bin/manage.php', 'create-user'], { cwd: root, env, input: JSON.stringify(input), encoding: 'utf8', windowsHide: true });
                assert.equal(result.status, 1); assert.equal(result.stdout, '');
                assert.ok(!result.stderr.includes(String(input.password)));
            }
            for (const accepted of ['Test!888', 'ä'.repeat(8), 'x'.repeat(72)]) {
                const user = newUser({ password: accepted });
                const session = new BrowserSession(url); await session.request('session');
                const loggedIn = await session.request('login', { email: user.email, password: accepted });
                assert.equal(loggedIn.status, 200);
                assert.equal(loggedIn.data.profile.name, 'Synthetic learner');
                assert.equal(loggedIn.data.profile.classId, classInfo.id);
                assert.equal(loggedIn.data.profile.className, classInfo.name);
                assert.equal((await session.request('state')).data.state.revision, 0);
                assert.equal((await session.request('session')).data.profile.classId, classInfo.id);
            }
            assert.equal(JSON.parse(fixture('test-profile-constraints', { id: userA.id, classId: classInfo.id })).ok, true);
            const duplicate = spawnSync(php, [...phpArgs, 'server/bin/manage.php', 'create-user'], { cwd: root, env, input: JSON.stringify({ ...valid, email: userA.email }), encoding: 'utf8', windowsHide: true });
            assert.equal(duplicate.status, 1);
            const duplicateCheck = new BrowserSession(url);
            await duplicateCheck.login(userA.email); // Duplicate creation did not change password or class.
            assert.equal(duplicateCheck.profile.classId, classInfo.id);
        });

        await t.test('PHP sources lint and the backend course matches all browser unlocks', () => {
            const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
                entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
            for (const file of files(join(root, 'server')).filter(file => file.endsWith('.php'))) phpCall(['-l', file], env);
            const source = readFileSync(join(root, 'assets/runner.js'), 'utf8');
            const section = source.slice(source.indexOf('const LEVEL_OUTCOMES ='), source.indexOf('const LEVEL_CODE_INHERITANCE'));
            const context = vm.createContext({});
            vm.runInContext(`${section}; globalThis.outcomes = LEVEL_OUTCOMES;`, context);
            const expected = Object.fromEntries(Object.entries(context.outcomes).map(([id, value]) => [id, [...value.unlocks]]));
            assert.deepEqual(JSON.parse(fixture('course')), expected);
        });

        await t.test('anonymous reads are rejected; login requires origin and CSRF; cookie is protected', async () => {
            const anonymous = await a.request('session');
            assert.equal(anonymous.data.profile, null);
            assert.match(anonymous.headers.get('set-cookie'), /HttpOnly/i);
            assert.match(anonymous.headers.get('set-cookie'), /SameSite=Lax/i);
            assert.match(anonymous.headers.get('cache-control'), /no-store/);
            assert.equal((await a.request('state')).status, 401);
            assert.equal((await a.request('login', { email: userA.email, password }, { headers: { Origin: 'https://unrelated.test' } })).status, 403);
            assert.equal((await a.request('login', { email: userA.email, password }, { headers: { 'X-CSRF-Token': 'wrong' } })).status, 403);
            const oldCookie = a.cookie;
            await a.login(userA.email.toUpperCase());
            assert.notEqual(a.cookie, oldCookie, 'Login must rotate the session ID');
            const stored = JSON.parse(fixture('inspect', { id: userA.id })).password_hash;
            assert.match(stored, /^\$2y\$12\$/);
            assert.ok(!stored.includes(password));
            const oldSession = new BrowserSession(url);
            oldSession.cookie = oldCookie;
            oldSession.profile = userA;
            assert.equal((await oldSession.request('state')).status, 401);
        });

        await t.test('successful code and unlocks are restored on a second device; other accounts stay empty', async () => {
            assert.equal((await a.write({ type: 'attempt', levelId: 'mission1_level1', code: 'print("Versuch")' }, 0)).status, 200);
            const saved = await a.write({ type: 'complete', levelId: 'mission1_level1', code: 'print("Geschafft ✓")' }, 1);
            assert.equal(saved.status, 200);
            assert.equal(saved.data.state.revision, 2);
            assert.deepEqual(saved.data.state.data.unlockedIds, ['link-level1', 'link-level2']);
            await laptop2.login(userA.email);
            assert.deepEqual((await laptop2.request('state')).data.state, saved.data.state);
            await b.login(userB.email);
            assert.deepEqual((await b.request('state')).data.state.data.completedCodes, {});
            assert.equal((await b.request('state', undefined, { headers: { 'X-Agentpy-Profile': userA.id } })).status, 409);
            const injection = await b.request('write', {
                userId: userA.id, operationId: randomUUID(), expectedRevision: 0,
                command: { type: 'complete', levelId: 'mission1_level1', code: 'foreign' },
            });
            assert.equal(injection.status, 422);
            assert.equal((await a.request('state')).data.state.data.completedCodes.mission1_level1, 'print("Geschafft ✓")');
        });

        await t.test('profile edit changes only the authenticated display name and never learning state', async () => {
            const before = (await a.request('state')).data.state;
            const anonymous = new BrowserSession(url); await anonymous.request('session');
            assert.equal((await anonymous.request('update-profile', {name:'Denied'})).status,401);
            for(const name of ['', 'x'.repeat(101), 'Bad\nname', null]) {
                assert.equal((await a.request('update-profile',{name})).status,422);
            }
            assert.equal((await a.request('update-profile',{name:'No', email:userB.email})).status,422);
            assert.equal((await a.request('update-profile',{name:'No'}, {headers:{'X-Agentpy-Profile':userB.id}})).status,409);
            assert.equal((await a.request('update-profile',{name:'No'}, {headers:{'X-CSRF-Token':'wrong'}})).status,403);
            const updated = await a.request('update-profile',{name:'Änderung <b>Test</b>'});
            assert.equal(updated.status,200);
            assert.equal(updated.data.profile.name,'Änderung <b>Test</b>');
            assert.equal(updated.data.profile.email,userA.email);
            assert.equal(updated.data.profile.classId,classInfo.id);
            assert.equal((await b.request('session')).data.profile.name,userB.name);
            assert.deepEqual((await a.request('state')).data.state,before);
            await a.request('update-profile',{name:userA.name});
        });

        await t.test('stale devices conflict and retried requests do not replay old code over newer progress', async () => {
            const command = { type: 'attempt', levelId: 'mission1_level1', code: 'new version' };
            const operationId = randomUUID();
            assert.equal((await a.write(command, 2, operationId)).status, 200);
            assert.equal((await laptop2.write({ ...command, code: 'stale' }, 2)).data.error.code, 'REVISION_CONFLICT');
            const other = await a.write({ type: 'complete', levelId: 'mission1_level2', code: 'second level' }, 3);
            assert.equal(other.status, 200);
            const retry = await a.write(command, 2, operationId);
            assert.equal(retry.status, 200);
            assert.equal(retry.data.replayed, true);
            assert.deepEqual(retry.data.state, other.data.state);
            assert.equal((await a.write({ ...command, code: 'different' }, 2, operationId)).data.error.code, 'OPERATION_ID_REUSED');
            assert.equal(other.data.state.data.completedCodes.mission1_level1, 'print("Geschafft ✓")', 'A later attempt must preserve the successful solution');
        });

        await t.test('a failure after the state update rolls back both code and unlocks; retry safely succeeds', async () => {
            const before = (await a.request('state')).data.state;
            const operationId = randomUUID();
            const command = { type: 'complete', levelId: 'mission1_level3', code: 'atomic completion' };
            fixture('receipt-failure');
            try {
                const failed = await a.write(command, before.revision, operationId);
                assert.equal(failed.status, 503);
                assert.equal(failed.data.error.code, 'SERVER_UNAVAILABLE');
                assert.deepEqual((await a.request('state')).data.state, before);
            } finally { fixture('clear-failure'); }
            assert.equal((await a.write(command, before.revision, operationId)).status, 200);
        });

        await t.test('invalid and oversized writes cannot change progress or grant arbitrary unlocks', async () => {
            const before = (await a.request('state')).data.state;
            for (const command of [
                { type: 'complete', levelId: '__proto__', code: '' },
                { type: 'complete', levelId: 'mission1_level1', code: 'x'.repeat(32769) },
                { type: 'complete', levelId: 'mission1_level1', code: '', unlockIds: ['all'] },
                { type: 'made-up' },
            ]) assert.equal((await a.write(command, before.revision)).status, 422);
            const oversized = await a.write({ type: 'attempt', levelId: 'mission1_level1', code: 'x'.repeat(70000) }, before.revision);
            assert.equal(oversized.status, 413);
            assert.deepEqual((await a.request('state')).data.state, before);
        });

        await t.test('help progress and explicit skip links survive device changes without completing a level', async () => {
            let before = (await a.request('state')).data.state;
            const value = { version: 1, count: 2, levels: { KEYCARD_MISSING: 2 } };
            assert.equal((await a.write({ type: 'feature', featureId: 'pixelmuseum', value }, before.revision)).status, 200);
            assert.deepEqual((await laptop2.request('state')).data.state.data.featureProgress.pixelmuseum, value);
            before = (await a.request('state')).data.state;
            assert.equal((await a.write({ type: 'unlocks', unlockIds: ['link-m3-title', 'link-m3-l1'] }, before.revision)).status, 200);
            const after = (await a.request('state')).data.state;
            assert.deepEqual(after.data.completedCodes, before.data.completedCodes);
            assert.ok(after.data.unlockedIds.includes('link-m3-l1'));
            for (const command of [
                { type: 'unlocks', unlockIds: ['foreign'] },
                { type: 'feature', featureId: 'foreign', value },
                { type: 'feature', featureId: 'pixelmuseum', value: { ...value, count: 99 } },
                { type: 'feature', featureId: 'pixelmuseum', value: { version: 1, count: 1, levels: { MADE_UP: 1 } } },
            ]) assert.equal((await a.write(command, after.revision)).status, 422);
            assert.deepEqual((await a.request('state')).data.state, after);
        });

        await t.test('two devices saving the same revision produce one success and one conflict', async () => {
            const before = (await a.request('state')).data.state;
            const results = await Promise.all([
                a.write({ type: 'attempt', levelId: 'mission1_level2', code: 'device A' }, before.revision),
                laptop2.write({ type: 'attempt', levelId: 'mission1_level2', code: 'device B' }, before.revision),
            ]);
            assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
            const winner = results.find(result => result.status === 200);
            assert.deepEqual((await a.request('state')).data.state, winner.data.state);
        });

        await t.test('simultaneous retries through two PHP workers commit exactly once', async () => {
            const before = (await a.request('state')).data.state;
            const command = { type: 'complete', levelId: 'mission2_level1', code: 'one completion' };
            const id = randomUUID();
            const results = await Promise.all([
                a.write(command, before.revision, id), laptop2.write(command, before.revision, id),
            ]);
            assert.deepEqual(results.map(result => result.status), [200, 200]);
            assert.deepEqual(results.map(result => result.data.replayed).sort(), [false, true]);
            assert.equal((await a.request('state')).data.state.revision, before.revision + 1);
        });

        await t.test('logout and account switch reject old tabs, cookies and CSRF tokens', async () => {
            const old = new BrowserSession(url);
            Object.assign(old, { cookie: a.cookie, csrf: a.csrf, profile: a.profile });
            assert.equal((await a.request('logout', {})).status, 200);
            assert.equal((await old.request('state')).status, 401);
            await a.login(userB.email);
            assert.equal((await a.request('state', undefined, { headers: { 'X-Agentpy-Profile': userA.id } })).status, 409);
            assert.equal((await a.write({ type: 'reset' }, 0)).status, 200);
            assert.ok(Object.keys((await laptop2.request('state')).data.state.data.completedCodes).length > 0);
            assert.equal((await a.request('logout', {}, { headers: { 'X-CSRF-Token': old.csrf } })).status, 403);
        });

        await t.test('fifteen distinct accounts can sign in through the same school IP', async () => {
            const users = Array.from({ length: 15 }, newUser);
            const results = await Promise.all(users.map(async user => {
                const client = new BrowserSession(url);
                return client.login(user.email);
            }));
            assert.ok(results.every(result => result.status === 200));
        });

        await t.test('repeated wrong passwords are limited; unknown accounts give the same response', async () => {
            const client = new BrowserSession(url);
            await client.request('session');
            const user = newUser();
            const wrong = await client.request('login', { email: user.email, password: 'incorrect' });
            const unknown = await client.request('login', { email: `${randomUUID()}@example.test`, password: 'incorrect' });
            assert.deepEqual(wrong.data, unknown.data);
            for (let index = 0; index < 9; index++) {
                assert.equal((await client.request('login', { email: user.email, password: 'incorrect' })).status, 401);
            }
            const limited = await client.request('login', { email: user.email, password: 'incorrect' });
            assert.equal(limited.status, 429);
            assert.equal(limited.headers.get('retry-after'), '900');
        });

        await t.test('an expired session must reauthenticate before it can read or save', async () => {
            const user = newUser();
            const client = new BrowserSession(url);
            await client.login(user.email);
            fixture('expire-session', { session: client.cookie.split('=')[1] });
            assert.equal((await client.request('state')).status, 401);
            assert.equal((await client.request('session')).data.profile, null);
        });

        await registrationTests({ t, fixture, env, phpCall, BrowserSession, url, workerUrl: worker2.url, ids, password, userB });
        await recoveryTests({t,fixture,env,phpCall,BrowserSession,url,workerUrl:worker2.url,ids,password});
        await teacherTests({t,fixture,env,phpCall,BrowserSession,url,workerUrl:worker2.url,ids,password,newUser});
        await membershipTests({t,fixture,BrowserSession,url,workerUrl:worker2.url,ids,password,newUser});
        await rolesTests({t,fixture,BrowserSession,url,ids,password,newUser});
        await managementTests({t,fixture,BrowserSession,url,workerUrl:worker2.url,ids,password,newUser});

        await t.test('broken saved data is an error, never an empty account; disabled users lose access', async () => {
            fixture('corrupt-state', { id: userB.id });
            assert.equal((await b.request('state')).status, 503);
            fixture('deactivate', { id: userA.id });
            assert.equal((await laptop2.request('state')).status, 401);
        });
    });
}
