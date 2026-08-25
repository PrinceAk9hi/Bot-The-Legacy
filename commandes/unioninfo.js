const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    getActiveUnionForMember,
    getUnionHistoryForMember
} = require("../utils/unionStore");

// ======================================================
// CONFIG
// ======================================================

const COLOR =
    0x3B6475;

// ======================================================
// DATE
// ======================================================

function formatDate(
    timestamp
) {
    if (!timestamp) {
        return "Inconnue";
    }

    return `<t:${Math.floor(timestamp / 1000)}:F>`;
}

// ======================================================
// SOURCE
// ======================================================

function formatSource(
    source
) {
    if (
        source ===
        "ship"
    ) {
        return "💘 `/ship`";
    }

    if (
        source ===
        "union"
    ) {
        return "💍 `/union`";
    }

    return "❔ Inconnue";
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "unioninfo"
            )
            .setDescription(
                "Afficher les informations d'Union d'un membre"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre dont tu veux consulter l'Union"
                    )
                    .setRequired(
                        true
                    )
            ),

    async execute(
        interaction
    ) {
        const user =
            interaction.options.getUser(
                "membre"
            );

        const current =
            getActiveUnionForMember(
                interaction.guild.id,
                user.id
            );

        const history =
            getUnionHistoryForMember(
                interaction.guild.id,
                user.id
            );

        if (
            !current &&
            !history.length
        ) {
            return interaction.reply({
                content:
                    `❌ <@${user.id}> n'a encore aucune Union enregistrée.`,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    current
                        ? COLOR
                        : 0x747F8D
                )
                .setTitle(
                    "💍 Informations Union"
                )
                .setThumbnail(
                    user.displayAvatarURL({
                        size:
                            512
                    })
                )
                .addFields({
                    name:
                        "👤 Membre",

                    value:
                        `<@${user.id}>\n\`${user.id}\``,

                    inline:
                        false
                });

        // ==================================================
        // UNION ACTIVE
        // ==================================================

        if (
            current
        ) {
            const partnerId =
                current.member1Id ===
                    user.id
                    ? current.member2Id
                    : current.member1Id;

            embed.addFields(
                {
                    name:
                        "💞 Union actuelle",

                    value:
                        `<@${user.id}> × <@${partnerId}>`,

                    inline:
                        false
                },

                {
                    name:
                        "📅 Depuis",

                    value:
                        formatDate(
                            current.createdAt
                        ),

                    inline:
                        true
                },

                {
                    name:
                        "🔗 Créée via",

                    value:
                        formatSource(
                            current.source
                        ),

                    inline:
                        true
                }
            );

            if (
                current.source ===
                    "ship" &&
                Number.isFinite(
                    current.compatibility
                )
            ) {
                embed.addFields({
                    name:
                        "❤️ Compatibilité",

                    value:
                        `**${current.compatibility}%**`,

                    inline:
                        true
                });
            }
        } else {
            embed.addFields({
                name:
                    "📌 État",

                value:
                    "Aucune Union active actuellement.",

                inline:
                    false
            });
        }

        // ==================================================
        // HISTORIQUE
        // ==================================================

        const deletedHistory =
            history.filter(
                union =>
                    !union.active
            );

        if (
            deletedHistory.length
        ) {
            const historyText =
                deletedHistory
                    .slice(
                        0,
                        8
                    )
                    .map(
                        union => {
                            const partnerId =
                                union.member1Id ===
                                    user.id
                                    ? union.member2Id
                                    : union.member1Id;

                            let text =
                                `💔 <@${partnerId}>`;

                            text +=
                                `\nCréée : ${formatDate(union.createdAt)}`;

                            text +=
                                `\nSupprimée : ${formatDate(union.deletedAt)}`;

                            text +=
                                `\nVia : ${formatSource(union.source)}`;

                            if (
                                union.source ===
                                    "ship" &&
                                Number.isFinite(
                                    union.compatibility
                                )
                            ) {
                                text +=
                                    ` • ❤️ ${union.compatibility}%`;
                            }

                            if (
                                union.deleteReason
                            ) {
                                text +=
                                    `\nRaison : ${union.deleteReason}`;
                            }

                            return text;
                        }
                    )
                    .join(
                        "\n\n"
                    );

            embed.addFields({
                name:
                    `📜 Ancienne${deletedHistory.length > 1 ? "s" : ""} Union${deletedHistory.length > 1 ? "s" : ""} — ${deletedHistory.length}`,

                value:
                    historyText.slice(
                        0,
                        1024
                    ),

                inline:
                    false
            });
        }

        embed
            .setFooter({
                text:
                    `The Legacy • ${history.length} Union(s) enregistrée(s)`
            })
            .setTimestamp();

        return interaction.reply({
            embeds: [
                embed
            ]
        });
    }
};