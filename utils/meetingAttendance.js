const {randomUUID,createHash}=require('node:crypto');
const {Events,GuildScheduledEventStatus,EmbedBuilder}=require('discord.js');
const {IDENTITY,ROLES,COLORS}=require('../config/soulSociety');
const {read,update}=require('./recruitmentData');
const {members}=require('./familyMembers');
const {isProtectedUser}=require('./security');
const {isOff}=require('./lineState');
const absences=require('./memberAbsence');
const {CONFERENCE}=require('./familyMeetings');
const LEVELS=['1468698882002387044','1468698901077823653','1468698902428516524'];
const SANCTIONS='1478798666470002929';
const boot=randomUUID();let running=false;
function nextLevel(member){const n=LEVELS.reduce((n,id,i)=>member.roles.cache.has(id)?i:n,-1);return LEVELS[Math.min(n+1,LEVELS.length-1)];}
function protectedMember(member){return member.user.bot||isProtectedUser(member.id);}
function absenceRole(member){return member.roles.cache.has(absences.ABSENT)||member.roles.cache.has(absences.FROZEN);}
function patch(id,fn){update('meetingAttendance',all=>{all[id]||={};fn(all[id]);});}
function markVoice(state,now=Date.now()){
 if(state.guild.id!==IDENTITY.guildId||state.channelId!==CONFERENCE||state.member?.user.bot||isOff())return;
 for(const [id,r]of Object.entries(read('familyMeetings'))){if(!r.cancelledAt&&r.start<=now&&r.end>now)patch(id,s=>{s.present||={};s.present[state.id]=now;});}
}
function completeCoverage(s,r){return s.boot===boot&&!s.incomplete&&s.startedAt<=r.start+30000&&s.lastSeen>=r.end-30000;}
async function sanction(guild,id,r,userId){
 const state=read('meetingAttendance')[id],old=state.sanctions?.[userId];
 if(old&&old.status!=='retry')return;
 if(old?.retryAt>Date.now()||isOff())return;
 const member=await guild.members.fetch({user:userId,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
 const skip=reason=>patch(id,s=>{s.sanctions||={};s.sanctions[userId]={status:'exempt',reason,at:Date.now()};});
 if(!member||!member.roles.cache.has(ROLES.member)||protectedMember(member))return skip('Membre parti, bot ou compte protégé');
 if(state.present?.[userId]||state.excused?.[userId]||absences.excused(guild.id,userId,r.start,r.end))return skip('Présence ou absence déclarée');
 const role=old?.role||nextLevel(member);
 // Persist a fixed target before applying it. A restart cannot escalate twice.
 patch(id,s=>{s.sanctions||={};s.sanctions[userId]={status:'pending',role,at:Date.now()};});
 try{if(!member.roles.cache.has(role))await member.roles.add(role,'Absence injustifiée à la réunion '+r.name);}
 catch(e){patch(id,s=>{s.sanctions[userId]={status:typeof e.code==='number'&&e.code>=10000?'retry':'uncertain',role,code:String(e.code||e.name),retryAt:Date.now()+300000};});throw e;}
 patch(id,s=>{s.sanctions[userId].status='applied';});
 const nonce=createHash('sha256').update(id+':'+userId).digest('hex').slice(0,24);
 try{const channel=await guild.channels.fetch(SANCTIONS);await channel.send({nonce,enforceNonce:true,content:`⚠️ **Absence injustifiée à une réunion**\nMembre : <@${userId}>\nRéunion : **${r.name.replace(/[@*_`]/g,'')}** — <t:${Math.floor(r.start/1000)}:F>\nAvertissement : <@&${role}>\nAucune présence observée et aucune absence déclarée pour cette réunion.`,allowedMentions:{parse:[],users:[userId]}});patch(id,s=>{s.sanctions[userId].log='sent';});}
 catch(e){patch(id,s=>{s.sanctions[userId].log='uncertain';});console.error('Annonce avertissement réunion :',e.code||e.message);}
}
async function finish(guild,id,r){const s=read('meetingAttendance')[id];if(s?.finished)return;
 if(!s||!completeCoverage(s,r)){patch(id,v=>{v.finished=true;v.outcome='Aucune sanction : suivi incomplet de la réunion';});return;}
 for(const userId of s.expected||[]){if(isOff())return;try{await sanction(guild,id,r,userId);}catch(e){console.error('Sanction réunion :',e.code||e.message);}}
 const final=read('meetingAttendance')[id];if((s.expected||[]).every(userId=>final.sanctions?.[userId]&&final.sanctions[userId].status!=='retry'))patch(id,v=>{v.finished=true;v.outcome='Suivi terminé';});
}
function interruptCoverage(){for(const [id,r]of Object.entries(read('familyMeetings')))if(r.start<=Date.now()&&r.end>Date.now())patch(id,s=>{s.incomplete=true;});}
async function tick(guild){if(running)return;if(isOff()||guild.available===false){interruptCoverage();return;}running=true;try{
 for(const [id,original]of Object.entries(read('familyMeetings'))){let r=original;const now=Date.now();let s=read('meetingAttendance')[id];
  if(r.guildId!==guild.id||r.cancelledAt||s?.finished||r.start>now+60000)continue;
  // Never sanction historical meetings which ended before this feature existed.
  if(!r.attendanceVersion){if(r.start<=now)continue;update('familyMeetings',all=>{all[id].attendanceVersion=1;});}
  const event=await guild.scheduledEvents.fetch(id).catch(e=>{if(e.code===10070)return null;throw e;});
  if(!event||event.status===GuildScheduledEventStatus.Canceled){patch(id,v=>{v.finished=true;v.outcome='Réunion annulée';});continue;}
  if(event.channelId&&event.channelId!==CONFERENCE){patch(id,v=>{v.finished=true;v.outcome='Aucune sanction : réunion déplacée hors du salon conférence suivi';});continue;}
  const start=event.scheduledStartTimestamp,end=event.scheduledEndTimestamp||r.end;
  if(start!==r.start||end!==r.end){update('familyMeetings',all=>{all[id].start=start;all[id].end=end;});r={...r,start,end};if(s)patch(id,v=>{v.incomplete=true;});}
  if(now<r.start-60000)continue;
  if(now>=r.end){await finish(guild,id,r);continue;}
  if(!s?.expected){const roster=await members(guild,true);const expected=[...roster.values()].filter(m=>!protectedMember(m)&&m.roles.cache.has(ROLES.member)).map(m=>m.id);
   const exempt=now>=r.start?Object.fromEntries([...roster.values()].filter(absenceRole).map(m=>[m.id,true])):{};
   patch(id,v=>{v.expected=expected;v.excused={...v.excused,...exempt};v.boot=boot;v.startedAt=Date.now();v.lastSeen=Date.now();v.present||={};v.incomplete=Date.now()>r.start+30000;});s=read('meetingAttendance')[id];
  }
  patch(id,v=>{if(v.boot!==boot||now-v.lastSeen>45000)v.incomplete=true;v.lastSeen=now;});
  if(now>=r.start){
   for(const userId of s.expected||[]){const member=guild.members.cache.get(userId);if(member&&absenceRole(member))patch(id,v=>{v.excused||={};v.excused[userId]=true;});}
   for(const state of guild.voiceStates.cache.values())markVoice(state,now);
  }
 }
 }finally{running=false;}}
function register(client){if(client.meetingAttendanceRegistered)return;client.meetingAttendanceRegistered=true;
 client.on(Events.VoiceStateUpdate,(oldState,newState)=>{markVoice(oldState);markVoice(newState);});
 client.on(Events.ShardDisconnect,interruptCoverage);client.on(Events.ShardReconnecting,interruptCoverage);
 const task=()=>{const guild=client.guilds.cache.get(IDENTITY.guildId);if(guild)tick(guild).catch(e=>console.error('Présence réunion :',e.code||e.message));};
 const start=()=>{task();setInterval(task,15000).unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={LEVELS,nextLevel,completeCoverage,markVoice,sanction,finish,tick,register};
