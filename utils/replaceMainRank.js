const {MAIN_RANKS}=require('../config/ranks');
const {PermissionFlagsBits}=require('discord.js');
const running=new Set();
async function replaceMainRank(member,key,moderator){
 const rank=MAIN_RANKS[key];if(!rank)throw Error('Grade inconnu.');
 const lock=member.guild.id+':'+member.id;
 if(running.has(lock))throw Error('Un changement de grade est déjà en cours pour ce membre.');
 running.add(lock);
 try{
  const fresh=await member.guild.members.fetch({user:member.id,force:true});
  const me=member.guild.members.me||await member.guild.members.fetchMe();
  if(!me.permissions.has(PermissionFlagsBits.ManageRoles))throw Error('Le bot doit avoir la permission Gérer les rôles.');
  const ranks=Object.values(MAIN_RANKS),ids=new Set(ranks.map(r=>r.roleId));
  const oldRank=[...ranks].reverse().find(r=>fresh.roles.cache.has(r.roleId))?.name||null;
  const target=await member.guild.roles.fetch(rank.roleId);
  const removed=[...fresh.roles.cache.values()].filter(r=>ids.has(r.id)&&r.id!==rank.roleId);
  for(const role of [target,...removed])if(!role||role.managed||role.position>=me.roles.highest.position)throw Error(`Impossible de modifier le rôle ${role?.name||rank.name} : vérifie la hiérarchie du bot.`);
  const keep=[...fresh.roles.cache.keys()].filter(id=>id!==member.guild.id&&!ids.has(id));
  await fresh.roles.set([...keep,rank.roleId],`Changement de grade par ${moderator.id}`);
  const checked=await member.guild.members.fetch({user:member.id,force:true});
  if(!checked.roles.cache.has(rank.roleId)||[...ids].some(id=>id!==rank.roleId&&checked.roles.cache.has(id)))throw Error('Le grade final ne correspond pas à la demande. Vérifie si un autre bot réattribue les anciens grades.');
  return {oldRank,member:checked};
 }finally{running.delete(lock);}
}
module.exports={replaceMainRank};
