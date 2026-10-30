// Espace Fondation du centre de commandement : tableau de bord, dossiers membres, supervision
// des gestions, centre disciplinaire, votes de la direction, activité et journal confidentiel.
// Vues privées (éphémères) réservées à la direction ; chaque action est journalisée.
const {randomUUID}=require('node:crypto');
const {EmbedBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,StringSelectMenuBuilder:Select,UserSelectMenuBuilder:UserSelect,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:T,AttachmentBuilder,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),log=require('../utils/qgLog');
const DAY=86400000,GOLD=0xd4bd86;
const SECTIONS=[['dash','📊','Tableau de bord'],['members','👤','Membres'],['teams','🧭','Gestions'],['discipline','⚖️','Discipline'],['decisions','🗳️','Décisions'],['activity','📈','Activité'],['journal','🔒','Journal']];
const DECISION_TYPES=[['promotion','⬆️','Promotion d’un responsable'],['rules','📜','Changement de règlement'],['team','🧭','Nouvelle gestion'],['exclusion','⛔','Exclusion importante'],['other','🗂️','Autre décision']];
const OPEN_CASES=['pending','review','escalated','absence-pending'];
const JOURNAL_FILTERS=[['all','Tout',null],['promotions','Promotions',/rankup|promot/],['demotions','Rétrogradations',/derank|demot/],['sanctions','Sanctions',/discipline|sanction|prison|jail/],['cancel','Annulations et réexamens',/cancel|revis|correct|review|annul/],['files','Dossiers et PDT',/note|pdt|user|profil|dossier/],['foundation','Fondation',/^foundation/]];

const row=(...x)=>new Row().addComponents(...x);
const btn=(id,label,style=S.Secondary,disabled=false)=>new Button().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
const ts=(at,f='R')=>at?`<t:${Math.floor(at/1000)}:${f}>`:'—';
const fr=n=>Number(n||0).toLocaleString('fr-FR');
const hours=ms=>ms>=3600000?`${Math.floor(ms/3600000)} h ${String(Math.floor(ms/60000)%60).padStart(2,'0')}`:`${Math.round(ms/60000)} min`;
const list=(ids,max=15)=>ids.length?ids.slice(0,max).map(id=>`<@${id}>`).join(', ')+(ids.length>max?` +${ids.length-max}`:''):'—';
const cut=log.cut;
const state=()=>a.state().schoolFoundation||{};
function save(fn){a.save(s=>{s.schoolFoundation||={};const f=s.schoolFoundation;f.objectives||={};f.watch||={};f.decisions||={};fn(f);});}
function embed(title,description){return new EmbedBuilder().setColor(GOLD).setTitle(title).setDescription(description||null).setFooter(require('../utils/qgBrand').footer(' · Espace Fondation · confidentiel')).setTimestamp();}
function nav(current){return row(new Select().setCustomId('qgfd:nav').setPlaceholder('Changer d’espace…').addOptions(SECTIONS.map(([value,emoji,label])=>({value,label,emoji,default:value===current}))));}
const view=(current,embeds,rows=[],files=[])=>({embeds:[].concat(embeds),components:[nav(current),...rows].slice(0,5),files,attachments:[],allowedMentions:{parse:[]}});

// ---- Données ----
const cases=()=>Object.values(require('./qgDiscipline').state().cases||{});
const openPdt=()=>Object.values(a.state().schoolPdt||{}).filter(r=>!['Validée','Refusée'].includes(r.status));
const directionIds=async guild=>{const r=a.state().schoolRoles||{};return [...(await require('../utils/qgMembers')(guild)).values()].filter(m=>!m.user.bot&&['creator','globalManager','administrator'].some(k=>r[k]&&m.roles.cache.has(r[k]))).map(m=>m.id);};
function history(since=0){return (a.state().schoolAdminHistory||[]).filter(e=>e.at>=since);}
function activityRange(from,to){
 const metrics=require('./qgMemberMetrics'),rows=a.state().schoolDailyActivity||{},lo=metrics.day(from),hi=metrics.day(to),per={};let messages=0,voice=0;
 for(const [id,days] of Object.entries(rows))for(const [d,v] of Object.entries(days))if(d>lo&&d<=hi){messages+=v.messages||0;voice+=v.voiceMs||0;(per[id]||={m:0,v:0}).m+=v.messages||0;per[id].v+=v.voiceMs||0;}
 return {messages,voice,per};
}
const trend=(x,y)=>!y?'':x>=y?` ↗️ +${Math.round((x-y)/y*100)} %`:` ↘️ ${Math.round((x-y)/y*100)} %`;
async function teams(guild){
 const r=a.state().schoolRoles||{},members=[...(await require('../utils/qgMembers')(guild)).values()].filter(m=>!m.user.bot);
 const week=activityRange(Date.now()-7*DAY,Date.now()),actions=history(Date.now()-7*DAY);
 return require('./qgSchoolManagementBoard').groups.map(g=>{
  const leads=r[g.lead]?members.filter(m=>m.roles.cache.has(r[g.lead])).map(m=>m.id):[],team=r[g.team]?members.filter(m=>m.roles.cache.has(r[g.team])).map(m=>m.id):[];
  const people=new Set([...leads,...team]),done=actions.filter(e=>people.has(e.actorId)).length;
  const active=[...people].filter(id=>week.per[id]&&(week.per[id].m>=5||week.per[id].v>=30*60000));
  return {...g,leads,team,done,active,objective:state().objectives?.[g.key],inactive:people.size>0&&!done&&active.length===0,empty:!people.size};
 });
}

