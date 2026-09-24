import {calculateProgress,progressLegend,teacherProgressGuide} from './course-progress.js';
const root=document.getElementById('teacher-content');
const chrome=window.parent!==window && window.parent.location.origin===location.origin ? window.parent.document : document;
const paths={edit:'<path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H3V3h12v2"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-4l2 3M19 16a8 8 0 0 1-13 4l-2-3"/>',back:'<path d="M20 12H4m6-6-6 6 6 6"/>',check:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 7 10-7m-14 11 3 3 5-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
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
    const node=el('span',section.code+(section.optional?'*':'')+(section.completed?' ✓':' · offen'),
        section.completed?'account-progress-done':'account-progress-pending');
    if(section.optional)node.classList.add('account-progress-optional');
    return node;
}
function details(member){
    const p=calculateProgress(Object.fromEntries(member.completedIds.map(id=>[id,''])));
    const content=el('div');content.append(el('p',p.label,'account-progress-number'));
    const list=el('ul',undefined,'account-progress-list');
    for(const row of p.rows){
        const li=el('li');li.append(el('strong',row.label+': '));
        row.sections.forEach((s,i)=>{if(i)li.append(', ');li.append(progressStatus(s));});list.append(li);
    }
    content.append(list,el('p',progressLegend,'account-muted'));dialog(member.name,content);
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
    if(!member)form.append(el('p','Schülerkonten ohne weitere Klasse, Lernfortschritte und gespeicherte Programmcodes werden gelöscht. Beitrittscode und offene Anmeldungen entfallen.','teacher-danger'));
    if(protectedMembers.length){
        const protectedList=el('ul',undefined,'teacher-preserved');
        for(const m of protectedMembers)protectedList.append(el('li',`${m.email} – auch in: ${m.otherClasses.map(c=>c.name).join(', ')}. Konto, Lernfortschritt und Programmcode bleiben erhalten.`));
        form.append(protectedList);
    }
    if(!shared)form.append(el('p','Nicht rückgängig zu machen.','teacher-danger'));
    let input;
    if(!member){const label=el('label','Tippe zur Bestätigung LÖSCHEN');input=el('input');input.name='confirmation';input.autocomplete='off';input.required=true;label.append(input);form.append(label);}
    const submit=el('button',member?(shared?'Aus Klasse entfernen':'Nutzer löschen'):'Klasse löschen');submit.type='submit';submit.disabled=!member;
    if(input)input.addEventListener('input',()=>{submit.disabled=input.value!=='LÖSCHEN';});
    form.append(error,submit);
    const d=dialog(member?'Nutzer löschen':'Klasse löschen',form),cancel=d.querySelector('.account-close');cancel.textContent='Abbrechen';
    let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy||(!member&&input.value!=='LÖSCHEN'))return;
        busy=true;submit.disabled=true;cancel.disabled=true;
        try{
            const result=await api(member?'teacher-delete-member':'teacher-delete-class',member
                ? {classId:c.id,memberId:member.id,kind:member.status==='pending'?'pending':'user'}
                : {classId:c.id,confirmation:input.value});
            d.close();member?renderDetail(result):renderList(result);
        }catch(failure){error.textContent=failure.message;}
        finally{busy=false;submit.disabled=false;cancel.disabled=false;}
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

