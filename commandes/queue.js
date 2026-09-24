const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('queue').setDescription('Consulter la file musicale').setDMPermission(false),
    async execute(interaction) {
        return require('../systems/music')(interaction.client).command(interaction, 'queue');
    }
};
