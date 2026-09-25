import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function rolesTests({t,fixture,BrowserSession,url,ids,password,newUser}){
    const adminUser=newUser({email:`admin-${randomUUID()}@staff.test`}),ownerUser=newUser({email:`owner-${randomUUID()}@staff.test`}),existing=newUser({email:`existing-${randomUUID()}@staff.test`});
    fixture('teacher-grant',{id:adminUser.id,limit:10});fixture('admin-grant',{id:adminUser.id});fixture('teacher-grant',{id:ownerUser.id,limit:10});
    const admin=new BrowserSession(url),owner=new BrowserSession(url),guest=new BrowserSession(url),student=new BrowserSession(url);
    await admin.login(adminUser.email);await owner.login(ownerUser.email);await student.login(existing.email);await guest.request('session');
    let room,promoted,newTeacher;
    const invitation=async email=>{const r=await admin.request('admin-invite-teacher',{email,classLimit:10});assert.equal(r.status,200,JSON.stringify(r.data));return JSON.parse(fixture('teacher-invite-token',{email})).token;};
    const accept=async(token,session=guest)=>session.request('accept-teacher-invitation',{token,name:'New Teacher',password,confirmation:password});
    try{
        room=(await owner.request('teacher-create-class',{name:'Shared role fixture'})).data.class;
        await t.test('only superadmin can list/invite teachers; invitations are queued, idempotent and never implicitly elevate',async()=>{
            assert.equal(admin.profile.superadmin,true);assert.equal(owner.profile.superadmin,false);
            for(const session of [owner,student,guest])assert.ok([401,403].includes((await session.request('admin-teachers')).status));
            assert.equal((await owner.request('admin-invite-teacher',{email:existing.email,classLimit:10})).status,403);
            assert.equal((await admin.request('admin-invite-teacher',{email:existing.email,classLimit:0})).status,422);
            assert.equal((await admin.request('admin-invite-teacher',{email:existing.email,classLimit:10},{headers:{'X-CSRF-Token':'invalid'}})).status,403);
            const token=await invitation(existing.email);assert.match(token,/^[a-f0-9]{64}$/);
            assert.equal(await invitation(existing.email),token);
            const pending=(await admin.request('admin-teachers')).data.invitations.find(i=>i.email===existing.email);
            assert.ok(Math.abs(Number(pending.expiresAt)-Date.now()/1000-10*86400)<30,'ten-day lifetime from creation');
            assert.equal((await student.request('session')).data.profile.teacher,null);
            const info=await guest.request('teacher-invitation-info',{token});assert.equal(info.data.existing,true);assert.equal(info.data.classLimit,10);
            assert.equal((await accept(token,owner)).data.error.code,'ALREADY_SIGNED_IN');
            fixture('mail-clear-attempts');
            const firstBatch=JSON.parse(fixture('mail-test',{count:100,perMinute:1,perDay:10000})).messages;
            assert.equal(firstBatch.length,1,'invites share the rolling mail budget');
            assert.equal(JSON.parse(fixture('mail-test',{count:100,perMinute:1,perDay:10000})).messages.length,0);
            fixture('mail-clear-attempts');
            const mails=[...firstBatch,...JSON.parse(fixture('mail-test',{count:100,perMinute:100,perDay:10000})).messages];
            assert.ok(mails.some(m=>m.to===existing.email&&m.body.includes('#teacher-invite='+token)));
            await student.write({type:'complete',levelId:'mission1_level1',code:'KEEP PROMOTION'},0);
            fixture('membership-add',{id:existing.id,classId:room.id});
            assert.equal((await accept(token)).status,200);
            assert.equal((await accept(token)).status,422,'one-time token');
            assert.equal((await student.request('session')).data.profile,null,'old role session revoked');
            await student.login(existing.email);promoted=student;
            assert.equal(student.profile.teacher.classLimit,10);assert.equal(student.profile.superadmin,false);
            assert.equal((await student.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP PROMOTION');
            assert.ok(student.profile.classes.some(c=>c.name==='Lehrer:innen'));
        });
        await t.test('new teacher invitation validates password without consuming token; expired links do not grant roles',async()=>{
            const email=`newteacher-${randomUUID()}@other.test`,token=await invitation(email);
            assert.equal((await guest.request('accept-teacher-invitation',{token,name:'Teacher',password:'short',confirmation:'short'})).status,422);
            assert.equal((await guest.request('accept-teacher-invitation',{token,name:'Teacher',password,confirmation:'wrong'})).status,422);
            assert.equal((await accept(token)).status,200);
            newTeacher=new BrowserSession(url);await newTeacher.login(email);ids.push(newTeacher.profile.id);
            assert.equal(newTeacher.profile.teacher.classLimit,10);assert.equal(newTeacher.profile.className,'Lehrer:innen');
            const expiredEmail=`expired-${randomUUID()}@staff.test`,expired=await invitation(expiredEmail);
            fixture('teacher-invite-expire',{email:expiredEmail});assert.equal((await accept(expired)).status,422);
        });
        await t.test('co-teaching suggests same domain but accepts enabled external teacher; rejects students and escalation',async()=>{
            let r=await owner.request('teacher-candidates',{classId:room.id});assert.ok(r.data.candidates.some(c=>c.email===existing.email));
            assert.ok(!r.data.candidates.some(c=>c.email===newTeacher.profile.email));
            assert.equal((await owner.request('teacher-add-teacher',{classId:room.id,email:'not-enabled@other.test'})).status,422);
            assert.equal((await owner.request('teacher-add-teacher',{classId:room.id,email:existing.email})).status,200);
            assert.equal((await owner.request('teacher-add-teacher',{classId:room.id,email:newTeacher.profile.email})).status,200);
            r=await promoted.request('teacher-classes');assert.equal(r.data.ownedCount,0);assert.equal(r.data.classes.find(c=>c.id===room.id).isOwner,false);
            r=await promoted.request('teacher-class',{classId:room.id});assert.equal(r.status,200);assert.equal(r.data.class.ownerName,ownerUser.name);
            assert.equal((await promoted.request('teacher-renew-code',{classId:room.id})).status,404);
            assert.equal((await promoted.request('teacher-add-teacher',{classId:room.id,email:adminUser.email})).status,404);
            assert.equal((await promoted.request('teacher-delete-class',{classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true})).status,404);
            const pupil=newUser({classId:room.id});
            assert.equal((await promoted.request('teacher-update-member',{classId:room.id,memberId:pupil.id,previousEmail:pupil.email,email:pupil.email,name:'Shared edit'})).status,200);
            assert.equal((await promoted.request('teacher-delete-member',{classId:room.id,memberId:pupil.id,kind:'user'})).status,404);
            assert.equal((await owner.request('teacher-update-member',{classId:room.id,memberId:existing.id,previousEmail:existing.email,email:existing.email,name:'No privilege change'})).status,404);
        });
        await t.test('two deletion acknowledgements required; promoted accounts survive class removal with their data',async()=>{
            const body={classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:false};
            assert.equal((await owner.request('teacher-delete-class',body)).status,422);
            const preview=await owner.request('teacher-delete-preview',{classId:room.id});
            assert.ok(preview.data.protectedMembers.some(m=>m.id===existing.id&&m.otherClasses.some(c=>c.name==='Lehrer:innen')));
            assert.equal((await owner.request('teacher-delete-member',{classId:room.id,memberId:existing.id,kind:'user'})).status,200);
            assert.equal((await promoted.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP PROMOTION');
            fixture('membership-add',{id:existing.id,classId:room.id});
            assert.equal((await owner.request('teacher-delete-class',{...body,deleteExclusiveAccounts:true})).status,200);
            assert.equal((await promoted.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP PROMOTION');
            assert.equal((await promoted.request('session')).data.profile.teacher.classLimit,10);
            assert.equal((await admin.request('admin-teacher-limit',{memberId:existing.id,classLimit:12})).status,200);
            assert.equal((await promoted.request('session')).data.profile.teacher.classLimit,12);
        });
    }finally{
        for(const id of [adminUser.id,ownerUser.id,existing.id,newTeacher?.profile.id].filter(Boolean))fixture('teacher-clean',{id});
    }
}
