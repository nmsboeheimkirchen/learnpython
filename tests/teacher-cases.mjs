import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function teacherTests({t,fixture,env,phpCall,BrowserSession,url,workerUrl,ids,password,newUser}) {
    const a=newUser(),b=newUser(),student=newUser();
    fixture('teacher-grant',{id:a.id,limit:10});fixture('teacher-grant',{id:b.id,limit:10});
    const teacher=new BrowserSession(url),other=new BrowserSession(workerUrl,url),pupil=new BrowserSession(url),guest=new BrowserSession(url);
    await teacher.login(a.email);await other.login(b.email);await pupil.login(student.email);await guest.request('session');
    let room,code;
    try {
        await t.test('teacher permissions are server-side; guests, pupils and forged roles cannot list classes',async()=>{
            assert.equal((await guest.request('teacher-classes')).status,401);
            assert.equal((await pupil.request('teacher-classes')).status,403);
            assert.equal((await pupil.request('teacher-create-class',{name:'No',teacher:true})).status,403);
            assert.equal((await teacher.request('teacher-classes')).data.classLimit,10);
            assert.equal((await teacher.request('teacher-create-class',{name:'No'},{headers:{'X-CSRF-Token':'bad'}})).status,403);
            assert.equal((await teacher.request('teacher-create-class',{name:'No'},{headers:{Origin:'https://evil.example'}})).status,403);
            assert.equal((await teacher.request('teacher-classes',undefined,{headers:{'X-Agentpy-Profile':b.id}})).status,409);
        });
        await t.test('teacher creates a named 32-seat class, code has five capitals, 10 days and authenticated encryption',async()=>{
            const start=Math.floor(Date.now()/1000),r=await teacher.request('teacher-create-class',{name:'1A <b>test</b>'});
            assert.equal(r.status,200,JSON.stringify(r.data));room=r.data.class;code=room.invitation.code;
            assert.equal(room.capacity,32);assert.equal(room.members,0);assert.equal(room.name,'1A <b>test</b>');
            assert.match(code,/^[A-Z]{5}$/);assert.ok(room.invitation.expiresAt>=start+864000&&room.invitation.expiresAt<=start+864005);
            assert.deepEqual(JSON.parse(fixture('teacher-key-check',{code})),{encrypted:true,hasPrivateKey:true});
            assert.equal((await teacher.request('teacher-create-class',{name:room.name})).status,409);
            assert.equal((await other.request('teacher-create-class',{name:room.name})).status,409,'names scoped to school domain');
            assert.equal((await other.request('teacher-create-class',{name:'Independent class'})).status,200);
            assert.equal((await other.request('teacher-class',{classId:room.id})).status,404);
            assert.equal((await other.request('teacher-renew-code',{classId:room.id})).status,404);
            assert.equal((await teacher.request('teacher-class',{classId:'bad'})).status,404);
            assert.equal((await teacher.request('teacher-renew-code',{classId:room.id})).data.class.invitation.code,code,'retry preserves active code');
        });
        await t.test('new class code joins the right class; pending and confirmed roster never includes tokens or source code',async()=>{
            const signup=new BrowserSession(url);await signup.request('session');
            assert.equal((await signup.request('check-invitation',{code})).data.className,room.name);
            const email=`teacher-join-${randomUUID()}@external.test`;
            assert.equal((await signup.request('register',{name:'Ada <script>',email,password})).status,202);
            let r=await teacher.request('teacher-class',{classId:room.id});assert.equal(r.data.class.pending,1);assert.equal(r.data.members[0].completedIds,null);
            // Code naturally expires after reservation; confirmation retains its own bounded lifetime.
            await new Promise(r=>setTimeout(r,2100));fixture('teacher-expire',{classId:room.id});
            fixture('mail-clear-attempts');const mail=JSON.parse(fixture('mail-test',{count:100,perMinute:100,perDay:10000})).messages.find(m=>m.to===email);
            assert.ok(mail);const token=mail.body.match(/#verify=([a-f0-9]{64})/)[1];
            assert.equal((await signup.request('check-invitation',{code})).status,422);
            assert.equal((await signup.request('verify-email',{token})).status,200);
            await signup.login(email);ids.push(signup.profile.id);assert.equal(signup.profile.className,room.name);assert.equal(signup.profile.teacher,null);
            await signup.write({type:'complete',levelId:'mission1_level1',code:'PRIVATE-SOURCE-MARKER'},0);
            r=await teacher.request('teacher-class',{classId:room.id});assert.equal(r.data.class.members,1);assert.equal(r.data.class.pending,0);
            assert.deepEqual(r.data.members[0].completedIds,['mission1_level1']);assert.equal(r.data.class.invitation,null);
            assert.doesNotMatch(JSON.stringify(r.data),/PRIVATE-SOURCE-MARKER|token_hash|password_hash|encrypted_code/);
            const renewed=await teacher.request('teacher-renew-code',{classId:room.id});assert.equal(renewed.status,200);assert.notEqual(renewed.data.class.invitation.code,code);assert.equal(renewed.data.class.members,1);
            assert.equal((await teacher.request('teacher-classes')).data.classes.length,1);
        });
        await t.test('class limit survives concurrent creation on independent PHP workers; renewal costs no class',async()=>{
            fixture('teacher-limit',{id:a.id,limit:2});
            const before=(await teacher.request('teacher-classes')).data;
            assert.equal(before.classLimit,2);assert.equal(before.classes.length,1);
            const second=new BrowserSession(workerUrl,url);await second.login(a.email);
            const results=await Promise.all([teacher.request('teacher-create-class',{name:'Parallel A'}),second.request('teacher-create-class',{name:'Parallel B'})]);
            assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
            assert.equal((await teacher.request('teacher-classes')).data.classes.length,2);
            assert.equal((await teacher.request('teacher-renew-code',{classId:room.id})).status,200);
            assert.equal((await teacher.request('teacher-create-class',{name:'Too many'})).data.error.code,'CLASS_LIMIT_REACHED');
        });
        await t.test('deletion is scoped, confirmed and cascades only the selected classroom data',async()=>{
            const roster=(await teacher.request('teacher-class',{classId:room.id})).data;
            const member=roster.members[0],joinCode=roster.class.invitation.code;
            const remove={classId:room.id,memberId:member.id,kind:'user'};
            const confirmed=new BrowserSession(url);await confirmed.login(member.email);
            const signup=new BrowserSession(url);await signup.request('session');
            assert.equal((await signup.request('check-invitation',{code:joinCode})).status,200);
            const email=`pending-delete-${randomUUID()}@external.test`;
            assert.equal((await signup.request('register',{name:'Pending',email,password})).status,202);
            const pending=(await teacher.request('teacher-class',{classId:room.id})).data.members.find(m=>m.status==='pending');
            assert.match(pending.id,/^[a-f0-9]{32}$/);
            for(const session of [guest,pupil,other]){
                assert.ok([401,403,404].includes((await session.request('teacher-delete-member',remove)).status));
                assert.ok([401,403,404].includes((await session.request('teacher-delete-class',{classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true})).status));
            }
            assert.equal((await teacher.request('teacher-delete-member',remove,{headers:{'X-CSRF-Token':'bad'}})).status,403);
            assert.equal((await teacher.request('teacher-delete-class',{classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true},{headers:{Origin:'https://evil.example'}})).status,403);
            assert.equal((await teacher.request('teacher-delete-class',{classId:room.id,confirmation:'löschen'})).status,422);
            assert.equal((await teacher.request('teacher-delete-member',{...remove,memberId:b.id})).status,404);
            assert.equal((await teacher.request('teacher-class',{classId:room.id})).data.class.members,1);
            // Deleting one open registration cancels its mail without touching the confirmed pupil.
            assert.equal((await teacher.request('teacher-delete-member',{classId:room.id,memberId:pending.id,kind:'pending'})).status,200);
            assert.equal(JSON.parse(fixture('registration-inspect',{email})).pending,false);
            const mails=JSON.parse(fixture('mail-test',{count:100,perMinute:100,perDay:10000})).messages;
            assert.ok(!mails.some(m=>m.to===email));
            fixture('teacher-grant',{id:member.id,limit:1});
            assert.equal((await teacher.request('teacher-delete-member',remove)).data.error.code,'PROTECTED_TEACHER_ACCOUNT','teachers are protected even in an owned class');
            assert.equal((await teacher.request('teacher-delete-class',{classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true})).data.error.code,'PROTECTED_TEACHER_ACCOUNT');
            assert.equal((await teacher.request('teacher-class',{classId:room.id})).data.class.id,room.id);
            assert.equal(JSON.parse(fixture('deleted-user-counts',{id:member.id})).users,1,'protected teacher account survived');
            fixture('teacher-clean',{id:member.id});
            await signup.request('forgot-password',{email:member.email});
            assert.equal((await teacher.request('teacher-delete-member',remove)).status,200);
            assert.equal((await confirmed.request('state')).status,401);
            const remains=JSON.parse(fixture('deleted-user-counts',{id:member.id}));
            assert.ok(Object.values(remains).every(count=>count===0),JSON.stringify(remains));
            assert.equal((await teacher.request('teacher-delete-member',remove)).status,404);
            // Populate again so class deletion proves its own cascades, not just an empty class.
            const secondEmail=`class-delete-${randomUUID()}@external.test`;
            await signup.request('check-invitation',{code:joinCode});
            assert.equal((await signup.request('register',{name:'Delete with class',email:secondEmail,password})).status,202);
            fixture('mail-clear-attempts');
            const mail=JSON.parse(fixture('mail-test',{count:100,perMinute:100,perDay:10000})).messages.find(m=>m.to===secondEmail);
            const token=mail.body.match(/#verify=([a-f0-9]{64})/)[1];
            assert.equal((await signup.request('verify-email',{token})).status,200);await signup.login(secondEmail);
            const secondId=signup.profile.id;ids.push(secondId);
            await signup.write({type:'complete',levelId:'mission1_level1',code:'CLASS-DELETE-FIXTURE'},0);
            await guest.request('check-invitation',{code:joinCode});
            const pendingEmail=`class-pending-${randomUUID()}@external.test`;
            assert.equal((await guest.request('register',{name:'Pending with class',email:pendingEmail,password})).status,202);
            const result=await teacher.request('teacher-delete-class',{classId:room.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true});
            assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.classes.length,1);
            assert.equal(JSON.parse(fixture('registration-inspect',{email:pendingEmail})).pending,false);
            assert.equal((await signup.request('state')).status,401);
            assert.ok(Object.values(JSON.parse(fixture('deleted-user-counts',{id:secondId}))).every(n=>n===0));
            assert.equal((await teacher.request('teacher-class',{classId:room.id})).status,404);
            await guest.request('session');assert.equal((await guest.request('check-invitation',{code:joinCode})).status,422);
            assert.equal((await other.request('teacher-classes')).data.classes.length,1);
            assert.equal((await teacher.request('teacher-create-class',{name:'Freed slot'})).status,200);
        });
    }finally{fixture('teacher-clean',{id:a.id});fixture('teacher-clean',{id:b.id});}
}
