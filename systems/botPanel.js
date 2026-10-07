const { Events, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, escapeMarkdown } = require('discord.js');
const { OWNER_ID, isOff } = require('../utils/lineState');
const { IDENTITY, COLORS } = require('../config/soulSociety');
const { read } = require('../utils/recruitmentData');
const { configure } = require('../utils/botPresence');
const statuses = { online: '🟢 En ligne', idle: '🌙 Absent', dnd: '⛔ Ne pas déranger', invisible: '⚫ Invisible' };
const types = { joue: 'Joue à', regarde: 'Regarde', ecoute: 'Écoute', participe: 'Participe à' };
const row = (...items) => new ActionRowBuilder().addComponents(...items);
function payload(client, notice = '') {
    const saved = read('botPresence');
    const activity = saved.activities?.[0];
    const live = client.user?.presence;
    return { content: null, allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(COLORS.primary)
        .setTitle('🤖 Gestion du bot • La Soul Society')
        .setDescription((notice ? notice + '\n\n' : '') + 'Choisis le statut et l’activité dans les menus ci-dessous. Le texte de l’activité se renseigne dans un formulaire.\n\n**Invisible** masque la présence du bot mais le laisse fonctionner. Pour mettre ses fonctions en pause : `=line off`.')
        .addFields(
            { name: 'Mode', value: saved.enabled ? 'Personnalisé' : 'Automatique', inline: true },
            { name: 'Statut enregistré', value: saved.enabled ? statuses[saved.status] || saved.status : 'Géré automatiquement', inline: true },
            { name: 'Statut actuel', value: isOff() ? 'Bot en pause' : statuses[live?.status] || 'Automatique', inline: true },
            { name: 'Activité enregistrée', value: saved.enabled ? activity ? escapeMarkdown(activity.name).slice(0, 1024) : 'Aucune activité' : 'Gérée automatiquement' })
        .setFooter({ text: 'Aven uniquement • Réglages sauvegardés • Maintenance et pause prioritaires' })],
        components: [row(new StringSelectMenuBuilder().setCustomId('botpanel:status').setPlaceholder('Modifier le statut').addOptions(
            Object.entries(statuses).map(([value, label]) => ({ label, value, default: Boolean(saved.enabled && saved.status === value) })))),
        row(new StringSelectMenuBuilder().setCustomId('botpanel:activity').setPlaceholder('Modifier l’activité et son texte').addOptions(
            Object.entries(types).map(([value, label]) => ({ label, value })))),
        row(new ButtonBuilder().setCustomId('botpanel:clear').setLabel('Effacer l’activité').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('botpanel:auto').setLabel('Mode automatique').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('botpanel:refresh').setLabel('Actualiser').setStyle(ButtonStyle.Secondary))] };
}
function register(client) {
    if (client.botPanel) return client.botPanel;
    async function handle(i) {
        if (!i.customId?.startsWith('botpanel:')) return;
        if (i.user.id !== OWNER_ID || i.guildId !== IDENTITY.guildId) return i.reply({ content: '❌ Ce panel est réservé à Aven.', flags: MessageFlags.Ephemeral });
        if (isOff()) return i.reply({ content: 'Le bot est en pause. Utilise =line on avant de modifier sa présence.', flags: MessageFlags.Ephemeral });
        try {
            const [, action, type] = i.customId.split(':');
            if (i.message?.author?.id !== client.user.id) throw Error('Panel invalide. Relance =bot.');
            if (action === 'activity' && i.isStringSelectMenu()) {
                const kind = i.values[0];
                if (!Object.hasOwn(types, kind)) throw Error('Type d’activité invalide.');
                const field = new TextInputBuilder().setCustomId('text').setLabel('Texte de l’activité').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(128).setRequired(true);
                const text = read('botPresence').activities?.[0]?.name;
                if (text) field.setValue(text.slice(0, 128));
                return await i.showModal(new ModalBuilder().setCustomId('botpanel:save:' + kind).setTitle(types[kind] + '…').addComponents(row(field)));
            }
            if (!['status', 'save', 'clear', 'auto', 'refresh'].includes(action)) throw Error('Action inconnue.');
            await i.deferUpdate();
            if (action === 'status') {
                if (!i.isStringSelectMenu() || !Object.hasOwn(statuses, i.values[0])) throw Error('Statut invalide.');
                configure(i.values[0]);
            } else if (action === 'save') {
                if (!i.isModalSubmit() || !Object.hasOwn(types, type)) throw Error('Formulaire invalide.');
                configure(type, i.fields.getTextInputValue('text'));
            } else if (action === 'clear') configure('effacer');
            else if (action === 'auto') configure('auto');
            if (action !== 'refresh') require('../commandes/maintenance').maintenanceSystem.updateBotPresence(client);
            await i.editReply(payload(client, action === 'refresh' ? '' : '✅ Réglages enregistrés.'));
        } catch (e) {
            const data = { content: '❌ ' + e.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
            if (i.deferred || i.replied) await i.followUp(data).catch(() => {});
            else await i.reply(data).catch(() => {});
        }
    }
    client.on(Events.InteractionCreate, i => handle(i).catch(e => console.warn('Panel bot :', e.code || e.name)));
    client.botPanel = { payload: notice => payload(client, notice), handle };
    return client.botPanel;
}
module.exports = register;
module.exports.payload = payload;
