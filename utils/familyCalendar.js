const {parseParis}=require('./convocationTime');
function paris(now=Date.now()){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));}
function dayKey(now=Date.now()){const p=paris(now);return `${p.year}-${p.month}-${p.day}`;}
function sunday(now=Date.now(),next=true){const p=paris(now),d=new Date(Date.UTC(+p.year,+p.month-1,+p.day));let offset=(7-d.getUTCDay())%7;d.setUTCDate(d.getUTCDate()+offset);
 const stamp=()=>parseParis(`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()} 23:00`);
 let t=stamp();if(next&&t<=now){d.setUTCDate(d.getUTCDate()+7);t=stamp();}if(!next&&t>now){d.setUTCDate(d.getUTCDate()-7);t=stamp();}return t;
}
function birthDate(value){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!m)return false;const [,d,mo,y]=m.map(Number),t=new Date(Date.UTC(y,mo-1,d));return y>=1900&&t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d&&t.getTime()<Date.now();}
function isBirthday(value,now=Date.now()){if(!birthDate(value))return false;const p=paris(now);return value.slice(0,5)===`${p.day}/${p.month}`;}
module.exports={paris,dayKey,sunday,birthDate,isBirthday};
