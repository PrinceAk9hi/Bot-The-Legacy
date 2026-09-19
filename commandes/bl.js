const { blockProtectedInteraction } = require("../utils/security");

const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    addBlacklistRecord
} = require("../utils/moderationStore");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "bl"
            )
            .setDescription(
                "Ajouter un utilisateur à la blacklist La Soul Society"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Utilisateur à blacklist"
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
                        "Raison de la blacklist"
                    )
                    .setRequired(
                        true
                    )
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers
            ),

    async execute(
        interaction
    ) {
        if (await blockProtectedInteraction(interaction, "bl")) return;

        const user =
            interaction.options.getUser(
                "membre"
            );

        const reason =
            interaction.options.getString(
                "raison"
            );

        const result =
            addBlacklistRecord({
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

                reason,

                blacklistedAt:
                    Date.now()
            });

        if (!result.ok) {
            return interaction.reply({
                content:
                    `❌ **${user.tag}** est déjà blacklisté.`,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    SOUL_COLORS.sanction
                )
                .setTitle(
                    "⛔ Utilisateur blacklisté"
                )
                .setThumbnail(
                    user.displayAvatarURL({
                        size:
                            512
                    })
                )
                .addFields(
                    {
                        name:
                            "👤 Utilisateur",

                        value:
                            `<@${user.id}>\n\`${user.id}\``
                    },

                    {
                        name:
                            "👮 Blacklisté par",

                        value:
                            `<@${interaction.user.id}>`
                    },

                    {
                        name:
                            "📝 Raison",

                        value:
                            reason
                    }
                )
                .setTimestamp();

        return interaction.reply({
            embeds: [
                embed
            ]
        });
    }
};