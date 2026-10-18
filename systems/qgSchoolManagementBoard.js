const { EmbedBuilder } = require('discord.js');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');
const { read, update } = require('../utils/recruitmentData');

const store = fn => update('qgServer', fn);
const groups = [
  { key: 'tickets', label: '🎫 Gestion Support', lead: 'ticketsLead', team: 'ticketsManagement' },
  { key: 'recruitment', label: '📋 Gestion Recrutement', lead: 'recruitmentLead', team: 'recruitmentManagement' },
  { key: 'animation', label: '🎉 Gestion Animation', lead: 'animationLead', team: 'animationManagement' },
  { key: 'networks', label: '🌐 Gestion Réseaux', lead: 'networksLead', team: 'networksManagement' },
];

function state() { return read('qgServer'); }
function tenureKey(roleKey, userId) { return `${roleKey}:${userId}`; }
function displayDate(record) {
  const date = `<t:${Math.floor(record.since / 1000)}:D>`;
  return record.source === 'event' ? `depuis ${date}` : `suivi depuis ${date}*`;
}

async function buildPanel(guild) {
  if (guild.id !== config.guildId) throw new Error('Le tableau des gestions est réservé au QG.');
  await guild.members.fetch();
  const roles = state().schoolRoles || {};
  const now = Date.now();
  store(s => {
    s.schoolManagementTenure ||= {};
    for (const group of groups) {
      for (const roleKey of [group.lead, group.team]) {
        const roleId = roles[roleKey];
        const role = roleId && guild.roles.cache.get(roleId);
        if (!role) continue;
        for (const member of role.members.values()) {
          const key = tenureKey(roleKey, member.id);
          if (!s.schoolManagementTenure[key]) s.schoolManagementTenure[key] = { since: now, source: 'baseline' };
        }
      }
    }
    s.schoolManagementTrackingStartedAt ||= now;
  });

  const tenure = state().schoolManagementTenure || {};
  const rows = groups.map(group => {
    const leadRole = roles[group.lead] && guild.roles.cache.get(roles[group.lead]);
    const teamRole = roles[group.team] && guild.roles.cache.get(roles[group.team]);
    const leadMembers = leadRole ? [...leadRole.members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')) : [];
    const teamMembers = teamRole ? [...teamRole.members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')) : [];
    const count = leadMembers.length + teamMembers.length;
    const leadLines = leadMembers.length
      ? leadMembers.map(member => `Responsable : <@${member.id}> — ${displayDate(tenure[tenureKey(group.lead, member.id)] || { since: now, source: 'baseline' })}`).join('\n')
      : 'Responsable : *poste vacant*';
    const teamLines = teamMembers.length
      ? teamMembers.slice(0, 16).map(member => `• <@${member.id}> — ${displayDate(tenure[tenureKey(group.team, member.id)] || { since: now, source: 'baseline' })}`).join('\n')
      : '• Aucun membre';
    const extra = teamMembers.length > 16 ? `\n… et ${teamMembers.length - 16} autre(s)` : '';
    return { name: `${group.label} · ${count} titulaire(s)`, value: `${leadLines}\n${teamLines}${extra}`.slice(0, 1024), count };
  }).sort((a, b) => b.count - a.count);

  const embed = new EmbedBuilder().setFooter({text:'Fondateur - QG'})
    .setColor(0xffffff)
    .setTitle('📊 Classement et suivi des gestions')
    .setDescription('Effectifs actuels par gestion, responsables et date de prise de fonction connue.\n\n* Pour les personnes déjà présentes avant le suivi, la date indique le début du suivi : Discord ne fournit pas la date historique exacte.')
    .addFields(rows.map(({ name, value }, index) => ({ name: `${['🥇', '🥈', '🥉', '✦'][index]} ${name}`, value })))

    .setTimestamp();
  return { embeds: [embed], allowedMentions: { parse: [] } };
}

async function refresh(guild) {
  const snapshot = state();
  const channelId = snapshot.schoolChannels?.managementFollowup;
  if (!channelId) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;
  const payload = await buildPanel(guild);
  const record = state().schoolPanels?.managementFollowup;
  let message = record?.channelId === channel.id ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 });
    message = recent.find(item => item.author.id === guild.client.user.id && item.embeds.some(embed => embed.title === '📊 Classement et suivi des gestions'));
  }
  message = message ? await message.edit(payload) : await channel.send(payload);
  store(s => { s.schoolPanels ||= {}; s.schoolPanels.managementFollowup = { channelId: channel.id, messageId: message.id }; });
  return true;
}

function trackRoleChanges(oldMember, newMember) {
  const roles = state().schoolRoles || {};
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  const changes = [];
  const now = Date.now();
  for (const group of groups) {
    for (const roleKey of [group.lead, group.team]) {
      const roleId = roles[roleKey];
      if (!roleId) continue;
      const key = tenureKey(roleKey, newMember.id);
      const had = oldRoles.has(roleId);
      const has = newRoles.has(roleId);
      if (had !== has) changes.push({ key, has });
    }
  }
  if (!changes.length) return false;
  store(s => {
    s.schoolManagementTenure ||= {};
    for (const change of changes) {
      if (change.has) s.schoolManagementTenure[change.key] = { since: now, source: 'event' };
      else delete s.schoolManagementTenure[change.key];
    }
  });
  return true;
}

module.exports = { groups, buildPanel, refresh, trackRoleChanges };
