const {randomUUID}=require('node:crypto');
const {SlashCommandBuilder,MessageFlags:F,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:Text,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),rp=require('./qgRpStatus'),{embed}=require('./qgPanels'),clean=require('../utils/qgAiKnowledge').clean;
const data=new SlashCommandBuilder().setName('sp').setDescription('Fiche joueur et sanctions du QG').setDMPermission(false).addUserOption(o=>o.setName('joueur').setDescription('Membre à consulter').setRequired(true));
const labels={warn:'Avertissement',tempprison:'Prison temporaire',tempmute:'Mute temporaire',tempjail:'Jail temporaire',ban:'Bannissement'};
function permitted(member,action){if(!a.isDirection(member)&&!a.has(member,['ticketsLead','ticketsManagement']))return false;return action!=='ban'||a.isDirection(member)||a.has(member,['ticketsLead']);}
async function context(i,id){
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');
 const session=a.state().schoolSanctionSessions?.[id];if(!session||session.actorId!==i.user.id||session.expiresAt<Date.now())throw Error('Panel expiré ou réservé à son auteur. Relance /sp.');
 const actor=await i.guild.members.fetch({user:i.user.id,force:true});if(!permitted(actor))throw Error('Accès réservé à la Gestion Support.');
 const target=await i.guild.members.fetch({user:session.targetId,force:true});return{session,actor,target};
}
const timestamp=value=>value?`<t:${Math.floor(value/1000)}:f>`:'Non disponible';
function view(actor,target,id){
 const metrics=require('./qgMemberMetrics').total(target.id),history=(a.state().schoolSanctions||[]).filter(s=>s.targetId===target.id);
 const duration=metrics?`${Math.floor(metrics.milliseconds/3600000)} h ${Math.floor(metrics.milliseconds/60000)%60} min (suivi depuis ${timestamp(metrics.measuredSince)})`:'Pas encore mesuré';
 const description=`**Membre :** <@${target.id}>\n**Identifiant :** \`${target.id}\`\n**Compte créé :** ${timestamp(target.user.createdTimestamp)}\n**Arrivée :** ${timestamp(target.joinedTimestamp)}\n**Vocal actuel :** ${target.voice.channelId?`<#${target.voice.channelId}>`:'Non connecté'}\n**Temps de présence vocale mesuré :** ${duration}\n**Invité par :** ${require("./qgInvites").description(target.id)}\n**Vocal sur 7 jours calendaires :** ${Math.floor(require("./qgMemberMetrics").week(target.id).voiceMs/3600000)} h ${Math.floor(require("./qgMemberMetrics").week(target.id).voiceMs/60000)%60} min\n**Messages sur 7 jours :** ${require("./qgMemberMetrics").week(target.id).messages}\n\n**Restrictions**\nPrison : ${rp.status(target.id).prison?'active':'inactive'}\nTimeout : ${target.communicationDisabledUntilTimestamp>Date.now()?timestamp(target.communicationDisabledUntilTimestamp):'aucun'}\n\n**Dernières sanctions conservées**\n${history.slice(-5).reverse().map(s=>`${timestamp(s.at)} • ${labels[s.action]} • ${s.result} • <@${s.actorId}>\n${clean(s.reason).slice(0,140)}`).join('\n')||'Aucune sanction enregistrée par /sp.'}`;
 return{embeds:[embed('Fiche joueur • '+clean(target.displayName).slice(0,80),description).setThumbnail(target.user.displayAvatarURL())],components:[new Row().addComponents(...Object.entries(labels).map(([action,label])=>new Button().setCustomId(`qgsp:choose:${id}:${action}`).setLabel(label).setStyle(action==='ban'?S.Danger:S.Secondary).setDisabled(!permitted(actor,action)))),new Row().addComponents(new Button().setCustomId(`qgsp:refresh:${id}`).setLabel('Actualiser').setStyle(S.Primary))],allowedMentions:{parse:[]}};
}
async function execute(i,targetId=null){await i.deferReply({flags:F.Ephemeral});try{
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');const actor=await i.guild.members.fetch({user:i.user.id,force:true});if(!permitted(actor))throw Error('Accès réservé à la Gestion Support.');
 const target=await i.guild.members.fetch(targetId||i.options.getUser('joueur',true).id),id=randomUUID();a.save(s=>{s.schoolSanctionSessions||={};for(const [key,rec]of Object.entries(s.schoolSanctionSessions))if(rec.expiresAt<Date.now())delete s.schoolSanctionSessions[key];s.schoolSanctionSessions[id]={actorId:actor.id,targetId:target.id,expiresAt:Date.now()+600000};});
 return i.editReply(view(actor,target,id));
 }catch(e){return i.editReply(e.code?'Membre indisponible ou accès insuffisant.':e.message);}}
