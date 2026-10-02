(() => {
    'use strict';
    // Embedded re-authentication is only the public Q-04 puzzle. It must not
    // boot a second account shell, load another learner's code or award progress.
    // The owning level 4 page keeps its normal account and learning-data adapter.
    window.NullpunktTerminalOnly=window.parent!==window&&new URLSearchParams(location.search).get('reauth')==='calibration';
    if(window.NullpunktTerminalOnly&&window.AgentAccountConfig){
        window.AgentAccountConfig=Object.freeze({...window.AgentAccountConfig,enabled:false,shell:false});
    }
})();
