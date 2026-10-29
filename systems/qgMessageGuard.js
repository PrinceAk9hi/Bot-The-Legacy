// Protection des messages du QG : un message supprimé réapparaît aussitôt (nom et avatar de son auteur,
// pièces jointes conservées), sauf si la suppression vient du propriétaire ou du bot lui-même
// (anti-spam, modération automatique). Le contenu est gardé en mémoire dès l'envoi du message.
const {AuditLogEvent,AttachmentBuilder,PermissionFlagsBits:P}=require('discord.js');
const config=require('../config/qg'),qgLog=require('../utils/qgLog');
const HOOK='QG · Messages restaurés',KEEP=48*3600000,MAX=20000,FILE_MAX=8*1024*1024,BUDGET=150*1024*1024;
const cache=new Map(),hooks=new Map();let bytes=0;

function prune(now=Date.now()){
 for(const [id,rec] of cache){if(cache.size<=MAX&&now-rec.createdAt<KEEP&&bytes<=BUDGET)break;drop(id,rec);}
}
function drop(id,rec){for(const f of rec.files)if(f.buffer){bytes-=f.buffer.length;f.buffer=null;}cache.delete(id);}
function record(m){
 const member=m.member,user=m.author;
 return {id:m.id,channelId:m.channelId,authorId:user.id,displayName:member?.displayName||user.globalName||user.username||'Membre',avatar:(member||user).displayAvatarURL?.({extension:'png',size:128})||null,
  content:m.content||'',files:[...(m.attachments?.values?.()||[])].map(a=>({name:a.name||'fichier',url:a.url,size:a.size||0,buffer:null})),createdAt:m.createdTimestamp||Date.now()};
}
// Mémorise un message et télécharge ses pièces jointes tant qu'elles sont encore accessibles.
function remember(m,{fetcher=fetch}={}){
 if(m.guildId!==config.guildId||!m.author||m.author.bot||m.system||m.webhookId)return null;
 const rec=record(m);cache.set(m.id,rec);
 for(const f of rec.files){if(f.size>FILE_MAX)continue;
  fetcher(f.url,{signal:AbortSignal.timeout(20000)}).then(r=>r.ok?r.arrayBuffer():null).then(buf=>{if(!buf||buf.byteLength>FILE_MAX||!cache.has(rec.id))return;f.buffer=Buffer.from(buf);bytes+=f.buffer.length;prune();}).catch(()=>{});}
 prune();return rec;
}
const allowedActor=(guild,id)=>id===config.ownerId||id===guild.client.user.id;

async function webhook(guild,channel){
 const parent=channel.isThread?.()?channel.parent:channel;
 if(!parent?.fetchWebhooks)throw Error('Salon incompatible avec la restauration.');
 if(!parent.permissionsFor(guild.members.me)?.has(P.ManageWebhooks))throw Error('Le bot doit pouvoir gérer les webhooks de ce salon.');
 let hook=hooks.get(parent.id);
 if(!hook){const list=await parent.fetchWebhooks();hook=list.find(w=>w.owner?.id===guild.client.user.id&&w.name===HOOK)||await parent.createWebhook({name:HOOK,reason:'Restauration des messages supprimés'});hooks.set(parent.id,hook);}
 return hook;
}
async function restore(guild,rec){
 const channel=await guild.channels.fetch(rec.channelId).catch(()=>null);if(!channel)throw Error('Salon introuvable.');
 const hook=await webhook(guild,channel);
 const kept=rec.files.filter(f=>f.buffer),lost=rec.files.filter(f=>!f.buffer).map(f=>f.name);
 const content=[rec.content.slice(0,1800),lost.length?`-# 📎 Pièce(s) jointe(s) non récupérable(s) : ${lost.join(', ').slice(0,150)}`:'',`-# 🛡️ Message restauré · envoyé <t:${Math.floor(rec.createdAt/1000)}:R> · suppression non autorisée`].filter(Boolean).join('\n');
 // Les noms contenant « discord » ou « clyde » sont refusés par Discord pour un webhook.
 const payload=()=>({content,username:rec.displayName.replace(/discord|clyde/gi,'•').slice(0,80)||'Membre',avatarURL:rec.avatar||undefined,files:kept.map(f=>new AttachmentBuilder(f.buffer,{name:f.name})),threadId:channel.isThread?.()?channel.id:undefined,allowedMentions:{parse:[]}});
 let sent;
 try{sent=await hook.send(payload());}
 catch(e){if(e.code!==10015)throw e;hooks.delete((channel.isThread?.()?channel.parent:channel).id);sent=await (await webhook(guild,channel)).send(payload());}// webhook supprimé entre-temps
 // Le message restauré reste protégé : il garde l'auteur d'origine.
 cache.set(sent.id,{...rec,id:sent.id,postedAs:sent.author?.id||hook.id});
 return sent;
}

// Message supprimé : renvoie {by, allowed, restored, error} pour le journal de modération.
async function onDelete(m){
 if(m.guildId!==config.guildId)return null;
 const rec=cache.get(m.id)||(m.author&&!m.author.bot&&!m.webhookId&&(m.content||m.attachments?.size)?record(m):null);
 if(!rec)return {unknown:!m.author?.bot};
 cache.delete(m.id);
 const guild=m.guild,targets=[rec.authorId,rec.postedAs].filter(Boolean);
 let by=await qgLog.recent(guild,AuditLogEvent.MessageDelete,{match:e=>targets.includes(e.target?.id)&&e.extra?.channel?.id===rec.channelId,maxAge:20000});
 if(!by)by=await qgLog.recent(guild,AuditLogEvent.MemberBanAdd,{match:e=>e.target?.id===rec.authorId,maxAge:120000,wait:0,retries:0});
 // Sans entrée d'audit, c'est l'auteur qui a supprimé son propre message.
 const actor=by?.user?.id||rec.authorId;
 if(allowedActor(guild,actor))return {by,allowed:true,rec};
 try{const sent=await restore(guild,rec);return {by,allowed:false,restored:sent.url,rec};}
 catch(e){return {by,allowed:false,error:e.message,rec};}
}
async function onBulk(messages,channel){
 const guild=channel?.guild;if(!guild||guild.id!==config.guildId)return null;
 let by=await qgLog.recent(guild,AuditLogEvent.MessageBulkDelete,{match:e=>e.target?.id===channel.id||e.targetId===channel.id,maxAge:30000});
 const list=[...messages.values()].map(m=>cache.get(m.id)||(m.author&&!m.author.bot&&!m.webhookId&&(m.content||m.attachments?.size)?record(m):null)).filter(Boolean).sort((x,y)=>x.createdAt-y.createdAt);
 if(!by&&list.length){const authors=new Set(list.map(r=>r.authorId));by=await qgLog.recent(guild,AuditLogEvent.MemberBanAdd,{match:e=>authors.has(e.target?.id),maxAge:120000,wait:0,retries:0});}
 for(const m of messages.values())cache.delete(m.id);
 if(by&&allowedActor(guild,by.user?.id))return {by,allowed:true,count:list.length};
 let restored=0,failed=0,error=null;
 for(const rec of list.slice(0,40)){try{await restore(guild,rec);restored++;}catch(e){failed++;error=e.message;}}
 return {by,allowed:false,restored,failed:failed+Math.max(0,list.length-40),error,count:list.length};
}
module.exports={remember,onDelete,onBulk,restore,record,cache,HOOK};
