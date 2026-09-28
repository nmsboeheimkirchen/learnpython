(() => {
    'use strict';
    const state=window.NullpunktLevel2Core.createState();
    const view=window.NullpunktDroneView.create(state);
    const byId=id=>document.getElementById(id);
    let chargingWait=null,resolveCharge=null,chargeFrame=null,completionShown=false;
    let learningStep=1,helpLevel=0,listRunConfirmed=false,equipmentName='',equipmentItems=[],invalidListName=false;
    const equipmentNames=['ausruestung','AUSRÜSTUNG','Ausrüstung','Ausruestung','AUSRUESTUNG'];
    const pythonNames=window.NullpunktPythonNames;
    const equipmentGlobal=name=>window.Sk.globals?.[pythonNames.globalName(name)];
    const helpHints=[
        '`print(fund)` sagt dir, dass du eine Energiezelle gefunden hast! Füge `fund` (also die Energiezelle) deiner Ausrüstung hinzu. Listen eignen sich, um Einträge (z. B. Fundstücke) zu speichern.',
        'Eine leere Liste schreibst du mit eckigen Klammern: `ausruestung = []`. Setze diese Zeile unter den Import. Mit der Listenmethode `append()` kannst du später einen Gegenstand hinzufügen. Welcher Wert steckt nach der Suche in `fund`?',
        'Ergänze nach der Suche und Ausgabe `ausruestung.append(fund)`. So landet dein Suchergebnis in der vorbereiteten Liste. Die leere Liste muss weiter oben stehen, damit sie den aufgenommenen Fund nicht wieder löscht.'
    ];
    const showNext=show=>{byId('next-level-btn').style.display=show?'inline-flex':'none';};
    function showListWarning(message){byId('list-warning').textContent=message;byId('list-warning').hidden=!message;}
    function hideHelp(){byId('nullpunkt-help-panel').hidden=true;byId('nullpunkt-help-btn').setAttribute('aria-expanded','false');}
    function setLearningStep(step){
        if(learningStep!==step){helpLevel=0;hideHelp();byId('nullpunkt-help-btn').textContent='Hilfe von der Zentrale anfordern';}
        learningStep=step;
        byId('learning-step').textContent=step===1?'Schritt 1 von 2 · Fund untersuchen':'Schritt 2 von 2 · Ausrüstung ergänzen';
        byId('search-task').hidden=step!==1;
        byId('equipment-task').hidden=step!==2;
        byId('nullpunkt-help').hidden=step!==2;
    }
    byId('nullpunkt-help-btn').addEventListener('click',()=>{
        if(learningStep!==2)return;
        if(helpLevel===2&&!listRunConfirmed){
            showListWarning(invalidListName?'Falscher Name, deine Liste soll ausruestung heißen!':'Lege die Liste ausruestung an! Starte danach den Flug, damit die Zentrale sie prüfen kann.');
            return;
        }
        helpLevel=Math.min(helpHints.length,helpLevel+1);
        byId('nullpunkt-help-level').textContent='Zentrale · Hinweis '+helpLevel+' von '+helpHints.length;
        const message=byId('nullpunkt-help-message');message.replaceChildren();
        helpHints[helpLevel-1].split('`').forEach((part,index)=>{
            if(index%2){const code=document.createElement('code');code.textContent=part;message.append(code);}
            else message.append(document.createTextNode(part));
        });
        byId('nullpunkt-help-panel').hidden=false;
        byId('nullpunkt-help-btn').setAttribute('aria-expanded','true');
        byId('nullpunkt-help-btn').textContent=helpLevel<helpHints.length?'Genaueren Hinweis anfordern':'Letzten Hinweis erneut ansehen';
    });
    document.addEventListener('drone:running',event=>{byId('nullpunkt-help-btn').disabled=Boolean(event.detail?.running);});
    function observeEquipment(context){
        const globals=window.Sk.globals||{};
        equipmentName=equipmentNames.find(name=>equipmentGlobal(name) instanceof window.Sk.builtin.list)||'';
        invalidListName=!equipmentName&&Object.values(globals).some(value=>value instanceof window.Sk.builtin.list);
        const list=equipmentName?equipmentGlobal(equipmentName):undefined;
        const equipment=equipmentName?context.getGlobal(pythonNames.globalName(equipmentName)):undefined;
        equipmentItems=equipment||[];
        state.observeEquipment(equipment,list);
        return {list,equipment};
    }
    function installAppendObserver(){
        // Follow the existing agent-training adapter; only this mission observes its list.
        const descriptor=window.Sk.builtin.list.prototype.append;
        if(descriptor.__nullpunktAppendWrapped)return;
        const original=descriptor.d$def.$meth;
        const wrapped=function(item){
            if(equipmentNames.some(name=>this===equipmentGlobal(name)))state.observeEquipment(window.Sk.ffi.remapToJs(this),this);
            const result=original.call(this,item);
            if(equipmentNames.some(name=>this===equipmentGlobal(name)))state.recordAppend(this,window.Sk.ffi.remapToJs(item));
            return result;
        };
        descriptor.d$def.$meth=wrapped;descriptor.$meth=wrapped;
        descriptor.__nullpunktAppendWrapped=true;
    }
    function render(){
        view.render();
        const current=state.snapshot();
        byId('energy-cell-label').textContent=current.charged?'✓ Energiezelle angeschlossen':'Energieflasche (−455, −85)';
        byId('equipment-value').textContent=current.charged?'Energiezelle':(current.found?'Fund noch nicht aufgenommen':'leer');
        byId('equipment-hud').hidden=!equipmentName;
        byId('equipment-name').textContent=equipmentName+':';
        byId('equipment-items').textContent=equipmentItems.length?equipmentItems.join(', '):'leer';
    }
    function cancelCharge(){
        if(chargeFrame!==null)cancelAnimationFrame(chargeFrame);
        chargeFrame=null;
        const resolve=resolveCharge;resolveCharge=null;resolve?.();
        chargingWait=null;
        document.body.classList.remove('nullpunkt-charging');
        byId('charge-status').hidden=true;
        view.setDisplayedEnergy(null);
    }
    function startCharge(from){
        view.clearAlarm();
        document.body.classList.add('nullpunkt-charging');
        byId('charge-status').hidden=false;
        byId('charge-status').textContent='Akku wird geladen …';
        byId('status-text').textContent='Energiezelle angeschlossen';
        byId('run-status').textContent='Akku wird geladen';
        document.querySelectorAll('#run-btn,[data-mission-run],#presentation-run-btn').forEach(button=>{button.textContent='Akku wird geladen …';});
        chargingWait=new Promise(resolve=>{resolveCharge=resolve;});
        const start=performance.now();
        function tick(now){
            const progress=Math.min(1,(now-start)/2000);
            view.setDisplayedEnergy(from+(100-from)*progress);
            if(progress===1)byId('charge-status').textContent='Akku geladen: 100 %';
            if(now-start<2600){chargeFrame=requestAnimationFrame(tick);return;}
            chargeFrame=null;document.body.classList.remove('nullpunkt-charging');
            view.setDisplayedEnergy(null);
            const resolve=resolveCharge;resolveCharge=null;resolve?.();
        }
        view.setDisplayedEnergy(from);
        chargeFrame=requestAnimationFrame(tick);
    }
    function result(){
        const current=state.snapshot();
        const passed=current.found&&current.printed&&current.charged&&!current.depleted&&!current.equipmentCleared;
        const investigated=current.found&&current.printed&&!current.depleted;
        const checkpoint=learningStep===1&&investigated&&!passed;
        let message='Fliege zur grünen Flasche bei (−455, −85). Untersuche sie und gib deinen Fund im Flugprotokoll aus.';
        if(current.depleted)message='Die Route hat zu viel Energie verbraucht. Beginne neu und fliege zuerst direkt zur nahen Energieflasche.';
        else if(current.found&&!current.printed)message='Du hast etwas gefunden. Lass dir dein Suchergebnis im Flugprotokoll anzeigen.';
        else if(checkpoint)message='Fund erkannt: eine Energiezelle! Schritt 1 ist geschafft. Ergänze jetzt deinen Code für die Ausrüstung. Der neue Auftrag steht über dem Editor.';
        else if(current.equipmentCleared)message='Die leere Liste muss weiter oben stehen, damit sie den aufgenommenen Fund nicht wieder löscht.';
        else if(investigated&&!current.listPrepared)message='Der Fund ist erkannt. Lege eine leere Ausrüstungsliste an. Bei Bedarf hilft dir die Zentrale.';
        else if(investigated&&!current.charged)message='Die Liste ist vorbereitet. Ergänze sie jetzt um deinen Fund, solange die Drohne bei der Flasche ist. Bei Bedarf hilft dir die Zentrale.';
        if(passed)message='Die gefundene Energiezelle versorgt jetzt die Drohne. Mit vollem Akku kannst du im nächsten Level PICO erreichen.';
        const checks=[{label:'Fund vor Ort untersucht',passed:current.found},{label:'Fund ausgegeben',passed:current.printed}];
        if(learningStep===2||passed)checks.push({label:'Ausrüstungsliste angelegt',passed:Boolean(equipmentName)},{label:'Fund zur Liste hinzugefügt und Akku geladen',passed:passed});
        const listWarning=current.equipmentCleared?'Die leere Liste muss weiter oben stehen, damit sie den aufgenommenen Fund nicht wieder löscht.':
            (!equipmentName?(invalidListName?'Falscher Name, deine Liste soll ausruestung heißen!':'Lege die Liste ausruestung an!'):(!current.listPrepared?'Lege die Liste ausruestung zunächst leer an!':''));
        return {passed:passed||checkpoint,levelComplete:passed,investigated,listWarning:learningStep===2?listWarning:'',listConfirmed:Boolean(equipmentName&&current.listPrepared),title:passed?'Bereit für den Flug zu PICO':(checkpoint?'Schritt 1 geschafft':(learningStep===1?'Fund untersuchen':'Ausrüstung ergänzen')),message,
            status:passed?'Akku geladen':(checkpoint?'Schritt 2: Ausrüstung ergänzen':'Auftrag weiterbearbeiten'),statusState:passed||checkpoint?'success':'warning',checks};
    }
    window.DRONE_MISSION_CONFIG={
        prepareCode:pythonNames.prepareCode,formatError:pythonNames.formatError,
        levelId:'pico_level2',targetId:'pico-mission-turtle',defaultCode:byId('python-editor').value,
        inheritCode:false,unlocks:['link-pico-l3'],runLabel:'Flug starten',runningLabel:'Drohne unterwegs',
        readyLabel:'Bereit zur Suche',resetLabel:'↺ Startcode laden',
        resetOutput:'Plane einen neuen Flug vom Zugang zur grünen Energieflasche.',
        initialMessage:'Untersuche die grüne Flasche und mache deinen Fund im Flugprotokoll sichtbar.',
        initialChecks:['Fund vor Ort untersuchen','Fund ausgeben'],
        resetHud({reason}={}){
            cancelCharge();state.reset();view.reset();completionShown=false;showNext(false);
            equipmentName='';equipmentItems=[];invalidListName=false;listRunConfirmed=false;showListWarning('');
            if(reason!=='run'){
                setLearningStep(1);helpLevel=0;hideHelp();
                byId('nullpunkt-help-btn').textContent='Hilfe von der Zentrale anfordern';
                byId('search-task').querySelector('details').open=false;
            }
            byId('status-text').textContent=learningStep===1?'Schritt 1: Fund untersuchen':'Schritt 2: Ausrüstung ergänzen';byId('status-text').style.color='';
            byId('progress-fill').style.width='50%';render();
        },
        onRunStart(){installAppendObserver();hideHelp();view.prepareAudio();byId('status-text').textContent='Drohne unterwegs';},
        onRunCancel(){cancelCharge();view.clearAlarm();},
        onRunError(){cancelCharge();view.clearAlarm();if(learningStep===2)showListWarning(state.snapshot().equipmentCleared?'Die leere Liste muss weiter oben stehen, damit sie den aufgenommenen Fund nicht wieder löscht.':(!equipmentName?(invalidListName?'Falscher Name, deine Liste soll ausruestung heißen!':'Lege die Liste ausruestung an!'):''));},
        droneApi:{suche_hier(context){const {equipment}=observeEquipment(context);const item=state.searchHere(equipment);render();return item;}},
        onOutput(text){state.recordOutput(text);},
        syncPythonState(context){
            const before=state.snapshot().energy;
            const {list,equipment}=observeEquipment(context);
            const chargedNow=state.syncEquipment(equipment,list);
            if(chargedNow)startCharge(before);
            render();return chargedNow?{resumeMovement:true}:null;
        },
        limitTurtleMovement:state.limitMovement,
        onTurtleFrame(point){const frame=state.recordFrame(point);render();if(frame.stop)view.showEnergyWarning();return frame.stop?frame:null;},
        async beforeFinish(){await view.waitForAlarm();await chargingWait;},
        getRunNotice(){
            const s=state.snapshot();
            if(s.charged)return 'Ladevorgang beendet. Akku: '+Math.round(s.energy)+' %.';
            if(s.depleted)return 'Flug gestoppt: Akku leer. Plane die Route neu.';
            if(s.lastSearchFailure==='WRONG_PLACE')return 'An dieser Position findet die Drohne keinen Gegenstand.';
            if(s.found&&s.printed)return 'Fund untersucht. Prüfe den nächsten Auftrag über dem Editor.';
            return 'Untersuche die grüne Flasche und mache deinen Fund im Flugprotokoll sichtbar.';
        },
        validate:result,
        onResult(result){
            if(result.listConfirmed)listRunConfirmed=true;
            if(result.listWarning!==undefined)showListWarning(result.listWarning);
            if(result.investigated||result.restored)setLearningStep(2);
            const complete=Boolean(result.passed&&result.levelComplete);showNext(complete);
            if(result.status)byId('status-text').textContent=result.status;
            if(!complete||result.restored||completionShown)return;
            completionShown=true;
            window.triggerSuccess?.(false,'Die Energiezelle ist angeschlossen und der Akku geladen. Jetzt kannst du den Wartungszugang von PICO erreichen.',{
                rewardCount:4,title:'ENERGIE GESICHERT',celebration:'coins',primaryHref:'pico_level3.html',
                primaryLabel:'Weiter zu Level 3',closeLabel:'Zurück zum Editor',statusLabel:'LEVEL 2 GESCHAFFT!'
            });
        },
        getRestoredResult:()=>({passed:true,levelComplete:true,restored:true,title:'Level 2 bereits geschafft',message:'Dein gespeicherter Code ist erhalten. Mit „Startcode laden“ kannst du die neue Route ausprobieren.',status:'Bereits geschafft',statusState:'success',checks:[]}),
        getState:()=>({...state.snapshot(),learningStep,helpLevel,listRunConfirmed,equipmentName,equipmentItems:[...equipmentItems]})
    };
})();
