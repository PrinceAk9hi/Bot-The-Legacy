const {createHash}=require('node:crypto');
const {EmbedBuilder}=require('discord.js');
const {read,update}=require('./recruitmentData');
const {members}=require('./familyMembers');
const {profiles}=require('./familyBirthdays');
const {isBirthday,dayKey}=require('./familyCalendar');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const CHANNEL='1471562633802023115';let running=false;
async function announce(guild,now=Date.now()){
 if(running||guild.id!==IDENTITY.guildId||require('./lineState').isOff())return;running=true;
 try{
  const roster=await members(guild),people=profiles(),prefs=read('birthdayPreferences'),state=read('birthdayAnnouncements'),day=dayKey(now),year=day.slice(0,4);
  const ids=[...roster.values()].filter(m=>!m.user.bot&&prefs[m.id]?.sharePublic===true&&isBirthday(people[m.id]?.profile.birthDate,now)).map(m=>m.id).filter(id=>{const s=state[`${year}:${id}`];return !s||(s.status==='failed'&&now>=s.retryAt);}).sort();if(!ids.length)return;
  const channel=await guild.channels.fetch(CHANNEL);if(!channel?.isTextBased()||channel.guildId!==guild.id)throw Error('Salon anniversaire invalide');
  for(let n=0;n<ids.length;n+=50){if(require('./lineState').isOff())break;const currentPrefs=read('birthdayPreferences'),currentProfiles=profiles();const group=ids.slice(n,n+50).filter(id=>currentPrefs[id]?.sharePublic===true&&isBirthday(currentProfiles[id]?.profile.birthDate,now));if(!group.length)continue;
   const nonce=createHash('sha256').update(day+':'+group.join(',')).digest('hex').slice(0,24);
   update('birthdayAnnouncements',s=>{for(const id of group)s[`${year}:${id}`]={status:'pending',day,attemptedAt:now,nonce};});
   try{const message=await channel.send({content:group.map(id=>`<@${id}>`).join(' '),embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('🎉 Joyeux anniversaire ! 🌸').setDescription('Aujourd’hui, La Soul Society fête votre anniversaire ! 🎂\n\nToute la famille vous souhaite une belle journée, pleine de bons moments. Merci de faire partie de l’aventure ! 🏯🌸')],allowedMentions:{parse:[],users:group},nonce,enforceNonce:true});update('birthdayAnnouncements',s=>{for(const id of group)s[`${year}:${id}`]={...s[`${year}:${id}`],status:'sent',messageId:message.id,sentAt:now};});}
   catch(error){const definite=Number(error.status)>=400&&Number(error.status)<500;update('birthdayAnnouncements',s=>{for(const id of group)s[`${year}:${id}`]={...s[`${year}:${id}`],status:definite?'failed':'uncertain',retryAt:now+1800000,error:String(error.code||error.name)};});throw error;}
  }
 }finally{running=false;}
}
module.exports={announce,CHANNEL};
