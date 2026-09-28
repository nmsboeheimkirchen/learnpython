(() => {
    'use strict';
    const core = window.DroneMissionCore;
    const START = Object.freeze({x:-365,y:55});
    const TARGET = Object.freeze({x:220,y:15});
    const ENERGY_CELL = Object.freeze({x:-455,y:-85});
    const START_ENERGY = 10;
    // Shared calibration: the nearby bottle is reachable, PICO is not.
    const FLIGHT_BUDGET = 180;
    function createState({start=START,initialEnergy=START_ENERGY,initiallyCharged=false}={}) {
        let current, energy, initialized, targeted, depleted, travelled, charged;
        function reset() {
            current={...start};energy=initialEnergy;initialized=false;
            targeted=false;depleted=false;travelled=0;charged=initiallyCharged;
        }
        function limitMovement(start,target) {
            if(!initialized || depleted)return null;
            if(core.isNear(target,TARGET,20))targeted=true;
            const move=core.clampMovementByBudget(start,target,energy,charged?1/12:START_ENERGY/FLIGHT_BUDGET);
            return move?.stopped ? {...move.point,stop:true} : null;
        }
        function recordFrame(point) {
            const next=core.finitePoint(point);
            if(!next || depleted)return {stop:depleted};
            if(!initialized){
                if(core.isNear(next,start,1)){initialized=true;current=next;}
                return {stop:false};
            }
            const distance=core.distance(current,next);
            travelled+=distance;
            energy=Math.max(0,energy-distance*(charged?1/12:START_ENERGY/FLIGHT_BUDGET));
            if(energy<core.EPSILON){energy=0;depleted=true;}
            current=next;
            return {stop:depleted};
        }
        function charge(){if(!initialized||charged)return false;charged=true;energy=100;depleted=false;return true;}
        function snapshot(){return {current:{...current},energy,initialized,targeted,depleted,travelled,charged,discovered:targeted&&depleted&&travelled>1};}
        reset();
        return Object.freeze({reset,limitMovement,recordFrame,charge,snapshot});
    }
    window.NullpunktLevel1Core=Object.freeze({START,TARGET,ENERGY_CELL,START_ENERGY,FLIGHT_BUDGET,createState});
})();
