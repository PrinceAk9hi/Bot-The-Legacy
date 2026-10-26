const a=require('../utils/qgAdmin'),{guildId}=require('../config/qg');
const legacy={'18':'1562838566487326781','13':'1562838771538468956'};
function bracket(id){const s=a.state(),v=s.schoolEntryVerification?.[id]?.ageBracket||s.schoolAgeProfiles?.[id]?.ageBracket;return ['13','18'].includes(v)?v:null;}
async function migrate(guild){
 if(guild.id!==guildId)throw Error('Serveur QG requis.');require('../utils/qgDurability').assertDurable();
 return a.serial('age-role-migration',async()=>{
  const existing=[];for(const [age,id]of Object.entries(legacy)){const role=await guild.roles.fetch(id);if(role){if(!role.editable||role.managed)throw Error('Le bot doit pouvoir supprimer les anciens rôles de tranche d’âge.');existing.push([age,role]);}}
  if(!existing.length)return {detail:'Tranche Roblox conservée dans /user ; aucun rôle d’âge restant.'};
  const profiles=[];let after;for(;;){const members=await guild.members.list({limit:1000,...(after?{after}:{})});for(const m of members.values()){const held=existing.filter(([,role])=>m.roles.cache.has(role.id));if(held.length===1&&!bracket(m.id))profiles.push({id:m.id,ageBracket:held[0][0]});}if(members.size<1000)break;after=members.lastKey();}
  a.save(s=>{s.schoolAgeProfiles||={};for(const p of profiles)s.schoolAgeProfiles[p.id]={ageBracket:p.ageBracket,source:'ancien rôle de vérification',savedAt:Date.now()};});
  for(const [,role]of existing)await role.delete('Tranche Roblox conservée dans /user, suppression des rôles demandée');
  await a.audit(guild,{action:'age-roles.retired',actorId:guild.client.user.id,after:{profiles:profiles.length,roles:existing.map(([,r])=>r.id)},reason:'Tranche Roblox dans la fiche membre uniquement.'});
  return {detail:existing.length+' rôles supprimés ; '+profiles.length+' profils anciens conservés.'};
 });
}
module.exports={bracket,migrate};
