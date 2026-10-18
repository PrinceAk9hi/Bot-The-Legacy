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
   overwrites.push({id:member.id,allow:[P.ViewChannel,P.Connect,P.Speak,P.UseVAD],deny:denied});
   room=await newState.guild.channels.create({name:`🔊・Vocal de ${member.displayName}`.slice(0,95),type:ChannelType.GuildVoice,parent:parentId,permissionOverwrites:overwrites,reason:'Création d’un vocal temporaire SchoolRP'});
   save(x=>{x.schoolTemporaryVoices||={};x.schoolTemporaryVoices[room.id]={ownerId:member.id,kind,createdAt:Date.now(),locked:false};x.schoolVoiceCreation||={};x.schoolVoiceCreation[member.id]=Date.now();});
   // Controls are available in the commands channel, outside the disabled voice chat.
  }
  const fresh=await newState.guild.members.fetch(member.id);await fresh.voice.setChannel(room,'Création d’un vocal temporaire');return true;
 }
 const rec=oldState.channelId&&s.schoolTemporaryVoices?.[oldState.channelId];
 if(rec){const room=oldState.guild.channels.cache.get(oldState.channelId);if(room&&room.members.size===0){await room.delete('Vocal temporaire vide');save(x=>{delete x.schoolTemporaryVoices[oldState.channelId];});}}
 return false;
}
async function handle(i){
 if(await require('./qgVoiceControls').handle(i))return true;
 if(!i.customId?.startsWith('qgs:temp:'))return false;
 await i.reply({content:'Utilise le nouveau panneau « Mon vocal temporaire » dans le salon commandes.',flags:MessageFlags.Ephemeral});return true;

}
async function modal(i){
 if(!i.customId?.startsWith('qgs:temp-modal:'))return false;
 await i.reply({content:'Ce formulaire a expiré. Utilise le panneau vocal du salon commandes.',flags:MessageFlags.Ephemeral});return true;

}
async function clean(guild){const s=state();for(const [id] of Object.entries(s.schoolTemporaryVoices||{})){const room=await guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});if(!room||room.members.size===0){if(room)await room.delete('Nettoyage des vocaux temporaires après redémarrage');save(x=>{delete x.schoolTemporaryVoices[id];});}}}
module.exports={voice,handle,modal,clean,panel:require('./qgVoiceControls').panel,_test:{accessRoles,isFamily}};
