// =derank @membre [motif] : retire un membre de la famille QG.
// Retire ses grades familiaux et ses rôles d'exécutant, puis l'expulse de la communauté Roblox.
// Différent de /derank, qui ne fait que descendre d'un grade.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { randomUUID } = require('node:crypto');
const a = require('../utils/qgAdmin');
const config = require('../config/qg');

const ROLE_KEYS = ['test', 'confirmed', 'expert', 'prestigious', 'senior', 'ticketsManagement', 'recruitmentManagement', 'animationManagement', 'networksManagement', 'rpManagement', 'casinoOperator', 'interviewWaiting'];
const pending = new Map();
const embed = (title, text) => new EmbedBuilder().setColor(0xffffff).setTitle(title).setDescription(text).setFooter(require('../utils/qgBrand').footer());
const allowedMentions = { parse: [], repliedUser: false };

function rolesToRemove(member) {
  const r = a.state().schoolRoles || {};
  return [...new Set(ROLE_KEYS.map(k => r[k]).filter(id => id && member.roles.cache.has(id)))];
}

async function message(m) {
  const match = /^=derank(?:\s+([\s\S]*))?$/i.exec(m.content.trim());
  if (!match) return false;
  if (m.guildId !== config.guildId) return false;
  const actor = await m.guild.members.fetch({ user: m.author.id, force: true });
  if (!a.can(actor, 'derank')) { await m.reply({ content: '❌ Tu n’es pas autorisé à utiliser =derank.', allowedMentions }); return true; }
  const args = (match[1] || '').trim();
  const idMatch = /^(?:<@!?(\d+)>|(\d{15,20}))\s*([\s\S]*)$/.exec(args);
  if (!idMatch) { await m.reply({ content: 'Utilisation : `=derank @membre motif`\nRetire le membre de la famille (grades et rôles d’exécutant) et l’expulse de la communauté Roblox.', allowedMentions }); return true; }
  const reason = idMatch[3].trim().slice(0, 800);
  if (!reason) { await m.reply({ content: '❌ Le motif est obligatoire : `=derank @membre motif`', allowedMentions }); return true; }
  const target = await m.guild.members.fetch({ user: idMatch[1] || idMatch[2], force: true }).catch(() => null);
  if (!target) { await m.reply({ content: '❌ Membre introuvable sur le serveur.', allowedMentions }); return true; }
  const remove = rolesToRemove(target);
  try { a.hierarchy(actor, target, await m.guild.members.fetchMe(), remove.map(id => m.guild.roles.cache.get(id))); }
  catch (e) { await m.reply({ content: '❌ ' + e.message, allowedMentions }); return true; }
  const roblox = require('../utils/qgRoblox').robloxIdFor(target.id);
  const id = randomUUID().slice(0, 12);
  pending.set(id, { actorId: actor.id, targetId: target.id, reason, expires: Date.now() + 120000 });
  await m.reply({
    embeds: [embed('Derank • retrait de la famille', `Membre : <@${target.id}>\nRôles retirés : ${remove.length ? remove.map(r => `<@&${r}>`).join(', ') : 'aucun rôle familial'}\nCommunauté Roblox : ${roblox ? 'expulsion du groupe' : 'aucun compte Roblox enregistré'}\n\n**Motif** : ${reason}\n\nConfirmer ? (2 minutes)`)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('qgx:confirm:' + id).setLabel('Confirmer le derank').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('qgx:cancel:' + id).setLabel('Annuler').setStyle(ButtonStyle.Secondary))],
    allowedMentions
  });
  return true;
}

async function handle(i) {
  const [, op, id] = i.customId.split(':'), p = pending.get(id);
  if (!p || p.expires < Date.now()) return i.reply({ content: 'Cette demande a expiré. Relance =derank.', flags: MessageFlags.Ephemeral });
  if (p.actorId !== i.user.id) return i.reply({ content: 'Seul l’auteur de la commande peut confirmer.', flags: MessageFlags.Ephemeral });
  pending.delete(id); // un double clic ne relance pas l'action
  await i.deferUpdate();
  if (op === 'cancel') return i.editReply({ embeds: [embed('Derank annulé', 'Aucun changement.')], components: [] });
  return a.serial('member:' + p.targetId, async () => {
    const actor = await i.guild.members.fetch({ user: p.actorId, force: true });
    if (!a.can(actor, 'derank')) throw Error('Tu n’es plus autorisé à effectuer cette action.');
    const target = await i.guild.members.fetch({ user: p.targetId, force: true });
    const r = await expel(i.guild, actor, target, p.reason);
    return i.editReply({ embeds: [embed('Derank effectué', `<@${target.id}> a été retiré de la famille.\nRôles retirés : ${r.removed}\nCommunauté Roblox : ${r.robloxText}${r.warning}`)], components: [] });
  });
}

// Retrait de la famille : rôles familiaux, séparateurs, communauté Roblox, journal et MP.
// Aussi utilisé par la fin de période de test (bouton « Retirer »).
async function expel(guild, actor, target, reason) {
  const remove = rolesToRemove(target);
  a.hierarchy(actor, target, await guild.members.fetchMe(), remove.map(r => guild.roles.cache.get(r)));
  if (remove.length) await target.roles.remove(remove, `Retrait par ${actor.user.tag} : ${reason}`.slice(0, 400));
  let warning = '';
  try { await require('./qgSchoolSeparators').syncMember(await guild.members.fetch({ user: target.id, force: true })); } catch { warning += '\nSéparateurs à vérifier.'; }
  const roblox = await require('../utils/qgRoblox').exile(target.id);
  const robloxText = { exiled: 'expulsé du groupe', request_declined: 'demande d’adhésion refusée', not_member: 'n’était pas dans le groupe', no_roblox: 'aucun compte Roblox enregistré', protected: 'rang protégé (Manager ou plus) : non modifié' }[roblox.status] || `échec (${roblox.error || 'erreur inconnue'})`;
  await a.audit(guild, { action: 'derank.family', actorId: actor.id, targetId: target.id, before: { roles: remove }, after: { roblox: roblox.status }, reason, result: roblox.status === 'failed' ? 'Roblox : ' + (roblox.error || 'échec') : 'success' });
  await target.send({ embeds: [embed('Retrait de la famille • QG', `Tu ne fais plus partie de la famille QG.\n\n**Motif** : ${reason}`)], allowedMentions: { parse: [] } }).catch(() => { warning += '\nMP non remis.'; });
  return { removed: remove.length, robloxText, warning };
}

module.exports = { message, handle, expel };
