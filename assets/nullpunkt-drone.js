(() => {
    'use strict';
    window.NullpunktDroneView=Object.freeze({create(state){
    const byId=id=>document.getElementById(id);
    const ALARM_PAUSE_MS=7000;
    let displayEnergy=null;
    let alarmTimer=null;
    let alarmWait=null;
    let releaseAlarm=null;
    let audioContext=null;
    let activeTone=null;
    let points=[];
    function prepareAudio(){
        try{
            const AudioContext=window.AudioContext||window.webkitAudioContext;
            if(!AudioContext)return;
            audioContext??=new AudioContext();
            if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
        }catch(_error){/* The visual warning also works without audio support. */}
    }
    // Unlock audio on the actual button/keyboard gesture, before asynchronous saving.
    document.addEventListener('click',event=>{
        if(event.target.closest?.('#run-btn,[data-mission-run],#presentation-run-btn'))prepareAudio();
    },true);
    document.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&event.target.closest?.('#editor-panel'))prepareAudio();
    },true);
    function playWarningTone(){
        if(!audioContext||audioContext.state!=='running')return;
        try{
            const tone=audioContext.createOscillator();
            const gain=audioContext.createGain();
            const now=audioContext.currentTime;
            tone.type='triangle';
            tone.frequency.setValueAtTime(880,now);
            tone.frequency.exponentialRampToValueAtTime(440,now+.24);
            gain.gain.setValueAtTime(0,now);
            gain.gain.linearRampToValueAtTime(.12,now+.015);
            gain.gain.setValueAtTime(.12,now+.15);
            gain.gain.linearRampToValueAtTime(0,now+.26);
            tone.connect(gain);gain.connect(audioContext.destination);
            activeTone=tone;
            tone.onended=()=>{tone.disconnect();gain.disconnect();if(activeTone===tone)activeTone=null;};
            tone.start(now);tone.stop(now+.27);
        }catch(_error){/* Sound availability must never block the mission. */}
    }
    function endAlarmPause(){
        if(alarmTimer!==null)clearTimeout(alarmTimer);
        alarmTimer=null;
        byId('energy-warning').classList.remove('is-blinking');
        const resolve=releaseAlarm;releaseAlarm=null;resolve?.();
    }
    function clearAlarm(){
        endAlarmPause();alarmWait=null;
        byId('energy-warning').hidden=true;
        if(activeTone){try{activeTone.stop();}catch(_error){}activeTone=null;}
    }
    function showEnergyWarning(){
        if(alarmWait)return;
        byId('energy-warning').hidden=false;
        byId('energy-warning').classList.add('is-blinking');
        byId('status-text').textContent='Akku: kritischer Zustand!';
        byId('run-status').textContent='Akku kritisch';
        byId('run-status').className='mission-run-status is-warning';
        document.querySelectorAll('#run-btn,[data-mission-run],#presentation-run-btn').forEach(button=>{
            button.textContent='Akku kritisch …';
        });
        alarmWait=new Promise(resolve=>{releaseAlarm=resolve;});
        alarmTimer=setTimeout(endAlarmPause,ALARM_PAUSE_MS);
        playWarningTone();
    }
    function renderState(){
        const current=state.snapshot();
        byId('energy-value').textContent=Math.round(displayEnergy??current.energy)+' %';
        byId('energy-fill').style.width=(displayEnergy??current.energy)+'%';
        byId('energy-meter').setAttribute('aria-valuenow',String(Math.round(displayEnergy??current.energy)));
        byId('coordinate-x').textContent=String(Math.round(current.current.x));
        byId('coordinate-y').textContent=String(Math.round(current.current.y));
        // Keep the rotor tips visible when a target is close to the image edge.
        byId('nullpunkt-drone').style.left='clamp(27px, '+(current.current.x+480)/960*100+'%, calc(100% - 27px))';
        byId('nullpunkt-drone').style.top='clamp(27px, '+(270-current.current.y)/540*100+'%, calc(100% - 27px))';
        document.body.classList.toggle('energy-depleted',current.depleted);
        if(current.initialized){
            const point=(current.current.x+480)+','+(270-current.current.y);
            if(points.at(-1)!==point){points.push(point);byId('flight-trail').setAttribute('points',points.join(' '));}
        }
    }
    return Object.freeze({
        render:renderState,prepareAudio,showEnergyWarning,clearAlarm,
        waitForAlarm:()=>alarmWait,
        setDisplayedEnergy(value){displayEnergy=value;renderState();},
        reset(){clearAlarm();displayEnergy=null;points=[];byId('flight-trail').setAttribute('points','');renderState();}
    });
    }});
})();
