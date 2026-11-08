// Rôle « Référente du QG » : accès aux catégories famille, à l'espace responsables et à la
// discussion globale des gestions, et panel dédié (convoquer, ajouter une note, bring, back).
const { randomUUID, createHash } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits: P } = require('discord.js');
const a = require('../utils/qgAdmin');
const config = require('../config/qg');
const { embed } = require('./qgPanels');
const { parseParis } = require('../utils/convocationTime');
const clean = require('../utils/qgAiKnowledge').clean;

const ROLE_ID = '1569036975661645896';
const PANEL_CHANNEL = '1569048376740155503';
const NOTES_CHANNEL = '1569048520915427358';
const CATEGORY_IDS = {
  family: ['1562193193452437534', '1561157144731058236', '1561384021865533542', '1561157145817382964'],
  responsibles: ['1561157136527007866'],
  intermanagement: ['1561157147297849445']
};
// Rôles dont on reprend les accès, salon par salon (jamais de droits de gestion).
const MODELS = {
  family: ['1561363081018474626', '1561157111067443361', '1561157112036597880', '1561157113437225142', '1561157114146201662', '1561157115270135932'],
  responsibles: ['1561157124187226153', '1561157125709897748', '1561157122711097485', '1561157121700139064', '1562188485010657341', '1561363083144859700'],
  intermanagement: ['1561363082062598247', '1561363083144859700', '1561157119619760281', '1561157124187226153']
};
const SAFE = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.AttachFiles, P.AddReactions, P.UseExternalEmojis, P.SendMessagesInThreads, P.UseApplicationCommands, P.Connect, P.Speak, P.UseVAD, P.Stream].reduce((x, y) => x | y, 0n);
const NOTE_CATEGORIES = ['Comportement', 'Activité', 'Investissement', 'Recrutement', 'Suivi PDT', 'Autre'];
const allowed = { parse: [] };

// Accès voulu pour un salon : réunion des accès des rôles modèles, filtrée sur des droits sûrs.
function wanted(channel, kind) {
  let allow = 0n;
  for (const id of MODELS[kind]) { const o = channel.permissionOverwrites.cache.get(id); if (o) allow |= o.allow.bitfield; }
  allow &= SAFE;
  return allow | P.ViewChannel | P.ReadMessageHistory;
}
async function ensureAccess(guild) {
  await guild.channels.fetch();
  let changed = 0;
  for (const [kind, ids] of Object.entries(CATEGORY_IDS)) for (const catId of ids) {
    const cat = guild.channels.cache.get(catId);
    if (!cat) continue;
    for (const ch of [cat, ...guild.channels.cache.filter(c => c.parentId === catId).values()]) {
      const allow = wanted(ch, kind), current = ch.permissionOverwrites.cache.get(ROLE_ID);
      if (current && current.allow.bitfield === allow && current.deny.bitfield === 0n) continue;
      await ch.permissionOverwrites.create(ROLE_ID, Object.fromEntries(Object.entries(P).filter(([, bit]) => typeof bit === 'bigint' && (allow & bit) === bit && bit !== 0n).map(([k]) => [k, true])), { reason: 'Accès du rôle Référente du QG' });
      // create() remplace entièrement l'accès du rôle sur ce salon (aucun refus résiduel).
      changed++;
    }
  }
  a.save(s => { s.schoolRoles ||= {}; s.schoolRoles.referent = ROLE_ID; });
  return changed;
}

function panel() {
  return {
    embeds: [embed('📻 Panel Référente du QG', 'Choisis un membre dans le menu ci-dessous pour ouvrir ses actions.\n\n📨 **Convoquer** — envoie une convocation en MP avec la date et le motif.\n📝 **Ajouter une note** — la note est transmise à la direction.\n📥 **Bring** — déplace le membre dans ton vocal.\n↩️ **Back** — le renvoie dans le vocal où il se trouvait avant.\n\n-# Réservé au rôle Référente du QG et à la direction.')],
    components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('qgref:pick').setPlaceholder('Choisir un membre').setMinValues(1).setMaxValues(1))],
    allowedMentions: allowed
  };
}
async function ensurePanel(guild) {
  const ch = await guild.channels.fetch(PANEL_CHANNEL).catch(() => null);
  if (!ch?.isTextBased()) return;
  const p = panel(), hash = createHash('sha256').update(JSON.stringify(p)).digest('hex'), old = a.state().schoolReferentPanel;
  let msg = old?.messageId ? await ch.messages.fetch(old.messageId).catch(e => { if (e.code === 10008) return null; throw e; }) : null;
  if (!msg) { const recent = await ch.messages.fetch({ limit: 50 }); msg = recent.find(m => m.author.id === guild.client.user.id && m.components?.some(r => r.components?.some(c => c.customId === 'qgref:pick'))) || null; }
  if (msg && old?.hash === hash) return;
  if (msg) await msg.edit(p); else msg = await ch.send(p);
  a.save(s => { s.schoolReferentPanel = { channelId: ch.id, messageId: msg.id, hash }; });
}

