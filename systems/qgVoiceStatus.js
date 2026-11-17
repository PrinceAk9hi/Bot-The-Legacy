// Permissions du QG réglées à la main.
// 1. Les permissions des catégories et salons modifiées à la main sont conservées : la maintenance automatique
//    par séparateurs est désactivée une fois (elle fusionnait les autorisations des grades), le casino et le rôle
//    Référent ne réécrivent plus les salons existants.
// 2. « Définir le statut du salon vocal » : personne ne l'a, sauf
//    - la Direction (Créateur, Gérant Global, Référent du QG) et les Responsables, partout ;
//    - tout le monde dans les bureaux (salons vocaux dont le nom contient « bureau »).
//    Appliqué au démarrage et à chaque nouveau salon vocal ; seules les autorisations de cette permission changent.
const {PermissionFlagsBits:P,ChannelType:T}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const BIT=P.SetVoiceChannelStatus,NAME='SetVoiceChannelStatus';
const DIRECTION=['creator','globalManager','referent'];
const allowedKeys=()=>[...DIRECTION,...Object.values(a.teams),'casinoLead'];
const allowedRoles=()=>{const r=a.state().schoolRoles||{};return new Set(allowedKeys().map(k=>r[k]).filter(Boolean));};
const bureau=ch=>/bureau/i.test(ch.name||'');
const isVoice=ch=>ch&&[T.GuildVoice,T.GuildStageVoice].includes(ch.type);

// Une seule fois : les réglages manuels deviennent la référence.
function preserve(){
 if(a.state().schoolManualPermissions)return false;
 a.save(s=>{s.schoolManualPermissions={since:Date.now()};if(s.schoolSeparatorPermissions)s.schoolSeparatorPermissions.enabled=false;});
 return true;
}

// Ce qu'il faut changer sur un salon vocal pour la permission de statut : [id, true|false|null].
function channelPlan(ch,allowed=allowedRoles()){
 const changes=[],guildId=ch.guild.id;
 const everyone=ch.permissionOverwrites.cache.get(guildId);
 if(bureau(ch)){
  // Bureaux : autorisé pour toute personne qui voit le salon ; aucun rôle ne le refuse.
  if(!everyone?.allow.has(BIT))changes.push([guildId,true]);
  for(const o of ch.permissionOverwrites.cache.values())if(o.type===0&&o.id!==guildId&&o.deny.has(BIT))changes.push([o.id,null]);
  return changes;
 }
 // Ailleurs : seules la Direction et les Responsables peuvent garder une autorisation.
 for(const o of ch.permissionOverwrites.cache.values()){
  if(o.id===ch.client?.user?.id)continue;
  if(o.allow.has(BIT)&&!(o.type===0&&allowed.has(o.id)))changes.push([o.id,null]);
  if(o.deny.has(BIT)&&o.type===0&&allowed.has(o.id))changes.push([o.id,null]);
 }
 return changes;
}
async function applyChannel(ch,allowed=allowedRoles()){
 let n=0;
 for(const [id,value] of channelPlan(ch,allowed)){await ch.permissionOverwrites.edit(id,{[NAME]:value},{reason:'Statut du salon vocal : Direction, Responsables et bureaux seulement'});n++;}
 return n;
}
// Rôles : retirée à tous les rôles, sauf Direction et Responsables (ajoutée s'il le faut).
async function applyRoles(guild,allowed=allowedRoles()){
 const me=await guild.members.fetchMe();let n=0,blocked=0;
 for(const role of guild.roles.cache.values()){
  if(role.managed)continue;
  const want=allowed.has(role.id),has=role.permissions.has(BIT);
  if(want===has)continue;
  if(me.roles.highest.comparePositionTo(role)<=0){blocked++;continue;}
  await role.setPermissions(want?role.permissions.add(BIT):role.permissions.remove(BIT),'Statut du salon vocal : Direction et Responsables seulement').then(()=>n++,()=>blocked++);
 }
 return{n,blocked};
}
async function apply(guild){
 if(guild.id!==config.guildId)return{detail:'Autre serveur'};
 const kept=preserve();
 const allowed=allowedRoles(),roles=await applyRoles(guild,allowed);
 let channels=0;
 for(const ch of (await guild.channels.fetch()).values())if(isVoice(ch))channels+=await applyChannel(ch,allowed).catch(()=>0);
 const notices=roles.blocked?[`${roles.blocked} rôle(s) au-dessus du bot non modifiés : place le rôle du bot plus haut`]:[];
 return{detail:`Statut vocal : ${roles.n} rôle(s), ${channels} autorisation(s) de salon ajustés${kept?' · réglages manuels des permissions conservés':''}`,notices};
}
async function created(ch){if(ch.guild?.id===config.guildId&&isVoice(ch))await applyChannel(ch);}
module.exports={apply,created,preserve,_test:{channelPlan,bureau,allowedRoles}};
