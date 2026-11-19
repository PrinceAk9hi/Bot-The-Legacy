// Animation en direct.
// - 1 h avant : les invités (inscrits + membres des familles invitées) reçoivent l'accès au vocal d'attente.
// - À l'heure prévue : une catégorie est créée juste au-dessus des vocaux communautaires, avec :
//   · animation groupée : un vocal commun ;
//   · équipes : un vocal par équipe (chat du vocal réservé à l'équipe, membres mentionnés dedans), plus un vocal
//     de rassemblement si les équipes ne sont pas aléatoires ;
//   · un salon d'annonces (seuls Direction, Responsable et Exécutants animation écrivent) et un salon de discussion
//     commun à toutes les équipes.
//   Tout le monde (dont Hors du QG) voit les vocaux sans pouvoir les rejoindre ni lire leur chat ; une équipe voit
//   les vocaux des autres équipes sans pouvoir y entrer.
//   Les invités présents dans le vocal d'attente sont déplacés (au hasard dans les équipes si demandé), et la
//   confirmation est envoyée à l'animateur dans le salon 1561461409080934440.
// - Pendant l'animation : les retardataires du vocal d'attente sont déplacés, et un panneau « en direct » dans le
//   salon du panel animations permet de rendre muets / de rétablir tous les participants (sauf Direction,
//   Responsable et Exécutants animation) et de terminer l'animation (il faut être dans un vocal de l'animation).
// - Fin (bouton, ou 30 minutes après la fin prévue) : voix rétablies, salons supprimés, accès retirés.
// /testanim lance tout ce déroulé tout de suite (MP compris) pour vérifier que tout marche.
const {ChannelType:T,PermissionFlagsBits:P,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,SlashCommandBuilder}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const WAIT_ROOM='1561466341989425273',CONFIRM_CHANNEL='1561461409080934440',PANEL_CHANNEL='1562885442745929758';
const MIN=60000,CLEANUP_AFTER=30*MIN;
const STAFF_KEYS=['creator','globalManager','referent','animationLead','animationManagement'];
const waitUrl=()=>`https://discord.com/channels/${config.guildId}/${WAIT_ROOM}`;

const runs=()=>a.state().schoolAnimationLive||{};
const run=id=>runs()[id];
function put(id,fn){a.save(s=>{s.schoolAnimationLive||={};if(!s.schoolAnimationLive[id])throw Error('Animation en direct introuvable.');fn(s.schoolAnimationLive[id]);});return run(id);}
const staffRoles=()=>{const r=a.state().schoolRoles||{};return STAFF_KEYS.map(k=>r[k]).filter(Boolean);};
const isStaff=m=>a.isDirection(m)||staffRoles().some(id=>m.roles.cache.has(id));
const embed=(title,text,color=0xffffff)=>new EmbedBuilder().setColor(color).setTitle(title).setDescription(String(text).slice(0,4000)).setFooter(require('../utils/qgBrand').footer());

// Textes des MP aux invités.
const reminderText=(title,startAt)=>`**${title}** commence <t:${Math.floor(startAt/1000)}:R> (<t:${Math.floor(startAt/1000)}:t>).`;
const soonText=(title,startAt)=>`⏰ **${title}** commence dans 15 minutes (<t:${Math.floor(startAt/1000)}:t>).\n\nRejoins le vocal <#${WAIT_ROOM}> ([rejoindre](${waitUrl()})) : tu seras **déplacé automatiquement à l’heure prévue**.`;

// Répartition : équipes aléatoires de teamSize joueurs au plus (équipes équilibrées).
function shuffle(list,random=Math.random){const x=[...list];for(let n=x.length-1;n>0;n--){const k=Math.floor(random()*(n+1));[x[n],x[k]]=[x[k],x[n]];}return x;}
function teams(players,teamSize,random=Math.random){
 const count=Math.max(1,Math.ceil(players.length/Math.max(1,teamSize)));
 const out=Array.from({length:count},()=>[]);
 shuffle(players,random).forEach((id,n)=>out[n%count].push(id));
 return out;
}

