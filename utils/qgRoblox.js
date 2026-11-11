// Communauté Roblox du QG (groupe 1031372038).
// Le grade Roblox suit les rôles Discord :
//  - Membre Test : la demande d'adhésion reste en attente ;
//  - Membre Confirmé et grades supérieurs : demande acceptée, rang « Membre confirmé » ;
//  - un rôle Exécutant : rang « Membre gestion ».
// Les rangs Manager, Fondateur et Admin ne sont jamais modifiés par le bot.
const noblox = require('noblox.js');
const config = require('../config/qg');
const a = require('./qgAdmin');

const GROUP_ID = Number(config.robloxGroupId);
const RANK_NAMES = { confirmed: 'Membre confirmé', management: 'Membre gestion' };
const PROTECTED_FROM = 9; // Manager et au-dessus
const FAMILY_ABOVE_TEST = ['confirmed', 'expert', 'prestigious', 'senior'];
// Rôles Exécutant (anciennement « Gestion »).
const EXECUTIVE_KEYS = ['ticketsManagement', 'recruitmentManagement', 'animationManagement', 'networksManagement', 'rpManagement', 'casinoOperator'];

let login = null, rolesCache = null;
async function ensureLogin() {
  if (!process.env.ROBLOX_COOKIE) throw Error('ROBLOX_COOKIE_MISSING');
  login ||= noblox.setCookie(process.env.ROBLOX_COOKIE).catch(e => { login = null; throw e; });
  return login;
}
async function rankNumber(name) {
  rolesCache ||= noblox.getRoles(GROUP_ID).catch(e => { rolesCache = null; throw e; });
  const role = (await rolesCache).find(r => r.name.toLowerCase() === name.toLowerCase());
  if (!role) throw Error(`Rang Roblox « ${name} » introuvable dans le groupe.`);
  return role.rank;
}

function robloxIdFor(memberId) {
  const id = a.state().schoolEntryVerification?.[memberId]?.robloxId;
  return /^\d+$/.test(String(id || '')) ? Number(id) : null;
}
function target(member) {
  const r = a.state().schoolRoles || {};
  const has = keys => keys.some(k => r[k] && member.roles.cache.has(r[k]));
  if (!has(['test', ...FAMILY_ABOVE_TEST])) return null;
  if (has(EXECUTIVE_KEYS)) return 'management';
  if (has(FAMILY_ABOVE_TEST)) return 'confirmed';
  return null; // Membre Test : on attend la confirmation
}
function record(memberId, data) {
  a.save(s => { s.schoolRobloxSync ||= {}; s.schoolRobloxSync[memberId] = { ...data, at: Date.now() }; });
}

// Aligne le membre sur son rang Roblox attendu. Ne retire jamais personne du groupe.
async function sync(member) {
  if (member.guild.id !== config.guildId || member.user.bot) return { status: 'ignored' };
  const goal = target(member);
  if (!goal) return { status: 'ignored' };
  const robloxId = robloxIdFor(member.id);
  if (!robloxId) { record(member.id, { status: 'no_roblox', goal }); return { status: 'no_roblox' }; }
  return a.serial('qg-roblox:' + member.id, async () => {
    try {
      await ensureLogin();
      const wanted = await rankNumber(RANK_NAMES[goal]);
      let current = Number(await noblox.getRankInGroup(GROUP_ID, robloxId));
      if (current >= PROTECTED_FROM) { record(member.id, { status: 'protected', goal, robloxId, rank: current }); return { status: 'protected' }; }
      if (current === 0) {
        const request = await noblox.getJoinRequest(GROUP_ID, robloxId).catch(() => null);
        if (!request) { record(member.id, { status: 'waiting_request', goal, robloxId }); return { status: 'waiting_request' }; }
        await noblox.handleJoinRequest(GROUP_ID, robloxId, true);
        current = Number(await noblox.getRankInGroup(GROUP_ID, robloxId));
      }
      if (current !== wanted) await noblox.setRank(GROUP_ID, robloxId, wanted);
      record(member.id, { status: 'synced', goal, robloxId, rank: wanted });
      console.log(`✅ Roblox QG : ${member.user.username} → ${RANK_NAMES[goal]}`);
      return { status: 'synced', rank: RANK_NAMES[goal] };
    } catch (e) {
      const error = String(e?.message || e).slice(0, 200);
      record(member.id, { status: 'failed', goal, robloxId, error });
      console.error('❌ Roblox QG :', error);
      return { status: 'failed', error };
    }
  });
}

