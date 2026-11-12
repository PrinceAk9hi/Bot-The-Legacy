const {MessageFlags:F,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{embed}=require('./qgPanels');
const familyKeys=['test','confirmed','expert','prestigious','senior'];
const excluded='1561157108307861574';
function family(member){const r=a.state().schoolRoles||{};return familyKeys.some(k=>r[k]&&r[k]!==excluded&&member.roles.cache.has(r[k]));}
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^i(?=gestion|responsable|attente|membre|prison)/,'');
async function discover(guild){
 await guild.roles.fetch();
 a.save(s=>{s.schoolRoles||={};s.schoolRoles.managementAccess='1562188199072374854';s.schoolRoles.responsibleAccess='1562188485010657341';s.schoolRoles.outsideQG=excluded;});
 for(const [key,label] of [['rpManagement','Gestion RP'],['rpLead','Responsable RP']]){
  let role=guild.roles.cache.get(a.state().schoolRoles?.[key]);
  if(!role){const matches=guild.roles.cache.filter(r=>!r.managed&&normalize(r.name)===normalize(label));if(matches.size>1)throw Error(`Plusieurs rôles ${label} : association manuelle nécessaire.`);role=matches.first();}
  if(!role)role=await guild.roles.create({name:'🎭・'+label,color:0xffffff,permissions:[],reason:'Gestion RP QG demandée'});
  a.save(s=>{s.schoolRoles[key]=role.id;});
 }
 for(const [key,label] of [['interviewWaiting','Attente entretien'],['recruitmentRefused','Membre refusé'],['rpPrison','Prison']]){
  if(guild.roles.cache.has(a.state().schoolRoles?.[key]))continue;
  const matches=guild.roles.cache.filter(r=>!r.managed&&normalize(r.name)===normalize(label));
  if(matches.size===1)a.save(s=>{s.schoolRoles[key]=matches.first().id;});
 }
 const found={};
 for(const n of [5,10,20,35,50,75,100]){
  const matches=guild.roles.cache.filter(r=>!r.managed&&new RegExp('\\[\\+'+n+'\\]\\s*$').test(r.name));
  if(matches.size>1)throw Error(`Plusieurs rôles de niveau +${n}.`);
  if(matches.size===1)found[n]=matches.first().id;
 }
 a.save(s=>{s.levelRoles||={};Object.assign(s.levelRoles,found);for(const [n,id] of Object.entries(found))s.schoolRoles['level'+n]=id;});
 await require('./qgSchoolSeparators').resolveExisting(guild);
}
function recordVerification(id,value){
 if(value.stage!=='accepted'||!value.acceptedAt||a.state().schoolVerificationHistory?.[id+':'+value.acceptedAt])return;
 a.save(s=>{s.schoolVerificationHistory||={};const key=id+':'+value.acceptedAt;s.schoolVerificationHistory[key]||={userId:id,acceptedAt:value.acceptedAt,confirmedAt:value.confirmedAt,robloxId:value.robloxId,robloxName:value.robloxName,discordName:value.discordName,version:value.version,ageBracket:value.ageBracket,notificationKeys:value.notificationKeys};});
}
function recruited(member){
 if(member.guild.id!==config.guildId||member.user.bot||!family(member))return;
 a.save(s=>{s.schoolFamilyMembership||={};const old=s.schoolFamilyMembership[member.id];if(old?.active)return;
  s.schoolFamilyMembership[member.id]={active:true,joinedAt:Date.now(),previous:old?.joinedAt||null};
 });
 // Annonce tout de suite dans nouvelle-recrue, sans attendre le passage automatique (1 min).
 announce(member.guild,member.id).catch(e=>console.error('Annonce recrutement QG :',e.code||e.name||e.message));
}
const RECRUIT_CHANNEL='1562193740079038515',RECRUIT_PING='1561363081018474626';
function recruitPayload(id){
 return{content:`<@&${RECRUIT_PING}>`,embeds:[embed('✦ Une nouvelle recrue rejoint le QG',`Bienvenue dans la famille, <@${id}> !\n\nRejoins régulièrement les membres **en vocal et en jeu** : les échanges et l’activité font vivre notre famille.\n\nPrends le temps de lire <#1561157212154372137> pour connaître nos repères et nos attentes.\n\n**Rejoins notre communauté Roblox** : [envoie ta demande ici](${config.robloxGroupUrl}). Elle restera en attente et sera acceptée automatiquement quand tu passeras **Membre Confirmé**.\n\nHeureux de te compter parmi nous !`)],allowedMentions:{parse:[],roles:[RECRUIT_PING]}};
}
// Une seule annonce par arrivée (clé recruit:id:date), même si l'appel direct et le passage automatique se croisent.
async function announce(guild,id){
 const v=a.state().schoolFamilyMembership?.[id];if(!v?.active||guild.id!==config.guildId)return;
 return a.serial('qg-recruit:'+id,()=>deliver(guild,'recruit:'+id+':'+v.joinedAt,RECRUIT_CHANNEL,recruitPayload(id)));
}
function memberChanged(oldMember,newMember){
 if(!family(oldMember)&&family(newMember))recruited(newMember);
 if(family(oldMember)&&!family(newMember))a.save(s=>{const rec=s.schoolFamilyMembership?.[newMember.id];if(rec){rec.active=false;rec.leftAt=Date.now();}});
}
async function deliver(guild,key,channelId,payload,privateOnly=false){
 const prior=a.state().schoolCommunityDeliveries?.[key];if(prior?.messageId)return;
 const ch=await guild.channels.fetch(channelId);
 if(!ch?.isTextBased()||ch.guildId!==config.guildId)throw Error('Salon de publication QG indisponible.');
 if(privateOnly&&ch.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel))throw Error('Le salon des vérifications doit être privé.');
 const marker='QG '+key;let message;
 if(prior?.pending){
  const recent=await ch.messages.fetch({limit:100});message=recent.find(m=>m.author.id===guild.client.user.id&&m.embeds.some(e=>e.footer?.text?.includes(marker)));
  if(!message)throw Error('Envoi incertain : vérifier manuellement '+key);
 }else{
  payload.embeds[0].setFooter(require('../utils/qgBrand').footer(' • '+marker));
  a.save(s=>{s.schoolCommunityDeliveries||={};s.schoolCommunityDeliveries[key]={pending:true,at:Date.now()};});
  try{message=await ch.send(payload);}catch(e){if(e.status>=400&&e.status<500&&e.status!==429)a.save(s=>{delete s.schoolCommunityDeliveries[key];});throw e;}
 }
 a.save(s=>{s.schoolCommunityDeliveries[key]={messageId:message.id,channelId,at:Date.now()};});
}
async function roster(guild){
 const id=a.state().schoolChannels?.familyRoster;if(!id)return;
 const ch=await guild.channels.fetch(id);if(!ch?.isTextBased())return;
 const members=await require('../utils/qgMembers')(guild),r=a.state().schoolRoles||{};
 const list=[...members.values()].filter(m=>!m.user.bot&&family(m)).sort((x,y)=>{
  const rank=m=>familyKeys.reduce((n,k,j)=>m.roles.cache.has(r[k])?j:n,-1);return rank(y)-rank(x)||x.displayName.localeCompare(y.displayName,'fr');
 });
 // Passage aux composants intégrés : les anciennes pages (embeds) sont remplacées une seule fois.
 if(!a.state().schoolFamilyRosterV2){
  for(const old of a.state().schoolFamilyRosterMessages||[])if(old)await ch.messages.delete(old).catch(e=>{if(e.code!==10008)throw e;});
  a.save(s=>{s.schoolFamilyRosterMessages=[];s.schoolFamilyRosterV2=true;});
 }
 const pages=Math.max(1,Math.ceil(list.length/8)),saved=a.state().schoolFamilyRosterMessages||[],grades=gradeCounts(guild,list);
 for(let page=0;page<Math.max(pages,saved.length);page++){
  let message=saved[page]?await ch.messages.fetch(saved[page]).catch(e=>{if(e.code===10008)return null;throw e;}):null;
  if(page>=pages){if(message)await message.edit(rosterPage({total:list.length,page,pages,lines:[],empty:true}));continue;}
  const lines=list.slice(page*8,page*8+8).map(m=>{
   const grade=familyKeys.filter(k=>r[k]!==excluded&&m.roles.cache.has(r[k])).map(k=>guild.roles.cache.get(r[k])?.name||k).join(', ');
   const application=a.state().schoolFamilyRecruitment?.[m.id];
   const date=a.state().schoolFamilyMembership?.[m.id]?.joinedAt||(application?.status==='accept'?(application.interviewFinishedAt||application.updatedAt):null),rankup=require('./qgMemberMetrics').lastRankup(m.id);
   return `**<@${m.id}>** • ${grade}\nArrivée dans la famille : ${date?`<t:${Math.floor(date/1000)}:D>`:'inconnue — non enregistrée'}\nDernier rankup : ${rankup?`<t:${Math.floor(rankup/1000)}:D>`:'non enregistré'}`;
  });
  const payload=rosterPage({total:list.length,page,pages,lines,grades:page===0?grades:null});
  if(message)await message.edit(payload);else message=await ch.send(payload);
  a.save(s=>{s.schoolFamilyRosterMessages||=[];s.schoolFamilyRosterMessages[page]=message.id;});
 }
}
// Grades de la famille : badge (icône ou emoji du rôle), rôle et nombre de membres qui l'ont.
function gradeCounts(guild,list){
 const r=a.state().schoolRoles||{};
 return [...familyKeys].reverse().filter(k=>r[k]&&r[k]!==excluded).map(k=>{
  const role=guild.roles.cache.get(r[k]);
  return{id:r[k],count:list.filter(m=>m.roles.cache.has(r[k])).length,icon:role?.iconURL?.({size:64,extension:'png'})||null,emoji:role?.unicodeEmoji||null};
 });
}
// Page d'effectif en composants intégrés (texte, badges et séparateurs dans le même cadre).
function rosterPage({total,page,pages,lines,grades,empty}){
 const {ContainerBuilder,SectionBuilder,TextDisplayBuilder,ThumbnailBuilder,SeparatorBuilder}=require('discord.js');
 const text=content=>new TextDisplayBuilder().setContent(content);
 const box=new ContainerBuilder().setAccentColor(0xffffff).addTextDisplayComponents(text(`## ✦ Effectifs de la famille QG\n**${total} MEMBRE${total>1?'S':''} · PAGE ${page+1}/${pages}**`));
 if(empty)box.addTextDisplayComponents(text('Cette page est désormais vide.'));
 if(grades?.length){
  box.addSeparatorComponents(new SeparatorBuilder());
  box.addTextDisplayComponents(text('### Grades'));
  for(const g of grades){
   const line=`${g.emoji?g.emoji+' ':''}<@&${g.id}> · **${g.count}** membre${g.count>1?'s':''}`;
   if(g.icon)box.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(line)).setThumbnailAccessory(new ThumbnailBuilder().setURL(g.icon)));
   else box.addTextDisplayComponents(text(line));
  }
 }
 if(!empty){
  box.addSeparatorComponents(new SeparatorBuilder());
  box.addTextDisplayComponents(text((lines.join('\n\n')||'Aucun membre familial enregistré.').slice(0,3000)));
 }
 box.addTextDisplayComponents(text(`-# Mis à jour <t:${Math.floor(Date.now()/1000)}:R>`));
 return{components:[box],flags:F.IsComponentsV2,allowedMentions:{parse:[]}};
}
let busy=false,lastRoster=0;
async function tick(guild){
 if(busy||guild.id!==config.guildId)return;busy=true;
 try{
  for(const [id,v] of Object.entries(a.state().schoolEntryVerification||{}))recordVerification(id,v);
  let sent=0;
  for(const [key,v] of Object.entries(a.state().schoolVerificationHistory||{})){
   if(a.state().schoolCommunityDeliveries?.['verify:'+key]?.messageId)continue;if(sent++>=10)break;
   await deliver(guild,'verify:'+key,'1562190797128990780',{embeds:[embed('✓ Vérification enregistrée',`Membre : <@${v.userId}>\nNom choisi : ${require('../utils/qgAiKnowledge').clean(v.discordName||'Non renseigné')}\nRoblox : ${/^\d+$/.test(String(v.robloxId))?`https://www.roblox.com/users/${v.robloxId}/profile`:'non renseigné'}\nRèglement accepté : <t:${Math.floor(v.acceptedAt/1000)}:F>\nVersion : ${v.version||'non enregistrée'}\nLe compte Roblox a été déclaré et confirmé par le membre.`)],allowedMentions:{parse:[]}},true).catch(e=>console.error('Archive vérification QG :',e.code||e.name));
  }
  for(const [id,v] of Object.entries(a.state().schoolFamilyMembership||{}))if(v.active){
   await announce(guild,id).catch(e=>console.error('Annonce recrutement QG :',e.code||e.name));
  }
  if(Date.now()-lastRoster>300000){
   await roster(guild);lastRoster=Date.now();
   // Guide de la famille (effectifs par grade) et panel exécutant (places libres) suivent les rôles.
   const panels=require('./qgPanels');
   await panels.refreshGuide(guild).catch(e=>console.error('Guide famille QG :',e.code||e.name));
   await panels.refreshManagement(guild).catch(e=>console.error('Panel exécutant QG :',e.code||e.name));
  }
 }finally{busy=false;}
}
async function execute(i){
 await i.deferReply({flags:F.Ephemeral});const actor=await a.actor(i);
 if(!a.isDirection(actor))throw Error('Actualisation réservée à la direction.');
 await discover(i.guild);require('./qgLevels').migrate();
 await require('./qgSchoolSeparators').syncGuild(i.guild);
 await require('./qgPanels').refreshManagement(i.guild);
 const record=a.state().schoolPanels?.levelsInfo;if(record){const ch=await i.guild.channels.fetch(record.channelId);const m=await ch.messages.fetch(record.messageId);await m.edit(require('./qgLevels').panel());}
 await roster(i.guild);
 const optional=['dividerAccessManagement','dividerAccessResponsible','dividerNotifications','dividerStatus','dividerLevels'];
 const missing=optional.filter(k=>!a.state().schoolRoles?.[k]);
 return i.editReply({embeds:[embed('QG actualisé',`Gestion RP disponible, panel des gestions actualisé, effectifs et niveaux mis à jour.\n${missing.length?'Séparateurs non retrouvés : '+missing.join(', ')+'. Associe tes rôles existants avec /sync associer-separateur.':'Séparateurs existants associés.'}\nLes dates historiques absentes restent indiquées comme inconnues.`)],allowedMentions:{parse:[]}});
}
module.exports={execute,discover,recordVerification,recruited,memberChanged,roster,tick,family,announce,recruitPayload,_test:{rosterPage,gradeCounts}};
