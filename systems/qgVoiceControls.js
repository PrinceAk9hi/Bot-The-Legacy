// Panel des vocaux temporaires, posté dans le tchat du vocal et présenté comme le panel recruteur.
// - Chaque réglage s'applique directement sur ce panel (aucune copie privée) : renommer (le nom garde
//   toujours « 🌲・ » devant), places, accès public / privé, membres autorisés (un seul menu : on coche ou
//   décoche), transfert de propriété.
// - « Appeler un gérant » : la raison est envoyée dans le salon 1561157154507853875 (gestion requête). Un
//   gérant répond « J'arrive dans 10 min », « 30 min » ou « Pas disponible » ; le panel du vocal affiche qui arrive et
//   qui n'est pas disponible. Un appel abusif (spam, troll) se sanctionne d'un bouton : exclusion temporaire de 6 h.
// Emojis du serveur : :crown: (le 2e, crown~1), :padlock_crown:, :strongpepe:, :gapolice:.
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,UserSelectMenuBuilder,EmbedBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const policy=require('./qgCommunityPolicy');
const state=()=>read('qgServer');
const save=fn=>update('qgServer',fn);
const row=(...items)=>new ActionRowBuilder().addComponents(items);
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const PREFIX='🌲・',REQUEST_CHANNEL='1561157154507853875',CALL_COOLDOWN=10*60000,ABUSE_MUTE=6*3600000,CLAIM_AFTER=5*60000;
const voiceName=name=>(PREFIX+String(name||'').replace(/^\s*🌲\s*・?\s*/u,'').trim()).slice(0,95);

// Emoji du serveur par nom (index : le 2e emoji du même nom pour crown~1), sinon l'emoji standard.
function emoji(guild,name,fallback,index=0){
 const list=[...(guild?.emojis?.cache?.values()||[])].filter(e=>e.name===name&&e.available!==false).sort((x,y)=>BigInt(x.id)<BigInt(y.id)?-1:1);
 const e=list[index]||list[0];
 return e?{text:`<${e.animated?'a':''}:${e.name}:${e.id}>`,button:{id:e.id,name:e.name,animated:!!e.animated}}:{text:fallback,button:fallback};
}
const icons=guild=>({crown:emoji(guild,'crown','👑',1),lock:emoji(guild,'padlock_crown','🔒'),people:emoji(guild,'strongpepe','👥'),police:emoji(guild,'gapolice','🚨')});

function panel(){return {embeds:[new EmbedBuilder().setFooter(require('../utils/qgBrand').footer()).setColor(0xffffff).setTitle('Mon vocal temporaire').setDescription('Rejoins « Créer sa voc », puis ouvre tes contrôles ici.\nRenomme ton salon, règle les places, verrouille l’accès et choisis les membres autorisés.')],components:[row(button('qgs:voice-controls','Gérer mon vocal',ButtonStyle.Primary))],allowedMentions:{parse:[]}};}

