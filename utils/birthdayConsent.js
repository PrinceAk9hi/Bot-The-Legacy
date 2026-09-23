const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags}=require('discord.js');
const {createHash}=require('crypto');
const {read,update}=require('./recruitmentData');
const {profiles}=require('./familyBirthdays');
const {birthDate}=require('./familyCalendar');
const {members}=require('./familyMembers');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const SIX_HOURS=6*60*60*1000;let sending=false;
function complete(p){return typeof p?.sharePublic==='boolean'&&typeof p?.enabled==='boolean';}
function payload(id,date,p={},inGuild=false){
 const answer=value=>value===true?'✅ Oui':value===false?'❌ Non':'⏳ Pas encore répondu';
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('🎂 Tes préférences anniversaire • La Soul Society')
 .setDescription(`Tu as renseigné ta date de naissance dans ton profil /bienvenue${birthDate(date)?' : **'+date.slice(0,5)+'**':''}. Merci de choisir séparément :\n\n**1. Partage public** : autorises-tu l’affichage de ton jour et de ton mois de naissance dans le futur classement des anniversaires ? **Ton année de naissance et ton âge ne seront pas publiés.**\n\n**2. Rôle anniversaire** : souhaites-tu recevoir le rôle **Joyeux anniversaire** le jour J ? Il sera retiré le lendemain, heure de Paris.`)
 .addFields({name:'Partage dans le futur classement',value:answer(p.sharePublic)},{name:'Rôle Joyeux anniversaire',value:answer(p.enabled)})
 .setFooter({text:complete(p)?'Tes deux choix sont enregistrés. Tu peux les modifier avec /anniversaire.':'Un rappel sera envoyé toutes les 6 heures tant qu’un des deux choix manque. Oui ou Non : les deux réponses sont acceptées.'});
 const components=[['public','Partage public',p.sharePublic],['role','Rôle anniversaire',p.enabled]].map(([key,label,value])=>new ActionRowBuilder().addComponents([true,false].map(yes=>new ButtonBuilder().setCustomId(`birthdayconsent:${id}:${key}:${yes?'yes':'no'}`).setLabel(`${label} : ${yes?'oui':'non'}${value===yes?' ✓':''}`).setStyle(value===yes?ButtonStyle.Primary:ButtonStyle.Secondary))));
 if(inGuild)components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('birthday:'+id).setLabel('Modifier ma date').setStyle(ButtonStyle.Secondary)));
 return {content:null,embeds:[embed],components,allowedMentions:{parse:[]}};
}
async function handle(i){if(!i.isButton()||!i.customId.startsWith('birthdayconsent:'))return;
 const [,id,key,value]=i.customId.split(':');
 if(id!==i.user.id||!['public','role'].includes(key)||!['yes','no'].includes(value)||(i.guildId&&i.guildId!==IDENTITY.guildId))return i.reply({content:'❌ Ces choix ne concernent que ton propre profil.',flags:MessageFlags.Ephemeral});
 const profile=profiles()[id]?.profile;if(!profile)return i.reply({content:'Profil introuvable. Utilise /bienvenue sur le serveur.',flags:MessageFlags.Ephemeral});
 await i.deferUpdate();
 update('birthdayPreferences',all=>{all[id]={...all[id],[key==='public'?'sharePublic':'enabled']:value==='yes',updatedAt:Date.now()};});
 return i.editReply(payload(id,profile.birthDate,read('birthdayPreferences')[id],Boolean(i.guildId)));
}
async function remind(guild){if(sending)return;sending=true;try{
 const p=profiles(),roster=await members(guild);
 for(const member of roster.values()){
  if(require('./lineState').isOff())break;
  if(member.user.bot||!birthDate(p[member.id]?.profile.birthDate))continue;
  const pref=read('birthdayPreferences')[member.id]||{};
  if(complete(pref)||Date.now()-(pref.lastReminderAttemptAt||0)<SIX_HOURS)continue;
  const now=Date.now();update('birthdayPreferences',all=>{all[member.id]={...all[member.id],lastReminderAttemptAt:now};});
  try{
   const nonce=createHash('sha256').update(member.id+':'+Math.floor(now/SIX_HOURS)).digest('hex').slice(0,24);
   const m=await member.send({...payload(member.id,p[member.id].profile.birthDate,read('birthdayPreferences')[member.id]),nonce,enforceNonce:true});
   update('birthdayPreferences',all=>{all[member.id]={...all[member.id],lastReminderMessageId:m.id,lastReminderSentAt:now,reminderError:null};});
  }catch(e){update('birthdayPreferences',all=>{all[member.id]={...all[member.id],reminderError:String(e.code||e.name),lastReminderFailedAt:now};});}
 }
 }finally{sending=false;}}
module.exports={payload,handle,remind,complete,SIX_HOURS};
