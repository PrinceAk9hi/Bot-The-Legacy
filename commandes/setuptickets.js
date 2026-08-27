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
                .setDescription(
`**Panel Support** <a:earth:1477070794201759845>

**Aucun abus de ticket ne sera toléré**, merci de nous expliquer clairement la raison de votre ticket, *avec preuve(s)* si besoin.

**Voici notre panel de support, pouvant répondre à vos demandes :**

- <a:ticket:1477461507397648575> Questions/Aide

  -# Pour toute question ou besoin d’assistance générale.

- <:494996announcement:1532080361012723752> Création d'un évènement

  -# Pour toute demande ou information liée aux événements.

- <:11781warning:1532080330985574541> Signaler un membre

  -# Pour signaler un joueur ou un comportement (preuves requises).

- <:126013friends:1532080555317788782> Demander un partenariat

  -# Pour demander un partenariat de serveur (ping everyone obligatoire).

- <a:912553whiteheartexclaim:1532081105887297728> Demander un rôle particulier

  -# Pour demander un rôle staff, Content Creator, fondateur de famille, etc.

- <a:8148whitecrown:1532081260028100770> Contacter la fondation

  -# Pour les demandes importantes nécessitant un responsable.`
                );

        // ==================================================
        // MENU DÉROULANT
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

                    {
                        label:
                            "Signaler un membre",

                        description:
                            "Concernant un problème avec l'un de nos membres.",

                        value:
                            "report",

                        emoji: {
                            id:
                                "1532080330985574541"
                        }
                    },

                    {
                        label:
                            "Demander un partenariat",

                        description:
                            "Concernant la demande d'un partenariat entre serveurs.",

                        value:
                            "partnership",

                        emoji: {
                            id:
                                "1532080555317788782"
                        }
                    },

                    {
                        label:
                            "Demander un rôle particulier",

                        description:
                            "Concernant la demande d'un rôle unique.",

                        value:
                            "role",

                        emoji: {
                            id:
                                "1532081105887297728",

                            animated:
                                true
                        }
                    },

                    {
                        label:
                            "Contacter la fondation",

                        description:
                            "Concernant des demandes importantes et précises.",

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

        const row =
            new ActionRowBuilder()
                .addComponents(
                    select
                );

        // ==================================================
        // ENVOI
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

        return interaction.editReply({
            content:
                `✅ Panel Support installé : ${panel.url}`
        });
    }
};