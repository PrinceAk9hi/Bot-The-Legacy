const {randomUUID}=require('node:crypto');
const {read,update}=require('./recruitmentData');
const {parseParis}=require('./convocationTime');
const NOTES=['1501585220217082047','1501584980965327039','1501584636407713952','1501584471994929252','1501584026845319329'];
const LABELS=['Très mauvais','Mauvais','Moyen','Bien','Très bien'];
const PREP={now:'Maintenant','6':'6 heures avant','3':'3 heures avant','1':'1 heure avant',none:'Aucune note ni modification'};
const ACTIONS={up:'Rankup',down:'Rétrogradation',derank:'Derank',warn:'Avertissement',none:'Aucune action'};
const STORE='conferencePlans';
function parts(now=Date.now()) {return Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));}
function parseDate(day,time,now=Date.now()) {
 const m=/^(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{4}))?)?$/.exec(day.trim()),h=/^(\d{1,2}):(\d{2})$/.exec(time.trim());
 if(!m||!h)throw Error('Date : jour, JJ/MM ou JJ/MM/AAAA ; heure : HH:MM (Paris).');
 const p=parts(now),d=m[1].padStart(2,'0'),mo=(m[2]||p.month).padStart(2,'0'),y=m[3]||p.year;
 const start=parseParis(`${d}/${mo}/${y} ${h[1].padStart(2,'0')}:${h[2]}`);
 if(!start)throw Error('Date ou heure invalide, inexistante ou ambiguë au changement d’heure.');
 if(start<=now+1800000)throw Error('Prévois la conférence à plus de 30 minutes pour permettre le rappel.');
 return start;
}
function get(id){return read(STORE)[id];}
function save(id,fn){update(STORE,s=>{if(!s[id])throw Error('Conférence introuvable.');fn(s[id]);s[id].updatedAt=Date.now();});return get(id);}
function create({guildId,authorId,channelId,start,name,description='',duration=60}) {
 const id=randomUUID().slice(0,8),r={id,guildId,authorId,channelId,start,name,description,duration,status:'draft',page:'setup',offset:'now',delay:1,notes:{},actions:{},roster:[],createdAt:Date.now(),revision:0};
 update(STORE,s=>{s[id]=r;});return r;
}
function due(r){return r.start-Number(r.offset)*3600000;}
function executionAt(r){return r.start+Number(r.delay)*3600000;}
function scheduled(r){return r.status==='scheduled'&&r.approvedAt&&[1,2,3].includes(r.delay)&&!r.cancelledAt;}
function validate(r,now=Date.now()) {
 if(!Object.hasOwn(PREP,r.offset)||![1,2,3].includes(r.delay))throw Error('Choix de programmation invalide.');
 if(executionAt(r)<=now)throw Error('Le délai d’application est déjà dépassé : annule et recrée la conférence.');
 const roster=new Set(r.roster.map(m=>m.id));
 for(const [id,n]of Object.entries(r.notes))if(!roster.has(id)||!Number.isInteger(n.value)||n.value<1||n.value>5)throw Error('Note invalide.');
 for(const [id,a]of Object.entries(r.actions))if(!roster.has(id)||!Object.hasOwn(ACTIONS,a.type)||!a.expectedRoles||(['up','down'].includes(a.type)&&!a.next))throw Error('Action invalide.');
}
module.exports={NOTES,LABELS,PREP,ACTIONS,STORE,parts,parseDate,get,save,create,due,executionAt,scheduled,validate};
