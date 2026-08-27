const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ======================================================
// /SETUPTICKETS
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "setuptickets"
            )
            .setDescription(
                "Installer le panel Support The Legacy"
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

        // ==================================================
        // EMBED PRINCIPAL
        // ==================================================

        const embed =
            new EmbedBuilder()
                .setColor(
                    0x2B2D31
                )
                .setTitle(
                    "Panel Support 🌎"
                )
                .setDescription(
`**Aucun abus de ticket ne sera toléré**, merci de nous expliquer clairement la raison de votre ticket, *avec preuve(s)* si besoin.

**Voici notre panel de support, pouvant répondre à vos demandes :**`
                )

                // ==================================================
                // QUESTIONS / AIDE
                // ==================================================

                .addFields(
                    {
                        name:
                            "<a:ticket:1477461507397648575> Questions/Aide",

                        value:
                            "-# Pour toute question ou besoin d’assistance générale.",

                        inline:
                            false
                    },

                    // ==================================================
                    // ÉVÈNEMENT
                    // ==================================================

                    {
                        name:
                            "<:494996announcement:1532080361012723752> Création d'un évènement",

                        value:
                            "-# Pour toute demande ou information liée aux événements.",

                        inline:
                            false
                    },

                    // ==================================================
                    // SIGNALER UN MEMBRE
                    // ==================================================

                    {
                        name:
                            "<:11781warning:1532080330985574541> Signaler un membre",

                        value:
                            "-# Pour signaler un joueur ou un comportement (preuves requises).",

                        inline:
                            false
                    },

                    // ==================================================
                    // PARTENARIAT
                    // ==================================================

                    {
                        name:
                            "<:126013friends:1532080555317788782> Demander un partenariat",

                        value:
                            "-# Pour demander un partenariat de serveur (ping everyone obligatoire).",

                        inline:
                            false
                    },

                    // ==================================================
                    // RÔLE PARTICULIER
                    // ==================================================

                    {
                        name:
                            "<a:912553whiteheartexclaim:1532081105887297728> Demander un rôle particulier",

                        value:
                            "-# Pour demander un rôle staff, Content Creator, fondateur de famille, etc.",

                        inline:
                            false
                    },

                    // ==================================================
                    // FONDATION
                    // ==================================================

                    {
                        name:
                            "<a:8148whitecrown:1532081260028100770> Contacter la fondation",

                        value:
                            "-# Pour les demandes importantes nécessitant un responsable.",

                        inline:
                            false
                    }
                );

        // ==================================================
        // MENU DÉROULANT
        // ORDRE EXACT DU PANEL
        // ==================================================

        const select =
            new StringSelectMenuBuilder()
                .setCustomId(
                    "legacy_ticket_select"
                )
                .setPlaceholder(
                    "Fais un choix"
                )

                .addOptions(
                    // ==================================================
                    // QUESTIONS / AIDE
                    // ==================================================

                    {
                        label:
                            "Questions/Aide",

                        description:
                            "Concernant des questions ou un besoin d'aide.",

                        value:
                            "questions",

                        emoji: {
                            id:
                                "1477461507397648575",

                            animated:
                                true
                        }
                    },

                    // ==================================================
                    // ÉVÈNEMENT
                    // ==================================================

                    {
                        label:
                            "Création d'un évènement",

                        description:
                            "Concernant un futur évènement ou sa création.",

                        value:
                            "event",

                        emoji: {
                            id:
                                "1532080361012723752"
                        }
                    },

                    // ==================================================
                    // SIGNALER UN MEMBRE
                    // ==================================================

                    {
                        label:
                            "Signaler un membre",

                        description:
                            "Signaler un membre avec preuves si possible.",

                        value:
                            "report",

                        emoji: {
                            id:
                                "1532080330985574541"
                        }
                    },

                    // ==================================================
                    // PARTENARIAT
                    // ==================================================

                    {
                        label:
                            "Demander un partenariat",

                        description:
                            "Concernant une demande de partenariat.",

                        value:
                            "partnership",

                        emoji: {
                            id:
                                "1532080555317788782"
                        }
                    },

                    // ==================================================
                    // RÔLE PARTICULIER
                    // ==================================================

                    {
                        label:
                            "Demander un rôle particulier",

                        description:
                            "Concernant la demande d'un rôle particulier.",

                        value:
                            "role",

                        emoji: {
                            id:
                                "1532081105887297728",

                            animated:
                                true
                        }
                    },

                    // ==================================================
                    // FONDATION
                    // ==================================================

                    {
                        label:
                            "Contacter la fondation",

                        description:
                            "Pour les demandes importantes et précises.",

                        value:
                            "foundation",

                        emoji: {
                            id:
                                "1532081260028100770",

                            animated:
                                true
                        }
                    }
                );

        // ==================================================
        // ROW
        // ==================================================

        const row =
            new ActionRowBuilder()
                .addComponents(
                    select
                );

        // ==================================================
        // ENVOI DU PANEL
        // ==================================================

        const panel =
            await interaction.channel.send({
                embeds: [
                    embed
                ],

                components: [
                    row
                ],

                allowedMentions: {
                    parse:
                        []
                }
            });

        // ==================================================
        // CONFIRMATION
        // ==================================================

        return interaction.editReply({
            content:
                `✅ Panel Support installé : ${panel.url}`
        });
    }
};