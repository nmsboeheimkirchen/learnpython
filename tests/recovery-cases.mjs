import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function recoveryTests({t,fixture,env,phpCall,BrowserSession,url,workerUrl,ids,password}) {
    const invoke=(action,input={})=>JSON.parse(fixture(action,input)||'{}');
    const group=JSON.parse(phpCall(['server/bin/manage.php','create-class'],env,{name:'Password recovery fixtures'}));
    const users=[];
    const makeUser=()=>{const user=JSON.parse(phpCall(['server/bin/manage.php','create-user'],env,{name:'Recovery test',email:`reset-${randomUUID()}@example.test`,password,classId:group.id}));users.push(user.id);ids.push(user.id);return user;};
    t.after(()=>fixture('cleanup',{ids:users,classId:group.id}));
    const session=async(endpoint=url)=>{const s=new BrowserSession(endpoint,url);await s.request('session');return s;};
    const request=async(s,user)=>{const response=await s.request('request-password-reset',{email:user.email});assert.equal(response.status,202);return response.data;};
    const tokenFor=user=>{invoke('mail-clear-attempts');const sent=invoke('mail-test',{count:10});const message=sent.messages.find(m=>m.to===user.email&&m.body.includes('#reset='));assert.ok(message.body.startsWith('Hallo Recovery test!\n\n'));return message.body.match(/#reset=([a-f0-9]{64})/)[1];};
    const next='Reset!888';
    const consume=(s,token)=>s.request('reset-password',{token,password:next,confirmation:next});

    await t.test('reset request is generic, CSRF-protected and does not duplicate queued mail or change an account',async()=>{
        const s=await session(),user=makeUser();
        const before=invoke('inspect',{id:user.id});
        const known=await request(s,user);
        assert.deepEqual(await request(s,{email:`unknown-${randomUUID()}@example.test`}),known);
        for(let i=0;i<4;i++)assert.deepEqual(await request(s,user),known);
        assert.deepEqual(invoke('inspect',{id:user.id}),before);
        const pending=invoke('reset-inspect',{email:user.email});assert.equal(pending.jobs.length,1);
        assert.equal(pending.reset.token_expires_at,0);assert.notEqual(pending.reset.token_hash,pending.jobs[0].token);
        assert.equal((await s.request('request-password-reset',{email:user.email},{headers:{'X-CSRF-Token':'wrong'}})).status,403);
        assert.equal((await s.request('reset-password')).status,405);
        assert.equal((await consume(s,pending.jobs[0].token)).status,422); // Not delivered yet.
        fixture('cleanup',{ids:[user.id]});
    });
    await t.test('reset consumes a token once, preserves progress, rejects old credentials and revokes all devices including legacy sessions',async()=>{
        const user=makeUser(),first=await session(),old=await session(workerUrl),anonymous=await session();
        await first.login(user.email);await old.login(user.email);
        fixture('session-legacy-epoch',{session:old.cookie.split('=')[1]});
        await first.write({type:'complete',levelId:'mission1_level1',code:'print("preserved")'},0);
        const before=(await first.request('state')).data.state;
        await request(anonymous,user);const token=tokenFor(user);
        assert.equal(invoke('reset-inspect',{email:user.email}).jobs[0].token,'');
        assert.equal((await anonymous.request('reset-password',{token,password:'1234567',confirmation:'1234567'})).data.error.code,'INVALID_NEW_PASSWORD');
        assert.equal((await anonymous.request('reset-password',{token,password:next,confirmation:'different'})).data.error.code,'PASSWORD_MISMATCH');
        assert.equal((await consume(anonymous,token)).status,200);
        assert.equal((await consume(anonymous,token)).data.error.code,'RESET_INVALID');
        assert.equal((await first.request('state')).status,401);assert.equal((await old.request('state')).status,401);
        assert.equal((await anonymous.request('session')).data.profile,null);
        assert.equal((await anonymous.request('login',{email:user.email,password})).status,401);
        assert.equal((await anonymous.request('login',{email:user.email,password:next})).status,200);
        assert.deepEqual((await anonymous.request('state')).data.state,before);
        invoke('mail-clear-attempts');const notices=invoke('mail-test',{count:10}).messages.filter(m=>m.to===user.email);
        assert.equal(notices.length,1);assert.ok(notices[0].body.startsWith('Hallo Recovery test!\n\n'));assert.match(notices[0].body,/Passwort.*zurueckgesetzt/);
        assert.ok(!notices[0].body.includes(next));assert.ok(!notices[0].body.includes(token));
    });
    await t.test('expired reset links fail and can be replaced; simultaneous consumption succeeds only once',async()=>{
        const user=makeUser(),s=await session(),other=await session(workerUrl);
        await request(s,user);const expired=tokenFor(user);invoke('reset-expire',{email:user.email});
        assert.equal((await consume(s,expired)).status,422);
        await request(s,user);const token=tokenFor(user);assert.notEqual(token,expired);
        const results=await Promise.all([consume(s,token),consume(other,token)]);
        assert.deepEqual(results.map(r=>r.status).sort(),[200,422]);
        invoke('mail-clear-attempts');invoke('mail-test',{count:10});
    });
    await t.test('recovery retries obey rolling quota and do not extend token life',async()=>{
        const user=makeUser(),s=await session();await request(s,user);
        invoke('mail-clear-attempts');const now=Math.floor(Date.now()/1000);
        const first=invoke('mail-test',{count:1,fail:true,now,perMinute:1});assert.equal(first.messages.length,1);
        const expiry=invoke('reset-inspect',{email:user.email}).reset.token_expires_at;
        assert.equal(expiry,now+3600);
        assert.equal(invoke('mail-test',{count:10,now:now+30,perMinute:1}).messages.length,0);
        const retried=invoke('mail-test',{count:10,now:now+61,perMinute:1});assert.equal(retried.messages.length,1);
        assert.equal(invoke('reset-inspect',{email:user.email}).reset.token_expires_at,expiry);
        const again=await request(s,user);assert.equal(again.accepted,true);
        assert.equal(invoke('reset-inspect',{email:user.email}).jobs.length,1);
        fixture('cleanup',{ids:[user.id]});
    });
    await t.test('verification and recovery compete for the same rolling minute and day budget',async()=>{
        const user=makeUser(),s=await session();await request(s,user);
        phpCall(['server/bin/manage.php','create-invitation'],env,{classId:group.id,code:'MIXED',expiresAt:Math.floor(Date.now()/1000)+86400});
        invoke('mail-seed',{classId:group.id,code:'MIXED',count:1});
        invoke('mail-clear-attempts');const now=Math.floor(Date.now()/1000);
        const first=invoke('mail-test',{now,count:10,perMinute:1,perDay:2});assert.equal(first.messages.length,1);
        assert.equal(invoke('mail-test',{now:now+59,count:10,perMinute:1,perDay:2}).messages.length,0);
        const second=invoke('mail-test',{now:now+60,count:10,perMinute:1,perDay:2});assert.equal(second.messages.length,1);
        const messages=[...first.messages,...second.messages];
        assert.equal(messages.filter(m=>m.body.includes('#reset=')).length,1);
        assert.equal(messages.filter(m=>m.body.includes('#verify=')).length,1);
        invoke('mail-seed',{classId:group.id,code:'MIXED',count:1});
        assert.equal(invoke('mail-test',{now:now+121,count:10,perMinute:1,perDay:2}).messages.length,0);
    });
}
