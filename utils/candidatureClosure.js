const {AttachmentBuilder,ChannelType,EmbedBuilder}=require('discord.js');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const {read,update}=require('./recruitmentData');
const {isOff}=require('./lineState');
const CATEGORY='1477270568611876934',LOGS='1468699236475474032',DELAY=12*3600000;
const locks=new Set();let running=false;
function candidateId(ticket){return /^candidature:(\d{17,20})$/.exec(ticket.topic||'')?.[1];}
function valid(ticket){return ticket?.guildId===IDENTITY.guildId&&ticket.type===ChannelType.GuildText&&ticket.parentId===CATEGORY&&Boolean(candidateId(ticket));}
function decision(message,botId){
 if(message.author.id!==botId)return null;
 const descriptions=(message.embeds||[]).filter(e=>e.title?.startsWith('Mise à jour de votre candidature')).map(e=>e.description||'').join('\n');
 if(descriptions.includes('celle-ci a été acceptée'))return 'accepted';
 if(descriptions.includes("celle-ci n'a malheureusement pas été retenue"))return 'refused';
 return null;
}
async function evidence(ticket,botId){let before;for(let page=0;page<20;page++){
 const batch=await ticket.messages.fetch({limit:100,...(before?{before}:{})});
 for(const m of [...batch.values()].sort((a,b)=>b.createdTimestamp-a.createdTimestamp)){const state=decision(m,botId);if(state)return {decision:state,at:m.createdTimestamp,messageId:m.id};}
 if(batch.size<100)return null;before=batch.last().id;
 }return null;}
async function transcript(ticket){let before,all=[];for(let page=0;page<100;page++){
 const batch=await ticket.messages.fetch({limit:100,...(before?{before}:{})});all.push(...batch.values());
 if(batch.size<100)return Buffer.from(all.sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>`${new Date(m.createdTimestamp).toISOString()} | ${m.author.tag||m.author.id} (${m.author.id})\n${m.content||''}\n${(m.embeds||[]).map(e=>JSON.stringify(e.toJSON?.()||e)).join('\n')}\n${[...(m.attachments?.values()||[])].map(a=>a.url).join('\n')}`).join('\n\n')||'Ticket vide.');
 before=batch.last().id;
 }throw Error('Transcript trop long : ticket conservé pour archivage manuel.');}
function recordedAt(record,state,ticketId){if(record?.ticketId!==ticketId||record.decision!==state)return null;const at=state==='accepted'?record.acceptedAt:record.refusedAt;return Number.isFinite(at)&&at>0?at:null;}
async function inspect(ticket,botId){if(!valid(ticket))return null;const proof=await evidence(ticket,botId);if(!proof)return null;const id=candidateId(ticket),r=read('candidatures')[id];const at=recordedAt(r,proof.decision,ticket.id)||proof.at;return {...proof,at,closeAt:at+DELAY,candidateId:id,ticketId:ticket.id};}
async function close(client,guild,ticket,id,{automatic=false,closedById=null}={}){
 if(!valid(ticket)||candidateId(ticket)!==id||isOff()||locks.has(ticket.id))return false;locks.add(ticket.id);
 try{
  const info=await inspect(ticket,client.user.id);if(!info||automatic&&Date.now()<info.closeAt)return false;
  const archive=await transcript(ticket);
  let channel=await guild.channels.fetch(LOGS).catch(e=>{if(e.code===10003)return null;throw e;});
  if(!channel)channel=await guild.channels.fetch('1471556441218224209');
  if(!channel?.isTextBased()||channel.guildId!==guild.id)throw Error('Salon de logs indisponible : ticket conservé.');
  const previous=read('candidatureClosureReceipts')[ticket.id];
  if(!previous||previous.decisionMessageId!==info.messageId){
   const message=await channel.send({embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('Archive de candidature avant fermeture').setDescription(`Candidat : <@${id}>\nTicket : ${ticket.name} (${ticket.id})\nDécision : ${info.decision==='accepted'?'Acceptée':'Refusée'}\n${automatic?'Délai de 12 heures dépassé.':`Fermeture demandée par <@${closedById}>.`}`)],files:[new AttachmentBuilder(archive,{name:`candidature-${id}-${ticket.id}.txt`})],allowedMentions:{parse:[]}});
   update('candidatureClosureReceipts',all=>{all[ticket.id]={messageId:message.id,decisionMessageId:info.messageId,at:Date.now()};});
  }
  // Recheck after archiving: a changed decision must not be deleted on an old deadline.
  const latest=await inspect(ticket,client.user.id);if(isOff()||!latest||latest.messageId!==info.messageId||automatic&&Date.now()<latest.closeAt)return false;
  await ticket.delete(automatic?'Candidature traitée : fermeture 12h après décision':'Candidature traitée : fermeture manuelle');
  update('candidatures',all=>{const r=all[id];if(r?.ticketId===ticket.id){r.ticketClosedAt=Date.now();r.ticketClosedBy=automatic?'AUTO_12H':closedById;}});
  return true;
 }finally{locks.delete(ticket.id);}
}
async function check(client){if(running||isOff())return;running=true;const result={examined:0,deleted:0,pending:0,errors:0};try{
 const guild=client.guilds.cache.get(IDENTITY.guildId);if(!guild)return result;
 const channels=await guild.channels.fetch();
 for(const ticket of channels.values()){if(isOff())break;if(!valid(ticket))continue;result.examined++;
  try{const info=await inspect(ticket,client.user.id);if(!info){result.pending++;continue;}
   update('candidatures',all=>{const r=all[info.candidateId];if(r?.ticketId===ticket.id&&r.decision===info.decision){r.closeAt=info.closeAt;if(info.decision==='accepted')r.acceptedAt=info.at;else r.refusedAt=info.at;}});
   if(Date.now()>=info.closeAt){if(await close(client,guild,ticket,info.candidateId,{automatic:true}))result.deleted++;}else result.pending++;
  }catch(e){result.errors++;console.error('Fermeture candidature '+ticket.id+' :',e.code||e.message);}
 }
 return result;
 }finally{running=false;}}
module.exports={DELAY,CATEGORY,LOGS,candidateId,valid,decision,evidence,inspect,transcript,close,check};
