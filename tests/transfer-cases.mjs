import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Runs through the real API in disposable SQLite AND the CI MariaDB database.
export async function transferTests({t,fixture,BrowserSession,url,workerUrl,newUser}){
    const people=[];
    const make=async(teacher=true,options={})=>{
        const u=newUser({email:`transfer-${randomUUID()}@school.test`,...options});
        if(teacher)fixture('teacher-grant',{id:u.id,limit:10});
        const s=new BrowserSession(url);await s.login(u.email);const person={u,s};people.push(person);return person;
    };
    const owner=await make(),targetOwner=await make(),co=await make(),outsider=await make();
    const create=async(person,label)=>{
        const r=await person.s.request('teacher-create-class',{name:`Transfer ${label} ${randomUUID()}`});
        assert.equal(r.status,200,JSON.stringify(r.data));return r.data.class;
    };
    const a=await create(owner,'A'),b=await create(owner,'B'),c=await create(targetOwner,'C');
    const snapshot=id=>JSON.parse(fixture('transfer-user-snapshot',{id}));
    const list=async(person)=>(await person.s.request('teacher-transfers')).data.requests;
    const send=(person,pupil,source,target,mode='move',foreign=false)=>person.s.request('teacher-transfer-student',{
        classId:source.id,memberId:pupil.u.id,targetClassId:foreign?'':target.id,code:foreign?target.invitation.code:'',mode});
    const decide=(person,id,decision)=>person.s.request('teacher-decide-transfer',{requestId:id,decision});
    try{
        await t.test('v9 transfer migration is additive, preserves populated data and is idempotent',()=>{
            assert.deepEqual(JSON.parse(fixture('test-transfer-migration')),{preserved:true,version:9});
        });
        const pupil=await make(false,{classId:a.id});
        await pupil.s.write({type:'complete',levelId:'mission1_level1',code:'print("preserve transfer")'},0);
        await t.test('own-class move/add keeps identity, credentials, verification, learning state and unrelated memberships',async()=>{
            fixture('membership-add',{id:pupil.u.id,classId:c.id});
            const before=snapshot(pupil.u.id);
            const r=await send(owner,pupil,a,b);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.pending,false);
            let after=snapshot(pupil.u.id);assert.equal(after.primary,b.id);assert.equal(after.preservedHash,before.preservedHash);
            assert.deepEqual(new Set(after.classes),new Set([b.id,c.id]));
            assert.equal((await pupil.s.request('state')).data.state.data.completedCodes.mission1_level1,'print("preserve transfer")');
            assert.equal((await send(owner,pupil,b,a,'add')).status,200);
            after=snapshot(pupil.u.id);assert.equal(after.primary,b.id);assert.equal(after.preservedHash,before.preservedHash);
            assert.deepEqual(new Set(after.classes),new Set([a.id,b.id,c.id]));
            assert.equal((await send(owner,pupil,b,a,'add')).status,200,'additional assignment is safe to repeat');
            assert.equal(snapshot(pupil.u.id).classes.length,3);
        });
        await t.test('owner-only transfer, CSRF, valid foreign code and pupil-only membership are enforced',async()=>{
            await owner.s.request('teacher-add-teacher',{classId:a.id,email:co.u.email});
            assert.equal((await send(co,pupil,a,b)).status,404);
            assert.equal((await send(outsider,pupil,a,c,'add',true)).status,404);
            assert.equal((await send(pupil,pupil,a,b)).status,403);
            assert.equal((await send(owner,pupil,a,c)).status,404,'foreign ID is not sufficient');
            assert.equal((await send(owner,pupil,a,a)).data.error.code,'SAME_CLASS');
            assert.equal((await owner.s.request('teacher-transfer-student',{classId:a.id,memberId:pupil.u.id,targetClassId:b.id,code:'',mode:'move'},{headers:{'X-CSRF-Token':'wrong'}})).status,403);
            const promoted=await make(true,{classId:a.id});
            assert.equal((await send(owner,promoted,a,b)).data.error.code,'MEMBER_NOT_FOUND');
            const noMember=await make(false);
            assert.equal((await send(owner,noMember,a,b)).data.error.code,'MEMBER_NOT_FOUND');
            assert.equal((await owner.s.request('teacher-transfer-targets',{classId:a.id})).data.classes.some(x=>x.id===c.id),false);
        });
        const foreignPupil=await make(false,{classId:a.id});
        await t.test('foreign request reveals identity only to involved owners, expires in ten days and cannot self-approve',async()=>{
            const before=snapshot(foreignPupil.u.id),start=Math.floor(Date.now()/1000);
            let r=await send(owner,foreignPupil,a,c,'move',true);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.pending,true);
            assert.deepEqual(snapshot(foreignPupil.u.id),before);
            let incoming=(await list(targetOwner)).find(x=>x.email===foreignPupil.u.email);
            assert.ok(incoming.incoming);assert.ok(incoming.expiresAt>=start+864000&&incoming.expiresAt<=Math.floor(Date.now()/1000)+864000);
            assert.equal((await list(owner)).find(x=>x.id===incoming.id).incoming,false);
            assert.deepEqual(await list(co),[]);assert.deepEqual(await list(outsider),[]);
            assert.doesNotMatch(JSON.stringify(incoming),/password|token|completedCodes|attemptedCodes/);
            assert.equal((await decide(owner,incoming.id,'accept')).status,404);
            assert.equal((await decide(co,incoming.id,'accept')).status,404);
            assert.equal((await decide(targetOwner,incoming.id,'cancel')).status,404);
            r=await send(owner,foreignPupil,a,c,'move',true);assert.equal(r.status,200);
            assert.deepEqual((await list(targetOwner)).find(x=>x.id===incoming.id),incoming,'retry does not extend expiry');
            assert.equal((await send(owner,foreignPupil,a,c,'add',true)).data.error.code,'TRANSFER_ALREADY_PENDING');
            assert.equal((await decide(targetOwner,incoming.id,'accept')).status,200);
            assert.equal((await decide(targetOwner,incoming.id,'accept')).status,404);
            const after=snapshot(foreignPupil.u.id);assert.equal(after.primary,c.id);assert.deepEqual(after.classes,[c.id]);assert.equal(after.preservedHash,before.preservedHash);
        });
        await t.test('capacity is checked atomically at approval; pending signups reserve seats, transfer requests do not',async()=>{
            const d=await create(targetOwner,'capacity');
            fixture('registration-capacity',{classId:d.id,capacity:1});
            fixture('mail-seed',{classId:d.id,code:d.invitation.code,count:1});
            const r=await send(owner,pupil,a,d,'add',true);assert.equal(r.status,200);
            const request=(await list(targetOwner)).find(x=>x.email===pupil.u.email);
            assert.equal((await decide(targetOwner,request.id,'accept')).data.error.code,'CLASS_FULL');
            assert.ok((await list(targetOwner)).some(x=>x.id===request.id),'rollback preserves request');
            assert.ok(!snapshot(pupil.u.id).classes.includes(d.id));
            fixture('registration-capacity',{classId:d.id,capacity:2});
            assert.equal((await decide(targetOwner,request.id,'accept')).status,200);
            const before=snapshot(pupil.u.id);
            fixture('registration-capacity',{classId:b.id,capacity:1});
            assert.equal((await send(owner,pupil,a,b)).status,200,'already in full target needs no extra seat');
            assert.equal(snapshot(pupil.u.id).preservedHash,before.preservedHash);
        });
        await t.test('decline, cancellation, expired requests and expired codes never change memberships',async()=>{
            const p=await make(false,{classId:a.id}),before=snapshot(p.u.id);
            for(const decision of ['decline','cancel']){
                assert.equal((await send(owner,p,a,c,'add',true)).status,200);
                const request=(await list(targetOwner)).find(x=>x.email===p.u.email);
                assert.equal((await decide(decision==='decline'?targetOwner:owner,request.id,decision)).status,200);
                assert.deepEqual(snapshot(p.u.id),before);
            }
            await send(owner,p,a,c,'add',true);const expired=(await list(targetOwner)).find(x=>x.email===p.u.email);
            fixture('transfer-expire',{id:expired.id});assert.equal((await decide(targetOwner,expired.id,'accept')).status,404);assert.deepEqual(snapshot(p.u.id),before);
            const d=await create(targetOwner,'expired-code');fixture('teacher-expire',{classId:d.id});
            assert.equal((await send(owner,p,a,d,'add',true)).data.error.code,'CLASS_CODE_INVALID');
        });
        await t.test('ownership change and source membership removal cancel stale requests',async()=>{
            const p=await make(false,{classId:a.id});fixture('membership-add',{id:p.u.id,classId:b.id});
            await send(owner,p,a,c,'move',true);const first=(await list(targetOwner)).find(x=>x.email===p.u.email);
            await owner.s.request('teacher-delete-member',{classId:a.id,memberId:p.u.id,kind:'user'});
            assert.equal((await decide(targetOwner,first.id,'accept')).status,404);assert.equal(snapshot(p.u.id).primary,b.id);
            await send(owner,p,b,c,'add',true);const second=(await list(targetOwner)).find(x=>x.email===p.u.email);
            await targetOwner.s.request('teacher-add-teacher',{classId:c.id,email:co.u.email});
            assert.equal((await targetOwner.s.request('teacher-transfer-class',{classId:c.id,memberId:co.u.id})).status,200);
            assert.equal((await decide(co,second.id,'accept')).status,404);
            assert.deepEqual(JSON.parse(fixture('transfer-inspect',{id:p.u.id})),[]);
        });
        await t.test('two workers accepting for one free seat admit exactly one pupil without data loss',async()=>{
            const d=await create(targetOwner,'race');fixture('registration-capacity',{classId:d.id,capacity:1});
            const p=await make(false,{classId:a.id}),q=await make(false,{classId:a.id});
            await send(owner,p,a,d,'move',true);await send(owner,q,a,d,'move',true);
            const pending=(await list(targetOwner)).filter(x=>[p.u.email,q.u.email].includes(x.email));assert.equal(pending.length,2);
            const other=new BrowserSession(workerUrl,url);await other.login(targetOwner.u.email);
            const results=await Promise.all([decide(targetOwner,pending[0].id,'accept'),other.request('teacher-decide-transfer',{requestId:pending[1].id,decision:'accept'})]);
            assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
            const states=[snapshot(p.u.id),snapshot(q.u.id)];assert.equal(states.filter(s=>s.primary===d.id).length,1);assert.equal(states.filter(s=>s.primary===a.id).length,1);
            assert.equal((await list(targetOwner)).filter(x=>[p.u.email,q.u.email].includes(x.email)).length,1);
        });
    }finally{for(const {u} of people)fixture('teacher-clean',{id:u.id});}
}
