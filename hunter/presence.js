// /bot : panel pour régler le statut du bot (en ligne, absent, ne pas déranger…) et ce qu'il affiche.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    ActivityType, PermissionFlagsBits: P } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');

const statuses = [
    { value: 'online', label: 'En ligne', emoji: '🟢' },
    { value: 'idle', label: 'Absent', emoji: '🌙' },
    { value: 'dnd', label: 'Ne pas déranger', emoji: '⛔' },
    { value: 'invisible', label: 'Invisible (apparaît hors ligne)', emoji: '⚫' }
];

const types = [
    { value: 'custom', label: 'Statut personnalisé (ce qu’il pense)', emoji: '💭', type: ActivityType.Custom, prefix: '' },
    { value: 'playing', label: 'Joue à…', emoji: '🎮', type: ActivityType.Playing, prefix: 'Joue à ' },
    { value: 'watching', label: 'Regarde…', emoji: '📺', type: ActivityType.Watching, prefix: 'Regarde ' },
    { value: 'listening', label: 'Écoute…', emoji: '🎧', type: ActivityType.Listening, prefix: 'Écoute ' },
    { value: 'competing', label: 'Participe à…', emoji: '🏆', type: ActivityType.Competing, prefix: 'Participe à ' }
];

const defaults = { status: 'online', type: 'watching', text: 'l’examen des Hunters' };
const current = () => ({ ...defaults, ...store.read('presence', {}) });

function presenceData(state) {
    const type = types.find(t => t.value === state.type);
    const activities = state.text
        ? [type.type === ActivityType.Custom ? { name: 'Custom Status', state: state.text, type: type.type } : { name: state.text, type: type.type }]
        : [];
    return { status: state.status, activities };
}

function apply(client, state = current()) {
    const data = presenceData(state);
    client.options.presence = data; // réappliqué si le bot se reconnecte
    client.user.setPresence(data);
}

function panel(state = current()) {
    const status = statuses.find(s => s.value === state.status);
    const type = types.find(t => t.value === state.type);
    return {
        embeds: [ui.card(cfg.colors.nen)
            .setTitle('🤖 Gestion du bot')
            .addFields(
                { name: 'Statut', value: `${status.emoji} ${status.label}`, inline: true },
                { name: 'Activité', value: state.text ? `${type.emoji} ${type.prefix}**${state.text}**` : 'Aucune', inline: true }
            )
            .setDescription('Choisis le statut et le type d’activité dans les menus, puis le texte avec le bouton.')],
        components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hunter:bot:status').setPlaceholder('Statut')
                .addOptions(statuses.map(s => ({ ...s, default: s.value === state.status })))),
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hunter:bot:type').setPlaceholder('Type d’activité')
                .addOptions(types.map(({ value, label, emoji }) => ({ value, label, emoji, default: value === state.type })))),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hunter:bot:text').setLabel('Changer le texte').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hunter:bot:clear').setLabel('Retirer l’activité').setEmoji('🧹').setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

function allowed(member) {
    const server = store.read('server', { roles: {} });
    return member.permissions.has(P.Administrator) || cfg.councilKeys.some(k => member.roles.cache.has(server.roles[k]));
}

function save(interaction, patch) {
    const state = { ...current(), ...patch };
    store.write('presence', state);
    apply(interaction.client, state);
    return interaction.update(panel(state));
}

async function handle(interaction) {
    if (!allowed(interaction.member)) {
        return interaction.reply({ content: 'Seuls le Président et les Douze Zodiaques gèrent le bot.', ephemeral: true });
    }
    if (interaction.isChatInputCommand()) return interaction.reply({ ...panel(), ephemeral: true });

    switch (interaction.customId) {
        case 'hunter:bot:status': return save(interaction, { status: interaction.values[0] });
        case 'hunter:bot:type': return save(interaction, { type: interaction.values[0] });
        case 'hunter:bot:clear': return save(interaction, { text: '' });
        case 'hunter:bot:textForm': return save(interaction, { text: interaction.fields.getTextInputValue('text').trim() });
        case 'hunter:bot:text': {
            const input = new TextInputBuilder().setCustomId('text').setLabel('Ce que le bot affiche')
                .setStyle(TextInputStyle.Short).setMaxLength(128).setRequired(true);
            if (current().text) input.setValue(current().text);
            return interaction.showModal(new ModalBuilder().setCustomId('hunter:bot:textForm').setTitle('Texte du bot')
                .addComponents(new ActionRowBuilder().addComponents(input)));
        }
    }
}

module.exports = { apply, handle };
