const {AuditLogEvent,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin');
// Cache des invitations, tenu à jour par InviteCreate/InviteDelete (intent GuildInvites).
let cache=null,vanity=null,timer=null,pending=[],failure=null;
const deleted=new Map();
const entry=i=>({uses:i.uses||0,maxUses:i.maxUses||0,inviter:i.inviter?.id||i.inviterId||null,channelId:i.channelId||i.channel?.id||null,expiresAt:i.expiresTimestamp||null});
async function vanitySnapshot(guild){if(!guild.vanityURLCode)return null;try{return await guild.fetchVanityData();}catch{return null;}}
async function snapshot(guild){
 const me=await guild.members.fetchMe();
 if(!me.permissions.has(P.ManageGuild)){failure='Le bot n’a pas la permission « Gérer le serveur » : les invitations ne sont pas lisibles.';return null;}
 const invites=await guild.invites.fetch({cache:false});failure=null;
 return new Map([...invites.values()].map(i=>[i.code,entry(i)]));
}
async function start(guild){try{cache=await snapshot(guild);vanity=await vanitySnapshot(guild);}catch(e){cache=null;failure='Lecture des invitations impossible ('+(e.code||e.name)+').';}}
function created(invite){cache?.set(invite.code,entry(invite));}
function removed(invite){if(!cache?.has(invite.code))return;deleted.set(invite.code,{...cache.get(invite.code),deletedAt:Date.now()});cache.delete(invite.code);}
// Une invitation limitée qui disparaît après avoir atteint son maximum a été utilisée par l'arrivée.
function consumed(code,rec,now){return rec.maxUses>0&&rec.uses+1>=rec.maxUses&&!(rec.expiresAt&&rec.expiresAt<=now);}
function candidates(prev,next,prevVanity,nextVanity){
 const now=Date.now(),out=[];
 for(const [code,v] of next){const delta=v.uses-(prev.get(code)?.uses||0);if(delta>0)out.push({code,delta,...v,uses:v.uses});}
 for(const [code,v] of prev)if(!next.has(code)&&consumed(code,v,now))out.push({code,delta:1,...v,uses:v.uses+1});
 for(const [code,v] of deleted){if(now-v.deletedAt>60000){deleted.delete(code);continue;}if(!next.has(code)&&!prev.has(code)&&consumed(code,v,now)){out.push({code,delta:1,...v,uses:v.uses+1});deleted.delete(code);}}
 if(prevVanity&&nextVanity&&prevVanity.code===nextVanity.code&&nextVanity.uses>prevVanity.uses)out.push({code:nextVanity.code,delta:nextVanity.uses-prevVanity.uses,uses:nextVanity.uses,maxUses:0,inviter:null,channelId:null,vanity:true});
 return out;
}
async function botInviter(member){
 try{const logs=await member.guild.fetchAuditLogs({type:AuditLogEvent.BotAdd,limit:5});return logs.entries.find(e=>e.target?.id===member.id&&Date.now()-e.createdTimestamp<120000)?.executor?.id||null;}catch{return null;}
}
async function observe(guild,batch,retried){
 let next=null;try{next=await snapshot(guild);}catch(e){failure='Lecture des invitations impossible ('+(e.code||e.name)+').';}
 const nextVanity=await vanitySnapshot(guild);
 const found=cache&&next?candidates(cache,next,vanity,nextVanity):[];
 // Discord met parfois à jour le compteur après l'arrivée : une seconde lecture avant de conclure.
 if(!found.length&&!retried&&next){await new Promise(r=>setTimeout(r,4000));return observe(guild,batch,true);}
 const total=found.reduce((n,c)=>n+c.delta,0);
 const records={};
 for(const member of batch){
  const base={at:Date.now(),inviterId:null,code:null,channelId:null,uses:null,maxUses:null,method:'unknown',confidence:null,candidates:[]};
  if(member.user?.bot){const by=await botInviter(member);records[member.id]={...base,inviterId:by,method:'bot-oauth',confidence:by?'certaine':null,reason:by?null:'Bot ajouté par une intégration ; auteur introuvable dans le journal d’audit.'};continue;}
  const single=found.length===1&&total===batch.length?found[0]:null;
  if(single)records[member.id]={...base,inviterId:single.inviter,code:single.code,channelId:single.channelId,uses:single.uses,maxUses:single.maxUses,method:single.vanity?'vanity':'invite',confidence:'certaine'};
  else if(found.length)records[member.id]={...base,method:'ambiguous',confidence:'probable',candidates:found.slice(0,5).map(c=>({code:c.code,inviterId:c.inviter,vanity:!!c.vanity})),reason:`${batch.length} arrivée(s) simultanée(s) pour ${found.length} invitation(s) utilisée(s).`};
  else records[member.id]={...base,reason:failure||(!cache?'Suivi des invitations pas encore initialisé (redémarrage récent).':'Aucun compteur d’invitation n’a bougé : arrivée via Discovery, un lien d’un autre serveur partenaire ou une invitation déjà expirée.')};
 }
 a.save(s=>{s.schoolInviteAttribution||={};Object.assign(s.schoolInviteAttribution,records);});
 if(next)cache=next;vanity=nextVanity;
}
function joined(member){
 pending.push(member);if(timer)return;
 timer=setTimeout(()=>{timer=null;const batch=pending.splice(0);a.serial('invite-observation',()=>observe(member.guild,batch,false)).catch(e=>{console.warn('Suivi invitations QG :',e.code||e.name);cache=null;});},1500);
 timer.unref();
}
function invitedCount(inviterId){return Object.values(a.state().schoolInviteAttribution||{}).filter(r=>r.inviterId===inviterId&&r.confidence==='certaine').length;}
function description(id){
 const r=a.state().schoolInviteAttribution?.[id];
 if(!r)return 'Inconnu — arrivée antérieure au suivi des invitations';
 if(r.method==='bot-oauth')return r.inviterId?`<@${r.inviterId}> — a ajouté ce bot (journal d’audit)`:'Inconnu — '+r.reason;
 if(r.inviterId){const n=invitedCount(r.inviterId);return `<@${r.inviterId}> \`${r.inviterId}\`\n${n} membre${n>1?'s':''} invité${n>1?'s':''} au total`;}
 if(r.method==='vanity')return 'Personne : lien personnalisé du serveur';
 if(r.candidates?.length)return 'Probablement : '+r.candidates.map(c=>c.vanity?'lien personnalisé':c.inviterId?`<@${c.inviterId}>`:'`'+c.code+'`').join(' ou ')+`\n-# ${r.reason}`;
 return 'Inconnu — '+(r.reason||'aucune attribution fiable');
}
function linkDescription(id){
 const r=a.state().schoolInviteAttribution?.[id];
 if(!r?.code||!/^[\w-]+$/.test(r.code))return r?.candidates?.length?'Liens possibles : '+r.candidates.map(c=>`discord.gg/${c.code}`).join(', '):'Inconnu';
 const use=r.uses?` · utilisation n°${r.uses}${r.maxUses?'/'+r.maxUses:''}`:'';
 return `${r.method==='vanity'?'Lien personnalisé':'Invitation'} : https://discord.gg/${r.code}${r.channelId?` · salon <#${r.channelId}>`:''}${use}`;
}
module.exports={start,joined,created,removed,description,linkDescription};
