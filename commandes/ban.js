const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bannir un membre")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Le membre à bannir")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("raison")
                .setDescription("Raison du bannissement")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const membre = interaction.options.getMember("membre");
        const raison =
            interaction.options.getString("raison") ||
            "Aucune raison précisée";

        if (!membre) {
            return interaction.reply({
                content: "❌ Membre introuvable.",
                ephemeral: true
            });
        }

        if (!membre.bannable) {
            return interaction.reply({
                content: "❌ Je ne peux pas bannir ce membre.",
                ephemeral: true
            });
        }

        await membre.ban({ reason: raison });

        await interaction.reply({
            content: `✅ ${membre.user.username} a été banni.\nRaison : **${raison}**`
        });
    }
};