// ---- 1. Tableau de bord ----
async function dashboard(guild){
 const cmd=require('./qgCommand'),snap=cmd.snapshot(guild),roster=await cmd.roster(guild);
 const total=roster.grades.reduce((n,[,x])=>n+x.length,0),sanctioned=roster.sanctions.reduce((n,[,x])=>n+x.length,0);
 const open=cases().filter(c=>OPEN_CASES.includes(c.status)),appeals=cases().filter(c=>c.appeal?.status==='pending');
 const week=activityRange(Date.now()-7*DAY,Date.now()),prev=activityRange(Date.now()-14*DAY,Date.now()-7*DAY);
 const voiceNow=new Set([...guild.voiceStates.cache.values()].filter(v=>v.channelId).map(v=>v.id));
 const t=await teams(guild),decisions=Object.values(state().decisions||{}).filter(d=>d.status==='open');
 const leads=t.map(g=>`${g.label} · ${g.leads.length?g.leads.map(id=>`<@${id}>${voiceNow.has(id)?' 🟢':week.per[id]?'':' 💤'}`).join(', '):'*aucun responsable*'}`).join('\n');
 const e=embed('📊  Tableau de bord de la Fondation',`-# Actualisé ${ts(Date.now())} · 🟢 en vocal · 💤 aucune activité cette semaine`).addFields(
  {name:'🎖️ Effectif famille',value:`**${total}** membres`,inline:true},
  {name:'🧪 En PDT',value:`**${openPdt().length}** en cours`,inline:true},
  {name:'📋 Recrutement',value:`**${snap.toReview}** à traiter · ${snap.inProgress} en cours\n${snap.recruit?'🟢 ouvert':'🔴 fermé'}`,inline:true},
  {name:'⚠️ Sanctions actives',value:`**${sanctioned}** membres`,inline:true},
  {name:'⚖️ Dossiers en attente',value:`**${open.length}** · ${appeals.length} recours`,inline:true},
  {name:'🗳️ Votes ouverts',value:`**${decisions.length}**`,inline:true},
  {name:'💬 Messages (7 j)',value:`**${fr(week.messages)}**${trend(week.messages,prev.messages)}`,inline:true},
  {name:'🔊 Vocal (7 j)',value:`**${fr(Math.round(week.voice/3600000))} h**${trend(week.voice,prev.voice)}`,inline:true},
  {name:'🙋 Membres actifs (7 j)',value:`**${Object.keys(week.per).length}**`,inline:true},
  {name:'🧭 Responsables',value:cut(leads)},
  {name:'👁️ Sous surveillance',value:list(Object.keys(state().watch||{}),10)});
 return view('dash',e,[row(btn('qgfd:dash','🔄 Actualiser',S.Primary),btn('qgfd:go:discipline','⚖️ Dossiers en attente'),btn('qgfd:go:decisions','🗳️ Votes'))]);
}

