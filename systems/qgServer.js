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
  await panel(await get(c.commands),'commands',{embeds:[layout.embed('Commandes du QG','**Membres**\n`=niveau` : ton niveau et ta progression.\n`=classement` : les dix membres les plus actifs.\n`=aide` : consulter cette aide.\n`=suggestion ton idée` : proposer une amélioration dans le salon suggestions.\n\n**Tickets**\nUtilise le bouton du salon tickets. L’équipe peut prendre en charge ou renommer le ticket. Son auteur et l’équipe peuvent le fermer ; un transcript est conservé.\n\n**Vocaux**\nRejoins « ➕ Crée ton vocal » pour créer ton salon temporaire. Il sera supprimé quand il sera vide.\n\n**Installation**\n`=setupqg` est réservé au propriétaire du serveur et à Aven. Les commandes de gestion du QG sont réservées aux personnes autorisées.')],allowedMentions},client);
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
 for(;;){const members=await guild.members.list({limit:1000,...(after?{after}:{})});count+=members.filter(m=>!m.user.bot&&m.roles.cache.has(s.schoolRoles?.community||s.roles.member)).size;if(members.size<1000)break;after=members.lastKey();}
 const channel=await guild.channels.fetch(s.channels.memberCount);const name=`📊・Membres : ${count} • ${config.statSuffix}`;
 if(channel&&channel.name!==name)await channel.setName(name);lastCountRefresh=Date.now();
}
async function logTo(guild,key,title,description,files=[]){const s=saved(),ch=await guild.channels.fetch(s.schoolChannels?.[key]||s.channels.logs).catch(()=>null);if(!ch?.isTextBased())return null;return ch.send({embeds:[layout.embed(title,description)],files,allowedMentions});}
async function log(guild,title,description,files=[]){const key=/membre|règlement|vérifi|accès/i.test(title)?'logsMembers':'logsTickets';return logTo(guild,key,title,description,files);}
function staff(member){const s=saved(),r=s.roles||{},school=s.schoolRoles||{};return member.id===member.guild.ownerId||member.id===config.ownerId||layout.staffKeys.some(k=>r[k]&&member.roles.cache.has(r[k]))||['creator','globalManager','administrator','ticketsLead','ticketsManagement'].some(k=>school[k]&&member.roles.cache.has(school[k]));}
async function reaction(reaction,user,add){
 if(user.bot||reaction.emoji.name!=='✅')return;
 if(reaction.partial)await reaction.fetch();
 const m=reaction.message,s=saved();if(m.guildId!==config.guildId||m.id!==s.panels?.rules||m.channelId!==s.channels?.rules)return;
 if(s.schoolSetup)return; // After SchoolRP setup, only the persistent acceptance button grants verification.
 const member=await m.guild.members.fetch(user.id);if(add)await member.roles.add(s.roles.member,'Règlement QG accepté');
 else await member.roles.remove(s.roles.member,'Réaction au règlement QG retirée');
 await log(m.guild,add?'Accès Membre accordé':'Accès Membre retiré',`<@${user.id}> • ${user.id}`);
}
async function memberEvent(member,joined){
 if(member.user.bot)return;
 const membership=require('../utils/qgVerificationMembership'),previous=saved().schoolEntryVerification?.[member.id];
 if(!joined||previous&&!membership.current(previous,member)){
  membership.invalidate(member,{read,update},!joined);
  await require('./qgProfileCatchup').endMembership(member);
 }
 if(joined)await require('./qgSchoolSeparators').syncMember(member);
 if(joined){await logTo(member.guild,'logsMembers','Arrivée d’un membre',`Membre : <@${member.id}> (${member.id})\nVérification en attente.`).catch(()=>{});return;}
 const s=saved(),school=s.schoolChannels||{},ch=await member.guild.channels.fetch(school[joined?'arrivals':'departures']||s.channels?.[joined?'arrivals':'departures']);if(!ch)return;
 const notice=layout.embed(joined?'✦ Bienvenue au QG':'Départ du serveur',joined?`Bienvenue <@${member.id}> !\n\nUn nouvel espace de rencontres, de discussions et de roleplay t’attend. Prends tes repères et trouve ta place parmi nous.\n\n**01 · Vérifie ton profil**\nRends-toi dans <#${school.rules||s.channels.rules}> et clique sur **Commencer ma vérification**.\n\n**02 · Découvre nos règles**\nAprès confirmation de ton profil Roblox, le règlement s’affichera dans un message visible uniquement par toi.\n\n**03 · Rejoins la communauté**\nConfirme l’avoir lu et accepté pour recevoir le rôle **Membre Communautaire**.\n\nHeure d’arrivée : <t:${Math.floor((member.joinedTimestamp||Date.now())/1000)}:F>`:`**${member.user.username}** a quitté le QG.\nID : ${member.id}`).setColor(0xffffff).setTimestamp(joined?member.joinedTimestamp||Date.now():Date.now());
 if(joined)notice.setThumbnail(member.user.displayAvatarURL({size:256}));
 await ch.send({content:joined?`<@${member.id}>`:undefined,embeds:[notice],allowedMentions:{parse:[],users:joined?[member.id]:[]}});
 await logTo(member.guild,'logsMembers',joined?'Arrivée d’un membre':'Départ d’un membre',`Membre : <@${member.id}> (${member.id})\nPseudo : ${member.user.username}\nAuteur : non applicable / non déterminé`).catch(()=>{});
}
async function memberUpdate(oldMember,newMember){
 require('./qgCommunityUpgrade').memberChanged(oldMember,newMember);
 await require('./qgUserTools').enforce(oldMember,newMember).catch(e=>console.error('Verrou pseudo QG :',e.code||e.name));
 await require('./qgSupportWorkspace').boost(oldMember,newMember).catch(e=>console.error('Boost QG :',e.code||e.name));
 await require('./qgSchoolSeparators').syncMember(newMember);
 const changes=[];
 if(oldMember.nickname!==newMember.nickname)changes.push(`Surnom : **${oldMember.nickname||'aucun'}** → **${newMember.nickname||'aucun'}**`);
 if(oldMember.user.username!==newMember.user.username)changes.push(`Nom Discord : **${oldMember.user.username}** → **${newMember.user.username}**`);
 const oldRoles=oldMember.roles.cache,newRoles=newMember.roles.cache;
 const board=require('./qgSchoolManagementBoard');
 if(board.trackRoleChanges(oldMember,newMember))await board.refresh(newMember.guild).catch(e=>console.error('Actualisation suivi gestions :',e.code||e.message));
 const added=[...newRoles.values()].filter(r=>!r.managed&&!oldRoles.has(r.id)),removed=[...oldRoles.values()].filter(r=>!r.managed&&!newRoles.has(r.id));
 if(added.length)changes.push(`Rôles ajoutés : ${added.map(r=>`<@&${r.id}>`).join(', ')}`);
 if(removed.length)changes.push(`Rôles retirés : ${removed.map(r=>`<@&${r.id}>`).join(', ')}`);
 if(changes.length)await logTo(newMember.guild,'logsMembers','Profil ou rôles modifiés',`Membre : <@${newMember.id}> (${newMember.id})\n${changes.join('\n')}\nAuteur : non déterminé`);
}
async function voiceLog(oldState,newState){
 const member=newState.member||oldState.member;if(!member||member.user.bot)return;
 const events=[];
 if(!oldState.channelId&&newState.channelId)events.push(`Connexion à <#${newState.channelId}>`);
 else if(oldState.channelId&&!newState.channelId)events.push(`Déconnexion de <#${oldState.channelId}>`);
 else if(oldState.channelId!==newState.channelId)events.push(`Déplacement : <#${oldState.channelId}> → <#${newState.channelId}> (auteur non déterminé)`);
 for(const [key,label] of [['selfMute','mute micro personnel'],['serverMute','mute micro serveur'],['selfDeaf','mute casque personnel'],['serverDeaf','mute casque serveur'],['selfVideo','vidéo'],['streaming','partage d’écran']])if(oldState[key]!==newState[key])events.push(`${label} : ${newState[key]?'activé':'désactivé'}`);
 if(events.length)await logTo(member.guild,'logsVoice','État vocal modifié',`Membre : <@${member.id}> (${member.id})\n${events.join('\n')}\nAuteur : non déterminé`);
}
async function messageChange(oldMessage,newMessage,kind){
 const m=kind==='bulk'?oldMessage:(newMessage||oldMessage);if(!m?.guildId||m.guildId!==config.guildId||m.author?.bot)return;
 const t=saved().tickets?.[m.channelId];const privateTicket=Boolean(t||m.channel?.topic?.startsWith('qg-ticket:'));
 const title=kind==='delete'?'Message supprimé':kind==='edit'?'Message modifié':'Messages supprimés en masse';
 let description=`Salon : <#${m.channelId}>\nAuteur : ${m.author?`${m.author.username} (${m.author.id})`:'non déterminé'}\nAuteur de suppression : non déterminé`;
 if(!privateTicket&&kind==='edit')description+=`\nAvant : ${(oldMessage?.content||'').slice(0,600)||'[vide]'}\nAprès : ${(newMessage?.content||'').slice(0,600)||'[vide]'}`;
 if(!privateTicket&&kind==='delete')description+=`\nContenu : ${(oldMessage?.content||'').slice(0,600)||'[non disponible]'}`;
 if(kind==='bulk')description+=`\nNombre : ${newMessage?.size||0}`;
 for(const secret of [process.env.TOKEN,process.env.OPENAI_API_KEY,process.env.ROBLOX_COOKIE].filter(Boolean))description=description.split(secret).join('[secret masqué]');
 await logTo(m.guild,'logsModeration',title,description);
}
async function transcript(channel){
 let before;const all=[];
 for(let page=0;page<100;page++){
  const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});all.push(...batch.values());
  if(batch.size<100){const body=Buffer.from(all.sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>`${new Date(m.createdTimestamp).toISOString()} ${m.author.username} (${m.author.id})\n${m.content||''}\n${m.embeds.map(e=>JSON.stringify(e.toJSON())).join('\n')}\n${[...m.attachments.values()].map(a=>a.url).join('\n')}`).join('\n\n')||'Ticket vide.');if(body.length>7*1024*1024)throw Error('Archive trop volumineuse. Le ticket est conservé.');return body;}
  before=batch.last().id;
 }throw Error('Archive trop longue. Le ticket est conservé.');
}
const ticketTypes={casino:{label:'Support Casino',prefix:'casino',description:'Décris ton problème de jeu ou de solde, avec la date et le jeu concerné. Les jetons sont uniquement fictifs.'},questions:{label:'Questions/Aide',prefix:'aide',description:'Pose ta question ou décris le problème rencontré. Indique les étapes déjà tentées.'},report:{label:'Signaler un comportement',prefix:'signalement',description:'Décris l’incident avec son contexte, la date et l’heure approximatives, les pseudos Roblox et RP concernés, et joins une preuve utile.'},complaint:{label:'Réclamation',prefix:'reclamation',description:'Explique la décision que tu souhaites contester, le contexte et les éléments que la Fondation doit examiner.'},foundation:{label:'Contacter la Fondation',prefix:'fondation',description:'Décris ta demande confidentielle. Seul le demandeur et les rôles Fondation (Créateur et Gérant Global) peuvent consulter ce ticket.'},event:{label:'Demander une animation',prefix:'animation',description:'Précise les familles concernées, le contenu, la date et l’heure, le lieu, le caractère public ou privé et la récompense éventuelle.'},partnership:{label:'Demande de partenariat',prefix:'partenariat',description:'Indique le nom et l’objectif du serveur, le contenu proposé, s’il diffuse du contenu +18 et son lien avec SchoolRP.'}};
function ticketOverwrites(guildId,userId,botId,type,schoolRoles,fallbackRoles={},allRoleIds=[]){
 const foundationKeys=['creator','globalManager'];
 const allowedFoundationIds=new Set(foundationKeys.map(k=>schoolRoles[k]).filter(Boolean));
 const deniedRoleIds=type==='foundation'?allRoleIds.filter(id=>id!==guildId&&!allowedFoundationIds.has(id)):[];
 const staffKeys={event:['animationLead','animationManagement'],partnership:['networksLead','networksManagement']}[type]||['ticketsLead','ticketsManagement'];
 const assignedKeys=type==='foundation'?foundationKeys:(schoolRoles.creator?['creator','globalManager','administrator',...staffKeys]:layout.staffKeys);
 const overwrites=[{id:guildId,deny:[P.ViewChannel]},...deniedRoleIds.map(id=>({id,deny:[P.ViewChannel]})),{id:userId,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles]},{id:botId,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AttachFiles,P.ManageChannels]},...assignedKeys.map(k=>({id:schoolRoles[k]||fallbackRoles[k],allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]})).filter(x=>x.id)];
 if(overwrites.length>100)throw Error('Trop de rôles pour verrouiller ce ticket Fondation avec les limites de permissions Discord.');
 return overwrites;
}
function ticketStaff(member,type){const roles=saved().schoolRoles||{};return member.id===config.ownerId||member.id===member.guild.ownerId||require('./qgTicketRouting').team(type).some(k=>roles[k]&&member.roles.cache.has(roles[k]));}
async function ticket(i,type='questions'){
 const s=saved(),member=await i.guild.members.fetch({user:i.user.id,force:true}),schoolRoles=s.schoolRoles||{},schoolMember=schoolRoles.community&&member.roles.cache.has(schoolRoles.community);
 if(!ticketTypes[type])throw Error('Type de ticket invalide. Choisis un sujet dans le panneau.');
 if(type==='casino'?!require('../utils/qgCasinoAccess').memberAllowed(member):(s.schoolSetup?!schoolMember&&!staff(member):!member.roles.cache.has(s.roles.member)&&!staff(member)))throw Error('Accepte d’abord le règlement pour accéder aux tickets.');
 const channels=await i.guild.channels.fetch();let ch=channels.find(x=>{const data=parseQGTicketTopic(x?.topic);return data?.ownerId===i.user.id&&data.type===type;});
 if(ch){store(x=>{x.tickets||={};x.tickets[ch.id]||={ownerId:i.user.id,type,createdAt:Date.now()};});return i.editReply(`Tu as déjà un ticket de ce type : <#${ch.id}>`);}
 const parent=type==='casino'?s.schoolCategories?.casinoSupport:s.schoolCategories?.ticketInbox;if(!parent)throw Error('L’espace tickets n’est pas encore prêt : il est préparé automatiquement au démarrage du bot.');
 const overwrites=require('./qgTicketRouting').overwrites(i.guild,i.user.id,type);
 ch=await i.guild.channels.create({name:`${ticketTypes[type].prefix}-${i.user.username}`.replace(/[^a-z0-9-]/gi,'-').slice(0,90),type:T.GuildText,parent,topic:buildQGTicketTopic(i.user.id,type),
 permissionOverwrites:overwrites});
 store(x=>{x.tickets||={};x.tickets[ch.id]={ownerId:i.user.id,type,createdAt:Date.now()};});
 await ch.send({content:`<@${i.user.id}>`,embeds:[layout.embed(`Ticket privé · ${ticketTypes[type].label}`,`${ticketTypes[type].description}\n\nLe ticket est accessible à toi et à l’équipe concernée. Il sera archivé à sa fermeture.`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:claim').setLabel('Prendre en charge').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('qg:rename').setLabel('Renommer').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('qg:close').setLabel('Fermer').setStyle(ButtonStyle.Danger))],allowedMentions:{users:[i.user.id],parse:[]}});
 await log(i.guild,'Ticket ouvert',`Type : ${ticketTypes[type].label}\nAuteur : <@${i.user.id}> • <#${ch.id}>`);return i.editReply(`✅ Ton ticket ${ticketTypes[type].label.toLowerCase()} : <#${ch.id}>`);
}
function buildQGTicketTopic(ownerId,type='questions'){return `qg-ticket:${ownerId}:${type}`;}
function parseQGTicketTopic(topic){const match=/^qg-ticket:(\d+)(?::(questions|report|complaint|foundation|event|partnership|casino))?$/.exec(String(topic||''));return match?{ownerId:match[1],type:match[2]||'questions'}:null;}
async function interaction(i){
 if(await require('./qgProfileCatchup').handle(i))return;
 if(require('./qgProfileCatchup').active(i.user.id)&&!i.customId?.startsWith('qgs:help'))return i.reply({content:'Complète ton profil depuis le bouton du MP ou du règlement pour retrouver tes accès.',flags:MessageFlags.Ephemeral});
 if(i.customId?.startsWith('botpanel:'))return i.client.botPanel.handle(i);
 if(i.customId?.startsWith('ownerDM:'))return require('./botOwnerTools').handle(i);
 if(i.isChatInputCommand?.()&&['mp','mpall'].includes(i.commandName))return require('./botOwnerTools').execute(i);
 if(i.isChatInputCommand?.()&&i.commandName==='entretien')return require('./qgInterviews').execute(i);
 if(i.customId?.startsWith('qgh:'))return require('./qgRecruitmentHub').handle(i);
 if(i.customId?.startsWith('qgr:')){const hub=require('./qgRecruitmentHub');return hub.tokenFrom(i)?hub.action(i,require('./qgInterviews').handle,'recruit'):require('./qgInterviews').handle(i);}
 if(i.isChatInputCommand?.()&&['config','réunion'].includes(i.commandName))return require('./qgMeetings').execute(i);
 if(i.isChatInputCommand?.()&&i.commandName==='notesmp')return require('./qgMeetingDelivery').execute(i);
 if(i.customId?.startsWith('qgm:'))return require('./qgMeetings').handle(i);
 if(i.customId?.startsWith('qgsd:'))return require('./qgSupportDashboard').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='sp')return require('./qgSanctionPanel').execute(i);
 if(i.customId?.startsWith('qgsp:'))return require('./qgSanctionPanel').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='support'){
  await require('./qgSupportWorkspace').authorize(i);
  const sub=i.options.getSubcommand();
  if(['suivi','installer'].includes(sub))return require('./qgSupportWorkspace').execute(i);
  if(sub==='fermer')return i.reply({content:'Archiver puis fermer ce ticket ? Cette action supprime son salon après archivage.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:close').setLabel('Confirmer la fermeture').setStyle(ButtonStyle.Danger))],flags:MessageFlags.Ephemeral});
  i.customId='qg:'+({prendre:'claim',renommer:'rename'}[sub]);
 }
 if(i.isChatInputCommand?.()&&['conference','sc','accueil-vocal'].includes(i.commandName)){require('../utils/qgDurability').assertDurable();return require('./'+({conference:'qgConferences',sc:'qgDiscipline','accueil-vocal':'qgVoiceReception'})[i.commandName]).execute(i);}
 if(i.customId?.startsWith('qgc:'))return require('./qgConferences').handle(i);
 if(i.customId?.startsWith('qgd:')){const d=require('./qgDiscipline');return i.customId.startsWith('qgd:edit:')?d.editHandle(i):i.customId.startsWith('qgd:revise:')?d.revise(i):d.handle(i);}
 if(i.customId?.startsWith('qgl:'))return require('./qgRecruitmentHub').action(i,require('./qgRecruitmentLive').handle,'voice');
 if(i.customId?.startsWith('qgv:'))return require('./qgRecruitmentHub').action(i,require('./qgVoiceReception').handle,'audio');
 if(i.customId?.startsWith('qgcs:'))return require('./qgCasinoGames').handle(i);
 if(i.customId?.startsWith('qgcasino:'))return require('./qgCasino').handle(i);
 if(i.customId?.startsWith('qgcadm:'))return require('./qgCasinoAdmin').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='casino')return require('./qgCasinoGames').launch(i);
 if(i.isChatInputCommand?.()&&i.commandName==='profil')return require('./qgProfile').execute(i);
 if(i.isChatInputCommand?.()&&['rankup','derank'].includes(i.commandName))return require('./qgGrades').execute(i);
 if(i.customId?.startsWith('qgg:'))return require('./qgGrades').handle(i);
 if(i.isChatInputCommand?.()&&['effectif','note','pdt','recrutement-stats'].includes(i.commandName))return require('./qgFamilyAdmin').execute(i);
 if(i.customId?.startsWith('qgf:'))return require('./qgFamilyAdmin').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='animation')return require('./qgAnimations').execute(i);
 if(i.customId?.startsWith('qga:'))return require('./qgAnimations').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='cd')return require('./qgRecruitmentControl').execute(i);
 if(i.isChatInputCommand?.()&&i.commandName==='user')return require('./qgUserPanel').execute(i);
 if(i.customId?.startsWith('qgu:'))return require('./qgUserPanel').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='ia')return require('./qgAiControlPanel').execute(i);
 if(i.customId?.startsWith('qgai:'))return require('./qgAiControlPanel').handle(i);
 if(i.isChatInputCommand?.()&&i.commandName==='setup-serveur')return require('../commandes/setup-serveur').execute(i);
 if(i.isChatInputCommand?.()&&i.commandName==='delc')return require('../commandes/delc').execute(i);
 if(i.isChatInputCommand?.()&&i.commandName==='sync')return require('../commandes/sync').execute(i);
 if(i.customId?.startsWith('sync:'))return require('../commandes/sync').handleComponent(i);
 if(i.customId?.startsWith('delc:'))return require('../commandes/delc').handleComponent(i);
 if(i.customId?.startsWith('qgs:'))return require('./qgSchoolSetup').handle(i);
 if(await require('./qgSupport').handle(i,saved()))return;
 if(!i.customId?.startsWith('qg:'))return i.isRepliable?.()?i.reply({content:'Cette commande n’est pas disponible ici. Utilise =aide pour consulter les fonctions du QG.',flags:MessageFlags.Ephemeral}):undefined;
 const action=i.customId.split(':')[1];
 if(action==='rename'){
  const member=await i.guild.members.fetch(i.user.id),ticketData=saved().tickets?.[i.channelId];
  if(!ticketData||!ticketStaff(member,ticketData.type))throw Error('Action réservée à l’équipe autorisée dans ce ticket.');
  const {ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
  return i.showModal(new ModalBuilder().setCustomId('qg:rename-save').setTitle('Renommer le ticket').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true))));
 }
 await i.deferReply({flags:MessageFlags.Ephemeral});
 return serial(action==='ticket'||action==='ticket-type'||action==='casino-ticket'?'ticket:'+i.user.id:'channel:'+i.channelId,async()=>{
  if(action==='casino-ticket')return ticket(i,'casino');
  if(action==='ticket')return ticket(i);
  if(action==='ticket-type')return ticket(i,i.values?.[0]);
  const t=saved().tickets?.[i.channelId],member=await i.guild.members.fetch(i.user.id);
  if(!t||parseQGTicketTopic(i.channel.topic)?.ownerId!==t.ownerId)throw Error('Ticket introuvable.');
  if(!ticketStaff(member,t.type)&&!(action==='close'&&t.ownerId===i.user.id))throw Error('Action réservée à l’équipe autorisée dans ce ticket.');
  if(action==='claim'){
   if(t.claimedBy&&t.claimedBy!==i.user.id)throw Error('Ce ticket est déjà pris en charge.');
   store(s=>{s.tickets[i.channelId].claimedBy=i.user.id;});await i.channel.send({embeds:[layout.embed('Ticket pris en charge',`<@${i.user.id}> s’occupe de ta demande.`)],allowedMentions});return i.editReply('✅ Ticket pris en charge.');
  }
  if(action==='rename-save'){const name=i.fields.getTextInputValue('name').trim().replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,80);if(!name)throw Error('Nom invalide.');await i.channel.setName(name);return i.editReply('✅ Ticket renommé.');}
  if(action==='close'){
   const body=await transcript(i.channel);
   const archived=await log(i.guild,'Archive du ticket',`Auteur : <@${t.ownerId}> (${t.ownerId})\nFermé par : <@${i.user.id}>\nSalon : ${i.channel.name}`, [new AttachmentBuilder(body,{name:`ticket-${i.channelId}.txt`})]);
   if(t.type==='casino'&&!archived)throw Error('Archive non enregistrée : le ticket casino reste ouvert. Vérifie le salon des logs.');
   await i.editReply('✅ Archive enregistrée. Fermeture du ticket.');await i.channel.delete('Ticket QG archivé');store(s=>{delete s.tickets[i.channelId];});
  }
 });
}
async function voice(oldState,newState){
 if(await serial('school-voice:'+newState.id,()=>require('./qgSchoolVoice').voice(oldState,newState,newState.client)))return;
 const s=saved(),member=newState.member;if(!member||member.user.bot)return;
 if(newState.channelId===s.channels?.createVoice&&oldState.channelId!==newState.channelId)await serial('voice:'+member.id,async()=>{
  const fresh=await newState.guild.members.fetch(member.id);if(fresh.voice.channelId!==s.channels.createVoice||!fresh.roles.cache.has(s.schoolRoles?.community||s.roles.member)&&!staff(fresh))return;
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
 await require('./qgPublicThreads').message(m);
 if(await require('./botOwnerTools').message(m))return;
 if(m.author.bot)return;
 require('./qgMemberMetrics').message(m);
 if(await require('./qgCommunityPolicy').message(m))return;
 if(await require('./qgTicketAssistant').message(m))return;
 if(await require('./qgAiPublic').message(m))return;
 if(await require('./qgSchoolGiveaways').message(m))return;
 if(await require('./qgSchoolNews').message(m))return;
 if(await require('./qgLevels').command(m,saved()))return;
 await require('./qgLevels').message(m,saved());
 if(m.content.trim()==='=setupqg'){
  if(m.author.id!==config.ownerId&&m.author.id!==m.guild.ownerId)return;
  return m.reply({content:'La mise à jour du QG est désormais automatique à chaque démarrage du bot. `=setupqg` est conservée comme alias historique mais ne lance plus d’installation.',allowedMentions});
 }
 if(['=aide','=help'].includes(m.content.trim()))return m.reply({content:`Lis <#${saved().channels?.commands}> pour les fonctions du QG.`,allowedMentions});
 if(m.content.startsWith('=suggestion ')){
  const s=saved(),familyAccess=s.schoolRoles?.community&&m.member.roles.cache.has(s.schoolRoles.community);
  if(!m.member.roles.cache.has(s.roles?.member)&&!familyAccess&&!staff(m.member))return;
  const text=m.content.slice(12).trim().slice(0,3500);if(!text)return;
  const ch=await m.guild.channels.fetch(s.schoolChannels?.communitySuggestions||s.channels.suggestions),sent=await ch.send({embeds:[layout.embed('Suggestion',text).setAuthor({name:m.author.username})],allowedMentions});await sent.react('👍');await sent.react('👎');if(s.schoolCommunityPolicy?.enabled){const thread=await sent.startThread({name:'Discussion de la suggestion',autoArchiveDuration:1440});const role=s.schoolRoles?.ticketsManagement;if(role)await thread.send({content:`<@&${role}> Nouvelle suggestion : ${sent.url}`,allowedMentions:{parse:[],roles:[role]}});}return m.reply({content:`✅ Suggestion publiée : ${sent.url}`,allowedMentions});
 }
 if([saved().channels?.suggestions,saved().schoolChannels?.communitySuggestions].includes(m.channelId)&&!m.content.startsWith('=')){await m.react('👍');await m.react('👎');}
}
function register(client){
 if(client.qgSystem)return;client.qgSystem=true;
 client.once(Events.ClientReady,()=>{const guild=client.guilds.cache.get(config.guildId);if(guild){require('./qgSchoolManagementBoard').refresh(guild).catch(e=>console.error('Initialisation suivi gestions :',e.code||e.message));require('./qgSchoolSeparators').syncGuild(guild).catch(e=>console.error('Synchronisation initiale des séparateurs :',e.code||e.message));}});
 const report=(e)=>console.error('QG :',e.code||e.message);
 client.on(Events.ShardDisconnect,()=>{try{require('./qgConferences').pause();}catch(e){report(e);}});
 client.on(Events.ShardResume,()=>{const g=client.guilds.cache.get(config.guildId);if(g)require('./qgConferences').recover(g).catch(report);});
 const guarded=(fn,...args)=>Promise.resolve().then(()=>fn(...args)).catch(report);
 // Route only QG events here: handlers belonging to other servers must never moderate QG members.
 client.on(Events.UserUpdate,(_old,user)=>{const guild=client.guilds.cache.get(config.guildId),member=guild?.members.cache.get(user.id);if(member)guarded(require('./qgTagWatch').inspect,member);});
 const emit=client.emit;
 client.emit=function(event,...args){
  const first=args[0],guildId=first?.guildId||first?.guild?.id||first?.message?.guildId||args[1]?.guildId||args[1]?.guild?.id;
  if(guildId!==config.guildId)return emit.call(this,event,...args);
  if(event===Events.ChannelCreate){guarded(require('./qgProfileCatchup').created,first);guarded(require('./qgCategoryNames').created,first);guarded(require('./qgRpStatus').reconcile,first.guild);guarded(require('./qgSeparatorPermissions').refresh,first);}
  if(event===Events.ChannelUpdate)guarded(require('./qgSeparatorPermissions').refresh,args[1]);
  if(event===Events.MessageCreate){guarded(message,first);return true;}
  if(event===Events.InteractionCreate){interaction(first).catch(async e=>{report(e);const p={content:'❌ '+e.message,flags:MessageFlags.Ephemeral};await(first.deferred&&first.isChatInputCommand?.()&&!first.replied?first.editReply({content:p.content}):first.deferred||first.replied?first.followUp(p):first.reply(p)).catch(report);});return true;}
  if(event===Events.MessageReactionAdd||event===Events.MessageReactionRemove){guarded(()=>serial('reaction:'+args[1].id,async()=>{if(event===Events.MessageReactionAdd&&await require('./qgCommunityPolicy').reaction(first,args[1]))return;await reaction(first,args[1],event===Events.MessageReactionAdd);}));return true;}
  if(event===Events.GuildMemberAdd||event===Events.GuildMemberRemove){if(event===Events.GuildMemberAdd)require('./qgInvites').joined(first);guarded(memberEvent,first,event===Events.GuildMemberAdd);return true;}
  if(event===Events.VoiceStateUpdate){guarded(require('./qgConferences').voice,...args);guarded(require('./qgVoiceReception').voice,...args);guarded(require('./qgInterviews').tick,first.guild);guarded(require('./qgMemberMetrics').voice,...args);require('./qgLevels').resetVoice(first.id);guarded(voice,...args);guarded(voiceLog,...args);return true;}
  if(event===Events.GuildMemberUpdate){guarded(memberUpdate,...args);return true;}
  if(event===Events.MessageUpdate){guarded(require('./qgCommunityPolicy').message,args[1],true);guarded(messageChange,args[0],args[1],'edit');return true;}
  if(event===Events.MessageDelete){guarded(messageChange,first,null,'delete');return true;}
  if(event===Events.MessageBulkDelete){guarded(messageChange,first.first(),first,'bulk');return true;}
  if(event===Events.PresenceUpdate)return true;
  return emit.call(this,event,...args);
 };
 client.on(Events.InteractionCreate,i=>{if(!i.guildId&&i.customId?.startsWith('qgd:appeal'))require('./qgDiscipline').handle(i).catch(async e=>{await i.reply({content:e.message}).catch(report);});});
 client.on(Events.MessageCreate,m=>{if(!m.guildId)guarded(require('./qgSchoolApplications').directMessage,m);});
 client.once(Events.ClientReady,()=>guarded(async()=>{
  const guild=client.guilds.cache.get(config.guildId);if(!guild)return;
  await guarded(require('./qgInvites').start,guild);
  require('./qgLevels').migrate();
  await guarded(require('./qgVoiceReception').tick,guild);
  setInterval(()=>guarded(require('./qgVoiceReception').tick,guild),2000).unref();
  try{require('../utils/qgDurability').assertDurable();await require('./qgConferences').recover(guild);await require('./qgRecruitmentLive').recover(guild);await require('./qgDiscipline').recover(guild);
   setInterval(()=>guarded(require('./qgConferences').tick,guild),10000).unref();

   setInterval(()=>guarded(require('./qgDiscipline').tick,guild),60000).unref();
   setInterval(()=>guarded(async()=>{await require('./qgRecruitmentHub').install(guild);}),15000).unref();
   process.once('SIGTERM',()=>require('./qgVoiceReception').shutdown());
  }catch(e){report(e);}

  const meetingTick=async()=>{await guarded(require('./qgProfileCatchup').tick,guild);await guarded(require('./qgCommunityUpgrade').tick,guild);await guarded(require('./qgInterviews').tick,guild);await guarded(require('./qgMeetings').tick,guild);await guarded(require('./qgWeeklyReport').tick,guild);await guarded(require('./qgFamilyAdmin').tick,guild);await guarded(require('./qgAnimations').tick,guild);};
  await meetingTick();setInterval(()=>guarded(meetingTick),60000).unref();
  setInterval(()=>guarded(require('./qgSupportDashboard').refresh,guild),60000).unref();
  require('./qgMemberMetrics').start(guild);
  guarded(require('./qgTagWatch').tick,guild);
  setInterval(()=>guarded(require('./qgTagWatch').tick,guild),15*60000).unref();
  setInterval(()=>guarded(require('./qgCasino').tick,guild),60000).unref();
  setInterval(()=>guarded(require('./qgCasinoAdmin').tick,guild),60000).unref();
  setInterval(()=>guarded(require('./qgMemberMetrics').tick),60000).unref();
  // Mise à jour automatique à chaque démarrage : panneaux, rôles, effectifs, support, candidatures…
  guarded(require('./qgMaintenance').refreshAll,guild);
  await guarded(require('./qgRpStatus').ensureRole,guild,'prison');
  await guarded(require('./qgRpStatus').reconcile,guild);
  setInterval(()=>guarded(require('./qgRpStatus').reconcile,guild),60000).unref();
  const pruneAI=()=>require('../utils/qgAiStore').transact(()=>{});
  await guarded(pruneAI);setInterval(()=>guarded(pruneAI),3600000).unref();
  setInterval(()=>guarded(require('./qgPanels').refreshManagement,guild),60000).unref();
  await require('./qgSchoolFamily').syncAbsenceRoles(guild).catch(e=>console.error('Rôle Absent :',e.code||e.name));
  setInterval(()=>guarded(require('./qgSchoolFamily').syncAbsenceRoles,guild),60000).unref();
  await require('./qgCommunityPolicy').expireBans(guild);
  setInterval(()=>guarded(require('./qgCommunityPolicy').expireBans,guild),60000).unref();
  // Structure changes are explicit and confirmed with /setup-serveur; startup only restores existing state.
  require('./qgSchoolFamily').expireAbsences();
  setInterval(()=>guarded(require('./qgSchoolFamily').expireAbsences),3600000).unref();
  await require('./qgSchoolGiveaways').resume(client,guild);
  setInterval(()=>guarded(require('./qgLevels').voice,guild,saved()),120000).unref();
  const s=saved();
  await require('./qgSchoolVoice').clean(guild);
  if(!s.schoolSetup){
   const rulesChannel=await guild.channels.fetch(s.channels.rules),rulesMessage=await rulesChannel.messages.fetch(s.panels.rules);
   const accept=rulesMessage.reactions.cache.find(r=>r.emoji.name==='✅');
   if(accept){let after;for(;;){const users=await accept.users.fetch({limit:100,...(after?{after}:{})});for(const user of users.values()){
     if(user.bot)continue;const member=await guild.members.fetch(user.id).catch(e=>{if(e.code===10007)return null;throw e;});
     if(member&&!member.roles.cache.has(s.roles.member))await member.roles.add(s.roles.member,'Règlement QG accepté pendant une interruption');
    }if(users.size<100)break;after=users.lastKey();}}
  }
  for(const id of Object.keys(saved().temporaryVoices||{})){const ch=guild.channels.cache.get(id);if(ch&&ch.members.size===0){await ch.delete('Nettoyage vocal temporaire vide après redémarrage');store(s=>{delete s.temporaryVoices[id];});}}
  setInterval(()=>guarded(stats,guild),600000).unref();
 }));
 // GuildCreate does not mutate the QG; the owner runs the preview/install command explicitly.
}
module.exports=register;module.exports.setup=(client,guild)=>require('./qgSchoolSetup').install(guild,client);module.exports._test={reaction,transcript,staff,stats,message,voice,interaction,ticketTypes,ticketOverwrites,parseQGTicketTopic};
