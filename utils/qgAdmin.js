const {randomUUID}=require('node:crypto');
const {PermissionFlagsBits:P}=require('discord.js');
const {read,update}=require('./recruitmentData');
const config=require('../config/qg');
const clean=require('./qgAiKnowledge').clean;
const state=()=>read('qgServer');
const save=fn=>update('qgServer',fn);
const direction=['creator','globalManager','administrator'];
const teams={ticketsManagement:'ticketsLead',recruitmentManagement:'recruitmentLead',animationManagement:'animationLead',networksManagement:'networksLead'};
function has(member,keys){const r=state().schoolRoles||{};return keys.some(k=>r[k]&&member.roles.cache.has(r[k]));}
function isDirection(member){return member.guild.id===config.guildId&&(member.id===member.guild.ownerId||member.id===config.ownerId||has(member,direction));}
function can(member,action,team){
 if(member.guild.id!==config.guildId)return false;
 if(isDirection(member))return true;
 if(action==='view')return has(member,[...Object.keys(teams),...Object.values(teams)]);
 if(action==='cd'||['rankup','derank'].includes(action))return has(member,['recruitmentLead']);
 if(action==='management')return !!teams[team]&&has(member,[teams[team]]);
 if(['prison','release','handcuffs','unhandcuffs','dog','undog'].includes(action))return has(member,['ticketsLead','ticketsManagement']);
 return false;
}
async function actor(i,action='view',team){
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');
 const m=await i.guild.members.fetch({user:i.user.id,force:true});if(!can(m,action,team))throw Error('Tu n’es pas autorisé à effectuer cette action.');return m;
}
function hierarchy(actor,target,bot,roles=[]){
 if(target.id===target.guild.ownerId||target.id===actor.id||target.user.bot)throw Error('Le propriétaire, soi-même et les bots ne peuvent pas être modifiés ici.');
 if(actor.id!==actor.guild.ownerId&&actor.roles.highest.comparePositionTo(target.roles.highest)<=0)throw Error('La cible doit être strictement sous ton rôle le plus élevé.');
 if(!bot.permissions.has(P.ManageRoles)||bot.roles.highest.comparePositionTo(target.roles.highest)<=0)throw Error('Le bot manque de permissions ou sa hiérarchie est insuffisante.');
 for(const role of roles)if(!role||role.managed||role.id===target.guild.id||bot.roles.highest.comparePositionTo(role)<=0||actor.id!==actor.guild.ownerId&&actor.roles.highest.comparePositionTo(role)<=0)throw Error('Un rôle concerné est absent, géré ou trop élevé.');
}
async function audit(guild,{action,actorId,targetId,before,after,reason,result='success'}){
 const e={id:randomUUID(),at:Date.now(),action,actorId,targetId,before,after,reason:clean(reason).slice(0,800),result};
 save(s=>{s.schoolAdminHistory||=[];s.schoolAdminHistory.push(e);s.schoolAdminHistory=s.schoolAdminHistory.slice(-5000);});
 try{
  const key=action.startsWith('cd')?'logsBot':/rank|management|responsibility/.test(action)?'logsMembers':'logsModeration';
  const id=state().schoolChannels?.[key];if(!id)throw Error('missing_destination');
  const ch=await guild.channels.fetch(id);if(!ch?.isTextBased()||ch.guildId!==config.guildId)throw Error('invalid_destination');
  await ch.send({embeds:[require('../systems/qgPanels').embed('Administration QG • '+action,`Auteur : <@${actorId}>\n${targetId?`Membre : <@${targetId}>\n`:''}Date : <t:${Math.floor(e.at/1000)}:f>\nRésultat : ${result}\nAvant : ${clean(JSON.stringify(before)).slice(0,900)}\nAprès : ${clean(JSON.stringify(after)).slice(0,900)}\nMotif : ${e.reason||'Non indiqué'}`)],allowedMentions:{parse:[]}});return true;
 }catch{save(s=>{const item=s.schoolAdminHistory.find(x=>x.id===e.id);if(item)item.logDelivery='failed';});return false;}
}
const locks=new Map();
async function serial(key,fn){const next=(locks.get(key)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(key,next);try{return await next;}finally{if(locks.get(key)===next)locks.delete(key);}}
module.exports={state,save,has,isDirection,can,actor,hierarchy,audit,serial,teams};
