const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getAllActiveUnions
} = require("../utils/unionStore");

// ======================================================
// CONFIG
// ======================================================

const COLOR =
    0x3B6475;

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "unionlist"
            )
            .setDescription(
                "Afficher toutes les Unions actives de The Legacy"
            ),

    async execute(
        interaction
    ) {
        const unions =
            getAllActiveUnions(
                interaction.guild.id
            );

        if (
            !unions.length
        ) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            COLOR
                        )
                        .setTitle(
                            "💍 Unions The Legacy"
                        )
                        .setDescription(
                            "Aucune Union active n'est actuellement enregistrée."
                        )
                ]
            });
        }

        const lines =
            unions.map(
                (union, index) => {
                    const date =
                        union.createdAt
                            ? `<t:${Math.floor(union.createdAt / 1000)}:d>`
                            : "Date inconnue";

                    let extra =
                        "";

                    if (
                        union.source ===
                            "ship" &&
                        Number.isFinite(
                            union.compatibility
                        )
                    ) {
                        extra =
                            ` • ❤️ ${union.compatibility}%`;
                    }

                    return (
                        `**${index + 1}.** ` +
                        `<@${union.member1Id}> × <@${union.member2Id}>` +
                        `\n-# Depuis ${date}${extra}`
                    );
                }
            );

        // ==================================================
        // PAGINATION PAR EMBEDS
        // ==================================================

        const chunks =
            [];

        for (
            let index = 0;
            index < lines.length;
            index += 15
        ) {
            chunks.push(
                lines.slice(
                    index,
                    index + 15
                )
            );
        }

        const embeds =
            chunks
                .slice(
                    0,
                    10
                )
                .map(
                    (chunk, pageIndex) => {
                        const embed =
                            new EmbedBuilder()
                                .setColor(
                                    COLOR
                                )
                                .setTitle(
                                    pageIndex === 0
                                        ? `💍 Unions The Legacy — ${unions.length}`
                                        : `💍 Unions — Page ${pageIndex + 1}`
                                )
                                .setDescription(
                                    chunk.join(
                                        "\n\n"
                                    )
                                );

                        if (
                            pageIndex ===
                            chunks.length - 1
                        ) {
                            embed.setFooter({
                                text:
                                    `${unions.length} Union(s) active(s)`
                            });
                        }

                        return embed;
                    }
                );

        return interaction.reply({
            embeds
        });
    }
};