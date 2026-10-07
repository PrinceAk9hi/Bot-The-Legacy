const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { OWNER_ID } = require('../utils/lineState');
const { IDENTITY } = require('../config/soulSociety');
const { configure } = require('../utils/botPresence');
module.exports = {
    data: new SlashCommandBuilder().setName('bot').setDescription('Gérer le statut et l’activité du bot (Aven uniquement)')
        .addStringOption(o => o.setName('action').setDescription('Statut ou type d’activité').addChoices(
            ...['online', 'idle', 'dnd', 'off', 'invisible', 'joue', 'regarde', 'ecoute', 'participe', 'effacer', 'auto'].map(value => ({ name: value, value }))))
        .addStringOption(o => o.setName('texte').setDescription('Texte de l’activité').setMaxLength(128)),
    async execute(i) {
        if (i.user.id !== OWNER_ID || i.guildId !== IDENTITY.guildId) return i.reply({ content: '❌ Commande réservée à Aven.', flags: MessageFlags.Ephemeral });
        const action = i.options.getString('action');
        const panel = require('../systems/botPanel')(i.client);
        if (!action) return i.reply(panel.payload());
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            configure(action, i.options.getString('texte') || '');
            require('./maintenance').maintenanceSystem.updateBotPresence(i.client);
            return i.editReply(panel.payload('✅ Réglages enregistrés.'));
        } catch (e) { return i.editReply({ content: '❌ ' + e.message, allowedMentions: { parse: [] } }); }
    }
};
