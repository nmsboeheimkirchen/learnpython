(() => {
    'use strict';
    const STEP=1,CYCLES=600,FINAL_DEVIATION=1800;
    const round=value=>Math.round(value*100)/100;
    const checksum=values=>round(values.reduce((total,value)=>total+value,0));
    function idleValues(time){
        const a=round(100+6*Math.sin(time/770)),b=round(100+8*Math.cos(time/930));
        // Row-major display: both left readings positive, both right negative.
        return [a,-b,b,-a];
    }
    // Instrument noise is bounded, never accumulated or fed back into the code.
    // K4 and the displayed checksum always include the same measured offset.
    function measuredValues(values,time){
        const measured=[...values];
        if(measured.every(Number.isFinite))measured[3]+=round(.99*Math.sin(time/1100));
        return measured;
    }
    function inspect(before,after){
        const valid=Array.isArray(after)&&after.length===4&&after.every(Number.isFinite);
        const checks={positive:valid,negative:valid,zero:valid};
        let message=valid?'':'Dein Programm liefert keine Liste mit vier gültigen Zahlen zurück.';
        if(valid)before.forEach((value,i)=>{
            const delta=after[i]-value;
            const group=value>0?'positive':value<0?'negative':'zero';
            if(value===0?Math.abs(delta)<=1e-7:Math.sign(delta)===Math.sign(value)&&Math.abs(delta)>1e-7&&Math.abs(delta)<=STEP+1e-7)return;
            checks[group]=false;
            if(message)return;
            const number=i+1;
            if(value===0)message=`Wert ${number} war 0 und wurde verändert.`;
            else if(Math.abs(delta)<1e-7)message=`Wert ${number} bleibt unverändert.`;
            else if(Math.abs(delta)>STEP+1e-7)message=`Wert ${number} wurde um mehr als 1 Prozentpunkt verändert.`;
            else message=`Wert ${number} bewegt sich zur Null statt weiter davon weg.`;
        });
        return {passed:Object.values(checks).every(Boolean),checks,message};
    }
    function probes(current){return [[...current],[-73,114,-114,73],[0,2,-2,0],[0,0,0,0]];}
    function observe(before,after,referenceSum=checksum(before)){
        const inspection=inspect(before,after);
        const valid=Array.isArray(after)&&after.length===4&&after.every(Number.isFinite);
        const sum=valid?after.reduce((total,value)=>total+value,0):null;
        const deltas=valid?after.map((value,i)=>value-before[i]):[];
        const unchanged=valid&&deltas.every(delta=>Math.abs(delta)<1e-7);
        const oversized=valid&&deltas.some(delta=>Math.abs(delta)>STEP+1e-7);
        const checksumChanged=valid&&Math.abs(sum-referenceSum)>.5;
        return {...inspection,valid,unchanged,oversized,checksumChanged,suspicious:!valid||oversized||checksumChanged,
            before:[...before],after:Array.isArray(after)?[...after]:after,deltas,sum,referenceSum};
    }
    const deviation=values=>Math.max(...values.map(value=>Number.isFinite(value)?Math.abs(value):0));
    // The previous absolute threshold of 18 is scaled to 1800 percent.
    const finalStageReady=values=>deviation(values)>=FINAL_DEVIATION-1e-7;
    const phase=(cycle,values=[])=>finalStageReady(values)?3:Math.max(0,Math.min(2,(cycle-150)/150));
    window.NullpunktCalibrationCore=Object.freeze({STEP,CYCLES,FINAL_DEVIATION,round,checksum,idleValues,measuredValues,inspect,observe,probes,deviation,finalStageReady,phase});
})();
