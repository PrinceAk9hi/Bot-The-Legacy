const {randomUUID}=require('node:crypto');
const {SlashCommandBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:B,StringSelectMenuBuilder:Menu,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:T,MessageFlags:F,ChannelType:C,PermissionFlagsBits:P,AttachmentBuilder}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{embed}=require('./qgPanels');
const clean=require('../utils/qgAiKnowledge').clean;
const REPORT='1562090387588390942';
const staffKeys=['creator','globalManager','administrator','recruitmentLead','recruitmentManagement'];
const data=new SlashCommandBuilder().setName('entretien').setDescription('Espace recruteur du QG').setDMPermission(false)
 .addSubcommand(s=>s.setName('panel').setDescription('Ouvrir les outils d’entretien'))
 .addSubcommand(s=>s.setName('installer').setDescription('Installer ou actualiser l’espace recruteur'));
const row=(...items)=>new Row().addComponents(...items);
const button=(id,label,style=B.Secondary)=>new Button().setCustomId(id).setLabel(label).setStyle(style);
const roles=()=>a.state().schoolRoles||{};
const channels=()=>a.state().schoolChannels||{};
const officeIds=()=>Array.from({length:5},(_,n)=>channels()['interview'+(n+1)]).filter(Boolean);
const staff=m=>a.isDirection(m)||a.has(m,['recruitmentLead','recruitmentManagement']);
async function authorize(i,foundation=false){
 if(i.guildId!==config.guildId)throw Error('Action réservée au QG.');
 const m=await i.guild.members.fetch({user:i.user.id,force:true});
 if(foundation?!(m.id===i.guild.ownerId||m.id===config.ownerId||a.has(m,['creator','globalManager'])):!staff(m))throw Error('Tu n’es pas habilité à traiter ce dossier.');
 return m;
}
const appFor=id=>Object.values(a.state().schoolFamilyRecruitment||{}).find(x=>x.caseId===id);
function put(app){a.save(s=>{s.schoolFamilyRecruitment||={};s.schoolFamilyRecruitment[app.applicantId]=app;});return app;}
function requireApp(id){const app=appFor(id);if(!app)throw Error('Ce dossier a été remplacé ou est introuvable.');return app;}
function controls(app){return [row(button(`qgr:written:${app.caseId}:accept`,'Accepter',B.Success),button(`qgr:written:${app.caseId}:refuse`,'Refuser',B.Danger),button(`qgr:dds:${app.caseId}`,'DDS'),button(`qgr:ticket:${app.caseId}`,'Ouvrir un ticket'))];}
function summary(app){
 const result=embed('📋 Candidature • QG',`Candidat : <@${app.applicantId}>\nStatut : **${app.status}**\nDossier : ${app.caseId}\nDéposée <t:${Math.floor((app.submittedAt||app.createdAt)/1000)}:f>\n${app.updatedBy?`Dernier traitement : <@${app.updatedBy}>\n`:''}Les réponses complètes sont jointes au dossier.`);
 for(let n=0;n<Math.min(3,app.answers?.length||0);n++)result.addFields({name:`Question ${n+1}`,value:clean(app.answers[n]||'Sans réponse').slice(0,800)});
 return result;
}
function panel(){const card=embed('ESPACE RECRUTEUR · QG','**Chaque candidature mérite un suivi clair et une décision expliquée.**\nRetrouve ici les outils de préparation, d’entretien et de compte rendu.').setColor(0xffffff).addFields(
 {name:'01 · Examiner le dossier',value:'Consulte la candidature écrite. Depuis son dossier, **Accepter** attribue Attente entretien ; **Refuser** attribue Membre refusé. **DDS** sollicite la Fondation. **Ouvrir un ticket** crée un échange privé.'},
 {name:'02 · Préparer l’entretien',value:'Rejoins un bureau, puis utilise **Déplacer vers soi** pour choisir un candidat en attente. **Questions** ouvre le guide et **Voir candidature** affiche les réponses en privé.'},
 {name:'03 · Décider et transmettre',value:'Après l’oral, **Accepter** attribue Membre Test et **Refuser** attribue Membre refusé. Les deux retirent Attente entretien. Une confirmation est demandée.'},
 {name:'Compte rendu',value:'Renseigne le bilan avec **Compte rendu**. Le rapport conserve la durée vocale mesurée et un accès sécurisé au dossier.',inline:true},
 {name:'Confidentialité',value:'Vérifie le candidat sélectionné. Les dossiers et les rapports restent réservés aux personnes habilitées.',inline:true});return {embeds:[card],
 components:[row(button('qgr:choose:oralaccept','Accepter',B.Success),button('qgr:choose:oralrefuse','Refuser',B.Danger),button('qgr:choose:wait','Attente')),row(button('qgr:choose:bring','Déplacer vers soi',B.Primary),button('qgr:choose:cr','Compte rendu'),button('qgr:choose:view','Voir candidature'),button('qgr:questions','Questions'))],allowedMentions:{parse:[]}};}
