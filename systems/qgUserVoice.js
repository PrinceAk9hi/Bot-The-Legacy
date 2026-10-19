const {randomUUID}=require('node:crypto');
const {PermissionFlagsBits:P,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S}=require('discord.js');
const a=require('../utils/qgAdmin');
const {embed}=require('./qgPanels');
async function check(i,details,id,action,destination){
 const ctx=await details(i,id),{actor,member}=ctx,bot=await i.guild.members.fetchMe();
 if(!a.can(actor,'prison'))throw Error('Action vocale réservée à la direction et à la Gestion Support.');
 a.hierarchy(actor,member,bot);
 if(!member.voice.channelId)throw Error('Ce membre n’est plus connecté à un vocal.');
 const source=await i.guild.channels.fetch(member.voice.channelId);
 if(!source?.permissionsFor(actor)?.has([P.ViewChannel,P.MoveMembers])||!source.permissionsFor(bot)?.has([P.ViewChannel,P.MoveMembers]))throw Error('Permission de déplacement manquante dans le vocal actuel.');
 if(action!=='disconnect'){
  const channel=await i.guild.channels.fetch(destination);
  if(!channel||channel.guildId!==i.guildId||channel.type!==2)throw Error('Vocal de destination invalide.');
  for(const person of [actor,bot,member])if(!channel.permissionsFor(person)?.has([P.ViewChannel,P.Connect]))throw Error('La destination doit être accessible au membre, à toi et au bot.');
  if(channel.userLimit&&channel.members.size>=channel.userLimit)throw Error('Ce vocal est complet.');
 }
 return ctx;
}
async function handle(i,id,action,details,nonce){
 if(action==='confirm')return a.serial('member:'+a.state().schoolUserSessions?.[id]?.targetId,async()=>{
  const initial=await details(i,id),pending=initial.s.voicePending;
  if(!pending||pending.nonce!==nonce)throw Error('Confirmation expirée ou déjà utilisée.');
  const {member}=await check(i,details,id,pending.action,pending.destination);
  if(member.voice.channelId!==pending.source)throw Error('Le membre a changé de vocal. Recommence depuis le panneau.');
  a.save(s=>{delete s.schoolUserSessions[id].voicePending;});
  try{
   if(pending.action==='disconnect')await member.voice.disconnect('Administration QG');
   else await member.voice.setChannel(pending.destination,'Administration QG');
   a.save(s=>{s.schoolUserSessions[id].previousVoiceId=pending.source;});
   await a.audit(i.guild,{action:'voice.'+pending.action,actorId:i.user.id,targetId:member.id,before:{channelId:pending.source},after:{channelId:pending.destination||null}});
   return i.editReply({content:'Action vocale effectuée. Clique sur Vocal pour actualiser le panneau.',embeds:[],components:[],allowedMentions:{parse:[]}});
  }catch(e){await a.audit(i.guild,{action:'voice.'+pending.action,actorId:i.user.id,targetId:member.id,result:'failed'});throw e;}
 });
 const {actor,member,s}=await details(i,id);
 if(!['bring','back','move','disconnect'].includes(action))throw Error('Action vocale inconnue.');
 const destination=action==='bring'?actor.voice.channelId:action==='back'?s.previousVoiceId:action==='move'?i.values?.[0]:null;
 await check(i,details,id,action,destination);
 const pending={action,destination,source:member.voice.channelId,nonce:randomUUID()};
 a.save(data=>{data.schoolUserSessions[id].voicePending=pending;});
 return i.editReply({embeds:[embed('Confirmer • Action vocale',`Membre : <@${member.id}>\nSalon actuel : <#${pending.source}>\n${destination?`Destination : <#${destination}>`:'Déconnexion du vocal.'}`)],components:[new Row().addComponents(new Button().setCustomId(`qgu:voiceconfirm:${id}:${pending.nonce}`).setLabel('Confirmer').setStyle(S.Danger),new Button().setCustomId(`qgu:voicecancel:${id}`).setLabel('Annuler').setStyle(S.Secondary))],allowedMentions:{parse:[]}});
}
module.exports={handle};