// Ligne d'état de l'appel à un gérant, affichée dans le panel du vocal.
function callLine(call){
 if(!call)return'';
 const parts=[`Appel de <@${call.requesterId}> <t:${Math.floor(call.at/1000)}:R>`];
 if(call.claimedBy)parts.push(`<@${call.claimedBy}> arrive ${call.eta?`dans **${call.eta} min**`:'bientôt'}`);
 else if(!call.closed)parts.push('en attente d’un gérant');
 if(call.unavailable?.length)parts.push(`pas disponible : ${call.unavailable.map(x=>`<@${x}>`).join(', ')}`);
 if(call.closed==='abuse')parts.push('appel jugé abusif');
 return parts.join(' · ');
}
// Panel du vocal : boutons à droite de chaque fonction, puis le menu des membres autorisés et le transfert.
function controls(id,rec,{lead=null,mention=null,guild=null,limit=null}={}){
 const d=require('discord.js'),text=c=>new d.TextDisplayBuilder().setContent(c),ic=icons(guild);
 const item=(label,description,btn)=>new d.SectionBuilder().addTextDisplayComponents(text(`**${label}**\n${description}`)).setButtonAccessory(btn);
 const allowed=(rec.allowed||[]).slice(0,25);
 const box=new d.ContainerBuilder().setAccentColor(0xffffff)
  .addTextDisplayComponents(text(`${lead?lead+'\n':''}## 🌲 <#${id}>\n${ic.crown.text} Propriétaire : <@${rec.ownerId}>`))
  .addSeparatorComponents(new d.SeparatorBuilder())
  .addSectionComponents(
   item('✏️ Renommer','Le nom garde toujours « 🌲・ » devant.',button(`qgs:voice:rename:${id}`,'Renommer')),
   item(`${ic.people.text} Places`,`${limit?`**${limit}** places`:'Places illimitées'} (0 = illimité).`,button(`qgs:voice:limit:${id}`,'Places').setEmoji(ic.people.button)),
   item(`${ic.lock.text} Accès : ${rec.locked?'privé':'public'}`,rec.locked?'Seuls les membres autorisés peuvent entrer.':'Tous les membres qui ont accès au salon peuvent entrer.',button(`qgs:voice:${rec.locked?'unlock':'lock'}:${id}`,rec.locked?'Rendre public':'Rendre privé',ButtonStyle.Primary).setEmoji(ic.lock.button)),
   item(`📷 Caméra et stream : ${rec.noStream?'désactivés':'autorisés'}`,rec.noStream?'Seul le propriétaire peut activer sa caméra ou partager son écran.':'Tout le monde peut activer sa caméra et partager son écran.',button(`qgs:voice:${rec.noStream?'stream-on':'stream-off'}:${id}`,rec.noStream?'Autoriser':'Désactiver')),
   item(`${ic.police.text} Appeler un gérant`,rec.call?callLine(rec.call):'Un problème dans le vocal ? Un gérant est prévenu. Appel abusif = 6 h d’exclusion.',button(`qgs:voice:call:${id}`,'Appeler',ButtonStyle.Danger).setEmoji(ic.police.button)),
   item(`${ic.crown.text} Récupérer la propriété`,`Si le propriétaire a quitté le vocal depuis ${CLAIM_AFTER/60000} minutes, un membre présent peut la reprendre.`,button(`qgs:voice:claim:${id}`,'Récupérer').setEmoji(ic.crown.button)))
  .addSeparatorComponents(new d.SeparatorBuilder())
  .addTextDisplayComponents(text(`### ${ic.people.text} Membres\n-# Coche ou décoche. Les autorisations n’ouvrent pas un vocal famille aux personnes extérieures à la famille.`))
  .addActionRowComponents(
   row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:members:${id}`).setPlaceholder('✅ Membres autorisés').setMinValues(0).setMaxValues(25).setDefaultUsers(allowed)),
   row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:blocked:${id}`).setPlaceholder('⛔ Membres bloqués (jamais dans ta voc)').setMinValues(0).setMaxValues(25).setDefaultUsers((rec.blocked||[]).slice(0,25))),
   row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:kick:${id}`).setPlaceholder('👢 Expulser un membre du vocal').setMaxValues(1)),
   row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:transfer:${id}`).setPlaceholder('👑 Transférer la propriété (membre dans la voc)').setMaxValues(1)));
 return {components:[box],flags:d.MessageFlags.IsComponentsV2,allowedMentions:{parse:[],users:mention?[mention]:[]}};
}
// Panel du tchat du vocal remis à jour (après un réglage ou une réponse à un appel).
async function refreshPanel(guild,id){
 const rec=state().schoolTemporaryVoices?.[id];if(!rec?.panelId)return false;
 const room=await guild.channels.fetch(id).catch(()=>null);if(!room)return false;
 const msg=await room.messages.fetch(rec.panelId).catch(()=>null);if(!msg)return false;
 await msg.edit({...controls(id,rec,{guild,limit:room.userLimit}),allowedMentions:{parse:[]}}).catch(()=>{});
 return true;
}
// Transfert de propriété : accès propriétaire au nouveau, et nouveau panel dans le tchat du vocal.
async function transfer(room,target,{reason='Transfert de propriété'}={}){
 const rec=state().schoolTemporaryVoices?.[room.id];if(!rec)throw Error('Ce vocal temporaire n’est plus suivi.');
 const previous=rec.ownerId;
 await room.permissionOverwrites.edit(target.id,{ViewChannel:true,Connect:true,Speak:true,UseVAD:true,...Object.fromEntries(policy.voiceDenied.map(k=>[k,false])),ReadMessageHistory:true},{reason});
 if(previous&&previous!==target.id)await room.permissionOverwrites.edit(previous,{ReadMessageHistory:false},{reason}).catch(()=>{});
 save(x=>{x.schoolTemporaryVoices[room.id].ownerId=target.id;x.schoolTemporaryVoices[room.id].transferredAt=Date.now();});
 const p=controls(room.id,state().schoolTemporaryVoices[room.id],{guild:room.guild,limit:room.userLimit,lead:`<@${target.id}> tu es maintenant propriétaire de ce vocal${previous&&previous!==target.id?` (à la place de <@${previous}>)`:''}. Voici tes réglages.`,mention:target.id});
 const msg=await room.send(p).catch(e=>{console.error('Transfert du vocal temporaire :',e.code||e.message);return null;});
 if(msg)save(x=>{x.schoolTemporaryVoices[room.id].panelId=msg.id;});
 return previous;
}
function eligible(member,rec,s){const r=s.schoolRoles||{};return policy.exempt(member,s)||(rec.kind==='family'?require('../config/qgSchoolLayout').allFamily.some(k=>r[k]&&member.roles.cache.has(r[k])):!!r.community&&member.roles.cache.has(r.community));}