function overwrites(guild,extra=[]){
 return [{id:guild.id,deny:[P.ViewChannel]},{id:guild.client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.EmbedLinks,P.AttachFiles,P.Connect,P.MoveMembers]},
 ...[...new Set(staffKeys.map(k=>roles()[k]).filter(Boolean))].map(id=>({id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.Connect,P.Speak,P.MoveMembers]})),...extra];
}
async function install(guild){
 return a.serial('qg-interview-install',async()=>{
  await guild.roles.fetch();await guild.channels.fetch();
  for(const [key,name] of [['interviewWaiting','Attente entretien'],['recruitmentRefused','Membre refusé']]){
   let role=guild.roles.cache.get(roles()[key]);
   if(!role){const matches=guild.roles.cache.filter(r=>r.name===name);if(matches.size>1)throw Error(`Plusieurs rôles ${name} : configure leur identifiant avant installation.`);role=matches.first();}
   if(!role)role=await guild.roles.create({name,permissions:[],reason:'Recrutement QG'});
   if(role.managed||role.permissions.bitfield!==0n)throw Error(`Le rôle ${name} doit être sans permission et non géré.`);
   a.save(s=>{s.schoolRoles||={};s.schoolRoles[key]=role.id;});
  }
  let category=guild.channels.cache.get(a.state().schoolCategories?.recruitmentArea);
  if(!category){const matches=guild.channels.cache.filter(c=>c.type===C.GuildCategory&&c.name==='✦・ESPACE RECRUTEUR');if(matches.size>1)throw Error('Plusieurs espaces recruteur : configure l’identifiant.');category=matches.first();}
  if(!category)category=await guild.channels.create({name:'✦・ESPACE RECRUTEUR',type:C.GuildCategory,permissionOverwrites:overwrites(guild)});
  a.save(s=>{s.schoolCategories||={};s.schoolCategories.recruitmentArea=category.id;});
  const specs=[['interviewPanel','🖥️・panel-entretien',C.GuildText],['candidateReception','📋・cd-en-attente',C.GuildText],['recruitmentChat','🖋️・discu-recrutement',C.GuildText],['interviewAvailability','🔎・disponibilités',C.GuildText],['interviewWaiting','🪑・attente-entretien',C.GuildVoice],...Array.from({length:5},(_,n)=>['interview'+(n+1),`🔐・Bureau Entretien ${String(n+1).padStart(2,'0')}`,C.GuildVoice])];
  for(const [key,name,type] of specs){
   let ch=guild.channels.cache.get(channels()[key]);
   if(ch&&ch.type!==type&&!(key==='interviewPanel'&&[C.GuildVoice,C.GuildAnnouncement].includes(ch.type)))throw Error(`Type de salon incompatible : ${key}`);
   if(!ch){const matches=guild.channels.cache.filter(c=>c.parentId===category.id&&c.name===name&&c.type===type);if(matches.size>1)throw Error(`Salons en double : ${name}`);ch=matches.first();}
   const access=['interviewAvailability','interviewWaiting'].includes(key)?[{id:roles().interviewWaiting,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.Connect,P.Speak]}]:[];
   // Les bureaux sont visibles aux candidats en attente, mais seul un recruteur peut les y déplacer.
   if(key.match(/^interview[1-5]$/))access.push({id:roles().interviewWaiting,allow:[P.ViewChannel],deny:[P.Connect]});
   if(!ch)ch=await guild.channels.create({name,type,parent:category.id,permissionOverwrites:overwrites(guild,access)});
   else await ch.edit({parent:category.id,permissionOverwrites:overwrites(guild,access),reason:'Installation explicite de l’espace recruteur'});
   a.save(s=>{s.schoolChannels||={};s.schoolChannels[key]=ch.id;});
  }
  const ch=await guild.channels.fetch(channels().interviewPanel),saved=a.state().schoolInterviewPanel;
  let message=saved?.channelId===ch.id?await ch.messages.fetch(saved.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
  if(!message){const recent=await ch.messages.fetch({limit:100});message=recent.find(m=>m.author.id===guild.client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==='qgr:choose:oralaccept')));}
  if(message)await message.edit(panel());else message=await ch.send(panel());
  a.save(s=>{s.schoolInterviewPanel={channelId:ch.id,messageId:message.id};});
  // Reprend les candidatures écrites actives, sans toucher aux admissions déjà décidées.
  for(const app of Object.values(a.state().schoolFamilyRecruitment||{})){
   if(['submitted','in_review'].includes(app.status)&&(!app.caseId||!app.messageId))await submitApplication(guild,app);
  }
  return ch;
 });
}
async function execute(i){
 await i.deferReply({flags:F.Ephemeral});const actor=await authorize(i);
 if(i.options.getSubcommand()==='installer'){
  if(!a.isDirection(actor))throw Error('Installation réservée à la direction.');
  const ch=await install(i.guild);return i.editReply(`Espace recruteur actualisé : <#${ch.id}>. Aucun ancien salon ni historique supprimé.`);
 }
 return i.editReply(panel());
}
function attachment(app){
 const questions=app.questions||require('./qgSchoolApplications').familyQuestions;
 const body=questions.map((q,n)=>`${n+1}. ${q}\n${app.answers?.[n]||'Réponse indisponible'}${app.answerDurations?.[n]!=null?`\nDélai de réponse : ${Math.round(app.answerDurations[n]/1000)} s`:''}`).join('\n\n');
 return new AttachmentBuilder(Buffer.from(clean(body),'utf8'),{name:`candidature-${app.caseId}.txt`});
}
async function submitApplication(guild,app){
 return a.serial('qgr-app:'+app.applicantId,async()=>{
  app.caseId||=randomUUID().slice(0,12);app.submittedAt||=Date.now();app.status='submitted';app.questions||=require('./qgSchoolApplications').familyQuestions;
  const ch=await guild.channels.fetch(channels().candidateReception);
  if(!ch||ch.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel))throw Error('Installe d’abord l’espace recruteur privé avec /entretien installer.');
  put(app);
  const recent=await ch.messages.fetch({limit:100});
  let message=recent.find(m=>m.author.id===guild.client.user.id&&m.components.some(r=>r.components.some(c=>c.customId===`qgr:dds:${app.caseId}`)));
  if(!message)message=await ch.send({embeds:[summary(app)],files:[attachment(app)],components:controls(app),allowedMentions:{parse:[]}});
  app.channelId=ch.id;app.messageId=message.id;put(app);
  return app;
 });
}
async function refresh(guild,app){
 try{const ch=await guild.channels.fetch(app.channelId),m=await ch.messages.fetch(app.messageId);await m.edit({embeds:[summary(app)],components:controls(app),allowedMentions:{parse:[]}});}catch{a.save(s=>{s.schoolFamilyRecruitment[app.applicantId].panelRefreshFailed=true;});}
}
async function view(i,app){return i.editReply({embeds:[summary(app)],files:[attachment(app)],allowedMentions:{parse:[]}});}
function recentlyFinished(app,actor){return app.interviewFinishedAt&&app.updatedBy===actor.id&&Date.now()-app.interviewFinishedAt<86400000;}
function session(i,app,action){
 const id=randomUUID().slice(0,12);
 a.save(s=>{s.schoolInterviewSessions||={};for(const [k,v] of Object.entries(s.schoolInterviewSessions))if(v.expires<Date.now())delete s.schoolInterviewSessions[k];s.schoolInterviewSessions[id]={actor:i.user.id,caseId:app.caseId,action,expires:Date.now()+600000};});
 return id;
}
function getSession(i,id){const s=a.state().schoolInterviewSessions?.[id];if(!s||s.actor!==i.user.id||s.expires<Date.now()||s.used)throw Error('Cette action a expiré ou a déjà été utilisée.');return s;}
function form(id,title,fields){return new Modal().setCustomId(id).setTitle(title).addComponents(...fields.map(([key,label,long,value])=>row(new Input().setCustomId(key).setLabel(label).setStyle(long?T.Paragraph:T.Short).setMaxLength(long?900:120).setRequired(true).setValue(value||''))));}
async function choose(i,actor,action){
 const office=actor.voice.channelId;
 if(!officeIds().includes(office))throw Error('Rejoins un bureau d’entretien configuré pour sélectionner un candidat.');
 const source=action==='bring'?channels().interviewWaiting:office;
 const ch=await i.guild.channels.fetch(source);
 const options=Object.values(a.state().schoolFamilyRecruitment||{}).filter(x=>x.caseId&&(ch.members.has(x.applicantId)||(['cr','view'].includes(action)&&recentlyFinished(x,actor)))&&(['waiting_interview','accept','refuse'].includes(x.status))&&(action!=='bring'||x.status==='waiting_interview'));
 if(!options.length)throw Error('Aucun candidat avec dossier disponible dans ce vocal.');
 return i.editReply({embeds:[embed('Choisir le candidat','Sélectionne la personne concernée par cette action.')],components:[row(new Menu().setCustomId(`qgr:select:${action}`).setPlaceholder('Candidat').addOptions(options.slice(0,25).map(x=>({label:(i.guild.members.cache.get(x.applicantId)?.displayName||x.applicantId).slice(0,100),value:x.caseId}))))]});
}
async function decision(i,actor,app,action){
 if(!['writtenaccept','writtenrefuse','oralaccept','oralrefuse'].includes(action))throw Error('Décision invalide.');
 const oral=action.startsWith('oral');
 if(oral?app.status!=='waiting_interview':!['submitted','in_review'].includes(app.status))throw Error('Cette étape a déjà été traitée.');
 const target=await i.guild.members.fetch({user:app.applicantId,force:true});
 if(oral&&(!officeIds().includes(actor.voice.channelId)||target.voice.channelId!==actor.voice.channelId))throw Error('Le candidat et le recruteur doivent être dans le même bureau.');
 const accepted=action.endsWith('accept'),r=roles();
 if(accepted&&!require('./qgSchoolApplications')._test.verifiedForRecruitment(target))throw Error('La vérification du candidat doit être terminée.');
 if(accepted&&require('./qgSchoolApplications')._test.inFamily(target))throw Error('Ce membre possède déjà un grade familial.');
 const add=accepted?(oral?r.test:r.interviewWaiting):r.recruitmentRefused;
 if(!add||!r.interviewWaiting||!r.recruitmentRefused)throw Error('Rôles absents : lance /entretien installer et vérifie le grade Membre Test.');
 const affected=await Promise.all([...new Set([add,r.interviewWaiting,r.recruitmentRefused])].map(id=>i.guild.roles.fetch(id)));
 a.hierarchy(actor,target,await i.guild.members.fetchMe(),affected);
 const before=app.status;
 if(oral)await tick(i.guild);
 await target.roles.add(add,'Décision de recrutement QG');
 const remove=[r.interviewWaiting,r.recruitmentRefused].filter(id=>id!==add);
 await target.roles.remove(remove,'Décision de recrutement QG');
 app.status=accepted?(oral?'accept':'waiting_interview'):'refuse';app.updatedAt=Date.now();app.updatedBy=actor.id;if(oral)app.interviewFinishedAt=Date.now();put(app);
 if(oral)await tick(i.guild);
 if(oral&&accepted)require('./qgCommunityUpgrade').recruited(await i.guild.members.fetch({user:target.id,force:true}));
 await a.audit(i.guild,{action:'recruitment.'+action,actorId:actor.id,targetId:target.id,before,after:app.status});
 const dm=await target.send({embeds:[embed('Ta candidature au QG',accepted?(oral?'Ton entretien est accepté. Tu rejoins la famille au grade Membre Test.':`Ta candidature écrite est acceptée. Tu es en attente d’entretien. Indique tes disponibilités dans <#${channels().interviewAvailability}>.`):'Ta candidature a été refusée par l’équipe de recrutement.')],allowedMentions:{parse:[]}}).then(()=>true,()=>false);
 await refresh(i.guild,app);
 return i.editReply({content:`Décision enregistrée.${dm?'':' MP non remis : le candidat doit être prévenu par l’équipe.'}`,embeds:[],components:[]});
}
async function ticket(i,app){
 let ch=app.ticketId?await i.guild.channels.fetch(app.ticketId).catch(e=>{if(e.code===10003)return null;throw e;}):null;
 const parent=a.state().schoolCategories?.recruitmentArea;if(!parent)throw Error('Installe l’espace recruteur.');
 if(ch){if(!ch.permissionsFor(i.member)?.has(P.ViewChannel))throw Error('Un ticket privé existe déjà avec un autre recruteur.');return i.editReply(`Ticket existant : <#${ch.id}>`);}
 await i.guild.channels.fetch();ch=i.guild.channels.cache.find(c=>c.parentId===parent&&c.topic===`qgr:${app.caseId}`);
 if(!ch)ch=await i.guild.channels.create({name:`candidat-${app.applicantId}`,type:C.GuildText,parent,topic:`qgr:${app.caseId}`,permissionOverwrites:[{id:i.guild.id,deny:[P.ViewChannel]},{id:i.client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},...[app.applicantId,i.user.id].map(id=>({id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]}))]});
 app.ticketId=ch.id;app.ticketRecruiterId||=i.user.id;put(app);
 return i.editReply(`Échange privé candidat–recruteur : <#${ch.id}>`);
}
async function handle(i){
 const foundation=i.customId.startsWith('qgr:ddsanswer')||i.customId.startsWith('qgr:ddssave');
 const actor=await authorize(i,foundation);let[,op,id,extra]=i.customId.split(':');
 if(op==='ddsanswer'){
  const request=a.state().schoolInterviewDds?.[id];if(!request||request.answer)throw Error('Demande absente ou déjà traitée.');
  return i.showModal(form(`qgr:ddssave:${id}`,'Réponse de la Fondation',[['answer','Sanctions / éléments communicables',true]]));
 }
 if(op==='select'&&id==='cr'){
  const app=requireApp(i.values[0]);
  if(!recentlyFinished(app,actor)&&(!officeIds().includes(actor.voice.channelId)||actor.voice.channelId!==(await i.guild.members.fetch(app.applicantId)).voice.channelId))throw Error('Le candidat doit être dans ton bureau, ou avoir terminé son entretien avec toi depuis moins de 24 h.');
  const token=session(i,app,'cr');
  return i.showModal(form(`qgr:crsave:${token}`,'Compte-rendu recrutement',[['presentation','Présentation + Communication',true],['decision','Date arrivée / refus + décision',false],['trial','Durée PDT',false],['candidate','Discord du candidat',false,app.applicantId]]));
 }
 await i.deferReply({flags:F.Ephemeral});
 if(op==='questions')return i.editReply({embeds:[embed('Guide d’entretien','Les questions et consignes de l’entretien oral ne sont pas encore configurées. Elles seront ajoutées après transmission par la direction.')]});
 if(op==='choose')return choose(i,actor,id);
 if(op==='select'){
  const app=requireApp(i.values[0]),target=await i.guild.members.fetch({user:app.applicantId,force:true});
  if(!officeIds().includes(actor.voice.channelId))throw Error('Rejoins un bureau d’entretien.');
  if(id==='view'){if(target.voice.channelId!==actor.voice.channelId&&!recentlyFinished(app,actor))throw Error('Le candidat doit être dans ton bureau.');return view(i,app);}
  if(['bring','wait'].includes(id)){
   if(app.status!=='waiting_interview'||target.voice.channelId!==(id==='bring'?channels().interviewWaiting:actor.voice.channelId))throw Error('Le candidat a changé de vocal ou de statut.');
   const bot=await i.guild.members.fetchMe(),destination=await i.guild.channels.fetch(id==='bring'?actor.voice.channelId:channels().interviewWaiting);
   if(!destination.permissionsFor(actor)?.has(P.MoveMembers)||!destination.permissionsFor(bot)?.has(P.MoveMembers)||!destination.permissionsFor(bot)?.has(P.Connect))throw Error('Permission Déplacer les membres / Se connecter manquante.');
   a.hierarchy(actor,target,bot);
   await target.voice.setChannel(destination,'Entretien QG');
   return i.editReply('Candidat déplacé.');
  }
  if(!['oralaccept','oralrefuse'].includes(id))throw Error('Action inconnue.');
  const token=session(i,app,id);
  return i.editReply({embeds:[embed('Confirmer la décision',`${id==='oralaccept'?'Accepter':'Refuser'} l’entretien de <@${app.applicantId}> ?`)],components:[row(button(`qgr:confirm:${token}`,'Confirmer',B.Primary))],allowedMentions:{parse:[]}});
 }
 if(op==='confirm'||op==='crsave')return a.serial('qgr-session:'+id,async()=>{
  const s=getSession(i,id),app=requireApp(s.caseId);
  return a.serial('qgr-case:'+app.caseId,async()=>{
   const current=requireApp(app.caseId);
   if(op==='confirm'){
    // Marqué avant l’appel Discord : une réponse réseau incertaine ne doit pas rejouer une décision.
    a.save(x=>{x.schoolInterviewSessions[id].used=true;});
    return decision(i,actor,current,s.action);
   }
   if(s.action!=='cr')throw Error('Formulaire invalide.');
   if(i.fields.getTextInputValue('candidate').trim()!==current.applicantId)throw Error('Ne modifie pas l’identifiant du candidat : le compte-rendu est lié à ce dossier.');
   const target=await i.guild.members.fetch(current.applicantId);
   if(!recentlyFinished(current,actor)&&(!officeIds().includes(actor.voice.channelId)||target.voice.channelId!==actor.voice.channelId))throw Error('Le candidat doit être présent, ou avoir terminé son entretien avec toi depuis moins de 24 h.');
   const ch=await i.guild.channels.fetch(REPORT);
   if(!ch||ch.permissionsFor(i.guild.roles.everyone)?.has(P.ViewChannel))throw Error('Le salon de comptes-rendus doit être privé.');
   await tick(i.guild);
   const timer=a.state().schoolInterviewTimers?.[current.caseId];
   const ms=timer?.totalMs||0;
   const report={caseId:current.caseId,candidateId:current.applicantId,actorId:actor.id,at:Date.now(),durationMs:ms,fields:Object.fromEntries(['presentation','decision','trial'].map(k=>[k,clean(i.fields.getTextInputValue(k))])),application:{...current}};
   a.save(x=>{x.schoolInterviewSessions[id].used=true;x.schoolInterviewReports||={};x.schoolInterviewReports[id]=report;});
   const message=await ch.send({embeds:[embed('📄 Compte-rendu de recrutement',`Candidat : <@${current.applicantId}>\nRecruteur : <@${actor.id}>\nDurée vocale observée : ${timer?`${Math.floor(ms/60000)} min ${Math.floor(ms/1000)%60} s`:'non mesurée'}\nStatut du dossier : ${current.status}\n\n**Présentation + Communication**\n${report.fields.presentation}\n\n**Date / décision déclarée**\n${report.fields.decision}\n\n**Période de test**\n${report.fields.trial}`).setTimestamp()],components:[row(button(`qgr:reportview:${id}`,'Voir candidature'))],allowedMentions:{parse:[]}});
   a.save(x=>{x.schoolInterviewReports[id].messageId=message.id;});
   return i.editReply('Compte-rendu transmis. Les champs du formulaire ne modifient aucun grade ni statut.');
  });
 });
 if(op==='reportview'){const report=a.state().schoolInterviewReports?.[id];if(!report)throw Error('Compte-rendu introuvable.');return view(i,report.application);}
 if(op==='ddssave')return a.serial('qgr-dds:'+id,async()=>{
  const request=a.state().schoolInterviewDds?.[id];if(!request||request.answer)throw Error('Demande déjà traitée.');
  const answer=clean(i.fields.getTextInputValue('answer'));
  a.save(s=>{Object.assign(s.schoolInterviewDds[id],{answer,answeredBy:i.user.id,answeredAt:Date.now()});});
  const user=await i.client.users.fetch(request.actorId);
  const sent=await user.send({embeds:[embed('Réponse Fondation • DDS',`Candidat : <@${request.candidateId}>\n${answer}`)],allowedMentions:{parse:[]}}).then(()=>true,()=>false);
  return i.editReply(`Réponse enregistrée.${sent?' Le recruteur a reçu la réponse en MP.':' MP fermé : préviens le recruteur par un canal privé.'}`);
 });
 return a.serial('qgr-case:'+id,async()=>{
  const app=requireApp(id);
  if(op==='view')return view(i,app);
  if(op==='ticket')return ticket(i,app);
  if(op==='written'){
   if(!['accept','refuse'].includes(extra)||!['submitted','in_review'].includes(app.status))throw Error('Candidature déjà traitée.');
   const token=session(i,app,'written'+extra);
   return i.editReply({embeds:[embed('Confirmer la décision',`${extra==='accept'?'Placer en attente d’entretien':'Refuser'} <@${app.applicantId}> ?`)],components:[row(button(`qgr:confirm:${token}`,'Confirmer',B.Primary))],allowedMentions:{parse:[]}});
  }
  if(op==='dds'){
   const existing=Object.entries(a.state().schoolInterviewDds||{}).find(([,x])=>x.caseId===id&&!x.answer);if(existing)return i.editReply('Une demande est déjà en attente auprès de la Fondation.');
   const ch=await i.guild.channels.fetch(channels().foundationRequests);if(!ch||ch.permissionsFor(i.guild.roles.everyone)?.has(P.ViewChannel))throw Error('Salon de requêtes Fondation privé indisponible.');
   const requestId=randomUUID().slice(0,12);
   a.save(s=>{s.schoolInterviewDds||={};s.schoolInterviewDds[requestId]={caseId:id,candidateId:app.applicantId,actorId:i.user.id,at:Date.now()};});
   const message=await ch.send({embeds:[embed('DDS • Recrutement QG',`Demandeur : <@${i.user.id}>\nCandidat : <@${app.applicantId}>\nMerci de communiquer au recruteur les éléments de sanctions pertinents. Cette demande n’applique aucune sanction.`)],components:[row(button(`qgr:ddsanswer:${requestId}`,'Répondre au recruteur'))],allowedMentions:{parse:[]}});
   a.save(s=>{s.schoolInterviewDds[requestId].messageId=message.id;});
   return i.editReply('Demande transmise à la Fondation.');
  }
  throw Error('Action non disponible.');
 });
}
// Durée observée uniquement : aucun temps hors ligne n’est reconstitué.
let lastTick=Date.now();
let observed=new Set();
async function tick(guild){
 const now=Date.now(),elapsed=Math.min(65000,Math.max(0,now-lastTick));lastTick=now;
 const present=new Set();
 for(const id of officeIds()){
  const ch=guild.channels.cache.get(id);if(!ch?.members?.some(m=>staff(m)))continue;
  for(const app of Object.values(a.state().schoolFamilyRecruitment||{}))if(app.caseId&&!app.interviewFinishedAt&&ch.members.has(app.applicantId)&&app.status==='waiting_interview')present.add(app.caseId);
 }
 a.save(s=>{s.schoolInterviewTimers||={};for(const id of observed){const t=s.schoolInterviewTimers[id]||{totalMs:0};t.totalMs+=elapsed;s.schoolInterviewTimers[id]=t;}for(const id of present){s.schoolInterviewTimers[id]||={totalMs:0};}});
 observed=present;
 for(const app of Object.values(a.state().schoolFamilyRecruitment||{})){
  if(app.caseId&&app.status==='submitted'&&!app.messageId)await submitApplication(guild,app);
 }
}
async function legacy(i){
 await authorize(i);
 return i.reply({content:'Ce bouton appartient à l’ancien parcours. Utilise /entretien installer puis le nouveau dossier ; aucune admission directe n’est exécutée.',flags:F.Ephemeral});
}
module.exports={data,execute,handle,install,submitApplication,tick,legacy};
