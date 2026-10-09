const {Events,ChannelType:T,PermissionFlagsBits:P,MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder}=require('discord.js');
const config=require('../config/qg'),layout=require('../config/qgLayout');
const {read,update}=require('../utils/recruitmentData');
const locks=new Map();let installing=false;
const seeds=require('../config/qgSeeds');
const saved=()=>{const s=read('qgServer');return {...seeds,...s,roles:{...seeds.roles,...s.roles},levelRoles:{...seeds.levelRoles,...s.levelRoles},categories:{...seeds.categories,...s.categories},channels:{...seeds.channels,...s.channels},panels:{...seeds.panels,...s.panels}};};
const store=fn=>update('qgServer',fn);
const serial=(key,fn)=>{const next=(locks.get(key)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(key,next);next.finally(()=>{if(locks.get(key)===next)locks.delete(key);}).catch(()=>{});return next;};
const allowedMentions={parse:[]};
function checkGuild(guild){if(!config.guildId||guild.id!==config.guildId)throw Error('Installation réservée au serveur QG configuré.');}
async function panel(channel,key,payload,client){
 const s=saved();let message;
 if(s.panels?.[key])message=await channel.messages.fetch(s.panels[key]).catch(e=>{if(e.code!==10008)throw e;return null;});
 if(!message){const recent=await channel.messages.fetch({limit:100});message=recent.find(m=>m.author.id===client.user.id&&m.embeds.some(e=>e.title===payload.embeds[0].data.title));}
 if(message&&message.author.id!==client.user.id)throw Error('Le panel enregistré appartient à un autre bot.');
 message=message?await message.edit(payload):await channel.send(payload);
 store(s=>{s.panels||={};s.panels[key]=message.id;});return message;
}
async function setup(client,guild){
 checkGuild(guild);if(installing)throw Error('Installation déjà en cours.');installing=true;
 try{
  const me=await guild.members.fetchMe();if(!me.permissions.has(P.Administrator))throw Error('Le bot a besoin d’Administrateur pour créer les rôles de direction et configurer les accès.');
  const roles=await guild.roles.fetch(),r={};
  // Create from bottom to top, then enforce the requested order below the bot.
  for(const [key,name,permissions] of [...layout.roles].reverse()){
   let role=roles.get(saved().roles?.[key])||roles.find(x=>x.name===name&&!x.managed);
   if(role){if(!role.editable)throw Error('Place le rôle du bot au-dessus de '+name+'.');await role.edit({name,permissions,hoist:true,mentionable:false});}
   else role=await guild.roles.create({name,permissions,hoist:true,mentionable:false,reason:'Installation QG demandée par le propriétaire'});
   r[key]=role.id;store(s=>{s.roles||={};s.roles[key]=role.id;});
  }
  await guild.roles.setPositions([...layout.roles].reverse().map(([key],index)=>({role:r[key],position:index+1})));
  // XP roles are created highest milestone first; tied bottom positions keep that order below Membre.
  for(const n of [...layout.levelMilestones].reverse()){
   const name='« I Niveau '+n;let role=roles.get(saved().levelRoles?.[n])||roles.find(r=>r.name===name&&!r.managed);
   if(!role)role=await guild.roles.create({name,permissions:[],hoist:false,mentionable:false,reason:'Palier XP QG'});
   else if(role.editable)await role.edit({name,permissions:[],hoist:false,mentionable:false});
   store(s=>{s.levelRoles||={};s.levelRoles[n]=role.id;});
  }
  const owner=await guild.fetchOwner();await owner.roles.add(r.creator,'Creator du serveur QG');
  const all=await guild.channels.fetch(),cats={},c={};
  const existingPublic=[...all.values()].filter(ch=>ch?.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel,false));
  for(const [key,name] of layout.categories){
   let cat=all.get(saved().categories?.[key])||all.find(x=>x?.type===T.GuildCategory&&x.name===name);
   const options={name,permissionOverwrites:layout.overwrites(guild.id,client.user.id,r,key)};
   cat=cat?await cat.edit(options):await guild.channels.create({...options,type:T.GuildCategory});cats[key]=cat.id;
   store(s=>{s.categories||={};s.categories[key]=cat.id;});
  }
  for(const [key,name,parent,type] of layout.channels){
   let ch=all.get(saved().channels?.[key])||all.find(x=>x?.type===type&&x.parentId===cats[parent]&&(x.name===name||(key==='memberCount'&&x.name.endsWith(' • .gg/QG'))));
   if(ch){if(ch.type!==type)throw Error('Type de salon incorrect : '+name);await ch.setParent(cats[parent],{lockPermissions:true});if(key!=='memberCount'&&ch.name!==name)await ch.setName(name);}
   else ch=await guild.channels.create({name,type,parent:cats[parent],permissionOverwrites:layout.overwrites(guild.id,client.user.id,r,parent)});
   c[key]=ch.id;
   if(['rules','tos','arrivals','departures','tickets','announcements','levels','supportApply','supportInfo'].includes(key)){
    await ch.permissionOverwrites.edit(guild.id,{SendMessages:false,CreatePublicThreads:false,CreatePrivateThreads:false,SendMessagesInThreads:false,...(key==='rules'?{AddReactions:true}:{})});
    if(['tickets','announcements','levels','supportApply','supportInfo'].includes(key))await ch.permissionOverwrites.edit(r.member,{SendMessages:false,CreatePublicThreads:false,CreatePrivateThreads:false,SendMessagesInThreads:false});
   }
   if(key==='memberCount')await ch.permissionOverwrites.edit(guild.id,{Connect:false});
   store(s=>{s.channels||={};s.channels[key]=ch.id;});
  }
  // Gate existing public channels and categories; preserve existing private spaces.
  for(const ch of existingPublic){
   if(Object.values(c).includes(ch.id)||Object.values(cats).includes(ch.id))continue;
   const overwrite=ch.permissionOverwrites.cache.get(guild.id);
   if(overwrite?.deny.has(P.ViewChannel))continue;
   await ch.permissionOverwrites.edit(guild.id,{ViewChannel:false});
   await ch.permissionOverwrites.edit(r.member,{ViewChannel:true});
   await ch.permissionOverwrites.edit(client.user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
  }
  for(const ch of (await guild.channels.fetch()).values()){
   if(ch&&!ch.name.includes('・')&&[T.GuildText,T.GuildVoice,T.GuildCategory,T.GuildAnnouncement].includes(ch.type))await ch.setName((ch.type===T.GuildCategory?'📁':ch.type===T.GuildVoice?'🔊':'💬')+'・'+ch.name);
  }
  const get=id=>guild.channels.fetch(id);
  const rules=await panel(await get(c.rules),'rules',layout.rules(),client);await rules.react('✅');
  await panel(await get(c.tos),'tos',layout.tos(),client);
  await panel(await get(c.tickets),'tickets',layout.ticket(),client);
  await panel(await get(c.commands),'commands',{embeds:[layout.embed('Commandes du QG','**Membres**\n`=niveau` : ton niveau et ta progression.\n`=classement` : les dix membres les plus actifs.\n`=aide` : consulter cette aide.\n`=suggestion ton idée` : proposer une amélioration dans le salon suggestions.\n\n**Tickets**\nUtilise le bouton du salon tickets. L’équipe peut prendre en charge ou renommer le ticket. Son auteur et l’équipe peuvent le fermer ; un transcript est conservé.\n\n**Vocaux**\nRejoins « ➕ Crée ton vocal » pour créer ton salon temporaire. Il sera supprimé quand il sera vide.\n\n**Installation**\n`=setupqg` est réservé au propriétaire du serveur et à Aven. Les commandes de gestion de la Soul Society restent réservées à leur serveur.')],allowedMentions},client);
  await panel(await get(c.levels),'levels',require('./qgLevels').panel(),client);
  await panel(await get(c.supportApply),'supportApply',require('./qgSupport').panel(),client);
  await panel(await get(c.supportInfo),'supportInfo',{embeds:[layout.embed('Besoin d’aide ?',`**Demande privée** : ouvre un ticket dans <#${c.tickets}>.\n**Aide vocale** : rejoins <#${c.waiting}> et attends un membre de l’équipe.\n**Rejoindre le support** : dépose une candidature dans <#${c.supportApply}>.\n\nNe communique jamais de mot de passe ni de token.`)],allowedMentions},client);
  await panel(await get(c.introductions),'introductions',{embeds:[layout.embed('Fais connaissance avec le QG','Présente-toi en quelques mots : le pseudo que tu utilises, tes jeux favoris, tes passions et ce que tu aimerais trouver ici. Tu peux rester discret sur tes informations personnelles.')],allowedMentions},client);
  await panel(await get(c.gaming),'gaming',{embeds:[layout.embed('Trouve des partenaires de jeu','Indique ton jeu, ta plateforme, le nombre de joueurs recherchés et ton créneau. Propose ensuite un vocal pour vous retrouver. Pas de spam ni de mentions massives.')],allowedMentions},client);
  store(s=>{s.guildId=guild.id;s.installedAt=Date.now();s.version=1;});
  await stats(guild,true);
  return {roles:r,channels:c};
 }finally{installing=false;}
}
let lastCountRefresh=0;
async function stats(guild,force=false){
 checkGuild(guild);const s=saved();if(!s.roles?.member||!s.channels?.memberCount||!force&&Date.now()-lastCountRefresh<600000)return;
 let after,count=0;
 for(;;){const members=await guild.members.list({limit:1000,...(after?{after}:{})});count+=members.filter(m=>!m.user.bot&&m.roles.cache.has(s.roles.member)).size;if(members.size<1000)break;after=members.lastKey();}
 const channel=await guild.channels.fetch(s.channels.memberCount);const name=`📊・Membres : ${count} • ${config.statSuffix}`;
 if(channel&&channel.name!==name)await channel.setName(name);lastCountRefresh=Date.now();
}
async function log(guild,title,description,files=[]){const ch=await guild.channels.fetch(saved().channels.logs);if(!ch?.isTextBased())throw Error('Salon de logs QG indisponible.');return ch.send({embeds:[layout.embed(title,description)],files,allowedMentions});}
function staff(member){const r=saved().roles||{};return member.id===member.guild.ownerId||member.id===config.ownerId||layout.staffKeys.some(k=>member.roles.cache.has(r[k]));}
async function reaction(reaction,user,add){
 if(user.bot||reaction.emoji.name!=='✅')return;
 if(reaction.partial)await reaction.fetch();
 const m=reaction.message,s=saved();if(m.guildId!==config.guildId||m.id!==s.panels?.rules||m.channelId!==s.channels?.rules)return;
 const member=await m.guild.members.fetch(user.id);if(add)await member.roles.add(s.roles.member,'Règlement QG accepté');
 else await member.roles.remove(s.roles.member,'Réaction au règlement QG retirée');
 await log(m.guild,add?'Accès Membre accordé':'Accès Membre retiré',`<@${user.id}> • ${user.id}`);
}
async function memberEvent(member,joined){
 if(member.user.bot)return;
 const s=saved(),ch=await member.guild.channels.fetch(s.channels?.[joined?'arrivals':'departures']);if(!ch)return;
 await ch.send({content:joined?`<@${member.id}>`:undefined,embeds:[layout.embed(joined?'Bienvenue au QG !':'Départ du serveur',joined?`Bienvenue <@${member.id}> !\nLis le règlement dans <#${s.channels.rules}> et ajoute la réaction ✅ pour recevoir le rôle **Membre** et accéder au serveur.`:`**${member.user.username}** a quitté le QG.\nID : ${member.id}`)],allowedMentions:{parse:[],users:joined?[member.id]:[]}});
}
async function transcript(channel){
 let before;const all=[];
 for(let page=0;page<100;page++){
  const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});all.push(...batch.values());
  if(batch.size<100){const body=Buffer.from(all.sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>`${new Date(m.createdTimestamp).toISOString()} ${m.author.username} (${m.author.id})\n${m.content||''}\n${m.embeds.map(e=>JSON.stringify(e.toJSON())).join('\n')}\n${[...m.attachments.values()].map(a=>a.url).join('\n')}`).join('\n\n')||'Ticket vide.');if(body.length>7*1024*1024)throw Error('Archive trop volumineuse. Le ticket est conservé.');return body;}
  before=batch.last().id;
 }throw Error('Archive trop longue. Le ticket est conservé.');
}
async function ticket(i){
 const s=saved(),member=await i.guild.members.fetch(i.user.id);
 if(!member.roles.cache.has(s.roles.member)&&!staff(member))throw Error('Accepte d’abord le règlement pour accéder aux tickets.');
 const channels=await i.guild.channels.fetch();let ch=channels.find(x=>x?.topic===`qg-ticket:${i.user.id}`);
 if(ch){store(x=>{x.tickets||={};x.tickets[ch.id]||={ownerId:i.user.id,createdAt:Date.now()};});return i.editReply(`Ton ticket est déjà ouvert : <#${ch.id}>`);}
 ch=await i.guild.channels.create({name:`ticket-${i.user.username}`.replace(/[^a-z0-9-]/gi,'-').slice(0,90),type:T.GuildText,parent:s.categories.help,topic:`qg-ticket:${i.user.id}`,
 permissionOverwrites:[{id:i.guildId,deny:[P.ViewChannel]},{id:i.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]},{id:i.client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles,P.ManageChannels]},...layout.staffKeys.map(k=>({id:s.roles[k],allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]}))]});
 store(x=>{x.tickets||={};x.tickets[ch.id]={ownerId:i.user.id,createdAt:Date.now()};});
 await ch.send({content:`<@${i.user.id}>`,embeds:[layout.embed('Ticket privé','Explique ta demande à l’équipe. Évite les données sensibles. Le ticket sera archivé avant sa fermeture.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:claim').setLabel('Prendre en charge').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('qg:rename').setLabel('Renommer').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('qg:close').setLabel('Fermer').setStyle(ButtonStyle.Danger))],allowedMentions:{users:[i.user.id],parse:[]}});
 await log(i.guild,'Ticket ouvert',`<@${i.user.id}> • <#${ch.id}>`);return i.editReply(`✅ Ton ticket : <#${ch.id}>`);
}
async function interaction(i){
 if(await require('./qgSupport').handle(i,saved()))return;
 if(!i.customId?.startsWith('qg:'))return i.isRepliable?.()?i.reply({content:'Cette commande appartient au serveur de la Soul Society. Utilise =aide pour le QG.',flags:MessageFlags.Ephemeral}):undefined;
 const action=i.customId.split(':')[1];
 if(action==='rename'){
  const member=await i.guild.members.fetch(i.user.id);if(!staff(member)||!saved().tickets?.[i.channelId])throw Error('Action réservée à l’équipe dans un ticket.');
  const {ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
  return i.showModal(new ModalBuilder().setCustomId('qg:rename-save').setTitle('Renommer le ticket').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true))));
 }
 await i.deferReply({flags:MessageFlags.Ephemeral});
 return serial(action==='ticket'?'ticket:'+i.user.id:'channel:'+i.channelId,async()=>{
  if(action==='ticket')return ticket(i);
  const t=saved().tickets?.[i.channelId],member=await i.guild.members.fetch(i.user.id);
  if(!t||i.channel.topic!==`qg-ticket:${t.ownerId}`)throw Error('Ticket introuvable.');
  if(!staff(member)&&!(action==='close'&&t.ownerId===i.user.id))throw Error('Action réservée à l’équipe.');
  if(action==='claim'){
   if(t.claimedBy&&t.claimedBy!==i.user.id)throw Error('Ce ticket est déjà pris en charge.');
   store(s=>{s.tickets[i.channelId].claimedBy=i.user.id;});await i.channel.send({embeds:[layout.embed('Ticket pris en charge',`<@${i.user.id}> s’occupe de ta demande.`)],allowedMentions});return i.editReply('✅ Ticket pris en charge.');
  }
  if(action==='rename-save'){const name=i.fields.getTextInputValue('name').trim().replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,80);if(!name)throw Error('Nom invalide.');await i.channel.setName(name);return i.editReply('✅ Ticket renommé.');}
  if(action==='close'){
   const body=await transcript(i.channel);
   await log(i.guild,'Archive du ticket',`Auteur : <@${t.ownerId}> (${t.ownerId})\nFermé par : <@${i.user.id}>\nSalon : ${i.channel.name}`, [new AttachmentBuilder(body,{name:`ticket-${i.channelId}.txt`})]);
   await i.editReply('✅ Archive enregistrée. Fermeture du ticket.');await i.channel.delete('Ticket QG archivé');store(s=>{delete s.tickets[i.channelId];});
  }
 });
}
async function voice(oldState,newState){
 const s=saved(),member=newState.member;if(!member||member.user.bot)return;
 if(newState.channelId===s.channels?.createVoice&&oldState.channelId!==newState.channelId)await serial('voice:'+member.id,async()=>{
  const fresh=await newState.guild.members.fetch(member.id);if(fresh.voice.channelId!==s.channels.createVoice||!fresh.roles.cache.has(s.roles.member)&&!staff(fresh))return;
  const existing=Object.entries(saved().temporaryVoices||{}).find(([,r])=>r.ownerId===member.id);
  let ch=existing?await newState.guild.channels.fetch(existing[0]).catch(e=>{if(e.code===10003)return null;throw e;}):null;
  if(!ch){ch=await newState.guild.channels.create({name:`🔊・Vocal de ${member.displayName}`.slice(0,95),type:T.GuildVoice,parent:s.categories.voice,permissionOverwrites:layout.overwrites(newState.guild.id,newState.client.user.id,s.roles,'voice')});store(x=>{x.temporaryVoices||={};x.temporaryVoices[ch.id]={ownerId:member.id};});}
  try{await fresh.voice.setChannel(ch);}catch(e){if(ch.members.size===0){await ch.delete('Déplacement impossible');store(x=>{delete x.temporaryVoices[ch.id];});}throw e;}
 });
 if(oldState.channelId&&saved().temporaryVoices?.[oldState.channelId])await serial('cleanup:'+oldState.channelId,async()=>{
  const ch=oldState.guild.channels.cache.get(oldState.channelId);if(ch&&ch.members.size===0){await ch.delete('Vocal temporaire vide');store(x=>{delete x.temporaryVoices[ch.id];});}
 });
}
async function message(m){
 if(m.author.bot)return;
 if(await require('./qgLevels').command(m,saved()))return;
 await require('./qgLevels').message(m,saved());
 if(m.content.trim()==='=setupqg'){
  if(m.author.id!==config.ownerId&&m.author.id!==m.guild.ownerId)return;
  await m.reply({content:'Installation / actualisation du QG en cours…',allowedMentions});await setup(m.client,m.guild);return m.reply({content:'✅ Rôles, salons, règlement, tickets et vocaux QG configurés.',allowedMentions});
 }
 if(['=aide','=help'].includes(m.content.trim()))return m.reply({content:`Lis <#${saved().channels?.commands}> pour les fonctions du QG.`,allowedMentions});
 if(m.content.startsWith('=suggestion ')){
  if(!m.member.roles.cache.has(saved().roles?.member)&&!staff(m.member))return;
  const text=m.content.slice(12).trim().slice(0,3500);if(!text)return;
  const ch=await m.guild.channels.fetch(saved().channels.suggestions),sent=await ch.send({embeds:[layout.embed('Suggestion',text).setAuthor({name:m.author.username})],allowedMentions});await sent.react('👍');await sent.react('👎');return m.reply({content:`✅ Suggestion publiée : ${sent.url}`,allowedMentions});
 }
 if(m.channelId===saved().channels?.suggestions&&!m.content.startsWith('=')){await m.react('👍');await m.react('👎');}
}
function register(client){
 if(client.qgSystem)return;client.qgSystem=true;
 const report=(e)=>console.error('QG :',e.code||e.message);
 const guarded=(fn,...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
 // Route only QG events here: old Soul Society handlers must never moderate QG members.
 const emit=client.emit;
 client.emit=function(event,...args){
  const first=args[0],guildId=first?.guildId||first?.guild?.id||first?.message?.guildId;
  if(guildId!==config.guildId)return emit.call(this,event,...args);
  if(event===Events.MessageCreate){guarded(message,first);return true;}
  if(event===Events.InteractionCreate){interaction(first).catch(async e=>{report(e);const p={content:'❌ '+e.message,flags:MessageFlags.Ephemeral};await(first.deferred?first.editReply(p):first.replied?first.followUp(p):first.reply(p)).catch(report);});return true;}
  if(event===Events.MessageReactionAdd||event===Events.MessageReactionRemove){guarded(()=>serial('reaction:'+args[1].id,()=>reaction(first,args[1],event===Events.MessageReactionAdd)));return true;}
  if(event===Events.GuildMemberAdd||event===Events.GuildMemberRemove){guarded(memberEvent,first,event===Events.GuildMemberAdd);return true;}
  if(event===Events.VoiceStateUpdate){require('./qgLevels').resetVoice(first.id);guarded(voice,...args);return true;}
  if([Events.GuildMemberUpdate,Events.PresenceUpdate,Events.MessageUpdate,Events.MessageDelete,Events.MessageBulkDelete].includes(event))return true;
  return emit.call(this,event,...args);
 };
 client.once(Events.ClientReady,()=>guarded(async()=>{
  const guild=client.guilds.cache.get(config.guildId);if(!guild)return;
  await setup(client,guild);
  setInterval(()=>guarded(require('./qgLevels').voice,guild,saved()),120000).unref();
  const s=saved(),rulesChannel=await guild.channels.fetch(s.channels.rules),rulesMessage=await rulesChannel.messages.fetch(s.panels.rules);
  const accept=rulesMessage.reactions.cache.find(r=>r.emoji.name==='✅');
  if(accept){let after;for(;;){const users=await accept.users.fetch({limit:100,...(after?{after}:{})});for(const user of users.values()){
    if(user.bot)continue;const member=await guild.members.fetch(user.id).catch(e=>{if(e.code===10007)return null;throw e;});
    if(member&&!member.roles.cache.has(s.roles.member))await member.roles.add(s.roles.member,'Règlement QG accepté pendant une interruption');
   }if(users.size<100)break;after=users.lastKey();}}
  for(const id of Object.keys(saved().temporaryVoices||{})){const ch=guild.channels.cache.get(id);if(ch&&ch.members.size===0){await ch.delete('Nettoyage vocal temporaire vide après redémarrage');store(s=>{delete s.temporaryVoices[id];});}}
  setInterval(()=>guarded(stats,guild),600000).unref();
 }));
 client.on(Events.GuildCreate,guild=>{if(guild.id===config.guildId)guarded(setup,client,guild);});
}
module.exports=register;module.exports.setup=setup;module.exports._test={reaction,transcript,staff,stats,message,voice,interaction};