// Permissions des salons de l'animation.
const VOICE_FULL=[P.ViewChannel,P.Connect,P.Speak,P.UseVAD,P.Stream,P.SendMessages,P.ReadMessageHistory];
function voiceOverwrites(guild,members){
 const r=a.state().schoolRoles||{},deny=[P.Connect,P.Speak,P.SendMessages,P.ReadMessageHistory];
 return[
  {id:guild.id,allow:[P.ViewChannel],deny},
  ...(r.outsideQG?[{id:r.outsideQG,allow:[P.ViewChannel],deny}]:[]),
  ...staffRoles().map(id=>({id,allow:[...VOICE_FULL,P.MoveMembers,P.MuteMembers]})),
  {id:guild.client.user.id,allow:[...VOICE_FULL,P.MoveMembers,P.MuteMembers,P.ManageChannels]},
  ...members.map(id=>({id,type:1,allow:VOICE_FULL}))];
}
function textOverwrites(guild,members,{write}){
 return[
  {id:guild.id,deny:[P.ViewChannel]},
  ...staffRoles().map(id=>({id,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages]})),
  {id:guild.client.user.id,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.ManageChannels]},
  ...members.map(id=>({id,type:1,allow:[P.ViewChannel,P.ReadMessageHistory,...(write?[P.SendMessages]:[])],deny:write?[]:[P.SendMessages]}))];
}

// 1 h avant : accès au vocal d'attente pour les invités qui n'y ont pas accès.
async function prepare(guild,{id,invitees}){
 const room=await guild.channels.fetch(WAIT_ROOM).catch(()=>null);if(!room)return 0;
 const added=[];
 for(const uid of invitees){
  const m=await guild.members.fetch(uid).catch(()=>null);if(!m)continue;
  if(room.permissionsFor(m)?.has([P.ViewChannel,P.Connect]))continue;
  await room.permissionOverwrites.edit(uid,{ViewChannel:true,Connect:true,Speak:true},{reason:'Invité à une animation'}).then(()=>added.push(uid),()=>{});
 }
 a.save(s=>{s.schoolAnimationAccess||={};s.schoolAnimationAccess[id]=[...new Set([...(s.schoolAnimationAccess[id]||[]),...added])];});
 return added.length;
}

