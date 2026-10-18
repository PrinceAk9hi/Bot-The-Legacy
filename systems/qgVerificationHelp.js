const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const {embed}=require('./qgPanels');
const routing=require('./qgTicketRouting');
const busy=new Set();
async function abuse(member,reason){
 if(require('./qgCommunityPolicy').exempt(member))return 'La Direction et la Fondation sont exemptées.';
 const rec=read('qgServer').verificationHelp?.[member.id]||{};
 if(!rec.warnedAt){
  try{await member.send({embeds:[embed('Avertissement — assistance vérification',`${reason}\n\nLe bouton d’aide est réservé aux difficultés réelles de vérification. Un nouvel abus pourra entraîner ton exclusion du QG.`)],allowedMentions:{parse:[]}});}catch{return 'MP fermés : avertissement non remis. Aucune exclusion automatique ; le staff doit intervenir.';}
  update('qgServer',s=>{s.verificationHelp||={};s.verificationHelp[member.id]={...rec,warnedAt:Date.now()};});return 'Un avertissement privé a été envoyé.';
 }
 if(!member.kickable)return 'Le bot ne peut pas exclure ce membre : intervention de la Direction nécessaire.';
 await member.kick(`Abus assistance vérification après avertissement : ${reason}`);
 update('qgServer',s=>{s.verificationHelp[member.id].kickedAt=Date.now();});return 'Le membre a été exclu après avertissement.';
}
async function handle(i){
 if(!i.customId?.startsWith('qgs:help-'))return false;
 if(i.guildId!==config.guildId)return false;
 const reviewer=i.customId.startsWith('qgs:help-abuse:');
 const id=reviewer?i.customId.split(':')[2]:i.user.id;
 if(busy.has(id)){await i.reply({content:'Une demande est déjà en cours.',flags:MessageFlags.Ephemeral});return true;}busy.add(id);
 try{
  const rec=read('qgServer').verificationHelp?.[id]||{};
  if(reviewer){
   await i.deferReply({flags:MessageFlags.Ephemeral});const staff=await i.guild.members.fetch(i.user.id),r=read('qgServer').schoolRoles||{};
   if(!require('./qgCommunityPolicy').exempt(staff)&&!['ticketsLead','ticketsManagement'].some(k=>r[k]&&staff.roles.cache.has(r[k])))return await i.editReply('Action réservée à Gestion Support.'),true;
   if(rec.channelId!==i.channelId||rec.reviewed)return await i.editReply('Dossier introuvable ou déjà examiné.'),true;
   const member=await i.guild.members.fetch(id);const result=await abuse(member,'Demande abusive confirmée par Gestion Support.');
   update('qgServer',s=>{s.verificationHelp[id].reviewed=true;s.verificationHelp[id].reviewerId=i.user.id;});await i.editReply(result);return true;
  }
  if(i.customId==='qgs:help-open'){
   const now=Date.now(),clicks=(rec.clicks||[]).filter(at=>now-at<30000);clicks.push(now);
   update('qgServer',s=>{s.verificationHelp||={};s.verificationHelp[id]={...rec,clicks};});
   if(clicks.length>=4){await i.deferReply({flags:MessageFlags.Ephemeral});update('qgServer',s=>{s.verificationHelp[id].clicks=[];});await i.editReply(await abuse(await i.guild.members.fetch(id),'Clics répétés sur le bouton d’aide.'));return true;}
   if(rec.channelId){const ch=await i.guild.channels.fetch(rec.channelId).catch(e=>{if(e.code===10003)return null;throw e;});if(ch){await i.reply({content:`Ta demande est déjà ouverte : <#${ch.id}>.`,flags:MessageFlags.Ephemeral});return true;}}
   await i.showModal(new ModalBuilder().setCustomId('qgs:help-submit').setTitle('Aide à la vérification').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('problem').setLabel('À quelle étape es-tu bloqué ?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))));return true;
  }
  if(i.customId==='qgs:help-submit'){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   if(rec.channelId&&await i.guild.channels.fetch(rec.channelId).catch(e=>{if(e.code===10003)return null;throw e;})){await i.editReply(`Ta demande existe déjà : <#${rec.channelId}>.`);return true;}
   const parent=read('qgServer').schoolCategories?.ticketInbox;if(!parent)throw Error('Le staff doit actualiser le panneau QG.');
   const ch=await i.guild.channels.create({name:`aide-verification-${id}`,type:0,parent,topic:`qg-ticket:${id}:questions`,permissionOverwrites:routing.overwrites(i.guild,id,'questions')});
   update('qgServer',s=>{s.verificationHelp||={};s.verificationHelp[id]={...rec,channelId:ch.id,reviewed:false};s.tickets||={};s.tickets[ch.id]={ownerId:id,type:'questions',createdAt:Date.now(),verificationHelp:true};});
   await ch.send({embeds:[embed('Aide à la vérification',i.fields.getTextInputValue('problem'))],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`qgs:help-abuse:${id}`).setLabel('Staff : confirmer un abus').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('qg:close').setLabel('Fermer le ticket').setStyle(ButtonStyle.Secondary))],allowedMentions:{parse:[]}});
   await routing.escalate(ch,'Une personne a besoin d’aide pour sa vérification.');await i.editReply(`Gestion Support a été prévenue : <#${ch.id}>.`);return true;
  }return false;
 }finally{busy.delete(id);}
}
module.exports={handle,abuse};
