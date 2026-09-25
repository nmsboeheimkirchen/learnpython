import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function managementTests({t,fixture,BrowserSession,url,workerUrl,password,newUser}){
    const tag=randomUUID(),make=async(domain,teacher=true,admin=false)=>{
        const u=newUser({email:`m-${randomUUID()}@${domain}`});
        if(teacher)fixture('teacher-grant',{id:u.id,limit:10});if(admin)fixture('admin-grant',{id:u.id});
        const s=new BrowserSession(url);await s.login(u.email);return {u,s};
    };
    const admin=await make('admin.test',true,true),owner=await make('school.test'),co=await make('school.test'),external=await make('elsewhere.test'),pupil=await make('school.test',false);
    const all=[admin,owner,co,external,pupil];
    const create=async(person,name)=>{const r=await person.s.request('teacher-create-class',{name});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.class;};
    const removeClass=(s,c)=>s.request('teacher-delete-class',{classId:c.id,confirmation:'LÖSCHEN',deleteClass:true,deleteExclusiveAccounts:true});
    try{
        let room=await create(owner,'Transfer '+tag);
        await owner.s.request('teacher-add-teacher',{classId:room.id,email:co.u.email});
        await t.test('management migration preserves populated classes, co-teachers and learning data; is idempotent',()=>{
            assert.deepEqual(JSON.parse(fixture('test-management-migration')),{preserved:true,version:8});
        });
        await t.test('school class names reject same-domain duplicates (case and spacing), allow other domains and reuse after deletion',async()=>{
            assert.equal((await co.s.request('teacher-create-class',{name:room.name.toUpperCase()})).data.error.code,'CLASS_NAME_TAKEN');
            assert.equal((await co.s.request('teacher-create-class',{name:room.name.replace(' ','  ')})).status,409);
            const second=await create(external,room.name);assert.equal(second.schoolDomain,'elsewhere.test');
            await removeClass(external.s,second);await create(external,room.name);
            const otherWorker=new BrowserSession(workerUrl,url);await otherWorker.login(co.u.email);
            const raced=await Promise.all([owner.s.request('teacher-create-class',{name:'Race '+tag}),otherWorker.request('teacher-create-class',{name:'Race '+tag})]);
            assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
        });
        await t.test('only owner removes/transfers; co-teacher leaves; transfer preserves membership, code, namespace and progress',async()=>{
            fixture('membership-add',{id:pupil.u.id,classId:room.id});
            await pupil.s.write({type:'complete',levelId:'mission1_level1',code:'KEEP TRANSFER'},0);
            assert.equal((await co.s.request('teacher-remove-teacher',{classId:room.id,memberId:owner.u.id})).status,404);
            assert.equal((await owner.s.request('teacher-leave-class',{classId:room.id})).data.error.code,'CLASS_OWNER_CANNOT_LEAVE');
            assert.equal((await owner.s.request('teacher-transfer-class',{classId:room.id,memberId:external.u.id})).status,422);
            await owner.s.request('teacher-add-teacher',{classId:room.id,email:external.u.email});
            fixture('teacher-limit',{id:external.u.id,limit:1});
            assert.equal((await owner.s.request('teacher-transfer-class',{classId:room.id,memberId:external.u.id})).data.error.code,'TARGET_CLASS_LIMIT_REACHED');
            fixture('teacher-limit',{id:external.u.id,limit:10});
            const r=await owner.s.request('teacher-transfer-class',{classId:room.id,memberId:external.u.id});
            assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.class.isOwner,false);assert.equal(r.data.class.ownerEmail,external.u.email);
            assert.equal(r.data.class.invitation.code,room.invitation.code);assert.equal(r.data.class.schoolDomain,'school.test');
            assert.equal((await external.s.request('teacher-class',{classId:room.id})).data.members.find(m=>m.id===pupil.u.id).completedIds[0],'mission1_level1');
            assert.equal((await owner.s.request('teacher-renew-code',{classId:room.id})).status,404);
            assert.equal((await owner.s.request('teacher-leave-class',{classId:room.id})).status,200);
            assert.equal((await owner.s.request('teacher-class',{classId:room.id})).status,404);
            assert.equal((await external.s.request('teacher-remove-teacher',{classId:room.id,memberId:co.u.id})).status,200);
            assert.equal((await co.s.request('teacher-class',{classId:room.id})).status,404);
            assert.equal((await owner.s.request('teacher-create-class',{name:room.name})).status,409,'fixed school namespace after transfer');
        });
        await t.test('admin account list and edits are protected, revoke sessions on address change and preserve learning state',async()=>{
            assert.equal((await owner.s.request('admin-accounts')).status,403);
            assert.equal((await owner.s.request('admin-update-account',{memberId:pupil.u.id,name:'Wrong',email:pupil.u.email,previousEmail:pupil.u.email})).status,403);
            const listed=(await admin.s.request('admin-accounts')).data;assert.ok(listed.accounts.find(a=>a.id===pupil.u.id).classes.some(c=>c.id===room.id));
            assert.doesNotMatch(JSON.stringify(listed),/KEEP TRANSFER|password_hash|token_hash/);
            const edit={memberId:pupil.u.id,name:'Renamed Pupil',email:`edited-${tag}@school.test`,previousEmail:pupil.u.email};
            assert.equal((await admin.s.request('admin-update-account',edit,{headers:{'X-CSRF-Token':'bad'}})).status,403);
            assert.equal((await admin.s.request('admin-update-account',edit)).status,200);
            assert.equal((await pupil.s.request('session')).data.profile,null);
            await pupil.s.login(edit.email);assert.equal(pupil.s.profile.emailVerified,false);
            assert.equal((await pupil.s.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP TRANSFER');
        });
        await t.test('revocation keeps pupil access/progress, transfers all classes even above admin quota and protects admin',async()=>{
            fixture('teacher-limit',{id:admin.u.id,limit:1});
            assert.equal((await owner.s.request('admin-revoke-teacher',{memberId:external.u.id,deleteAccount:false})).status,403);
            assert.equal((await admin.s.request('admin-revoke-teacher',{memberId:admin.u.id,deleteAccount:true})).data.error.code,'PROTECTED_ADMIN');
            await external.s.write({type:'complete',levelId:'mission1_level1',code:'KEEP REVOKED'},0);
            const r=await admin.s.request('admin-revoke-teacher',{memberId:external.u.id,deleteAccount:false});assert.equal(r.status,200,JSON.stringify(r.data));
            assert.equal((await external.s.request('session')).data.profile,null);await external.s.login(external.u.email);
            assert.equal(external.s.profile.teacher,null);assert.equal((await external.s.request('teacher-classes')).status,403);
            assert.equal((await external.s.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP REVOKED');
            const owned=(await admin.s.request('teacher-classes')).data;assert.ok(owned.ownedCount>owned.classLimit);
            assert.equal(owned.classes.filter(c=>c.name===room.name).length,2,'same public name across original schools can share an owner');
            assert.equal((await admin.s.request('teacher-class',{classId:room.id})).data.class.invitation.code,room.invitation.code);
            assert.equal((await pupil.s.request('state')).data.state.data.completedCodes.mission1_level1,'KEEP TRANSFER');
        });
        await t.test('admin deletion transfers owned classes; own deletion requires password and no owned classes, never deletes admin',async()=>{
            const disposable=await make('dispose.test');all.push(disposable);const retained=await create(disposable,'Retained '+tag);
            assert.equal((await disposable.s.request('delete-account',{password,confirmation:true})).data.error.code,'ACCOUNT_OWNS_CLASSES');
            assert.equal((await admin.s.request('admin-delete-account',{memberId:admin.u.id,confirmation:true})).data.error.code,'PROTECTED_ADMIN');
            assert.equal((await admin.s.request('admin-delete-account',{memberId:disposable.u.id,confirmation:true})).status,200);
            assert.equal((await disposable.s.request('session')).data.profile,null);
            assert.equal((await admin.s.request('teacher-class',{classId:retained.id})).status,200);
            assert.equal((await co.s.request('delete-account',{password:'wrong',confirmation:true})).data.error.code,'PASSWORD_CHECK_FAILED');
            // The co-teacher may have won the name-race class; clean that fixture first.
            const coClasses=(await co.s.request('teacher-classes')).data.classes;for(const c of coClasses.filter(c=>c.isOwner))await removeClass(co.s,c);
            assert.equal((await co.s.request('delete-account',{password,confirmation:true})).status,200);
            assert.equal((await co.s.request('session')).data.profile,null);
            assert.equal((await pupil.s.request('delete-account',{password,confirmation:true})).status,200);
            assert.ok(!(await admin.s.request('admin-accounts')).data.accounts.some(a=>a.id===pupil.u.id));
        });
        await t.test('revocation removes the teachers group, supports an unassigned retained pupil and optional permanent account deletion',async()=>{
            const email=`new-role-${tag}@role.test`,guest=new BrowserSession(url);await guest.request('session');
            assert.equal((await admin.s.request('admin-invite-teacher',{email,classLimit:10})).status,200);
            const token=JSON.parse(fixture('teacher-invite-token',{email})).token;
            assert.equal((await guest.request('accept-teacher-invitation',{token,name:'Role only',password,confirmation:password})).status,200);
            await guest.login(email);const id=guest.profile.id;assert.equal(guest.profile.className,'Lehrer:innen');
            assert.equal((await admin.s.request('admin-revoke-teacher',{memberId:id,deleteAccount:false})).status,200);
            await guest.login(email);assert.equal(guest.profile.className,'Ohne Klasse');assert.equal(guest.profile.teacher,null);
            assert.ok(!guest.profile.classes.some(c=>c.name==='Lehrer:innen'));
            assert.equal((await admin.s.request('admin-invite-teacher',{email,classLimit:10})).status,200);
            const again=JSON.parse(fixture('teacher-invite-token',{email})).token;
            assert.equal((await guest.request('accept-teacher-invitation',{token:again,name:'',password:'',confirmation:''})).status,200);
            await guest.login(email);
            assert.equal((await admin.s.request('admin-revoke-teacher',{memberId:id,deleteAccount:true})).status,200);
            assert.equal((await guest.request('session')).data.profile,null);
            assert.ok(!(await admin.s.request('admin-accounts')).data.accounts.some(a=>a.id===id));
        });
    }finally{for(const {u} of all)fixture('teacher-clean',{id:u.id});}
}
