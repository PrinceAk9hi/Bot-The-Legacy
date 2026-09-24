const { blockProtectedInteraction } = require("../utils/security");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    addBanRecord
} = require("../utils/moderationStore");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "ban"
            )
            .setDescription(
                "Bannir un membre"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Le membre à bannir"
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
                        "Raison du bannissement"
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
        if (await blockProtectedInteraction(interaction, "ban")) return;

        const user =
            interaction.options.getUser(
                "membre"
            );

        const membre =
            interaction.options.getMember(
                "membre"
            );

        const raison =
            interaction.options.getString(
                "raison"
            ) ||
            "Aucune raison précisée";

        if (!membre) {
            return interaction.reply({
                content:
                    "❌ Membre introuvable sur le serveur.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (
            !membre.bannable
        ) {
            return interaction.reply({
                content:
                    "❌ Je ne peux pas bannir ce membre.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        try {
            await membre.ban({
                reason:
                    `${raison} | Par ${interaction.user.tag} (${interaction.user.id})`
            });

            addBanRecord({
                guildId:
                    interaction.guild.id,

                userId:
                    user.id,

                userTag:
                    user.tag,

                username:
                    user.username,

                avatarURL:
                    user.displayAvatarURL({
                        size:
                            512
                    }),

                moderatorId:
                    interaction.user.id,

                moderatorTag:
                    interaction.user.tag,

                moderatorAvatarURL:
                    interaction.user.displayAvatarURL({
                        size:
                            512
                    }),

                reason:
                    raison,

                bannedAt:
                    Date.now()
            });

            await interaction.reply({
                content:
                    `✅ **${user.tag}** a été banni.\nRaison : **${raison}**`
            });

        } catch (error) {
            console.error(
                "❌ =ban :",
                error
            );

            return interaction.reply({
                content:
                    `❌ Impossible de bannir ce membre.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }
    }
};