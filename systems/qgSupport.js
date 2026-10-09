const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const layout=require('../config/qgLayout'),config=require('../config/qg');
const pending=new Set();
const fields=[['motivation','Pourquoi rejoindre le support ?'],['experience','Quelle expérience as-tu ?'],['availability','Quelles sont tes disponibilités ?'],['scenario','Comment gérerais-tu un membre énervé ?'],['qualities','Tes qualités et points à améliorer ?']];
function panel(){return {embeds:[layout.embed('📝 Rejoindre le support du QG','Tu aimes aider, expliquer et garder ton calme ? Présente ta candidature au support.\n\nIndique tes motivations, ton expérience et tes disponibilités. Les réponses sont envoyées uniquement à l’équipe ; aucun rôle de modération n’est attribué automatiquement. Une candidature à la fois.\n\nL’équipe te contactera pour la suite : garde tes MP ouverts.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:apply').setLabel('Candidater au support').setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
async function handle(i,state){
 const action=i.customId?.split(':')[1];if(!['apply','apply-send','application'].includes(action))return false;
 if(i.guildId!==config.guildId)return false;
 const member=await i.guild.members.fetch(i.user.id);
 if(action==='apply'){
  if(!member.roles.cache.has(state.roles.member))throw Error('Accepte le règlement avant de candidater.');
  if(read('qgSupportApplications')[i.user.id]?.status==='pending')throw Error('Ta candidature est déjà en cours.');
  const modal=new ModalBuilder().setCustomId('qg:apply-send').setTitle('Candidature au support QG');
  fields.forEach(([id,label])=>modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(850))));
  await i.showModal(modal);return true;
 }
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const target=action==='application'?i.customId.split(':')[2]:i.user.id;
 if(pending.has(target))throw Error('Une action est déjà en cours.');pending.add(target);
 try{
  if(action==='apply-send'){
   if(!member.roles.cache.has(state.roles.member))throw Error('Rôle Membre requis.');
   if(['pending','sending'].includes(read('qgSupportApplications')[target]?.status))throw Error('Une candidature est déjà enregistrée.');
   const answers=Object.fromEntries(fields.map(([id])=>[id,i.fields.getTextInputValue(id).trim()]));
   if(Object.values(answers).some(x=>x.length<20||x.length>850))throw Error('Chaque réponse doit contenir entre 20 et 850 caractères.');
   const ch=await i.guild.channels.fetch(state.channels.staffApplications);
   const a={id:i.id,userId:target,status:'sending',answers,at:Date.now()};update('qgSupportApplications',all=>{all[target]=a;});
   let sent;
   try{sent=await ch.send({embeds:[layout.embed('Candidature support',`Candidat : <@${target}>\nID : ${target}`).addFields(fields.map(([id,name])=>({name,value:answers[id]})))],components:[new ActionRowBuilder().addComponents(...['accept','refuse'].map((choice)=>new ButtonBuilder().setCustomId(`qg:application:${target}:${i.id}:${choice}`).setLabel(choice==='accept'?'Accepter':'Refuser').setStyle(choice==='accept'?ButtonStyle.Success:ButtonStyle.Danger)))],allowedMentions:{parse:[]}});}
   catch(error){if(error.status>=400&&error.status<500)update('qgSupportApplications',all=>{all[target].status='failed';});throw Error('Envoi non confirmé. Contacte l’équipe avant de recommencer.');}
   update('qgSupportApplications',all=>{all[target].messageId=sent.id;all[target].status='pending';});await i.editReply('✅ Candidature envoyée à l’équipe.');return true;
  }
  const [, ,userId,id,choice]=i.customId.split(':');
  if(!['accept','refuse'].includes(choice)||!([state.roles.creator,state.roles.admin,state.roles.senior].some(id=>member.roles.cache.has(id))||i.user.id===i.guild.ownerId||i.user.id===config.ownerId))throw Error('Décision réservée à la direction et aux modérateurs seniors.');
  if(i.user.id===userId)throw Error('Tu ne peux pas traiter ta propre candidature.');
  const a=read('qgSupportApplications')[userId];if(!a||a.id!==id||a.messageId!==i.message.id||i.channelId!==state.channels.staffApplications||a.status!=='pending')throw Error('Cette candidature est déjà traitée ou n’est plus active.');
  const status=choice==='accept'?'accepted':'refused';update('qgSupportApplications',all=>{all[userId].status=status;all[userId].reviewer=i.user.id;all[userId].reviewedAt=Date.now();});
  await i.message.edit({embeds:[...i.message.embeds,layout.embed(choice==='accept'?'✅ Candidature acceptée':'❌ Candidature refusée',`Décision de <@${i.user.id}>.\n${choice==='accept'?'Contactez le candidat pour organiser la suite. Aucun rôle n’a été attribué automatiquement.':''}`)],components:[],allowedMentions:{parse:[]}});
  const user=await i.client.users.fetch(userId);const delivered=await user.send({embeds:[layout.embed('Ta candidature support au QG',choice==='accept'?'Ta candidature a été retenue ! L’équipe te contactera pour organiser la suite.':'Merci pour ton intérêt. Ta candidature n’a pas été retenue cette fois. Tu peux contacter le support pour en discuter.')]}).then(()=>true,()=>false);
  await i.editReply(delivered?'✅ Décision enregistrée et candidat prévenu en MP.':'✅ Décision enregistrée. ⚠️ MP impossible : prévenez le candidat autrement.');return true;
 }finally{pending.delete(target);}
}
module.exports={panel,handle};
