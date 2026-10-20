const { randomUUID } = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const data = require('../utils/recruitmentData');
const soul = require('./entryVerification');
const config = require('../config/qg');
const VERSION = 2;
const row = (...buttons) => new ActionRowBuilder().addComponents(...buttons);
const button = (id, label) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Secondary);
const card = (title, text) => new EmbedBuilder().setFooter({text:'Fondateur - QG'}).setColor(0xffffff).setTitle(title).setDescription(text);
function profileModal(profile={}){
 return new ModalBuilder().setCustomId('qgs:entry-form').setTitle('Vérification • QG').addComponents(
  ...[['roblox','Pseudo Roblox, sans @',profile.robloxName,20],['discord','Nom souhaité sur le serveur',profile.discordName,32]].map(([id,label,value,max])=>{
   const input=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(max);
   if(value)input.setValue(String(value).slice(0,max));return row(input);
  }));
}
function panel() {
  return { embeds: [card('Règlement du QG', require('./qgSchoolSetup').ruleText)], components: [row(button('qgs:verify', 'Commencer ma vérification'),button('qgs:help-open','Besoin d’aide'))], allowedMentions: { parse: [] } };
}
function createHandler({ read = data.read, update = data.update, existing = soul.existing, findRoblox = soul.findRoblox, welcome = require('./qgVerifiedWelcome').send } = {}) {
  const busy = new Set();
  const get = id => read('qgServer').schoolEntryVerification?.[id];
  const save = (id, value) => {update('qgServer', state => { state.schoolEntryVerification ||= {}; state.schoolEntryVerification[id] = value; });require('./qgCommunityUpgrade').recordVerification(id,value);};
  const rules = token => ({ content: null, embeds: [card('Confirmation de lecture du règlement', 'Confirmes-tu avoir bien lu et accepté le règlement affiché dans ce salon ?\n\nEn cliquant sur le bouton ci-dessous, tu t’engages à le respecter et tu recevras le rôle **Membre Communautaire**.')], components: [row(button(`qgs:entry-accept:${token}`, "J’ai lu et j’accepte le règlement"))], allowedMentions: { parse: [] } });
  return async function handle(i) {
    const id = i.customId || '';
    if (i.guildId !== config.guildId || !(id === 'qgs:verify' || id.startsWith('qgs:entry-'))) return false;
    if (busy.has(i.user.id)) { await i.reply({ content: 'Une étape est déjà en cours. Réessaie dans un instant.', flags: MessageFlags.Ephemeral }); return true; }
    busy.add(i.user.id);
    try {
      if (id === 'qgs:entry-form') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const name = i.fields.getTextInputValue('roblox').trim(), discordName = i.fields.getTextInputValue('discord').trim();
        if(await require('./qgCommunityPolicy').newcomerAttempt(i.guild,i.user.id,`${name}\n${discordName}`,i.id))throw Error('Vérification interrompue : tentative interdite pendant les premières 24 heures.');
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name) || !discordName || discordName.length>32 || /[@\r\n\u0000-\u001f]/.test(discordName)) throw Error('Indique un pseudo Roblox valide et un nom de serveur de 1 à 32 caractères, sans @ ni retour à la ligne.');
        const profile = await findRoblox(name);
        const draft = { ...profile, discordName, token: randomUUID(), stage: 'profile', expires: Date.now() + 30 * 60000 };
        save(i.user.id, draft);
        await i.editReply({ embeds: [card('Est-ce bien ton profil Roblox ?', `**${escapeMarkdown(profile.displayName || profile.robloxName)}**\nPseudo : **${escapeMarkdown(profile.robloxName)}**\n[Ouvrir le profil Roblox](https://www.roblox.com/users/${profile.robloxId}/profile)\n\nConfirme uniquement si ce profil est le tien. Cette étape repose sur ta déclaration.`)], components: [row(button(`qgs:entry-confirm:${draft.token}`, 'Oui, c’est mon profil'), button(`qgs:entry-retry:${draft.token}`, 'Corriger le pseudo'))], allowedMentions: { parse: [] } });
        return true;
      }
      if (id === 'qgs:verify') {
        const profile = get(i.user.id);
        if(profile?.stage==='accepted'){await i.reply({content:'Ta vérification est déjà terminée.',flags:MessageFlags.Ephemeral});return true;}
        if (!profile || (!profile.confirmedAt && profile.stage === 'profile')) {
          await i.showModal(profileModal({ ...profile, discordName:profile?.discordName||i.user.username }));
          return true;
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const draft = { robloxId: profile.robloxId, robloxName: profile.robloxName, discordName: profile.discordName || i.user.username, token: randomUUID(), stage: 'rules', expires: Date.now() + 30 * 60000, version: VERSION };
        save(i.user.id, draft);
        await i.editReply(rules(draft.token));
        return true;
      }
      const draft = get(i.user.id);
      if (!draft || draft.token !== id.split(':')[2] || draft.expires < Date.now()) throw Error('Cette étape a expiré. Clique sur Commencer ma vérification pour reprendre.');
      if (id.startsWith('qgs:entry-retry:')) {
        if (draft.stage !== 'profile') throw Error('Cette étape est déjà terminée.');
        await i.showModal(profileModal(draft)); return true;
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
        if(draft.discordName!==member.displayName){
          if(!member.manageable)throw Error('Le bot ne peut pas modifier ton nom sur le serveur. Préviens la direction.');
          await member.setNickname(draft.discordName,'Nom choisi lors de la vérification QG');
        }
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId, 'Profil confirmé et règlement QG accepté');
        await require('./qgSchoolSeparators').syncMember(await i.guild.members.fetch({user:i.user.id,force:true}));
        save(i.user.id, { ...draft, stage: 'accepted', acceptedAt: Date.now(), confirmedAt: draft.confirmedAt || Date.now() });
        await i.editReply({ content: 'Bienvenue au QG ! Ton profil est enregistré et tu as accepté le règlement. Tu es maintenant Membre Communautaire.', embeds: [], components: [], allowedMentions: { parse: [] } });
        await welcome(member).catch(error => console.warn('Bienvenue QG non publié :', error.code || error.name));
      }
      return true;
    } finally { busy.delete(i.user.id); }
  };
}
module.exports = { panel, createHandler, handle: createHandler() };
