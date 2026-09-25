import {calculateProgress,progressLegend,teacherProgressGuide} from './course-progress.js';
const root=document.getElementById('teacher-content');
const teacherLegend=progressLegend.replace('Ohne Link = noch gesperrt. ', 'Die Übersicht ist nur lesend; „offen“ bedeutet bereits freigeschaltet. ');
const chrome=window.parent!==window && window.parent.location.origin===location.origin ? window.parent.document : document;
const paths={transfer:'<path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H3V3h12v2"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-4l2 3M19 16a8 8 0 0 1-13 4l-2-3"/>',back:'<path d="M20 12H4m6-6-6 6 6 6"/>',check:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 7 10-7m-14 11 3 3 5-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const icon=name=>{const node=el('span',undefined,'teacher-icons');node.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;return node;};
const button=(text,action,symbol,cls)=>{const b=el('button',undefined,cls);b.type='button';if(symbol)b.append(icon(symbol));b.append(text);b.addEventListener('click',action);return b;};
let selected=null,version=0,timer=null;
const api=(action,body)=>window.AgentAccount.teacherRequest(action,body);
function clearPrivate(){version++;root.replaceChildren(el('h1','Meine Klassen'),el('p','Bitte neu anmelden. Deine Sitzung wurde geändert.','teacher-error'));chrome.querySelectorAll('[data-teacher-dialog]').forEach(d=>{d.close();d.remove();});clearTimeout(timer);}
new MutationObserver(()=>{
    const state=document.documentElement.classList;
    if(state.contains('account-invalidated')){clearPrivate();return;}
    // Focus checks hide the lesson briefly, but must preserve a valid class view.
    // Teacher dialogs live in the shell, outside the lesson's blocking CSS.
    chrome.querySelectorAll('[data-teacher-dialog]').forEach(d=>{
        d.inert=state.contains('account-blocked');d.style.visibility=d.inert?'hidden':'';
    });
}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
function fail(error){const node=el('p',error.message,'teacher-error');node.setAttribute('role','alert');root.replaceChildren(el('h1','Meine Klassen'),node,button('Erneut versuchen',()=>load(selected),'refresh'));}
function dialog(title,content){const d=chrome.createElement('dialog');d.className='account-dialog';d.dataset.teacherDialog='';d.setAttribute('aria-label',title);d.append(el('h2',title),content);const close=button('Schließen',()=>d.close());close.className='account-close';d.append(close);d.addEventListener('close',()=>d.remove());chrome.body.append(d);d.showModal();return d;}
function progressStatus(section){
    const node=el('span',section.code+(section.optional||!section.unlocked?'*':'')+(section.completed?' ✓':section.unlocked?' · offen':''),
        section.completed?'account-progress-done':'account-progress-pending');
    if(section.optional)node.classList.add('account-progress-optional');
    return node;
}
function progressList(p){
    const list=el('ul',undefined,'account-progress-list teacher-progress-list');
    for(const row of p.rows){const li=el('li');li.append(el('strong',row.label+': '));row.sections.forEach((s,i)=>{if(i)li.append(', ');li.append(progressStatus(s));});list.append(li);}
    return list;
}
function details(member){
    const p=calculateProgress(Object.fromEntries(member.completedIds.map(id=>[id,''])),member.unlockedIds||[]);
    const content=el('div');content.append(el('p',p.label,'account-progress-number'));
    const list=progressList(p);
    content.append(list,el('p',teacherLegend,'account-muted'));dialog(member.name,content);
}
function progressGuide(){
    const guide=el('details',undefined,'teacher-progress-guide teacher-panel');
    guide.append(el('summary','Fortschritt und Notenvorschlag – kurz erklärt'));
    guide.append(el('p','Es zählen erfolgreich gelöste Levels, nicht Aufrufe oder übersprungene Aufgaben. Ein Projekt ist Pflicht, das zweite bringt bis zu 20 Bonuspunkte. Die Prozente beider Projekte zählen unabhängig von der Pfadwahl.'));
    const wrap=el('div',undefined,'teacher-guide-scroll'),table=el('table');table.setAttribute('aria-label','Gewichtung und unverbindliche Notenorientierung');
    const head=el('thead'),headRow=el('tr');
    ['Kapitel','Wert','Leveldetails','Kumuliert','Notenvorschlag'].forEach(title=>{const th=el('th',title);th.scope='col';headRow.append(th);});
    head.append(headRow);table.append(head);const body=el('tbody');
    for(const row of teacherProgressGuide){const tr=el('tr');[row[0],row[1],row[3],row[2],row[4]].forEach(text=>tr.append(el('td',text)));body.append(tr);}
    table.append(body);wrap.append(table);guide.append(wrap,
        el('p','* bedeutet optional. 02-3 bringt 5 Bonuspunkte, das zweite Projekt anteilig bis zu 20. Derzeit sind 93 Pflichtpunkte erreichbar; für H-3/H-4 sind weitere 7 vorgesehen. Mit H-3/H-4 sind 100 % Pflichtfortschritt plus bis zu 25 Bonuspunkte möglich. Fehlende Pflichtaufgaben bleiben trotz Bonus sichtbar.'),
        el('p','Notenvorschläge sind eine unverbindliche Orientierung: NG = Nicht genügend, G = Genügend, B = Befriedigend, Gut = Gut, SG = Sehr gut. nur Museumsbriefing ohne optionales Level: B. Die Lehrperson entscheidet unter Berücksichtigung von Selbstständigkeit und Verständnis.','teacher-sub'));
    return guide;
}

async function deleteDialog(c,member=null){
    let protectedMembers=[];
    try {
        if(member){
            const fresh=await api('teacher-class',{classId:c.id});
            member=fresh.members.find(m=>m.id===member.id);
            if(!member)throw new Error('Dieses Konto ist nicht mehr in der Klasse.');
            if(member.otherClasses?.length)protectedMembers=[member];
        }else{
            const preview=await api('teacher-delete-preview',{classId:c.id});
            protectedMembers=preview.protectedMembers;c=preview.class;
        }
        if(selected!==c.id)return;
    }catch(failure){if(!document.documentElement.classList.contains('account-invalidated'))dialog('Löschen nicht möglich',el('p',failure.message));return;}
    const form=el('form'),error=el('p');error.setAttribute('role','alert');
    const shared=Boolean(member?.otherClasses?.length);
    form.append(el('p',member
        ? member.status==='pending' ? `Offene Anmeldung von ${member.email} endgültig löschen? Der Bestätigungslink wird ungültig.`
        : shared ? `${member.email} aus „${c.name}“ entfernen?`
        : `Konto ${member.email} endgültig löschen? Schülerdaten, Lernfortschritt und der gespeicherte Programmcode gehen verloren.`
        : `Klasse „${c.name}“ endgültig löschen?`,'teacher-danger'));
    const confirmations=[];
    if(!member){
        for(const text of ['Klasse, Beitrittscode und offene Anmeldungen löschen?','Schülerkonten, die nicht auch in einer weiteren Klasse sind, samt Lernfortschritt und Programmcode löschen?']){
            const label=el('label',undefined,'teacher-delete-check teacher-danger'),check=el('input');check.type='checkbox';check.required=true;
            confirmations.push(check);label.append(check,el('span',text));form.append(label);
        }
        form.append(el('p','Konten, die auch einer anderen Klasse oder der Gruppe Lehrer:innen angehören, bleiben bestehen.','teacher-preserved'));
    }
    if(protectedMembers.length){
        const protectedList=el('ul',undefined,'teacher-preserved');
        for(const m of protectedMembers)protectedList.append(el('li',`${m.email} – auch in: ${m.otherClasses.map(c=>c.name).join(', ')}. Konto, Lernfortschritt und Programmcode bleiben erhalten.`));
        form.append(protectedList);
    }
    if(!shared)form.append(el('p','Nicht rückgängig zu machen.','teacher-danger'));
    let input;
    if(!member){const label=el('label','Tippe zur Bestätigung LÖSCHEN');input=el('input');input.name='confirmation';input.autocomplete='off';input.required=true;label.append(input);form.append(label);}
    const submit=el('button',member?(shared?'Aus Klasse entfernen':'Nutzer löschen'):'Klasse löschen');submit.type='submit';submit.disabled=!member;
    const ready=()=>Boolean(member)||(input.value==='LÖSCHEN'&&confirmations.every(c=>c.checked));
    if(input)input.addEventListener('input',()=>{submit.disabled=!ready();});
    confirmations.forEach(c=>c.addEventListener('change',()=>{submit.disabled=!ready();}));
    form.append(error,submit);
    const d=dialog(member?'Nutzer löschen':'Klasse löschen',form),cancel=d.querySelector('.account-close');cancel.textContent='Abbrechen';
    let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy||!ready())return;
        busy=true;submit.disabled=true;cancel.disabled=true;
        try{
            const result=await api(member?'teacher-delete-member':'teacher-delete-class',member
                ? {classId:c.id,memberId:member.id,kind:member.status==='pending'?'pending':'user'}
                : {classId:c.id,confirmation:input.value,deleteClass:true,deleteExclusiveAccounts:true});
            d.close();member?renderDetail(result):renderList(result);
        }catch(failure){error.textContent=failure.message;}
        finally{busy=false;submit.disabled=!ready();cancel.disabled=false;}
    });
}

