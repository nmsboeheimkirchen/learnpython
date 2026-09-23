import {calculateProgress,progressLegend,teacherProgressGuide} from './course-progress.js';
const root=document.getElementById('teacher-content');
const chrome=window.parent!==window && window.parent.location.origin===location.origin ? window.parent.document : document;
const paths={trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H3V3h12v2"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-4l2 3M19 16a8 8 0 0 1-13 4l-2-3"/>',back:'<path d="M20 12H4m6-6-6 6 6 6"/>',check:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 7 10-7m-14 11 3 3 5-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
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
    ['Kapitel','Was zählt','Kumuliert','Leveldetails','Notenvorschlag'].forEach(title=>{const th=el('th',title);th.scope='col';headRow.append(th);});
    head.append(headRow);table.append(head);const body=el('tbody');
    for(const row of teacherProgressGuide){const tr=el('tr');row.forEach(text=>tr.append(el('td',text)));body.append(tr);}
    table.append(body);wrap.append(table);guide.append(wrap,
        el('p','* bedeutet optional. 02-3 bringt 5 Bonuspunkte, das zweite Projekt anteilig bis zu 20. Maximal sind 125 % möglich. Fehlende Pflichtaufgaben bleiben trotz Bonus sichtbar.'),
        el('p','Notenvorschläge sind eine unverbindliche Orientierung: NG = Nicht genügend, G = Genügend, B = Befriedigend, Gut = Gut, SG = Sehr gut. nur Museumsbriefing ohne optionales Level: B. Die Lehrperson entscheidet unter Berücksichtigung von Selbstständigkeit und Verständnis.','teacher-sub'));
    return guide;
}