// Démarrage : salons, déplacements, confirmation, panneau en direct.
async function start(guild,spec){
 const id=spec.id;
 if(run(id)?.categoryId)return run(id);
 const r=a.state().schoolRoles||{},cats=a.state().schoolCategories||{};
 const room=await guild.channels.fetch(WAIT_ROOM).catch(()=>null);
 const present=room?[...room.members.values()].filter(m=>!m.user.bot):[];
 // Invités présents ; sans liste d'invités (inscriptions libres), tout le monde dans le vocal d'attente.
 const invited=new Set(spec.invitees||[]);
 const players=present.filter(m=>!invited.size||invited.has(m.id)).map(m=>m.id);
 for(const extra of spec.alsoMove||[])if(!players.includes(extra))players.push(extra);
 const everyone=[...new Set([...(spec.invitees||[]),...players])];
 const teamMode=spec.format==='teams';
 const groups=teamMode?(spec.randomTeams?teams(players,spec.teamSize||5):Array.from({length:Math.max(1,Math.ceil(players.length/Math.max(1,spec.teamSize||5)))},()=>[])):[players];
 // Catégorie juste au-dessus des vocaux communautaires, au format « emoji〃NOM ».
 const category=await guild.channels.create({name:`🎉〃${String(spec.title).toUpperCase()}`.slice(0,95),type:T.GuildCategory,permissionOverwrites:[{id:guild.id,allow:[P.ViewChannel]},{id:guild.client.user.id,allow:[P.ViewChannel,P.ManageChannels,P.MoveMembers,P.MuteMembers]}],reason:'Animation en direct'});
 const anchor=cats.communityVoice&&await guild.channels.fetch(cats.communityVoice).catch(()=>null);
 if(anchor)await category.setPosition(anchor.position).catch(()=>{});
 const announce=await guild.channels.create({name:'📢・annonces-animation',type:T.GuildText,parent:category.id,permissionOverwrites:textOverwrites(guild,everyone,{write:false}),reason:'Animation en direct'});
 const discussion=await guild.channels.create({name:'💬・discussion-animation',type:T.GuildText,parent:category.id,permissionOverwrites:textOverwrites(guild,everyone,{write:true}),reason:'Animation en direct'});
 const voices=[];
 if(teamMode&&!spec.randomTeams){const v=await guild.channels.create({name:'🔊・Rassemblement',type:T.GuildVoice,parent:category.id,permissionOverwrites:voiceOverwrites(guild,everyone),reason:'Animation en direct'});voices.push({id:v.id,name:'Rassemblement',members:[...players],lobby:true});}
 for(const [n,members] of groups.entries()){
  const name=teamMode?`Équipe ${n+1}`:'Animation';
  const v=await guild.channels.create({name:`🔊・${name}`,type:T.GuildVoice,parent:category.id,permissionOverwrites:voiceOverwrites(guild,teamMode?members:everyone),reason:'Animation en direct'});
  voices.push({id:v.id,name,members:teamMode?members:[...players]});
 }
 a.save(s=>{s.schoolAnimationLive||={};s.schoolAnimationLive[id]={...spec,categoryId:category.id,announceId:announce.id,discussionId:discussion.id,voices,startedAt:Date.now(),muted:[]};});
 // Déplacements.
 const moved=[],failed=[];
 for(const v of voices){
  const targets=v.lobby||!teamMode||spec.randomTeams?v.members:[];
  for(const uid of targets){
   const m=await guild.members.fetch(uid).catch(()=>null);
   if(!m?.voice?.channelId){failed.push(uid);continue;}
   await m.voice.setChannel(v.id,'Début de l’animation').then(()=>moved.push(uid),()=>failed.push(uid));
  }
 }
 // Chaque équipe est mentionnée dans le chat de son vocal.
 if(teamMode)for(const v of voices.filter(x=>!x.lobby&&x.members.length)){
  const ch=await guild.channels.fetch(v.id).catch(()=>null);
  await ch?.send({content:`${v.members.map(x=>`<@${x}>`).join(' ')}\nVous êtes l’**${v.name}** ! Vous pouvez aussi discuter ici, dans le chat de votre vocal.`,allowedMentions:{parse:[],users:v.members}}).catch(()=>{});
 }
 await announce.send({embeds:[embed(`🎉 ${spec.title}`,`L’animation commence !${teamMode?`\n${voices.filter(v=>!v.lobby).map(v=>`**${v.name}** : ${v.members.map(x=>`<@${x}>`).join(', ')||'à compléter'}`).join('\n')}`:''}`)],allowedMentions:{parse:[]}}).catch(()=>{});
 const missing=(spec.invitees||[]).filter(x=>!players.includes(x));
 put(id,x=>{x.moved=moved;x.missing=missing;x.failed=failed;});
 await confirm(guild,run(id));
 await panel(guild,id);
 return run(id);
}

// Confirmation à l'animateur dans le salon dédié.
async function confirm(guild,rec){
 const ch=await guild.channels.fetch(CONFIRM_CHANNEL).catch(()=>null);if(!ch?.isTextBased?.())return false;
 const list=ids=>ids.length?ids.map(x=>`<@${x}>`).join(', '):'personne';
 const lines=[`${rec.test?'🧪 **Test** · ':''}**${rec.title}** a commencé.`,
  `✅ **${rec.moved.length}** déplacé${rec.moved.length>1?'s':''} : ${list(rec.moved)}`,
  rec.failed.length&&`⚠️ Déplacement impossible (pas en vocal ou permissions) : ${list(rec.failed)}`,
  rec.missing.length&&`⏳ Absents du vocal d’attente : ${list(rec.missing)}`,
  rec.format==='teams'&&rec.voices.filter(v=>!v.lobby).map(v=>`**${v.name}** : ${list(v.members)}`).join('\n'),
  `\nVocal : <#${rec.voices[0]?.id}> · Panneau en direct : <#${PANEL_CHANNEL}>`].filter(Boolean);
 await ch.send({content:`<@${rec.organizerId}>`,embeds:[embed(rec.missing.length||rec.failed.length?'⚠️ Animation lancée (tout le monde n’est pas là)':'✅ Tout le monde a été déplacé',lines.join('\n'),rec.missing.length||rec.failed.length?0xe67e22:0x2ecc71)],allowedMentions:{parse:[],users:[rec.organizerId]}});
 return true;
}

