const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    getBanRecords
} = require("../utils/moderationStore");

function discordTimestamp(
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
                "baninfos"
            )
            .setDescription(
                "Afficher toutes les informations d'un bannissement"
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
            getBanRecords(
                interaction.guild.id,
                userId
            );

        const currentBan =
            await interaction.guild.bans
                .fetch(
                    userId
                )
                .catch(
                    () => null
                );

        const record =
            records[0] ||
            null;

        if (
            !record &&
            !currentBan
        ) {
            return interaction.reply({
                content:
                    "❌ Aucun bannissement trouvé pour cet utilisateur.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        const user =
            currentBan?.user ||
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
                    currentBan
                        ? 0xED4245
                        : 0x3B6475
                )
                .setTitle(
                    "🔨 Informations du bannissement"
                )
                .setThumbnail(
                    record?.avatarURL ||
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
                            `${user ? `<@${user.id}>` : record?.userTag || "Utilisateur inconnu"}\n\`${userId}\``,

                        inline:
                            false
                    },

                    {
                        name:
                            "📌 État",

                        value:
                            currentBan
                                ? "🔴 Actuellement banni"
                                : "🟢 Actuellement débanni",

                        inline:
                            true
                    },

                    {
                        name:
                            "🔨 Banni par",

                        value:
                            record
                                ? `<@${record.moderatorId}>\n\`${record.moderatorId}\``
                                : "Information indisponible",

                        inline:
                            true
                    },

                    {
                        name:
                            "📝 Raison",

                        value:
                            record?.reason ||
                            currentBan?.reason ||
                            "Aucune raison enregistrée",

                        inline:
                            false
                    },

                    {
                        name:
                            "🕒 Date du ban",

                        value:
                            discordTimestamp(
                                record?.bannedAt
                            ),

                        inline:
                            true
                    },

                    {
                        name:
                            "📚 Nombre de bans enregistrés",

                        value:
                            `${records.length}`,

                        inline:
                            true
                    }
                )
                .setFooter({
                    text:
                        "The Legacy • Historique des sanctions"
                })
                .setTimestamp();

        if (
            record?.unbannedAt
        ) {
            embed.addFields(
                {
                    name:
                        "🔓 Débanni le",

                    value:
                        discordTimestamp(
                            record.unbannedAt
                        ),

                    inline:
                        true
                },

                {
                    name:
                        "👮 Débanni par",

                    value:
                        record.unbannedById
                            ? `<@${record.unbannedById}>\n\`${record.unbannedById}\``
                            : "Inconnu",

                    inline:
                        true
                },

                {
                    name:
                        "📝 Raison du unban",

                    value:
                        record.unbanReason ||
                        "Aucune raison précisée",

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