const {ChannelType,GuildScheduledEventEntityType,GuildScheduledEventPrivacyLevel,GuildScheduledEventStatus,EmbedBuilder,PermissionFlagsBits:P}=require('discord.js');
const {ROLES,COLORS}=require('../config/soulSociety');
const {read,update}=require('./recruitmentData');
const {members}=require('./familyMembers');
const CONFERENCE='1477006110912413777',ANNOUNCEMENTS='1479760394300948531';
let creating=false,reminding=false;
async function privateConference(guild){
 const c=await guild.channels.fetch(CONFERENCE);if(!c||![ChannelType.GuildStageVoice,ChannelType.GuildVoice].includes(c.type))throw Error('Le salon conférence doit être un vocal ou une scène.');
 if(!read('familySchedule').conferenceBackup)update('familySchedule',s=>{s.conferenceBackup={at:Date.now(),channelId:c.id,overwrites:[...c.permissionOverwrites.cache.values()].map(o=>({id:o.id,type:o.type,allow:String(o.allow.bitfield),deny:String(o.deny.bitfield)}))};});
 const overwrites=new Map([...c.permissionOverwrites.cache.values()].map(o=>[o.id,{id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}]));
 const set=(id,type,allow,deny)=>{const o=overwrites.get(id)||{id,type,allow:0n,deny:0n};o.allow=(o.allow|allow)&~deny;o.deny=(o.deny|deny)&~allow;overwrites.set(id,o);};
 for(const o of overwrites.values())if(![guild.id,ROLES.member,guild.client.user.id].includes(o.id))o.allow&=~P.ViewChannel;
 set(guild.id,0,0n,P.ViewChannel|P.Connect);
 set(ROLES.member,0,P.ViewChannel|P.Connect,0n);
 set(guild.client.user.id,1,P.ViewChannel|P.Connect,0n);
 await c.permissionOverwrites.set([...overwrites.values()],'Réunions réservées aux membres — autres permissions conservées');
 return c;
}
async function create(guild,{name,description,start,duration,authorId}){
 if(creating)throw Error('Une création de réunion est déjà en cours.');creating=true;
 try{const c=await privateConference(guild);const event=await guild.scheduledEvents.create({name,description:description||'Réunion des membres de la Soul Society.',scheduledStartTime:new Date(start),scheduledEndTime:new Date(start+duration*60000),privacyLevel:GuildScheduledEventPrivacyLevel.GuildOnly,entityType:c.type===ChannelType.GuildStageVoice?GuildScheduledEventEntityType.StageInstance:GuildScheduledEventEntityType.Voice,channel:c.id,reason:'Réunion créée par '+authorId});
 const r={eventId:event.id,guildId:guild.id,name,start,end:start+duration*60000,authorId,createdAt:Date.now(),recipients:{},attendanceVersion:1};update('familyMeetings',all=>{all[event.id]=r;});
 try{const channel=await guild.channels.fetch(ANNOUNCEMENTS);const msg=await channel.send({content:`<@&${ROLES.member}>`,allowedMentions:{parse:[],roles:[ROLES.member]},embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📅 '+name).setDescription(description||'Réunion de la Soul Society.').addFields({name:'Date',value:`<t:${Math.floor(start/1000)}:F>`},{name:'Salon conférence',value:`<#${CONFERENCE}>`},{name:'Événement',value:`https://discord.com/events/${guild.id}/${event.id}`},{name:'Rappel',value:'Un MP sera envoyé 30 minutes avant (sauf absence déclarée). Une absence injustifiée pendant toute la réunion entraîne un avertissement progressif. Déclare ton absence dans <#1479835698793156833>.'})]});update('familyMeetings',all=>{all[event.id].announcementId=msg.id;});}
 catch(e){update('familyMeetings',all=>{all[event.id].announcementError=String(e.code||e.message).slice(0,150);});return {id:event.id,announcement:false};}
 return {id:event.id,announcement:true};
 }finally{creating=false;}
}
async function cancel(guild,id){const r=read('familyMeetings')[id];if(!r||r.guildId!==guild.id)throw Error('Cette réunion n’est pas enregistrée par le bot.');
 const e=await guild.scheduledEvents.fetch(id).catch(err=>{if(err.code===10070)return null;throw err;});if(e)await e.delete('Réunion annulée');
 update('familyMeetings',all=>{all[id].cancelledAt=Date.now();});
 if(r.announcementId){const c=await guild.channels.fetch(ANNOUNCEMENTS),m=await c.messages.fetch(r.announcementId);await m.edit({content:'❌ Réunion annulée : '+r.name,embeds:[],allowedMentions:{parse:[]}});}
}
async function reminders(guild){if(reminding)return;reminding=true;try{
 for(const [id,r]of Object.entries(read('familyMeetings'))){if(r.guildId!==guild.id||r.cancelledAt||r.done||r.start<=Date.now()||r.start-Date.now()>1800000)continue;
  const event=await guild.scheduledEvents.fetch(id).catch(e=>{if(e.code===10070)return null;throw e;});
  if(!event||[GuildScheduledEventStatus.Canceled,GuildScheduledEventStatus.Completed].includes(event.status)){update('familyMeetings',all=>{all[id].cancelledAt=Date.now();});continue;}
  const liveStart=event.scheduledStartTimestamp;if(liveStart!==r.start){update('familyMeetings',all=>{all[id].start=liveStart;all[id].recipients={};});continue;}
  const roster=await members(guild,true);
  for(const member of roster.values()){
   if(require('./lineState').isOff()||Date.now()>=r.start||read('familyMeetings')[id].cancelledAt)break;
   if(member.user.bot||require('./memberAbsence').excused(guild.id,member.id,r.start,r.end)||member.roles.cache.has(require('./memberAbsence').ABSENT)||member.roles.cache.has(require('./memberAbsence').FROZEN)||!member.roles.cache.has(ROLES.member)||read('familyMeetings')[id].recipients[member.id])continue;
   // A persisted claim prevents repeated DMs after an uncertain network failure/restart.
   update('familyMeetings',all=>{all[id].recipients[member.id]={status:'pending',at:Date.now()};});
   try{const m=await member.send({content:`📅 **Rappel de réunion — La Soul Society**\n${r.name}\nDébut dans ${Math.max(1,Math.ceil((r.start-Date.now())/60000))} minutes : <t:${Math.floor(r.start/1000)}:F>.\nSalon conférence : <#${CONFERENCE}>\nhttps://discord.com/events/${guild.id}/${id}`,allowedMentions:{parse:[]}});update('familyMeetings',all=>{all[id].recipients[member.id]={status:'sent',messageId:m.id,at:Date.now()};});}
   catch(e){update('familyMeetings',all=>{all[id].recipients[member.id]={status:'failed',code:String(e.code||e.name),at:Date.now()};});}
  }
  const sent=read('familyMeetings')[id].recipients;if([...roster.values()].filter(m=>!m.user.bot&&m.roles.cache.has(ROLES.member)).every(m=>sent[m.id]))update('familyMeetings',all=>{all[id].done=true;});
 }
 }finally{reminding=false;}}
module.exports={create,cancel,reminders,CONFERENCE};
