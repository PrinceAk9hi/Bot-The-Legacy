const {ChannelType,PermissionFlagsBits:P}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const s=()=>read('qgServer');
const save=fn=>update('qgServer',fn);
function team(type){return ['report','foundation','complaint'].includes(type)?['creator','globalManager']:type==='event'?['creator','globalManager','administrator','animationLead','animationManagement']:['creator','globalManager','administrator','ticketsLead','ticketsManagement'];}
function overwrites(guild,userId,type){const roles=s().schoolRoles||{};const allowed=[guild.client.user.id,...team(type).map(k=>roles[k]).filter(Boolean)];const grants=new Map([[guild.id,{id:guild.id,deny:[P.ViewChannel]}]]);
 // Explicit denials protect reports and Foundation tickets from broader category roles.
 if(['report','foundation','complaint'].includes(type))for(const role of guild.roles.cache.values())if(!allowed.includes(role.id)&&role.id!==guild.id)grants.set(role.id,{id:role.id,deny:[P.ViewChannel]});
 for(const id of [...allowed,...(userId?[userId]:[])])grants.set(id,{id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.EmbedLinks,P.AttachFiles],deny:id===guild.client.user.id?[]:[P.MentionEveryone]});
 if(grants.size>100)throw Error('Trop de rôles pour garantir les permissions du ticket privé.');return [...grants.values()];}
let installing;
async function ensure(guild){
 if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');if(installing)return installing;
 installing=(async()=>{const me=await guild.members.fetchMe();if(!me.permissions.has([P.ManageChannels,P.ManageRoles,P.KickMembers]))throw Error('Le bot a besoin de Gérer les salons, Gérer les rôles et Expulser des membres pour cette mise à jour.');await guild.channels.fetch();const r=s().schoolRoles||{};
 for(const [key,name,type] of [['ticketInbox','✦・TICKETS EN COURS','questions'],['supportManagement','✦・GESTION SUPPORT','questions'],['animationManagement','✦・GESTION ANIMATION','event']]){
  let ch=s().schoolCategories?.[key]&&guild.channels.cache.get(s().schoolCategories[key]);
  ch||=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name===name);
  if(!ch)ch=await guild.channels.create({name,type:ChannelType.GuildCategory,permissionOverwrites:overwrites(guild,null,type),reason:'Organisation des tickets QG'});
  save(x=>{x.schoolCategories||={};x.schoolCategories[key]=ch.id;});
 }
 const absent=r.absent&&guild.roles.cache.get(r.absent)||guild.roles.cache.find(role=>role.name==='Absent');
 const role=absent||await guild.roles.create({name:'Absent',color:0xaaaaaa,permissions:[],reason:'Suivi des absences QG'});
 if(role.permissions?.bitfield && role.permissions.bitfield!==0n)throw Error('Le rôle Absent existant contient des permissions : retire-les avant de l’utiliser pour les absences.');
 save(x=>{x.schoolRoles||={};x.schoolRoles.absent=role.id;});
 const inbox=guild.channels.cache.get(s().schoolCategories.ticketInbox);await inbox.setPosition(guild.channels.cache.size-1);
 return inbox.id;})();try{return await installing;}finally{installing=null;}
}
const moving=new Set();
async function escalate(channel,reason){if(moving.has(channel.id))return false;moving.add(channel.id);try{
 const rec=s().tickets?.[channel.id];if(!rec||rec.escalatedAt)return false;
 const key=['report','foundation','complaint'].includes(rec.type)?'foundation':rec.type==='event'?'animationManagement':'supportManagement';
 const dest=s().schoolCategories?.[key];if(!dest)throw Error('Lance la mise à jour QG pour créer les catégories de traitement.');
 // Never synchronize with the destination category: applicant and team access stay explicit.
 await channel.permissionOverwrites.set(overwrites(channel.guild,rec.ownerId,rec.type));
 await channel.setParent(dest,{lockPermissions:false,reason:'Transmission à l’équipe concernée'});
 save(x=>{x.tickets[channel.id].escalatedAt=Date.now();x.tickets[channel.id].escalationReason=reason.slice(0,1000);});
 const role=s().schoolRoles?.[key==='foundation'?'globalManager':key==='animationManagement'?'animationManagement':'ticketsManagement'];
 await channel.send({content:role?`<@&${role}>`:undefined,embeds:[require('./qgPanels').embed('Relais à l’équipe',reason.slice(0,2000))],allowedMentions:{parse:[],roles:role?[role]:[]}});return true;
 }finally{moving.delete(channel.id);}}
module.exports={ensure,escalate,overwrites,team};
