const {PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin');
const config=require('../config/qg');
const names={prison:'Prison',handcuffs:'Menotté',dog:'Chien RP'};
const keys={prison:'rpPrison',handcuffs:'rpHandcuffs',dog:'rpDog'};
const restrictions=['SendMessages','SendMessagesInThreads','CreatePublicThreads','CreatePrivateThreads','AddReactions','SendVoiceMessages','SendPolls','Connect','Speak','Stream'];
const MASK=restrictions.reduce((v,k)=>v|(P[k]||0n),0n);
const status=id=>a.state().schoolRpStatus?.[id]||{};
function persist(id,kind,value){a.save(s=>{s.schoolRpStatus||={};s.schoolRpStatus[id]||={};if(value)s.schoolRpStatus[id][kind]=value;else delete s.schoolRpStatus[id][kind];});}
function snap(ch,id){const o=ch.permissionOverwrites.cache.get(id);return{existed:!!o,allow:String(o?.allow.bitfield||0n),deny:String(o?.deny.bitfield||0n)};}
async function ensureRole(guild,kind){return a.serial('rp-roles',async()=>{
 const id=a.state().schoolRoles?.[keys[kind]];let role=id?await guild.roles.fetch(id):null;
 if(id&&!role)throw Error('Le rôle configuré a été supprimé. Corrige sa configuration avant de poursuivre.');
 if(!role){await guild.roles.fetch();role=guild.roles.cache.find(r=>r.name===names[kind]&&!r.managed);}
 if(!role&&kind==='prison')role=guild.roles.cache.find(r=>r.name==='Prison RP'&&!r.managed);
 if(!role)role=await guild.roles.create({name:names[kind],permissions:[],color:0x999999,reason:'Rôle de gestion QG'});
 if(role.permissions.bitfield!==0n||!role.editable)throw Error('Le rôle doit être modifiable et sans permission globale.');
 if(kind==='prison'&&role.name!==names.prison)await role.setName(names.prison,'Prison Discord QG');
 a.save(s=>{s.schoolRoles||={};s.schoolRoles[keys[kind]]=role.id;});return role;
});}
async function channels(guild){return [...(await guild.channels.fetch()).values()].filter(c=>c&&!c.isThread()&&c.permissionOverwrites).sort((x,y)=>Number(!!x.parentId)-Number(!!y.parentId));}
async function restore(member,rec){
 const errors=[],conflicts=[];
 for(const [id,before] of Object.entries(rec.channels||{})){
  try{
   const ch=await member.guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});
   if(ch){
    const now=snap(ch,member.id),allow=BigInt(now.allow),deny=BigInt(now.deny),ba=BigInt(before.allow),bd=BigInt(before.deny),patch={};
    for(const key of (rec.restrictions||restrictions)){const bit=P[key];if(!bit)continue;
     // Preserve restrictions already present before prison, and later edits that differ from our denial.
     if((bd&bit)!==0n)continue;
     if((deny&bit)!==0n&&(allow&bit)===0n)patch[key]=(ba&bit)!==0n?true:null;
     else if((allow&bit)!==(ba&bit)||(deny&bit)!==(bd&bit))conflicts.push(ch.id+':'+key);
    }
    if(Object.keys(patch).length)await ch.permissionOverwrites.edit(member.id,patch,{reason:'Libération de prison : restaurer seulement les permissions de prison'});
    const current=ch.permissionOverwrites.cache.get(member.id);
    if(!before.existed&&current&&current.allow.bitfield===0n&&current.deny.bitfield===0n)await ch.permissionOverwrites.delete(member.id,'Nettoyage de la restriction de prison vide');
   }
   delete rec.channels[id];persist(member.id,'prison',rec);
  }catch{errors.push(id);}
 }
 rec.conflicts=conflicts;
 if(errors.length)throw Error(`Libération partielle : ${errors.length} salon(s) à restaurer. Relance Libérer ; le suivi est conservé.`);
}
async function apply(member,kind,actor,reason,minutes=0,jail=null){
 if(!names[kind])throw Error('Statut inconnu.');if(status(member.id)[kind])throw Error('Ce statut est déjà actif.');
 if(kind==='prison'&&member.permissions.has(P.Administrator))throw Error('Discord ne permet pas de restreindre un administrateur par permissions de salons.');
 const bot=await member.guild.members.fetchMe();a.hierarchy(actor,member,bot);
 let list=[];
 if(kind==='prison'){
  list=(await channels(member.guild)).filter(ch=>!jail||![jail.categoryId,jail.channelId].includes(ch.id));
  for(const ch of list)if(!ch.permissionsFor(bot)?.has([P.ViewChannel,P.ManageRoles])||!ch.permissionOverwrites.cache.has(member.id)&&ch.permissionOverwrites.cache.size>=100)throw Error('Le bot ne peut pas sécuriser tous les salons. Vérifie ses permissions et les limites des dérogations.');
  if(member.voice?.channelId&&!member.voice.channel.permissionsFor(bot)?.has(P.MoveMembers))throw Error('Le bot doit pouvoir déconnecter le membre du vocal.');
 }
 const role=await ensureRole(member.guild,kind);a.hierarchy(actor,member,bot,[role]);
 if(member.roles.cache.has(role.id))throw Error('Ce rôle est déjà présent sans dossier associé. Retire-le manuellement avant une nouvelle attribution.');
 const rec={roleId:role.id,reason,actorId:actor.id,createdAt:Date.now(),expiresAt:minutes?Date.now()+minutes*60000:null,state:'applying',channels:{},jail,restrictions:jail?['ViewChannel','Connect']:restrictions};
 if(kind==='prison')for(const ch of list)rec.channels[ch.id]=snap(ch,member.id);
 persist(member.id,kind,rec);
 try{
  await member.roles.add(role.id,'Statut QG : '+reason.slice(0,350));
  if(kind==='prison'){
   const patch=Object.fromEntries((rec.restrictions||restrictions).filter(k=>P[k]).map(k=>[k,false]));
   for(const ch of list)await ch.permissionOverwrites.edit(member.id,patch,{reason:'Prison Discord QG : écriture et vocal bloqués'});
   if(member.voice?.channelId)await member.voice.disconnect('Prison Discord QG');
  }
  rec.state='active';persist(member.id,kind,rec);return rec;
 }catch(error){
  rec.state='releasing';persist(member.id,kind,rec);
  try{if(kind==='prison')await restore(member,rec);await member.roles.remove(role.id,'Annulation du statut incomplet');persist(member.id,kind,null);}catch{throw Error('Application partielle : dossier de restauration conservé. Utilise Libérer pour terminer.');}
  throw Error('Action annulée et accès restaurés : '+(error.code||'erreur Discord'));
 }
}
async function release(member,kind){
 const rec=status(member.id)[kind];if(!rec)throw Error('Ce statut n’est pas actif.');
 rec.state='releasing';persist(member.id,kind,rec);if(kind==='prison')await restore(member,rec);
 if(rec.jail){const ch=await member.guild.channels.fetch(rec.jail.channelId).catch(e=>{if(e.code===10003)return null;throw e;});if(ch)await ch.permissionOverwrites.delete(member.id,'Fin du jail');}
 await member.roles.remove(rec.roleId,'Fin du statut QG');persist(member.id,kind,null);return rec;
}
async function reconcile(guild){
 if(guild.id!==config.guildId)return;
 for(const [id,records] of Object.entries(a.state().schoolRpStatus||{}))for(const [kind,record] of Object.entries(records)){
  await a.serial('member:'+id,async()=>{
   const rec=status(id)[kind];if(!rec)return;
   const member=await guild.members.fetch({user:id,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
   // A departed member can still have member overwrites. Keep the record until rejoin/cleanup by staff.
   if(!member)return;
   if(rec.state!=='active'||rec.expiresAt&&rec.expiresAt<=Date.now()){
    await release(member,kind);await a.audit(guild,{action:'rp.expire.'+kind,actorId:guild.client.user.id,targetId:id,before:{status:kind},after:{status:'libéré'},reason:'Expiration ou reprise après interruption'});return;
   }
   if(kind==='prison')for(const ch of await channels(guild))if((!rec.jail||![rec.jail.categoryId,rec.jail.channelId].includes(ch.id))&&(!rec.channels[ch.id]||rec.pendingChannels?.includes(ch.id))){
    rec.channels[ch.id] ||= snap(ch,id);
    rec.pendingChannels = [...new Set([...(rec.pendingChannels||[]),ch.id])];persist(id,kind,rec);
    await ch.permissionOverwrites.edit(id,Object.fromEntries((rec.restrictions||restrictions).filter(k=>P[k]).map(k=>[k,false])),{reason:'Prison Discord : protection du nouveau salon'});
    rec.pendingChannels=rec.pendingChannels.filter(value=>value!==ch.id);persist(id,kind,rec);
   }
  }).catch(async()=>{await a.audit(guild,{action:'rp.reconcile.failed',actorId:guild.client.user.id,targetId:id,result:'failed',reason:'Restriction ou restauration incomplète ; nouvelle tentative au prochain passage.'});});
 }
}
module.exports={apply,release,reconcile,status,ensureRole,restore,snap,restrictions,MASK};