// Panneau en direct, sous le panel animations.
function livePayload(guild,rec){
 const voiceMembers=rec.voices.flatMap(v=>[...(guild.channels.cache.get(v.id)?.members?.values()||[])].filter(m=>!m.user.bot).map(m=>m.id));
 const expected=[...new Set(rec.voices.flatMap(v=>v.members))];
 const allHere=expected.length>0&&expected.every(x=>voiceMembers.includes(x));
 const text=[`Animateur : <@${rec.organizerId}>`,`🎙️ Présents : **${voiceMembers.length}**${expected.length?` / ${expected.length} attendus`:''}${allHere?' · ✅ tout le monde est là':''}`,
  ...rec.voices.map(v=>`<#${v.id}>`),`🔇 Muets : **${rec.muted.length}**`,'-# Il faut être dans un vocal de l’animation pour utiliser ces boutons.'].join('\n');
 const row=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('qgal:mute:'+rec.id).setLabel('Mute all').setEmoji('🔇').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('qgal:unmute:'+rec.id).setLabel('Unmute all').setEmoji('🔊').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('qgal:end:'+rec.id).setLabel('Terminer l’animation').setEmoji('🏁').setStyle(ButtonStyle.Secondary));
 return{embeds:[embed(`🔴 En direct${rec.test?' (test)':''} · ${rec.title}`,text,0xd62f2f)],components:[row],allowedMentions:{parse:[]}};
}
async function panel(guild,id){
 const rec=run(id);if(!rec||rec.endedAt)return;
 const ch=await guild.channels.fetch(PANEL_CHANNEL).catch(()=>null);if(!ch?.isTextBased?.())return;
 const p=livePayload(guild,rec),hash=JSON.stringify(p.embeds[0].data.description);
 if(rec.panelHash===hash&&rec.panelId)return;
 let msg=rec.panelId?await ch.messages.fetch(rec.panelId).catch(()=>null):null;
 if(msg)await msg.edit(p);else msg=await ch.send(p);
 put(id,x=>{x.panelId=msg.id;x.panelHash=hash;});
}

// Rendre muets / rétablir : tout le monde dans les vocaux de l'animation, sauf l'équipe animation et la Direction.
async function setMute(guild,id,mute){
 const rec=run(id);let n=0;const muted=new Set(rec.muted);
 for(const v of rec.voices){
  const ch=await guild.channels.fetch(v.id).catch(()=>null);
  for(const m of ch?.members?.values()||[]){
   if(m.user.bot||isStaff(m))continue;
   if(mute&&!m.voice.serverMute){await m.voice.setMute(true,'Animation : mute all').then(()=>{muted.add(m.id);n++;},()=>{});}
   if(!mute&&muted.has(m.id)){await m.voice.setMute(false,'Animation : unmute all').then(()=>{muted.delete(m.id);n++;},()=>{});}
  }
 }
 // Les personnes rendues muettes mais parties du vocal sont rétablies à leur retour (voir voice()).
 put(id,x=>{x.muted=[...muted];});
 return n;
}

// Fin : voix rétablies, salons supprimés, accès au vocal d'attente retirés.
async function end(guild,id,reason='Fin de l’animation'){
 const rec=run(id);if(!rec||rec.endedAt)return false;
 put(id,x=>{x.endedAt=Date.now();});
 for(const uid of rec.muted){const m=await guild.members.fetch(uid).catch(()=>null);if(m?.voice?.channelId)await m.voice.setMute(false,reason).catch(()=>{});}
 for(const cid of [...rec.voices.map(v=>v.id),rec.announceId,rec.discussionId,rec.categoryId]){const ch=await guild.channels.fetch(cid).catch(()=>null);await ch?.delete(reason).catch(()=>{});}
 const room=await guild.channels.fetch(WAIT_ROOM).catch(()=>null);
 for(const uid of a.state().schoolAnimationAccess?.[id]||[])await room?.permissionOverwrites.delete(uid,reason).catch(()=>{});
 a.save(s=>{if(s.schoolAnimationAccess)delete s.schoolAnimationAccess[id];});
 const ch=await guild.channels.fetch(PANEL_CHANNEL).catch(()=>null);
 if(rec.panelId)await ch?.messages.delete(rec.panelId).catch(()=>{});
 return true;
}

