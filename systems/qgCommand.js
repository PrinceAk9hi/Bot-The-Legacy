// Centre de commandement du QG : statut du recrutement et du casino, effectif (direction, grades, sanctions),
// prochaine réunion, alerte d'urgence vocale, rassemblement, annonces et rapport d'activité.
const {randomUUID}=require('node:crypto');
const {ContainerBuilder,TextDisplayBuilder,SeparatorBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,ChannelSelectMenuBuilder,ChannelType:CT,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:T,EmbedBuilder,AttachmentBuilder,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),rp=require('./qgRpStatus'),grades=require('./qgGrades');
const CHANNEL='1565484861660069978',DAY=86400000;
const DIRECTION=[['creator','Créateur'],['globalManager','Gérant Global'],['administrator','Administrateur']];
const SANCTIONS=[['warning1','Avertissement 1'],['warning2','Avertissement 2'],['lastChance','Dernière Chance']];
const TEAMS={ticketsManagement:'Support',recruitmentManagement:'Recrutement',animationManagement:'Animation',networksManagement:'Réseaux',rpManagement:'RP'};
const pending=new Map();
const text=s=>new TextDisplayBuilder().setContent(s);
const row=(...x)=>new Row().addComponents(...x);
const btn=(id,label,style=S.Secondary,disabled=false)=>new Button().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
const ts=(at,f='R')=>`<t:${Math.floor(at/1000)}:${f}>`;
const mentions=(list,max=12)=>list.length?list.slice(0,max).map(m=>`<@${m.id}>`).join(', ')+(list.length>max?` +${list.length-max}`:''):'—';

// ---- Données ----
async function roster(guild){
 const members=[...(await require('../utils/qgMembers')(guild)).values()].filter(m=>!m.user.bot),r=a.state().schoolRoles||{};
 const holders=key=>r[key]?members.filter(m=>m.roles.cache.has(r[key])):[];
 return {
  direction:DIRECTION.map(([key,label])=>[label,holders(key)]),
  grades:grades.ranks.map((key,n)=>[grades.names[n],holders(key)]).reverse(),
  sanctions:[...SANCTIONS.map(([key,label])=>[label,holders(key)]),['Prison',members.filter(m=>rp.status(m.id).prison)]],
  teams:Object.entries(TEAMS).map(([key,label])=>[label,holders(key),holders(a.teams[key])])
 };
}
function snapshot(guild){
 const s=a.state(),recruit=require('./qgRecruitmentControl').status().open,casino=s.schoolCasino?.enabled!==false;
 const voice=[...guild.voiceStates.cache.values()].filter(v=>v.channelId&&!v.member?.user.bot);
 const apps=Object.values(s.schoolFamilyRecruitment||{});
 const meeting=Object.values(s.schoolMeetings||{}).filter(m=>m.start>Date.now()&&!['cancelled','finished'].includes(m.status)).sort((x,y)=>x.start-y.start)[0];
 return {recruit,casino,voice:voice.length,rooms:new Set(voice.map(v=>v.channelId)).size,tickets:Object.keys(s.tickets||{}).length,toReview:apps.filter(x=>['submitted','in_review'].includes(x.status)).length,inProgress:apps.filter(x=>x.status==='in_progress').length,meeting,alert:require('./qgEmergency').status()};
}

