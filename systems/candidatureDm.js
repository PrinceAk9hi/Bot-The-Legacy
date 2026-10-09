const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,ChannelType,PermissionFlagsBits:P,MessageFlags}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {read,update}=require('../utils/recruitmentData');
const {isOff}=require('../utils/lineState');
const locks=new Set();
const row=(id,label,style=ButtonStyle.Primary)=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style));
function payload(d,questions){
 const n=Object.keys(d.answers).length,done=n===questions.length;
 return {embeds:[new EmbedBuilder().setColor(0xffffff).setTitle(done?'Candidature prête à envoyer':`Candidature • Question ${n+1}/${questions.length}`)
 .setDescription(done?'Tes réponses sont enregistrées. Clique sur **Envoyer ma candidature** pour les transmettre aux recruteurs.':`${questions[n].texte}\n\nClique sur **Répondre** pour saisir ta réponse. Ta progression est sauvegardée : tu peux reprendre depuis le bouton du salon des candidatures.`)
 .setFooter({text:'La Soul Society • Questionnaire privé'})],components:[row(`canddm:${done?'submit':'answer'}:${d.id}:${n}`,done?'Envoyer ma candidature':'Répondre'),row(`canddm:cancel:${d.id}:${n}`,'Annuler',ButtonStyle.Secondary)],allowedMentions:{parse:[]}};
}
module.exports=function create(api){
 const {QUESTIONS,CONFIG,recruteurAutorise,createFormEmbed,createReviewButtons,updateReviewMessage,embedAccepte,embedRefuse}=api;
 async function start(i){
  if(i.guildId!==IDENTITY.guildId)throw Error('Utilise le panel du serveur de la Soul Society.');
  if(!require('../utils/candidaturePanel').areCandidaturesOpen())throw Error('Les candidatures sont actuellement fermées.');
  const current=read('candidatures')[i.user.id];
  if(current&&['pending','accepted'].includes(current.decision))throw Error('Une candidature est déjà en cours ou acceptée. Contacte un recruteur.');
  let d=read('candidatureDmDrafts')[i.user.id];
  if(!d||d.status==='cancelled'||d.status==='sent')d={id:i.id,userId:i.user.id,guildId:i.guildId,answers:{},durations:{},startedAt:Date.now(),questionAt:Date.now(),status:'draft'};
  if(d.status==='sending')throw Error('Envoi déjà engagé : demande à un recruteur de vérifier sa réception avant de recommencer.');
  // Validate DM access before saving a new draft. No channel is created on the server.
  const dm=await i.user.createDM();
  const message=d.messageId?await dm.messages.fetch(d.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
  const sent=message?await message.edit(payload(d,QUESTIONS)):await dm.send(payload(d,QUESTIONS));
  d.channelId=dm.id;d.messageId=sent.id;update('candidatureDmDrafts',all=>{all[i.user.id]=d;});
  return i.editReply('📩 Les questions t’attendent dans mes messages privés. Aucun ticket n’a été ouvert.');
 }
 async function submit(i,d){
  const guild=i.client.guilds.cache.get(d.guildId);if(!guild)throw Error('Serveur introuvable.');
  const member=await guild.members.fetch(d.userId);
  const channel=await guild.channels.fetch(CONFIG.salonFormulaires);
  if(!channel?.isTextBased())throw Error('Salon de réception indisponible. Tes réponses sont conservées.');
  const existing=read('candidatures')[d.userId];
  if(existing&&['pending','accepted'].includes(existing.decision))throw Error('Une candidature est déjà en cours.');
  const totalDuration=Date.now()-d.startedAt;
  // Persist before sending: an interrupted/ambiguous send is never repeated automatically.
  update('candidatureDmDrafts',all=>{all[d.userId].status='sending';});
  let sent;try { sent=await channel.send({content:`<@&${CONFIG.gestionRecrutement}>\n<@${d.userId}> a terminé sa candidature en MP.`,
   embeds:[createFormEmbed(member,d.answers,d.durations,totalDuration)],
   files:[{attachment:Buffer.from(QUESTIONS.map(q=>q.texte+'\n'+d.answers[q.key]).join('\n\n'),'utf8'),name:'candidature-complete.txt'}],
   components:[createReviewButtons(d.userId,'dm')],allowedMentions:{roles:[CONFIG.gestionRecrutement],users:[]}}); } catch(error) {
   if(error.status>=400&&error.status<500&&error.status!==429)update("candidatureDmDrafts",all=>{all[d.userId].status="draft";});
   throw Error("Impossible de confirmer l’envoi. Tes réponses sont conservées. Contacte un recruteur avant de réessayer.");
  }
  update('candidatures',all=>{all[d.userId]={userId:d.userId,guildId:d.guildId,applicationId:d.id,source:'dm',ticketId:null,date:Date.now(),formVersion:3,answers:d.answers,durations:d.durations,totalDuration,ddsStatus:'none',ddsResult:null,decision:'pending',reviewChannelId:channel.id,reviewMessageId:sent.id};});
  update('candidatureDmDrafts',all=>{all[d.userId].status='sent';});
  await i.editReply({embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('✅ Candidature envoyée').setDescription('L’équipe de recrutement va examiner tes réponses. Tu seras prévenu en MP de sa décision. Un recruteur pourra ouvrir un ticket privé avec toi s’il a des questions.')],components:[]});
 }
 async function ticket(i){
  if(i.guildId!==IDENTITY.guildId)throw Error('Serveur incorrect.');
  const recruiter=await i.guild.members.fetch(i.user.id);
  if(!recruteurAutorise(recruiter))throw Error('Action réservée aux recruteurs.');
  const id=i.customId.split(':')[1],a=read('candidatures')[id];
  if(!a||a.reviewMessageId!==i.message.id||a.reviewChannelId!==i.channelId)throw Error('Cette candidature n’est plus la candidature actuelle.');
  await i.guild.members.fetch(id);
  const channels=await i.guild.channels.fetch();
  let channel=channels.get(a.ticketId)||channels.find(c=>c?.topic===`candidature:${id}`&&c.parentId===CONFIG.categorieTickets);
  if(channel){
   if(channel.parentId!==CONFIG.categorieTickets||channel.topic!==`candidature:${id}`)throw Error('Le ticket enregistré est incorrect.');
   await channel.permissionOverwrites.edit(i.user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
  }else{
   channel=await i.guild.channels.create({name:`candidature-${id}`,type:ChannelType.GuildText,parent:CONFIG.categorieTickets,topic:`candidature:${id}`,
    permissionOverwrites:[{id:i.guildId,deny:[P.ViewChannel]},...[...new Set([id,i.user.id,i.client.user.id])].map(uid=>({id:uid,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,...(uid===i.client.user.id?[P.ManageChannels,P.AttachFiles,P.EmbedLinks]:[])]}))]});
  }
  update('candidatures',all=>{all[id].ticketId=channel.id;all[id].ticketRecruiterId=i.user.id;});
  await channel.send({content:`<@${id}> <@${i.user.id}>`,embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('Échange avec le recrutement').setDescription(`Ce ticket permet de poser des questions sur la candidature.\n[Consulter la candidature](https://discord.com/channels/${i.guildId}/${a.reviewChannelId}/${a.reviewMessageId})\nIl sera archivé puis fermé 12 heures après la décision écrite.`)],allowedMentions:{users:[id,i.user.id],roles:[]}});
  if(['accepted','refused'].includes(a.decision)){
   const member=await i.guild.members.fetch(id);
   await channel.send({embeds:[a.decision==='accepted'?embedAccepte(member):embedRefuse(member)]});
  }
  await updateReviewMessage(i.client,id);
  return i.editReply(`✅ Ticket accessible : <#${channel.id}>`);
 }
 async function handle(i){
  const cid=i.customId||'';
  if(cid!=='soul_join'&&!cid.startsWith('canddm:')&&!cid.startsWith('candticket:'))return false;
  const key=cid.startsWith('candticket:')?cid:'dm:'+i.user.id;
  try{
   if(isOff())throw Error('Le bot est actuellement hors service.');
   if(locks.has(key))throw Error('Une action est déjà en cours.');
   locks.add(key);
   try{
    if(cid==='soul_join'){await i.deferReply({flags:MessageFlags.Ephemeral});await start(i);return true;}
    if(cid.startsWith('candticket:')){await i.deferReply({flags:MessageFlags.Ephemeral});await ticket(i);return true;}
    if(i.guildId)throw Error('Ce questionnaire se remplit dans mes messages privés.');
    const [,action,session,index]=cid.split(':'),d=read('candidatureDmDrafts')[i.user.id];
    if(!d||d.id!==session||d.status!=='draft')throw Error('Ce questionnaire est terminé ou indisponible. Reviens au panel de candidature pour reprendre.');
    const n=Object.keys(d.answers).length;
    if(Number(index)!==n)throw Error('Cette question a déjà été traitée. Utilise le dernier message.');
    if(action==='answer'&&i.isButton()){
     const input=new TextInputBuilder().setCustomId('answer').setLabel(`Réponse à la question ${n+1}`).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
     await i.showModal(new ModalBuilder().setCustomId(`canddm:save:${d.id}:${n}`).setTitle(`Candidature • Question ${n+1}`).addComponents(new ActionRowBuilder().addComponents(input)));
    }else if(action==='save'&&i.isModalSubmit()){
     const answer=i.fields.getTextInputValue('answer').trim();if(!answer)throw Error('La réponse ne peut pas être vide.');
     await i.deferUpdate();d.answers[QUESTIONS[n].key]=answer;d.durations[QUESTIONS[n].key]=Date.now()-d.questionAt;d.questionAt=Date.now();
     update('candidatureDmDrafts',all=>{all[i.user.id]=d;});await i.editReply(payload(d,QUESTIONS));
    }else if(action==='submit'&&i.isButton()&&n===QUESTIONS.length){await i.deferUpdate();await submit(i,d);}
    else if(action==='cancel'&&i.isButton()){await i.deferUpdate();update('candidatureDmDrafts',all=>{all[i.user.id].status='cancelled';});await i.editReply({content:'Candidature annulée. Tu peux recommencer depuis le panel du serveur.',embeds:[],components:[]});}
    else throw Error('Action invalide.');
   }finally{locks.delete(key);}
  }catch(e){
   console.error('Candidature MP :',e.code||e.message);
   const content=e.code===50007?'❌ Active les messages privés des membres du serveur, puis réessaie.':`❌ ${e.message||'Action impossible. Réessaie plus tard.'}`;
   await (i.deferred&&(cid==='soul_join'||cid.startsWith('candticket:'))?i.editReply({content}):i.deferred||i.replied?i.followUp({content,flags:MessageFlags.Ephemeral}):i.reply({content,flags:MessageFlags.Ephemeral})).catch(()=>{});
  }
  return true;
 }
 return {handle,payload:d=>payload(d,QUESTIONS)};
};
