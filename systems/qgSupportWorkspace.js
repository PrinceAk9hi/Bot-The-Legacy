const {SlashCommandBuilder,MessageFlags,ChannelType:T,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),panels=require('./qgPanels');
const categoryId='1561446326120615966',boostChannelId='1561834231473246381';
const data=new SlashCommandBuilder().setName('support').setDescription('Outils de la Gestion Support QG').setDMPermission(false);
for(const [name,description]of [['suivi','Lister les tickets auxquels tu as accès'],['prendre','Prendre en charge le ticket actuel'],['renommer','Renommer le ticket actuel'],['fermer','Archiver et fermer le ticket actuel'],['installer','Compléter les salons privés de la Gestion Support']])data.addSubcommand(s=>s.setName(name).setDescription(description));
function allowed(member){return a.isDirection(member)||a.has(member,['ticketsLead','ticketsManagement']);}
async function authorize(i){if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');const member=await i.guild.members.fetch({user:i.user.id,force:true});if(!allowed(member))throw Error('Commande réservée à la Gestion Support.');return member;}
async function install(guild){return a.serial('support-install',async()=>{
 if(guild.id!==config.guildId)throw Error('Serveur incorrect.');
 const parent=await guild.channels.fetch(categoryId);if(parent?.type!==T.GuildCategory)throw Error('Catégorie Support introuvable.');
 await guild.roles.fetch();await guild.channels.fetch();await guild.emojis.fetch();
 const r=a.state().schoolRoles||{},keys=['creator','globalManager','administrator','ticketsLead','ticketsManagement'];
 if(!r.ticketsManagement||!guild.roles.cache.has(r.ticketsManagement))throw Error('Rôle Gestion Support non configuré.');
 const grants=keys.map(k=>r[k]).filter(id=>id&&guild.roles.cache.has(id));
 const overwrites=[{id:guild.id,deny:[P.ViewChannel]},...grants.map(id=>({id,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages]})),{id:guild.client.user.id,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.EmbedLinks,P.ManageChannels]}];
 const definitions=[['supportTeamAnnouncements','📢・annonces-support'],['supportTeamChat','💬・discussion-support'],['supportTeamFollowup','📋・suivi-tickets'],['supportTeamGuide','📚・guide-support']];
 for(const [key,name]of definitions){
  const stored=a.state().schoolChannels?.[key];let channel=stored?guild.channels.cache.get(stored):null;
  channel ||= guild.channels.cache.find(ch=>ch.parentId===categoryId&&ch.name===name&&ch.type===T.GuildText);
  if(channel&&channel.type!==T.GuildText)throw Error('Le salon '+name+' doit être un salon textuel.');
  if(channel&&channel.parentId!==categoryId)await channel.edit({parent:categoryId,permissionOverwrites:overwrites,reason:'Rétablissement de l’espace privé Support QG'});
  if(!channel)channel=await guild.channels.create({name,type:T.GuildText,parent:categoryId,permissionOverwrites:overwrites,reason:'Espace Gestion Support QG'});
  a.save(s=>{s.schoolChannels||={};s.schoolChannels[key]=channel.id;s.schoolCategories||={};s.schoolCategories.supportManagement=categoryId;});
 }
 const guide=await guild.channels.fetch(a.state().schoolChannels.supportTeamGuide);
 const payload={embeds:[panels.embed('Gestion Support • Nos outils','**Accompagner avec clarté et respect**\nLis le contexte avant de répondre. Ne demande jamais de mot de passe ou de token. Les décisions sensibles restent réservées aux personnes habilitées.\n\n**Commandes**\n`/support suivi` : consulter les tickets accessibles.\n`/support prendre` : prendre en charge le ticket actuel.\n`/support renommer` : modifier son nom.\n`/support fermer` : archiver puis fermer le ticket, après confirmation.\n\n**Organisation**\nAnnonces : consignes de l’équipe.\nDiscussion : coordination interne.\nSuivi : utilise `/support suivi` pour afficher les dossiers à jour.\n\nLes signalements et dossiers Fondation restent confidentiels.')],allowedMentions:{parse:[]}};
 const prior=a.state().schoolSupportGuide;let msg=prior?await guide.messages.fetch(prior).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!msg){const recent=await guide.messages.fetch({limit:50});msg=recent.find(m=>m.author.id===guild.client.user.id&&m.embeds.some(e=>e.title==='Gestion Support • Nos outils'));}
 if(msg)await msg.edit(payload);else msg=await guide.send(payload);a.save(s=>{s.schoolSupportGuide=msg.id;});
 const ticketPanel=a.state().schoolPanels?.tickets;
 if(ticketPanel){const ch=await guild.channels.fetch(ticketPanel.channelId);const message=await ch.messages.fetch(ticketPanel.messageId);if(message.author.id===guild.client.user.id)await message.edit({...panels.tickets(guild),attachments:[]});}
 });}
