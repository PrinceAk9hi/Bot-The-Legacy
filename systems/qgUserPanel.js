const {randomUUID,createHash}=require('node:crypto');
const {SlashCommandBuilder,MessageFlags:F,ActionRowBuilder:Row,StringSelectMenuBuilder:Menu,ButtonBuilder:Button,ButtonStyle:Style,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:Text}=require('discord.js');
const a=require('../utils/qgAdmin'),rp=require('./qgRpStatus'),config=require('../config/qg');
const {read}=require('../utils/recruitmentData');
const {embed}=require('./qgPanels');
const clean=require('../utils/qgAiKnowledge').clean;
const ranks=['test','confirmed','expert','prestigious','senior'];
const rankNames=['Membre Test','Membre Confirmé','Membre Expert','Membre Prestigieux','Membre Senior'];
const teamNames={ticketsManagement:'Gestion Support',recruitmentManagement:'Gestion Recrutement',animationManagement:'Gestion Animation',networksManagement:'Gestion Réseaux',rpManagement:'Gestion RP'};
const labels={rankup:'📈 Rankup',derank:'📉 Derank',demote:'⬇️ Rétrograder',prison:'🔒 Prison',release:'🔓 Libérer de prison',handcuffs:'⛓️ Menotter',unhandcuffs:'🔗 Déménotter',dog:'🐕 Chien RP',undog:'🐾 Libérer du statut chien',management:'🛡️ Gestion',stats:'📊 Statistiques',applications:'📋 Candidatures'};
const data=new SlashCommandBuilder().setName('user').setDescription('Administrer un membre du QG').setDMPermission(false).addUserOption(o=>o.setName('membre').setDescription('Membre concerné').setRequired(true));
const roles=()=>a.state().schoolRoles||{};
function rank(member){const r=roles(),held=ranks.filter(k=>r[k]&&member.roles.cache.has(r[k]));if(held.length>1)throw Error('Plusieurs grades familiaux détectés : corrige les rôles avant de poursuivre.');return held[0]||null;}
const heldNames=(m,keys)=>keys.filter(k=>roles()[k]&&m.roles.cache.has(roles()[k])).map(k=>m.guild.roles.cache.get(roles()[k])?.name||k).join(', ')||'Aucun';
const time=ms=>ms?`<t:${Math.floor(ms/1000)}:f>`:'Non disponible';
function familyAccess(actor){return a.isDirection(actor)||a.has(actor,['recruitmentLead','recruitmentManagement']);}
function applications(actor,target){
 const s=a.state(),out=[];
 if(familyAccess(actor)&&s.schoolFamilyRecruitment?.[target.id])out.push({type:'Famille',...s.schoolFamilyRecruitment[target.id]});
 for(const [team,app] of Object.entries(s.schoolManagementApplications?.[target.id]||{}))if(a.isDirection(actor)||a.has(actor,[team,a.teams[team]].filter(Boolean)))out.push({type:teamNames[team]||'Gestion',...app});
 return out;
}
function profile(actor,member,id){return require('./qgUserView').render(actor,member,id);}
function fingerprint(member){return createHash('sha256').update(JSON.stringify({roles:[...member.roles.cache.keys()].sort(),rp:rp.status(member.id)})).digest('hex');}
function session(i,id){const s=a.state().schoolUserSessions?.[id];if(!s||s.actorId!==i.user.id||s.guildId!==i.guildId||s.expiresAt<Date.now())throw Error('Panel expiré ou réservé à son auteur. Relance /user.');return s;}
async function details(i,id){const s=session(i,id),actor=await a.actor(i),member=await i.guild.members.fetch({user:s.targetId,force:true});return{s,actor,member};}
function setPending(id,value){a.save(s=>{s.schoolUserSessions[id].pending=value;});}
function lowerOptions(member){const current=rank(member),index=ranks.indexOf(current);return ranks.slice(0,Math.max(0,index)).map((value,n)=>({value,label:rankNames[n]}));}
function plan(actor,member,action,choice,reason='',minutes=0){
 const r=roles(),before=rank(member);let remove=[],add=[],kind=null,permission=action,team;
 if(['rankup','derank','demote'].includes(action)){
  if(!before)throw Error('Aucun grade familial actuel.');
  const at=ranks.indexOf(before),to=action==='rankup'?at+1:action==='derank'?at-1:ranks.indexOf(choice);
  if(to<0||to>=ranks.length||action==='demote'&&to>=at)throw Error('Le grade demandé n’est pas une progression autorisée.');
  remove=[r[before]];add=[r[ranks[to]]];choice=ranks[to];
 }else if(action==='management'||action==='responsibility'){
  const [operation,key]=String(choice).split('.');team=key;
  if(!a.teams[team]||!['add','remove'].includes(operation))throw Error('Gestion ou action invalide.');
  const roleId=r[action==='management'?team:a.teams[team]];
  if(!roleId)throw Error('Rôle de gestion non configuré.');
  if(operation==='add'&&member.roles.cache.has(roleId)||operation==='remove'&&!member.roles.cache.has(roleId))throw Error('Ce changement est déjà appliqué.');
  if(operation==='add'&&!before)throw Error('Le membre doit déjà posséder un grade familial.');
  if(operation==='add')add=[roleId];else remove=[roleId];
 }else {kind={prison:'prison',release:'prison',handcuffs:'handcuffs',unhandcuffs:'handcuffs',dog:'dog',undog:'dog'}[action];if(!kind)throw Error('Action inconnue.');}
 if(!a.can(actor,permission,team))throw Error('Action réservée à une autorité supérieure ou au responsable concerné.');
 if(['demote','prison','handcuffs','dog'].includes(action)&&!reason.trim())throw Error('Un motif est requis.');
 if(!Number.isInteger(minutes)||minutes<0||minutes>525600)throw Error('Durée invalide : 0 ou 1 à 525600 minutes.');
 if([...add,...remove].some(id=>!id||!member.guild.roles.cache.has(id)))throw Error('Grade ou rôle QG introuvable.');
 return{action,choice,reason:clean(reason).slice(0,800),minutes,add,remove,kind};
}
async function prepare(i,id,action,choice,reason='',minutes=0){
 const {actor,member}=await details(i,id),p=plan(actor,member,action,choice,reason,minutes),bot=await i.guild.members.fetchMe();
 a.hierarchy(actor,member,bot,[...p.add,...p.remove].map(id=>i.guild.roles.cache.get(id)));
 const nonce=randomUUID();setPending(id,{...p,nonce,fingerprint:fingerprint(member)});
 return i.editReply({embeds:[embed('Confirmer • '+(labels[action]||'Responsabilité'),`Membre : <@${member.id}>\n${choice?'Choix : '+choice+'\n':''}${reason?'Motif : '+clean(reason)+'\n':''}${action==='prison'?'Écriture et vocal seront bloqués. Aucun bannissement.\n':''}${action==='dog'?'Statut de jeu de rôle uniquement : aucun harcèlement ni humiliation réelle.\n':''}${minutes?'Durée : '+minutes+' minutes\n':''}Confirme cette modification.`)],components:[new Row().addComponents(new Button().setCustomId(`qgu:confirm:${id}:${nonce}`).setLabel('Confirmer').setStyle(Style.Danger),new Button().setCustomId(`qgu:cancel:${id}`).setLabel('Annuler').setStyle(Style.Secondary))],allowedMentions:{parse:[]}});
}
async function changeRoles(member,p){
 // Only explicitly selected roles are changed; unrelated roles are never overwritten.
 const added=[];
 try{for(const id of p.add){await member.roles.add(id,'Administration QG : '+p.action);added.push(id);}for(const id of p.remove)await member.roles.remove(id,'Administration QG : '+p.action);}
 catch(e){for(const id of added)await member.roles.remove(id,'Annulation du changement incomplet').catch(()=>{});throw Error('Changement de rôles interrompu. Vérifie les rôles actuels avant de réessayer.');}
}
async function confirm(i,id,nonce){return a.serial('member:'+session(i,id).targetId,async()=>{
 const {s,actor,member}=await details(i,id),p=s.pending;
 if(!p||p.nonce!==nonce)throw Error('Confirmation déjà utilisée ou remplacée.');
 if(p.fingerprint!==fingerprint(member))throw Error('Le membre ou ses rôles ont changé. Relance le panel pour confirmer son état actuel.');
 const checked=plan(actor,member,p.action,p.choice,p.reason,p.minutes),bot=await i.guild.members.fetchMe();
 a.hierarchy(actor,member,bot,[...checked.add,...checked.remove].map(id=>i.guild.roles.cache.get(id)));
 if(!checked.kind){
  const separators=require('./qgSchoolSeparators'),projected=new Map(member.roles.cache);
  for(const id of checked.remove)projected.delete(id);for(const id of checked.add)projected.set(id,i.guild.roles.cache.get(id));
  const separatorIds=new Set([...separators.desiredSeparatorIds(member),...separators.desiredSeparatorIds({...member,roles:{cache:projected}})]);
  const separatorRoles=[...separatorIds].map(id=>i.guild.roles.cache.get(id));
  if(separatorRoles.some(role=>!role||role.permissions.bitfield!==0n))throw Error('Un séparateur est absent ou possède des permissions sensibles.');
  a.hierarchy(actor,member,bot,separatorRoles);
 }
 if(checked.action==='management'&&checked.add.length){
  const team=checked.choice.split('.')[1],lead=roles()[a.teams[team]];const members=await i.guild.members.fetch();
  if(!member.roles.cache.has(lead)&&[...members.values()].filter(m=>!m.user.bot&&m.roles.cache.has(checked.add[0])&&!m.roles.cache.has(lead)).length>=2)throw Error('Cette gestion compte déjà deux membres hors responsable.');
 }
 if(checked.kind&&['release','unhandcuffs','undog'].includes(p.action)){const rec=rp.status(member.id)[checked.kind];if(rec)a.hierarchy(actor,member,bot,[await i.guild.roles.fetch(rec.roleId)]);}
 setPending(id,null);const before={roles:[...member.roles.cache.keys()],rp:Object.keys(rp.status(member.id))};let result='success',error=null,separatorError=false;
 try{
  if(checked.kind){if(['release','unhandcuffs','undog'].includes(p.action))await rp.release(member,checked.kind);else await rp.apply(member,checked.kind,actor,p.reason,p.minutes);}
  else {
   await changeRoles(member,checked);
   const fresh=await i.guild.members.fetch({user:member.id,force:true});
   try{await require('./qgSchoolSeparators').syncMember(fresh);}catch{separatorError=true;}
  }
 }catch(e){result='failed';error=e;}
 const fresh=await i.guild.members.fetch({user:member.id,force:true}).catch(()=>member);
 const logged=await a.audit(i.guild,{action:p.action,actorId:actor.id,targetId:member.id,before,after:{roles:[...fresh.roles.cache.keys()],rp:Object.keys(rp.status(member.id))},reason:p.reason,result});
 if(error)throw error;
 return i.editReply({content:`Action appliquée.${separatorError?' La synchronisation des séparateurs a échoué : vérifie leurs permissions.':''}${!logged?' Journal Discord indisponible ; historique local enregistré.':''}`,components:[],embeds:[],allowedMentions:{parse:[]}});
});}
function modal(id,action,title){return new Modal().setCustomId(`qgu:form:${id}:${action}`).setTitle(title).addComponents(new Row().addComponents(new Input().setCustomId('reason').setLabel('Motif').setStyle(Text.Paragraph).setMaxLength(800).setRequired(true)),...(action==='prison'?[new Row().addComponents(new Input().setCustomId('minutes').setLabel('Durée en minutes, vide = sans échéance').setStyle(Text.Short).setMaxLength(6).setRequired(false))]:[]));}
async function stats(i,id){const {actor,member}=await details(i,id),s=a.state(),xp=read('qgXp')[member.id],history=(s.schoolAdminHistory||[]).filter(e=>e.targetId===member.id);
 return i.editReply({embeds:[embed('Statistiques • '+clean(member.displayName),`Compte créé : ${time(member.user.createdTimestamp)}\nArrivée QG : ${time(member.joinedTimestamp)}\nGrade : ${heldNames(member,ranks)}\nGestion : ${heldNames(member,Object.keys(a.teams))}\nDossiers accessibles conservés : ${applications(actor,member).length}\nPromotions /user réussies conservées : ${history.filter(e=>e.action==='rankup'&&e.result==='success').length}\nNiveau communautaire : ${xp?require('./qgLevels').level(xp.xp):'non mesuré'}\nXP : ${xp?.xp??'non mesuré'}\nActivité observée sur 7 jours calendaires : ${require("./qgMemberMetrics").week(member.id).messages} messages, ${Math.floor(require("./qgMemberMetrics").week(member.id).voiceMs/60000)} minutes vocales.\nInvité par : ${require("./qgInvites").description(member.id)}\nTickets actuellement conservés : ${Object.values(s.tickets||{}).filter(t=>t.ownerId===member.id).length}\n\n**Historique administratif**\n${a.isDirection(actor)?history.slice(-8).reverse().map(e=>`${time(e.at)} • ${e.action} • ${e.result} • <@${e.actorId}>`).join('\n')||'Aucune action.':'Réservé à la direction.'}`)],allowedMentions:{parse:[]}});
}
async function showApplications(i,id){const {actor,member}=await details(i,id),apps=applications(actor,member);const rows=[];
 for(const app of apps){if(!app.channelId)continue;const ch=await i.guild.channels.fetch(app.channelId).catch(()=>null);if(ch?.guildId===i.guildId&&ch.permissionsFor(actor)?.has(['ViewChannel','ReadMessageHistory']))rows.push(new Button().setLabel('Dossier '+app.type).setStyle(Style.Link).setURL(`https://discord.com/channels/${i.guildId}/${ch.id}`));}
 return i.editReply({embeds:[embed('Candidatures accessibles • QG',apps.map(app=>`**${app.type}**\nStatut : ${app.status}\nCréée : ${time(app.createdAt)}\nDernière décision : ${time(app.updatedAt)}\nResponsable : ${app.updatedBy?`<@${app.updatedBy}>`:'non enregistré'}`).join('\n\n')||'Aucun dossier auquel tu as accès.')],components:rows.length?[new Row().addComponents(...rows.slice(0,5))]:[],allowedMentions:{parse:[]}});
}
async function execute(i){await i.deferReply({flags:F.Ephemeral});try{
 const actor=await a.actor(i),user=i.options.getUser('membre',true),member=await i.guild.members.fetch(user.id),id=randomUUID();
 a.save(s=>{s.schoolUserSessions||={};for(const [key,v] of Object.entries(s.schoolUserSessions))if(v.expiresAt<Date.now())delete s.schoolUserSessions[key];s.schoolUserSessions[id]={actorId:actor.id,targetId:member.id,guildId:i.guildId,expiresAt:Date.now()+600000};});
 return i.editReply(profile(actor,member,id));
 }catch(e){return i.editReply({content:e.code?'Membre introuvable ou permissions insuffisantes.':clean(e.message),allowedMentions:{parse:[]}});}}