// Chaque minute : retardataires déplacés, panneau à jour, nettoyage après la fin prévue.
async function tick(guild,{now=Date.now()}={}){
 for(const rec of Object.values(runs())){
  if(rec.endedAt||!rec.categoryId)continue;
  if(now>=rec.endAt+CLEANUP_AFTER){await end(guild,rec.id,'Animation terminée');continue;}
  await lateArrivals(guild,rec.id);
  await panel(guild,rec.id).catch(()=>{});
 }
 // Anciennes animations terminées : retirées de l'état après 7 jours.
 a.save(s=>{for(const [k,v] of Object.entries(s.schoolAnimationLive||{}))if(v.endedAt&&now-v.endedAt>7*24*60*MIN)delete s.schoolAnimationLive[k];});
}
async function lateArrivals(guild,id){
 const rec=run(id),room=await guild.channels.fetch(WAIT_ROOM).catch(()=>null);if(!room)return 0;
 const invited=new Set(rec.invitees||[]);let n=0;
 for(const m of room.members.values()){
  if(m.user.bot||invited.size&&!invited.has(m.id))continue;
  let target=rec.voices.find(v=>v.members.includes(m.id));
  if(!target){
   // Nouveau joueur : l'équipe la moins remplie (ou le vocal commun / le rassemblement).
   const pool=rec.voices.filter(v=>rec.format!=='teams'||(rec.randomTeams?!v.lobby:v.lobby));
   target=pool.sort((x,y)=>x.members.length-y.members.length)[0];if(!target)continue;
   const ch=await guild.channels.fetch(target.id).catch(()=>null);
   await ch?.permissionOverwrites.edit(m.id,{ViewChannel:true,Connect:true,Speak:true,UseVAD:true,SendMessages:true,ReadMessageHistory:true}).catch(()=>{});
   put(id,x=>{x.voices.find(v=>v.id===target.id).members.push(m.id);});
  }
  await m.voice.setChannel(target.id,'Arrivée en retard à l’animation').then(()=>n++,()=>{});
 }
 return n;
}
// Une personne rendue muette qui revient dans un vocal hors animation retrouve sa voix.
async function voice(oldState,newState){
 if(newState.guild?.id!==config.guildId||!newState.channelId||!newState.serverMute)return;
 for(const rec of Object.values(runs())){
  if(!rec.muted?.includes(newState.id))continue;
  if(!rec.endedAt&&rec.voices.some(v=>v.id===newState.channelId))continue;
  await newState.setMute(false,'Hors de l’animation').catch(()=>{});
  a.save(s=>{const r=s.schoolAnimationLive?.[rec.id];if(r)r.muted=r.muted.filter(x=>x!==newState.id);});
 }
}

// Boutons du panneau en direct.
async function handle(i){
 if(!i.customId?.startsWith('qgal:'))return false;
 const [,op,id]=i.customId.split(':');
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const rec=run(id);if(!rec||rec.endedAt)return i.editReply('Cette animation est terminée.');
 const m=await i.guild.members.fetch({user:i.user.id,force:true});
 const animator=m.id===rec.organizerId||isStaff(m);
 if(!animator)return i.editReply('Réservé à l’animateur, à l’équipe animation et à la Direction.');
 if(!rec.voices.some(v=>v.id===m.voice.channelId))return i.editReply('Rejoins un vocal de l’animation pour utiliser ce panneau.');
 if(op==='mute'){const n=await setMute(i.guild,id,true);await panel(i.guild,id);return i.editReply(`🔇 ${n} participant${n>1?'s':''} rendu${n>1?'s':''} muet${n>1?'s':''}.`);}
 if(op==='unmute'){const n=await setMute(i.guild,id,false);await panel(i.guild,id);return i.editReply(`🔊 ${n} voix rétablie${n>1?'s':''}.`);}
 if(op==='end'){await end(i.guild,id);if(rec.eventId)require('./qgAnimations').save(s=>{const e=s.events[rec.eventId];if(e&&e.status==='En cours')e.status='À clôturer';});return i.editReply('🏁 Animation terminée : salons supprimés et voix rétablies.');}
 return i.editReply('Action inconnue.');
}

