// Date à laquelle chaque membre a reçu chaque rôle (pour l'effectif : « @membre - date »).
// - Désormais : enregistrée à chaque ajout de rôle (dernier ajout = date affichée).
// - Passé : reprise une fois depuis le journal d'audit Discord (ajouts de rôles, Discord les garde 45 jours).
// - Sinon : date d'arrivée dans la famille, puis date d'arrivée sur le serveur.
const {AuditLogEvent:E}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const PAGES=30;

function since(memberId,roleId){return a.state().schoolRoleSince?.[memberId]?.[roleId]||null;}
function record(oldMember,newMember,now=Date.now()){
 if(newMember.guild?.id!==config.guildId)return 0;
 const added=[...newMember.roles.cache.keys()].filter(id=>!oldMember.roles?.cache?.has(id)&&id!==newMember.guild.id);
 if(!added.length)return 0;
 a.save(s=>{s.schoolRoleSince||={};const m=s.schoolRoleSince[newMember.id]||={};for(const id of added)m[id]=now;});
 return added.length;
}
// Journal d'audit : du plus récent au plus ancien, le premier ajout trouvé (le plus récent) est gardé.
async function backfill(guild){
 if(guild.id!==config.guildId)return{detail:'Autre serveur'};
 if(a.state().schoolRoleSinceBackfill)return{detail:'Dates des rôles déjà reprises'};
 const found={};let before,pages=0;
 for(;pages<PAGES;pages++){
  const logs=await guild.fetchAuditLogs({type:E.MemberRoleUpdate,limit:100,...(before?{before}:{})}).catch(()=>null);
  const entries=[...(logs?.entries?.values?.()||[])];
  if(!entries.length)break;
  for(const e of entries){
   const added=(e.changes||[]).filter(c=>c.key==='$add').flatMap(c=>c.new||[]);
   for(const r of added){const m=found[e.targetId]||={};m[r.id]??=e.createdTimestamp;}
  }
  before=entries.at(-1).id;
  if(entries.length<100)break;
 }
 let n=0;
 a.save(s=>{s.schoolRoleSince||={};for(const [mid,roles] of Object.entries(found)){const m=s.schoolRoleSince[mid]||={};for(const [rid,at] of Object.entries(roles))if(!m[rid]){m[rid]=at;n++;}}s.schoolRoleSinceBackfill={at:Date.now(),pages,dates:n};});
 return{detail:`Dates des rôles : ${n} reprise(s) du journal d’audit`};
}
module.exports={since,record,backfill};
