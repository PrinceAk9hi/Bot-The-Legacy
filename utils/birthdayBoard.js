const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,Events,MessageFlags}=require('discord.js');
const {read,ensurePanel}=require('./recruitmentData');
const {profiles}=require('./familyBirthdays');
const {members}=require('./familyMembers');
const {birthDate,paris}=require('./familyCalendar');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const CHANNEL='1485319458561069056',KEY='birthday_board',SIZE=15;
function entries(roster){const preferences=read('birthdayPreferences');return Object.entries(profiles()).filter(([id,p])=>roster.has(id)&&!roster.get(id).user.bot&&birthDate(p.profile.birthDate)&&preferences[id]?.sharePublic===true).map(([id,p])=>({id,day:p.profile.birthDate.slice(0,2),month:p.profile.birthDate.slice(3,5)})).sort((a,b)=>Number(a.month)-Number(b.month)||Number(a.day)-Number(b.day)||a.id.localeCompare(b.id));}
function payload(list,page=0){const pages=Math.max(1,Math.ceil(list.length/SIZE));page=Math.max(0,Math.min(Number.isFinite(page)?Math.floor(page):0,pages-1));const today=paris();
 const lines=list.slice(page*SIZE,page*SIZE+SIZE).map((p,n)=>`${p.day===today.day&&p.month===today.month?'🎉':'🎂'} **${p.day}/${p.month}** — <@${p.id}>${p.day===today.day&&p.month===today.month?' **C’est aujourd’hui !**':''}`);
 const e=new EmbedBuilder().setColor(COLORS.primary).setTitle('🎂 Le calendrier des anniversaires • La Soul Society')
 .setDescription('Les anniversaires de la famille, classés de janvier à décembre.\n**Seuls les membres ayant accepté le partage public apparaissent.** Les dates privées et les réponses en attente restent masquées ; l’année et l’âge ne sont jamais affichés.\n\n'+(lines.join('\n')||'🌸 Aucun anniversaire public pour le moment. Utilise **Mes préférences** pour choisir si tu souhaites apparaître.'))
 .setFooter({text:`Page ${page+1}/${pages} • ${list.length} anniversaire(s) public(s) • Heure de Paris`});
 const controls=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('birthdaypage:'+(page-1)).setLabel('◀ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page===0),new ButtonBuilder().setCustomId('birthdaypage:'+(page+1)).setLabel('Suivant ▶').setStyle(ButtonStyle.Secondary).setDisabled(page>=pages-1),new ButtonBuilder().setCustomId(KEY).setLabel('Mes préférences').setStyle(ButtonStyle.Primary));
 return {embeds:[e],components:[controls],allowedMentions:{parse:[]}};
}
function register(client){if(client.birthdayBoard)return;let queue=Promise.resolve();
 function refresh(){queue=queue.catch(()=>{}).then(async()=>{if(require('./lineState').isOff())return;const g=client.guilds.cache.get(IDENTITY.guildId);if(!g)return;await ensurePanel(client,CHANNEL,KEY,payload(entries(await members(g))));});return queue;}
 client.birthdayBoard={refresh};
 client.on(Events.InteractionCreate,async i=>{
  if(!i.isButton()||(i.customId!==KEY&&!i.customId.startsWith('birthdaypage:')))return;
  if(i.guildId!==IDENTITY.guildId)return;
  try{if(i.message.flags.has(MessageFlags.Ephemeral))await i.deferUpdate();else await i.deferReply({flags:MessageFlags.Ephemeral});
   if(i.customId===KEY){const p=profiles()[i.user.id]?.profile;if(!p)return i.editReply('Commence par /bienvenue pour renseigner ta date de naissance.');return i.editReply(require('./birthdayConsent').payload(i.user.id,p.birthDate,read('birthdayPreferences')[i.user.id],true));}
   const page=Number(i.customId.split(':')[1]);return i.editReply(payload(entries(await members(i.guild)),page));
  }catch(e){console.error('Classement anniversaire :',e.code||e.message);if(i.deferred)await i.editReply({content:'❌ Impossible de charger le calendrier pour le moment.'}).catch(()=>{});}
 });
 const start=()=>{refresh().catch(e=>console.error('Calendrier anniversaire :',e.code||e.message));const t=setInterval(()=>refresh().catch(e=>console.error('Calendrier anniversaire :',e.code||e.message)),300000);t.unref();};
 if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={register,entries,payload,CHANNEL,KEY};
