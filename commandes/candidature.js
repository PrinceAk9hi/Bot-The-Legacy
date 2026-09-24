const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

const {
    loadState,
    saveState,
    updatePanel,
    countSoulMembers
} = require("../utils/candidaturePanel");

// ======================================================
// /CANDIDATURE
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "candidature"
            )
            .setDescription(
                "Gérer les candidatures La Soul Society"
            )

            // ==================================================
            // ON
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "on"
                        )
                        .setDescription(
                            "Ouvrir les candidatures"
                        )

                        .addIntegerOption(
                            option =>
                                option
                                    .setName(
                                        "limite"
                                    )
                                    .setDescription(
                                        "Limite d'effectif affichée, ex : 34/50"
                                    )
                                    .setMinValue(
                                        1
                                    )
                                    .setMaxValue(
                                        10000
                                    )
                                    .setRequired(
                                        false
                                    )
                        )
            )

            // ==================================================
            // OFF
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "off"
                        )
                        .setDescription(
                            "Fermer les candidatures"
                        )

                        .addStringOption(
                            option =>
                                option
                                    .setName(
                                        "date"
                                    )
                                    .setDescription(
                                        "Date de prochaine ouverture"
                                    )
                                    .setMaxLength(
                                        100
                                    )
                                    .setRequired(
                                        false
                                    )
                        )
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const action =
            interaction.options
                .getSubcommand();

        let state =
            loadState();

        // ==================================================
        // PAS INSTALLÉ
        // ==================================================

        if (
            !state.messageId
        ) {
            return interaction.editReply({
                content:
                    "❌ Aucun panel n'est actuellement installé. Utilise `=setupcandidature`."
            });
        }

        // ==================================================
        // ON
        // ==================================================

        if (
            action ===
            "on"
        ) {
            const limit =
                interaction.options
                    .getInteger(
                        "limite"
                    );

            state.enabled =
                true;

            // Si tu précises une limite :
            // Membres : X/LIMITE
            //
            // Si tu ne précises rien :
            // Membres : X
            state.limit =
                limit ??
                null;

            // AUCUNE DATE QUAND ON EST EN ON
            state.reopeningDate =
                null;

            state.updatedAt =
                Date.now();

            state.updatedBy =
                interaction.user.id;

            saveState(
                state
            );

            const result =
                await updatePanel(
                    interaction.guild
                );

            if (
                !result.ok
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de retrouver le panel. Relance `=setupcandidature`."
                });
            }

            const memberCount =
                await countSoulMembers(
                    interaction.guild
                );

            const counter =
                limit
                    ? `${memberCount}/${limit}`
                    : `${memberCount}`;

            const embed =
                new EmbedBuilder()
                    .setColor(
                        SOUL_COLORS.success
                    )
                    .setTitle(
                        "✅ Candidatures ouvertes"
                    )
                    .setDescription(
`Les candidatures de la **Soul Society** sont désormais ouvertes.

> 👥 **Membres : ${counter}**
> 🔘 Le bouton **rejoindre la Soul Society** est disponible.`
                    )
                    .setFooter({
                        text:
                            "La Soul Society • Recrutements"
                    })
                    .setTimestamp();

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });
        }

        // ==================================================
        // OFF
        // ==================================================

        if (
            action ===
            "off"
        ) {
            const date =
                interaction.options
                    .getString(
                        "date"
                    );

            state.enabled =
                false;

            state.reopeningDate =
                date &&
                date.trim()
                    ? date.trim()
                    : null;

            state.updatedAt =
                Date.now();

            state.updatedBy =
                interaction.user.id;

            saveState(
                state
            );

            const result =
                await updatePanel(
                    interaction.guild
                );

            if (
                !result.ok
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de retrouver le panel. Relance `=setupcandidature`."
                });
            }

            const reopening =
                state.reopeningDate ||
                "Indéfinie";

            const embed =
                new EmbedBuilder()
                    .setColor(
                        SOUL_COLORS.error
                    )
                    .setTitle(
                        "🔒 Candidatures fermées"
                    )
                    .setDescription(
`<a:dmd_gerant:1540428204098195616> **Candidatures Close**

> **Ouverture des recrutements :** ${reopening}

Le bouton **rejoindre la Soul Society** a été retiré.`
                    )
                    .setFooter({
                        text:
                            "La Soul Society • Recrutements"
                    })
                    .setTimestamp();

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });
        }

        return interaction.editReply({
            content:
                "❌ Action inconnue."
        });
    }
};