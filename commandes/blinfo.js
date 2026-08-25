const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    getBlacklistRecords
} = require("../utils/moderationStore");

function formatTimestamp(
    timestamp
) {
    if (!timestamp) {
        return "Inconnue";
    }

    return `<t:${Math.floor(timestamp / 1000)}:F>`;
}

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "blinfo"
            )
            .setDescription(
                "Afficher les informations de blacklist d'un utilisateur"
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

        const records =
            getBlacklistRecords(
                interaction.guild.id,
                userId
            );

        if (!records.length) {
            return interaction.reply({
                content:
                    "❌ Aucun historique de blacklist trouvé.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        const record =
            records[0];

        const user =
            await interaction.client.users
                .fetch(
                    userId
                )
                .catch(
                    () => null
                );

        const embed =
            new EmbedBuilder()
                .setColor(
                    record.active
                        ? 0xED4245
                        : 0x57F287
                )
                .setTitle(
                    "⛔ Informations Blacklist"
                )
                .setThumbnail(
                    record.avatarURL ||
                    user?.displayAvatarURL({
                        size:
                            512
                    }) ||
                    null
                )
                .addFields(
                    {
                        name:
                            "👤 Utilisateur",

                        value:
                            `${user ? `<@${user.id}>` : record.userTag}\n\`${userId}\``,

                        inline:
                            false
                    },

                    {
                        name:
                            "📌 État",

                        value:
                            record.active
                                ? "🔴 Blacklisté"
                                : "🟢 Retiré de la blacklist",

                        inline:
                            true
                    },

                    {
                        name:
                            "👮 Blacklisté par",

                        value:
                            `<@${record.moderatorId}>\n\`${record.moderatorId}\``,

                        inline:
                            true
                    },

                    {
                        name:
                            "📝 Raison",

                        value:
                            record.reason,

                        inline:
                            false
                    },

                    {
                        name:
                            "🕒 Date",

                        value:
                            formatTimestamp(
                                record.blacklistedAt
                            ),

                        inline:
                            true
                    },

                    {
                        name:
                            "📚 Nombre de blacklist",

                        value:
                            `${records.length}`,

                        inline:
                            true
                    }
                )
                .setFooter({
                    text:
                        "The Legacy • Blacklist"
                })
                .setTimestamp();

        if (
            record.unblacklistedAt
        ) {
            embed.addFields(
                {
                    name:
                        "🔓 Retiré le",

                    value:
                        formatTimestamp(
                            record.unblacklistedAt
                        ),

                    inline:
                        true
                },

                {
                    name:
                        "👮 Retiré par",

                    value:
                        record.unblacklistedById
                            ? `<@${record.unblacklistedById}>`
                            : "Inconnu",

                    inline:
                        true
                },

                {
                    name:
                        "📝 Raison du retrait",

                    value:
                        record.unblacklistReason ||
                        "Aucune raison",

                    inline:
                        false
                }
            );
        }

        return interaction.reply({
            embeds: [
                embed
            ]
        });
    }
};