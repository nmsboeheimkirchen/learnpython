(() => {
    'use strict';
    // Skulpt 1.2's tokenizer accepts ASCII identifiers only. Keep learner source intact.
    const aliases=Object.freeze({Ausrüstung:'_nullpunkt_ausruestung_unicode',AUSRÜSTUNG:'_nullpunkt_AUSRUESTUNG_unicode'});
    function prepareCode(source){
        let output='',index=0,quote='';
        while(index<source.length){
            const char=source[index];
            if(quote){
                if(char==='\\'){output+=source.slice(index,index+2);index+=2;continue;}
                if(source.startsWith(quote,index)){output+=quote;index+=quote.length;quote='';continue;}
                output+=char;index++;continue;
            }
            if(char==='#'){
                const end=source.indexOf('\n',index),next=end<0?source.length:end;
                output+=source.slice(index,next);index=next;continue;
            }
            if(char==='"'||char==="'"){
                quote=source.startsWith(char.repeat(3),index)?char.repeat(3):char;
                output+=quote;index+=quote.length;continue;
            }
            if(/[A-Za-z_\u0080-\uFFFF]/.test(char)){
                let end=index+1;while(end<source.length&&/[A-Za-z0-9_\u0080-\uFFFF]/.test(source[end]))end++;
                const name=source.slice(index,end);output+=Object.hasOwn(aliases,name)?aliases[name]:name;index=end;continue;
            }
            output+=char;index++;
        }
        return output;
    }
    function formatError(message){for(const [name,alias] of Object.entries(aliases))message=message.replaceAll(alias,name);return message;}
    window.NullpunktPythonNames=Object.freeze({prepareCode,formatError,globalName:name=>aliases[name]||name});
})();