// Animation réelle : paramètres tirés de l'animation du calendrier.
function specOf(e,guests=[]){
 return{id:'event:'+e.id,eventId:e.id,title:e.title,organizerId:e.organizerId,format:e.format==='teams'?'teams':'group',teamSize:e.teamSize||5,randomTeams:!!e.randomTeams,
  invitees:[...new Set([...(e.participants||[]),...guests])],startAt:e.startAt,endAt:e.startAt+(e.minutes||60)*MIN};
}

// /testanim : déroulé complet tout de suite (MP 1 h et 15 min à toi, salons, déplacements, confirmation, panneau).
const data=new SlashCommandBuilder().setName('testanim').setDescription('Tester une animation en direct (salons, MP, déplacements)').setDMPermission(false)
 .addStringOption(o=>o.setName('mode').setDescription('Type d’animation à tester').setRequired(true).addChoices({name:'Équipes aléatoires',value:'aleatoire'},{name:'Équipe commune (animation groupée)',value:'commune'}))
 .addIntegerOption(o=>o.setName('joueurs').setDescription('Joueurs max par équipe (équipes aléatoires, 2 par défaut)').setMinValue(1).setMaxValue(25));
async function test(i){
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const m=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.isDirection(m)&&!a.has(m,['animationLead']))return i.editReply('Réservé à la Direction et au Responsable animation.');
 const active=Object.values(runs()).find(r=>r.test&&!r.endedAt);if(active)await end(i.guild,active.id,'Nouveau test');
 const random=i.options.getString('mode')==='aleatoire',now=Date.now(),id='test:'+now;
 const room=await i.guild.channels.fetch(WAIT_ROOM).catch(()=>null);
 const invitees=[...new Set([m.id,...[...(room?.members?.values()||[])].filter(x=>!x.user.bot).map(x=>x.id)])];
 const spec={id,test:true,title:random?'Test · équipes aléatoires':'Test · animation groupée',organizerId:m.id,format:random?'teams':'group',teamSize:i.options.getInteger('joueurs')||2,randomTeams:random,invitees,startAt:now,endAt:now+15*MIN,alsoMove:m.voice.channelId?[m.id]:[]};
 // MP tels que les invités les recevront.
 const dm=async text=>m.send({embeds:[embed('Animation • QG',text)]}).then(()=>true,()=>false);
 const dms=[await dm(reminderText(spec.title,now+60*MIN)),await dm(soonText(spec.title,now+15*MIN))];
 await prepare(i.guild,spec);
 const rec=await start(i.guild,spec);
 return i.editReply([`🧪 Test lancé : **${spec.title}**.`,`MP 1 h et 15 min : ${dms.every(Boolean)?'envoyés':'non remis (MP fermés ?)'}.`,`Déplacés : ${rec.moved.length} · Salons : <#${rec.voices[0].id}>.`,`Confirmation dans <#${CONFIRM_CHANNEL}>, panneau en direct dans <#${PANEL_CHANNEL}>.`,'Le test se termine avec le bouton « Terminer l’animation », sinon tout seul après 45 minutes.'].join('\n'));
}
module.exports={WAIT_ROOM,CONFIRM_CHANNEL,PANEL_CHANNEL,data,test,prepare,start,end,tick,voice,handle,specOf,setMute,reminderText,soonText,_test:{teams,shuffle,voiceOverwrites,textOverwrites,livePayload,lateArrivals}};