// ---- 2. Membres ----
function membersHome(){
 return view('members',embed('👤  Gestion des membres','Choisis un membre pour ouvrir sa fiche Fondation : grade, PDT, sanctions, activité, surveillance et historique.\n\nDepuis la fiche : **dossier complet** (grade, notes confidentielles, profil), **prolongation de PDT**, **historique des sanctions** et **journal** du membre.'),[row(new UserSelect().setCustomId('qgfd:member').setPlaceholder('Rechercher un membre…').setMinValues(1).setMaxValues(1))]);
}
async function memberCard(guild,id){
 const member=await guild.members.fetch(id).catch(()=>null),user=member?.user||await guild.client.users.fetch(id);
 const grades=require('./qgGrades'),r=a.state().schoolRoles||{};
 const held=member?grades.ranks.map((k,n)=>r[k]&&member.roles.cache.has(r[k])?n:-1).filter(n=>n>=0):[],grade=held.length?grades.names[held.at(-1)]:null;
 const level=member?require('./qgDiscipline').current(member):0,mine=cases().filter(c=>c.memberId===id).sort((x,y)=>y.at-x.at);
 const pdt=openPdt().find(p=>p.targetId===id),watch=state().watch?.[id];
 const w=activityRange(Date.now()-7*DAY,Date.now()).per[id]||{m:0,v:0},m30=activityRange(Date.now()-30*DAY,Date.now()).per[id]||{m:0,v:0};
 const events=Object.values(require('./qgAnimations').state().events||{}).filter(e=>e.start>Date.now()-30*DAY||e.createdAt>Date.now()-30*DAY);
 const present=events.filter(e=>e.attendance?.[id]===true).length,signed=events.filter(e=>e.participants?.includes(id)).length;
 const recent=history().filter(e=>e.targetId===id).slice(-5).reverse();
 const e=log.entry({kind:watch?'edit':'info',icon:'👤',title:'Fiche Fondation',user,thumbnail:true,fields:[
  {name:'Grade',value:grade||(member?'Hors famille':'A quitté le serveur'),inline:true},
  {name:'Arrivée',value:member?ts(member.joinedTimestamp,'D'):'—',inline:true},
  {name:'Famille depuis',value:ts(a.state().schoolFamilyMembership?.[id]?.joinedAt,'D'),inline:true},
  {name:'PDT',value:pdt?`${pdt.status} · fin ${ts(pdt.endAt,'D')} (${ts(pdt.endAt)})`:'Aucune en cours',inline:true},
  {name:'Niveau disciplinaire',value:['Aucun','Avertissement 1','Avertissement 2','Dernière Chance'][level]||'—',inline:true},
  {name:'Surveillance',value:watch?`👁️ Oui · ${cut(watch.reason,150)}\npar <@${watch.by}> ${ts(watch.at)}`:'Non',inline:true},
  {name:'Activité 7 j',value:`💬 ${w.m} · 🔊 ${hours(w.v)}`,inline:true},
  {name:'Activité 30 j',value:`💬 ${m30.m} · 🔊 ${hours(m30.v)}`,inline:true},
  {name:'Animations (30 j)',value:`${present} présence${present>1?'s':''} · ${signed} inscription${signed>1?'s':''}`,inline:true},
  {name:`Sanctions (${mine.length})`,value:mine.slice(0,4).map(c=>`${ts(c.at,'d')} · ${['Retrait','Avert. 1','Avert. 2','Dernière Chance'][c.level]||'—'} · ${c.status}${c.appeal?.status==='pending'?' · ⏳ recours':''}\n> ${cut(c.reason,90)}`).join('\n')||'Aucune'},
  {name:'Dernières actions sur ce membre',value:recent.map(x=>`${ts(x.at,'d')} · ${log.describeAction(x.action).title} · <@${x.actorId}>`).join('\n')||'Aucune'}],footer:` · ID ${id} · confidentiel`});
 return view('members',e,[
  row(btn('qgfd:file:'+id,'📂 Dossier complet',S.Primary,!member),btn('qgfd:pdt:'+id,'⏳ Prolonger la PDT',S.Secondary,!pdt),btn(watch?'qgfd:unwatch:'+id:'qgfd:watch:'+id,watch?'👁️ Lever la surveillance':'👁️ Placer sous surveillance',watch?S.Success:S.Danger),btn('qgfd:jmember:'+id,'🔒 Journal du membre')),
  row(new UserSelect().setCustomId('qgfd:member').setPlaceholder('Autre membre…').setMinValues(1).setMaxValues(1))]);
}

// ---- 3. Gestions ----
async function teamsView(guild){
 const t=await teams(guild),e=embed('🧭  Supervision des gestions','Actions journalisées et activité de l’équipe sur les **7 derniers jours**.');
 for(const g of t)e.addFields({name:`${g.empty?'⚪':g.inactive?'🔴':'🟢'} ${g.label}`,value:cut(`**Responsable${g.leads.length>1?'s':''}** · ${list(g.leads,4)}\n**Équipe** · ${g.team.length} membre${g.team.length>1?'s':''} · ${g.active.length} actif${g.active.length>1?'s':''}\n**Actions** · ${g.done} cette semaine\n**Objectif** · ${g.objective?`${cut(g.objective.text,180)}${g.objective.due?` (échéance ${ts(g.objective.due,'d')})`:''}`:'*non défini*'}${g.inactive?'\n⚠️ **Gestion inactive cette semaine**':''}`)});
 const lazy=t.filter(g=>g.inactive).map(g=>g.label);
 if(lazy.length)e.setDescription(e.data.description+`\n\n⚠️ **${lazy.length} gestion${lazy.length>1?'s':''} inactive${lazy.length>1?'s':''}** : ${lazy.join(', ')}`);
 return view('teams',e,[row(new Select().setCustomId('qgfd:goal').setPlaceholder('🎯 Définir l’objectif d’une gestion…').addOptions(t.map(g=>({value:g.key,label:g.label.replace(/^\S+\s/,''),description:g.objective?cut(g.objective.text,90):'Aucun objectif'}))))]);
}

