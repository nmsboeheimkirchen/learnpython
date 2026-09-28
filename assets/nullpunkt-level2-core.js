(() => {
    'use strict';
    const flightCore=window.NullpunktLevel1Core;
    const core=window.DroneMissionCore;
    const ENERGY_ITEM='Energiezelle';
    const CELL_RADIUS=18;
    const countItem=items=>Array.isArray(items)?items.filter(item=>item===ENERGY_ITEM).length:0;
    function createState(){
        const flight=flightCore.createState();
        let searched,found,printed,pendingFind,lastSearchFailure,preparedList,appendedList,equipmentCleared;
        function reset(){flight.reset();searched=false;found=false;printed=false;pendingFind=null;lastSearchFailure=null;preparedList=null;appendedList=null;equipmentCleared=false;}
        // A list may be created anywhere; a later empty assignment can erase a find.
        function observeEquipment(equipment,list=equipment){
            if(Array.isArray(equipment)&&equipment.length===0)preparedList=list;
            equipmentCleared=Boolean(appendedList&&(list!==appendedList||countItem(equipment)===0));
        }
        function atCell(){const s=flight.snapshot();return s.initialized&&core.isNear(s.current,flightCore.ENERGY_CELL,CELL_RADIUS);}
        function recordFrame(point){
            const result=flight.recordFrame(point);
            if(pendingFind&&!atCell())pendingFind=null;
            return result;
        }
        function searchHere(equipment){
            searched=true;
            if(flight.snapshot().depleted){pendingFind=null;lastSearchFailure='ENERGY_EMPTY';return null;}
            if(!atCell()){pendingFind=null;lastSearchFailure='WRONG_PLACE';return null;}
            if(flight.snapshot().charged){lastSearchFailure='ALREADY_USED';return null;}
            found=true;lastSearchFailure=null;
            pendingFind={baselineCount:countItem(equipment)};
            return ENERGY_ITEM;
        }
        function recordAppend(list,item){
            if(!preparedList||list!==preparedList||!pendingFind||!atCell()||flight.snapshot().depleted||item!==ENERGY_ITEM)return false;
            appendedList=list;
            return true;
        }
        function syncEquipment(equipment,list=equipment){
            if(!appendedList||list!==appendedList||!pendingFind||!atCell()||flight.snapshot().depleted||countItem(equipment)<=pendingFind.baselineCount)return false;
            pendingFind=null;
            return flight.charge();
        }
        function recordOutput(text){if(found&&String(text).includes(ENERGY_ITEM))printed=true;}
        function snapshot(){return {...flight.snapshot(),searched,found,printed,lastSearchFailure,atCell:atCell(),listPrepared:Boolean(preparedList),appended:Boolean(appendedList),equipmentCleared};}
        reset();
        return Object.freeze({reset,recordFrame,limitMovement:flight.limitMovement,searchHere,observeEquipment,recordAppend,syncEquipment,recordOutput,snapshot});
    }
    window.NullpunktLevel2Core=Object.freeze({ENERGY_ITEM,CELL_RADIUS,ENERGY_CELL:flightCore.ENERGY_CELL,createState});
})();