async function check(i,ctx,action){
 if(!permitted(ctx.actor,action))throw Error('Action non autorisée.');
 if(!labels[action])throw Error('Action inconnue.');
 const bot=await i.guild.members.fetchMe();a.hierarchy(ctx.actor,ctx.target,bot);
 if(action==='tempmute'&&(!ctx.target.moderatable||!bot.permissions.has(P.ModerateMembers)))throw Error('Ce membre ne peut pas être mis en timeout par le bot.');
 if(action==='ban'&&(!ctx.target.bannable||!bot.permissions.has(P.BanMembers)))throw Error('Ce membre ne peut pas être banni par le bot.');
}
async function handle(i){try{
 const [,op,id,value]=i.customId.split(':'),ctx=await context(i,id);
 if(op==='refresh')return await i.update(view(ctx.actor,ctx.target,id));
 if(op==='choose'){
  await check(i,ctx,value);const modal=new Modal().setCustomId(`qgsp:form:${id}:${value}`).setTitle(labels[value]).addComponents(new Row().addComponents(new Input().setCustomId('reason').setLabel('Motif').setStyle(Text.Paragraph).setMaxLength(800).setRequired(true)));
  if(value.startsWith('temp'))modal.addComponents(new Row().addComponents(new Input().setCustomId('minutes').setLabel('Durée en minutes').setStyle(Text.Short).setMaxLength(6).setRequired(true)));
  return await i.showModal(modal);
 }
 await i.deferReply({flags:F.Ephemeral});
 if(op==='cancel'){a.save(s=>{delete s.schoolSanctionSessions[id].pending;});return i.editReply('Action annulée.');}
 if(op==='form'){
  await check(i,ctx,value);const reason=clean(i.fields.getTextInputValue('reason')).trim(),minutes=value.startsWith('temp')?Number(i.fields.getTextInputValue('minutes')):0;
  if(!reason)throw Error('Motif obligatoire.');if(value.startsWith('temp')&&(!Number.isInteger(minutes)||minutes<1||minutes>(value==='tempmute'?40320:525600)))throw Error('Durée invalide. Le timeout est limité à 28 jours.');
  const nonce=randomUUID();a.save(s=>{s.schoolSanctionSessions[id].pending={action:value,reason,minutes,nonce};});
  return i.editReply({embeds:[embed('Confirmer la sanction',`**${labels[value]}** pour <@${ctx.target.id}>\nMotif : ${reason}\n${minutes?`Durée : ${minutes} minute(s).`:''}\n${value==='ban'?'Bannissement permanent. Aucun historique de messages ne sera supprimé.':''}`)],components:[new Row().addComponents(new Button().setCustomId(`qgsp:confirm:${id}:${nonce}`).setLabel('Confirmer').setStyle(S.Danger),new Button().setCustomId(`qgsp:cancel:${id}`).setLabel('Annuler').setStyle(S.Secondary))],allowedMentions:{parse:[]}});
 }
 if(op!=='confirm')throw Error('Action inconnue.');
 return await a.serial('member:'+ctx.target.id,async()=>{
  const fresh=await context(i,id),pending=fresh.session.pending;if(!pending||pending.nonce!==value)throw Error('Confirmation déjà utilisée ou remplacée.');await check(i,fresh,pending.action);
  if(pending.action==='tempmute'&&fresh.target.communicationDisabledUntilTimestamp>Date.now())throw Error('Un timeout est déjà actif. Il ne sera pas remplacé.');
  a.save(s=>{delete s.schoolSanctionSessions[id].pending;});
  const entry={id:randomUUID(),at:Date.now(),targetId:fresh.target.id,actorId:fresh.actor.id,...pending,result:'pending'};delete entry.nonce;
  a.save(s=>{s.schoolSanctions||=[];s.schoolSanctions.push(entry);s.schoolSanctions=s.schoolSanctions.slice(-5000);});
  let error=null;try{
   if(pending.action==='warn'){const d=require('./qgDiscipline');const c=d.create({sourceKey:'sp:'+entry.id,memberId:fresh.target.id,actorId:fresh.actor.id,reason:pending.reason,progressive:true,status:'review',origin:'manuelle'});if(a.isDirection(fresh.actor)||a.has(fresh.actor,['ticketsLead','recruitmentLead']))await d.apply(i.guild,c.id,fresh.actor,{automatic:true,locked:true});else await d.report(i.guild,c.id);entry.disciplineId=c.id;entry.disciplineStatus=d.state().cases[c.id].status;}
   if(pending.action==='tempjail')await require('./qgJail').apply(fresh.target,fresh.actor,pending.reason,pending.minutes);
   if(pending.action==='tempprison')await rp.apply(fresh.target,'prison',fresh.actor,pending.reason,pending.minutes);
   if(pending.action==='tempmute')await fresh.target.timeout(pending.minutes*60000,pending.reason);
   if(pending.action==='ban')await fresh.target.ban({reason:pending.reason,deleteMessageSeconds:0});
   entry.result=entry.disciplineStatus&&entry.disciplineStatus!=='applied'?'review':'success';
  }catch(e){entry.result='failed';error=e;}
  let dm=false;if(entry.result==='success')try{await fresh.target.user.send({embeds:[embed('QG • '+labels[pending.action],`Motif : ${pending.reason}${pending.minutes?`\nDurée : ${pending.minutes} minute(s).`:''}`)],allowedMentions:{parse:[]}});dm=true;}catch{}
  a.save(s=>{const item=s.schoolSanctions.find(s=>s.id===entry.id);if(item)Object.assign(item,{result:entry.result,dmDelivered:dm,disciplineId:entry.disciplineId,disciplineStatus:entry.disciplineStatus});});
  await a.audit(i.guild,{action:'sanction.'+pending.action,actorId:fresh.actor.id,targetId:fresh.target.id,reason:pending.reason,result:entry.result,after:{minutes:pending.minutes,caseId:entry.id}});
  if(error)throw error;if(entry.result==='review')return i.editReply({content:'Dossier transmis à la direction pour examen. Aucun avertissement supplémentaire n’a été appliqué.',embeds:[],components:[]});return i.editReply({content:`${labels[pending.action]} enregistré${pending.action==='warn'?'':' et appliqué'}.${dm?' Notification privée envoyée.':' MP indisponibles : notification non remise.'}`,embeds:[],components:[],allowedMentions:{parse:[]}});
 });
 }catch(e){const payload={content:e.code?'Action non terminée : vérifie les permissions du bot et l’état du membre.':clean(e.message),allowedMentions:{parse:[]}};if(i.deferred||i.replied)return i.editReply(payload).catch(()=>{});return i.reply({...payload,flags:F.Ephemeral}).catch(()=>{});}}
module.exports={data,execute,handle};
