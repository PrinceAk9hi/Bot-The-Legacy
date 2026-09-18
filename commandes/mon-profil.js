const { SlashCommandBuilder } = require("discord.js");
module.exports = {
    data: new SlashCommandBuilder().setName("mon-profil").setDescription("Consulter ou modifier ton profil et tes disponibilités"),
    async execute(interaction) { return require("../systems/memberProfile").start(interaction); }
};
