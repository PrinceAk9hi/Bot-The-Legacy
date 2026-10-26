const {randomUUID}=require('node:crypto');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),panel=require('./qgUserPanel');
const ranks=['test','confirmed','expert','prestigious','senior'];
const channelId='1561157222032212059',delay=48*60*60*1000;
function tagState(user){if(!Object.prototype.hasOwnProperty.call(user,'primaryGuild'))return 'unknown';const p=user.primaryGuild;return p?.identityEnabled===true&&p.identityGuildId===config.guildId?'present':'missing';}
function decision(record,tag,now=Date.now()){if(tag==='unknown')return 'wait';if(tag==='present')return 'resolve';if(!record)return 'remind';if(record.status==='pending'&&now>=record.dueAt)return 'derank';return 'wait';}
const records=()=>a.state().schoolTagWatch||{};
function save(id,record){a.save(s=>{s.schoolTagWatch||={};s.schoolTagWatch[id]=record;});}
async function notice(guild,id,text){const ch=await guild.channels.fetch(channelId);if(!ch?.isTextBased()||ch.guildId!==config.guildId)throw Error('Salon de rappel du tag indisponible.');return ch.send({content:`<@${id}>`,embeds:[require('./qgPanels').embed('Tag du serveur · QG',text)],allowedMentions:{users:[id],parse:[]}});}
async function inspect(member){if(member.guild.id!==config.guildId||member.user.bot)return;require('../utils/qgDurability').assertDurable();return a.serial('member:'+member.id,async()=>{
 const guild=member.guild,m=await guild.members.fetch({user:member.id,force:true}),raw=await guild.client.rest.get(require('discord.js').Routes.user(m.id)),user=Object.prototype.hasOwnProperty.call(raw,'primary_guild')?{primaryGuild:raw.primary_guild?{identityEnabled:raw.primary_guild.identity_enabled,identityGuildId:raw.primary_guild.identity_guild_id}:null}:{};
 const before=panel.rank(m);let record=records()[m.id];
 if(record&&record.joinedAt!==m.joinedTimestamp){save(m.id,{...record,status:'left',closedAt:Date.now()});record=null;}
 if(!before){if(record?.status==='pending')save(m.id,{...record,status:'left',closedAt:Date.now()});return;}
 const tag=tagState(user);
 if(record?.status==='applying'){save(m.id,{...record,status:'review',reason:'Redémarrage pendant le changement : vérification humaine nécessaire.'});await a.audit(guild,{action:'tag.review',actorId:guild.client.user.id,targetId:m.id,after:record,reason:'Résultat du changement de grade à vérifier',result:'review'});return;}
 if(record&&['resolved','left'].includes(record.status))record=null;
 const action=decision(record,tag);
 if(action==='resolve'){if(record){save(m.id,{...record,status:'resolved',closedAt:Date.now()});await a.audit(guild,{action:'tag.restored',actorId:guild.client.user.id,targetId:m.id,reason:'Badge de serveur QG rétabli'});}return;}
 if(action==='remind'){
  const sent=await notice(guild,m.id,'Le port du **tag de serveur Discord QG** est obligatoire pour les membres de la famille. Active-le sur ton profil dans les **48 heures**. Sans régularisation, une rétrogradation d’un grade sera appliquée. Ce rappel n’ajoute pas de rôle d’avertissement disciplinaire.');
  save(m.id,{id:randomUUID(),joinedAt:m.joinedTimestamp,status:'pending',remindedAt:sent.createdTimestamp,dueAt:sent.createdTimestamp+delay,messageId:sent.id});return;
 }
 if(action!=='derank')return;
 const index=ranks.indexOf(before),roles=a.state().schoolRoles||{},to=ranks[index-1],bot=await guild.members.fetchMe();
 if(index<=0||a.isDirection(m)||!to){save(m.id,{...record,status:'review',reason:'Grade minimal ou membre de la Direction : décision humaine requise.'});await a.audit(guild,{action:'tag.review',actorId:bot.id,targetId:m.id,reason:'Tag absent après 48 h ; rétrogradation automatique non applicable',result:'review'});await notice(guild,m.id,'Le tag reste absent après 48 heures. Le dossier est transmis à la Direction pour examen.');return;}
 const changed=[roles[before],roles[to]].map(id=>guild.roles.cache.get(id));
 a.hierarchy(bot,m,bot,changed);
 save(m.id,{...record,status:'applying',before,after:to,startedAt:Date.now()});
 try{
  await panel.changeRoles(m,{action:'derank-tag',add:[roles[to]],remove:[roles[before]]});
  save(m.id,{...record,status:'applied',before,after:to,appliedAt:Date.now()});
 }catch(error){save(m.id,{...record,status:'review',before,after:to,reason:'Changement interrompu ; contrôler les rôles avant toute nouvelle action.'});throw error;}
 await a.audit(guild,{action:'derank',actorId:bot.id,targetId:m.id,before,after:{grade:to,tagCaseId:record.id},reason:'Tag du serveur QG toujours absent 48 heures après le rappel.'});
 await require('./qgSchoolSeparators').syncMember(await guild.members.fetch({user:m.id,force:true})).catch(()=>{});
 await notice(guild,m.id,`Le tag du serveur QG n’a pas été rétabli dans les 48 heures. Une rétrogradation d’un grade a été appliquée : **${changed[1].name}**. Tu peux contacter la Direction pour contester ou signaler un problème.`);
 });}
async function tick(guild){if(guild.id!==config.guildId)return;return a.serial('tag-scan',async()=>{require('../utils/qgDurability').assertDurable();let after;for(;;){const members=await guild.members.list({limit:1000,...(after?{after}:{})});for(const m of members.values()){if(m.user.bot)continue;try{if(panel.rank(m)||records()[m.id]?.status==='pending')await inspect(m);}catch(e){console.error('QG tag',m.id,e.message);}}if(members.size<1000)break;after=members.lastKey();}});}
module.exports={inspect,tick,tagState,decision,delay};
