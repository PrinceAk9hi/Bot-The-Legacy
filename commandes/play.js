const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('play').setDescription('Chercher un titre ou lire un lien YouTube').setDMPermission(false)
        .addStringOption(option => option.setName('recherche').setDescription('Titre à rechercher ou lien YouTube').setRequired(true).setMaxLength(300)),
    async execute(interaction) {
        return require('../systems/music')(interaction.client).command(interaction, 'play');
    }
};
