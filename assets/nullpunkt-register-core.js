(() => {
    'use strict';
    const combinations=Array.from({length:16},(_,n)=>Array.from({length:4},(_,i)=>(n>>i)&1?1:-1));
    function evaluate(task,values){
        if(!Array.isArray(values)||values.length!==4||values.some(value=>value!==1&&value!==-1))return [false,false,false,false];
        const [a,b]=task.pairA,[c,d]=task.pairB;
        return [values.reduce((sum,value)=>sum+value,0)===task.total,
            values[a]*values[b]===task.productA,values[c]*values[d]===task.productB,
            values[a]+task.sign*values[b]===task.anchor];
    }
    function generate(random=Math.random){
        const pick=items=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
        // Exclude the two trivial all-up/all-down states. The second pair has equal signs.
        const values=pick(combinations.filter(v=>Math.abs(v.reduce((a,b)=>a+b,0))!==4));
        const equalPairs=[];
        for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)if(values[a]===values[b])equalPairs.push([a,b]);
        const pairB=pick(equalPairs),pairA=[0,1,2,3].filter(i=>!pairB.includes(i));
        const [a,b]=pairA,[c,d]=pairB,sign=values[a]===values[b]?1:-1;
        return Object.freeze({pairA,pairB,total:values.reduce((sum,value)=>sum+value,0),productA:values[a]*values[b],productB:values[c]*values[d],sign,anchor:values[a]+sign*values[b]});
    }
    function reasoning(task,values,checked=false){
        const matches=checked?evaluate(task,values):[false,false,false,false];
        const rows=matches.flatMap((passed,i)=>passed?[i]:[]);
        const candidates=combinations.filter(v=>evaluate(task,v).every((passed,i)=>!matches[i]||passed));
        if(!checked)return {lines:[],summary:'',remaining:16,matchedRows:[]};
        const signed=value=>value>0?'+'+value:String(value).replace('-','−');
        const [a,b]=task.pairA,[c,d]=task.pairB;
        const calculations=[
            ['Prüfsumme',`${values.map(signed).join(' ')} = ${signed(values.reduce((sum,value)=>sum+value,0))}`],
            [`Produkt Q${a+1} · Q${b+1}`,`(${signed(values[a])}) · (${signed(values[b])}) = ${signed(values[a]*values[b])}`],
            [`Produkt Q${c+1} · Q${d+1}`,`(${signed(values[c])}) · (${signed(values[d])}) = ${signed(values[c]*values[d])}`],
            [`${task.sign===1?'Summe':'Differenz'} Q${a+1} ${task.sign===1?'+':'−'} Q${b+1}`,`${signed(values[a])} ${task.sign===1?'+':'−'} (${signed(values[b])}) = ${signed(values[a]+task.sign*values[b])}`]
        ];
        // Count only deductions from the successful whole equations, not fixed arrows.
        const lines=rows.map(i=>({row:i+1,label:calculations[i][0],equation:calculations[i][1]}));
        const summary=rows.length?`Mit diesen korrekten Prüfbedingungen ${candidates.length===1?'bleibt 1 von 16 Möglichkeiten':'bleiben '+candidates.length+' von 16 Möglichkeiten'}.`:'Noch keine Prüfbedingung ist korrekt. Es bleiben alle 16 Möglichkeiten.';
        return {lines,summary,remaining:candidates.length,matchedRows:rows};
    }
    window.NullpunktRegisterCore=Object.freeze({generate,evaluate,reasoning});
})();