function deleteDialog(c,member=null){
    const form=el('form'),error=el('p');error.setAttribute('role','alert');
    form.append(el('p',member
        ? member.status==='pending' ? `Die offene Anmeldung von ${member.name} (${member.email}) wird gelöscht. Ihr Bestätigungslink wird ungültig.`
        : `Das Konto von ${member.name} (${member.email}), alle Schülerdaten, der Lernfortschritt und der gespeicherte Programmcode werden endgültig gelöscht.`
        : `Die Klasse „${c.name}“, alle zugehörigen Schülerkonten, Schülerdaten, Lernfortschritte und gespeicherten Programmcodes werden endgültig gelöscht. Auch Beitrittscodes und offene Anmeldungen werden ungültig.`));
    form.append(el('p','Das lässt sich in der Anwendung nicht rückgängig machen.','teacher-error'));
    let input;
    if(!member){const label=el('label','Tippe zur Bestätigung LÖSCHEN');input=el('input');input.name='confirmation';input.autocomplete='off';input.required=true;label.append(input);form.append(label);}
    const submit=el('button',member?'Nutzer löschen':'Klasse löschen');submit.type='submit';submit.disabled=!member;
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

function newClass(){const form=el('form');const label=el('label','Klassenname');const input=el('input');input.name='name';input.required=true;input.maxLength=100;input.autocomplete='off';label.append(input);const submit=el('button','Klasse erstellen');submit.type='submit';const error=el('p');error.setAttribute('role','alert');form.append(label,el('p','32 Schülerplätze · 5 Großbuchstaben · Beitrittscode 10 Tage gültig','account-muted'),submit,error);const d=dialog('Neue Klasse',form);d.querySelector('.account-close').textContent='Abbrechen';form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const r=await api('teacher-create-class',{name:input.value});d.close();selected=r.class.id;renderDetail(r);}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});input.focus();}
function renderList(r){clearTimeout(timer);selected=null;root.replaceChildren();const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1','Meine Klassen'),el('p',`${r.classes.length} von ${r.classLimit} Klassen · ${r.profile.name}`,'teacher-muted'));const add=button('Klasse erstellen',newClass,'plus','teacher-primary');add.disabled=r.classes.length>=r.classLimit;header.append(heading,add);root.append(header,el('p','Gruppe: '+r.profile.className,'teacher-sub'));if(!r.classes.length){const empty=el('section',undefined,'teacher-panel teacher-empty');empty.append(el('h2','Deine erste Klasse'),el('p','Benenne deine Klasse. Du erhältst einen Beitrittscode für deine Schüler:innen.','teacher-muted'));root.append(empty);}for(const c of r.classes){const row=el('article',undefined,'teacher-panel teacher-row');const label=el('div');label.append(el('h2',c.name),el('p',`${c.members} / ${c.capacity} Schüler:innen · ${c.pending} E-Mail offen`,'teacher-sub'));row.append(icon('users'),label,button('Klasse ansehen',()=>load(c.id)));root.append(row);}}
function renderDetail(r){clearTimeout(timer);selected=r.class.id;const c=r.class;root.replaceChildren(button('Meine Klassen',()=>load(null),'back','teacher-link'));const header=el('div',undefined,'teacher-head'),heading=el('div');heading.append(el('h1',c.name),el('p','Klasseninhaber: '+r.profile.name,'teacher-muted'));header.append(heading);root.append(header);const box=el('section',undefined,'teacher-panel'),code=el('div',undefined,'teacher-code');code.append(icon('key'),el('span','Beitrittscode:'));if(c.invitation){code.append(el('strong',c.invitation.code));const copy=button('',async()=>{try{await navigator.clipboard.writeText(c.invitation.code);copy.setAttribute('aria-label','Beitrittscode kopiert');status.textContent='Beitrittscode kopiert.';}catch{status.textContent='Bitte den angezeigten Code markieren und kopieren.';}},'copy');copy.setAttribute('aria-label','Beitrittscode kopieren');code.append(copy,el('span','gültig bis '+new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna'}).format(new Date(c.invitation.expiresAt*1000)),'teacher-sub'));const delay=Math.max(0,(c.invitation.expiresAt-r.serverTime)*1000);timer=setTimeout(()=>load(c.id),Math.min(delay+1000,2147483647));}else{const generate=button('generieren',async()=>{generate.disabled=true;try{renderDetail(await api('teacher-renew-code',{classId:c.id}));}catch(e){status.textContent=e.message;generate.disabled=false;}},undefined,'teacher-link');code.append(generate);}const status=el('p',undefined,'teacher-sub');status.setAttribute('role','status');const count=el('div',undefined,'teacher-count');count.append(el('span',`${c.members} von ${c.capacity} Schülerplätzen belegt · ${c.pending} reserviert · ${c.free} frei`),button('Klasse löschen',()=>deleteDialog(c),undefined,'teacher-link teacher-delete'));box.append(code,count,status);root.append(box);const section=el('div',undefined,'teacher-head');section.append(el('h2','Schüler:innen'),button('Aktualisieren',()=>load(c.id),'refresh'));root.append(section,progressGuide());if(!r.members.length){root.append(el('p','Noch keine Anmeldungen. Teile den Beitrittscode mit deiner Klasse.','teacher-panel teacher-empty'));return;}const wrap=el('div',undefined,'teacher-table-wrap'),table=el('table');table.setAttribute('aria-label','Mitglieder und Lernfortschritt');const head=el('thead'),hr=el('tr');for(const text of ['Name / E-Mail','Anmeldung','Fortschritt','Erreichte Abschnitte','Aktionen']){const th=el('th',text);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=el('tbody');for(const m of r.members){const row=el('tr'),name=el('td');name.append(el('strong',m.name),el('small',m.email));const state=el('td');state.dataset.label='Anmeldung';const status=el('span',undefined,'teacher-status'+(m.status==='confirmed'?'':' teacher-pending'));status.append(icon(m.status==='confirmed'?'check':'clock'),m.status==='confirmed'?'Bestätigt':m.status==='pending'?'E-Mail offen':'Inaktiv');state.append(status);const value=el('td'),sections=el('td');value.dataset.label='Fortschritt';sections.dataset.label='Erreichte Abschnitte';if(m.completedIds===null){value.textContent=m.status==='pending'?'—':'Nicht verfügbar';sections.textContent='—';}else{const p=calculateProgress(Object.fromEntries(m.completedIds.map(id=>[id,''])));value.textContent=p.label;const completed=p.rows.flatMap(row=>row.sections).filter(s=>s.completed);
if(completed.length){const show=button('',()=>details(m),undefined,'teacher-link');show.setAttribute('aria-label','Fortschritt von '+m.name);completed.forEach((s,i)=>{if(i)show.append(', ');show.append(progressStatus(s));});sections.append(show);}else sections.textContent='Noch kein Abschnitt';}const actions=el('td'),remove=button('',()=>deleteDialog(c,m),'trash','teacher-delete');remove.setAttribute('aria-label',m.name+' löschen');remove.title='Nutzer löschen';actions.append(remove);row.append(name,state,value,sections,actions);body.append(row);}table.append(body);wrap.append(table);root.append(wrap,el('p',progressLegend,'teacher-sub'));}
async function load(id=null){const ticket=++version;selected=id;root.replaceChildren(el('p','Klassen werden geladen …'));try{const r=await api(id?'teacher-class':'teacher-classes',id?{classId:id}:undefined);if(ticket!==version)return;id?renderDetail(r):renderList(r);}catch(e){if(ticket===version)fail(e);}}
if(window.AgentAccountConfig?.enabled && await window.AgentLearningDataReady)await load();
else root.replaceChildren(el('h1','Meine Klassen'),el('p','Bitte melde dich mit einem freigeschalteten Lehrer:innenkonto an.'));
