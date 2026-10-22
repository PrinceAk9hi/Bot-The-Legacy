const { randomUUID } = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const data = require('../utils/recruitmentData');
const soul = require('./entryVerification');
const config = require('../config/qg');
const VERSION = 3;
const AGE_ROLES={'18':'1562838566487326781','13':'1562838771538468956'};
const NOTIFICATIONS=['notifAnnouncements','notifRp','notifNetworks','notifServers'];
const agePanel=token=>({embeds:[card('Ta tranche d’âge sur Roblox','Quelle est ta tranche d’âge sur Roblox ?')],components:[row(...['18','13'].map(age=>button('qgs:entry-age:'+token+':'+age,'Tranche d’âge +'+age+' sur Roblox')))],allowedMentions:{parse:[]}});
const notificationPanel=token=>({embeds:[card('Tes notifications','Choisis les notifications que tu souhaites recevoir, ou continue sans notification.')],components:[row(new StringSelectMenuBuilder().setCustomId('qgs:entry-notifs:'+token).setPlaceholder('Choisir mes notifications').setMinValues(0).setMaxValues(4).addOptions(NOTIFICATIONS.map((value,n)=>({value,label:['Annonces','Roleplay','Réseaux','Serveur'][n]})))),row(button('qgs:entry-no-notifs:'+token,'Continuer sans notification'))],allowedMentions:{parse:[]}});
const membership=require('../utils/qgVerificationMembership');
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
function createHandler({ read = data.read, update = data.update, existing = soul.existing, findRoblox = soul.findRoblox, welcome = require('./qgVerifiedWelcome').send, recordVerification = require('./qgCommunityUpgrade').recordVerification, syncMember = require('./qgSchoolSeparators').syncMember } = {}) {
  const busy = new Set();
  const get = id => read('qgServer').schoolEntryVerification?.[id];
  const save = (id, value) => {update('qgServer', state => { state.schoolEntryVerification ||= {}; state.schoolEntryVerification[id] = value; });recordVerification(id,value);};
  const rules = token => ({ content: null, embeds: [card('Confirmation de lecture du règlement', 'Confirmes-tu avoir bien lu et accepté le règlement affiché dans ce salon ?\n\nEn cliquant sur le bouton ci-dessous, tu t’engages à le respecter et tu recevras le rôle **Membre Communautaire**.')], components: [row(button(`qgs:entry-accept:${token}`, "J’ai lu et j’accepte le règlement"))], allowedMentions: { parse: [] } });
  return async function handle(i) {
    const id = i.customId || '';
    if (i.guildId !== config.guildId || !(id === 'qgs:verify' || id.startsWith('qgs:entry-'))) return false;
    if (busy.has(i.user.id)) { await i.reply({ content: 'Une étape est déjà en cours. Réessaie dans un instant.', flags: MessageFlags.Ephemeral }); return true; }
    busy.add(i.user.id);
    try {
      const sessionMember=await i.guild.members.fetch({user:i.user.id,force:true});
      const previous=get(i.user.id);
      if(previous&&!membership.current(previous,sessionMember))membership.invalidate(sessionMember,{read,update});
      const joinedAt=sessionMember.joinedTimestamp||0;
      if (id === 'qgs:entry-form') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const name = i.fields.getTextInputValue('roblox').trim(), discordName = i.fields.getTextInputValue('discord').trim();
        if(await require('./qgCommunityPolicy').newcomerAttempt(i.guild,i.user.id,`${name}\n${discordName}`,i.id))throw Error('Vérification interrompue : tentative interdite pendant les premières 24 heures.');
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name) || !discordName || discordName.length>32 || /[@\r\n\u0000-\u001f]/.test(discordName)) throw Error('Indique un pseudo Roblox valide et un nom de serveur de 1 à 32 caractères, sans @ ni retour à la ligne.');
        const profile = await findRoblox(name);
        const draft = { ...profile, discordName, joinedAt, createdAt:Date.now(), token: randomUUID(), stage: 'profile', expires: Date.now() + 30 * 60000 };
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
        const draft = { joinedAt, confirmedAt:profile.confirmedAt, robloxId: profile.robloxId, robloxName: profile.robloxName, discordName: profile.discordName || i.user.username, token: randomUUID(), stage: 'age', expires: Date.now() + 30 * 60000, version: VERSION };
        save(i.user.id, draft);
        await i.editReply(agePanel(draft.token));
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
        save(i.user.id, { ...draft, stage: 'age', confirmedAt: Date.now(), version: VERSION });
        await i.editReply(agePanel(draft.token)); return true;
      }
      if(id.startsWith('qgs:entry-age:')){
        const age=id.split(':')[3];if(draft.stage!=='age'||!AGE_ROLES[age])throw Error('Étape de tranche d’âge invalide.');
        save(i.user.id,{...draft,ageBracket:age,stage:'notifications'});await i.editReply(notificationPanel(draft.token));return true;
      }
      if(id.startsWith('qgs:entry-notifs:')||id.startsWith('qgs:entry-no-notifs:')){
        const selected=id.startsWith('qgs:entry-no-notifs:')?[]:i.values;
        if(draft.stage!=='notifications'||!Array.isArray(selected)||selected.some(k=>!NOTIFICATIONS.includes(k)))throw Error('Choix de notifications invalide.');
        save(i.user.id,{...draft,notificationKeys:[...new Set(selected)],stage:'rules'});await i.editReply(rules(draft.token));return true;
      }
      if (id.startsWith('qgs:entry-accept:')) {
        if (draft.stage !== 'rules' || draft.version !== VERSION || !AGE_ROLES[draft.ageBracket] || !Array.isArray(draft.notificationKeys)) throw Error('Vérifie ton profil puis lis la version actuelle du règlement.');
        const member = await i.guild.members.fetch({ user: i.user.id, force: true });
        if(!membership.current(draft,member))throw Error('Tu as rejoint le serveur de nouveau. Recommence la vérification depuis le règlement.');
        if (member.pending) throw Error('Termine d’abord les contrôles d’accueil natifs de Discord.');
        const roleId = read('qgServer').schoolRoles?.community;
        const role = roleId && await i.guild.roles.fetch(roleId);
        if (!role?.editable) throw Error('Le rôle Membre Communautaire est absent ou trop haut pour le bot. Préviens la direction.');
        const configured=read('qgServer').schoolRoles||{};
        const desired=[AGE_ROLES[draft.ageBracket],...draft.notificationKeys.map(k=>configured[k])];
        if(desired.some(id=>!id))throw Error('Une notification sélectionnée n’est pas configurée. Préviens la direction.');
        const optionalIds=[...Object.values(AGE_ROLES),...NOTIFICATIONS.map(k=>configured[k]).filter(Boolean)];
        for(const id of new Set([...desired,...optionalIds.filter(id=>member.roles.cache.has(id))])){const role=await i.guild.roles.fetch(id);if(!role?.editable)throw Error('Un rôle de tranche d’âge ou de notification est absent ou trop haut. Préviens la direction.');}
        for(const id of desired)if(!member.roles.cache.has(id))await member.roles.add(id,'Préférences de vérification QG');
        for(const id of optionalIds)if(!desired.includes(id)&&member.roles.cache.has(id))await member.roles.remove(id,'Préférences de vérification QG');
        if(draft.discordName!==member.displayName){
          if(!member.manageable)throw Error('Le bot ne peut pas modifier ton nom sur le serveur. Préviens la direction.');
          await member.setNickname(draft.discordName,'Nom choisi lors de la vérification QG');
        }
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId, 'Profil confirmé et règlement QG accepté');
        await syncMember(await i.guild.members.fetch({user:i.user.id,force:true}));
        save(i.user.id, { ...draft, stage: 'accepted', acceptedAt: Date.now(), confirmedAt: draft.confirmedAt || Date.now() });
        await i.editReply({ content: 'Bienvenue au QG ! Ton profil est enregistré et tu as accepté le règlement. Tu es maintenant Membre Communautaire.', embeds: [], components: [], allowedMentions: { parse: [] } });
        await welcome(member).catch(error => console.warn('Bienvenue QG non publié :', error.code || error.name));
      }
      return true;
    } finally { busy.delete(i.user.id); }
  };
}
module.exports = { panel, profileModal, createHandler, handle: createHandler() };
