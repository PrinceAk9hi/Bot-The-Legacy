const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('skip').setDescription('Voter pour passer la musique en cours').setDMPermission(false),
    async execute(interaction) {
        return require('../systems/music')(interaction.client).command(interaction, 'skip');
    }
};
