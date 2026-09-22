const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder,escapeMarkdown}=require('discord.js');
const {read}=require('../utils/recruitmentData');
const {COLORS,ROLES}=require('../config/soulSociety');
const {MAIN_RANKS}=require('../config/ranks');
const {roleNames,testPeriod,SOURCES}=require('../utils/candidateArchive');
const clean=s=>escapeMarkdown(String(s||'')).slice(0,3800);
const date=t=>t?`<t:${Math.floor(t/1000)}:f>`:'Date inconnue';
function payload(member,owner,tab='summary',page=0){
 const id=member.id,state=read('candidateArchive'),app=read('candidatures')[id],profile=read('welcomeProfiles')[id];
 const apps=Object.values(state.applications||{}).filter(a=>a.userId===id).sort((a,b)=>b.decidedAt-a.decidedAt);
 const history=Object.values(state.grades||{}).filter(e=>e.userId===id).sort((a,b)=>b.timestamp-a.timestamp);
 const period=testPeriod(id,state,member.roles.cache.has(ROLES.test),read('memberTests')[id]);
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('📋 Profil candidat • La Soul Society').setDescription(`<@${id}> • ${id}`);
 const files=[];let pages=1;
 if(tab==='apps'){
  pages=Math.max(1,apps.length);page=Math.min(Math.max(0,page),pages-1);const a=apps[page];
  if(a){
   embed.addFields({name:'Candidature Appy',value:`**${a.status==='accepted'?'Écrit accepté':'Écrit refusé'}** — ${date(a.decidedAt)}\n[Message original](${a.url})\nDépôt : ${date(a.submittedAt)}`});
   embed.setDescription(`<@${id}>\n\n${clean(a.body).slice(0,3600)}${a.body.length>3600?'\n\nSuite dans le fichier joint.':''}`);
   if(a.externalOnly)embed.addFields({name:'Réponses indisponibles dans Discord',value:a.dashboardUrl?`Appy a conservé cette longue candidature sur son site : [ouvrir le tableau de bord](${a.dashboardUrl}).`:'Les réponses ne figurent pas dans le message Appy.'});
   const q8=a.questions?.find(q=>q.number===8);if(q8)embed.addFields({name:'Roblox / RP déclaré (question 8)',value:clean(q8.answer).slice(0,1024)||'Non renseigné'});
   files.push(new AttachmentBuilder(Buffer.from(`Candidature — ${id}\nSource : ${a.url}\nDécision : ${a.decision}\n\n${a.body}`,'utf8'),{name:`candidature-${a.messageId}.txt`}));
  }else embed.addFields({name:'Appy',value:'Aucune candidature Appy retrouvée pour cet ID à ce stade de l’import.'});
  if(app?.reviewMessageId&&app?.reviewChannelId)embed.addFields({name:'Candidature du bot actuel',value:`[Ouvrir la candidature](https://discord.com/channels/${member.guild.id}/${app.reviewChannelId}/${app.reviewMessageId})`});
 }else if(tab==='history'){
  pages=Math.max(1,Math.ceil(history.length/8));page=Math.min(Math.max(0,page),pages-1);
  for(const e of history.slice(page*8,page*8+8))embed.addFields({name:`${e.action==='remove'?'Retrait':e.action==='add'?'Ajout':'Passage annoncé'} — ${e.roleName}`,value:`${date(e.timestamp)}\n[${e.evidence==='role-log'?'Log de rôle':'Annonce — date de publication'}](${e.url})`});
  if(!history.length)embed.addFields({name:'Historique importé',value:'Aucun changement reconnu pour cet ID à ce stade de l’import.'});
 }else{
  const ranks=Object.values(MAIN_RANKS).filter(r=>member.roles.cache.has(r.roleId)).map(r=>r.name);if(member.roles.cache.has('1471548646322475252'))ranks.push('Membre Confirmé');
  embed.addFields({name:'Grades actuels',value:ranks.join(', ')||'Aucun grade principal actuellement attribué'},
   {name:'Candidatures',value:`${apps.length} candidature(s) Appy archivée(s).${app?' Une candidature existe aussi dans le bot actuel.':''}`},
   {name:'Période de test',value:`${member.roles.cache.has(ROLES.test)?'🧪 Actuellement Membre Test':'N’est pas actuellement Membre Test'}\n${period?`Début : ${date(period.startedAt)}${period.endedAt?'\nFin : '+date(period.endedAt):''}\n${period.source?'[Source]('+period.source+')':''}${period.evidence==='announcement'?' — date issue d’une annonce':''}`:'Début non établi par les sources disponibles.'}\nRepère : 1 à 2 semaines, validation par la gestion.`},
   {name:'Accueil /bienvenue',value:profile?.completedAt||profile?.step==='done'?'✅ Terminé':'⏳ Non terminé'},
   {name:'Comptes-rendus entretien',value:'<#1550241655255203921>'});
 }
 const errors=Object.values(state.sources||{}).filter(s=>s.error).length,done=Object.keys(SOURCES).filter(c=>state.sources?.[c]?.complete).length;
 embed.setFooter({text:`Page ${page+1}/${pages} • Historique : ${done}/${Object.keys(SOURCES).length} salons parcourus${errors?' • '+errors+' salon(s) en erreur':''} • Les archives ne modifient aucun rôle`});
 const button=(label,t,p=0,disabled=false)=>new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Secondary).setCustomId(`memberctl:profile:${owner}:${id}:${t}:${p}`).setDisabled(disabled);
 const row=new ActionRowBuilder().addComponents(button('Résumé','summary'),button('Candidatures','apps'),button('Historique des grades','history'));
 const components=[row];if(tab!=='summary')components.push(new ActionRowBuilder().addComponents(button('Précédent',tab,page-1,page===0),button('Suivant',tab,page+1,page>=pages-1)));
 return {embeds:[embed],components,files,attachments:[],allowedMentions:{parse:[]}};
}
module.exports={payload};
