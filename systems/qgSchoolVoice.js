const { PermissionFlagsBits: P, MessageFlags, ChannelType } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');
const save = fn => update('qgServer', fn);
const state = () => read('qgServer');
const familyKeys = ['senior','prestigious','expert','confirmed','test','ticketsLead','recruitmentLead','animationLead','networksLead','ticketsManagement','recruitmentManagement','animationManagement','networksManagement'];
const accessRoles = (r,kind) => kind==='family' ? ['creator','globalManager','administrator',...familyKeys].map(k=>r[k]).filter(Boolean) : ['community','creator','globalManager','administrator',...familyKeys].map(k=>r[k]).filter(Boolean);
const isFamily = member => { const r=state().schoolRoles||{};return ['creator','globalManager','administrator',...familyKeys].some(k=>r[k]&&member.roles.cache.has(r[k])); };
async function voice(oldState,newState,client){
 const s=state(),channels=s.schoolChannels||{},roles=s.schoolRoles||{},member=newState.member;
 if(newState.guild.id!==config.guildId||!member||member.user.bot)return false;
 const kinds=[['createCommunityVoice','community','communityVoice'],['createFamilyVoice','family','familyVoice']];
 for(const [entry,kind,scope] of kinds){
  if(newState.channelId!==channels[entry]||oldState.channelId===newState.channelId)continue;
  const live=await newState.guild.members.fetch(member.id);if(live.voice.channelId!==channels[entry])return true;
  if(kind==='family'&&!isFamily(member))return true;
  if(kind==='community'&&!member.roles.cache.has(roles.community)&&!require('./qgCommunityPolicy').exempt(member,s))return true;
  const current=Object.entries(s.schoolTemporaryVoices||{}).find(([,rec])=>rec.ownerId===member.id&&rec.kind===kind);
  let room=current?await newState.guild.channels.fetch(current[0]).catch(e=>{if(e.code===10003)return null;throw e;}):null;
  if(!room){
   if(Date.now()-(s.schoolVoiceCreation?.[member.id]||0)<30000){await live.voice.disconnect('Patiente 30 secondes entre deux créations de vocal.');return true;}
   const parentId=(s.schoolCategories||{})[kind==='family'?'familyVoice':'communityVoice'];if(!parentId)throw new Error('Installe d’abord la structure SchoolRP.');
   const overwrites=layout.overwrites(newState.guild.id,client.user.id,roles,scope,{channelKey:'temporaryVoice'});
   const denied=require('./qgCommunityPolicy').voiceDenied.map(k=>P[k]);
   for(const item of overwrites)if(item.id!==client.user.id){item.allow=(item.allow||[]).filter(bit=>!denied.includes(bit));item.deny=[...(item.deny||[]),...denied];}
   overwrites.push({id:member.id,allow:[P.ViewChannel,P.Connect,P.Speak,P.UseVAD,P.ReadMessageHistory],deny:denied.filter(bit=>bit!==P.ReadMessageHistory)});
   room=await newState.guild.channels.create({name:`🔊・Vocal de ${member.displayName}`.slice(0,95),type:ChannelType.GuildVoice,parent:parentId,permissionOverwrites:overwrites,reason:'Création d’un vocal temporaire SchoolRP'});
   save(x=>{x.schoolTemporaryVoices||={};x.schoolTemporaryVoices[room.id]={ownerId:member.id,kind,createdAt:Date.now(),locked:false};x.schoolVoiceCreation||={};x.schoolVoiceCreation[member.id]=Date.now();});
   // Panel de gestion posté directement dans le tchat de la nouvelle voc.
   await room.send(roomPanel(room.id,state().schoolTemporaryVoices[room.id],member.id)).catch(e=>console.error('Panel du vocal temporaire :',e.code||e.message));
  }
  const fresh=await newState.guild.members.fetch(member.id);await fresh.voice.setChannel(room,'Création d’un vocal temporaire');return true;
 }
 const rec=oldState.channelId&&s.schoolTemporaryVoices?.[oldState.channelId];
 if(rec){
  const room=oldState.guild.channels.cache.get(oldState.channelId);
  if(room&&room.members.size===0){await room.delete('Vocal temporaire vide');save(x=>{delete x.schoolTemporaryVoices[oldState.channelId];});}
  // Le propriétaire part et d'autres restent : la voc passe automatiquement au membre suivant.
  else if(room&&member.id===rec.ownerId){const next=heir(room,member.id);if(next)await require('./qgVoiceControls').transfer(room,next,{reason:'Le propriétaire a quitté le vocal'});}
 }
 return false;
}
// Héritier : le membre (hors bots) arrivé le plus tôt dans la voc, d'après l'ordre de Discord.
function heir(room,ownerId){return [...room.members.values()].find(m=>!m.user.bot&&m.id!==ownerId)||null;}
// Panel du tchat de la voc : contrôles de la voc et mention du propriétaire.
function roomPanel(id,rec,ownerId){const p=require('./qgVoiceControls').controls(id,rec);return{...p,content:`<@${ownerId}> voici les réglages de ton vocal.`,allowedMentions:{parse:[],users:[ownerId]}};}
// Anciens panneaux « Mon vocal temporaire » des salons commandes : supprimés une fois.
async function retireCommandPanels(guild){
 const panels=state().schoolPanels||{};let removed=0;
 for(const key of ['communityCommands','familyCommands']){
  const rec=panels[key];if(!rec)continue;
  const ch=await guild.channels.fetch(rec.channelId).catch(()=>null);
  const msg=ch?.isTextBased?.()?await ch.messages.fetch(rec.messageId).catch(()=>null):null;
  if(msg&&msg.author?.id===guild.client.user.id){await msg.delete().catch(()=>{});removed++;}
  save(x=>{if(x.schoolPanels)delete x.schoolPanels[key];});
 }
 return{detail:removed?removed+' ancien(s) panneau(x) vocal retiré(s) des salons commandes':'Aucun panneau vocal dans les salons commandes'};
}
async function handle(i){
 if(await require('./qgVoiceControls').handle(i))return true;
 if(!i.customId?.startsWith('qgs:temp:'))return false;
 await i.reply({content:'Les réglages de ton vocal sont dans le tchat de ton vocal temporaire.',flags:MessageFlags.Ephemeral});return true;

}
async function modal(i){
 if(!i.customId?.startsWith('qgs:temp-modal:'))return false;
 await i.reply({content:'Ce formulaire a expiré. Utilise les réglages dans le tchat de ton vocal.',flags:MessageFlags.Ephemeral});return true;

}
async function clean(guild){const s=state();for(const [id] of Object.entries(s.schoolTemporaryVoices||{})){const room=await guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});if(!room||room.members.size===0){if(room)await room.delete('Nettoyage des vocaux temporaires après redémarrage');save(x=>{delete x.schoolTemporaryVoices[id];});}}}
module.exports={voice,handle,modal,clean,retireCommandPanels,roomPanel,panel:require('./qgVoiceControls').panel,_test:{accessRoles,isFamily,heir}};