function emailDialog(c,member,confirmOnly){
    const form=el('form'),error=el('p');error.setAttribute('role','alert');
    if(confirmOnly)form.append(el('p',`E-Mail „${member.email}“ bestätigen?`));
    else{
        for(const [field,title,type] of [['name','Name','text'],['email','E-Mail-Adresse','email']]){
            const label=el('label',title),input=el('input');input.name=field;input.type=type;input.required=true;input.maxLength=field==='name'?100:254;input.value=member[field];label.append(input);form.append(label);
        }
        form.append(el('p','Bei einer neuen E-Mail-Adresse wird das Schülerkonto auf allen Geräten abgemeldet. Der Lernfortschritt bleibt erhalten. Die neue Adresse ist zunächst unbestätigt.','account-muted'));
    }
    const submit=el('button',confirmOnly?'Ja':'Speichern');submit.type='submit';form.append(error,submit);
    const d=dialog(confirmOnly?'E-Mail bestätigen':'Kontoinfo bearbeiten',form),cancel=d.querySelector('.account-close');cancel.textContent='Abbrechen';
    let edit;
    if(confirmOnly){edit=button('Nein: Bearbeiten',()=>{d.close();emailDialog(c,member,false);},undefined,'account-secondary');form.append(edit);}
    let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy)return;busy=true;submit.disabled=true;cancel.disabled=true;if(edit)edit.disabled=true;
        try{
            const result=await api(confirmOnly?'teacher-confirm-email':'teacher-update-member',confirmOnly
                ? {classId:c.id,memberId:member.id,email:member.email}
                : {classId:c.id,memberId:member.id,email:form.elements.email.value,previousEmail:member.email,name:form.elements.name.value});
            d.close();renderDetail(result);
        }catch(failure){error.textContent=failure.message;}
        finally{busy=false;submit.disabled=false;cancel.disabled=false;if(edit)edit.disabled=false;}
    });
}