// ---- 4. Discipline ----
function disciplineView(){
 const open=cases().filter(c=>OPEN_CASES.includes(c.status)).sort((x,y)=>x.at-y.at),appeals=cases().filter(c=>c.appeal?.status==='pending'),watch=Object.entries(state().watch||{});
 const label={pending:'En attente',review:'À réexaminer',escalated:'Escalade (4e niveau)','absence-pending':'Absence à examiner'};
 const e=embed('⚖️  Centre disciplinaire',`**${open.length}** sanction${open.length>1?'s':''} proposée${open.length>1?'s':''} · **${appeals.length}** recours · **${watch.length}** sous surveillance`).addFields(
  {name:'📥 Sanctions à valider',value:cut(open.slice(0,8).map(c=>`<@${c.memberId}> · **${['Retrait','Avert. 1','Avert. 2','Dernière Chance'][c.level]||'—'}** · ${label[c.status]} · ${ts(c.at)}\n> ${cut(c.reason,100)}`).join('\n')||'Aucune')},
  {name:'📨 Recours en attente',value:cut(appeals.slice(0,6).map(c=>`<@${c.memberId}> · ${ts(c.appeal.at)}\n> ${cut(c.appeal.reason,100)}`).join('\n')||'Aucun')},
  {name:'👁️ Surveillance administrative',value:cut(watch.slice(0,10).map(([id,w])=>`<@${id}> · ${cut(w.reason,80)} · ${ts(w.at,'d')}`).join('\n')||'Personne')});
 const pick=[...open,...appeals.filter(c=>!open.includes(c))].slice(0,25);
 const rows=[];
 if(pick.length)rows.push(row(new Select().setCustomId('qgfd:case').setPlaceholder('Ouvrir un dossier…').addOptions(pick.map(c=>({value:c.id,label:cut(`${c.appeal?.status==='pending'&&!OPEN_CASES.includes(c.status)?'Recours':'Sanction'} · ${c.memberId}`,100),description:cut(c.reason,100)})))));
 rows.push(row(new UserSelect().setCustomId('qgfd:watchpick').setPlaceholder('👁️ Placer un membre sous surveillance…').setMinValues(1).setMaxValues(1)));
 return view('discipline',e,rows);
}
function caseView(id){
 const c=require('./qgDiscipline').state().cases?.[id];if(!c)throw Error('Dossier introuvable.');
 const e=embed('⚖️  Dossier disciplinaire',`Membre : <@${c.memberId}>\nProposé par : ${c.actorId?`<@${c.actorId}>`:'*système*'} · ${ts(c.at,'f')}\nNiveau demandé : **${['Retrait','Avertissement 1','Avertissement 2','Dernière Chance'][c.level]||'—'}** · statut : **${c.status}**\n\n**Motif**\n${cut(c.reason,1500)}`+(c.appeal?`\n\n**Recours** (${c.appeal.status}) · ${ts(c.appeal.at)}\n${cut(c.appeal.reason,1200)}`:''));
 const pending=OPEN_CASES.includes(c.status);
 return view('discipline',e,[row(btn('qgd:approve:'+id,'✅ Valider la sanction',S.Danger,!pending||c.status==='absence-pending'),btn('qgd:cancel:'+id,'❌ Refuser / annuler'),btn('qgd:review:'+id,c.appeal?.status==='pending'?'📨 Traiter le recours':'📝 Réexaminer'),btn('qgd:view:'+id,'📂 Dossier complet')),row(btn('qgfd:go:discipline','← Retour aux dossiers'))]);
}

