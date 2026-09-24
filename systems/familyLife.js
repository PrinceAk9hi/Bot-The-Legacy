const {Events}=require('discord.js');const {IDENTITY}=require('../config/soulSociety');const {read,update}=require('../utils/recruitmentData');const {isOff}=require('../utils/lineState');const {sunday}=require('../utils/familyCalendar');
module.exports=function(client){if(client.familyLifeRegistered)return;client.familyLifeRegistered=true;require("../utils/memberAbsence").register(client);require("../utils/meetingAttendance").register(client);require("../utils/birthdayBoard").register(client);let running=false,birthdayNext=0,consentNext=0;
 client.on(Events.InteractionCreate,i=>{require('../utils/familyBirthdays').handle(i).catch(e=>console.error('Profil anniversaire :',e.code||e.message));});
 client.on(Events.InteractionCreate,i=>{require('../utils/birthdayConsent').handle(i).catch(e=>console.error('Préférences anniversaire :',e.code||e.message));});
 async function tick(){if(running||isOff())return;running=true;try{const guild=client.guilds.cache.get(IDENTITY.guildId);if(!guild)return;
  const tasks=[];
  if(Date.now()>=consentNext){consentNext=Date.now()+60000;tasks.push(require('../utils/birthdayConsent').remind(guild).catch(e=>console.error('Rappels préférences anniversaire :',e.code||e.message)));}
  if(Date.now()>=birthdayNext){birthdayNext=Date.now()+300000;tasks.push(require('../utils/familyBirthdays').sync(guild).catch(e=>console.error('Anniversaires :',e.code||e.message)));tasks.push(require('../utils/birthdayAnnouncements').announce(guild).catch(e=>console.error('Annonce anniversaire :',e.code||e.message)));}
  tasks.push(require('../utils/familyMeetings').reminders(guild).catch(e=>console.error('Rappels réunion :',e.code||e.message)));
  tasks.push((async()=>{let s=read('familySchedule');if(!s.nextWeekAt){update('familySchedule',v=>{v.nextWeekAt=sunday();});return;}if(Date.now()<s.nextWeekAt)return;
   const end=sunday(Date.now(),false);await require('../utils/familyWeekly').publish(guild,end,true);update('familySchedule',v=>{v.nextWeekAt=sunday();});
  })().catch(e=>console.error('Bilan hebdomadaire :',e.code||e.message)));
  await Promise.all(tasks);
 }finally{running=false;}}
 const start=()=>{tick().catch(console.error);const t=setInterval(()=>tick().catch(console.error),15000);t.unref();};
 if(client.isReady())start();else client.once(Events.ClientReady,start);
};
