(() => {
    'use strict';
    const core=window.NullpunktCalibrationCore,byId=id=>document.getElementById(id);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noise=byId('calibration-noise'),noiseContext=noise.getContext('2d');
    let values=core.idleValues(performance.now()),initialValues=[...values],cycle=0,phase='idle',complete=false;
    let measuredValues=[...values],measurementTime=performance.now();
    let generation=0,waitTimer=null,resolveWait=null,executedCode='',lastInspection=null,testVersion=0,helpVersion=0,helpCount=0;
    let probeChecks={positive:false,negative:false,zero:false},history=[],failure=0,lastIdleUpdate=0;
    let effectStage='idle',display='numbers',effectHistory=[],interferenceCount=0,warningToneCount=0,sequenceStarted=0;
    let audioContext=null,audioNodes=[],alarmTimer=null,alarmStarted=false,alarmToneCount=0,ambientFrame=0,noiseFrame=0,lastNoiseUpdate=0;
    const cleanEffects=()=>({lightSmoke:0,heavySmoke:0,coreDarkness:0,alarmActive:false,alarmOpacity:0,barBlackout:0,coreFlicker:false,roomRed:0,surgeActive:false,flareOpacity:0});
    let effects=cleanEffects();
    let observation=null,lastCallValues=null,stoppedErrors=0,securityLocked=false,terminalNotice='',errorStarted=0,stopWasWarning=false,zeroTested=false;
    let sessionKey=null,reauthToken=null;
    // A tab-local gameplay checkpoint, scoped after the learning profile is ready.
    // It never writes account progress or reuses another profile's failed code.
    function saveSecurityState(){
        if(!sessionKey)return;
        try{
            if(!securityLocked&&!stoppedErrors){sessionStorage.removeItem(sessionKey);return;}
            const checkpoint={unit:'percent',locked:securityLocked,stoppedErrors,code:executedCode,values,initialValues,cycle,observation,lastInspection,testVersion};
            sessionStorage.setItem(sessionKey,JSON.stringify(checkpoint,(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?{$number:String(value)}:value));
        }catch(_){/* The live session still works if browser storage is unavailable. */}
    }
    function restoreSecurityState(){
        const context=window.AgentLearningData?.context;
        if(!context)return;
        sessionKey='nullpunkt-security-v1:'+JSON.stringify([context.kind,context.profileId,new URL('.',location.href).pathname]);
        let saved;
        try{saved=JSON.parse(sessionStorage.getItem(sessionKey),(_key,value)=>value&&typeof value==='object'&&['Infinity','-Infinity','NaN'].includes(value.$number)?Number(value.$number):value);}catch(_){return;}
        if(!saved||typeof saved.locked!=='boolean'||!Number.isInteger(saved.stoppedErrors))return;
        // Preserve existing locks and verbatim learner code when switching units.
        // Only measured numbers migrate; the program is still the learner's work.
        if(saved.unit!=='percent'){
            const scale=value=>Array.isArray(value)?value.map(scale):typeof value==='number'?value*100:value;
            saved.values=scale(saved.values);saved.initialValues=scale(saved.initialValues);
            if(Array.isArray(saved.observation?.before)){
                saved.observation=core.observe(scale(saved.observation.before),scale(saved.observation.after),scale(saved.observation.referenceSum));
                saved.lastInspection=saved.observation.message;
            }
        }
        stoppedErrors=Math.max(0,Math.min(2,saved.stoppedErrors));securityLocked=saved.locked;
        if(!securityLocked&&!stoppedErrors)return;
        if(typeof saved.code==='string'){executedCode=saved.code;window.DroneMissionRuntime.editor.setValue(saved.code);}
        const channels=v=>Array.isArray(v)&&v.length===4&&v.every(n=>n===null||typeof n==='number');
        if(channels(saved.values))values=saved.values;
        if(channels(saved.initialValues))initialValues=saved.initialValues;
        cycle=Number.isInteger(saved.cycle)?saved.cycle:0;
        observation=saved.observation||null;lastInspection=saved.lastInspection||null;testVersion=Math.max(1,saved.testVersion||0);
        if(observation)lastInspection=analysis();
        phase=securityLocked?'locked':'review';terminalNotice=securityLocked?'Zugriff verweigert':'';
        effects=cleanEffects();if(securityLocked)effects.roomRed=.5;
        document.body.classList.remove('mission-passed');byId('next-level-btn').style.display='none';
        byId('status-text').textContent=securityLocked?'Wartungszugang gesperrt':'Codeversuch erhalten';
        byId('run-status').textContent=securityLocked?'Zugriff verweigert':'Codeversuch erhalten';
        byId('run-status').className='mission-run-status is-ready';
        byId('validation-title').textContent=securityLocked?'Zugriff verweigert':'Letzten Codeversuch untersuchen';
        byId('validation-message').textContent=securityLocked?'Löse das Zugangsrätsel erneut. Dein Codeversuch bleibt erhalten.':analysis();
        document.querySelectorAll('[data-mission-run],#run-btn,#reset-btn,[data-mission-reset],[data-teacher-solution]').forEach(button=>{if(securityLocked)button.disabled=true;});
        window.DroneMissionRuntime.editor.setOption('readOnly',securityLocked);saveSecurityState();render();
    }
    const signed=value=>{
        if(typeof value!=='number')return '—';
        if(!Number.isFinite(value))return String(value).replace('Infinity','∞')+' %';
        // Suppress only floating-point residue, never actual small learner changes.
        if(Math.abs(value)<1e-9)value=0;
        const number=Math.abs(value)>=1000000||Math.abs(value)>0&&Math.abs(value)<.000001?value.toExponential(2):value.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:6,useGrouping:false});
        return (value>0?'+':'')+number.replace('-','−')+' %';
    };
    function analysis(){
        if(!observation)return lastInspection||'Für diesen Code liegt noch kein ausführbarer Durchlauf vor.';
        if(!observation.valid)return 'Dein Programm liefert keine Liste mit vier gültigen Zahlen zurück.';
        if(observation.oversized)return 'Mindestens eine Änderung war größer als 1 Prozentpunkt.';
        if(observation.checksumChanged)return 'Dein Code hat die Kontrollsumme verändert.';
        if(observation.unchanged)return 'Dein Code hat die vier Kalibrierwerte nicht verändert.';
        if(core.deviation(observation.after)<1)return 'Deine Werte pendeln nahe null und erreichen so keine ±1800 %.';
        return observation.message||'Dein Code verändert die Werte behutsam und erhält die Kontrollsumme.';
    }
    function remember(event){effectHistory.push({event,stage:effectStage,cycle,deviation:core.deviation(values),elapsed:Math.round(performance.now()-sequenceStarted),display});}
    function setStage(stage,changes={}){effectStage=stage;Object.assign(effects,changes);remember(stage);render();}
    function drawNoise(){
        const pixels=noiseContext.createImageData(noise.width,noise.height);
        for(let y=0;y<noise.height;y++){
            const scanline=y%4===0?0.55:1;
            for(let x=0;x<noise.width;x++){
                const i=(y*noise.width+x)*4;
                const grey=Math.floor((20+Math.random()*195)*scanline);
                pixels.data[i]=grey;pixels.data[i+1]=grey;pixels.data[i+2]=grey;pixels.data[i+3]=255;
            }
        }
        noiseContext.putImageData(pixels,0,0);
    }
    function animateNoise(now){
        if(display!=='noise'){noiseFrame=0;return;}
        if(!document.hidden&&now-lastNoiseUpdate>65){lastNoiseUpdate=now;drawNoise();}
        noiseFrame=requestAnimationFrame(animateNoise);
    }
    function setDisplay(next){
        display=next;cancelAnimationFrame(noiseFrame);noiseFrame=0;
        if(next==='noise'){
            if(effectStage==='display-interference')interferenceCount++;
            drawNoise();
            if(!reduced)noiseFrame=requestAnimationFrame(animateNoise);
        }
        remember('display-'+next);render();
        if(next==='noise'&&!alarmStarted)startRhythmicAlarm();
    }
    function closeAudio(){
        clearTimeout(alarmTimer);alarmTimer=null;
        for(const {oscillator,gain} of audioNodes){
            try{oscillator.stop();}catch(_){}
            try{oscillator.disconnect();gain.disconnect();}catch(_){}
        }
        audioNodes=[];
        const old=audioContext;audioContext=null;
        try{old?.close()?.catch(()=>{});}catch(_){}
    }
    function prepareAudio(){
        closeAudio();
        try{
            const Audio=window.AudioContext||window.webkitAudioContext;
            if(!Audio)return;
            audioContext=new Audio();audioContext.resume()?.catch(()=>{});
        }catch(_){audioContext=null;}
    }
    function warningTones(){
        warningToneCount=3;remember('warning-tones');
        for(let index=0;index<3;index++)tone(180,.28,.10,index*.5);
    }
    function tone(frequency,duration,volume,delay=0){
        if(!audioContext||audioContext.state==='closed')return;
        try{
            const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime+delay;
            oscillator.type='triangle';oscillator.frequency.value=frequency;
            gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.025);
            gain.gain.setValueAtTime(volume,at+duration*.7);gain.gain.exponentialRampToValueAtTime(.001,at+duration);
            oscillator.connect(gain);gain.connect(audioContext.destination);
            audioNodes.push({oscillator,gain});oscillator.start(at);oscillator.stop(at+duration+.02);
        }catch(_){closeAudio();}
    }
    function startRhythmicAlarm(){
        alarmStarted=true;
        const alarmGeneration=generation;
        function pulse(){
            alarmTimer=null;
            if(alarmGeneration!==generation||phase!=='running')return;
            alarmToneCount++;remember('rhythmic-warning');
            tone(180,.4,.22);
            alarmTimer=setTimeout(pulse,800);
        }
        // The new, stronger alarm follows the first display outage, never precedes it.
        alarmTimer=setTimeout(pulse,250);
    }
    function render(){
        measuredValues=core.measuredValues(values,measurementTime);
        measuredValues.forEach((value,i)=>{byId('calibration-value-'+i).textContent=signed(value);});
        byId('calibration-sum').textContent=measuredValues.every(Number.isFinite)?signed(measuredValues.reduce((sum,value)=>sum+value,0)):'—';
        byId('calibration-cycle').textContent=String(cycle);
        byId('calibration-state').textContent=['running','deviating','error'].includes(phase)?'WARTUNG AKTIV':'KALIBRIERUNG';
        byId('calibration-alert').hidden=!terminalNotice;byId('calibration-alert-text').textContent=terminalNotice;
        byId('calibration-alert').dataset.severity=securityLocked?'locked':'warning';
        byId('calibration-relogin').hidden=phase!=='locked';
        document.querySelector('.calibration-stop').hidden=securityLocked;
        const camera=byId('calibration-camera');
        camera.dataset.wideValues=String(values.some(value=>Math.abs(value)>=10000||Math.abs(value)>0&&Math.abs(value)<.001));
        document.querySelector('.calibration-note').textContent=['stopped','review','rejected'].includes(phase)?'Zuletzt angezeigte Messwerte. Bei Bedarf hilft dir die Zentrale.':'Sollwerte: links +100 %, rechts −100 %. Kontrollsumme: K1 + K2 + K3 + K4 ≈ 0 %.';
        camera.dataset.phase=String(failure);camera.dataset.effectStage=effectStage;camera.dataset.display=display;
        camera.dataset.alarmActive=String(effects.alarmActive);camera.dataset.coreFlicker=effects.coreFlicker?'on':'off';camera.dataset.reducedMotion=String(reduced);
        camera.dataset.smokeActive=String(effects.lightSmoke>0||effects.heavySmoke>0);camera.dataset.surgeActive=String(effects.surgeActive);
        byId('calibration-telemetry').style.opacity=display==='numbers'?'1':'0';
        noise.style.opacity=display==='noise'?'1':'0';
        byId('calibration-screen-blackout').style.opacity=display==='black'?'1':'0';
        byId('calibration-smoke-light').style.opacity=String(effects.lightSmoke);
        byId('calibration-smoke-heavy').style.opacity=String(effects.heavySmoke);
        byId('calibration-core-darkness').style.opacity=String(effects.coreDarkness);
        byId('calibration-alarm').style.opacity=String(effects.alarmOpacity);
        byId('calibration-bar-blackout').style.opacity=String(effects.barBlackout);
        byId('calibration-room-tint').style.opacity=String(effects.roomRed);
        byId('calibration-room-flare').style.opacity=String(effects.flareOpacity);
        camera.setAttribute('aria-label',complete?'Drohnenkamera: Dichter Rauch am dunklen Quantenrechner, das Terminal ist schwarz. Barbeleuchtung und Finanzmonitore sind ausgefallen.':(effects.lightSmoke>0?'Drohnenkamera: Die Kalibrierwerte laufen auseinander. Rauch steigt am Quantenrechner auf.':'Drohnenkamera: PICO arbeitet. Das Terminal zeigt die aktuellen Kalibrierwerte.'));
        byId('calibration-help-btn').disabled=window.DroneMissionRuntime?.isRunning()||securityLocked||complete||testVersion<=helpVersion;
        byId('calibration-help-btn').textContent=helpCount&&testVersion<=helpVersion?'Erst erneut Programm testen':'Hilfe von der Zentrale anfordern';
    }
    function hideHelp(){byId('calibration-help').hidden=true;byId('calibration-help').textContent='';}
    function cancelWait(){
        generation++;clearTimeout(waitTimer);waitTimer=null;
        const resolve=resolveWait;resolveWait=null;resolve?.();
        cancelAnimationFrame(noiseFrame);noiseFrame=0;closeAudio();
    }
    function wait(ms){return new Promise(resolve=>{resolveWait=resolve;waitTimer=setTimeout(()=>{waitTimer=null;resolveWait=null;resolve();},ms);});}
    function reset(reason){
        if(securityLocked){render();return;}
        if(reason==='stop'){
            cancelWait();if(stopWasWarning)stoppedErrors++;stopWasWarning=false;
            if(observation)lastInspection=analysis();
            phase='stopped';complete=false;terminalNotice='';effects=cleanEffects();failure=0;display='numbers';effectStage='idle';saveSecurityState();
            document.body.classList.remove('calibration-running');byId('status-text').textContent='Programm gestoppt · Code erhalten';render();return;
        }
        cancelWait();phase='idle';complete=false;cycle=0;failure=0;history=[];lastInspection=null;
        observation=null;terminalNotice='';errorStarted=0;zeroTested=false;byId('calibration-return-note').hidden=true;
        effectStage='idle';display='numbers';effectHistory=[];interferenceCount=0;warningToneCount=0;alarmToneCount=0;alarmStarted=false;effects=cleanEffects();
        values=core.idleValues(performance.now());initialValues=[...values];probeChecks={positive:false,negative:false,zero:false};
        document.body.classList.remove('calibration-running');byId('calibration-ending').hidden=true;
        byId('next-level-btn').style.display='none';byId('status-text').textContent='Wartungszugang offen';
        if(reason!=='run'){testVersion=0;helpVersion=0;helpCount=0;}
        hideHelp();render();
    }
    function reject(message){
        phase='rejected';complete=false;failure=0;lastInspection=message;
        closeAudio();cancelAnimationFrame(noiseFrame);noiseFrame=0;effectStage='idle';display='numbers';effects=cleanEffects();
        document.body.classList.remove('calibration-running');
        byId('status-text').textContent='Programm prüfen';render();
    }
    async function callCalibration(fn,input){
        window.Sk.execStart=new Date();
        window.Sk.lastYield=Date.now();
        const pythonInput=window.Sk.ffi.remapToPy(input);
        const answer=await window.AgentPythonExecution.run(()=>{
            const started=performance.now();
            let output=window.Sk.misceval.callsimOrSuspendArray(fn,[pythonInput]);
            // Skulpt's killable loops suspend at every iteration. Resume short,
            // optional pauses within one 8 ms slice; WebKit otherwise schedules
            // each of these four-item iterations in a separate display frame.
            // Long code still yields normally and retains its execution limit.
            while(output instanceof window.Sk.misceval.Suspension&&output.optional&&performance.now()-started<8){
                output=output.resume();
            }
            return output;
        });
        lastCallValues=window.Sk.ffi.remapToJs(pythonInput);return window.Sk.ffi.remapToJs(answer);
    }
    function showOutput(output){
        const channels=Array.isArray(output)?output:lastCallValues;
        values=Array.from({length:4},(_,i)=>typeof channels?.[i]==='number'?channels[i]:null);
        cycle++;render();
    }
    async function lockAccess(active){
        securityLocked=true;phase='locking';terminalNotice='Manipulation erkannt';
        saveSecurityState();
        effects=cleanEffects();effects.roomRed=.5;remember('manipulation-detected');render();
        clearTimeout(alarmTimer);tone(150,1.4,.34);
        await wait(1500);if(!active())return;
        phase='locked';terminalNotice='Zugriff verweigert';byId('status-text').textContent='Wartungszugang gesperrt';
        remember('access-denied');render();byId('calibration-relogin').focus({preventScroll:true});
    }
    async function securityWarning(fn,first,active){
        observation=first;lastInspection=analysis();phase='deviating';errorStarted=performance.now();
        clearTimeout(alarmTimer);effects=cleanEffects();effectStage='idle';failure=0;setDisplay('numbers');
        async function keepRunning(until){
            while(performance.now()<until){
                await wait(Math.min(100,until-performance.now()));if(!active())return false;
                if(values.every(Number.isFinite)){
                    const before=[...values],output=await callCalibration(fn,before);if(!active())return false;
                    showOutput(output);
                }
            }
            return true;
        }
        if(!await keepRunning(errorStarted+2000))return;
        if(stoppedErrors>=2){await lockAccess(active);return;}
        phase='error';terminalNotice='Fehler erkannt';remember('error-detected');tone(1000,.12,.13);render();
        if(!await keepRunning(performance.now()+5000))return;
        await lockAccess(active);
    }
    async function execute(){
        const ownGeneration=generation,fn=window.Sk.globals?.kalibrieren;
        const active=()=>{
            if(ownGeneration!==generation)return false;
            if(window.DroneMissionRuntime.editor.getValue()!==executedCode){
                cancelWait();reject('Der Code wurde während des Laufs verändert; teste ihn erneut.');return false;
            }
            return true;
        };
        if(!fn){reject('Die Funktion kalibrieren(werte) fehlt.');return;}
        probeChecks={positive:true,negative:true,zero:true};
        phase='running';sequenceStarted=performance.now();document.body.classList.add('calibration-running');remember('calibration-start');
        byId('status-text').textContent='Kalibrierprogramm aktiv';
        byId('calibration-camera').scrollIntoView({behavior:'auto',block:'center'});
        render();
        // Safe code may stabilize, pause, oscillate or use smaller increments.
        // Damage follows actual outward movement, not elapsed loop count.
        const initialDeviation=core.deviation(initialValues);
        let damage=0;
        // Keep executing real learner code while the screen alternates between
        // telemetry and interference. Only the permanent blackout stops the values.
        async function advance(){
            const before=[...values],output=await callCalibration(fn,before);
            if(!active())return false;
            const inspection=core.observe(before,output,core.checksum(initialValues));
            for(const key of Object.keys(probeChecks))probeChecks[key]&&=inspection.checks[key];
            showOutput(output);
            observation=inspection;lastInspection=inspection.passed?null:analysis();
            if(inspection.suspicious){await securityWarning(fn,inspection,active);return false;}
            const previousDamage=damage;
            damage=Math.max(damage,Math.round((core.deviation(values)-initialDeviation)*1e8)/1e8);
            failure=core.phase(damage,values);
            if(previousDamage<60&&damage>=60)setStage('smoke');
            if(damage>=60&&damage<=core.CYCLES){effects.lightSmoke=Math.min(.85,(damage-55)/600);effects.roomRed=Math.min(.32,(damage-55)/1700);}
            if(previousDamage<160&&damage>=160)setStage('alarm',{alarmActive:true,alarmOpacity:.65,coreDarkness:.12});
            if(previousDamage<240&&damage>=240){setStage('warning');warningTones();}
            if(previousDamage<480&&damage>=480){Object.assign(effects,{surgeActive:true,flareOpacity:.85,alarmOpacity:1});remember('room-surge');}
            if(cycle%5===0){history.push({cycle,values:[...values],sum:core.checksum(values)});if(history.length>4000)history.shift();}
            return true;
        }
        async function liveWait(ms){
            const until=performance.now()+ms;
            while(performance.now()<until){
                for(let step=0;step<5;step++)if(!await advance())return false;
                render();await wait(Math.max(0,Math.min(50,until-performance.now())));
                if(!active())return false;
            }
            return true;
        }
        while(damage<core.CYCLES){
            if(!await advance())return;
            if(cycle%5===0){render();await wait(50);if(!active())return;}
        }
        // Check other signs and zero channels only after showing the actual run.
        // A probe that triggers security is shown before the warning.
        for(const input of core.probes(initialValues).slice(1)){
            const output=await callCalibration(fn,input);if(!active())return;
            const inspection=core.observe(input,output);
            if(input.includes(0))zeroTested=true;
            for(const key of Object.keys(probeChecks))probeChecks[key]&&=inspection.checks[key];
            if(inspection.suspicious){showOutput(output);await securityWarning(fn,inspection,active);return;}
        }
        setStage('display-interference');
        for(let flash=0;flash<3;flash++){
            setDisplay('noise');if(!await liveWait(reduced?600:180))return;
            setDisplay('numbers');if(!await liveWait(reduced?900:520))return;
        }
        // Continue the real program until a channel reaches ±1800%. Neither elapsed
        // time nor a completed number of loops alone may trigger the final failure.
        while(!core.finalStageReady(values)){
            if(!await advance())return;
            if(cycle%5===0){render();await wait(50);if(!active())return;}
        }
        setStage('heavy-smoke',{heavySmoke:1,coreDarkness:.42,roomRed:.62});
        if(!await liveWait(1400))return;
        setStage('core-flicker');
        if(reduced){
            effects.coreDarkness=.78;setDisplay('noise');
            if(!await liveWait(800))return;
            setDisplay('numbers');if(!await liveWait(600))return;
        }else{
            // Three final strong interruptions, each more than 400 ms apart.
            // The red warning light keeps its slower CSS pulse independently.
            for(let flash=0;flash<3;flash++){
                effects.coreFlicker=true;effects.coreDarkness=.88;setDisplay('noise');
                if(!await liveWait(200))return;
                effects.coreFlicker=false;effects.coreDarkness=.36;setDisplay('numbers');
                if(!await liveWait(220))return;
            }
        }
        remember('calibration-finished');
        setStage('screen-blackout',{coreFlicker:false,coreDarkness:1,roomRed:.76,flareOpacity:.5});setDisplay('black');
        await wait(700);if(!active())return;
        setStage('room-blackout',{barBlackout:1});
        await wait(900);if(!active())return;
        phase='complete';complete=true;stoppedErrors=0;saveSecurityState();closeAudio();remember('complete');render();
    }
    function result(){
        return {passed:complete,levelComplete:complete,title:securityLocked?'Zugriff verweigert':complete?'Quantenangriff gestoppt':(lastInspection?'Programm noch nicht bereit':'Ergänze das Codegerüst'),
            message:complete?'PICO ist zerstört. Der Angriff auf das internationale Zahlungssystem ist gestoppt. Deine Kollegin hat das Sternenfragment gesichert. Trefft euch am Helikopter.':(lastInspection||'Ergänze die zwei Zuweisungen. Verändere die Werte behutsam und erhalte die Kontrollsumme von 0 %.'),
            status:complete?'Mission geschafft':'Code prüfen',statusState:complete?'success':'warning',
            checks:[{label:'Positive Werte: behutsam weiter von null',passed:probeChecks.positive},{label:'Negative Werte: behutsam weiter von null',passed:probeChecks.negative},{label:'Nullwerte bleiben unverändert',passed:zeroTested&&probeChecks.zero},{label:'Kalibrierprogramm vollständig durchgelaufen',passed:complete}]};
    }
    byId('calibration-help-btn').addEventListener('click',()=>{
        if(testVersion<=helpVersion||window.DroneMissionRuntime.isRunning()||securityLocked||complete)return;
        helpVersion=testVersion;helpCount++;
        const message=analysis();
        byId('calibration-help').textContent=message;byId('calibration-help').hidden=false;render();
    });
    byId('calibration-finish').addEventListener('click',()=>{
        if(!complete)return;
        window.triggerSuccess?.(false,'PICO ist zerstört. Der Angriff auf das internationale Zahlungssystem ist gestoppt. Deine Kollegin hat das Sternenfragment gesichert. Trefft euch am Helikopter.',{rewardCount:4,title:'OPERATION NULLPUNKT',celebration:'coins',primaryHref:'helikopter_flucht.html',primaryLabel:'Zum Helikopter',closeLabel:'Zurück zur Drohnenkamera',statusLabel:'MISSION GESCHAFFT!'});
    });
    byId('calibration-relogin').addEventListener('click',()=>{
        if(phase!=='locked'||!securityLocked)return;
        closeAudio();phase='reauth';document.body.classList.remove('presentation-mode','calibration-running');document.body.classList.add('calibration-reauth');
        const frame=document.createElement('iframe');frame.id='calibration-login-frame';frame.title='Level 3: Quantenrätsel erneut lösen';
        reauthToken=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-');
        frame.src='pico_level3.html?reauth=calibration&reauthToken='+encodeURIComponent(reauthToken);
        byId('calibration-reauth').replaceChildren(frame);byId('calibration-reauth').hidden=false;
        byId('calibration-reauth').scrollIntoView({behavior:'auto',block:'start'});
    });
    window.addEventListener('message',event=>{
        const frame=byId('calibration-login-frame');
        const expectedOrigin=location.protocol==='file:'?'null':location.origin;
        if(!securityLocked||phase!=='reauth'||!frame||event.source!==frame.contentWindow||event.origin!==expectedOrigin||event.data?.token!==reauthToken)return;
        if(event.data?.type==='nullpunkt:terminal-size'){
            if(Number.isFinite(event.data.height))frame.style.height=Math.max(300,Math.min(2400,event.data.height))+'px';return;
        }
        if(event.data?.type!=='nullpunkt:terminal-unlocked')return;
        // file:// frames have opaque origins: use the current source and nonce,
        // not direct frame DOM access. The child sends this only after solving.
        securityLocked=false;stoppedErrors=0;phase='review';terminalNotice='';effects=cleanEffects();
        reauthToken=null;saveSecurityState();
        document.body.classList.remove('calibration-reauth','calibration-running','presentation-mode');
        byId('calibration-reauth').hidden=true;byId('calibration-reauth').replaceChildren();
        byId('calibration-return-note').hidden=false;byId('status-text').textContent='Wartungszugang wieder offen';
        byId('run-status').textContent='Codeversuch erhalten';byId('run-status').className='mission-run-status is-ready';
        byId('validation-title').textContent='Letzten Codeversuch untersuchen';byId('validation-message').textContent=lastInspection||'Der Wartungszugang ist wieder offen.';
        helpVersion=Math.min(helpVersion,testVersion-1);
        document.querySelectorAll('[data-mission-run],#run-btn,#reset-btn,[data-mission-reset],[data-teacher-solution]').forEach(button=>button.disabled=false);
        window.DroneMissionRuntime.editor.setOption('readOnly',false);window.DroneMissionRuntime.editor.refresh();render();
        byId('editor-panel').scrollIntoView({behavior:'auto',block:'start'});window.DroneMissionRuntime.editor.focus();
    });
    document.addEventListener('drone:running',event=>{
        window.DroneMissionRuntime?.editor.setOption('readOnly',Boolean(event.detail?.running));
        document.querySelector('[data-teacher-solution]').disabled=Boolean(event.detail?.running);
        if(event.detail?.running&&phase==='idle')prepareAudio();else if(!event.detail?.running)closeAudio();
        document.querySelectorAll('[data-mission-run],#run-btn,#reset-btn,[data-mission-reset]').forEach(button=>{if(securityLocked)button.disabled=true;});
        render();
    });
    document.addEventListener('drone:reset',()=>{if(phase==='stopped')byId('console-output').textContent='Programm gestoppt. Dein Code und die zuletzt angezeigten Werte bleiben erhalten.';});
    document.addEventListener('drone:codechange',()=>{hideHelp();});
    function ambient(now){
        if(!document.hidden&&now-lastIdleUpdate>140){
            lastIdleUpdate=now;
            if(phase==='idle')values=core.idleValues(now);
            if(['idle','running','deviating','error'].includes(phase)){measurementTime=now;render();}
        }
        ambientFrame=requestAnimationFrame(ambient);
    }
    ambientFrame=requestAnimationFrame(ambient);
    window.addEventListener('pagehide',()=>{cancelWait();cancelAnimationFrame(ambientFrame);});
    window.addEventListener('pageshow',event=>{if(event.persisted){window.DroneMissionRuntime?.reset();cancelAnimationFrame(ambientFrame);ambientFrame=requestAnimationFrame(ambient);}});
    document.fonts?.ready.then(()=>window.DroneMissionRuntime?.editor.refresh());
    window.DRONE_MISSION_CONFIG={
        levelId:'pico_level4_memory',targetId:'calibration-runtime-target',defaultCode:byId('python-editor').value,inheritCode:false,
        unlocks:['link-helicopter-escape','link-helicopter-level1'],execLimit:1500,
        preserveCodeOnStop:true,canRun:()=>!securityLocked,canReset:()=>!securityLocked,onReady:restoreSecurityState,
        runLabel:'Programm testen & hochladen',runningLabel:'Kalibrierprogramm läuft',readyLabel:'Wartungszugang offen',resetLabel:'↺ Code der Zentrale laden',
        initialMessage:'Ergänze die beiden Zuweisungen im Kalibrierprogramm des Quantenkerns.',initialChecks:['Positive Werte verändern','Negative Werte verändern','Nullwerte erhalten'],
        resetOutput:'Kalibrierprogramm bereit. Die Zahlen sind Prozentwerte: 100 bedeutet 100 %, eine Änderung um 1 entspricht einem Prozentpunkt.',
        emptyOutput:'Programmprüfung beendet. Die Ergebnisse stehen unter der Drohnenkamera.',
        resetHud:({reason}={})=>reset(reason),
        onRunStart(code){executedCode=code;initialValues=[...values];phase='checking';testVersion++;hideHelp();render();},
        onRunCancel(){stopWasWarning=phase==='error';cancelWait();},onRunError(){cancelWait();terminalNotice='';reject('Prüfe den Python-Fehler im Protokoll.');},
        beforeFinish:execute,validate:result,
        onResult(outcome){
            const done=Boolean(outcome.passed)&&!securityLocked;byId('next-level-btn').style.display=done?'inline-flex':'none';
            byId('calibration-ending').hidden=!(complete&&done);if(done)byId('status-text').textContent=outcome.restored?'Bereits geschafft':'Mission geschafft';
            if(phase==='stopped'){byId('validation-title').textContent='Programm gestoppt';byId('validation-message').textContent=lastInspection||'Dein Code bleibt für den nächsten Versuch erhalten.';}
        },
        getRestoredResult:()=>({passed:true,levelComplete:true,restored:true,title:'Mission bereits geschafft',message:'Dein bisheriger Abschluss und Code bleiben erhalten. Du kannst zum Helikopter oder das neue Kalibrierprogramm ausprobieren.',status:'Bereits geschafft',statusState:'success',checks:[]}),
        getState:()=>({phase,complete,cycle,failure,effectStage,display,interferenceCount,warningToneCount,alarmToneCount,stoppedErrors,securityLocked,terminalNotice,observation:observation?{...observation}:null,reducedMotion:reduced,effects:{...effects},effectHistory:effectHistory.map(entry=>({...entry})),values:[...values],measuredValues:[...measuredValues],measuredSum:core.checksum(measuredValues),initialValues:[...initialValues],sum:core.checksum(values),testVersion,helpCount,history:history.map(entry=>({...entry,values:[...entry.values]}))})
    };
})();
