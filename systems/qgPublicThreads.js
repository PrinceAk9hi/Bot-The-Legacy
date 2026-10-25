const {ChannelType,PermissionFlagsBits:P,MessageType}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const channelId='1563864872385781890';
async function inspect(guild){
 const channel=await guild.channels.fetch(channelId);if(channel?.guildId!==config.guildId||channel.type!==ChannelType.GuildText)throw Error('Le salon des fils publics doit être un salon textuel du QG.');
 const me=await guild.members.fetchMe();if(!channel.permissionsFor(me)?.has([P.ViewChannel,P.ReadMessageHistory,P.CreatePublicThreads,P.SendMessagesInThreads]))throw Error('Accorde au bot Voir le salon, Voir les anciens messages, Créer des fils publics et Envoyer des messages dans les fils.');
 return {detail:'Un fil public par nouveau message de membre dans <#'+channelId+'>'};
}
async function message(m){
 if(m.guildId!==config.guildId||m.channelId!==channelId||m.author?.bot||m.webhookId||![MessageType.Default,MessageType.Reply].includes(m.type))return;
 return a.serial('qg-public-thread:'+m.id,async()=>{
  if(m.hasThread)return;
  try{
   const name=(m.content||'Discussion de '+(m.member?.displayName||m.author.username)).replace(/<[^>]*>/g,'').replace(/[\r\n\t]+/g,' ').trim().slice(0,95)||'Discussion';
   await m.startThread({name,autoArchiveDuration:1440,reason:'Fil public automatique QG'});
  }catch(error){
   // Discord allows only one thread per message, including across reconnects.
   if(error.code===160004)return;
   const prior=a.state().schoolPublicThreads?.lastFailure;
   if(!prior||Date.now()-prior.at>900000){a.save(s=>{s.schoolPublicThreads={lastFailure:{at:Date.now(),messageId:m.id,code:error.code||error.name}};});await a.audit(m.guild,{action:'public-thread.failed',actorId:m.client.user.id,targetId:m.author.id,after:{channelId,messageId:m.id,code:error.code||error.name},result:'failed'});}
   console.error('Fil public QG :',error.code||error.name);
  }
 });
}
module.exports={message,inspect,channelId};
