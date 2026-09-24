const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,Events,MessageFlags,AttachmentBuilder}=require('discord.js');
const {read,ensurePanel}=require('./recruitmentData');
const {profiles}=require('./familyBirthdays');
const {members}=require('./familyMembers');
const {birthDate,paris}=require('./familyCalendar');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const CHANNEL='1485319458561069056',KEY='birthday_board';
const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function entries(roster){const prefs=read('birthdayPreferences');return Object.entries(profiles()).filter(([id,p])=>roster.has(id)&&!roster.get(id).user.bot&&birthDate(p.profile.birthDate)&&prefs[id]?.sharePublic===true).map(([id,p])=>({id,name:roster.get(id).displayName||roster.get(id).user.username||id,day:p.profile.birthDate.slice(0,2),month:p.profile.birthDate.slice(3,5)})).sort((a,b)=>Number(a.month)-Number(b.month)||Number(a.day)-Number(b.day)||a.id.localeCompare(b.id));}
function daysUntil(p,now=Date.now()){
 const today=paris(now),year=Number(today.year),base=Date.UTC(year,Number(today.month)-1,Number(today.day));
 for(let y=year;y<=year+4;y++){const stamp=Date.UTC(y,Number(p.month)-1,Number(p.day)),d=new Date(stamp);if(d.getUTCMonth()!==Number(p.month)-1||d.getUTCDate()!==Number(p.day))continue;if(stamp>=base)return Math.round((stamp-base)/86400000);}
 return Infinity;
}
function payload(list,now=Date.now()){
 const upcoming=list.map(p=>({...p,days:daysUntil(p,now)})).filter(p=>p.days<=7).sort((a,b)=>a.days-b.days||a.id.localeCompare(b.id));let overflow=false;
 function limited(lines,budget){const kept=[];let length=0;for(const line of lines){if(length+line.length+1>budget){overflow=true;break;}kept.push(line);length+=line.length+1;}if(kept.length<lines.length)kept.push(`… ${lines.length-kept.length} autre(s) dans la liste complète jointe.`);return kept.join('\n');}
 const soon=limited(upcoming.map(p=>`${p.days===0?'🎉 **Aujourd’hui**':p.days===1?'⏳ Demain':`⏳ Dans ${p.days} jours`} — <@${p.id}> (${p.day}/${p.month})`),900)||'Aucun anniversaire public dans les sept prochains jours.';
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('🎂 Les anniversaires de La Soul Society').setDescription('Un seul calendrier pour toute la famille. Seules les dates autorisées publiquement sont affichées, sans âge ni année de naissance.').addFields({name:'🌸 Anniversaires dans peu de temps — 7 jours maximum',value:soon});let remaining=5200-soon.length;
 for(let month=1;month<=12;month++){const people=list.filter(p=>Number(p.month)===month);if(!people.length)continue;const lines=people.map(p=>`**${p.day}/${p.month}** — <@${p.id}>${daysUntil(p,now)===0?' 🎉':''}`);if(remaining<160){overflow=true;continue;}const value=limited(lines,Math.min(900,remaining-100));remaining-=value.length+MONTHS[month-1].length+20;embed.addFields({name:MONTHS[month-1],value});}
 if(!list.length)embed.addFields({name:'📅 Calendrier',value:'Aucun anniversaire public pour le moment. Utilise « Mes préférences » pour choisir si tu souhaites apparaître.'});
 embed.setFooter({text:`${list.length} anniversaire(s) public(s) • Heure de Paris${overflow?' • Liste complète jointe':''}`});
 const files=overflow?[new AttachmentBuilder(Buffer.from('ANNIVERSAIRES PUBLICS — LA SOUL SOCIETY\n\n'+list.map(p=>`${p.day}/${p.month} — ${String(p.name).replace(/[\r\n]/g,' ')} (${p.id})`).join('\n'),'utf8'),{name:'anniversaires-publics.txt'})]:[];
 return {embeds:[embed],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(KEY).setLabel('Mes préférences').setStyle(ButtonStyle.Primary))],files,attachments:[],allowedMentions:{parse:[]}};
}
function register(client){if(client.birthdayBoard)return;let queue=Promise.resolve();function refresh(){queue=queue.catch(()=>{}).then(async()=>{if(require('./lineState').isOff())return;const g=client.guilds.cache.get(IDENTITY.guildId);if(g)await ensurePanel(client,CHANNEL,KEY,payload(entries(await members(g))));});return queue;}client.birthdayBoard={refresh};
 client.on(Events.InteractionCreate,async i=>{if(!i.isButton()||(i.customId!==KEY&&!i.customId.startsWith('birthdaypage:'))||i.guildId!==IDENTITY.guildId)return;try{if(i.message.flags.has(MessageFlags.Ephemeral))await i.deferUpdate();else await i.deferReply({flags:MessageFlags.Ephemeral});if(i.customId===KEY){const p=profiles()[i.user.id]?.profile;if(!p)return i.editReply('Commence par =bienvenue pour renseigner ta date de naissance.');return i.editReply(require('./birthdayConsent').payload(i.user.id,p.birthDate,read('birthdayPreferences')[i.user.id],true));}return i.editReply(payload(entries(await members(i.guild))));}catch(e){console.error('Calendrier anniversaire :',e.code||e.message);if(i.deferred)await i.editReply({content:'❌ Impossible de charger le calendrier pour le moment.'}).catch(()=>{});}});
 const start=()=>{refresh().catch(e=>console.error('Calendrier anniversaire :',e.code||e.message));const t=setInterval(()=>refresh().catch(e=>console.error('Calendrier anniversaire :',e.code||e.message)),300000);t.unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={register,entries,payload,daysUntil,CHANNEL,KEY};
