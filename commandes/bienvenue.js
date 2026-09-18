const { SlashCommandBuilder } = require("discord.js");
module.exports = {
    data: new SlashCommandBuilder().setName("bienvenue").setDescription("Compléter ou reprendre ton accueil Soul Society"),
    async execute(interaction) { return require("../systems/memberOnboarding").start(interaction); }
};
