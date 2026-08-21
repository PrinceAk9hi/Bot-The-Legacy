const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Mettre un membre en timeout")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Membre à mute")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Durée du mute en minutes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)
        )
        .addStringOption(option =>
            option
                .setName("raison")
                .setDescription("Raison du mute")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    async execute(interaction) {
        const membre = interaction.options.getMember("membre");
        const minutes = interaction.options.getInteger("minutes");
        const raison =
            interaction.options.getString("raison") ||
            "Aucune raison précisée";

        if (!membre) {
            return interaction.reply({
                content: "❌ Membre introuvable.",
                ephemeral: true
            });
        }

        if (!membre.moderatable) {
            return interaction.reply({
                content: "❌ Je ne peux pas mute ce membre.",
                ephemeral: true
            });
        }

        const duree = minutes * 60 * 1000;

        await membre.timeout(duree, raison);

        await interaction.reply({
            content:
                `🔇 ${membre.user.username} a été mute pendant **${minutes} minute(s)**.\n` +
                `Raison : **${raison}**`
        });
    }
};