function newClass(){const form=el('form');const label=el('label','Klassenname');const input=el('input');input.name='name';input.required=true;input.maxLength=100;input.autocomplete='off';label.append(input);const submit=el('button','Klasse erstellen');submit.type='submit';const error=el('p');error.setAttribute('role','alert');form.append(label,el('p','32 Schülerplätze · 5 Großbuchstaben · Beitrittscode 10 Tage gültig','account-muted'),submit,error);const d=dialog('Neue Klasse',form);d.querySelector('.account-close').textContent='Abbrechen';form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const r=await api('teacher-create-class',{name:input.value});d.close();selected=r.class.id;renderDetail(r);}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});input.focus();}
function renderList(r){clearTimeout(timer);selected=null;root.replaceChildren();const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1','Meine Klassen'),el('p',`${r.classes.length} von ${r.classLimit} Klassen · ${r.profile.name}`,'teacher-muted'));const add=button('Klasse erstellen',newClass,'plus','teacher-primary');add.disabled=r.classes.length>=r.classLimit;header.append(heading,add);root.append(header,el('p','Gruppe: '+r.profile.className,'teacher-sub'));if(!r.classes.length){const empty=el('section',undefined,'teacher-panel teacher-empty');empty.append(el('h2','Deine erste Klasse'),el('p','Benenne deine Klasse. Du erhältst einen Beitrittscode für deine Schüler:innen.','teacher-muted'));root.append(empty);}for(const c of r.classes){const row=el('article',undefined,'teacher-panel teacher-row');const label=el('div');label.append(el('h2',c.name),el('p',`${c.members} / ${c.capacity} Schüler:innen · ${c.pending} E-Mail offen`,'teacher-sub'));row.append(icon('users'),label,button('Klasse ansehen',()=>load(c.id)));root.append(row);}}
function renderDetail(r){clearTimeout(timer);selected=r.class.id;const c=r.class;root.replaceChildren(button('Meine Klassen',()=>load(null),'back','teacher-link'));const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1',c.name),el('p','Klasseninhaber: '+r.profile.name,'teacher-muted'));header.append(heading);root.append(header);const box=el('section',undefined,'teacher-panel'),code=el('div',undefined,'teacher-code');code.append(icon('key'),el('span','Beitrittscode:'));if(c.invitation){code.append(el('strong',c.invitation.code));const copy=button('',async()=>{try{await navigator.clipboard.writeText(c.invitation.code);copy.setAttribute('aria-label','Beitrittscode kopiert');status.textContent='Beitrittscode kopiert.';}catch{status.textContent='Bitte den angezeigten Code markieren und kopieren.';}},'copy');copy.setAttribute('aria-label','Beitrittscode kopieren');code.append(copy,el('span','gültig bis '+new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna'}).format(new Date(c.invitation.expiresAt*1000)),'teacher-sub'));const delay=Math.max(0,(c.invitation.expiresAt-r.serverTime)*1000);timer=setTimeout(()=>load(c.id),Math.min(delay+1000,2147483647));}else{const generate=button('generieren',async()=>{generate.disabled=true;try{renderDetail(await api('teacher-renew-code',{classId:c.id}));}catch(e){status.textContent=e.message;generate.disabled=false;}},undefined,'teacher-link');code.append(generate);}const status=el('p',undefined,'teacher-sub');status.setAttribute('role','status');const count=el('div',undefined,'teacher-count');count.append(el('span',`${c.members} von ${c.capacity} Schülerplätzen belegt · ${c.pending} reserviert · ${c.free} frei`),button('Klasse löschen',()=>deleteDialog(c),undefined,'teacher-link teacher-delete'));box.append(code,count,status);root.append(box);const section=el('div',undefined,'teacher-head');section.append(el('h2','Schüler:innen'),button('Aktualisieren',()=>load(c.id),'refresh'));root.append(section,progressGuide());if(!r.members.length){root.append(el('p','Noch keine Anmeldungen. Teile den Beitrittscode mit deiner Klasse.','teacher-panel teacher-empty'));return;}const wrap=el('div',undefined,'teacher-table-wrap'),table=el('table');table.setAttribute('aria-label','Mitglieder und Lernfortschritt');const head=el('thead'),hr=el('tr');for(const text of ['Name / E-Mail','Anmeldung','Fortschritt','Erreichte Abschnitte','Aktionen']){const th=el('th',text);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=el('tbody');for(const m of r.members){const row=el('tr'),name=el('td');name.append(el('strong',m.name),el('small',m.email));const state=el('td');state.dataset.label='Anmeldung';const status=m.status==='unverified'?button('bestätigen?',()=>emailDialog(c,m,true),'check','teacher-status teacher-verify'):el('span',undefined,'teacher-status'+(m.status==='confirmed'?'':' teacher-pending'));if(m.status!=='unverified')status.append(icon(m.status==='confirmed'?'check':'clock'),m.status==='confirmed'?'Bestätigt':m.status==='pending'?'E-Mail offen':'Inaktiv');else status.setAttribute('aria-label','E-Mail von '+m.name+' bestätigen?');state.append(status);const value=el('td'),sections=el('td');value.dataset.label='Fortschritt';sections.dataset.label='Erreichte Abschnitte';if(m.completedIds===null){value.textContent=m.status==='pending'?'—':'Nicht verfügbar';sections.textContent='—';}else{const p=calculateProgress(Object.fromEntries(m.completedIds.map(id=>[id,''])));value.textContent=p.label;const completed=p.rows.flatMap(row=>row.sections).filter(s=>s.completed);
if(completed.length){const show=button('',()=>details(m),undefined,'teacher-link');show.setAttribute('aria-label','Fortschritt von '+m.name);completed.forEach((s,i)=>{if(i)show.append(', ');show.append(progressStatus(s));});sections.append(show);}else sections.textContent='Noch kein Abschnitt';}const actions=el('td'),remove=button('',()=>deleteDialog(c,m),'trash','teacher-delete');remove.setAttribute('aria-label',m.name+' löschen');remove.title='Nutzer löschen';if(m.status!=='pending'){const edit=button('',()=>emailDialog(c,m,false),'edit','teacher-edit');edit.setAttribute('aria-label',m.name+' bearbeiten');edit.title='Kontoinfo bearbeiten';actions.append(edit);}actions.append(remove);row.append(name,state,value,sections,actions);body.append(row);}table.append(body);wrap.append(table);root.append(wrap,el('p',progressLegend,'teacher-sub'));}
async function load(id=null){const ticket=++version;selected=id;root.replaceChildren(el('p','Klassen werden geladen …'));try{const r=await api(id?'teacher-class':'teacher-classes',id?{classId:id}:undefined);if(ticket!==version)return;id?renderDetail(r):renderList(r);}catch(e){if(ticket===version)fail(e);}}
if(window.AgentAccountConfig?.enabled && await window.AgentLearningDataReady)await load();
else root.replaceChildren(el('h1','Meine Klassen'),el('p','Bitte melde dich mit einem freigeschalteten Lehrer:innenkonto an.'));
