const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('musique').setDescription('Afficher le panel de contrôle de la musique').setDMPermission(false),
    async execute(interaction) {
        return require('../systems/music')(interaction.client).command(interaction, 'musique');
    }
};
