const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Expulser un membre du serveur")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Membre à expulser")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("raison")
                .setDescription("Raison de l'expulsion")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        ),

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

        if (!membre.kickable) {
            return interaction.reply({
                content: "❌ Je ne peux pas expulser ce membre.",
                ephemeral: true
            });
        }

        await membre.kick(raison);

        await interaction.reply({
            content: `✅ ${membre.user.username} a été expulsé.\nRaison : **${raison}**`
        });
    }
};