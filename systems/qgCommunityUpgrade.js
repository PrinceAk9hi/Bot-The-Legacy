const {MessageFlags:F,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{embed}=require('./qgPanels');
// Du plus bas au plus haut : Membre Prestigieux est au-dessus de Membre Senior.
const familyKeys=['test','confirmed','expert','senior','prestigious'];
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
 leadRoles(newMember).catch(e=>console.error('Rôle exécutant du responsable :',e.code||e.message));
}
// Responsabilité → rôle d'exécutant de la même équipe, ajouté automatiquement (jamais retiré).
const leadTeams=()=>({...Object.fromEntries(Object.entries(a.teams).map(([team,lead])=>[lead,team])),casinoLead:'casinoOperator'});
async function leadRoles(member){
 if(member.guild?.id!==config.guildId||member.user?.bot)return[];
 const r=a.state().schoolRoles||{};
 const add=Object.entries(leadTeams()).filter(([lead,team])=>r[lead]&&r[team]&&member.roles.cache.has(r[lead])&&!member.roles.cache.has(r[team])).map(([,team])=>r[team]);
 if(add.length)await member.roles.add(add,'Responsabilité QG : rôle d’exécutant associé');
 return add;
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
 const members=await require('../utils/qgMembers')(guild);
 const list=[...members.values()].filter(m=>!m.user.bot&&family(m));
 // Passage aux composants intégrés : les anciennes pages (embeds) sont remplacées une seule fois.
 if(!a.state().schoolFamilyRosterV2){
  for(const old of a.state().schoolFamilyRosterMessages||[])if(old)await ch.messages.delete(old).catch(e=>{if(e.code!==10008)throw e;});
  a.save(s=>{s.schoolFamilyRosterMessages=[];s.schoolFamilyRosterV2=true;});
 }
 const saved=a.state().schoolFamilyRosterMessages||[],humans=[...members.values()].filter(m=>!m.user.bot);
 // Badge de chaque rôle → emoji du serveur correspondant (comparaison d'images, mémorisée).
 const payloads=rosterPages({total:list.length,summary:fullRoster(guild,humans,await badgeMap(guild),{details:true})});
 const ids=[];
 for(const [n,payload] of payloads.entries()){
  let message=saved[n]?await ch.messages.fetch(saved[n]).catch(e=>{if(e.code===10008)return null;throw e;}):null;
  if(message)await message.edit(payload);else message=await ch.send(payload);
  ids.push(message.id);
 }
 // Messages en trop (effectif plus court qu'avant) : supprimés.
 for(const old of saved.slice(payloads.length))if(old)await ch.messages.delete(old).catch(e=>{if(e.code!==10008)throw e;});
 a.save(s=>{s.schoolFamilyRosterMessages=ids;});
}
// Effectif complet : direction (Référent du QG à la place d'Administrateur), grades de la famille et exécutants, avec pour chaque rôle son
// emoji du serveur, le rôle et le nombre de personnes qui l'ont.
const DIRECTION_KEYS=['creator','globalManager','referent']; // referent : « Référent du QG » (systems/qgReferent.js)
const normalizeName=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Emoji du serveur associé à un rôle : config.rosterEmojis[clé] (nom ou ID) si renseigné, sinon
// l'emoji qui a la même image que le badge du rôle, sinon
// l'emoji dont le nom correspond au nom du rôle (exact, puis le plus long contenu dans le nom),
// en ignorant un nom générique présent dans plusieurs rôles (ex. « membre »), sinon l'emoji Unicode du rôle.
function roleEmoji(guild,role,key,names=[],badges=new Map()){
 const emojis=[...(guild.emojis?.cache?.values()||[])].filter(e=>e.available!==false&&e.name);
 const show=e=>`<${e.animated?'a':''}:${e.name}:${e.id}>`;
 const forced=config.rosterEmojis?.[key];
 if(forced){const e=emojis.find(e=>e.id===String(forced)||e.name===forced);if(e)return show(e);}
 if(badges.get(role?.id))return badges.get(role.id);
 const name=normalizeName(role?.name);
 if(name){
  const exact=emojis.find(e=>normalizeName(e.name)===name);if(exact)return show(exact);
  const inside=emojis.filter(e=>{const n=normalizeName(e.name);return n.length>=4&&name.includes(n)&&names.filter(x=>x.includes(n)).length<=1;}).sort((x,y)=>normalizeName(y.name).length-normalizeName(x.name).length)[0];
  if(inside)return show(inside);
 }
 return role?.unicodeEmoji||'▫️';
}
// Équipes d'exécutants + le casino (Responsable du casino / Exécutant du casino, hors a.teams).
const leadKeys=()=>[...Object.values(a.teams),'casinoLead'],managerKeys=()=>[...Object.keys(a.teams),'casinoOperator'];
const teamKeys=()=>[...leadKeys(),...managerKeys()];
// Emojis du serveur retrouvés d'après le badge de chaque rôle de l'effectif.
async function badgeMap(guild){const r=a.state().schoolRoles||{};return require('../utils/qgRoleBadges').badgeEmojis(guild,rosterKeys().map(k=>guild.roles.cache.get(r[k])).filter(Boolean)).catch(e=>{console.error('Badges effectif QG :',e.message);return new Map();});}
const rosterKeys=()=>{const r=a.state().schoolRoles||{};return[...DIRECTION_KEYS,...familyKeys,...teamKeys()].filter(k=>r[k]&&r[k]!==excluded);};
// Emoji du serveur pour un titre de bloc. index : rang parmi les emojis de même nom, du plus ancien
// au plus récent (« :crown~1: » dans Discord = le deuxième emoji « crown », index 1). Repli sur le premier.
function titleEmoji(guild,name,index=0){
 const list=[...(guild.emojis?.cache?.values()||[])].filter(e=>e.name===name&&e.available!==false).sort((x,y)=>(BigInt(x.id)<BigInt(y.id)?-1:1));
 const e=list[index]||list[0];return e?`<${e.animated?'a':''}:${e.name}:${e.id}>`:null;
}
// Date d'arrivée dans la famille (enregistrée à l'acceptation), sinon date d'acceptation du dossier.
function arrival(id){
 const st=a.state(),app=st.schoolFamilyRecruitment?.[id];
 return st.schoolFamilyMembership?.[id]?.joinedAt||(app?.status==='accept'?(app.interviewFinishedAt||app.updatedAt):null);
}
// details : sous chaque grade de la famille, une ligne en petit par membre « @membre - date ».
function fullRoster(guild,members,badges=new Map(),{details=false}={}){
 const r=a.state().schoolRoles||{},teams=teamKeys();
 const all=[...DIRECTION_KEYS,...familyKeys,...teams].map(k=>normalizeName(guild.roles.cache.get(r[k])?.name)).filter(Boolean);
 const line=key=>{const id=r[key];if(!id||id===excluded)return null;const role=guild.roles.cache.get(id);if(!role)return null;
  const holders=members.filter(m=>m.roles.cache.has(id)),head=`${roleEmoji(guild,role,key,all,badges)} <@&${id}> - **${holders.length}**`;
  if(!details||!familyKeys.includes(key))return head;
  const rows=holders.map(m=>[m.id,arrival(m.id)]).sort((x,y)=>(x[1]||Infinity)-(y[1]||Infinity)||x[0].localeCompare(y[0]));
  return[head,...rows.map(([mid,at])=>`-# <@${mid}> - ${at?`<t:${Math.floor(at/1000)}:d>`:'date inconnue'}`)].join('\n');};
const head=(name,index,fallback,label)=>`${titleEmoji(guild,name,index)||fallback} ${label}`;
 return[[head('crown',1,'👑','Direction'),DIRECTION_KEYS],[head('gavel',0,'⭐','Responsables'),leadKeys()],[head('whitediamond',0,'🎖️','Grades de la famille'),[...familyKeys].reverse()],[head('support',0,'🛠️','Exécutants'),managerKeys()]]
  .map(([title,keys])=>({title,lines:keys.map(line).filter(Boolean)})).filter(x=>x.lines.length);
}
// Effectif en composants intégrés : total de la famille et un bloc par catégorie de rôles.
const TEXT_MAX=1900,MESSAGE_MAX=3600;
function rosterPages({total,summary}){
 const {ContainerBuilder,TextDisplayBuilder,SeparatorBuilder}=require('discord.js');
 // Blocs de texte : un titre puis ses lignes, coupés en morceaux de moins de TEXT_MAX caractères.
 const chunks=[];
 for(const part of summary||[]){
  let current=`### ${part.title}`;
  for(const line of part.lines.flatMap(l=>l.split('\n'))){
   if(current.length+1+line.length>TEXT_MAX){chunks.push({text:current,first:chunks.length===0||current.startsWith('### ')});current=line;}
   else current+='\n'+line;
  }
  chunks.push({text:current,first:current.startsWith('### ')});
 }
 const header=`## ✦ Effectifs de la famille QG\n**${total} MEMBRE${total>1?'S':''} DANS LA FAMILLE**`,footer=`-# Mis à jour <t:${Math.floor(Date.now()/1000)}:R>`;
 const pages=[[]];let size=header.length+footer.length;
 for(const c of chunks){if(size+c.text.length>MESSAGE_MAX&&pages.at(-1).length){pages.push([]);size=footer.length;}pages.at(-1).push(c);size+=c.text.length;}
 return pages.map((list,n)=>{
  const box=new ContainerBuilder().setAccentColor(0xffffff);
  if(n===0)box.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
  for(const c of list){if(c.first&&(n===0||list.indexOf(c)>0))box.addSeparatorComponents(new SeparatorBuilder());box.addTextDisplayComponents(new TextDisplayBuilder().setContent(c.text));}
  if(n===pages.length-1)box.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  return{components:[box],flags:F.IsComponentsV2,allowedMentions:{parse:[]}};
 });
}
const rosterPage=p=>rosterPages(p)[0];
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
   // Rattrapage : responsables déjà en place sans leur rôle d'exécutant.
   for(const m of (await require('../utils/qgMembers')(guild)).values())await leadRoles(m).catch(e=>console.error('Rôle exécutant du responsable :',e.code||e.message));
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
module.exports={leadRoles,execute,discover,recordVerification,recruited,memberChanged,roster,tick,family,announce,recruitPayload,fullRoster,badgeMap,_test:{rosterPage,rosterPages,fullRoster,roleEmoji}};
