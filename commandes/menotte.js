const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mn")
        .setDescription("Commande interne")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Membre à verrouiller")
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const membre = interaction.options.getMember("membre");

        if (!membre) {
            return interaction.reply({
                content: "❌ Membre introuvable.",
                ephemeral: true
            });
        }

        if (!membre.voice.channel) {
            return interaction.reply({
                content: "❌ Ce membre n'est pas en vocal.",
                ephemeral: true
            });
        }

        client.menottes.set(membre.id, {
            guildId: interaction.guild.id,
            channelId: membre.voice.channel.id
        });

        await interaction.reply({
            content: `🔒 ${membre.user.username} est verrouillé dans ${membre.voice.channel.name}.`,
            ephemeral: true
        });
    }
};