const {read,update}=require('./recruitmentData');
const {IDENTITY}=require('../config/soulSociety');
const {members}=require('./familyMembers');
const {isBirthday,dayKey,birthDate}=require('./familyCalendar');
const {MessageFlags,ModalBuilder,ActionRowBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
const ROLE='1485316011132588232';
function profiles(){const chosen={};for(const [key,p]of Object.entries(read('welcomeProfiles'))){const id=p.discordId||key;if(!chosen[id]||key===id||(chosen[id].key!==id&&(p.updatedAt||0)>(chosen[id].profile.updatedAt||0)))chosen[id]={key,profile:p};}return chosen;}
async function handle(i){if(!(i.isButton()||i.isModalSubmit())||!i.customId.startsWith('birthday:'))return;
 if(i.customId.split(':')[1]!==i.user.id||i.guildId!==IDENTITY.guildId||!require('./memberCare').allowed(i))return i.reply({content:'❌ Accès refusé.',flags:MessageFlags.Ephemeral});
 const found=profiles()[i.user.id];if(!found)return i.reply({content:'Crée ton profil avec =bienvenue.',flags:MessageFlags.Ephemeral});
 if(i.isButton()){const input=new TextInputBuilder().setCustomId('birth').setLabel('Date de naissance — JJ/MM/AAAA').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10);if(found.profile.birthDate)input.setValue(found.profile.birthDate);return i.showModal(new ModalBuilder().setCustomId(i.customId).setTitle('Mon anniversaire').addComponents(new ActionRowBuilder().addComponents(input)));}
 const value=i.fields.getTextInputValue('birth').trim();if(!birthDate(value))return i.reply({content:'❌ Date invalide : utilise JJ/MM/AAAA.',flags:MessageFlags.Ephemeral});
 update('welcomeProfiles',all=>{all[found.key].birthDate=value;all[found.key].updatedAt=Date.now();});
 return i.reply({content:'✅ Date mise à jour dans ton profil. Le rôle sera vérifié sous cinq minutes.',flags:MessageFlags.Ephemeral});
}
async function sync(guild){
 const role=await guild.roles.fetch(ROLE);if(!role?.editable)throw Error('Rôle anniversaire absent ou placé au-dessus du bot');
 const roster=await members(guild),p=profiles(),prefs=read('birthdayPreferences');
 for(const m of roster.values()){if(m.user.bot)continue;
  const expected=prefs[m.id]?.enabled===true&&isBirthday(p[m.id]?.profile.birthDate);
  const current=m.roles.cache.has(ROLE);if(expected===current)continue;
  if(expected)await m.roles.add(ROLE,'Anniversaire — '+dayKey());else await m.roles.remove(ROLE,'Fin du jour anniversaire ou préférence désactivée');
 }
 update('familySchedule',s=>{s.birthdayCheckedAt=Date.now();});
}
module.exports={ROLE,profiles,sync,handle};
