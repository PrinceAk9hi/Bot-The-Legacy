// Commandes préfixe du QG :
//   =clear <nombre>        supprime la commande et les <nombre> messages précédents (1 à 100), sans aucun message du bot.
//   =mvvoc [#vocal | ID]   déplace tout un vocal (le tien, ou celui indiqué) dans le prochain vocal que tu rejoins (2 minutes).
const {PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const WAIT_MS=120000;
const pending=new Map(); // auteur -> {sourceId, guildId, reply, expires}

const owner=m=>m.author.id===config.ownerId||m.author.id===m.guild.ownerId;

async function clear(m){
 const match=/^=clear\s+(\d{1,3})\s*$/i.exec(m.content.trim());
 // Aucun message en retour, même en cas d'erreur ou de mauvais usage.
 await m.delete().catch(()=>{});
 if(!match)return;
 const count=Math.min(100,Math.max(1,Number(match[1])));
 if(!owner(m)&&!m.channel.permissionsFor(m.member)?.has(P.ManageMessages))return;
 const me=await m.guild.members.fetchMe();
 if(!m.channel.permissionsFor(me)?.has([P.ManageMessages,P.ReadMessageHistory]))return console.warn('=clear : permission Gérer les messages manquante pour le bot.');
 // Messages de moins de 14 jours seulement (limite Discord des suppressions groupées).
 const deleted=await m.channel.bulkDelete(count,true).catch(e=>{console.error('=clear :',e.code||e.message);return null;});
 if(deleted)await a.audit(m.guild,{action:'messages.clear',actorId:m.author.id,after:`${deleted.size} message(s) dans #${m.channel.name}`}).catch(()=>{});
}

async function mvvoc(m){
 const say=content=>m.reply({content,allowedMentions:{parse:[]}});
 const match=/^=mvvoc(?:\s+(?:<#(\d{17,20})>|(\d{17,20})))?\s*$/i.exec(m.content.trim());
 if(!match)return say('Utilisation : `=mvvoc` (ton vocal actuel) ou `=mvvoc #vocal`, puis rejoins le vocal de destination.');
 const author=await m.guild.members.fetch(m.author.id);
 const sourceId=match[1]||match[2]||author.voice.channelId;
 if(!sourceId)return say('Indique le vocal à déplacer (`=mvvoc #vocal`) ou rejoins-le d’abord.');
 const source=await m.guild.channels.fetch(sourceId).catch(()=>null);
 if(!source?.isVoiceBased())return say('Ce salon n’est pas un salon vocal.');
 if(!owner(m)&&!source.permissionsFor(author)?.has(P.MoveMembers))return say('Il te faut la permission « Déplacer des membres » sur ce vocal.');
 const reply=await say(`🔀 Rejoins maintenant le vocal de destination : les membres de <#${source.id}> y seront déplacés. *(valable 2 minutes)*`);
 pending.set(m.author.id,{sourceId:source.id,guildId:m.guild.id,reply,owner:owner(m),expires:Date.now()+WAIT_MS});
}

// Le prochain vocal rejoint par l'auteur devient la destination.
async function voice(oldState,newState){
 const order=pending.get(newState.id);
 if(!order||!newState.channelId||newState.channelId===oldState.channelId||newState.guild.id!==order.guildId)return;
 if(Date.now()>order.expires){pending.delete(newState.id);return order.reply?.edit({content:'⌛ `=mvvoc` expiré : relance la commande.'}).catch(()=>{});}
 if(newState.channelId===order.sourceId)return; // retour dans le vocal source : on attend encore
 pending.delete(newState.id);
 const guild=newState.guild,dest=newState.channel,source=await guild.channels.fetch(order.sourceId).catch(()=>null);
 const done=content=>order.reply?.edit({content,allowedMentions:{parse:[]}}).catch(()=>{});
 if(!source)return done('❌ Le vocal source n’existe plus.');
 const author=newState.member,me=await guild.members.fetchMe();
 if(!order.owner&&!dest.permissionsFor(author)?.has(P.MoveMembers))return done(`❌ Il te faut la permission « Déplacer des membres » sur <#${dest.id}>.`);
 if(!dest.permissionsFor(me)?.has([P.MoveMembers,P.Connect])||!source.permissionsFor(me)?.has(P.MoveMembers))return done('❌ Le bot n’a pas la permission de déplacer des membres entre ces vocaux.');
 let moved=0,failed=0;
 for(const member of [...source.members.values()]){
  if(member.id===author.id)continue;
  try{await member.voice.setChannel(dest,`=mvvoc par ${author.user.username} (${author.id})`);moved++;}catch{failed++;}
 }
 await a.audit(guild,{action:'voice.moveall',actorId:author.id,after:`${moved} membre(s) : #${source.name} → #${dest.name}`}).catch(()=>{});
 return done(`✅ ${moved} membre${moved>1?'s':''} déplacé${moved>1?'s':''} de <#${source.id}> vers <#${dest.id}>.${failed?` ${failed} n’ont pas pu l’être.`:''}`);
}

async function message(m){
 if(m.guildId!==config.guildId||m.author.bot)return false;
 const content=m.content.trim();
 if(/^=clear(\s|$)/i.test(content)){await clear(m);return true;}
 if(/^=mvvoc(\s|$)/i.test(content)){await mvvoc(m);return true;}
 return false;
}
module.exports={message,voice,_test:{pending}};
