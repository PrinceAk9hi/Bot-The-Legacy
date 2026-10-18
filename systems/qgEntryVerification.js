const { randomUUID } = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown } = require('discord.js');
const data = require('../utils/recruitmentData');
const soul = require('./entryVerification');
const config = require('../config/qg');
const VERSION = 1;
const row = (...buttons) => new ActionRowBuilder().addComponents(...buttons);
const button = (id, label) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Secondary);
const card = (title, text) => new EmbedBuilder().setColor(0xEEEEEE).setTitle(title).setDescription(text).setFooter({ text: 'QG • Accueil de la communauté' });
function panel() {
  return { embeds: [card('Bienvenue au QG', '**1 · Vérifie ton profil**\nRenseigne ton pseudo Roblox, ton nom Discord et la raison de ta venue, puis confirme le profil retrouvé.\n\n**2 · Lis le règlement**\nIl sera affiché dans un message visible uniquement par toi.\n\n**3 · Rejoins la communauté**\nConfirme avoir lu et accepté le règlement pour recevoir le rôle Membre Communautaire.\n\nUne liaison déjà enregistrée peut être réutilisée. Aucun mot de passe ni cookie ne te sera demandé.')], components: [row(button('qgs:verify', 'Commencer ma vérification'))], allowedMentions: { parse: [] } };
}
function createHandler({ read = data.read, update = data.update, existing = soul.existing, findRoblox = soul.findRoblox } = {}) {
  const busy = new Set();
  const get = id => read('qgServer').schoolEntryVerification?.[id];
  const save = (id, value) => update('qgServer', state => { state.schoolEntryVerification ||= {}; state.schoolEntryVerification[id] = value; });
  const rules = token => ({ content: null, embeds: [card('Règlement du QG • À lire avant de continuer', require('./qgSchoolSetup').ruleText)], components: [row(button(`qgs:entry-accept:${token}`, "J’ai lu et j’accepte le règlement"))], allowedMentions: { parse: [] } });
  return async function handle(i) {
    const id = i.customId || '';
    if (i.guildId !== config.guildId || !(id === 'qgs:verify' || id.startsWith('qgs:entry-'))) return false;
    if (busy.has(i.user.id)) { await i.reply({ content: 'Une étape est déjà en cours. Réessaie dans un instant.', flags: MessageFlags.Ephemeral }); return true; }
    busy.add(i.user.id);
    try {
      if (id === 'qgs:entry-form') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const name = i.fields.getTextInputValue('roblox').trim(), discordName = i.fields.getTextInputValue('discord').trim(), reason = i.fields.getTextInputValue('reason').trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name) || !discordName || discordName.includes('@') || !reason) throw Error('Indique un pseudo Roblox valide, ton nom Discord sans @ et la raison de ta venue.');
        const profile = await findRoblox(name);
        const draft = { ...profile, discordName, reason, token: randomUUID(), stage: 'profile', expires: Date.now() + 30 * 60000 };
        save(i.user.id, draft);
        await i.editReply({ embeds: [card('Est-ce bien ton profil Roblox ?', `**${escapeMarkdown(profile.displayName || profile.robloxName)}**\nPseudo : **${escapeMarkdown(profile.robloxName)}**\n[Ouvrir le profil Roblox](https://www.roblox.com/users/${profile.robloxId}/profile)\n\nConfirme uniquement si ce profil est le tien. Cette étape repose sur ta déclaration.`)], components: [row(button(`qgs:entry-confirm:${draft.token}`, 'Oui, c’est mon profil'), button(`qgs:entry-retry:${draft.token}`, 'Corriger le pseudo'))], allowedMentions: { parse: [] } });
        return true;
      }
      if (id === 'qgs:verify') {
        const profile = get(i.user.id)?.robloxId ? get(i.user.id) : existing(i.user.id);
        if (!profile || (!profile.confirmedAt && profile.stage === 'profile')) {
          await i.showModal(soul.modal({ discordName: i.user.username }, { customId: 'qgs:entry-form', title: 'Vérification • QG' }));
          return true;
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const draft = { robloxId: profile.robloxId, robloxName: profile.robloxName, discordName: profile.discordName || i.user.username, reason: profile.reason || '', token: randomUUID(), stage: 'rules', expires: Date.now() + 30 * 60000, version: VERSION };
        save(i.user.id, draft);
        await i.editReply(rules(draft.token));
        return true;
      }
      const draft = get(i.user.id);
      if (!draft || draft.token !== id.split(':')[2] || draft.expires < Date.now()) throw Error('Cette étape a expiré. Clique sur Commencer ma vérification pour reprendre.');
      if (id.startsWith('qgs:entry-retry:')) {
        if (draft.stage !== 'profile') throw Error('Cette étape est déjà terminée.');
        await i.showModal(soul.modal(draft, { customId: 'qgs:entry-form', title: 'Vérification • QG' })); return true;
      }
      await i.deferUpdate();
      if (id.startsWith('qgs:entry-confirm:')) {
        if (draft.stage !== 'profile') throw Error('Profil déjà confirmé. Reprends depuis le panel.');
        save(i.user.id, { ...draft, stage: 'rules', confirmedAt: Date.now(), version: VERSION });
        await i.editReply(rules(draft.token)); return true;
      }
      if (id.startsWith('qgs:entry-accept:')) {
        if (draft.stage !== 'rules' || draft.version !== VERSION) throw Error('Vérifie ton profil puis lis la version actuelle du règlement.');
        const member = await i.guild.members.fetch({ user: i.user.id, force: true });
        if (member.pending) throw Error('Termine d’abord les contrôles d’accueil natifs de Discord.');
        const roleId = read('qgServer').schoolRoles?.community;
        const role = roleId && await i.guild.roles.fetch(roleId);
        if (!role?.editable) throw Error('Le rôle Membre Communautaire est absent ou trop haut pour le bot. Préviens la direction.');
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId, 'Profil confirmé et règlement QG accepté');
        save(i.user.id, { ...draft, stage: 'accepted', acceptedAt: Date.now(), confirmedAt: draft.confirmedAt || Date.now() });
        await i.editReply({ content: 'Bienvenue au QG ! Ton profil est enregistré et tu as accepté le règlement. Tu es maintenant Membre Communautaire.', embeds: [], components: [], allowedMentions: { parse: [] } });
      }
      return true;
    } finally { busy.delete(i.user.id); }
  };
}
module.exports = { panel, createHandler, handle: createHandler() };