// ---------- Appel d'un gérant ----------
function requestPayload(id,call){
 const status=call.closed==='abuse'?`⛔ Appel abusif : <@${call.requesterId}> exclu 6 h par <@${call.closedBy}>`:call.claimedBy?`✅ <@${call.claimedBy}> arrive dans **${call.eta} min**`:'⏳ En attente d’un gérant';
 const e=new EmbedBuilder().setColor(call.closed==='abuse'?0x95a5a6:call.claimedBy?0x2ecc71:0xd62f2f).setTitle('🚨 Appel d’un gérant · vocal').setFooter(require('../utils/qgBrand').footer())
  .setDescription([`**Vocal :** <#${id}>`,`**Demandé par :** <@${call.requesterId}>`,`**Raison :** ${call.reason}`,'',status,call.unavailable?.length?`🚫 Pas disponible : ${call.unavailable.map(x=>`<@${x}>`).join(', ')}`:null].filter(x=>x!==null).join('\n')).setTimestamp(call.at);
 const done=call.closed==='abuse';
 return{embeds:[e],components:[row(
  button(`qgs:vcall:eta10:${id}`,'J’arrive dans 10 min',ButtonStyle.Success).setDisabled(done),
  button(`qgs:vcall:eta30:${id}`,'J’arrive dans 30 min',ButtonStyle.Primary).setDisabled(done),
  button(`qgs:vcall:busy:${id}`,'Pas disponible').setDisabled(done),
  button(`qgs:vcall:abuse:${id}`,'Abus · exclure 6 h',ButtonStyle.Danger).setDisabled(done))],allowedMentions:{parse:[]}};
}
async function call(i,id,rec,reason){
 const prior=rec.call;
 if(prior&&!prior.closed&&Date.now()-prior.at<CALL_COOLDOWN)throw Error('Un gérant a déjà été appelé il y a moins de 10 minutes.');
 const ch=await i.guild.channels.fetch(REQUEST_CHANNEL).catch(()=>null);if(!ch?.isTextBased?.())throw Error('Salon des requêtes introuvable : préviens la direction.');
 const c={requesterId:i.user.id,reason:reason.slice(0,500),at:Date.now(),unavailable:[]};
 const msg=await ch.send(requestPayload(id,c));
 save(x=>{x.schoolTemporaryVoices[id].call={...c,messageId:msg.id};});
}
async function answer(i){
 const [,,op,id]=i.customId.split(':');
 const rec=state().schoolTemporaryVoices?.[id];
 if(!rec?.call){await i.reply({content:'Ce vocal n’existe plus ou l’appel est terminé.',flags:MessageFlags.Ephemeral});return true;}
 if(rec.call.closed==='abuse'){await i.reply({content:'Cet appel est clos.',flags:MessageFlags.Ephemeral});return true;}
 await i.deferUpdate();
 if(op==='abuse'){
  const requester=await i.guild.members.fetch(rec.call.requesterId).catch(()=>null);
  const muted=requester?.moderatable?await requester.timeout(ABUSE_MUTE,`Appel abusif d’un gérant (vocal) — ${i.user.tag}`).then(()=>true,()=>false):false;
  save(x=>{Object.assign(x.schoolTemporaryVoices[id].call,{closed:'abuse',closedBy:i.user.id,muted});});
  await require('../utils/qgAdmin').audit(i.guild,{action:'sanction.voice-call-abuse',actorId:i.user.id,targetId:rec.call.requesterId,reason:`Appel abusif : ${rec.call.reason}`}).catch(()=>{});
 }else if(op==='busy')save(x=>{const c=x.schoolTemporaryVoices[id].call;c.unavailable=[...new Set([...(c.unavailable||[]),i.user.id])];if(c.claimedBy===i.user.id){delete c.claimedBy;delete c.eta;}});
 else save(x=>{const c=x.schoolTemporaryVoices[id].call;c.claimedBy=i.user.id;c.eta=op==='eta10'?10:30;c.unavailable=(c.unavailable||[]).filter(u=>u!==i.user.id);});
 await i.editReply(requestPayload(id,state().schoolTemporaryVoices[id].call));
 await refreshPanel(i.guild,id);
 return true;
}

