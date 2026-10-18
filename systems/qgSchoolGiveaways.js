const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const timers = new Map();
const save = fn => update('qgServer', fn);
const state = () => read('qgServer');
const staffKeys = ['creator','globalManager','administrator','animationLead','animationManagement'];
const eligible = member => { const r=state().schoolRoles||{}, old=state().roles||{}; return [...['verified','community','creator','globalManager','administrator','senior','prestigious','expert','confirmed','test'].map(k=>r[k]),old.member].filter(Boolean).some(id=>member.roles.cache.has(id)); };
const canManage = member => { const r=state().schoolRoles||{}; return member.id===config.ownerId||member.id===member.guild.ownerId||staffKeys.some(k=>r[k]&&member.roles.cache.has(r[k])); };
const embed = (title,description) => new EmbedBuilder().setFooter({text:'Fondateur - QG'}).setColor(0xffffff).setTitle(title).setDescription(description);
function duration(text){const m=/^(\d+)(s|m|h|d)$/i.exec(text);if(!m)return 0;const factor={s:1000,m:60000,h:3600000,d:86400000}[m[2].toLowerCase()];return Number(m[1])*factor;}
function payload(giveaway){return {embeds:[embed('🎁 Giveaway',`**Récompense :** ${giveaway.prize}\n**Organisé par :** ${giveaway.creatorId}\n**Gagnants :** ${giveaway.winnerCount}\n**Fin :** <t:${Math.floor(giveaway.endsAt/1000)}:R>\n**Participants :** ${giveaway.participants.length}\n\nClique sur le bouton pour participer. Participation réservée aux membres vérifiés.`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`qgs:giveaway:${giveaway.id}`).setLabel('Participer').setEmoji('🎉').setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
async function create(message,parts){
 const member=message.member;if(!canManage(member))return message.reply('La création de giveaways est réservée à la Gestion Animation et à la direction.');
 const s=state(),allowed=[s.schoolChannels?.giveawaysInfo,s.schoolChannels?.communityGiveaways,s.schoolChannels?.familyGiveaways].filter(Boolean);if(!allowed.includes(message.channelId))return message.reply('Utilise un des salons Giveaway configurés pour publier.');
 if(['creer','create'].includes((parts[0]||'').toLowerCase()))parts=parts.slice(1);
 const span=duration(parts[0]||''),count=Number(parts[1]),prize=parts.slice(2).join(' ').trim();
 if(!span||span<60000||span>30*86400000||!Number.isInteger(count)||count<1||count>20||!prize||prize.length>200)return message.reply('Utilisation : `=giveaway <durée: 1h> <gagnants: 1> <récompense>`. Durée : 1 minute à 30 jours, 1 à 20 gagnants.');
 const channel=message.channel;if(!channel?.isTextBased())return message.reply('Place-toi dans un salon de giveaways configuré.');
 const record={id:crypto.randomBytes(5).toString('hex'),guildId:message.guildId,channelId:channel.id,creatorId:message.author.id,prize,endsAt:Date.now()+span,winnerCount:count,participants:[],status:'active',createdAt:Date.now()};
 const sent=await channel.send(payload(record));record.messageId=sent.id;save(x=>{x.schoolGiveaways||={};x.schoolGiveaways[record.id]=record;const ended=Object.entries(x.schoolGiveaways).filter(([,g])=>g.status!=='active').sort((a,b)=>b[1].endedAt-a[1].endedAt);for(const [oldId] of ended.slice(100))delete x.schoolGiveaways[oldId];});schedule(message.client,record);
 return message.reply(`✅ Giveaway publié : ${sent.url}`);
}
function schedule(client,record){if(timers.has(record.id))clearTimeout(timers.get(record.id));const wait=Math.max(0,Math.min(2147480000,record.endsAt-Date.now()));timers.set(record.id,setTimeout(()=>{if(Date.now()<record.endsAt)schedule(client,record);else finish(client,record.id).catch(e=>console.error('Giveaway QG :',e.code||e.message));},wait).unref());}
async function finish(client,id){const record=state().schoolGiveaways?.[id];if(!record||record.status!=='active')return;const guild=await client.guilds.fetch(record.guildId),channel=await guild.channels.fetch(record.channelId).catch(()=>null);if(!channel?.isTextBased())return;
 const pool=[...new Set(record.participants)];const winners=[];while(pool.length&&winners.length<record.winnerCount){const index=crypto.randomInt(pool.length);winners.push(pool.splice(index,1)[0]);}
 record.status='ended';record.endedAt=Date.now();record.winners=winners;save(s=>{s.schoolGiveaways[id]=record;});timers.delete(id);
 const msg=await channel.messages.fetch(record.messageId).catch(()=>null);if(msg)await msg.edit({embeds:[embed('🎁 Giveaway terminé',`**Récompense :** ${record.prize}\n**Gagnant(s) :** ${winners.length?winners.map(u=>`<@${u}>`).join(', '):'aucun participant éligible'}\n**Participants :** ${record.participants.length}`)],components:[],allowedMentions:{parse:[],users:winners}});
 if(winners.length)await channel.send({content:`🎉 Félicitations ${winners.map(u=>`<@${u}>`).join(', ')} ! Vous remportez **${record.prize}**.`,allowedMentions:{parse:[],users:winners}});
}
async function message(m){if(m.author.bot||m.guildId!==config.guildId||!m.content.startsWith('=giveaway'))return false;const parts=m.content.trim().split(/\s+/).slice(1);if(parts[0]==='relancer'){if(!canManage(m.member))return m.reply('Action réservée à la Gestion Animation.');const id=parts[1],record=state().schoolGiveaways?.[id];if(!record||record.status!=='ended')return m.reply('Giveaway terminé introuvable.');record.status='active';record.endsAt=Date.now();record.participants=record.participants.filter(x=>!(record.winners||[]).includes(x));save(s=>{s.schoolGiveaways[id]=record;});await finish(m.client,id);return true;}await create(m,parts);return true;}
async function handle(i){if(!i.customId?.startsWith('qgs:giveaway:'))return false;await i.deferReply({flags:MessageFlags.Ephemeral});const id=i.customId.split(':')[2],record=state().schoolGiveaways?.[id];if(!record||record.status!=='active')return i.editReply('Ce giveaway est terminé ou indisponible.');if(Date.now()>=record.endsAt){await finish(i.client,id);return i.editReply('Le giveaway vient de se terminer.');}const member=await i.guild.members.fetch(i.user.id);if(!eligible(member))return i.editReply('Accepte d’abord le règlement pour participer.');const joined=record.participants.includes(i.user.id);record.participants=joined?record.participants.filter(x=>x!==i.user.id):[...record.participants,i.user.id];save(s=>{s.schoolGiveaways[id]=record;});const original=await i.channel.messages.fetch(record.messageId).catch(()=>null);if(original)await original.edit(payload(record));return i.editReply(joined?'Ta participation a été retirée.':'✅ Ta participation est enregistrée.');}
async function resume(client,guild){for(const record of Object.values(state().schoolGiveaways||{}))if(record.guildId===guild.id&&record.status==='active')schedule(client,record);}
module.exports={message,handle,resume,duration,_test:{eligible,canManage,payload}};