let ready = false;
async function tick(guild) {
  if (guild.id !== config.guildId || ready) return;
  ready = true;
  try { const n = await ensureAccess(guild); if (n) console.log(`✅ Référente du QG : accès mis à jour sur ${n} salon(s)`); await ensurePanel(guild); }
  catch (e) { ready = false; throw e; }
}

const isReferent = m => m.roles.cache.has(ROLE_ID) || a.isDirection(m);
async function actorOf(i) {
  if (i.guildId !== config.guildId) throw Error('Réservé au QG.');
  const m = await i.guild.members.fetch({ user: i.user.id, force: true });
  if (!isReferent(m)) throw Error('Réservé au rôle Référente du QG et à la direction.');
  return m;
}
function session(i, id) {
  const s = a.state().schoolReferentSessions?.[id];
  if (!s || s.actorId !== i.user.id || s.expires < Date.now()) throw Error('Session expirée : choisis à nouveau le membre dans le panel.');
  return s;
}
async function target(i, s, actor) {
  const member = await i.guild.members.fetch({ user: s.targetId, force: true }).catch(() => null);
  if (!member) throw Error('Ce membre n’est plus sur le serveur.');
  if (member.user.bot || member.id === actor.id || member.id === i.guild.ownerId || (a.isDirection(member) && !a.isDirection(actor))) throw Error('Action impossible sur ce membre.');
  return member;
}
function view(member, id) {
  const last = a.state().schoolReferentMoves?.[member.id];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('qgref:convoke:' + id).setLabel('Convoquer').setEmoji('📨').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('qgref:note:' + id).setLabel('Ajouter une note').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('qgref:bring:' + id).setLabel('Bring').setEmoji('📥').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('qgref:back:' + id).setLabel('Back').setEmoji('↩️').setStyle(ButtonStyle.Secondary).setDisabled(!last?.from));
  return { embeds: [embed('Référente • ' + member.displayName, `Membre : <@${member.id}>\nVocal actuel : ${member.voice.channelId ? `<#${member.voice.channelId}>` : 'non connecté'}${last?.from ? `\nDernier bring : depuis <#${last.from}> <t:${Math.floor(last.at / 1000)}:R>` : ''}`)], components: [row], allowedMentions: allowed };
}
function modal(id, title, fields) {
  const m = new ModalBuilder().setCustomId(id).setTitle(title);
  for (const [key, label, style, required, max] of fields) m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(key).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max)));
  return m;
}

async function move(i, actor, member, op) {
  const bot = await i.guild.members.fetchMe();
  if (!member.voice.channelId) throw Error('Ce membre n’est pas connecté à un vocal.');
  const last = a.state().schoolReferentMoves?.[member.id];
  const destination = op === 'bring' ? actor.voice.channelId : last?.from;
  if (!destination) throw Error(op === 'bring' ? 'Rejoins d’abord un vocal pour y amener le membre.' : 'Aucun vocal précédent enregistré pour ce membre.');
  if (destination === member.voice.channelId) throw Error('Le membre est déjà dans ce vocal.');
  const channel = await i.guild.channels.fetch(destination).catch(() => null);
  if (!channel?.isVoiceBased() || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.Connect, P.MoveMembers])) throw Error('Le bot ne peut pas déplacer vers ce vocal.');
  if (op === 'bring' && !channel.permissionsFor(member)?.has(P.ViewChannel)) throw Error('Le membre n’a pas accès à ton vocal.');
  const from = member.voice.channelId;
  await member.voice.setChannel(destination, `${op === 'bring' ? 'Bring' : 'Back'} par la Référente du QG (${actor.user.tag})`);
  a.save(s => { s.schoolReferentMoves ||= {}; if (op === 'bring') s.schoolReferentMoves[member.id] = { from, by: actor.id, at: Date.now() }; else delete s.schoolReferentMoves[member.id]; });
  await a.audit(i.guild, { action: 'referent.' + op, actorId: actor.id, targetId: member.id, before: { channelId: from }, after: { channelId: destination } });
  return `${op === 'bring' ? '📥' : '↩️'} <@${member.id}> déplacé dans <#${destination}>.`;
}