async function execute(i){await i.deferReply({flags:MessageFlags.Ephemeral});try{
 const member=await authorize(i),action=i.options.getSubcommand();
 if(action==='installer'){if(!a.isDirection(member)&&!a.has(member,['ticketsLead']))throw Error('Installation réservée à la direction ou au responsable Support.');await install(i.guild);return i.editReply('Salons Support complétés et panel de tickets actualisé.');}
 const lines=[];for(const [id,ticket]of Object.entries(a.state().tickets||{})){
  const ch=await i.guild.channels.fetch(id).catch(()=>null);if(!ch||!ch.permissionsFor(member)?.has([P.ViewChannel,P.ReadMessageHistory]))continue;
  lines.push(`<#${id}> • ${ticket.claimedBy?`pris par <@${ticket.claimedBy}>`:'à prendre'}${ticket.escalatedAt?' • transmis à l’équipe':''}`);
 }
 return i.editReply({embeds:[panels.embed('Suivi du support',`${lines.length} ticket(s) accessible(s).\n\n${lines.slice(0,35).join('\n')||'Aucun dossier accessible.'}${lines.length>35?'\nSeuls les 35 premiers sont affichés.':''}`)],allowedMentions:{parse:[]}});
 }catch(e){return i.editReply(e.code?'Action impossible : vérifie les accès du bot.':e.message);}}
async function boost(oldMember,member){
 if(member.guild.id!==config.guildId||oldMember.partial||oldMember.premiumSinceTimestamp||!member.premiumSinceTimestamp)return;
 return a.serial('boost:'+member.id,async()=>{
  const key=String(member.premiumSinceTimestamp);if(a.state().schoolBoostThanks?.[member.id]===key)return;
  const channel=await member.guild.channels.fetch(boostChannelId);if(!channel?.isTextBased()||channel.guildId!==config.guildId)throw Error('Salon boosts indisponible.');
  const emoji=member.guild.emojis.cache.find(e=>e.name==='QG'&&e.available!==false);
  const brand=emoji?`<${emoji.animated?'a':''}:${emoji.name}:${emoji.id}>`:'🤍';
  await channel.send({embeds:[panels.embed('Un nouveau soutien pour le QG',`${brand} **Merci ${member.displayName.replace(/[@*_`~]/g,'')} !**\n\nTon boost contribue à faire grandir notre espace et à améliorer l’expérience de toute la communauté. Merci pour ta confiance et ton soutien.\n\n**Nos soutiens**\n${member.guild.premiumSubscriptionCount??'Non disponible'} boost(s) • Niveau ${member.guild.premiumTier??'non disponible'}\n\nUne famille, une communauté, un QG.`).setThumbnail(member.user.displayAvatarURL({size:256})).setTimestamp()],allowedMentions:{parse:[]}});
  a.save(s=>{s.schoolBoostThanks||={};s.schoolBoostThanks[member.id]=key;});
 });
}
module.exports={data,execute,install,authorize,boost};