// Retire le membre de la communauté Roblox (et refuse une demande en attente).
async function exile(memberId) {
  const robloxId = robloxIdFor(memberId);
  if (!robloxId) return { status: 'no_roblox' };
  return a.serial('qg-roblox:' + memberId, async () => {
    try {
      await ensureLogin();
      const current = Number(await noblox.getRankInGroup(GROUP_ID, robloxId));
      if (current >= PROTECTED_FROM) return { status: 'protected' };
      if (current > 0) { await noblox.exile(GROUP_ID, robloxId); record(memberId, { status: 'exiled', robloxId }); return { status: 'exiled' }; }
      const request = await noblox.getJoinRequest(GROUP_ID, robloxId).catch(() => null);
      if (request) { await noblox.handleJoinRequest(GROUP_ID, robloxId, false); record(memberId, { status: 'request_declined', robloxId }); return { status: 'request_declined' }; }
      record(memberId, { status: 'not_member', robloxId });
      return { status: 'not_member' };
    } catch (e) {
      return { status: 'failed', error: String(e?.message || e).slice(0, 200) };
    }
  });
}

// Changement de rôles Discord : resynchronise si le rang attendu a changé.
function memberChanged(oldMember, newMember) {
  if (target(oldMember) === target(newMember) || !target(newMember)) return;
  sync(newMember).catch(() => {});
}

// Rattrapage toutes les 10 minutes : membres pas encore alignés (demande Roblox arrivée
// après le grade, échec temporaire, ou membres déjà en place avant cette fonction).
let lastTick = 0;
async function tick(guild) {
  if (guild.id !== config.guildId || !process.env.ROBLOX_COOKIE || Date.now() - lastTick < 10 * 60000) return;
  lastTick = Date.now();
  const done = a.state().schoolRobloxSync || {};
  const members = await require('./qgMembers')(guild);
  const todo = [...members.values()].filter(m => {
    const goal = !m.user.bot && target(m);
    return goal && robloxIdFor(m.id) && !(done[m.id]?.status === 'synced' && done[m.id].goal === goal) && done[m.id]?.status !== 'protected';
  }).slice(0, 15);
  for (const member of todo) await sync(member);
  await remind(guild, members).catch(e => console.error('❌ Rappel communauté Roblox :', e?.message || e));
}

// Le compte est-il dans le groupe ('member'), en attente ('requested') ou absent ('none') ?
// Une erreur Roblox remonte : on ne relance personne sur un doute.
async function communityStatus(robloxId, api = noblox) {
  if (api === noblox) await ensureLogin();
  if (Number(await api.getRankInGroup(GROUP_ID, robloxId)) > 0) return 'member';
  try {
    return (await api.getJoinRequest(GROUP_ID, robloxId)) ? 'requested' : 'none';
  } catch (e) {
    if (/404|not found/i.test(String(e?.message || e))) return 'none';
    throw e;
  }
}

// Rattrapage : membres de la famille (Membre Test et plus) qui n'ont pas encore demandé à
// rejoindre la communauté Roblox. Rappel une seule fois, en MP + dans le salon des rappels.
// Au plus 10 vérifications et 5 rappels par passage (toutes les 10 minutes) pour ne pas inonder le salon.
const RECHECK_MS = 24 * 3600000;
function family(member) {
  const r = a.state().schoolRoles || {};
  return ['test', ...FAMILY_ABOVE_TEST].some(k => r[k] && member.roles.cache.has(r[k]));
}
async function remind(guild, members, { api = noblox, send, now = Date.now() } = {}) {
  send ||= (g, id) => require('../systems/qgInterviews').welcomeReminder(g, id, 'catchup');
  const seen = a.state().schoolCommunityReminder || {};
  const due = m => {
    const s = seen[m.id];
    return !s || (!['reminded', 'member'].includes(s.status) && now - (s.at || 0) >= RECHECK_MS);
  };
  const todo = [...members.values()]
    .filter(m => !m.user.bot && family(m) && robloxIdFor(m.id) && due(m))
    .sort((x, y) => (seen[x.id]?.at || 0) - (seen[y.id]?.at || 0))
    .slice(0, 10);
  let sent = 0;
  for (const m of todo) {
    if (sent >= 5) break;
    const status = await communityStatus(robloxIdFor(m.id), api).catch(e => { console.error('❌ Statut communauté Roblox :', String(e?.message || e).slice(0, 200)); return null; });
    if (!status) continue;
    if (status === 'none') {
      const r = await send(guild, m.id);
      if (r.channel || r.dm) { sent++; continue; }
    }
    a.save(s => { s.schoolCommunityReminder ||= {}; s.schoolCommunityReminder[m.id] = { status: status === 'none' ? 'failed' : status, at: now }; });
  }
  return sent;
}

module.exports = { sync, exile, memberChanged, tick, target, robloxIdFor, communityStatus, remind, GROUP_ID, RANK_NAMES };