async function handle(i) {
  const [, op, id] = i.customId.split(':');
  const actor = await actorOf(i);
  if (op === 'pick') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const sid = randomUUID().slice(0, 12);
    a.save(s => { s.schoolReferentSessions ||= {}; for (const [k, v] of Object.entries(s.schoolReferentSessions)) if (v.expires < Date.now()) delete s.schoolReferentSessions[k]; s.schoolReferentSessions[sid] = { actorId: actor.id, targetId: i.values[0], expires: Date.now() + 30 * 60000 }; });
    const member = await target(i, { targetId: i.values[0] }, actor);
    return i.editReply(view(member, sid));
  }
  const s = session(i, id);
  if (op === 'convoke') return i.showModal(modal('qgref:convokesave:' + id, 'Convoquer le membre', [['date', 'Date : JJ/MM/AAAA HH:MM (heure de Paris)', TextInputStyle.Short, true, 16], ['reason', 'Motif (facultatif)', TextInputStyle.Paragraph, false, 500]]));
  if (op === 'note') return i.showModal(modal('qgref:notesave:' + id, 'Ajouter une note', [['category', 'Catégorie (Comportement, Activité, Autre…)', TextInputStyle.Short, false, 30], ['text', 'Note', TextInputStyle.Paragraph, true, 1500]]));
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await target(i, s, actor);
  return a.serial('member:' + member.id, async () => {
    if (op === 'bring' || op === 'back') return i.editReply({ content: await move(i, actor, member, op), allowedMentions: allowed });
    if (op === 'convokesave') {
      const at = parseParis(i.fields.getTextInputValue('date')), reason = clean(i.fields.getTextInputValue('reason')).slice(0, 500);
      if (!at || at <= Date.now()) throw Error('Indique une date future au format JJ/MM/AAAA HH:MM, heure de Paris.');
      const sent = await member.send({ embeds: [embed('Convocation • QG', `Tu es convoqué le <t:${Math.floor(at / 1000)}:F>.\nMotif : ${reason || 'Communiqué pendant l’entretien.'}\nContacte <@${actor.id}> pour confirmer ta disponibilité et connaître le lieu de rendez-vous.`)], allowedMentions: allowed }).catch(() => null);
      a.save(st => { st.schoolConvocations ||= []; st.schoolConvocations.push({ targetId: member.id, actorId: actor.id, at, reason, messageId: sent?.id || null, source: 'referent' }); st.schoolConvocations = st.schoolConvocations.slice(-1000); });
      await a.audit(i.guild, { action: 'convocation', actorId: actor.id, targetId: member.id, reason });
      return i.editReply({ content: `📨 Convocation enregistrée pour <@${member.id}> le <t:${Math.floor(at / 1000)}:F>.${sent ? '' : '\n⚠️ MP non remis : préviens le membre directement.'}`, allowedMentions: allowed });
    }
    if (op === 'notesave') {
      const raw = i.fields.getTextInputValue('category').trim(), text = clean(i.fields.getTextInputValue('text')).trim();
      if (!text) throw Error('La note est vide.');
      const category = NOTE_CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase()) || 'Autre';
      const noteId = randomUUID();
      a.save(st => { st.schoolNotes ||= {}; st.schoolNotes[noteId] = { id: noteId, targetId: member.id, category, visibility: 'direction', text, authorId: actor.id, createdAt: Date.now(), history: [], source: 'referent' }; });
      const ch = await i.guild.channels.fetch(NOTES_CHANNEL).catch(() => null);
      let delivered = false;
      if (ch?.isTextBased()) delivered = !!await ch.send({ embeds: [embed('📝 Note de la Référente', `Membre : <@${member.id}>\nPar : <@${actor.id}>\nCatégorie : **${category}**\n\n${text}`).setTimestamp()], allowedMentions: allowed }).catch(() => null);
      await a.audit(i.guild, { action: 'note.referent', actorId: actor.id, targetId: member.id, after: { noteId, category } });
      return i.editReply({ content: `📝 Note ajoutée pour <@${member.id}>.${delivered ? '' : '\n⚠️ Transmission dans le salon de suivi impossible : la note reste enregistrée.'}`, allowedMentions: allowed });
    }
    throw Error('Action inconnue.');
  });
}

module.exports = { ROLE_ID, PANEL_CHANNEL, NOTES_CHANNEL, CATEGORY_IDS, wanted, ensureAccess, ensurePanel, panel, tick, handle, view, isReferent };