const busy=new Set();
async function handle(i){
 if(i.customId?.startsWith('qgs:vcall:'))return answer(i);
 if(i.customId!=='qgs:voice-controls'&&!i.customId?.startsWith('qgs:voice:')&&!i.customId?.startsWith('qgs:voice-form:'))return false;
 if(i.guildId!==config.guildId){await i.reply({content:'Action réservée au QG.',flags:MessageFlags.Ephemeral});return true;}
 const member=await i.guild.members.fetch(i.user.id),s=state();
 const id=i.customId==='qgs:voice-controls'?member.voice.channelId:i.customId.split(':')[3];
 const rec=s.schoolTemporaryVoices?.[id];
 const action=i.customId.split(':')[2];
 // Appeler un gérant ou récupérer la propriété : aussi pour un membre présent dans le vocal.
 const callAllowed=['call','claim'].includes(action)&&rec&&(member.voice.channelId===id||member.id===rec.ownerId);
 if(!rec||!(callAllowed||member.id===rec.ownerId||policy.exempt(member,s))){await i.reply({content:'Seuls le propriétaire de ce vocal et la Direction peuvent le modifier.',flags:MessageFlags.Ephemeral});return true;}
 if(['rename','limit','call'].includes(action)&&!i.customId.startsWith('qgs:voice-form:')){
  const label={rename:'Nouveau nom (après « 🌲・ »)',limit:'De 0 (illimité) à 99',call:'Raison de l’appel'}[action];
  await i.showModal(new ModalBuilder().setCustomId(`qgs:voice-form:${action}:${id}`).setTitle({rename:'Renommer le vocal',limit:'Nombre de places',call:'Appeler un gérant'}[action]).addComponents(row(new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(action==='call'?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(true).setMaxLength({rename:80,limit:2,call:500}[action]))));return true;
 }
 // Ancien bouton des salons commandes : panel privé. Sinon, le réglage s'applique sur le panel lui-même.
 const legacy=i.customId==='qgs:voice-controls';
 if(legacy)await i.deferReply({flags:MessageFlags.Ephemeral});else await i.deferUpdate();
 const fail=content=>legacy?i.editReply({content,embeds:[],components:[]}):i.followUp({content,flags:MessageFlags.Ephemeral});
 if(busy.has(id)){await fail('Une modification est déjà en cours. Réessaie dans un instant.');return true;}
 busy.add(id);
 try {
  const room=await i.guild.channels.fetch(id);if(!room?.isVoiceBased())throw Error('Ce vocal n’existe plus.');
  if(!legacy&&i.message?.id)save(x=>{x.schoolTemporaryVoices[id].panelId=i.message.id;});
  if(legacy){await i.editReply(controls(id,rec,{guild:i.guild,limit:room.userLimit}));return true;}
  if(i.customId.startsWith('qgs:voice-form:')){
   const value=i.fields.getTextInputValue('value').trim();
   if(action==='rename'){const name=voiceName(value);if(name===PREFIX||/@(?:everyone|here)/i.test(value))throw Error('Nom invalide.');await room.setName(name);}
   else if(action==='limit'){if(!/^\d{1,2}$/.test(value))throw Error('Indique un nombre entre 0 et 99.');await room.setUserLimit(Number(value));}
   else if(action==='call'){if(!value)throw Error('Indique la raison de l’appel.');await call(i,id,state().schoolTemporaryVoices[id],value);}
  }else if(['lock','unlock'].includes(action)){
   const locked=action==='lock';
   const current=state().schoolTemporaryVoices[id];
   if(locked!==current.locked){
    if(locked){
     const previous={};
     for(const o of room.permissionOverwrites.cache.values())if(o.type===0&&!['creator','globalManager','administrator'].some(k=>s.schoolRoles?.[k]===o.id)&&!i.guild.roles.cache.get(o.id)?.tags?.botId)previous[o.id]=o.allow.has('Connect')?true:o.deny.has('Connect')?false:null;
     save(x=>{x.schoolTemporaryVoices[id].previousConnect=previous;});
     await Promise.all(Object.keys(previous).map(key=>room.permissionOverwrites.edit(key,{Connect:false})));
    }else await Promise.all(Object.entries(current.previousConnect||{}).map(([key,value])=>room.permissionOverwrites.edit(key,{Connect:value})));
    save(x=>{x.schoolTemporaryVoices[id].locked=locked;});
   }
  }else if(action==='transfer'){
   const target=await i.guild.members.fetch(i.values[0]);
   if(target.user.bot||target.id===rec.ownerId)throw Error('Sélectionne un autre membre.');
   if(target.voice.channelId!==id)throw Error('Le nouveau propriétaire doit être dans le vocal.');
   await transfer(room,target,{reason:`Transfert par ${member.user.tag}`});
  }else if(action==='claim'){
   // Récupérer la propriété : seulement sur demande, propriétaire parti depuis assez longtemps.
   if(member.id===rec.ownerId)throw Error('Tu es déjà le propriétaire de ce vocal.');
   if(member.voice.channelId!==id)throw Error('Rejoins le vocal pour récupérer sa propriété.');
   if(room.members?.has?.(rec.ownerId))throw Error('Le propriétaire est encore dans le vocal.');
   const left=rec.ownerLeftAt;
   if(!left||Date.now()-left<CLAIM_AFTER)throw Error(`Le propriétaire doit avoir quitté le vocal depuis ${CLAIM_AFTER/60000} minutes${left?` (encore <t:${Math.ceil((left+CLAIM_AFTER)/1000)}:R>)`:''}.`);
   await transfer(room,member,{reason:'Propriété récupérée (propriétaire absent)'});
   save(x=>{delete x.schoolTemporaryVoices[id].ownerLeftAt;});
  }else if(['stream-on','stream-off'].includes(action)){
   // Caméra et partage d'écran : refusés à tous (rôles), le propriétaire les garde.
   const off=action==='stream-off';
   const roles=[...room.permissionOverwrites.cache.values()].filter(o=>o.type===0&&!i.guild.roles.cache.get(o.id)?.tags?.botId).map(o=>o.id);
   await Promise.all([...new Set([i.guild.id,...roles])].map(rid=>room.permissionOverwrites.edit(rid,{Stream:off?false:null})));
   await room.permissionOverwrites.edit(rec.ownerId,{Stream:off?true:null}).catch(()=>{});
   save(x=>{x.schoolTemporaryVoices[id].noStream=off;});
  }else if(action==='kick'){
   const target=await i.guild.members.fetch(i.values[0]).catch(()=>null);
   if(!target||target.user.bot||target.id===rec.ownerId||policy.exempt(target,s))throw Error('Ce membre ne peut pas être expulsé d’ici.');
   if(target.voice.channelId===id)await target.voice.disconnect('Expulsé du vocal par le propriétaire');
   // Vocal privé : il perd aussi son autorisation.
   if(rec.locked&&(rec.allowed||[]).includes(target.id)){await room.permissionOverwrites.delete(target.id).catch(()=>{});save(x=>{x.schoolTemporaryVoices[id].allowed=(x.schoolTemporaryVoices[id].allowed||[]).filter(u=>u!==target.id);});}
  }else if(action==='blocked'){
   // Bloqués : ne peuvent jamais entrer, même vocal public ; déconnectés s'ils y sont.
   const before=new Set(rec.blocked||[]),after=new Set(i.values),refused=[];
   for(const uid of [...after].filter(x=>!before.has(x))){
    const target=await i.guild.members.fetch(uid).catch(()=>null);
    if(!target||target.user.bot||target.id===rec.ownerId||policy.exempt(target,s)){after.delete(uid);refused.push(uid);continue;}
    await room.permissionOverwrites.edit(uid,{Connect:false});
    if(target.voice.channelId===id)await target.voice.disconnect('Bloqué par le propriétaire du vocal').catch(()=>{});
   }
   for(const uid of [...before].filter(x=>!after.has(x)))await room.permissionOverwrites.delete(uid).catch(()=>{});
   save(x=>{const r=x.schoolTemporaryVoices[id];r.blocked=[...after];r.allowed=(r.allowed||[]).filter(u=>!after.has(u));});
   if(refused.length)await i.followUp({content:`Impossible de bloquer : ${refused.map(x=>`<@${x}>`).join(', ')} (propriétaire, Direction ou bot).`,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }else if(action==='members'){
   // Un seul menu : les membres cochés sont autorisés, ceux décochés perdent leur autorisation.
   const before=new Set(rec.allowed||[]),after=new Set(i.values);
   const added=[...after].filter(x=>!before.has(x)),removed=[...before].filter(x=>!after.has(x)),refused=[];
   for(const uid of added){
    const target=await i.guild.members.fetch(uid).catch(()=>null);
    if(!target||target.user.bot||target.id===rec.ownerId||policy.exempt(target,s)||!eligible(target,rec,s)){after.delete(uid);refused.push(uid);continue;}
    await room.permissionOverwrites.edit(uid,{ViewChannel:true,Connect:true,...Object.fromEntries(policy.voiceDenied.map(k=>[k,false]))});
   }
   for(const uid of removed)await room.permissionOverwrites.delete(uid).catch(()=>{});
   save(x=>{const r=x.schoolTemporaryVoices[id];r.allowed=[...after];r.blocked=(r.blocked||[]).filter(u=>!after.has(u));});
   if(refused.length)await i.followUp({content:`Non autorisés (propriétaire, Direction, bot ou sans l’accès requis) : ${refused.map(x=>`<@${x}>`).join(', ')}`,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
  const fresh=await i.guild.channels.fetch(id).catch(()=>room);
  await i.editReply({...controls(id,state().schoolTemporaryVoices[id],{guild:i.guild,limit:fresh.userLimit}),allowedMentions:{parse:[]}});
  return true;
 }catch(e){await fail(e.code?`Action impossible (code ${e.code}). Vérifie les permissions du bot.`:e.message);return true;}finally{busy.delete(id);}
}
module.exports={panel,controls,handle,eligible,transfer,refreshPanel,voiceName,requestPayload,PREFIX,REQUEST_CHANNEL,_test:{callLine,emoji}};
