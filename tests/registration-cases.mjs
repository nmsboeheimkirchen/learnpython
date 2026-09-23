import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function registrationTests({ t, fixture, env, phpCall, BrowserSession, url, workerUrl, ids, password, userB }) {
    const invoke = (action, body = {}) => JSON.parse(fixture(action, body) || '{}');
    const classes = [];
    const newClass = (code) => {
        const group = JSON.parse(phpCall(['server/bin/manage.php', 'create-class'], env, { name: `Registration ${randomUUID()}` }));
        classes.push(group.id);
        phpCall(['server/bin/manage.php', 'create-invitation'], env, { classId: group.id, code, expiresAt: Math.floor(Date.now()/1000)+172800 });
        return group;
    };
    t.after(() => { for (const classId of classes) fixture('registration-clean-class', { classId }); });
    const group = newClass('CTEST');
    const session = async (endpoint = url) => { const s = new BrowserSession(endpoint, url); await s.request('session'); return s; };
    const allowed = async (endpoint = url, code = 'CTEST') => {
        const s = await session(endpoint);
        assert.equal((await s.request('check-invitation', { code })).status, 200); return s;
    };
    const details = () => ({ name: 'Synthetic registration', email: `${randomUUID()}@example.test`, password });
    await t.test('registration code failures persist across reload/cancel; cooldown allows other school sessions', async () => {
        const s = await session();
        for (let n=1; n<=4; n++) {
            const result = await s.request('check-invitation', { code: 'WRONG' });
            assert.equal(result.status, 422); assert.equal(result.data.error.attemptsLeft, 5-n);
            await s.request('session'); await s.request('cancel-registration', {});
        }
        assert.equal((await s.request('check-invitation', { code: 'WRONG' })).status, 429);
        assert.equal((await s.request('check-invitation', { code: 'CTEST' })).data.error.code, 'CLASS_CODE_COOLDOWN');
        await allowed();
        fixture('registration-expire-code-session', { session: s.cookie.split('=')[1] });
        assert.equal((await s.request('check-invitation', { code: 'ctest' })).status, 200);
    });
    await t.test('registration requires CSRF, guest identity and a live server grant, never a client class ID', async () => {
        const s = await session();
        assert.equal((await s.request('register', details())).status, 403);
        assert.equal((await s.request('check-invitation', { code: 'CTEST' }, { headers: { 'X-CSRF-Token':'bad' } })).status, 403);
        assert.equal((await s.request('check-invitation', { code: 'CTEST', classId:group.id })).status, 422);
        await s.request('check-invitation', { code: 'CTEST' });
        fixture('registration-grant-expire', { session:s.cookie.split('=')[1] });
        assert.equal((await s.request('register', details())).status,403);
        const valid = await allowed();
        assert.equal((await valid.request('register', {...details(),password:'1234567'})).data.error.code,'INVALID_NEW_PASSWORD');
        assert.equal((await valid.request('register', {...details(),name:'<script>text only</script>',classId:group.id})).status,422);
        await valid.login(userB.email);
        assert.equal((await valid.request('check-invitation',{code:'CTEST'})).status,409);
    });
    await t.test('registration queues one mail; verification activates once and exact code follows a second device', async () => {
        const s = await allowed(); const body = details();
        const response = await s.request('register',body);
        assert.equal(response.status,202); assert.equal(response.data.mailPolicy.perMinute,10);
        assert.equal((await s.request('register',body)).status,202);
        const existing = await invoke('registration-inspect',{email:body.email});
        assert.equal(existing.users,0); assert.equal(existing.jobs,1);
        assert.equal((await s.request('login',{email:body.email,password})).status,401);
        const sent = invoke('mail-test'); assert.equal(sent.messages.length,1);
        assert.ok(sent.messages[0].body.startsWith(`Hallo ${body.name}!\n\n`));
        const token = sent.messages[0].body.match(/#verify=([a-f0-9]{64})/)[1];
        assert.notEqual(existing.pending.token_hash,token);
        const device = await session(workerUrl);
        const results = await Promise.all([s.request('verify-email',{token}),device.request('verify-email',{token})]);
        assert.deepEqual(results.map(r=>r.status).sort(),[200,422]);
        assert.equal((await device.request('session')).data.profile,null);
        await s.login(body.email); ids.push(s.profile.id);
        const code='print("kept across devices")';
        assert.equal((await s.write({type:'complete',levelId:'mission1_level1',code},0)).status,200);
        await device.login(body.email);
        assert.equal((await device.request('state')).data.state.data.completedCodes.mission1_level1,code);
        const original = await invoke('registration-inspect',{email:body.email}); assert.equal(original.users,1); assert.equal(original.pending,false);
        assert.equal(invoke('registration-migrate-preserves').ok,true);
    });
    await t.test('last class seat is atomic across workers; expired reservations release seats', async () => {
        const capacityGroup = newClass('SEATS'); invoke('registration-capacity',{classId:capacityGroup.id,capacity:1});
        const a=await allowed(url,'SEATS'), b=await allowed(workerUrl,'SEATS');
        const da=details(), db=details();
        const results=await Promise.all([a.request('register',da),b.request('register',db)]);
        assert.deepEqual(results.map(r=>r.status).sort(),[202,409]);
        invoke('registration-expire',{email:results[0].status===202?da.email:db.email});
        assert.equal((await b.request('register',details())).status,202);
        // Clean pending fixture before queue tests; no accounts were activated here.
        fixture('registration-clean-class',{classId:capacityGroup.id}); classes.splice(classes.indexOf(capacityGroup.id),1);
    });
    await t.test('revoked invitations invalidate existing grants and unconsumed mail tokens', async () => {
        const revoked = newClass('REVOK'); const s=await allowed(url,'REVOK'); const body=details();
        assert.equal((await s.request('register',body)).status,202);
        invoke('mail-clear-attempts'); const sent=invoke('mail-test');
        const token=sent.messages[0].body.match(/#verify=([a-f0-9]{64})/)[1];
        phpCall(['server/bin/manage.php','revoke-invitation'],env,{code:'REVOK'});
        assert.equal((await s.request('verify-email',{token})).status,422);
        assert.equal((await s.request('register',details())).status,403);
        fixture('registration-clean-class',{classId:revoked.id}); classes.splice(classes.indexOf(revoked.id),1);
    });
    await t.test('32 mails persist across workers; rolling minute/day quotas, retry and policy changes agree', () => {
        const queue = newClass('QUEUE');
        invoke('mail-clear-attempts'); invoke('mail-seed',{classId:queue.id,code:'QUEUE',count:32});
        const now=Math.floor(Date.now()/1000);
        assert.equal(invoke('mail-test',{now,count:32}).messages.length,10);
        assert.equal(invoke('mail-test',{now:now+59,count:32}).messages.length,0);
        // A separate CLI process resumes the durable queue; failed sends still count.
        assert.equal(invoke('mail-test',{now:now+60,count:32,fail:true}).messages.length,10);
        const changed = invoke('mail-test',{now:now+120,count:32,perMinute:20,perDay:25});
        assert.equal(changed.messages.length,5); assert.equal(changed.policy.perMinute,20);
        assert.equal(invoke('mail-test',{now:now+181,count:32,perMinute:20,perDay:25}).messages.length,0);
        assert.equal(invoke('mail-test',{now:now+86401,count:32,perMinute:20,perDay:25}).messages.length,10);
        fixture('registration-clean-class',{classId:queue.id}); classes.splice(classes.indexOf(queue.id),1);
    });
    await t.test('parallel mail processes respect one shared quota and recover an abandoned lease', async () => {
        const queue = newClass('PARAL'); invoke('mail-clear-attempts');
        invoke('mail-seed',{classId:queue.id,code:'PARAL',count:32});
        const now=Math.floor(Date.now()/1000);
        assert.equal(invoke('mail-claim-crash',{now}).claimed,true);
        const portable=resolve('.cache/php-runtime/php-8.5.10/php.exe');
        const php=process.env.PHP_BINARY || (existsSync(portable)?portable:'php');
        const args=php===portable?['-n','-d',`extension_dir=${dirname(php)}/ext`,'-d','extension=pdo_sqlite','-d','extension=pdo_mysql']:[];
        const parallel=()=>new Promise((resolveDone,reject)=>{
            const child=spawn(php,[...args,'tests/backend-fixture.php','mail-test'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
            let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
            child.on('error',reject);child.on('close',code=>{ if(code!==0)reject(new Error(err));else resolveDone(JSON.parse(out)); });
            child.stdin.end(JSON.stringify({now,count:10}));
        });
        const results=await Promise.all([parallel(),parallel(),parallel()]);
        assert.equal(results.reduce((n,r)=>n+r.messages.length,0),9);
        assert.equal(invoke('mail-test',{now:now+301,count:32,perMinute:50}).messages.length,23);
        fixture('registration-clean-class',{classId:queue.id}); classes.splice(classes.indexOf(queue.id),1);
    });
    await t.test('default class capacity is 32 including reservations; expired verification tokens cannot activate accounts', async () => {
        const seats=newClass('LIMIT');invoke('mail-clear-attempts');
        invoke('mail-seed',{classId:seats.id,code:'LIMIT',count:31});
        const s=await allowed(url,'LIMIT');const body=details();
        assert.equal((await s.request('register',body)).status,202);
        assert.equal((await s.request('register',details())).data.error.code,'CLASS_FULL');
        const sent=invoke('mail-test',{count:32,perMinute:32});
        const token=sent.messages.find(m=>m.to===body.email).body.match(/#verify=([a-f0-9]{64})/)[1];
        invoke('registration-expire-token',{email:body.email});
        assert.equal((await s.request('verify-email',{token})).status,422);
        assert.equal(invoke('registration-inspect',{email:body.email}).users,0);
    });
}
