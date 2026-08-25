const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    markBanUnbanned
} = require("../utils/moderationStore");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "unban"
            )
            .setDescription(
                "Débannir un utilisateur"
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
                        "Raison du débannissement"
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

        if (
            !/^\d{17,20}$/.test(
                userId
            )
        ) {
            return interaction.reply({
                content:
                    "❌ ID Discord invalide.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        try {
            const ban =
                await interaction.guild.bans.fetch(
                    userId
                )
                .catch(
                    () => null
                );

            if (!ban) {
                return interaction.reply({
                    content:
                        "❌ Cet utilisateur n'est pas banni.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await interaction.guild.members.unban(
                userId,
                `${reason} | Par ${interaction.user.tag}`
            );

            markBanUnbanned(
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

            return interaction.reply({
                content:
                    `✅ **${ban.user.tag}** a été débanni.\nRaison : **${reason}**`
            });

        } catch (error) {
            console.error(
                "❌ /unban :",
                error
            );

            return interaction.reply({
                content:
                    `❌ Impossible de débannir cet utilisateur.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
};