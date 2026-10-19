const {MessageFlags,SlashCommandBuilder}=require('discord.js');
const admin=require('../utils/qgAdmin');
const config=require('../config/qg');
const CLOSED='Les candidatures pour rejoindre le QG sont actuellement fermées. Nous vous invitons à revenir ultérieurement.';
const status=()=>({open:true,...admin.state().schoolRecruitmentControl});
async function refresh(guild){
 if(guild.id!==config.guildId)throw Error('Serveur incorrect.');
 const s=admin.state(),id=s.schoolChannels?.familyApplications;if(!id)return false;
 const channel=await guild.channels.fetch(id);if(!channel?.isTextBased()||channel.guildId!==guild.id)throw Error('Salon de candidature QG indisponible.');
 const rec=s.schoolPanels?.familyApplications;
 let message=rec?.channelId===id?await channel.messages.fetch(rec.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!message){const recent=await channel.messages.fetch({limit:50});message=recent.find(m=>m.author.id===guild.client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==='qgs:family-apply')));}
 const payload=require('./qgSchoolSetup').panelPayload('familyApplications',guild);
 if(message){if(message.author.id!==guild.client.user.id)throw Error('Le panel appartient à un autre compte.');await message.edit({...payload,attachments:[]});}
 else message=await channel.send(payload);
 admin.save(s=>{s.schoolPanels||={};s.schoolPanels.familyApplications={channelId:id,messageId:message.id};});return true;
}
async function change(guild,actorId,open){
 return admin.serial('recruitment-control',async()=>{
  const before=status();admin.save(s=>{s.schoolRecruitmentControl={open,changedAt:Date.now(),changedBy:actorId};});
  const logged=await admin.audit(guild,{action:open?'cd.on':'cd.off',actorId,before,after:status()});
  let refreshed=false;try{refreshed=await refresh(guild);}catch{}
  return {logged,refreshed};
 });
}
const data=new SlashCommandBuilder().setName('cd').setDescription('Gérer l’ouverture des candidatures famille QG').setDMPermission(false)
 .addSubcommand(s=>s.setName('on').setDescription('Ouvrir les nouvelles candidatures'))
 .addSubcommand(s=>s.setName('off').setDescription('Fermer les nouvelles candidatures'))
 .addSubcommand(s=>s.setName('statut').setDescription('Consulter le statut du recrutement'));
async function execute(i){await i.deferReply({flags:MessageFlags.Ephemeral});try{
 await admin.actor(i,'cd');const action=i.options.getSubcommand();let result;
 if(action==='on'||action==='off')result=await change(i.guild,i.user.id,action==='on');
 const s=status(),apps=Object.values(admin.state().schoolFamilyRecruitment||{});
 return i.editReply({embeds:[require('./qgPanels').embed('Candidatures famille • QG',`${s.open?'🟢 Candidatures ouvertes':'🔴 Candidatures fermées'}\nDernier changement : ${s.changedAt?`<t:${Math.floor(s.changedAt/1000)}:f>`:'aucun changement enregistré'}\nResponsable : ${s.changedBy?`<@${s.changedBy}>`:'non enregistré'}\nQuestionnaires en cours : **${apps.filter(a=>a.status==='in_progress').length}**\nDossiers à traiter : **${apps.filter(a=>['submitted','in_review'].includes(a.status)).length}**\n${result&&!result.refreshed?'Le statut est enregistré, mais le panel n’a pas pu être actualisé. Vérifie ses permissions et relance la commande.':''}\n${result&&!result.logged?'Le journal Discord est indisponible ; l’historique local est conservé.':''}`)],allowedMentions:{parse:[]}});
 }catch(e){return i.editReply({content:e.code?'Action impossible : vérifie les permissions du bot.':e.message,allowedMentions:{parse:[]}});}}
module.exports={data,execute,status,refresh,change,CLOSED};
