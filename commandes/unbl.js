const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    removeBlacklist
} = require("../utils/moderationStore");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "unbl"
            )
            .setDescription(
                "Retirer un utilisateur de la blacklist"
            )
            .addStringOption(option =>
                option
                    .setName(
                        "id"
                    )
                    .setDescription(
                        "ID Discord de l'utilisateur"
                    )
                    .setRequired(
                        true
                    )
            )
            .addStringOption(option =>
                option
                    .setName(
                        "raison"
                    )
                    .setDescription(
                        "Raison du retrait"
                    )
                    .setRequired(
                        false
                    )
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers
            ),

    async execute(
        interaction
    ) {
        const userId =
            interaction.options
                .getString(
                    "id"
                )
                .trim();

        const reason =
            interaction.options
                .getString(
                    "raison"
                ) ||
            "Aucune raison précisée";

        const record =
            removeBlacklist(
                interaction.guild.id,
                userId,
                {
                    moderatorId:
                        interaction.user.id,

                    moderatorTag:
                        interaction.user.tag,

                    reason
                }
            );

        if (!record) {
            return interaction.reply({
                content:
                    "❌ Cet utilisateur n'est pas actuellement blacklisté.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content:
                `✅ **${record.userTag || userId}** a été retiré de la blacklist.\nRaison : **${reason}**`
        });
    }
};