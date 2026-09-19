const { COLORS: SOUL_COLORS, CHANNELS } = require("../config/soulSociety");

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
                "Installer le panel Support La Soul Society"
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

        const panelChannel = interaction.guild.channels.cache.get(CHANNELS.ticketPanel) ||
            await interaction.guild.channels.fetch(CHANNELS.ticketPanel).catch(() => null);
        if (!panelChannel?.isTextBased()) {
            return interaction.editReply({ content: "❌ Le salon du panel tickets est introuvable ou inaccessible." });
        }


        // ==================================================
        // EMBED PRINCIPAL
        // ==================================================

        const embed =
            new EmbedBuilder()
                .setColor(
                    SOUL_COLORS.primary
                )
                .setDescription(
`**Panel Support** <a:earth:1477070794201759845>

**Aucun abus de ticket ne sera toléré**, merci de nous expliquer clairement la raison de votre ticket, *avec preuve(s)* si besoin.

**Voici notre panel de support, pouvant répondre à vos demandes :**

- <:Ticket:1501602282171531435> Questions/Aide

  *Pour toute question ou besoin d’assistance générale.*

- <a:speaker:1548785378276810844> Création d'un évènement

  *Pour toute demande ou information liée aux événements.*

- ⚠️ Signaler un membre

  *Pour signaler un joueur ou un comportement (preuves requises).*

- <:126013friends:1532080555317788782> Demander un partenariat

  *Pour demander un partenariat de serveur (ping everyone obligatoire).*

- <a:912553whiteheartexclaim:1532081105887297728> Demander un rôle particulier

  *Pour demander un rôle staff, Content Creator, fondateur de famille, etc.*

- <:crown:1548785045047607416> Contacter la direction

  *Pour les demandes importantes nécessitant la direction.*`
                );

        // ==================================================
        // MENU DÉROULANT
        // ==================================================

        const select =
            new StringSelectMenuBuilder()
                .setCustomId(
                    "soul_ticket_select"
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
                                "1501602282171531435",

                            animated:
                                false
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
                            id: "1548785378276810844",
                            animated: true
                        }
                    },

                    {
                        label:
                            "Signaler un membre",

                        description:
                            "Concernant un problème avec l'un de nos membres.",

                        value:
                            "report",

                        emoji: { name: "⚠️" }
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
                            "Contacter la direction",

                        description:
                            "Concernant des demandes importantes et précises.",

                        value:
                            "foundation",

                        emoji: {
                            id:
                                "1548785045047607416",

                            animated:
                                false
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
            await panelChannel.send({
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