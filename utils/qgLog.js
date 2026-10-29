// Mise en forme commune des salons de logs du QG : couleur par type d'événement,
// membre en en-tête, champs lisibles, auteur retrouvé dans le journal d'audit Discord.
const {EmbedBuilder,PermissionFlagsBits:P}=require('discord.js');
const brand=require('./qgBrand');
const COLORS={join:0x3fae75,add:0x3fae75,leave:0xe0525b,remove:0xe0525b,delete:0xe0525b,danger:0xe0525b,edit:0xf0a35e,voice:0x5b8def,ticket:0x5bc0be,admin:0xa78bfa,casino:0xd4bd86,info:0xffffff};
const cut=(text,max=1024)=>{text=String(text??'');return text.length>max?text.slice(0,max-1)+'…':text;};
const time=(ms,style='R')=>ms?`<t:${Math.floor(ms/1000)}:${style}>`:'—';
const who=user=>user?`<@${user.id}>`:'*Non déterminé*';
// Citation sûre d'un texte de membre (aucune mention active, blocs de code neutralisés).
const quote=text=>text?cut('>>> '+String(text).replace(/```/g,'ʼʼʼ'),1024):'*Vide*';

function entry({kind='info',icon='',title,user,description,fields=[],thumbnail=false,footer}){
 const e=new EmbedBuilder().setColor(COLORS[kind]??COLORS.info).setTitle(cut(`${icon?icon+'  ':''}${title}`,256)).setTimestamp();
 if(user)e.setAuthor({name:cut(user.globalName&&user.globalName!==user.username?`${user.globalName} (@${user.username})`:'@'+user.username,256),iconURL:user.displayAvatarURL?.({size:128})});
 if(thumbnail&&user)e.setThumbnail(user.displayAvatarURL?.({size:256}));
 if(description)e.setDescription(cut(description,4000));
 const kept=fields.filter(f=>f&&f.value!==undefined&&f.value!==null&&String(f.value).trim()!=='').slice(0,25);
 if(kept.length)e.addFields(kept.map(f=>({name:cut(f.name,256),value:cut(f.value),inline:Boolean(f.inline)})));
 e.setFooter(brand.footer(footer??(user?` · ID ${user.id}`:'')));
 return e;
}

// Retrouve qui a déclenché un événement dans le journal d'audit (entrée récente sur la même cible).
// Discord publie l'entrée avec un léger décalage, d'où la courte attente.
async function executor(guild,type,targetId,{maxAge=20000,match=()=>true,wait=1200}={}){
 if(!guild?.members?.me?.permissions?.has(P.ViewAuditLog))return null;
 if(wait)await new Promise(r=>setTimeout(r,wait));
 try{
  const logs=await guild.fetchAuditLogs({type,limit:8});
  const found=[...logs.entries.values()].find(x=>(!targetId||x.targetId===targetId||x.target?.id===targetId)&&Date.now()-x.createdTimestamp<=maxAge&&match(x));
  return found?{user:found.executor,reason:found.reason||null}:null;
 }catch{return null;}
}

// Variante pour les entrées que Discord regroupe (déconnexion, déplacement, suppression de messages) :
// une même entrée voit son compteur augmenter au lieu d'en créer une nouvelle. On retient le compteur
// de chaque entrée pour reconnaître celle qui vient d'augmenter.
const counts=new Map();
function remember(type,e){const key=type+':'+e.id,count=Number(e.extra?.count||1),prev=counts.get(key);counts.set(key,count);if(counts.size>3000)counts.delete(counts.keys().next().value);return {count,prev};}
const timing={wait:1500,retry:2000};// réglable dans les tests
async function recent(guild,type,{match=()=>true,maxAge=15000,wait=timing.wait,retries=1,fetchLimit=10}={}){
 if(!guild?.members?.me?.permissions?.has(P.ViewAuditLog))return null;
 for(let attempt=0;attempt<=retries;attempt++){
  const delay=attempt?timing.retry:wait;if(delay)await new Promise(r=>setTimeout(r,delay));
  try{
   const logs=await guild.fetchAuditLogs({type,limit:fetchLimit});let hit=null;
   for(const e of logs.entries.values()){const {count,prev}=remember(type,e);if(hit||!match(e))continue;if(prev===undefined?Date.now()-e.createdTimestamp<=maxAge:count>prev)hit={user:e.executor,reason:e.reason||null};}
   if(hit)return hit;
  }catch{return null;}
 }
 return null;
}
// Mémorise l'état actuel du journal au démarrage pour ne pas attribuer une ancienne action.
async function prime(guild,types){for(const type of types)try{const logs=await guild.fetchAuditLogs({type,limit:10});for(const e of logs.entries.values())remember(type,e);}catch{}}

// Valeurs « avant / après » des actions d'administration : jamais de JSON brut.
const snowflake=/^\d{17,20}$/;
function pretty(value,depth=0){
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='boolean')return value?'Oui':'Non';
 if(typeof value==='number')return snowflake.test(String(value))?'`'+value+'`':value.toLocaleString('fr-FR');
 if(typeof value==='string')return snowflake.test(value)?'`'+value+'`':value;
 if(Array.isArray(value))return value.length?value.map(v=>pretty(v,depth+1)).join(', '):'—';
 if(depth>1)return '…';
 const lines=Object.entries(value).map(([k,v])=>`**${label(k)}** : ${pretty(v,depth+1)}`);
 return lines.join('\n')||'—';
}
const KEYS={status:'Statut',reason:'Motif',salon:'Salon',channel:'Salon',message:'Message',roles:'Rôles',role:'Rôle',profiles:'Profils',eventId:'Événement',conferenceId:'Conférence',amount:'Montant',count:'Nombre',balance:'Solde',enabled:'Activé',startAt:'Début',grade:'Grade',from:'De',to:'Vers',note:'Note'};
const label=key=>KEYS[key]||String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());

const AREAS={casino:['🎰','Casino'],rankup:['📈','Rank up'],derank:['📉','Derank'],'derank-tag':['📉','Derank (tag)'],sanction:['⚖️','Sanction'],discipline:['⚖️','Discipline'],animation:['🎉','Animation'],conference:['🎙️','Conférence'],absence:['🗓️','Absence'],annonce:['📢','Annonce'],interview:['🗣️','Entretien'],pdt:['🧪','Période de test'],note:['📝','Note'],meeting:['📅','Réunion'],recruitment:['📋','Recrutement'],recruiter:['📋','Recruteur'],tag:['🏷️','Tag QG'],voice:['🔊','Vocal'],'voice-reception':['🔊','Accueil vocal'],rp:['🎭','Roleplay'],maintenance:['🛠️','Maintenance'],cd:['⏱️','CD'],'public-thread':['🧵','Fils publics'],'age-roles':['🪪','Rôles d’âge'],alerte:['🚨','Alerte'],management:['🧭','Gestion'],responsibility:['🧭','Responsabilité']};
const WORDS={enable:'ouverture',disable:'fermeture',start:'début',started:'début',failed:'échec',retired:'retrait',review:'examen','review-due':'examen à faire',cancel:'annulation',cancelled:'annulation',create:'création',edit:'modification',expire:'expiration',reconcile:'réconciliation',auto:'automatique',manual:'manuel',restored:'rétabli','organizer-missing':'organisateur absent',admin:'administration',urgence:'urgence',rassemblement:'rassemblement',validation:'validation',add:'ajout',remove:'retrait',update:'mise à jour',delete:'suppression'};
function describeAction(action){
 const [head,...rest]=String(action).split('.');const [icon,area]=AREAS[head]||['🛡️',label(head)];
 const detail=rest.map(w=>WORDS[w]||w.replace(/-/g,' ')).join(' · ');
 return {icon,title:detail?`${area} · ${detail.replace(/^./,c=>c.toUpperCase())}`:area};
}

module.exports={COLORS,entry,executor,recent,prime,timing,pretty,describeAction,quote,time,who,cut};