// ---- 5. Décisions ----
function decisionsView(){
 const all=Object.values(state().decisions||{}),open=all.filter(d=>d.status==='open').sort((x,y)=>x.closesAt-y.closesAt),closed=all.filter(d=>d.status!=='open').sort((x,y)=>y.closedAt-x.closedAt);
 const type=k=>DECISION_TYPES.find(t=>t[0]===k)||DECISION_TYPES[4];
 const e=embed('🗳️  Centre des décisions','Votes internes de la direction (Créateur, Gérant Global, Administrateurs). Une décision est **adoptée si plus de la moitié de la direction vote Pour** à la clôture. Chaque décision est archivée.').addFields(
  {name:`Votes ouverts (${open.length})`,value:cut(open.map(d=>`${type(d.type)[1]} [**${cut(d.title,80)}**](${d.url}) · clôture ${ts(d.closesAt)} · ${Object.keys(d.votes||{}).length} vote(s)`).join('\n')||'Aucun')},
  {name:`Archives (${closed.length})`,value:cut(closed.slice(0,8).map(d=>`${d.status==='adopted'?'✅':'❌'} [${cut(d.title,70)}](${d.url}) · ${ts(d.closedAt,'d')} · ${tally(d).yes} pour / ${tally(d).no} contre`).join('\n')||'Aucune décision archivée')});
 return view('decisions',e,[row(new Select().setCustomId('qgfd:dtype').setPlaceholder('➕ Proposer une décision…').addOptions(DECISION_TYPES.map(([value,emoji,label])=>({value,emoji,label})))),...(closed.length?[row(btn('qgfd:dexport','📦 Exporter les archives'))]:[])]);
}
function tally(d){const v=Object.values(d.votes||{});return {yes:v.filter(x=>x==='yes').length,no:v.filter(x=>x==='no').length,abstain:v.filter(x=>x==='abstain').length};}
function decisionMessage(d){
 const t=tally(d),type=DECISION_TYPES.find(x=>x[0]===d.type)||DECISION_TYPES[4],closed=d.status!=='open';
 const e=new EmbedBuilder().setColor(closed?(d.status==='adopted'?0x3fae75:0xe0525b):GOLD).setTitle(cut(`${type[1]}  ${d.title}`,256)).setDescription(cut(d.description,3000))
  .addFields({name:'Type',value:type[2],inline:true},{name:'Proposée par',value:`<@${d.authorId}>`,inline:true},{name:closed?'Clôturée':'Clôture',value:ts(closed?d.closedAt:d.closesAt,'f'),inline:true},
   {name:'Votes',value:`✅ Pour **${t.yes}** · ❌ Contre **${t.no}** · ⚪ Abstention **${t.abstain}**\n-# ${Object.keys(d.votes||{}).length}/${d.electorate||'?'} membres de la direction ont voté · majorité requise : **${Math.floor((d.electorate||0)/2)+1}**`})
  .setFooter(require('../utils/qgBrand').footer(' · Décision '+d.id.slice(0,8))).setTimestamp(d.createdAt);
 if(closed)e.addFields({name:'Résultat',value:d.status==='adopted'?'✅ **Décision adoptée**':'❌ **Décision rejetée**'},{name:'Détail des votes',value:cut(Object.entries(d.votes||{}).map(([id,v])=>`${v==='yes'?'✅':v==='no'?'❌':'⚪'} <@${id}>`).join('\n')||'Aucun vote')});
 return {embeds:[e],components:closed?[]:[row(btn(`qgfd:vote:${d.id}:yes`,'Pour',S.Success).setEmoji('✅'),btn(`qgfd:vote:${d.id}:no`,'Contre',S.Danger).setEmoji('❌'),btn(`qgfd:vote:${d.id}:abstain`,'Abstention').setEmoji('⚪'),btn('qgfd:dclose:'+d.id,'Clôturer maintenant'))],allowedMentions:{parse:[]}};
}
async function closeDecision(guild,id,actorId){
 return a.serial('foundation-decision:'+id,async()=>{
  const d=state().decisions?.[id];if(!d||d.status!=='open')return d;
  const electorate=(await directionIds(guild)).length||d.electorate||1,t=tally(d),status=t.yes>electorate/2?'adopted':'rejected';
  save(f=>{Object.assign(f.decisions[id],{status,closedAt:Date.now(),closedBy:actorId||null,electorate});});
  const next=state().decisions[id],ch=await guild.channels.fetch(d.channelId).catch(()=>null),msg=ch&&await ch.messages.fetch(d.messageId).catch(()=>null);
  if(msg)await msg.edit(decisionMessage(next)).catch(()=>{});
  await a.audit(guild,{action:'foundation.decision',actorId:actorId||guild.client.user.id,after:{title:d.title,status:status==='adopted'?'Adoptée':'Rejetée',pour:t.yes,contre:t.no,abstention:t.abstain},reason:d.description}).catch(()=>{});
  return next;
 });
}

// ---- 6. Activité ----
async function activityData(guild){
 const rows=await require('./qgWeeklyReport').rows(guild),events=Object.values(require('./qgAnimations').state().events||{}).filter(e=>(e.start||e.createdAt)>Date.now()-30*DAY);
 const inactive=rows.filter(r=>r.messages<5&&r.voiceMs<30*60000),top=[...rows].sort((x,y)=>(y.messages+y.voiceMs/60000)-(x.messages+x.voiceMs/60000)).slice(0,5);
 const present={};for(const e of events)for(const [id,v] of Object.entries(e.attendance||{}))if(v===true)present[id]=(present[id]||0)+1;
 const actions={};for(const e of history(Date.now()-7*DAY))if(e.actorId&&e.actorId!==guild.client.user.id)actions[e.actorId]=(actions[e.actorId]||0)+1;
 return {rows,inactive,top,present:Object.entries(present).sort((x,y)=>y[1]-x[1]),events,actions:Object.entries(actions).sort((x,y)=>y[1]-x[1])};
}
function activityEmbed(d,title='📈  Surveillance de l’activité'){
 return embed(title,`Famille : **${d.rows.length}** membres · période : **7 derniers jours** (animations : 30 jours).\nInactif = moins de 5 messages et moins de 30 min de vocal.`).addFields(
  {name:`💤 Inactifs (${d.inactive.length})`,value:cut(d.inactive.slice(0,20).map(r=>`<@${r.id}> · ${r.grade} · 💬 ${r.messages} · 🔊 ${hours(r.voiceMs)}`).join('\n')||'Aucun 🎉')},
  {name:'🏆 Les plus actifs',value:cut(d.top.map((r,n)=>`${['🥇','🥈','🥉','4.','5.'][n]} <@${r.id}> · 💬 ${r.messages} · 🔊 ${hours(r.voiceMs)}`).join('\n')||'Pas encore de données')},
  {name:`🎉 Animations (${d.events.length} en 30 j)`,value:cut(d.present.slice(0,8).map(([id,n])=>`<@${id}> · ${n} présence${n>1?'s':''}`).join('\n')||'Aucune présence renseignée')},
  {name:'🛡️ Actions des responsables (7 j)',value:cut(d.actions.slice(0,10).map(([id,n])=>`<@${id}> · ${n} action${n>1?'s':''}`).join('\n')||'Aucune action journalisée')});
}

