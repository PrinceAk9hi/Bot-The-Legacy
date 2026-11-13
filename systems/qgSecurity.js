// Sécurité du QG. Toutes les alertes vont dans le journal de la direction, avec mention du propriétaire
// pour les plus graves (raid, nuke).
// 1. Anti-phishing / token grab (tous les membres sauf le propriétaire) : liens d'arnaque (faux Nitro,
//    faux Steam, domaines qui imitent Discord / Steam / Roblox, domaines interdits) et fichiers exécutables
//    (.exe, .scr, .bat…) → message supprimé, pause 6 h, MP « compte peut-être piraté ».
// 2. Compte piraté : même message (ou même lien / fichier) dans 3 salons en 30 secondes → tous supprimés,
//    pause 6 h, MP.
// 3. Invitations vers d'autres serveurs, @everyone / @here, mentions de masse (5 membres ou 3 rôles et plus)
//    hors Direction → message supprimé, pause 10 minutes.
// 4. Anti-raid : 10 arrivées en 60 secondes → mode raid 30 minutes (prolongé à chaque nouvelle vague) ;
//    pendant le mode raid, les comptes Discord de moins de 7 jours sont expulsés. =raid on / =raid off.
// 5. Anti-nuke (journal d'audit) : suppressions / créations de salons ou rôles, bans, expulsions, webhooks
//    en masse, ajout d'un bot, permission Administrateur donnée → l'auteur perd tous ses rôles (un bot est
//    expulsé), le bot ajouté est expulsé, l'Administrateur est retiré. Exemptés : propriétaire, le bot,
//    config.securityTrustedIds.
// =securite : état de la protection (Direction).
const {AuditLogEvent:E,PermissionFlagsBits:P,EmbedBuilder}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const MIN=60000,HOUR=3600000,DAY=86400000;
const LONG=6*HOUR,SHORT=10*MIN;

// ---------- Liens ----------
const SAFE=['discord.com','discord.gg','discord.gift','discord.media','discordapp.com','discordapp.net','discord.new','discord.co',
 'roblox.com','rbxcdn.com','steampowered.com','steamcommunity.com','youtube.com','youtu.be','twitch.tv','tiktok.com','instagram.com',
 'twitter.com','x.com','tenor.com','giphy.com','imgur.com','google.com','spotify.com','reddit.com','github.com','wikipedia.org','medal.tv',
 'discord.js.org','discordjs.dev','discordstatus.com','discordmerch.com','rolimons.com','devforum.roblox.com'];
