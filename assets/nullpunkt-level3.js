(() => {
    'use strict';
    const byId=id=>document.getElementById(id),core=window.DroneMissionCore,register=window.NullpunktRegisterCore;
    const reauth=Boolean(window.NullpunktTerminalOnly);
    const reauthToken=new URLSearchParams(location.search).get('reauthToken');
    const notifyParent=data=>window.parent.postMessage({...data,token:reauthToken},location.protocol==='file:'?'*':location.origin);
    if(reauth){
        document.body.classList.add('nullpunkt-reauth');
        byId('mission-title').textContent='Öffne den Zugang erneut';
        document.querySelector('.terminal-intro p').textContent='PICO hat den Wartungszugang gesperrt. Löse das neue Zugangsrätsel des Lords. Dein letzter Kalibrierversuch bleibt erhalten.';
        byId('register-continue').textContent='Zurück zu deinem Codeversuch';
        const sendSize=()=>notifyParent({type:'nullpunkt:terminal-size',height:byId('main-content').scrollHeight+32});
        new ResizeObserver(sendSize).observe(byId('main-content'));
    }
    const flight=window.NullpunktLevel1Core.createState({start:window.NullpunktLevel1Core.ENERGY_CELL,initialEnergy:100,initiallyCharged:true});
    const view=window.NullpunktDroneView.create(flight);
    let reached=false,solved=false,flownCode='',task=register.generate(),values=[1,1,1,1],failures=0,helpLevel=0;
    let checked=null,checkVersion=0,lastHelpVersion=0,unlockTimer=null,unlockPending=false,hintVisible=false;
    const signed=value=>value>0?'+'+value:String(value);
    function showCamera(show){
        byId('terminal-view').hidden=!show;
        byId('flight-workspace').hidden=show;
        document.body.classList.toggle('nullpunkt-terminal-active',show);
        if(show){
            byId('terminal-view').scrollIntoView({behavior:'auto',block:'start'});
            byId('spin-0').focus({preventScroll:true});
        }
    }
    function renderReasoning(){
        byId('register-hint-title').textContent=hintVisible?'Analyse der Zentrale':'Deine Zentrale';
        byId('register-hint').hidden=!hintVisible;
        byId('register-hint').replaceChildren();
        if(hintVisible){
            if(helpLevel===1){
                const method=document.createElement('p');
                method.textContent='Zeile 1: Ersetze Q1, Q2, Q3 und Q4 durch +1 oder −1 – passend zu deinen Pfeilen – und rechne nach.';
                byId('register-hint').append(method);
            }
            const analysis=register.reasoning(task,values,Boolean(checked));
            const list=document.createElement('ol');list.className='register-analysis';
            for(const line of analysis.lines){
                const row=document.createElement('li');row.value=line.row;
                const label=document.createElement('span');label.textContent=line.label+': ';
                const equation=document.createElement('code');equation.textContent=line.equation;
                const correct=document.createElement('strong');correct.textContent=' ✓ Korrekt';
                row.append(label,equation,correct);list.append(row);
            }
            const summary=document.createElement('p');summary.className='register-analysis-summary';summary.textContent=analysis.summary;
            byId('register-hint').append(list,summary);
        }
        const canRequest=checkVersion>lastHelpVersion&&Boolean(checked)&&!unlockPending&&!solved;
        byId('register-help-btn').disabled=!canRequest;
        byId('register-help-btn').textContent=solved||unlockPending?'Alle Prüfbedingungen erfüllt':(helpLevel===0?'Hilfe von der Zentrale anfordern':(canRequest?'Analyse der Zentrale anfordern':'Erst erneut Zustand prüfen'));
    }
    function renderRegister(){
        const [a,b]=task.pairA.map(i=>'Q'+(i+1)),[c,d]=task.pairB.map(i=>'Q'+(i+1));
        const rules=[`Q1 + Q2 + Q3 + Q4 = ${task.total}`,`${a} · ${b} = ${signed(task.productA)}`,`${c} · ${d} = ${signed(task.productB)}`,`${a} ${task.sign===1?'+':'−'} ${b} = ${signed(task.anchor)}`];
        byId('register-rules').replaceChildren(...rules.map((text,i)=>{
            const row=document.createElement('li');const number=document.createElement('span');number.className='register-row-number';number.textContent='0'+(i+1);
            const expression=document.createElement('span');expression.className='register-expression';expression.textContent=text;
            const tick=document.createElement('span');tick.className='register-tick';tick.textContent='✓';tick.hidden=!checked?.[i];tick.setAttribute('aria-label','Prüfbedingung erfüllt');
            row.classList.toggle('is-passed',Boolean(checked?.[i]));row.append(number,expression,tick);return row;
        }));
        values.forEach((value,i)=>{const button=byId('spin-'+i);button.textContent=value===1?'↑':'↓';button.setAttribute('aria-label','Q'+(i+1)+': '+signed(value)+', umschalten');button.setAttribute('aria-pressed',String(value===1));button.disabled=solved||unlockPending;});
        byId('register-check').disabled=solved||unlockPending;
        byId('back-to-flight').disabled=unlockPending;
        byId('register-puzzle').hidden=solved;
        byId('register-unlocked').hidden=!solved;
        document.querySelector('.register-screen').setAttribute('aria-labelledby',solved?'unlocked-title':'register-title');
        renderReasoning();
    }
    function resetRegister(){
        if(unlockTimer!==null)clearTimeout(unlockTimer);
        unlockTimer=null;unlockPending=false;checked=null;checkVersion=0;lastHelpVersion=0;hintVisible=false;
        task=register.generate();values=[1,1,1,1];failures=0;helpLevel=0;solved=false;
        byId('register-feedback').textContent='Stelle die vier Pfeile passend zu den Prüfdaten ein.';
        byId('register-feedback').className='';
        renderRegister();
    }
    values.forEach((_,i)=>byId('spin-'+i).addEventListener('click',()=>{
        if(solved||unlockPending)return;values[i]*=-1;checked=null;hintVisible=false;
        byId('register-feedback').textContent='Pfeile geändert. Prüfe den neuen Zustand.';byId('register-feedback').className='';renderRegister();
    }));
    byId('register-check').addEventListener('click',()=>{
        const runtime=window.DroneMissionRuntime;
        if(!reached||runtime.isRunning()||solved||unlockPending)return;
        if(runtime.editor.getValue()!==flownCode){byId('register-feedback').textContent='Dein Flugcode wurde verändert. Starte den Flug erneut.';return;}
        checked=register.evaluate(task,values);checkVersion++;hintVisible=false;
        const count=checked.filter(Boolean).length;
        if(count!==4){
            failures++;byId('register-feedback').textContent='Zugriff verweigert · '+count+' / 4 Prüfbedingungen erfüllt.';
            byId('register-feedback').className='is-error';
            renderRegister();return;
        }
        unlockPending=true;renderRegister();byId('register-feedback').textContent='4 / 4 Prüfbedingungen erfüllt · Zugang wird geöffnet …';
        byId('register-feedback').className='is-success';
        byId('register-puzzle').scrollIntoView({behavior:'auto',block:'center'});
        unlockTimer=setTimeout(()=>{
            unlockTimer=null;unlockPending=false;
            if(!reached||runtime.editor.getValue()!==flownCode){
                checked=null;byId('register-feedback').textContent='Dein Flugcode wurde verändert. Starte den Flug erneut.';renderRegister();return;
            }
            solved=true;renderRegister();runtime.refresh();
            byId('register-continue').focus({preventScroll:true});
        },3000);
    });
    byId('register-help-btn').addEventListener('click',()=>{
        if(checkVersion<=lastHelpVersion||!checked||unlockPending||solved)return;
        helpLevel++;
        lastHelpVersion=checkVersion;hintVisible=true;renderReasoning();
    });
    // Keep UNLOCKED visible until the learner chooses to continue to the reward.
    byId('register-continue').addEventListener('click',()=>{
        if(!solved||!reached)return;
        if(reauth){notifyParent({type:'nullpunkt:terminal-unlocked'});return;}
        window.triggerSuccess?.(false,'Das Quantenregister ist korrekt eingestellt. Der Wartungszugang von PICO ist offen.',{rewardCount:4,title:'ZUGANG FREIGEGEBEN',celebration:'coins',primaryHref:'pico_level4.html',primaryLabel:'Weiter zu Level 4',closeLabel:'Zurück zum Terminal',statusLabel:'LEVEL 3 GESCHAFFT!'});
    });
    byId('back-to-flight').addEventListener('click',()=>showCamera(false));
    byId('return-to-terminal').addEventListener('click',()=>{if(reached)showCamera(true);});
    function result(){
        const passed=reached&&solved;
        return {passed:passed||reached,levelComplete:passed,title:passed?'Wartungszugang geöffnet':(reached?'PICO erreicht':'Erreiche das Wartungsterminal'),
            message:passed?'Das Quantenregister stimmt. Der Wartungszugang ist offen – weiter zu Level 4.':(reached?'Die Drohnenkamera zeigt jetzt den Wartungszugang. Stelle das Quantenregister passend zu den Prüfdaten ein.':'Fliege von der Energieflasche zum Wartungsterminal bei (220, 15).'),
            status:passed?'Zugriff freigegeben':(reached?'Quantenregister gesperrt':'Flugroute prüfen'),statusState:reached?'success':'warning',
            checks:[{label:'Wartungsterminal erreicht',passed:reached},{label:'Quantenregister korrekt eingestellt',passed:solved}]};
    }
    window.DRONE_MISSION_CONFIG={
        levelId:reauth?null:'pico_level3',targetId:'pico-mission-turtle',defaultCode:byId('python-editor').value,inheritCode:false,unlocks:reauth?[]:['link-pico-l4'],
        runLabel:'Flug starten',runningLabel:'Drohne unterwegs',readyLabel:'Bereit für PICO',resetLabel:'↺ Startcode laden',
        resetOutput:'Die Drohne wartet mit vollem Akku an der Energieflasche.',initialMessage:'Fliege zum Wartungsterminal bei (220, 15).',initialChecks:['Wartungsterminal erreichen','Quantenregister öffnen'],
        resetHud(){flight.reset();view.reset();reached=reauth;flownCode=reauth?window.editor.getValue():'';showCamera(reauth);resetRegister();byId('return-to-terminal').hidden=true;byId('next-level-btn').style.display='none';byId('status-text').textContent='Bereit für PICO';byId('progress-fill').style.width='75%';},
        onRunStart(code){flownCode=code;view.prepareAudio();},onRunCancel(){view.clearAlarm();},onRunError(){view.clearAlarm();reached=false;byId('return-to-terminal').hidden=true;},
        limitTurtleMovement:flight.limitMovement,
        onTurtleFrame(point){const frame=flight.recordFrame(point);view.render();const state=flight.snapshot();reached=Boolean(state.initialized&&state.travelled>1&&!state.depleted&&core.isNear(state.current,window.NullpunktLevel1Core.TARGET,20));if(frame.stop)view.showEnergyWarning();return frame.stop?frame:null;},
        beforeFinish:()=>view.waitForAlarm(),
        getRunNotice:()=>reached?'Wartungsterminal erreicht. Kameraverbindung verfügbar.':'Flug beendet. Prüfe die Position deiner Drohne.',
        validate:result,
        onResult(result){
            const complete=result.passed&&result.levelComplete;
            byId('next-level-btn').style.display=complete?'inline-flex':'none';
            if(result.status)byId('status-text').textContent=result.status;
            byId('return-to-terminal').hidden=!reached;
            if(reached&&!result.restored&&!document.body.classList.contains('nullpunkt-terminal-active'))showCamera(true);
        },
        getRestoredResult:()=>({passed:true,levelComplete:true,restored:true,title:'Level 3 bereits geschafft',message:'Dein gespeicherter Flugcode bleibt erhalten. Du kannst weiter zu Level 4 oder mit einem neuen Flug ein neues Register öffnen.',status:'Bereits geschafft',statusState:'success',checks:[]}),
        getState:()=>({...flight.snapshot(),reached,solved,unlockPending,failures,helpLevel,checkVersion,checked:checked?[...checked]:null,register:task,values:[...values]})
    };
})();
