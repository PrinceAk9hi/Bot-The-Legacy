const {ChannelType:T,PermissionFlagsBits:P,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),u=require('../utils/qgModuleUi'),access=require('../utils/qgCasinoAccess'),config=require('../config/qg');
const games=()=>require('./qgCasinoGames');
const direction=['creator','globalManager','administrator'],staffKeys=[...direction,'casinoLead','casinoOperator'];
const brand=require('../utils/qgBrand');
const state=()=>a.state().schoolCasino||{};
function overwrites(guild,kind){
 const r=a.state().schoolRoles||{},ids=new Set((kind==='public'?['community','verified','test','confirmed','expert','prestigious','senior',...staffKeys]:staffKeys).map(k=>r[k]).filter(id=>guild.roles.cache.has(id)));
 const read=[P.ViewChannel,P.ReadMessageHistory],write=[...read,P.SendMessages,P.AttachFiles,P.EmbedLinks,P.Connect,P.Speak];
 return [{id:guild.id,deny:[P.ViewChannel]},...[...ids].map(id=>({id,allow:kind==='public'?read:write,deny:[P.MentionEveryone]})),{id:guild.client.user.id,allow:[...write,P.ManageChannels,P.ManageMessages]}];
}
function payload(kind){
 const s=state(),channels=a.state().schoolChannels||{},closed=s.enabled===false;
 let title='LE QG · CASINO',text='',rows=[];
 if(kind==='home'){
  text=`**Un espace de jeu pour la communauté.**\n\n**${closed?'● Nouvelles mises fermées':'● Casino ouvert'}**\nMachines à sous · Roulette · Blackjack · Mines\n\n**Ton portefeuille**\n1 000 jetons à la première visite. Récompense gratuite de 500 jetons toutes les 24 heures.\n\n**Comment jouer ?**\nOuvre ton espace personnel, choisis un jeu et indique ta mise. Tes parties et ton solde sont sauvegardés.\n\n**Besoin d’aide ?**\nOuvre un ticket casino pour joindre notre équipe.\n\nJetons fictifs, sans achat, valeur monétaire ni conversion en argent.`;
  rows=[u.row(u.button('qgcasino:open','Mon espace casino',u.ButtonStyle.Primary),u.button('qgcasino:rules','Règles des jeux'),u.button('qgcasino:board','Classement')),u.row(u.button('qg:casino-ticket','Support casino'))];
 }else if(kind==='rules'){
  title='CASINO · Guide du joueur';text='**01 · Une économie fictive**\nJetons gratuits, non achetables et non convertibles en argent ou en récompenses de valeur. Aucun transfert entre joueurs.\n\n**02 · Des règles lisibles**\nMises de 10 à 10 000 jetons, sans dépasser ton solde. Une partie interactive à la fois. Les retours comprennent la mise. Consulte les règles détaillées avant de jouer.\n\n**03 · Des parties conservées**\nTon portefeuille est sauvegardé. Les anciennes interactions ne doublent pas les mises. Après 30 minutes, une partie inactive est résolue selon les règles du jeu.\n\n**04 · Une équipe disponible**\nLes Exécutants du casino traitent les tickets ; le Responsable du casino coordonne l’équipe. La Direction supervise cet espace.';
  rows=[u.row(u.button('qgcasino:rules','Règles détaillées'),u.button('qgcasino:open','Jouer'),u.button('qg:casino-ticket','Contacter le casino'))];
 }else if(kind==='board'){
  title='CASINO · Classement';text=games().store.leaderboard().map(([id,v],i)=>`**${i+1}.** <@${id}> — **${v.balance.toLocaleString('fr-FR')} jetons**`).join('\n')||'Le classement apparaîtra dès les premières parties.';rows=[u.row(u.button('qgcasino:board','Consulter le classement actuel'),u.button('qgcasino:open','Mon portefeuille'))];
 }else if(kind==='support'){
  title='CASINO · Assistance privée';text='**Une question, un problème de partie ou de portefeuille ?**\n\nOuvre un ticket privé et indique le jeu, la date approximative et ce que tu as constaté. Joins une capture si elle aide à comprendre.\n\n**Ton dossier**\nUn ticket casino actif par membre. L’équipe peut le prendre en charge, le renommer puis l’archiver à sa fermeture.\n\nLes Exécutants du casino, son Responsable et la Direction ont accès au dossier.';rows=[u.row(u.button('qg:casino-ticket','Ouvrir mon ticket casino',u.ButtonStyle.Primary))];
 }else{
  title='CASINO · Pilotage de l’équipe';text=`**État : ${closed?'fermé aux nouvelles mises':'ouvert'}**\n\n**Exécutant du casino**\nAccompagner les joueurs et prendre en charge les tickets depuis leurs boutons.\n\n**Responsable du casino**\nCoordonner l’équipe et ouvrir ou suspendre les nouvelles mises. Les parties engagées restent accessibles.\n\n${brand.badge} **${brand.label}**\nSupervision, attribution des rôles via Discord et historique administratif.\n\n**Accès rapides**\nAccueil : <#${channels.casinoHome}> · Support : <#${channels.casinoSupportPanel}>`;
  rows=[u.row(u.button('qgcasino:stats','Statistiques'),u.button('qgcasino:tickets','Tickets casino')),u.row(u.button('qgcasino:enable','Ouvrir les mises',u.ButtonStyle.Success),u.button('qgcasino:disable','Suspendre les mises',u.ButtonStyle.Danger))];
 }
 return {...u.payload(title,text,rows),attachments:[]};
}
async function publish(guild,key,kind){
 const ch=await guild.channels.fetch(a.state().schoolChannels?.[key]);if(!ch||ch.type!==T.GuildText)throw Error('Salon casino introuvable : '+key);
 const saved=state().panels?.[kind];let message=saved?.channelId===ch.id?await ch.messages.fetch(saved.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!message){const recent=await ch.messages.fetch({limit:100});const title=payload(kind).embeds[0].data.title;message=recent.find(m=>m.author.id===guild.client.user.id&&m.embeds[0]?.title===title);}
 const next=payload(kind);if(message){if(message.author.id!==guild.client.user.id)throw Error('Le panel casino enregistré appartient à un autre compte.');await message.edit(next);}else message=await ch.send(next);
 a.save(s=>{s.schoolCasino||={};s.schoolCasino.panels||={};s.schoolCasino.panels[kind]={channelId:ch.id,messageId:message.id};});
}
async function install(guild){return a.serial('casino-install',async()=>{
 if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');require('../utils/qgDurability').assertDurable();
 const me=await guild.members.fetchMe();if(!me.permissions.has([P.ManageChannels,P.ManageRoles]))throw Error('Le bot doit pouvoir gérer les rôles et les salons du casino.');
 await guild.roles.fetch();await guild.channels.fetch();
 for(const [key,name]of [['casinoLead','Responsable du casino'],['casinoOperator','Exécutant du casino']]){
  let role=guild.roles.cache.get(a.state().schoolRoles?.[key]);
  if(!role){const matches=guild.roles.cache.filter(r=>!r.managed&&r.name===name);if(matches.size>1)throw Error('Plusieurs rôles nommés '+name);role=matches.first();}
  if(!role)role=await guild.roles.create({name,color:0xd4bd86,permissions:[],hoist:true,reason:'Équipe casino QG'});
  if(role.permissions.has(P.Administrator))throw Error('Retire Administrator du rôle casino '+name+' avant de continuer.');
  a.save(s=>{s.schoolRoles||={};s.schoolRoles[key]=role.id;});
 }
 const categories=[['casino','🎰〃CASINO','public'],['casinoStaff','🎲〃GESTION CASINO','staff'],['casinoSupport','🎫〃TICKETS CASINO','staff']];
 for(const [key,name,kind]of categories){let ch=guild.channels.cache.get(a.state().schoolCategories?.[key]);ch||=guild.channels.cache.find(c=>c.type===T.GuildCategory&&c.name===name);if(ch&&ch.type!==T.GuildCategory)throw Error('Catégorie casino incompatible : '+key);if(!ch)ch=await guild.channels.create({name,type:T.GuildCategory,permissionOverwrites:overwrites(guild,kind),reason:'Espace casino QG'});else await ch.permissionOverwrites.set(overwrites(guild,kind));a.save(s=>{s.schoolCategories||={};s.schoolCategories[key]=ch.id;});}
 for(const [key,name,parent,type]of [
  ['casinoHome','🎰・casino','casino',T.GuildText],['casinoRules','📜・règlement-casino','casino',T.GuildText],['casinoBoard','🏆・classement-casino','casino',T.GuildText],['casinoSupportPanel','🎫・support-casino','casino',T.GuildText],['casinoLounge','🔊・salon-du-casino','casino',T.GuildVoice],
  ['casinoControl','🛠・pilotage-casino','casinoStaff',T.GuildText],['casinoTeam','💬・équipe-casino','casinoStaff',T.GuildText],['casinoOffice','🔊・bureau-casino','casinoStaff',T.GuildVoice]]){
  const parentId=a.state().schoolCategories[parent];let ch=guild.channels.cache.get(a.state().schoolChannels?.[key]);ch||=guild.channels.cache.find(c=>c.parentId===parentId&&c.name===name&&c.type===type);if(ch&&ch.type!==type)throw Error('Salon casino incompatible : '+key);
  const grants=overwrites(guild,parent==='casino'?'public':'staff');if(parent==='casino')for(const entry of grants)if(entry.id!==guild.id&&entry.id!==guild.client.user.id){if(type===T.GuildVoice)entry.allow.push(P.Connect,P.Speak);else entry.deny.push(P.SendMessages,P.CreatePublicThreads,P.CreatePrivateThreads);}
  if(!ch)ch=await guild.channels.create({name,type,parent:parentId,permissionOverwrites:grants,reason:'Installation casino QG'});else await ch.edit({parent:parentId,permissionOverwrites:grants});
  a.save(s=>{s.schoolChannels||={};s.schoolChannels[key]=ch.id;});
 }
 a.save(s=>{s.schoolCasino||={};s.schoolCasino.enabled??=true;s.schoolCasino.installedAt??=Date.now();});
 for(const [key,kind]of [['casinoHome','home'],['casinoRules','rules'],['casinoBoard','board'],['casinoSupportPanel','support'],['casinoControl','control']])await publish(guild,key,kind);
 return {detail:'2 rôles, 3 catégories, 8 salons et 5 panels prêts'};
 });}
