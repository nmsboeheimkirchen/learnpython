(() => {
    const ready=document.readyState==='loading' ? new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})) : Promise.resolve();
    ready.then(async()=>{
        if (window.AgentAccountConfig?.enabled && !(await window.AgentLearningDataReady)) return;
        // Existing navigation owns unlocks, completion markers and route mapping.
        // Open only the overview, never execute or jump to the next exercise.
        document.getElementById('overview-open').addEventListener('click',()=>window.setNavOpen(true));
        window.setNavOpen(true);
    });
})();