function fieldsForm(title,fields,action,body,done){
    const form=el('form'),error=el('p');error.setAttribute('role','alert');
    for(const [name,label,type,value]of fields){const item=el('label',label),input=el('input');input.name=name;input.type=type;input.required=true;input.value=value??'';if(type==='number'){input.min=1;input.max=100;}item.append(input);form.append(item);}
    const submit=el('button',action==='admin-invite-teacher'?'Einladung senden':action==='teacher-add-teacher'?'Lehrkraft hinzufügen':'Speichern');submit.type='submit';form.append(error,submit);
    const d=dialog(title,form);d.querySelector('.account-close').textContent='Abbrechen';
    form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const input=Object.fromEntries(new FormData(form));if(input.classLimit)input.classLimit=Number(input.classLimit);const r=await api(action,{...body,...input});d.close();done(r);}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});
}
function adminPanel(){
    const section=el('section',undefined,'teacher-panel');section.append(el('h2','Verwaltete Lehrer:innen'),el('p','Lehrkräfte werden geladen …'));
    api('admin-teachers').then(r=>{
        if(!section.isConnected||document.documentElement.classList.contains('account-invalidated'))return;
        section.replaceChildren(el('h2','Verwaltete Lehrer:innen'),el('p','Gruppe Lehrer:innen · Neue und bestehende Nutzer erhalten eine Einladung per E-Mail. Gültig für 10 Tage.','teacher-sub'));
        section.append(button('Lehrkraft hinzufügen',()=>fieldsForm('Lehrkraft einladen',[['email','E-Mail-Adresse','email',''],['classLimit','Eigene Klassen (1–100)','number',10]],'admin-invite-teacher',{},()=>load(null)),'plus'));
        const list=el('ul');
        for(const t of r.teachers){const li=el('li');li.append(el('strong',t.name+' · '),el('span',t.email+' · '+t.ownedClasses+' von '+t.classLimit+' eigenen Klassen '),button('Limit ändern',()=>fieldsForm('Klassenlimit ändern',[['classLimit','Eigene Klassen (1–100)','number',t.classLimit]],'admin-teacher-limit',{memberId:t.id},()=>load(null)),'edit','teacher-link'));if(!t.superadmin){const revoke=button('',()=>revokeTeacherDialog(t),'close','teacher-delete');revoke.setAttribute('aria-label','Lehrerrolle von '+t.name+' entziehen');li.append(revoke);}list.append(li);}
        section.append(list,allAccountsPanel());
        if(r.invitations.length){section.append(el('h3','Offene Einladungen'));const pending=el('ul');for(const i of r.invitations)pending.append(el('li',i.email+' · '+i.classLimit+' Klassen · gültig bis '+new Intl.DateTimeFormat('de-AT').format(new Date(i.expiresAt*1000))));section.append(pending);}
    }).catch(e=>{if(section.isConnected)section.append(el('p',e.message,'teacher-error'));});return section;
}
async function studentTransferDialog(c,member){
    try{
        const r=await api('teacher-transfer-targets',{classId:c.id});if(selected!==c.id)return;
        const form=el('form'),error=el('p');error.setAttribute('role','alert');
        form.append(el('p',member.name+' · '+member.email),el('p','Konto, Passwort, Programmcode und Lernfortschritt bleiben erhalten. Andere Klassenzugehörigkeiten bleiben unverändert.','account-muted'));
        const modeLabel=el('label','Art der Zuordnung'),mode=el('select');mode.name='mode';
        for(const [value,text]of [['move','Verschieben – aus dieser Klasse entfernen'],['add','Zusätzlich zuordnen – in dieser Klasse behalten']]){const o=el('option',text);o.value=value;mode.append(o);}modeLabel.append(mode);
        const targetLabel=el('label','Zielklasse'),target=el('select');target.name='target';
        for(const room of r.classes){const o=el('option',room.name+' · eigene Klasse');o.value=room.id;target.append(o);}
        const other=el('option','Andere Klasse – mit Klassencode');other.value='';target.append(other);targetLabel.append(target);
        const codeLabel=el('label','Klassencode der Zielklasse'),code=el('input');code.name='code';code.maxLength=5;code.autocomplete='off';codeLabel.append(code);
        const policy=el('p',undefined,'account-muted');
        const sync=()=>{codeLabel.hidden=!!target.value;code.required=!target.value;policy.textContent=target.value?'Wird nach Bestätigung direkt ausgeführt, sofern ein Platz frei ist.':'Der Zielklasseninhaber muss zustimmen. Die Anfrage gilt 10 Tage, reserviert keinen Platz und verändert bis zur Annahme nichts. Bei Annahme wird die Kapazität geprüft.';};target.addEventListener('change',sync);sync();
        const submit=el('button','Zuordnung bestätigen');submit.type='submit';form.append(modeLabel,targetLabel,codeLabel,policy,error,submit);
        const d=dialog('Schüler:in zuordnen',form),cancel=d.querySelector('.account-close');cancel.textContent='Abbrechen';let busy=false;
        d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
        form.addEventListener('submit',async e=>{
            e.preventDefault();if(busy)return;busy=true;submit.disabled=true;cancel.disabled=true;
            try{
                const result=await api('teacher-transfer-student',{classId:c.id,memberId:member.id,targetClassId:target.value,code:target.value?'':code.value.trim(),mode:mode.value});
                d.close();renderDetail(result);
                if(result.pending)dialog('Anfrage gesendet',el('p','Der Inhaber von „'+result.targetName+'“ findet die Anfrage unter Meine Klassen → Schülerübertragungen. Bis zur Zustimmung bleibt alles unverändert.'));
            }catch(failure){error.textContent=failure.message;}
            finally{busy=false;submit.disabled=false;cancel.disabled=false;}
        });
    }catch(e){dialog('Zuordnung nicht möglich',el('p',e.message));}
}
function transfersPanel(){
    const section=el('section',undefined,'teacher-panel');section.hidden=true;
    api('teacher-transfers').then(r=>{
        if(!section.isConnected||!r.requests.length)return;section.hidden=false;section.append(el('h2','Schülerübertragungen'));
        for(const request of r.requests){
            const row=el('div',undefined,'teacher-transfer-row');
            row.append(el('strong',request.name+' · '+request.email),el('p',request.sourceName+' → '+request.targetName+' · '+(request.mode==='move'?'Verschieben':'Zusätzlich zuordnen')+' · gültig bis '+new Intl.DateTimeFormat('de-AT').format(new Date(request.expiresAt*1000)),'teacher-sub'));
            const decide=(decision,label)=>confirmAction(label,request.name+': '+(decision==='accept'?(request.mode==='move'?'Nach Annahme wird die Person aus der Ausgangsklasse entfernt. ':'Die Person bleibt zusätzlich in der Ausgangsklasse. ')+'Konto und Lernstand bleiben erhalten. Die Zielklasse braucht einen freien Platz.':'Es wird keine Klassenzugehörigkeit verändert.'),label,'teacher-decide-transfer',{requestId:request.id,decision},renderList);
            if(request.incoming)row.append(button('Annehmen',()=>decide('accept','Annehmen'),undefined,'teacher-primary'),button('Ablehnen',()=>decide('decline','Ablehnen')));
            else row.append(button('Anfrage zurückziehen',()=>decide('cancel','Anfrage zurückziehen'),undefined,'teacher-link'));
            section.append(row);
        }
    }).catch(e=>{if(section.isConnected){section.hidden=false;section.append(el('p','Schülerübertragungen: '+e.message,'teacher-error'));}});
    return section;
}
function teacherName(t){
    const wrap=el('span',undefined,'teacher-person'),name=button(t.name,()=>{email.hidden=!email.hidden;name.setAttribute('aria-expanded',String(!email.hidden));},undefined,'teacher-link');
    const email=el('span',' · '+t.email,'teacher-person-email');email.hidden=true;name.setAttribute('aria-expanded','false');name.title=t.email;
    wrap.append(name,email);return wrap;
}
function ownerLabel(c,profile){const p=el('p',undefined,'teacher-muted');p.append('Klasseninhaber: ',teacherName({name:c.ownerName||profile.name,email:c.ownerEmail||profile.email}));return p;}
function confirmAction(title,description,label,action,body,done,extra){
    const form=el('form'),error=el('p');error.setAttribute('role','alert');form.append(el('p',description,'teacher-danger'));
    if(extra)form.append(extra);
    const submit=el('button',label);submit.type='submit';form.append(error,submit);
    const d=dialog(title,form),cancel=d.querySelector('.account-close');cancel.textContent='Abbrechen';
    let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy)return;busy=true;submit.disabled=true;cancel.disabled=true;
        try{const r=await api(action,typeof body==='function'?body():body);d.close();done(r);}
        catch(failure){error.textContent=failure.message;}
        finally{busy=false;submit.disabled=false;cancel.disabled=false;}
    });return d;
}
function classTeachers(c){
    const section=el('div',undefined,'teacher-team');
    if(c.teachers?.length){
        section.append(el('p','Weitere Lehrkräfte:','teacher-sub'));const list=el('ul',undefined,'teacher-team-list');
        for(const t of c.teachers){
            const item=el('li');item.append(teacherName(t));
            if(c.isOwner!==false){
                const remove=button('',()=>confirmAction('Lehrkraft entfernen',t.name+' verliert den Lehrzugang zu dieser Klasse. Konto, weitere Klassen und Schülerdaten bleiben erhalten.','Entfernen','teacher-remove-teacher',{classId:c.id,memberId:t.id},renderDetail),'close','teacher-delete');
                remove.setAttribute('aria-label',t.name+' aus Klasse entfernen');item.append(remove);
            }list.append(item);
        }section.append(list);
    }
    if(c.isOwner===false)section.append(button('Klasse verlassen',()=>confirmAction('Klasse verlassen','Du verlierst den Lehrzugang zu „'+c.name+'“. Dein Konto und die Klasse mit allen Schülerdaten bleiben erhalten.','Klasse verlassen','teacher-leave-class',{classId:c.id},renderList),undefined,'teacher-link'));
    else if(c.teachers?.length)section.append(button('Klasse übertragen',()=>{
        const label=el('label','Neuer Klasseninhaber'),select=el('select');select.name='newOwner';
        for(const t of c.teachers){const option=el('option',t.name+' · '+t.email);option.value=t.id;select.append(option);}label.append(select);
        confirmAction('Klasse übertragen','Die ausgewählte Lehrkraft wird Inhaber und braucht einen freien Klassenplatz. Du bleibst als weitere Lehrkraft dabei und kannst die Klasse danach verlassen. Code, Schülerkonten, Lernstände und ursprüngliche Schul-Domain bleiben erhalten.','Übertragen','teacher-transfer-class',()=>({classId:c.id,memberId:select.value}),renderDetail,label);
    },undefined,'teacher-link'));
    if(c.schoolDomain)section.append(el('p','Schul-Domain: '+c.schoolDomain,'teacher-sub'));
    return section;
}
function revokeTeacherDialog(t){
    const label=el('label',undefined,'teacher-delete-check'),check=el('input');check.type='checkbox';
    label.append(check,el('span','Auch das Konto samt persönlichem Lernfortschritt und Programmcode endgültig löschen'));
    confirmAction('Lehrerrolle entziehen',t.name+' · '+t.email+': Alle eigenen Klassen werden dir als Superadmin zugeordnet. Der Lehrzugang zu sämtlichen Klassen entfällt. Schülerdaten in diesen Klassen bleiben erhalten. Ohne Kontolöschung bleiben persönlicher Lernstand und Schülerzugang erhalten.','Lehrerrolle entziehen','admin-revoke-teacher',()=>({memberId:t.id,deleteAccount:check.checked}),()=>load(null),label);
}
function allAccountsPanel(){
    const details=el('details',undefined,'teacher-accounts'),summary=el('summary','Alle Konten und Klassenzugehörigkeiten'),content=el('div');details.append(summary,content);
    let loaded=false;
    details.addEventListener('toggle',async()=>{
        if(!details.open||loaded)return;loaded=true;content.textContent='Konten werden geladen …';
        try{
            const r=await api('admin-accounts');if(!details.isConnected)return;content.replaceChildren();
            const search=el('input');search.type='search';search.placeholder='Name oder E-Mail suchen';search.setAttribute('aria-label','Konten suchen');content.append(search);
            const list=el('ul',undefined,'teacher-account-list');
            for(const a of r.accounts){
                const item=el('li'),identity=el('div');identity.append(el('strong',a.name),el('p',a.email,'teacher-person-email'),el('p','Mitglied in: '+(a.classes.map(c=>c.name).join(', ')||'Ohne Klasse'),'teacher-sub'));
                if(a.teachingClasses.length)identity.append(el('p','Lehrzugang: '+a.teachingClasses.map(c=>c.name+(c.isOwner?' (Inhaber)':' (gemeinsam)')).join(', '),'teacher-sub'));
                item.append(identity);
                if(a.superadmin)item.append(el('span','Superadmin · geschützt','teacher-sub'));
                else{
                    const edit=button('Bearbeiten',()=>fieldsForm('Konto bearbeiten',[['name','Anzeigename','text',a.name],['email','E-Mail-Adresse','email',a.email]],'admin-update-account',{memberId:a.id,previousEmail:a.email},()=>load(null)),'edit');
                    const remove=button('Löschen',()=>confirmAction('Konto löschen',a.name+' · '+a.email+': Konto, persönlicher Lernfortschritt und Programmcode werden aus allen Gruppen endgültig gelöscht.'+(a.isTeacher?' Eigene Klassen werden dir als Superadmin übertragen; deren Schülerkonten bleiben erhalten.':''),'Konto löschen','admin-delete-account',{memberId:a.id,confirmation:true},()=>load(null)),'trash','teacher-delete');
                    item.append(edit,remove);
                }
                item.dataset.search=(a.name+' '+a.email).toLocaleLowerCase('de');list.append(item);
            }
            search.addEventListener('input',()=>{for(const item of list.children)item.hidden=!item.dataset.search.includes(search.value.toLocaleLowerCase('de'));});
            content.append(el('p','E-Mail-Änderungen melden das Konto auf allen Geräten ab. Der Lernfortschritt bleibt erhalten.','teacher-sub'),list);
        }catch(e){content.textContent=e.message;loaded=false;}
    });return details;
}
async function addTeacher(c){
    try{
        const r=await api('teacher-candidates',{classId:c.id});if(selected!==c.id)return;
        const content=el('div');content.append(el('p','Nur bereits freigeschaltete Lehrkräfte können mitunterrichten. Sie sehen Fortschritt und können Schülerdaten bearbeiten. Klassenverwaltung und Löschungen bleiben beim Inhaber.'));
        let d;
        for(const t of r.candidates)content.append(button(t.name+' · '+t.email,()=>{d.close();fieldsForm('Lehrkraft hinzufügen',[['email','E-Mail-Adresse','email',t.email]],'teacher-add-teacher',{classId:c.id},renderDetail);},'plus'));
        if(!r.candidates.length)content.append(el('p','Keine weiteren Lehrkräfte mit deiner E-Mail-Domain verfügbar.','account-muted'));
        content.append(button('Über E-Mail hinzufügen',()=>{d.close();fieldsForm('Lehrkraft hinzufügen',[['email','E-Mail-Adresse','email','']],'teacher-add-teacher',{classId:c.id},renderDetail);},'plus'));
        d=dialog('Lehrpersonen hinzufügen',content);
    }catch(e){dialog('Lehrperson hinzufügen nicht möglich',el('p',e.message));}
}
function newClass(){const form=el('form');const label=el('label','Klassenname');const input=el('input');input.name='name';input.required=true;input.maxLength=100;input.autocomplete='off';label.append(input);const submit=el('button','Klasse erstellen');submit.type='submit';const error=el('p');error.setAttribute('role','alert');form.append(label,el('p','32 Schülerplätze · 5 Großbuchstaben · Beitrittscode 10 Tage gültig','account-muted'),submit,error);const d=dialog('Neue Klasse',form);d.querySelector('.account-close').textContent='Abbrechen';form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const r=await api('teacher-create-class',{name:input.value});d.close();selected=r.class.id;renderDetail(r);}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});input.focus();}
function renderList(r){clearTimeout(timer);selected=null;root.replaceChildren();if(r.profile.superadmin)root.append(adminPanel());root.append(transfersPanel());const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1','Meine Klassen'),el('p',`${r.ownedCount??r.classes.length} von ${r.classLimit} eigenen Klassen · ${r.profile.name}`,'teacher-muted'));const add=button('Klasse erstellen',newClass,'plus','teacher-primary');add.disabled=(r.ownedCount??r.classes.length)>=r.classLimit;header.append(heading,add);root.append(header,el('p','Gruppe: '+r.profile.className,'teacher-sub'));if(!r.classes.length){const empty=el('section',undefined,'teacher-panel teacher-empty');empty.append(el('h2','Deine erste Klasse'),el('p','Benenne deine Klasse. Du erhältst einen Beitrittscode für deine Schüler:innen.','teacher-muted'));root.append(empty);}for(const c of r.classes){const row=el('article',undefined,'teacher-panel teacher-row');const label=el('div');label.append(el('h2',c.name+(c.isOwner===false?' · gemeinsam':'')),el('p',`${c.members} / ${c.capacity} Schüler:innen · ${c.pending} E-Mail offen`,'teacher-sub'));row.append(icon('users'),label,button('Klasse ansehen',()=>load(c.id)));root.append(row);}}
function renderDetail(r){clearTimeout(timer);selected=r.class.id;const c=r.class;root.replaceChildren(button('Meine Klassen',()=>load(null),'back','teacher-link'));const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1',c.name),ownerLabel(c,r.profile));header.append(heading);if(c.isOwner!==false)header.append(button('Lehrpersonen hinzufügen',()=>addTeacher(c),'plus'));root.append(header);root.append(classTeachers(c));const box=el('section',undefined,'teacher-panel'),code=el('div',undefined,'teacher-code');code.append(icon('key'),el('span','Beitrittscode:'));if(c.invitation){code.append(el('strong',c.invitation.code));const copy=button('',async()=>{try{await navigator.clipboard.writeText(c.invitation.code);copy.setAttribute('aria-label','Beitrittscode kopiert');status.textContent='Beitrittscode kopiert.';}catch{status.textContent='Bitte den angezeigten Code markieren und kopieren.';}},'copy');copy.setAttribute('aria-label','Beitrittscode kopieren');code.append(copy,el('span','gültig bis '+new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna'}).format(new Date(c.invitation.expiresAt*1000)),'teacher-sub'));const delay=Math.max(0,(c.invitation.expiresAt-r.serverTime)*1000);timer=setTimeout(()=>load(c.id),Math.min(delay+1000,2147483647));}else{const generate=button('generieren',async()=>{generate.disabled=true;try{renderDetail(await api('teacher-renew-code',{classId:c.id}));}catch(e){status.textContent=e.message;generate.disabled=false;}},undefined,'teacher-link');generate.disabled=c.isOwner===false;code.append(generate);}const status=el('p',undefined,'teacher-sub');status.setAttribute('role','status');const count=el('div',undefined,'teacher-count');count.append(el('span',`${c.members} von ${c.capacity} Schülerplätzen belegt · ${c.pending} reserviert · ${c.free} frei`),button('Klasse löschen',()=>deleteDialog(c),undefined,'teacher-link teacher-delete'));if(c.isOwner===false)count.querySelector('button')?.remove();box.append(code,count,status);root.append(box);const section=el('div',undefined,'teacher-head');section.append(el('h2','Schüler:innen'),button('Aktualisieren',()=>load(c.id),'refresh'));root.append(section,progressGuide());if(!r.members.length){root.append(el('p','Noch keine Anmeldungen. Teile den Beitrittscode mit deiner Klasse.','teacher-panel teacher-empty'));return;}const wrap=el('div',undefined,'teacher-table-wrap'),table=el('table');table.setAttribute('aria-label','Mitglieder und Lernfortschritt');const head=el('thead'),hr=el('tr');for(const text of ['Name / E-Mail','Anmeldung','Fortschritt','Levelübersicht','Aktionen']){const th=el('th',text);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=el('tbody');for(const m of r.members){const row=el('tr'),name=el('td');name.append(el('strong',m.name),el('small',m.email));const state=el('td');state.dataset.label='Anmeldung';const status=m.status==='unverified'&&!m.isTeacher?button('bestätigen?',()=>emailDialog(c,m,true),'check','teacher-status teacher-verify'):el('span',undefined,'teacher-status'+(m.status==='confirmed'?'':' teacher-pending'));if(m.status!=='unverified'||m.isTeacher)status.append(icon(m.status==='confirmed'?'check':'clock'),m.status==='confirmed'?'Bestätigt':m.status==='pending'?'E-Mail offen':'Inaktiv');else status.setAttribute('aria-label','E-Mail von '+m.name+' bestätigen?');state.append(status);const value=el('td'),sections=el('td');value.dataset.label='Fortschritt';sections.dataset.label='Levelübersicht';if(m.completedIds===null){value.textContent=m.status==='pending'?'—':'Nicht verfügbar';sections.textContent='—';}else{const p=calculateProgress(Object.fromEntries(m.completedIds.map(id=>[id,''])),m.unlockedIds||[]);value.append(button(p.label,()=>details(m),undefined,'teacher-link'));value.firstChild.setAttribute('aria-label','Fortschritt von '+m.name);sections.append(progressList(p));}const actions=el('td'),remove=button('',()=>deleteDialog(c,m),'trash','teacher-delete');remove.setAttribute('aria-label',m.name+' löschen');remove.title='Nutzer löschen';if(m.status!=='pending'&&!m.isTeacher){const edit=button('',()=>emailDialog(c,m,false),'edit','teacher-edit');edit.setAttribute('aria-label',m.name+' bearbeiten');edit.title='Kontoinfo bearbeiten';actions.append(edit);}if(c.isOwner!==false){if(m.status!=='pending'&&!m.isTeacher){const transfer=button('',()=>studentTransferDialog(c,m),'transfer','teacher-edit');transfer.setAttribute('aria-label',m.name+' einer anderen Klasse zuordnen');actions.append(transfer);}actions.append(remove);}row.append(name,state,value,sections,actions);body.append(row);}table.append(body);wrap.append(table);root.append(wrap,el('p',teacherLegend,'teacher-sub'));}
async function load(id=null){const ticket=++version;selected=id;root.replaceChildren(el('p','Klassen werden geladen …'));try{const r=await api(id?'teacher-class':'teacher-classes',id?{classId:id}:undefined);if(ticket!==version)return;id?renderDetail(r):renderList(r);}catch(e){if(ticket===version)fail(e);}}
if(window.AgentAccountConfig?.enabled && await window.AgentLearningDataReady)await load();
else root.replaceChildren(el('h1','Meine Klassen'),el('p','Bitte melde dich mit einem freigeschalteten Lehrer:innenkonto an.'));