async function handle(i){
 if(i.guildId!==config.guildId||!await access.allowed(i))throw Error('Accepte le règlement du QG pour accéder au casino.');
 const action=i.customId.split(':')[1];
 if(action==='open')return games().launch(i);
 if(action==='rules'||action==='board')return i.reply({...games().payload(i.user.id,action),flags:F.Ephemeral});
 const member=await i.guild.members.fetch({user:i.user.id,force:true});if(!access.staff(member))throw Error('Cette action est réservée à l’équipe casino.');
 await i.deferReply({flags:F.Ephemeral});
 if(action==='stats'){
  const accounts=Object.values(require('../utils/recruitmentData').read('qgCasino').accounts||{}),sum=k=>accounts.reduce((n,x)=>n+(x[k]||0),0);
  return i.editReply(u.payload('CASINO · Statistiques',`Joueurs : **${accounts.length}**\nParties terminées : **${sum('played')}**\nParties actives : **${accounts.filter(x=>x.game).length}**\nJetons en circulation : **${sum('balance').toLocaleString('fr-FR')}**\nTotal misé : **${sum('wagered').toLocaleString('fr-FR')}**\nRetours des jeux : **${sum('returned').toLocaleString('fr-FR')}**`));
 }
 if(action==='tickets'){
  const tickets=Object.entries(a.state().tickets||{}).filter(([,t])=>t.type==='casino');
  return i.editReply(u.payload('CASINO · Tickets en cours',`${tickets.length} dossier(s).\n\n`+(tickets.slice(0,30).map(([id,t])=>`<#${id}> · ${t.claimedBy?'pris par <@'+t.claimedBy+'>':'à prendre'}`).join('\n')||'Aucun dossier en attente.')));
 }
 if(!['enable','disable'].includes(action)||!access.manager(member))throw Error('Ouverture et fermeture réservées au Responsable du casino et à la Direction.');
 return a.serial('casino-status',async()=>{const fresh=await i.guild.members.fetch({user:i.user.id,force:true});if(!access.manager(fresh))throw Error('Ton accès responsable a été retiré.');const before=state().enabled;a.save(s=>{s.schoolCasino||={};s.schoolCasino.enabled=action==='enable';});await a.audit(i.guild,{action:'casino.'+action,actorId:i.user.id,before,after:action==='enable'});await publish(i.guild,'casinoHome','home');await publish(i.guild,'casinoControl','control');return i.editReply(action==='enable'?'Les nouvelles mises sont ouvertes.':'Les nouvelles mises sont suspendues. Les joueurs peuvent terminer leurs parties en cours.');});
}
async function tick(guild){
 if(!state().installedAt)return;
 require('../utils/qgDurability').assertDurable();
 return a.serial('casino-board',async()=>{
  games().store.expireAll();
  const signature=JSON.stringify(games().store.leaderboard().map(([id,v])=>[id,v.balance]));
  if(signature===state().boardSignature)return;
  await publish(guild,'casinoBoard','board');a.save(s=>{s.schoolCasino.boardSignature=signature;});
 });
}
module.exports={install,handle,payload,publish,tick};
