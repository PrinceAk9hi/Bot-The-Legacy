const { PermissionFlagsBits: P } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');

const groups = {
  // Le rôle Directeur / Fondateur conserve ses accès directs, sans séparateur.
  dividerDirection: ['globalManager', 'administrator'],
  dividerResponsibles: layout.leads,
  dividerManagement: layout.managers,
  dividerFamily: layout.family,
  dividerCommunity: ['community']
};
Object.assign(groups,{
 dividerAccessManagement:['managementAccess'],dividerAccessResponsible:['responsibleAccess'],
 dividerNotifications:['notifAnnouncements','notifRp','notifNetworks','notifServers'],
 dividerStatus:['interviewWaiting','recruitmentRefused','rpPrison'],
 dividerLevels:[5,10,20,35,50,75,100].map(n=>'level'+n)
});
const optional=new Set(['dividerAccessManagement','dividerAccessResponsible','dividerNotifications','dividerStatus','dividerLevels']);
const locks = new Map();
const serial = (key, fn) => {
  const next = (locks.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
};
const schoolRoles = () => read('qgServer').schoolRoles || {};
const labels={dividerDirection:'Direction',dividerResponsibles:'Responsables',dividerManagement:'Gestions',dividerFamily:'Famille',dividerCommunity:'Communauté'};
const aliases={dividerResponsibles:['separatorResponsibility'],dividerManagement:['separatorManagement']};
const names={dividerDirection:['direction'],dividerResponsibles:['responsables','responsabilite','responsabilites'],dividerManagement:['gestion','gestions'],dividerFamily:['famille'],dividerCommunity:['communaute','communautaire']};
Object.assign(labels,{dividerAccessManagement:'Accès Gestion',dividerAccessResponsible:'Accès Responsable',dividerNotifications:'Notifications',dividerStatus:'Status',dividerLevels:'Niveau'});
Object.assign(names,{dividerAccessManagement:['accesgestion'],dividerAccessResponsible:['accesresponsable'],dividerNotifications:['notifications'],dividerStatus:['status','statut','statuts'],dividerLevels:['niveau','niveaux']});
function normalize(name){
 return String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/^[a-z]\s*\/\s*/,'').replace(/[^a-z]/g,'').replace(/^i(?=niveau|status|statut|notification|acces|gestion|responsable|famille|direction|communaute)/,'');
}
async function resolveExisting(guild,{fetch=true}={}){
 if(guild.id!==config.guildId)throw Error('Serveur incorrect.');
 if(fetch)await guild.roles.fetch();
 const roles={...schoolRoles()},used=new Set(),reserved=new Set(['creator',...Object.values(groups).flat()].map(k=>roles[k]).filter(Boolean));
 const changes={},missing=[];
 for(const key of Object.keys(groups)){
  let role=guild.roles.cache.get(roles[key]);
  if(!role){
   const candidates=new Map();
   for(const alias of aliases[key]||[]){
    const r=guild.roles.cache.get(roles[alias]);if(r)candidates.set(r.id,r);
   }
   for(const r of guild.roles.cache.values())if(names[key].includes(normalize(r.name)))candidates.set(r.id,r);
   const valid=[...candidates.values()].filter(r=>!r.managed&&r.id!==guild.id&&!reserved.has(r.id)&&!used.has(r.id));
   if(valid.length>1)throw Error(`Plusieurs séparateurs ${labels[key]} existent : ${valid.map(r=>`${r.name} (${r.id})`).join(', ')}. Choisis le bon avec /sync associer-separateur.`);
   role=valid[0];
  }
  if(!role){if(!optional.has(key))missing.push(labels[key]);continue;}
  if(role.managed||role.id===guild.id||reserved.has(role.id)||used.has(role.id))throw Error(`Association invalide pour ${labels[key]}. Utilise /sync associer-separateur avec son rôle séparateur existant.`);
  used.add(role.id);
  if(roles[key]!==role.id){roles[key]=role.id;changes[key]=role.id;}
 }
 if(Object.keys(changes).length)update('qgServer',s=>{s.schoolRoles||={};Object.assign(s.schoolRoles,changes);});
 return {roles,missing};
}

function desiredSeparatorIds(member, roles = schoolRoles()) {
  const held = member.roles.cache;
  return Object.entries(groups).filter(([, sourceKeys]) => sourceKeys.some(key => roles[key] && roles[key]!=='1561157108307861574' && held.has(roles[key])))
    .map(([separatorKey]) => roles[separatorKey]).filter(Boolean);
}

async function syncMember(member) {
  if (!member || member.user?.bot || member.guild.id !== config.guildId) return { added: 0, removed: 0 };
  return serial(member.id, async () => {
    let roles = schoolRoles();
    if(Object.keys(groups).some(k=>!roles[k]||!member.guild.roles.cache.has(roles[k])))roles=(await resolveExisting(member.guild,{fetch:false})).roles;
    const wanted = new Set(desiredSeparatorIds(member, roles).filter(id=>member.guild.roles.cache.has(id)));
    const separatorIds = Object.keys(groups).map(key => roles[key]).filter(Boolean);
    const current = new Set(separatorIds.filter(id => member.roles.cache.has(id)));
    const add = [...wanted].filter(id => !current.has(id));
    const remove = [...current].filter(id => !wanted.has(id));
    if (!add.length && !remove.length) return { added: 0, removed: 0 };
    if (!member.guild.members.me?.permissions.has(P.ManageRoles)) throw new Error('Le bot doit avoir Gérer les rôles pour synchroniser les séparateurs.');
    if (add.length) await member.roles.add(add, 'Synchronisation des rôles séparateurs SchoolRP');
    if (remove.length) await member.roles.remove(remove, 'Recalcul des rôles séparateurs SchoolRP');
    return { added: add.length, removed: remove.length };
  });
}

async function syncGuild(guild) {
  if (guild.id !== config.guildId) throw new Error('Synchronisation réservée au serveur QG configuré.');
  const {roles,missing}=await resolveExisting(guild);
  if (missing.length) throw new Error(`Séparateurs existants à associer : ${missing.join(', ')}. Utilise /sync associer-separateur pour sélectionner tes rôles actuels. Aucun rôle ne sera créé.`);
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(P.ManageRoles)) throw new Error('Le bot doit avoir Gérer les rôles.');
  for (const key of Object.keys(groups)) {
    if(optional.has(key)&&(!roles[key]||!guild.roles.cache.has(roles[key])))continue;
    const role = await guild.roles.fetch(roles[key]);
    if (!role || !role.editable) throw new Error(`Le rôle ${key} n’est pas modifiable. Place le rôle du bot au-dessus des séparateurs.`);
    if (role.permissions.bitfield !== 0n) throw new Error(`Le séparateur ${role.name} possède des permissions : corrige-les avant de le synchroniser.`);
  }
  const members = await guild.members.fetch();
  let added = 0, removed = 0, processed = 0;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const result = await syncMember(member);
    added += result.added; removed += result.removed; processed++;
  }
  return { members: processed, added, removed };
}

module.exports = { groups, labels, resolveExisting, desiredSeparatorIds, syncMember, syncGuild };