// ---- 7. Journal ----
function journalView(filter='all',member=null,page=0){
 const rule=JOURNAL_FILTERS.find(f=>f[0]===filter)||JOURNAL_FILTERS[0];
 const rows=history().filter(e=>(!rule[2]||rule[2].test(e.action))&&(!member||e.actorId===member||e.targetId===member)).reverse();
 const pages=Math.max(1,Math.ceil(rows.length/10));page=Math.min(Math.max(0,page),pages-1);
 const lines=rows.slice(page*10,page*10+10).map(e=>{const {icon,title}=log.describeAction(e.action);return `${ts(e.at,'f')} · ${icon} **${title}**${e.result&&e.result!=='success'?' · ❌':''}\n<@${e.actorId}>${e.targetId?` → <@${e.targetId}>`:''}${e.reason?` · ${cut(e.reason,80)}`:''}`;});
 const e=embed('🔒  Journal confidentiel',`${rule[1]}${member?` · membre <@${member}>`:''} · **${rows.length}** entrée${rows.length>1?'s':''} · page ${page+1}/${pages}\n\n${lines.join('\n\n')||'Aucune entrée.'}`);
 const key=`${filter}:${member||'-'}`;
 return view('journal',e,[
  row(new Select().setCustomId('qgfd:jfilter:'+(member||'-')).setPlaceholder('Filtrer…').addOptions(JOURNAL_FILTERS.map(([value,label])=>({value,label,default:value===filter})))),
  row(new UserSelect().setCustomId('qgfd:jwho:'+filter).setPlaceholder('Filtrer par membre (auteur ou cible)…').setMinValues(0).setMaxValues(1)),
  row(btn(`qgfd:jpage:${key}:${page-1}`,'◀',S.Secondary,page===0),btn(`qgfd:jpage:${key}:${page+1}`,'▶',S.Secondary,page>=pages-1),btn(`qgfd:jexport:${key}`,'📦 Exporter (CSV)'))]);
}
function csv(rows){return '﻿'+[['date','action','auteur','cible','resultat','motif'],...rows.map(e=>[new Date(e.at).toISOString(),e.action,e.actorId||'',e.targetId||'',e.result||'',e.reason||''])].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');}

// ---- Interactions ----
const form=(id,title,fields)=>new Modal().setCustomId(id).setTitle(cut(title,45)).addComponents(...fields.map(([key,label,style=T.Short,required=true,value,max=100])=>{const x=new Input().setCustomId(key).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);if(value)x.setValue(String(value));return row(x);}));
async function render(guild,section){
 if(section==='dash')return dashboard(guild);
 if(section==='members')return membersHome();
 if(section==='teams')return teamsView(guild);
 if(section==='discipline')return disciplineView();
 if(section==='decisions')return decisionsView();
 if(section==='activity')return view('activity',activityEmbed(await activityData(guild)),[row(btn('qgfd:weekly','📝 Générer le bilan hebdomadaire',S.Primary),btn('qgfd:go:activity','🔄 Actualiser'))]);
 if(section==='journal')return journalView();
 throw Error('Espace inconnu.');
}
async function handle(i){
 if(i.guildId!==config.guildId)throw Error('Serveur QG incorrect.');
 const [,op,arg,extra,more]=i.customId.split(':');
 // Les votes passent par le message public de la décision : seule la direction vote.
 const member=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.isDirection(member))throw Error('Espace Fondation réservé à la direction.');
 const field=k=>{try{return i.fields.getTextInputValue(k).trim();}catch{return '';}};

 // Formulaires (ouverture immédiate, sans différer)
 if(op==='pdt'){const p=openPdt().find(x=>x.targetId===arg);if(!p)throw Error('Aucune PDT en cours pour ce membre.');return i.showModal(form('qgfd:pdtsave:'+arg,'⏳ Prolonger la PDT',[['days','Nombre de jours à ajouter (1 à 60)',T.Short,true,'7',2],['reason','Motif',T.Paragraph,true,null,500]]));}
 if(op==='watch')return i.showModal(form('qgfd:watchsave:'+arg,'👁️ Surveillance administrative',[['reason','Motif de la surveillance',T.Paragraph,true,null,500]]));
 if(op==='watchpick')return i.showModal(form('qgfd:watchsave:'+i.values[0],'👁️ Surveillance administrative',[['reason','Motif de la surveillance',T.Paragraph,true,null,500]]));
 if(op==='goal'){const o=state().objectives?.[i.values[0]];return i.showModal(form('qgfd:goalsave:'+i.values[0],'🎯 Objectif de la gestion',[['text','Objectif (vide = retirer)',T.Paragraph,false,o?.text,500],['days','Échéance en jours (facultatif)',T.Short,false,o?.due?Math.max(1,Math.ceil((o.due-Date.now())/DAY)):null,3]]));}
 if(op==='dtype'){const t=DECISION_TYPES.find(x=>x[0]===i.values[0]);return i.showModal(form('qgfd:dnew:'+t[0],`${t[1]} ${t[2]}`,[['title','Intitulé',T.Short,true,null,120],['description','Proposition détaillée',T.Paragraph,true,null,1800],['hours','Durée du vote en heures (1 à 168)',T.Short,true,'48',3]]));}

 if(op==='vote'){
  await i.deferUpdate();
  const next=await a.serial('foundation-decision:'+arg,async()=>{const d=state().decisions?.[arg];if(!d||d.status!=='open')throw Error('Ce vote est clos.');if(d.closesAt<Date.now())return null;save(f=>{f.decisions[arg].votes||={};f.decisions[arg].votes[i.user.id]=extra;});return state().decisions[arg];});
  if(!next){await closeDecision(i.guild,arg,null);return i.followUp({content:'⏱️ Le délai était écoulé : la décision vient d’être clôturée.',flags:F.Ephemeral});}
  await i.editReply(decisionMessage(next));
  return i.followUp({content:`🗳️ Vote enregistré : **${{yes:'Pour',no:'Contre',abstain:'Abstention'}[extra]}**. Tu peux le modifier jusqu’à la clôture.`,flags:F.Ephemeral});
 }
 if(op==='dclose'){
  const d=state().decisions?.[arg];if(!d)throw Error('Décision introuvable.');
  const r=a.state().schoolRoles||{};if(d.authorId!==i.user.id&&!(r.creator&&member.roles.cache.has(r.creator)))throw Error('Seuls l’auteur de la proposition et le Créateur peuvent clôturer avant l’échéance.');
  await i.deferUpdate();const done=await closeDecision(i.guild,arg,i.user.id);return i.followUp({content:done.status==='adopted'?'✅ Décision adoptée et archivée.':'❌ Décision rejetée et archivée.',flags:F.Ephemeral});
 }

 if(op==='file'){
  await i.deferReply({flags:F.Ephemeral});const panel=require('./qgUserPanel'),target=await i.guild.members.fetch(arg);
  return i.editReply(panel.profile(member,target,panel.open(i,member,target)));
 }
 if(['jexport','dexport','weekly'].includes(op))await i.deferReply({flags:F.Ephemeral});
 if(op==='jexport'){const rule=JOURNAL_FILTERS.find(f=>f[0]===arg)||JOURNAL_FILTERS[0],who=extra==='-'?null:extra;const rows=history().filter(e=>(!rule[2]||rule[2].test(e.action))&&(!who||e.actorId===who||e.targetId===who));await a.audit(i.guild,{action:'foundation.export',actorId:i.user.id,after:{filtre:rule[1],entrees:rows.length}}).catch(()=>{});return i.editReply({content:`📦 ${rows.length} entrée(s) exportée(s).`,files:[new AttachmentBuilder(Buffer.from(csv(rows),'utf8'),{name:'journal-fondation.csv'})]});}
 if(op==='dexport'){const rows=Object.values(state().decisions||{}).filter(d=>d.status!=='open');return i.editReply({content:`📦 ${rows.length} décision(s) archivée(s).`,files:[new AttachmentBuilder(Buffer.from(JSON.stringify(rows,null,2),'utf8'),{name:'decisions-fondation.json'})]});}
 if(op==='weekly'){
  const d=await activityData(i.guild),e=activityEmbed(d,`📝  Bilan hebdomadaire · semaine du ${new Date(Date.now()-7*DAY).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'})}`);
  const t=await teams(i.guild);e.addFields({name:'🧭 Gestions',value:cut(t.map(g=>`${g.empty?'⚪':g.inactive?'🔴':'🟢'} ${g.label} · ${g.done} action${g.done>1?'s':''} · ${g.active.length} actif${g.active.length>1?'s':''}`).join('\n'))});
  const id=a.state().schoolChannels?.foundationReports,ch=id&&await i.guild.channels.fetch(id).catch(()=>null);
  if(!ch?.isTextBased?.())return i.editReply({content:'⚠️ Salon des rapports Fondation introuvable : voici le bilan en privé.',embeds:[e],allowedMentions:{parse:[]}});
  const sent=await ch.send({embeds:[e],allowedMentions:{parse:[]}});await a.audit(i.guild,{action:'foundation.report',actorId:i.user.id,after:{salon:ch.id}}).catch(()=>{});
  return i.editReply({content:`✅ Bilan publié dans <#${ch.id}> : ${sent.url}`,allowedMentions:{parse:[]}});
 }

 // Enregistrements depuis les formulaires
 if(op==='pdtsave'){
  const days=Number(field('days'));if(!Number.isInteger(days)||days<1||days>60)throw Error('Durée : 1 à 60 jours.');
  const p=openPdt().find(x=>x.targetId===arg);if(!p)throw Error('Aucune PDT en cours pour ce membre.');
  const before=p.endAt;a.save(s=>{const r=s.schoolPdt[p.id];r.endAt=(r.endAt||Date.now())+days*DAY;r.history||=[];r.history.push({at:Date.now(),actorId:i.user.id,action:'Prolongation de '+days+' j',reason:field('reason')});});
  await a.audit(i.guild,{action:'pdt.extend',actorId:i.user.id,targetId:arg,before:{fin:new Date(before).toLocaleDateString('fr-FR')},after:{fin:new Date(before+days*DAY).toLocaleDateString('fr-FR')},reason:field('reason')}).catch(()=>{});
  await i.deferUpdate();return i.editReply(await memberCard(i.guild,arg));
 }
 if(op==='watchsave'){
  save(f=>{f.watch[arg]={reason:field('reason'),by:i.user.id,at:Date.now()};});
  await a.audit(i.guild,{action:'foundation.watch',actorId:i.user.id,targetId:arg,after:'Sous surveillance',reason:field('reason')}).catch(()=>{});
  if(i.message){await i.deferUpdate();return i.editReply(i.message.embeds[0]?.title?.includes('Fiche')?await memberCard(i.guild,arg):disciplineView());}
  return i.reply({content:`👁️ <@${arg}> est placé sous surveillance administrative.`,flags:F.Ephemeral,allowedMentions:{parse:[]}});
 }
 if(op==='unwatch'){
  const before=state().watch?.[arg];save(f=>{delete f.watch[arg];});
  await a.audit(i.guild,{action:'foundation.unwatch',actorId:i.user.id,targetId:arg,before:before?.reason,after:'Surveillance levée'}).catch(()=>{});
  return i.update(await memberCard(i.guild,arg));
 }
 if(op==='goalsave'){
  const text=field('text'),days=Number(field('days')||0);if(days&&(!Number.isInteger(days)||days<1||days>365))throw Error('Échéance : 1 à 365 jours.');
  const before=state().objectives?.[arg]?.text;save(f=>{if(text)f.objectives[arg]={text,due:days?Date.now()+days*DAY:null,by:i.user.id,at:Date.now()};else delete f.objectives[arg];});
  await a.audit(i.guild,{action:'foundation.objective',actorId:i.user.id,before,after:text||'Objectif retiré',reason:arg}).catch(()=>{});
  await i.deferUpdate();return i.editReply(await teamsView(i.guild));
 }
 if(op==='dnew'){
  const title=field('title'),description=field('description'),h=Number(field('hours'));if(!Number.isInteger(h)||h<1||h>168)throw Error('Durée du vote : 1 à 168 heures.');
  const chId=a.state().schoolChannels?.foundationChat,ch=chId&&await i.guild.channels.fetch(chId).catch(()=>null)||await i.guild.channels.fetch(require('./qgCommand').CHANNEL);
  const d={id:randomUUID(),type:arg,title,description,authorId:i.user.id,createdAt:Date.now(),closesAt:Date.now()+h*3600000,status:'open',votes:{},electorate:(await directionIds(i.guild)).length,channelId:ch.id};
  const direction=['creator','globalManager','administrator'].map(k=>a.state().schoolRoles?.[k]).filter(Boolean);
  const msg=await ch.send({content:direction.map(id=>`<@&${id}>`).join(' ')||null,...decisionMessage(d),allowedMentions:{parse:[],roles:direction}});
  save(f=>{f.decisions[d.id]={...d,messageId:msg.id,url:msg.url};});
  await a.audit(i.guild,{action:'foundation.proposal',actorId:i.user.id,after:{title,type:(DECISION_TYPES.find(t=>t[0]===arg)||[])[2],cloture:new Date(d.closesAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})},reason:description}).catch(()=>{});
  await i.deferUpdate();return i.editReply(decisionsView());
 }

 // Navigation
 if(op==='open'){await i.deferReply({flags:F.Ephemeral});return i.editReply(await render(i.guild,arg||'dash'));}
 if(op==='nav'||op==='go'||op==='dash'){await i.deferUpdate();return i.editReply(await render(i.guild,op==='nav'?i.values[0]:op==='dash'?'dash':arg));}
 if(op==='member'){await i.deferUpdate();return i.editReply(await memberCard(i.guild,i.values[0]));}
 if(op==='case')return i.update(caseView(i.values[0]));
 if(op==='jmember')return i.update(journalView('all',arg));
 if(op==='jfilter')return i.update(journalView(i.values[0],arg==='-'?null:arg));
 if(op==='jwho')return i.update(journalView(arg,i.values[0]||null));
 if(op==='jpage')return i.update(journalView(arg,extra==='-'?null:extra,Number(more)));
 throw Error('Action inconnue.');
}
// Clôture automatique des votes arrivés à échéance.
async function tick(guild){for(const d of Object.values(state().decisions||{}))if(d.status==='open'&&d.closesAt<=Date.now())await closeDecision(guild,d.id,null);}
// Boutons ajoutés au centre de commandement.
function panelRows(){return [row(...SECTIONS.slice(0,4).map(([key,emoji,label])=>btn('qgfd:open:'+key,label).setEmoji(emoji))),row(...SECTIONS.slice(4).map(([key,emoji,label])=>btn('qgfd:open:'+key,label).setEmoji(emoji)))];}
module.exports={handle,tick,panelRows,render,dashboard,memberCard,teams,disciplineView,decisionsView,decisionMessage,closeDecision,tally,journalView,activityData,SECTIONS,DECISION_TYPES};
