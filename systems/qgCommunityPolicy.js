const { PermissionFlagsBits: P, EmbedBuilder, ChannelType } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');
const state = () => read('qgServer');
const save = fn => update('qgServer', fn);
const directionKeys = ['creator', 'globalManager', 'administrator'];
const voiceDenied = ['SendMessages','ReadMessageHistory','SendMessagesInThreads','CreatePublicThreads','CreatePrivateThreads','AddReactions','UseSoundboard','UseExternalSounds','PrioritySpeaker','SetVoiceChannelStatus'];
const readDenied = ['SendMessages','SendMessagesInThreads','CreatePublicThreads','CreatePrivateThreads','AddReactions','UseApplicationCommands'];
function exempt(member, s = state()) {
  return !!member && (member.id === config.ownerId || member.id === member.guild.ownerId || directionKeys.some(k => s.schoolRoles?.[k] && member.roles.cache.has(s.schoolRoles[k])));
}
const serial = new Map();
function locked(key, fn) {
  const next = (serial.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  serial.set(key, next); return next.finally(() => { if (serial.get(key) === next) serial.delete(key); });
}
async function log(guild, title, description) {
  try { const id = state().schoolChannels?.logsModeration; if (!id) return;
    const ch = await guild.channels.fetch(id);
    const memberId = /Membre : (\d{17,20})/.exec(description)?.[1], user = memberId ? await guild.client.users.fetch(memberId).catch(() => null) : null;
    const text = description.replace(/(Membre : )(\d{17,20})/g, '$1<@$2>').replace(/(Salon : )(\d{17,20})/g, '$1<#$2>');
    await ch.send({ embeds: [require('../utils/qgLog').entry({ kind: /non confirmée|non supprimé|nécessaire/.test(title + description) ? 'edit' : 'danger', icon: '🛡️', title, user, description: text.slice(0, 3500) })], allowedMentions: {parse:[]} });
  } catch (e) { console.error('Journal protection QG indisponible :', e.code || e.name); }
}
const bursts = new Map();
function spam(id, content, now = Date.now()) {
  const recent = (bursts.get(id) || []).filter(x => now - x.at < 20000);
  recent.push({at:now,text:content.trim().toLowerCase()}); bursts.set(id,recent.slice(-20));
  if (bursts.size > 2000) for (const [key, items] of bursts) if (now - items.at(-1).at > 20000) bursts.delete(key);
  return recent.filter(x=>now-x.at<8000).length >= 6 || (content.trim().length > 0 && recent.filter(x=>x.text===content.trim().toLowerCase()).length >= 4);
}
async function sanction(m) {
  return locked('sanction:'+m.author.id, async () => {
    const member = await m.guild.members.fetch(m.author.id); if(exempt(member)) return;
    const now=Date.now(), old=state().schoolModeration?.[member.id] || {strikes:0};
    if(old.blockedUntil>now || member.communicationDisabledUntilTimestamp>now) return;
    const strikes=Math.min(3,(old.strikes||0)+1), reason=`QG anti-spam ${member.id} ${m.id} niveau ${strikes}`;
    const rec={...old,strikes,reason,at:now,blockedUntil:now+(strikes===1?900000:strikes===2?86400000:60000),status:'pending',messageId:m.id};
    // Persist intent before Discord; uncertain API outcomes never trigger an automatic unban.
    save(s=>{s.schoolModeration||={};s.schoolModeration[member.id]=rec;});
    try {
      if(strikes===1) await member.timeout(900000,reason); else await m.guild.members.ban(member.id,{reason,deleteMessageSeconds:0});
      rec.status='applied'; if(strikes===2) rec.unbanAt=now+86400000;
      save(s=>{s.schoolModeration[member.id]=rec;});
      bursts.delete(member.id);
      await log(m.guild,'Protection anti-spam',`Membre : ${member.id}\nSanction : ${strikes===1?'timeout 15 minutes':strikes===2?'bannissement 24 heures':'bannissement définitif'}\nAntécédents conservés : ${strikes}\nRéférence : ${m.id}`);
    } catch(e) {
      save(s=>{s.schoolModeration[member.id]={...old,status:'review',failedReason:reason,blockedUntil:now+60000};});
      await log(m.guild,'Sanction non confirmée',`Membre : ${member.id}\nContrôle humain nécessaire. Code : ${e.code||e.name}. Aucun débannissement automatique programmé.`);
    }
  });
}
async function expireBans(guild) {
  if(guild.id!==config.guildId) return;
  for(const [id,rec] of Object.entries(state().schoolModeration||{})) {
    if(rec.status!=='applied'||rec.strikes!==2||!rec.unbanAt||rec.unbanAt>Date.now()) continue;
    await locked('sanction:'+id,async()=>{
      const current=state().schoolModeration?.[id]; if(current?.unbanAt!==rec.unbanAt||current.status!=='applied')return;
      try {
        const ban=await guild.bans.fetch(id).catch(e=>{if(e.code===10026)return null;throw e;});
        if(ban && ban.reason===rec.reason) await guild.members.unban(id,'Fin du bannissement anti-spam de 24 heures');
        save(s=>{s.schoolModeration[id].status=ban&&ban.reason!==rec.reason?'review':'expired'; delete s.schoolModeration[id].unbanAt;});
        await log(guild,'Fin du suivi du ban temporaire',`Membre : ${id}\n${ban&&ban.reason!==rec.reason?'Motif différent : ban conservé, examen humain nécessaire.':'Ban temporaire terminé. Antécédents conservés.'}`);
      } catch(e) { console.error('Expiration ban QG :',e.code||e.name); }
    });
  }
}
function hasMedia(m) {
  return [...(m.attachments?.values()||[])].some(a=>/^(image|video|audio)\//.test(a.contentType||'')) ||
    (m.embeds||[]).some(e=>['image','video','gifv'].includes(e.type)||e.image||e.video) ||
    /https:\/\/(?:(?:www\.)?(?:tenor\.com|giphy\.com)\/\S+|\S+\.(?:gif|png|jpe?g|webp|mp4|webm)(?:\?\S*)?)/i.test(m.content||'');
}
const invitePattern=/(?:discord\s*\.\s*gg|discord(?:app)?\s*\.\s*com\s*\/\s*invite)\s*\/\s*[\w-]+/i;
async function newcomerAttempt(guild,userId,content,reference){
 if(guild.id!==config.guildId)return false;
 const normalized=String(content||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');
 const domains=state().schoolCommunityPolicy?.blockedDomains||[];
 const blockedLink=[...normalized.matchAll(/https?:\/\/[^\s<>]+/gi)].some(([url])=>{
  try{const host=new URL(url).hostname.toLowerCase();return domains.some(d=>host===d||host.endsWith('.'+d));}catch{return false;}
 });
 const reason=/@(?:everyone|here)\b/i.test(normalized)?'tentative de mention générale':invitePattern.test(normalized)?'publication d’une invitation Discord':blockedLink?'lien figurant dans la liste de domaines interdits':null;
 if(!reason)return false;
 return locked('newcomer:'+userId,async()=>{
  const member=await guild.members.fetch({user:userId,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
  if(!member||exempt(member)||!member.joinedTimestamp||Date.now()-member.joinedTimestamp>=86400000)return false;
  const previous=state().schoolNewcomerIncidents?.[userId];
  if(previous?.joinedAt===member.joinedTimestamp&&['pending','kicked','review'].includes(previous.status))return true;
  const rec={joinedAt:member.joinedTimestamp,at:Date.now(),reference,reason,status:'pending'};
  save(s=>{s.schoolNewcomerIncidents||={};s.schoolNewcomerIncidents[userId]=rec;});
  rec.dmSent=await member.send({embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('Avertissement • QG').setDescription(`Motif détecté pendant tes premières 24 heures sur le serveur : ${reason}. Cette infraction entraîne ton exclusion du QG.`).setFooter(require('../utils/qgBrand').footer())],allowedMentions:{parse:[]}}).then(()=>true,()=>false);
  try{if(!member.kickable)throw Error('hierarchy');await member.kick(`Protection nouveaux membres : ${reason}`);rec.status='kicked';}
  catch(e){rec.status='review';rec.errorCode=String(e.code||e.message).slice(0,80);}
  save(s=>{s.schoolNewcomerIncidents[userId]=rec;});
  await log(guild,'Protection des premières 24 heures',`Membre : ${userId}\nMotif : ${reason}\nRésultat : ${rec.status==='kicked'?'exclusion effectuée':'exclusion non confirmée, intervention du staff nécessaire'}\nAvertissement MP : ${rec.dmSent?'envoyé':'non remis'}\nRéférence : ${reference}`);
  return true;
 });
}
async function remove(m) { try {await m.delete();} catch(e){if(e.code!==10008)await log(m.guild,'Message non supprimé',`Salon : ${m.channelId}\nMessage : ${m.id}\nCode : ${e.code||e.name}`);} }
async function thread(m,title) { return m.hasThread ? m.thread : m.startThread({name:title.slice(0,95),autoArchiveDuration:1440,reason:'Discussion communautaire QG'}); }
async function message(m,edited=false) {
  if(m.guildId!==config.guildId||m.author?.bot||!m.author)return false;
  if(await newcomerAttempt(m.guild,m.author.id,m.content,m.id)){await remove(m);return true;}
  const s=state(); if(!s.schoolCommunityPolicy?.enabled)return false;
  const member=m.member||await m.guild.members.fetch(m.author.id); const privileged=exempt(member,s);
  if(!privileged) {
    if(!edited&&spam(m.author.id,m.content||'')){await remove(m);await sanction(m);return true;}
    if(/@(?:everyone|here)\b/i.test(m.content||'')||invitePattern.test((m.content||'').normalize('NFKC'))){await remove(m);return true;}
  }
  const c=s.schoolChannels||{};
  if([c.communityMedia,c.familyMedia].filter(Boolean).includes(m.channelId)) {
    if(!hasMedia(m)){if(!privileged)await remove(m);return !privileged;}
    if(!edited)await thread(m,`Discussion • ${m.member?.displayName||m.author.username}`); return true;
  }
  if(!edited&&[c.communitySuggestions,c.familySuggestions].filter(Boolean).includes(m.channelId)&&!(m.content||'').startsWith('=')) {
    const discussion=await thread(m,`Suggestion • ${m.member?.displayName||m.author.username}`); await m.react('👍');await m.react('👎');
    const role=s.schoolRoles?.ticketsManagement;
    if(role)await discussion.send({content:`<@&${role}> Nouvelle suggestion : ${m.url}`,allowedMentions:{parse:[],roles:[role]}});
    return true;
  }
  if(!privileged&&[c.communityCommands,c.familyCommands].filter(Boolean).includes(m.channelId)&&!(m.content||'').startsWith('=')){await remove(m);return true;}
  return false;
}
async function reaction(reaction,user) {
  if(user.bot||reaction.message.guildId!==config.guildId)return false;
  const s=state();if(!s.schoolCommunityPolicy?.enabled)return false;
  const ch=reaction.message.channel,cats=s.schoolCategories||{};
  if(![cats.welcome,cats.information].filter(Boolean).includes(ch.parentId))return false;
  const member=await reaction.message.guild.members.fetch(user.id);
  if(!exempt(member,s))await reaction.users.remove(user.id);
  return true;
}
async function apply(guild,client) {
  if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');
  const s=state(),r=s.schoolRoles||{},c=s.schoolChannels||{},cats=s.schoolCategories||{};
  const all=await guild.channels.fetch(), me=await guild.members.fetchMe();
  if(!c.rules||!all.has(c.rules)||!r.community)throw Error('Règlement ou rôle communautaire introuvable.');
  if(!me.permissions.has([P.ManageChannels,P.ManageRoles,P.ManageMessages,P.ModerateMembers,P.BanMembers,P.CreatePublicThreads,P.SendMessagesInThreads]))throw Error('Permissions bot requises : gérer salons/rôles/messages, modérer et bannir, créer et écrire dans les fils.');
  const support=r.ticketsManagement&&await guild.roles.fetch(r.ticketsManagement);
  if(support&&!support.editable)throw Error('Place le rôle du bot au-dessus de Gestion Support / Support.');
  const giveaway=c.communityGiveaways&&all.get(c.communityGiveaways);
  if(giveaway&&(!cats.community||giveaway.parentId!==cats.community))throw Error('Giveaway communautaire déplacé : vérifie son emplacement avant la mise à jour.');
  const privileged=new Set(directionKeys.map(k=>r[k]).filter(Boolean));
  const publicCats=new Set(['welcome','information','community','communityVoice','support'].map(k=>cats[k]).filter(Boolean));
  const publicIds=new Set(layout.channels.filter(x=>['welcome','information','community','communityVoice','support'].includes(x[2])).map(x=>c[x[0]]).filter(Boolean));
  for(const ch of all.values()) {
    if(!ch||ch.isThread()||!ch.permissionOverwrites)continue;
    const isVoice=ch.isVoiceBased(), readOnly=[cats.welcome,cats.information].includes(ch.parentId)||[cats.welcome,cats.information].includes(ch.id);
    const denied=['MentionEveryone',...(isVoice?voiceDenied:readOnly?readDenied:[])];
    const entries=new Map([...ch.permissionOverwrites.cache.values()].map(o=>[o.id,{id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}]));
    function patch(id,values,type=0) {const o=entries.get(id)||{id,type,allow:0n,deny:0n};for(const [key,value] of Object.entries(values)){const bit=P[key];if(value){o.allow|=bit;o.deny&=~bit;}else{o.deny|=bit;o.allow&=~bit;}}entries.set(id,o);}
    // Keep manual private grants; new arrivals only have @everyone.
    patch(guild.id,{ViewChannel:ch.id===c.rules,...Object.fromEntries(denied.map(k=>[k,false]))});
    if(ch.id===c.rules)patch(guild.id,{ReadMessageHistory:true});
    if(publicCats.has(ch.id)||publicIds.has(ch.id))patch(r.community,{ViewChannel:true,...(!isVoice?{ReadMessageHistory:true}: {Connect:true,Speak:true,UseVAD:true}),...(!isVoice&&!readOnly?{SendMessages:true,SendMessagesInThreads:true,AttachFiles:true,EmbedLinks:true,UseApplicationCommands:true}:{} )});
    if(ch.id===c.familyCommands)for(const key of [...layout.directions,...layout.allFamily])if(r[key])patch(r[key],{SendMessages:true,UseApplicationCommands:true});
    if(readOnly)for(const id of privileged)patch(id,{ViewChannel:true,ReadMessageHistory:true,SendMessages:true,EmbedLinks:true,AttachFiles:true,UseApplicationCommands:true});
    for(const o of [...entries.values()]) {
      if(o.id===client.user.id||privileged.has(o.id))continue;
      if(o.type===1){const member=await guild.members.fetch(o.id).catch(e=>{if(e.code===10007)return null;throw e;});if(member?.user.bot||exempt(member,s))continue;}
      if(o.type===0&&guild.roles.cache.get(o.id)?.tags?.botId)continue;
      patch(o.id,Object.fromEntries(denied.map(k=>[k,false])),o.type);
      if(isVoice&&o.type===1&&s.schoolTemporaryVoices?.[ch.id]?.ownerId===o.id)patch(o.id,{ManageChannels:false,MoveMembers:false},1);
    }
    patch(client.user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageMessages:true,CreatePublicThreads:true,SendMessagesInThreads:true,EmbedLinks:true,AttachFiles:true,MentionEveryone:true},1);
    await ch.permissionOverwrites.set([...entries.values()],'Politique communautaire QG demandée');
  }
  if(support&&support.name!=='🎫・Gestion Support')await support.setName('🎫・Gestion Support','Renommage demandé');
  if(giveaway){if(!cats.community||giveaway.parentId!==cats.community)throw Error('Giveaway communautaire déplacé : suppression refusée, vérifier son emplacement.');await giveaway.delete('Suppression demandée du seul giveaway communautaire');}
  save(x=>{delete x.schoolChannels.communityGiveaways;if(x.schoolPanels)delete x.schoolPanels.communityGiveaways;
    for(const g of Object.values(x.schoolGiveaways||{}))if(c.communityGiveaways&&g.channelId===c.communityGiveaways&&g.status==='active'){g.status='cancelled';g.endedAt=Date.now();}
    x.schoolCommunityPolicy={enabled:true,version:1,updatedAt:Date.now()};});
  return {channels:all.size};
}
module.exports={apply,message,reaction,expireBans,exempt,newcomerAttempt,voiceDenied,readDenied,_test:{spam,hasMedia,invitePattern,sanction,bursts}};
