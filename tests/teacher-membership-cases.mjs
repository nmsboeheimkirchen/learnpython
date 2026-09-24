import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function membershipTests({t,fixture,BrowserSession,url,workerUrl,ids,password,newUser}){
    const owner=newUser({email:`owner-${randomUUID()}@school.test`}),outsider=newUser();
    fixture('teacher-grant',{id:owner.id,limit:10});fixture('teacher-grant',{id:outsider.id,limit:10});
    const teacher=new BrowserSession(url),other=new BrowserSession(workerUrl,url),guest=new BrowserSession(url);
    await teacher.login(owner.email);await other.login(outsider.email);await guest.request('session');
    let roomA,roomB,student,second,studentId,email;
    const signUp=async(address,room)=>{
        const session=new BrowserSession(url);await session.request('session');
        assert.equal((await session.request('check-invitation',{code:room.invitation.code})).status,200);
        const result=await session.request('register',{name:'Ada Same Domain',email:address,password});
        assert.equal(result.status,202,JSON.stringify(result.data));return {session,result};
    };
    try{
        roomA=(await teacher.request('teacher-create-class',{name:'Domain A'})).data.class;
        roomB=(await other.request('teacher-create-class',{name:'Domain B'})).data.class;
        await t.test('same-domain registration is usable without mail but distinctly unverified; exact domain matching only',async()=>{
            email=`learner-${randomUUID()}@SCHOOL.TEST`;
            const {session,result}=await signUp(email,roomA);student=session;
            assert.equal(result.data.immediate,true);
            const inspect=JSON.parse(fixture('registration-inspect',{email:email.toLowerCase()}));
            assert.equal(inspect.users,1);assert.equal(inspect.pending,false);
            await student.login(email);studentId=student.profile.id;ids.push(studentId);
            assert.equal(student.profile.emailVerified,false);assert.equal(student.profile.teacher,null);
            assert.equal((await teacher.request('teacher-class',{classId:roomA.id})).data.members[0].status,'unverified');
            await student.write({type:'complete',levelId:'mission1_level1',code:'KEEP SHARED PROGRESS'},0);
            second=new BrowserSession(workerUrl,url);await second.login(email);
            for(const domain of ['sub.school.test','school.test.evil.test']){
                const address=`foreign-${randomUUID()}@${domain}`;
                const {result}=await signUp(address,roomA);assert.equal(result.data.immediate,false);
                assert.ok(JSON.parse(fixture('registration-inspect',{email:address})).pending);
            }
        });
        await t.test('only class owner may confirm or edit email; active unverified users receive reset mail',async()=>{
            const confirm={classId:roomA.id,memberId:studentId,email:email.toLowerCase()};
            for(const s of [guest,student,other]){
                assert.ok([401,403,404].includes((await s.request('teacher-confirm-email',confirm)).status));
                assert.ok([401,403,404].includes((await s.request('teacher-update-member',{...confirm,previousEmail:confirm.email,name:'No'})).status));
            }
            assert.equal((await teacher.request('teacher-confirm-email',confirm,{headers:{'X-CSRF-Token':'bad'}})).status,403);
            assert.equal((await teacher.request('teacher-confirm-email',{...confirm,email:'stale@school.test'})).status,409);
            await guest.request('request-password-reset',{email});
            fixture('mail-clear-attempts');
            const mail=JSON.parse(fixture('mail-test',{count:100,perMinute:100,perDay:10000})).messages.find(m=>m.to===email.toLowerCase());
            assert.ok(mail?.body.includes('#reset='));
            assert.equal((await teacher.request('teacher-confirm-email',confirm)).status,200);
            assert.equal((await student.request('session')).data.profile.emailVerified,true);
            assert.equal((await teacher.request('teacher-class',{classId:roomA.id})).data.members[0].status,'confirmed');
            const edit={classId:roomA.id,memberId:studentId,previousEmail:email.toLowerCase(),email:owner.email,name:'Ada Corrected'};
            assert.equal((await teacher.request('teacher-update-member',edit)).data.error.code,'EMAIL_UNAVAILABLE');
            assert.equal((await teacher.request('teacher-update-member',{...edit,email:'bad-address'})).status,422);
            assert.equal((await teacher.request('teacher-update-member',{...edit,email:'free@school.test',previousEmail:'stale@school.test'})).status,409);
            const before=(await student.request('state')).data.state;
            const corrected=`corrected-${randomUUID()}@school.test`;
            assert.equal((await teacher.request('teacher-update-member',{...edit,email:corrected})).status,200);
            assert.equal((await student.request('state')).status,401);assert.equal((await second.request('state')).status,401);
            const oldToken=mail.body.match(/#reset=([a-f0-9]{64})/)[1];
            assert.equal((await guest.request('reset-password',{token:oldToken,password,confirmation:password})).status,422);
            await student.login(corrected);assert.equal(student.profile.emailVerified,false);assert.equal(student.profile.name,'Ada Corrected');
            assert.deepEqual((await student.request('state')).data.state,before);
            assert.equal((await teacher.request('teacher-confirm-email',{...confirm,email:corrected})).status,200);
            email=corrected;
        });
        await t.test('deleting either class preserves a shared student, login, reset and progress in the remaining class',async()=>{
            fixture('membership-add',{id:studentId,classId:roomB.id});
            const preview=await teacher.request('teacher-delete-preview',{classId:roomA.id});
            assert.equal(preview.status,200);assert.equal(preview.data.protectedMembers.length,1);
            assert.equal(preview.data.protectedMembers[0].email,email);
            assert.deepEqual(preview.data.protectedMembers[0].otherClasses,[{id:roomB.id,name:roomB.name}]);
            assert.equal((await other.request('teacher-delete-preview',{classId:roomA.id})).status,404);
            assert.equal((await other.request('teacher-class',{classId:roomB.id})).data.class.members,1);
            const before=(await student.request('state')).data.state;
            await guest.request('request-password-reset',{email});
            assert.equal((await teacher.request('teacher-delete-class',{classId:roomA.id,confirmation:'LÖSCHEN'})).status,200);
            assert.deepEqual((await student.request('state')).data.state,before);
            const profile=(await student.request('session')).data.profile;
            assert.equal(profile.classId,roomB.id);assert.equal(profile.className,roomB.name);
            assert.equal(JSON.parse(fixture('membership-inspect',{id:studentId})).classes.length,1);
            assert.ok(JSON.parse(fixture('reset-inspect',{email})).reset);
            const roomC=(await teacher.request('teacher-create-class',{name:'Domain C'})).data.class;
            fixture('membership-add',{id:studentId,classId:roomC.id});
            assert.equal((await teacher.request('teacher-delete-member',{classId:roomC.id,memberId:studentId,kind:'user'})).status,200);
            assert.deepEqual((await student.request('state')).data.state,before);
            assert.equal((await teacher.request('teacher-class',{classId:roomC.id})).data.class.members,0);
            assert.equal((await other.request('teacher-class',{classId:roomB.id})).data.class.members,1);
        });
    }finally{fixture('teacher-clean',{id:owner.id});fixture('teacher-clean',{id:outsider.id});}
}
