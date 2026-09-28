(() => {
    'use strict';
    const core=window.NullpunktLevel1Core;
    const state=core.createState();
    const byId=id=>document.getElementById(id);
    const view=window.NullpunktDroneView.create(state);
    let completionShown=false;
    function showNext(show){byId('next-level-btn').style.display=show?'inline-flex':'none';}
    function result(){
        const current=state.snapshot();
        if(current.discovered)return {
            passed:true,levelComplete:true,kind:'energy-discovery',
            title:'Die Drohne stoppt – der Akku ist leer.',
            message:'Der Flug zu PICO hat den Akku geleert, bevor die Drohne ankam. Du hast das Hindernis entdeckt. Im nächsten Level suchst du eine Möglichkeit zum Aufladen.',
            status:'Energieproblem erkannt',statusState:'success',
            checks:[{label:'Flug zu PICO ausgeführt',passed:true},{label:'Flugabbruch bei leerem Akku beobachtet',passed:true}]
        };
        return {
            passed:false,levelComplete:false,kind:'route-missing',
            title:current.depleted?'Die Drohne ist stehen geblieben.':'Steuere die Drohne zu PICO.',
            message:current.depleted?'Diese Route führte nicht zum Wartungsterminal. Starte erneut und setze PICO bei (220, 15) als Ziel.':'Ergänze unten im Code den Aufruf fliege_zu(220, 15) und starte deinen Flug.',
            status:'Auftrag noch offen',statusState:'warning',
            checks:[{label:'Flug zum Wartungsterminal ausgeführt',passed:current.targeted}]
        };
    }
    window.DRONE_MISSION_CONFIG={
        levelId:'pico_level1_navigation',targetId:'pico-mission-turtle',
        defaultCode:byId('python-editor').value,unlocks:['link-pico-l2'],inheritCode:false,
        runLabel:'Flug starten',runningLabel:'Drohne unterwegs',readyLabel:'Bereit zum Einsatz',
        resetLabel:'↺ Startcode laden',resetOutput:'Die Drohne wartet am Zugang auf deinen Flugauftrag.',
        initialMessage:'Steuere die Drohne zum Wartungsterminal von PICO bei (220, 15).',
        initialChecks:['Flug zum Wartungsterminal ausgeführt'],
        resetHud(){
            completionShown=false;state.reset();view.reset();
            byId('status-text').textContent='Bereit zum Einsatz';
            byId('progress-fill').style.width='25%';
            showNext(false);view.render();
        },
        onRunStart(){view.prepareAudio();byId('status-text').textContent='Drohne unterwegs';},
        limitTurtleMovement:(start,target)=>state.limitMovement(start,target),
        onTurtleFrame(point){
            const frame=state.recordFrame(point);view.render();
            if(frame.stop)view.showEnergyWarning();
            return frame.stop?frame:null;
        },
        beforeFinish:view.waitForAlarm,
        onRunCancel:view.clearAlarm,
        onRunError:view.clearAlarm,
        getRunNotice(){
            const current=state.snapshot();
            return current.depleted?'Flug abgebrochen: Akku 0 %. Die Drohne landet sicher vor dem Ziel.':'Flugauftrag beendet. Prüfe die Position deiner Drohne.';
        },
        validate:result,
        onResult(result){
            const complete=Boolean(result.passed&&result.levelComplete);
            showNext(complete);
            if(!complete||result.restored||completionShown)return;
            completionShown=true;
            window.triggerSuccess?.(false,'Du hast entdeckt, warum die Drohne PICO noch nicht erreicht. Finde jetzt eine Möglichkeit, sie aufzuladen.',{
                rewardCount:3,title:'HINDERNIS ENTDECKT',celebration:'coins',
                primaryHref:'pico_level2.html',primaryLabel:'Weiter zu Level 2',
                closeLabel:'Zurück zum Editor',statusLabel:'LEVEL 1 GESCHAFFT!'
            });
        },
        // Existing level-1 completions remain valid; no invented replay/telemetry.
        getRestoredResult:()=>({passed:true,levelComplete:true,restored:true,title:'Level 1 bereits geschafft',message:'Dein gespeicherter Code ist erhalten. Mit „Startcode laden“ kannst du den neuen Auftrag ausprobieren.',status:'Bereits geschafft',statusState:'success',checks:[]}),
        getState:()=>state.snapshot()
    };
})();