// ---- Panneau ----
async function panel(guild){
 const s=snapshot(guild),r=await roster(guild),alert=s.alert;
 const total=r.grades.reduce((n,[,list])=>n+list.length,0);
 const head=`## 🛡️ Centre de commandement · QG\n-# Mis à jour ${ts(Date.now())} · réservé à l’équipe, chaque action est journalisée`;
 const status=`${s.recruit?'🟢':'🔴'} **Recrutement ${s.recruit?'ouvert':'fermé'}** · ${s.casino?'🟢':'🔴'} **Casino ${s.casino?'ouvert':'suspendu'}**\n🔊 **${s.voice}** en vocal (${s.rooms} salon${s.rooms>1?'s':''}) · 🎫 **${s.tickets}** ticket${s.tickets>1?'s':''} · 📋 **${s.toReview}** dossier${s.toReview>1?'s':''} à traiter · ✍️ ${s.inProgress} en cours\n📅 ${s.meeting?`Prochaine réunion : **${s.meeting.name}** ${ts(s.meeting.start,'F')} (${ts(s.meeting.start)})`:'Aucune réunion programmée'}`+
  (alert.active?`\n\n🚨 **ALERTE EN COURS** · lancée par <@${alert.actorId}> ${ts(alert.startedAt)} · ${alert.phase} ${alert.done}/${alert.total} salons`:alert.last?`\n-# Dernière alerte ${ts(alert.last.startedAt)} par <@${alert.last.actorId}> · ${alert.last.results.filter(([,x])=>x==='diffusée').length}/${alert.last.results.length} salons`:'');
 const direction='### 👑 Direction\n'+r.direction.map(([label,list])=>`**${label}** · ${mentions(list,6)}`).join('\n');
 const family=`### 🎖️ Effectif famille · ${total} membre${total>1?'s':''}\n`+r.grades.map(([label,list])=>`**${label}** (${list.length}) · ${mentions(list)}`).join('\n');
 const sanctions='### ⚠️ Sanctions et statuts\n'+r.sanctions.map(([label,list])=>`**${label}** (${list.length}) · ${mentions(list,8)}`).join('\n');
 const box=new ContainerBuilder().setAccentColor(alert.active?0xd62f2f:0xffffff)
  .addTextDisplayComponents(text(head),text(status)).addSeparatorComponents(new SeparatorBuilder())
  .addTextDisplayComponents(text(direction),text(family),text(sanctions)).addSeparatorComponents(new SeparatorBuilder())
  .addTextDisplayComponents(text('### 🎛️ Pilotage'))
  .addActionRowComponents(
   row(btn('qgcmd:recruit',s.recruit?'🔴 Fermer le recrutement':'🟢 Ouvrir le recrutement',s.recruit?S.Danger:S.Success),btn('qgcmd:casino',s.casino?'🎰 Suspendre le casino':'🎰 Ouvrir le casino',s.casino?S.Secondary:S.Success),btn('qgm:new','📅 Programmer une réunion',S.Primary)),
   row(btn('qgcmd:roster','👥 Effectif détaillé'),btn('qgcmd:report','📊 Rapport d’activité'),btn('qgcmd:announce:family','📣 Annonce famille'),btn('qgcmd:announce:public','📢 Annonce publique')))
  .addTextDisplayComponents(text('### 🚨 Urgence'))
  .addActionRowComponents(row(btn('qgcmd:alert','🚨 Alerte urgence',S.Danger,alert.active),btn('qgcmd:gather','📥 Rassembler les vocaux',S.Primary),btn('qgcmd:stop','⏹️ Arrêter l’alerte',S.Secondary,!alert.active),btn('qgcmd:refresh','🔄 Actualiser')));
 return {flags:F.IsComponentsV2,components:[box],allowedMentions:{parse:[]}};
}
function signature(guild,r){const s=snapshot(guild);return JSON.stringify([s.recruit,s.casino,s.voice,s.rooms,s.tickets,s.toReview,s.inProgress,s.meeting?.id,s.alert.active,s.alert.done,s.alert.last?.startedAt,r&&Object.values(r).map(g=>g.map(([l,x,y])=>[l,x.map(m=>m.id),y?.map(m=>m.id)]))]);}
async function publish(guild){return a.serial('qg-command-panel',async()=>{
 if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');
 const ch=await guild.channels.fetch(CHANNEL).catch(e=>{if(e.code===10003)return null;throw e;});
 if(!ch?.isTextBased?.()||ch.guildId!==guild.id)throw Error('Salon du centre de commandement introuvable.');
 const saved=a.state().schoolCommandPanel;
 let message=saved?.channelId===ch.id?await ch.messages.fetch(saved.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!message){const recent=await ch.messages.fetch({limit:50});message=recent.find(m=>m.author.id===guild.client.user.id&&JSON.stringify(m.components.map(c=>c.toJSON?.()??c)).includes('qgcmd:alert'));}
 const next=await panel(guild),sig=signature(guild,await roster(guild));
 if(message)await message.edit(next);else message=await ch.send(next);
 a.save(s=>{s.schoolCommandPanel={channelId:ch.id,messageId:message.id,signature:sig};});
 return {detail:'Centre de commandement publié'};
});}
async function tick(guild){if(signature(guild,await roster(guild))!==a.state().schoolCommandPanel?.signature)await publish(guild);}

