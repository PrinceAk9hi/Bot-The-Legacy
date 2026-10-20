const {ChannelType:T,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),rp=require('./qgRpStatus'),config=require('../config/qg');
async function apply(member,actor,reason,minutes){
 if(member.guild.id!==config.guildId)throw Error('Serveur incorrect.');
 if(rp.status(member.id).prison)throw Error('Une prison ou un jail est déjà actif.');
 const guild=member.guild,bot=await guild.members.fetchMe();
 a.hierarchy(actor,member,bot);
 if(member.permissions.has(P.Administrator))throw Error('Impossible d’isoler un administrateur Discord.');
 if(!bot.permissions.has([P.ManageChannels,P.ManageRoles]))throw Error('Permissions de gestion des salons et rôles requises.');
 const base=[{id:guild.id,deny:[P.ViewChannel]},{id:bot.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},...['creator','globalManager','administrator','ticketsLead','ticketsManagement'].map(k=>a.state().schoolRoles?.[k]).filter(Boolean).map(id=>({id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]}))];
 const category=await a.serial('jail-category',async()=>{
  await guild.channels.fetch();
  const id=a.state().schoolCategories?.jail;
  let ch=id?guild.channels.cache.get(id):null;
  if(ch&&ch.type!==T.GuildCategory)throw Error('La catégorie jail configurée est invalide.');
  if(!ch)ch=await guild.channels.create({name:'✦・ISOLEMENT',type:T.GuildCategory,permissionOverwrites:base,reason:'Jail temporaire QG'});
  a.save(s=>{s.schoolCategories||={};s.schoolCategories.jail=ch.id;});return ch;
 });
 // No access is granted until all other channels have been hidden successfully.
 const room=await guild.channels.create({name:'jail-'+member.id,type:T.GuildText,parent:category.id,permissionOverwrites:base,reason:'Dossier privé de jail temporaire'});
 try{
  await rp.apply(member,'prison',actor,reason,minutes,{categoryId:category.id,channelId:room.id});
  await room.permissionOverwrites.edit(member.id,{ViewChannel:true,ReadMessageHistory:true,SendMessages:true,CreatePublicThreads:false,CreatePrivateThreads:false},{reason:'Accès au seul espace de jail'});
  await room.send({content:`<@${member.id}> Tu es temporairement isolé ici pour ${minutes} minute(s). La Gestion Support peut échanger avec toi dans ce salon.`,allowedMentions:{parse:[]}});
 }catch(error){
  if(rp.status(member.id).prison?.jail?.channelId===room.id)await rp.release(member,'prison').catch(()=>{});
  throw error;
 }
}
module.exports={apply};
