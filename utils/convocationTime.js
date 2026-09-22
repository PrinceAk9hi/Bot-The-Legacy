function parseParis(value) {
 const m=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value||'');if(!m)return null;
 const [,d,mo,y,h,mi]=m.map(Number);const base=Date.UTC(y,mo-1,d,h,mi);const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});const found=[];
 for(let offset=-840;offset<=840;offset+=15){const t=base+offset*60000;const p=Object.fromEntries(fmt.formatToParts(t).map(x=>[x.type,x.value]));if(+p.year===y&&+p.month===mo&&+p.day===d&&+p.hour===h&&+p.minute===mi)found.push(t);}
 return found.length===1?found[0]:null;
}
module.exports={parseParis};