// ---- Vues privées ----
function rosterEmbed(r){
 const e=new EmbedBuilder().setColor(0xffffff).setTitle('👥  Effectif détaillé du QG').setFooter(require('../utils/qgBrand').footer());
 const all=list=>list.length?list.map(m=>`<@${m.id}>`).join(', ').slice(0,1000):'—';
 for(const [label,list] of r.direction)e.addFields({name:`👑 ${label} (${list.length})`,value:all(list),inline:true});
 for(const [label,list] of r.grades)e.addFields({name:`🎖️ ${label} (${list.length})`,value:all(list)});
 for(const [label,members,leads] of r.teams)e.addFields({name:`🛡️ Gestion ${label} (${members.length})`,value:`Responsable : ${all(leads)}\nÉquipe : ${all(members)}`.slice(0,1024),inline:true});
 for(const [label,list] of r.sanctions)e.addFields({name:`⚠️ ${label} (${list.length})`,value:all(list),inline:true});
 return e;
}
function csv(r){const rows=[['categorie','groupe','id','nom']];const add=(cat,label,list)=>list.forEach(m=>rows.push([cat,label,m.id,m.displayName]));r.direction.forEach(([l,x])=>add('Direction',l,x));r.grades.forEach(([l,x])=>add('Grade',l,x));r.teams.forEach(([l,x,y])=>{add('Gestion',l,x);add('Responsable',l,y);});r.sanctions.forEach(([l,x])=>add('Sanction',l,x));return rows.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');}
async function report(guild,now=Date.now()){
 const metrics=require('./qgMemberMetrics'),rows=a.state().schoolDailyActivity||{};
 const range=(from,to)=>{const lo=metrics.day(from),hi=metrics.day(to);let messages=0,voice=0;const per={};for(const [id,days] of Object.entries(rows))for(const [d,v] of Object.entries(days))if(d>lo&&d<=hi){messages+=v.messages;voice+=v.voiceMs;(per[id]||={m:0,v:0}).m+=v.messages;per[id].v+=v.voiceMs;}return {messages,voice,per};};
 const week=range(now-7*DAY,now),prev=range(now-14*DAY,now-7*DAY);
 const trend=(x,y)=>!y?'':x>=y?` · ↗️ +${Math.round((x-y)/y*100)} %`:` · ↘️ ${Math.round((x-y)/y*100)} %`;
 const members=[...(await require('../utils/qgMembers')(guild)).values()].filter(m=>!m.user.bot);
 const arrivals=members.filter(m=>m.joinedTimestamp>now-7*DAY);
 const active=Object.values(week.per).filter(x=>x.m||x.v).length;
 const top=Object.entries(week.per).sort((x,y)=>(y[1].m+y[1].v/60000)-(x[1].m+x[1].v/60000)).slice(0,5);
 return new EmbedBuilder().setColor(0xffffff).setTitle('📊  Rapport d’activité · 7 derniers jours').setFooter(require('../utils/qgBrand').footer()).addFields(
  {name:'💬 Messages',value:`**${week.messages.toLocaleString('fr-FR')}**${trend(week.messages,prev.messages)}`,inline:true},
  {name:'🔊 Vocal',value:`**${Math.round(week.voice/3600000).toLocaleString('fr-FR')} h**${trend(week.voice,prev.voice)}`,inline:true},
  {name:'🙋 Membres actifs',value:`**${active}** sur ${members.length}`,inline:true},
  {name:'👋 Arrivées',value:arrivals.length?`**${arrivals.length}** · ${mentions(arrivals,10)}`:'Aucune'},
  {name:'🏆 Les plus actifs',value:top.map(([id,x],n)=>`${['🥇','🥈','🥉','4.','5.'][n]} <@${id}> · ${x.m} messages · ${Math.round(x.v/60000)} min de vocal`).join('\n')||'Pas encore de données.'});
}

// ---- Interactions ----
function form(id,title,fields){return new Modal().setCustomId(id).setTitle(title).addComponents(...fields.map(([key,label,style=T.Short,required=true,value,max=100])=>{const input=new Input().setCustomId(key).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);if(value)input.setValue(value);return row(input);}));}
async function handle(i){
 if(i.guildId!==config.guildId)throw Error('Serveur QG incorrect.');
 const member=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.can(member,'view'))throw Error('Centre de commandement réservé à l’équipe du QG.');
 const [,op,arg]=i.customId.split(':'),direction=a.isDirection(member);
 const need=(ok,who='la direction')=>{if(!ok)throw Error('Action réservée à '+who+'.');};
 const refresh=()=>publish(i.guild).catch(e=>console.error('Centre de commandement :',e.code||e.message));
 const field=k=>{try{return i.fields.getTextInputValue(k).trim();}catch{return '';}};

 // Formulaires
 if(op==='alert'&&i.isButton()){need(direction);return i.showModal(form('qgcmd:alertf','🚨 Alerte d’urgence',[['message','Message à lire (vide = message par défaut)',T.Paragraph,false,null,400]]));}
 if(op==='announce'&&i.isButton()){need(direction);return i.showModal(form('qgcmd:announcef:'+arg,arg==='public'?'📢 Annonce publique':'📣 Annonce famille',[['title','Titre'],['message','Message',T.Paragraph,true,null,1800],...(arg==='public'?[['ping','Mentionner Notifs Annonces ? (oui / non)',T.Short,false,'non',3]]:[])]));}

 if(op==='refresh'){await i.deferUpdate();await publish(i.guild);return;}
 if(op==='alertno'){pending.delete(arg);return i.update({content:'Alerte annulée.',components:[],embeds:[]});}
 if(op==='gatherto'){need(direction);await i.deferUpdate();const r=await require('./qgEmergency').gather(i.guild,i.values[0],i.user.id);refresh();return i.editReply({content:`📥 **${r.moved}** membre(s) déplacé(s) vers <#${r.target}>.${r.failed?` ⚠️ ${r.failed} échec(s) (permissions ou déconnexion).`:''}`,components:[],allowedMentions:{parse:[]}});}
 if(op==='alertgo'){
  need(direction);const p=pending.get(arg);pending.delete(arg);
  if(!p||p.actorId!==i.user.id||p.expires<Date.now())throw Error('Confirmation expirée : relance l’alerte.');
  await i.deferUpdate();
  const r=await require('./qgEmergency').start(i.guild,{text:p.text,actorId:i.user.id},refresh);refresh();
  return i.editReply({content:`🚨 **Alerte lancée** dans ${r.total} salon(s) vocal(aux). Le bot passe de salon en salon ; suis l’avancement sur le centre de commandement.`,components:[],allowedMentions:{parse:[]}});
 }

 await i.deferReply({flags:F.Ephemeral});
 if(op==='recruit'){
  need(a.can(member,'cd'),'la direction et au responsable recrutement');
  const open=!require('./qgRecruitmentControl').status().open,res=await require('./qgRecruitmentControl').change(i.guild,i.user.id,open);await refresh();
  return i.editReply(`${open?'🟢 Recrutement ouvert':'🔴 Recrutement fermé'}.${res.refreshed?' Le panneau des candidatures et sa bannière sont à jour.':' ⚠️ Le panneau des candidatures n’a pas pu être actualisé.'}`);
 }
 if(op==='casino'){
  need(require('../utils/qgCasinoAccess').manager(member),'la direction et au responsable du casino');
  const open=await require('./qgCasinoAdmin').setOpen(i.guild,i.user.id,a.state().schoolCasino?.enabled===false);await refresh();
  return i.editReply(open?'🟢 Casino ouvert aux nouvelles mises.':'🔴 Nouvelles mises suspendues. Les parties en cours restent jouables.');
 }
 if(op==='roster'){const r=await roster(i.guild);return i.editReply({embeds:[rosterEmbed(r)],files:[new AttachmentBuilder(Buffer.from('﻿'+csv(r),'utf8'),{name:'effectif-qg.csv'})],allowedMentions:{parse:[]}});}
 if(op==='report')return i.editReply({embeds:[await report(i.guild)],allowedMentions:{parse:[]}});
 if(op==='stop'){need(direction);return i.editReply(require('./qgEmergency').stop()?'⏹️ Alerte arrêtée : le bot termine le salon en cours puis s’arrête.':'Aucune alerte en cours.');}
 if(op==='gather'){need(direction);return i.editReply({content:'📥 **Rassemblement** · choisis le salon vocal où déplacer tous les membres actuellement en vocal.',components:[row(new ChannelSelectMenuBuilder().setCustomId('qgcmd:gatherto').setPlaceholder('Salon de rassemblement…').setChannelTypes(CT.GuildVoice,CT.GuildStageVoice).setMinValues(1).setMaxValues(1))]});}
 if(op==='alertf'){
  need(direction);const msg=field('message')||require('../utils/qgAlertAudio').DEFAULT,list=require('./qgEmergency').rooms(i.guild);
  if(!list.length)throw Error('Aucun salon vocal occupé : personne à alerter.');
  const token=randomUUID().slice(0,8);pending.set(token,{actorId:i.user.id,text:msg,expires:Date.now()+120000});
  return i.editReply({content:`🚨 **Confirmer l’alerte d’urgence ?**\nLe bot va passer dans **${list.length}** salon(s) vocal(aux) occupé(s) : ${list.map(c=>`<#${c.id}>`).join(', ').slice(0,900)}\nIl diffusera une sirène puis le message, et laissera une alerte écrite dans chaque salon. L’accueil vocal du recrutement est mis en pause pendant l’alerte.\n\n> ${msg}`,components:[row(btn('qgcmd:alertgo:'+token,'🚨 Lancer l’alerte',S.Danger),btn('qgcmd:alertno:'+token,'Annuler'))],allowedMentions:{parse:[]}});
 }
 if(op==='announcef'){
  need(direction);const key=arg==='public'?'announcements':'familyAnnouncements',id=a.state().schoolChannels?.[key];
  const ch=id&&await i.guild.channels.fetch(id).catch(()=>null);if(!ch?.isTextBased?.())throw Error('Salon d’annonces introuvable.');
  const role=arg==='public'&&/^o/i.test(field('ping'))?a.state().schoolRoles?.notifAnnouncements:null;
  const sent=await ch.send({content:role?`<@&${role}>`:null,embeds:[new EmbedBuilder().setColor(0xffffff).setTitle(field('title').slice(0,250)).setDescription(field('message')).setFooter(require('../utils/qgBrand').footer()).setTimestamp()],allowedMentions:{parse:[],roles:role?[role]:[]}});
  await a.audit(i.guild,{action:'annonce.'+arg,actorId:i.user.id,after:{salon:ch.id,message:sent.id},reason:field('title')}).catch(()=>{});
  return i.editReply(`✅ Annonce publiée : ${sent.url}`);
 }
 throw Error('Action inconnue.');
}
module.exports={CHANNEL,panel,publish,tick,handle,roster,snapshot,report,csv};