const safe=()=>[...SAFE,...(config.securitySafeDomains||[])];
// Marque et écart toléré (lettres changées) : steam seul n'est pas surveillé (trop de faux positifs).
const BRANDS=[['discord',2],['discordapp',2],['steamcommunity',3],['steampowered',3],['roblox',1],['nitro',0]];
// Arnaque probable : un appât (nitro, robux…) ET une promesse (gratuit, claim…) avec un lien inconnu.
const BAIT=/(nitro|robux|steam|gift|airdrop|cadeau|skins?)/i,PROMISE=/(free|gratuit|claim|@everyone|@here|giveaway|offert|r[ée]cup[ée]re|v[ée]rifi)/i;
// Sans http(s):// ni www., seules ces extensions comptent comme domaine (évite « roblox.exe », « photo.png »).
const TLDS=new Set('com net org gg gift ru xyz io co me app link site online shop store fr de uk us info biz top click live pro tk ml ga cf cc ly su pw icu fun space website'.split(' '));
const EXEC=/\.(exe|scr|bat|cmd|com|msi|vbs|vbe|js|jse|ps1|jar|apk|lnk|hta|pif|cpl|reg|dll)$/i;
const clean=t=>String(t||'').normalize('NFKC').replace(/[​-‍⁠﻿]/g,'');
function hosts(text){
 const out=new Set();
 for(const [,scheme,h] of clean(text).toLowerCase().matchAll(/(https?:\/\/|www\.)?(?:[\w.-]*@)?((?:[a-z0-9¡-￿-]+\.)+[a-z¡-￿]{2,})(?=[\/:?#\s>)\]]|$)/gi)){
  if(/^\d+(\.\d+)+$/.test(h))continue;
  if(!scheme&&!TLDS.has(h.split('.').pop()))continue;
  out.add(h.replace(/^www\./,''));
 }
 return[...out];
}
const within=(host,list)=>list.some(d=>host===d||host.endsWith('.'+d));
function distance(x,y){const d=Array.from({length:x.length+1},(_,i)=>[i]);for(let j=1;j<=y.length;j++)d[0][j]=j;for(let i=1;i<=x.length;i++)for(let j=1;j<=y.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(x[i-1]===y[j-1]?0:1));return d[x.length][y.length];}
// Domaine qui imite une marque (dlscord, discorcl, steamcommunlty, discord-nitro…) sans être le vrai.
function lookalike(host){
 if(within(host,safe()))return false;
 const labels=host.split('.').slice(0,-1);
 return labels.some(l=>{
  const flat=l.replace(/[^a-z0-9]/g,'').replace(/0/g,'o').replace(/[1l]/g,'i').replace(/rn/g,'m');
  return BRANDS.some(([b,max])=>{const bb=b.replace(/l/g,'i');return flat.includes(bb)||(max>0&&flat.length>=4&&distance(flat,bb)<=max);});
 });
}
// Raison de blocage d'un message (arnaque ou fichier dangereux), sinon null.
function scam(content,attachments=[],blocked=[]){
 for(const f of attachments)if(EXEC.test(f.name||''))return`fichier exécutable (${f.name})`;
 const list=hosts(content);
 for(const h of list){
  if(within(h,blocked))return`domaine interdit (${h})`;
  if(lookalike(h))return`lien qui imite un site officiel (${h})`;
 }
 const unknown=list.filter(h=>!within(h,safe()));
 if(unknown.length&&BAIT.test(clean(content))&&PROMISE.test(clean(content)))return`lien d’arnaque probable (${unknown[0]})`;
 return null;
}
const INVITE=/(?:discord(?:app)?\s*\.\s*(?:gg|com\s*\/\s*invite|me|io|li)|dsc\s*\.\s*gg)\s*\/\s*([\w-]+)/gi;
const invites=text=>[...clean(text).matchAll(INVITE)].map(x=>x[1]);

// ---------- Compte piraté : même contenu dans plusieurs salons ----------
const recent=new Map();
function fingerprint(m){
 const text=clean(m.content).toLowerCase().replace(/\s+/g,' ').trim();
 const files=[...(m.attachments?.values?.()||[])].map(f=>f.name).join('|');
 const key=text+'#'+files;
 return text.length>=8||files||hosts(text).length?key:null;
}
function burst(m,now=Date.now()){
 const key=fingerprint(m);if(!key)return null;
 const list=(recent.get(m.author.id)||[]).filter(x=>now-x.at<30000);
 list.push({key,channelId:m.channelId,at:now,message:m});
 recent.set(m.author.id,list);
 const same=list.filter(x=>x.key===key);
 if(new Set(same.map(x=>x.channelId)).size>=3){recent.delete(m.author.id);return same.map(x=>x.message);}
 return null;
}

// ---------- Outils ----------
const owner=(guild,id)=>id===config.ownerId||id===guild.ownerId||id===guild.client?.user?.id;
const trusted=(guild,id)=>owner(guild,id)||(config.securityTrustedIds||[]).includes(id);
const direction=member=>require('./qgCommunityPolicy').exempt(member);
async function alert(guild,title,text,{ping=false}={}){
 a.save(s=>{s.schoolSecurity||={};s.schoolSecurity.events=[...(s.schoolSecurity.events||[]),{at:Date.now(),title}].slice(-200);});
 const ch=await guild.channels.fetch(require('./qgDirectionJournal').CHANNEL).catch(()=>null);
 if(!ch?.isTextBased?.())return false;
 await ch.send({content:ping?`<@${config.ownerId}>`:null,embeds:[new EmbedBuilder().setColor(0xd62f2f).setTitle('🛡️ '+title).setDescription(String(text).slice(0,4000)).setFooter(require('../utils/qgBrand').footer()).setTimestamp()],allowedMentions:{parse:[],users:ping?[config.ownerId]:[]}}).catch(e=>console.error('Sécurité QG (alerte) :',e.code||e.message));
 return true;
}
async function pause(member,ms,reason){
 if(!member?.moderatable)return false;
 return member.timeout(ms,reason.slice(0,400)).then(()=>true,()=>false);
}
const DM_HACKED='⚠️ **Ton compte Discord semble piraté** : il a envoyé un lien d’arnaque, un fichier dangereux ou le même message dans plusieurs salons.\n\n1. Change ton mot de passe Discord tout de suite (ça déconnecte tout le monde).\n2. Active la double authentification.\n3. Ne lance jamais un fichier reçu et ne scanne aucun QR code « de vérification ».\n\nTu es en pause sur le QG le temps de sécuriser ton compte. Contacte la Direction si besoin.';

// ---------- Messages ----------
async function message(m,{edited=false}={}){
 if(m.guildId!==config.guildId||!m.author||m.author.bot||!m.guild)return false;
 if(owner(m.guild,m.author.id))return false;
 const member=m.member||await m.guild.members.fetch(m.author.id).catch(()=>null);
 const s=a.state(),blocked=[...(s.schoolCommunityPolicy?.blockedDomains||[]),...(config.securityBlockedDomains||[])];
 // 1. Arnaque / fichier dangereux : tout le monde (une Direction piratée aussi).
 const reason=scam(m.content,[...(m.attachments?.values?.()||[])],blocked);
 if(reason){
  await m.delete().catch(()=>{});
  const paused=await pause(member,LONG,'Sécurité QG : '+reason);
  const dm=await m.author.send(DM_HACKED).then(()=>true,()=>false);
  await alert(m.guild,'Lien ou fichier dangereux supprimé',`Membre : <@${m.author.id}> · Salon : <#${m.channelId}>\nMotif : ${reason}\nPause 6 h : ${paused?'oui':'non (permissions)'} · MP : ${dm?'envoyé':'fermé'}\n-# Contenu : ${clean(m.content).slice(0,300).replace(/https?:\/\//g,'hxxp://')||'(fichier)'}`);
  return true;
 }
 // 2. Compte piraté : même message dans 3 salons en 30 s.
 const spread=edited?null:burst(m);
 if(spread){
  for(const x of spread)await x.delete().catch(()=>{});
  const paused=await pause(member,LONG,'Sécurité QG : compte probablement piraté');
  const dm=await m.author.send(DM_HACKED).then(()=>true,()=>false);
  await alert(m.guild,'Compte probablement piraté',`Membre : <@${m.author.id}>\nMême message dans ${new Set(spread.map(x=>x.channelId)).size} salons en moins de 30 secondes : ${spread.length} messages supprimés.\nPause 6 h : ${paused?'oui':'non (permissions)'} · MP : ${dm?'envoyé':'fermé'}`);
  return true;
 }
 if(!member||direction(member))return false;
 // 3. @everyone / @here, mentions de masse, invitations vers d'autres serveurs.
 const text=clean(m.content);
 let why=null;
 if(/@(everyone|here)\b/i.test(text))why='tentative de mention @everyone / @here';
 else if((m.mentions?.users?.size||0)>=5||(m.mentions?.roles?.size||0)>=3)why='mentions de masse';
 else{
  for(const code of invites(text)){
   const inv=await m.client.fetchInvite(code).catch(()=>null);
   if(inv?.guild?.id!==config.guildId){why='invitation vers un autre serveur';break;}
  }
 }
 if(!why)return false;
 await m.delete().catch(()=>{});
 const paused=await pause(member,SHORT,'Sécurité QG : '+why);
 await alert(m.guild,'Message bloqué',`Membre : <@${m.author.id}> · Salon : <#${m.channelId}>\nMotif : ${why}\nPause 10 min : ${paused?'oui':'non (permissions)'}`);
 return true;
}

// ---------- Anti-raid ----------
const RAID_JOINS=10,RAID_WINDOW=MIN,RAID_MS=30*MIN,YOUNG=7*DAY;
let joins=[];
const raid=()=>a.state().schoolSecurity?.raid;
const raidOn=(now=Date.now())=>!!raid()?.on&&(!raid().until||raid().until>now);
function setRaid(on,{by=null,now=Date.now(),until=null}={}){a.save(s=>{s.schoolSecurity||={};s.schoolSecurity.raid=on?{on:true,since:s.schoolSecurity.raid?.on?s.schoolSecurity.raid.since:now,until,by}:{on:false,endedAt:now,by};});}
async function expelYoung(member,now=Date.now()){
 if(now-member.user.createdTimestamp>=YOUNG||!member.kickable)return false;
 await member.send('Le QG est en mode anti-raid : les comptes Discord de moins de 7 jours ne peuvent pas rejoindre pour le moment. Réessaie plus tard.').catch(()=>{});
 return member.kick('Mode anti-raid : compte de moins de 7 jours').then(()=>true,()=>false);
}
async function joined(member,{now=Date.now()}={}){
 if(member.guild.id!==config.guildId||member.user.bot)return false;
 joins=joins.filter(j=>now-j.at<RAID_WINDOW);joins.push({at:now,member});
 if(joins.length>=RAID_JOINS){
  const wasOn=raidOn(now);
  const manual=wasOn&&!raid().until;
  setRaid(true,{now,until:manual?null:now+RAID_MS});
  const wave=joins;joins=[];
  let kicked=0;for(const j of wave)if(await expelYoung(j.member,now))kicked++;
  await alert(member.guild,wasOn?'Raid : nouvelle vague':'Raid détecté — mode anti-raid activé',`${wave.length} arrivées en moins d’une minute.\n${kicked} compte(s) de moins de 7 jours expulsé(s).\n${manual?'Mode anti-raid manuel toujours actif.':`Mode anti-raid jusqu’à <t:${Math.floor((now+RAID_MS)/1000)}:t> (prolongé à chaque vague).`} \`=raid off\` pour l’arrêter.`,{ping:true});
  return true;
 }
 if(raidOn(now)&&await expelYoung(member,now)){
  a.save(s=>{s.schoolSecurity.raid.kicked=(s.schoolSecurity.raid.kicked||0)+1;});
  return true;
 }
 return false;
}
async function tick(guild,{now=Date.now()}={}){
 const r=raid();
 if(r?.on&&r.until&&r.until<=now){setRaid(false,{now});await alert(guild,'Mode anti-raid terminé',`Aucune nouvelle vague depuis 30 minutes.${r.kicked?` ${r.kicked} compte(s) expulsé(s) pendant le mode raid.`:''}`);}
}

// ---------- Anti-nuke ----------
const LIMITS={[E.ChannelDelete]:3,[E.RoleDelete]:3,[E.ChannelCreate]:6,[E.RoleCreate]:6,[E.MemberBanAdd]:3,[E.MemberKick]:5,[E.WebhookCreate]:3,[E.MemberPrune]:1};
const LABELS={[E.ChannelDelete]:'suppressions de salons',[E.RoleDelete]:'suppressions de rôles',[E.ChannelCreate]:'créations de salons',[E.RoleCreate]:'créations de rôles',[E.MemberBanAdd]:'bannissements',[E.MemberKick]:'expulsions',[E.WebhookCreate]:'créations de webhooks',[E.MemberPrune]:'purge de membres'};
const actions=new Map();
function count(executorId,type,now=Date.now()){
 const key=executorId+':'+type,list=(actions.get(key)||[]).filter(t=>now-t<MIN);
 list.push(now);actions.set(key,list);return list.length;
}
// Retire tous les rôles retirables de l'auteur ; un bot est expulsé.
async function neutralize(guild,id,reason){
 const member=await guild.members.fetch({user:id,force:true}).catch(()=>null);
 if(!member)return'introuvable';
 if(member.user.bot)return member.kick(reason).then(()=>'bot expulsé',()=>'expulsion impossible');
 const me=await guild.members.fetchMe();
 const keep=[...member.roles.cache.values()].filter(r=>r.id===guild.id||r.managed||me.roles.highest.comparePositionTo(r)<=0);
 const removed=member.roles.cache.size-keep.length;
 try{await member.roles.set(keep.filter(r=>r.id!==guild.id),reason);}catch{return'rôles non retirés (hiérarchie du bot)';}
 return keep.length>1?`${removed} rôle(s) retiré(s), ${keep.length-1} au-dessus du bot conservé(s)`:`${removed} rôle(s) retiré(s)`;
}
const adminAdded=entry=>(entry.changes||[]).some(c=>c.key==='permissions'&&(BigInt(c.new??0)&P.Administrator)&&!(BigInt(c.old??0)&P.Administrator));
async function audit(entry,guild,{now=Date.now()}={}){
 if(guild.id!==config.guildId)return false;
 const id=entry.executorId||entry.executor?.id;
 if(!id||trusted(guild,id))return false;
 const who=`<@${id}>`;
 // Bot ajouté par quelqu'un d'autre que le propriétaire : expulsé.
 if(entry.action===E.BotAdd){
  const bot=await guild.members.fetch(entry.targetId).catch(()=>null);
  const done=bot?await bot.kick('Sécurité QG : bot ajouté sans le propriétaire').then(()=>true,()=>false):false;
  await alert(guild,'Bot ajouté sans autorisation',`Ajouté par ${who} : <@${entry.targetId}>\n${done?'Le bot a été expulsé.':'Expulsion impossible : vérifie les permissions.'}\nSeul le propriétaire peut ajouter un bot (ou ajoute-le à config.securityTrustedIds).`,{ping:true});
  return true;
 }
 // Permission Administrateur donnée à un rôle : retirée, auteur neutralisé.
 if(entry.action===E.RoleUpdate&&adminAdded(entry)){
  const role=guild.roles.cache.get(entry.targetId)||await guild.roles.fetch(entry.targetId).catch(()=>null);
  const reverted=role?await role.setPermissions(role.permissions.remove(P.Administrator),'Sécurité QG : Administrateur non autorisé').then(()=>true,()=>false):false;
  const r=await neutralize(guild,id,'Sécurité QG : Administrateur donné à un rôle');
  await alert(guild,'Permission Administrateur bloquée',`${who} a donné Administrateur au rôle <@&${entry.targetId}>.\nAdministrateur retiré : ${reverted?'oui':'non'} · Auteur : ${r}`,{ping:true});
  return true;
 }
 // Rôle avec Administrateur donné à un membre : retiré, auteur neutralisé.
 if(entry.action===E.MemberRoleUpdate){
  const added=(entry.changes||[]).filter(c=>c.key==='$add').flatMap(c=>c.new||[]);
  const admin=added.map(r=>guild.roles.cache.get(r.id)).filter(r=>r?.permissions.has(P.Administrator));
  if(!admin.length)return false;
  const target=await guild.members.fetch(entry.targetId).catch(()=>null);
  const reverted=target?await target.roles.remove(admin,'Sécurité QG : rôle Administrateur non autorisé').then(()=>true,()=>false):false;
  const r=await neutralize(guild,id,'Sécurité QG : rôle Administrateur donné');
  await alert(guild,'Rôle Administrateur bloqué',`${who} a donné ${admin.map(x=>`<@&${x.id}>`).join(', ')} à <@${entry.targetId}>.\nRôle retiré : ${reverted?'oui':'non'} · Auteur : ${r}`,{ping:true});
  return true;
 }
 const limit=LIMITS[entry.action];if(!limit)return false;
 const n=count(id,entry.action,now);
 if(n!==limit)return false; // une seule réaction par vague
 const r=await neutralize(guild,id,`Sécurité QG : ${LABELS[entry.action]} en masse`);
 let extra='';
 if(entry.action===E.WebhookCreate){
  const hooks=await guild.fetchWebhooks().catch(()=>null);
  let deleted=0;for(const h of hooks?.values?.()||[])if(h.owner?.id===id)deleted+=await h.delete('Sécurité QG').then(()=>1,()=>0);
  extra=`\n${deleted} webhook(s) supprimé(s).`;
 }
 await alert(guild,'Tentative de destruction du serveur bloquée',`${who} : ${n} ${LABELS[entry.action]} en moins d’une minute.\nAuteur : ${r}${extra}`,{ping:true});
 return true;
}

// ---------- Commandes ----------
async function command(m){
 const match=/^=(raid|securite|sécurité)(?:\s+(on|off))?\s*$/i.exec(m.content.trim());
 if(m.guildId!==config.guildId||!match)return false;
 const member=m.member||await m.guild.members.fetch(m.author.id);
 if(!direction(member)){await m.reply({content:'Commande réservée à la Direction.',allowedMentions:{parse:[]}});return true;}
 if(match[1].toLowerCase()==='raid'&&match[2]){
  const on=match[2].toLowerCase()==='on';
  setRaid(on,{by:m.author.id,until:on?null:undefined});
  await a.audit(m.guild,{action:'security.raid.'+(on?'on':'off'),actorId:m.author.id}).catch(()=>{});
  await m.reply({content:on?'🛡️ Mode anti-raid **activé** (jusqu’à `=raid off`) : les comptes de moins de 7 jours sont expulsés à l’arrivée.':'Mode anti-raid **désactivé**.',allowedMentions:{parse:[]}});
  return true;
 }
 const r=raid(),events=(a.state().schoolSecurity?.events||[]).filter(e=>Date.now()-e.at<7*DAY);
 await m.reply({embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('🛡️ Sécurité du QG').setDescription([
  `Mode anti-raid : **${raidOn()?'activé'+(r.until?` jusqu’à <t:${Math.floor(r.until/1000)}:t>`:' (manuel)'):'désactivé'}**`,
  'Anti-phishing, fichiers dangereux, comptes piratés, @everyone, mentions de masse, invitations : **actifs**',
  'Anti-nuke (journal d’audit) : **actif**',
  `Alertes sur 7 jours : **${events.length}**`,
  ...events.slice(-5).reverse().map(e=>`-# <t:${Math.floor(e.at/1000)}:R> · ${e.title}`)].join('\n')).setFooter(require('../utils/qgBrand').footer())],allowedMentions:{parse:[]}});
 return true;
}
function reset(){recent.clear();joins=[];actions.clear();}
module.exports={message,joined,audit,tick,command,_test:{hosts,lookalike,scam,invites,burst,count,neutralize,raidOn,reset,LIMITS}};