async function handle(i){try{
 let [,op,id,choice]=i.customId.split(':'); const {actor,member}=await details(i,id);
 if(['tool','toolform','toolconfirm'].includes(op))return await require('./qgUserTools').handle(i,id,choice,op==='toolconfirm'?'confirm':op==='toolform'?'form':'open');
 if(op==='action'&&choice==='sanctions')return await require('./qgSanctionPanel').execute(i,member.id);
 if(op==='action'&&choice==='validate'){if(rank(member)!=='test')throw Error('La validation concerne uniquement un Membre Test.');i.values=['rankup'];op='select';}
 if(op==='tab'){if(!['profile','voice','management'].includes(choice))throw Error('Onglet invalide.');return await i.update(require('./qgUserView').render(actor,member,id,choice));}
 if(['voice','voiceconfirm','voicecancel'].includes(op)){await i.deferReply({flags:F.Ephemeral});if(op==='voicecancel'){a.save(s=>{delete s.schoolUserSessions[id].voicePending;});return i.editReply('Action annulée.');}return await require('./qgUserVoice').handle(i,id,op==='voiceconfirm'?'confirm':choice,details,op==='voiceconfirm'?choice:null);}
 if(op==='action'){i.values=[choice];op='select';}
 if(op==='select'&&['prison','handcuffs','dog'].includes(i.values[0])){if(!a.can(actor,i.values[0]))throw Error('Action non autorisée.');return i.showModal(modal(id,i.values[0],labels[i.values[0]]));}
 if(op==='demote'){plan(actor,member,'demote',i.values[0],'confirmation à venir');return i.showModal(modal(id,'demote.'+i.values[0],'Motif de rétrogradation'));}
 await i.deferReply({flags:F.Ephemeral});
 if(op==='cancel'){setPending(id,null);return i.editReply('Action annulée.');}
 if(op==='confirm')return await confirm(i,id,choice);
 if(op==='form'){
  const [action,to]=choice.split('.'),reason=i.fields.getTextInputValue('reason').trim(),minutes=action==='prison'?Number(i.fields.getTextInputValue('minutes').trim()||0):0;return await prepare(i,id,action,to,reason,minutes);
 }
 if(op==='manage'){
  const [action,...parts]=i.values[0].split(':');return await prepare(i,id,action,parts.join(':'),'Gestion des équipes QG');
 }
 if(op!=='select')throw Error('Interaction inconnue.');const action=i.values[0];
 if(action==='stats')return await stats(i,id);
 if(action==='applications')return await showApplications(i,id);
 if(action==='demote'){
  if(!a.can(actor,'demote'))throw Error('Rétrogradation réservée à la direction.');const opts=lowerOptions(member);if(!opts.length)throw Error('Aucun grade inférieur disponible.');
  return i.editReply({content:'Choisis le grade inférieur.',components:[new Row().addComponents(new Menu().setCustomId('qgu:demote:'+id).setPlaceholder('Grade cible').addOptions(opts))]});
 }
 if(action==='management'){
  const options=[];
  for(const [team,lead] of Object.entries(a.teams)){
   if(a.can(actor,'management',team))for(const op of ['add','remove'])options.push({label:`${op==='add'?'Ajouter':'Retirer'} • ${teamNames[team]}`,value:`management:${op}.${team}`});
   if(a.can(actor,'responsibility'))for(const op of ['add','remove'])options.push({label:`${op==='add'?'Nommer':'Retirer'} responsable • ${teamNames[team]}`,value:`responsibility:${op}.${team}`});
  }
  if(!options.length)throw Error('Aucune gestion modifiable par ton compte.');
  return i.editReply({content:'Gestion des équipes du membre sélectionné.',components:[new Row().addComponents(new Menu().setCustomId('qgu:manage:'+id).setPlaceholder('Choisir une modification').addOptions(options))]});
 }
 return await prepare(i,id,action,null,'Administration du membre');
 }catch(e){const payload={content:e.code?'Action non terminée : vérifie les permissions et l’état du membre.':clean(e.message).slice(0,1700),allowedMentions:{parse:[]}};if(i.deferred||i.replied)return i.editReply(payload).catch(()=>{});return i.reply({...payload,flags:F.Ephemeral}).catch(()=>{});}}
module.exports={data,execute,handle,plan,rank,lowerOptions,applications,profile,stats,session,confirm,changeRoles,fingerprint};
