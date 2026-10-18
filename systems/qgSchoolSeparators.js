const { PermissionFlagsBits: P } = require('discord.js');
const { read } = require('../utils/recruitmentData');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');

const groups = {
  dividerFoundation: ['creator'],
  dividerDirection: ['globalManager', 'administrator'],
  dividerResponsibles: layout.leads,
  dividerManagement: layout.managers,
  dividerFamily: layout.family,
  dividerCommunity: ['community']
};
const locks = new Map();
const serial = (key, fn) => {
  const next = (locks.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
};
const schoolRoles = () => read('qgServer').schoolRoles || {};

function desiredSeparatorIds(member, roles = schoolRoles()) {
  const held = member.roles.cache;
  return Object.entries(groups).filter(([, sourceKeys]) => sourceKeys.some(key => roles[key] && held.has(roles[key])))
    .map(([separatorKey]) => roles[separatorKey]).filter(Boolean);
}

async function syncMember(member) {
  if (!member || member.user?.bot || member.guild.id !== config.guildId) return { added: 0, removed: 0 };
  return serial(member.id, async () => {
    const roles = schoolRoles();
    const wanted = new Set(desiredSeparatorIds(member, roles));
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
  const roles = schoolRoles();
  const missing = Object.keys(groups).filter(key => !roles[key] || !guild.roles.cache.has(roles[key]));
  if (missing.length) throw new Error(`Rôles séparateurs manquants : ${missing.join(', ')}. Lance d’abord /setup-serveur mise-a-jour.`);
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(P.ManageRoles)) throw new Error('Le bot doit avoir Gérer les rôles.');
  for (const key of Object.keys(groups)) {
    const role = await guild.roles.fetch(roles[key]);
    if (!role || !role.editable) throw new Error(`Le rôle ${key} n’est pas modifiable. Place le rôle du bot au-dessus des séparateurs.`);
    if (role.permissions.bitfield !== 0n) await role.setPermissions([], 'Les séparateurs ne doivent posséder aucune permission.');
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

module.exports = { groups, desiredSeparatorIds, syncMember, syncGuild };
