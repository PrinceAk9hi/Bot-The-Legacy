const { inOffice, OFFICE_MESSAGE } = require("../utils/soulActivityHelpers");
const { QUESTION_BUTTON_ID } = require("../utils/interviewQuestions");
const { hasBypass } = require("../utils/security");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const ROLES_AUTORISES = [
    "1473356789453029376",
    "1469803353964810250",
    "1522357970778718249",
    "1471546243653304392",
    "1504782476319526932",
    "1527996778727870496"
];

module.exports = {

    data: new SlashCommandBuilder()
        .setName("entretien")
        .setDescription(
            "Ouvrir le panel d'entretien d'un membre"
        )
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription(
                    "Membre concerné par l'entretien"
                )
                .setRequired(true)
        ),

    async execute(interaction) {
        return module.exports.openPanel(interaction, interaction.options.getUser("membre").id);
    },

    async openPanel(interaction, targetUserId, publicPanel = false) {
        if (!inOffice(interaction)) return interaction.reply({content: OFFICE_MESSAGE, flags: MessageFlags.Ephemeral});

        // ======================================================
        // DEBUG TEMPORAIRE
        // ======================================================

        console.log("");
        console.log("====================================");
        console.log("🆕 NOUVEL ENTRETIEN EXECUTÉ");
        console.log("📁 FICHIER :", __filename);
        console.log("⚙️ PID NODE :", process.pid);
        console.log(
            "🕒 HEURE :",
            new Date().toLocaleString("fr-FR")
        );
        console.log("====================================");
        console.log("");

        // ======================================================
        // PERMISSIONS
        // ======================================================

        const autorise = hasBypass(interaction) ||
            ROLES_AUTORISES.some(roleId =>
                interaction.member.roles.cache.has(
                    roleId
                )
            );

        if (!autorise && !publicPanel) {
            return interaction.reply({
                content:
                    "❌ Tu n'as pas la permission d'utiliser cette commande.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        // ======================================================
        // RÉPONSE DIFFÉRÉE
        // ======================================================

        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        // ======================================================
        // MEMBRE
        // ======================================================

        const user = { id: targetUserId };

        const membre =
            await interaction.guild.members
                .fetch(user.id)
                .catch(() => null);

        if (!membre) {
            return interaction.editReply({
                content:
                    "❌ Membre introuvable."
            });
        }

        // ======================================================
        // INFORMATIONS
        // ======================================================

        const vocal =
            membre.voice.channel
                ? `<#${membre.voice.channel.id}>`
                : "Aucun vocal";

        const dateCreation =
            Math.floor(
                membre.user.createdTimestamp /
                1000
            );

        const dateArrivee =
            membre.joinedTimestamp
                ? Math.floor(
                    membre.joinedTimestamp /
                    1000
                )
                : null;

        // ======================================================
        // EMBED
        // ======================================================

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "🎓 Panel d'entretien"
                )
                .setThumbnail(
                    membre.user.displayAvatarURL({
                        size: 512
                    })
                )
                .setDescription(
                    `Gestion de l'entretien de <@${membre.id}>.`
                )
                .addFields(
                    {
                        name:
                            "👤 Candidat",
                        value:
                            `<@${membre.id}>`,
                        inline:
                            true
                    },

                    {
                        name:
                            "🆔 ID",
                        value:
                            `\`${membre.id}\``,
                        inline:
                            true
                    },

                    {
                        name:
                            "🔊 Vocal",
                        value:
                            vocal,
                        inline:
                            true
                    },

                    {
                        name:
                            "📅 Compte créé",
                        value:
                            `<t:${dateCreation}:R>`,
                        inline:
                            true
                    },

                    {
                        name:
                            "📥 Arrivée",
                        value:
                            dateArrivee
                                ? `<t:${dateArrivee}:R>`
                                : "Inconnue",
                        inline:
                            true
                    }
                )
                .setFooter({
                    text:
                        `Entretien ouvert par ${interaction.user.username}`
                })
                .setTimestamp();

        // ======================================================
        // IDS DU PANEL
        // ======================================================

        const ownerId =
            interaction.user.id;

        const targetId =
            membre.id;

        // ======================================================
        // LIGNE 1
        // ======================================================

        const ligne1 =
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_accept_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "Accepter"
                        )
                        .setEmoji(
                            "✅"
                        )
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_refuse_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "Refuser"
                        )
                        .setEmoji(
                            "❌"
                        )
                        .setStyle(
                            ButtonStyle.Danger
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_attente_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "Attente"
                        )
                        .setEmoji(
                            "⏳"
                        )
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        // ======================================================
        // LIGNE 2
        // ======================================================

        const ligne2 =
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_move_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "Déplacer vers sois"
                        )
                        .setEmoji(
                            "🔊"
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_cr_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "CR"
                        )
                        .setEmoji(
                            "📑"
                        )
                        .setStyle(
                            ButtonStyle.Secondary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `entretien_candidature_${ownerId}_${targetId}`
                        )
                        .setLabel(
                            "Voir candidature"
                        )
                        .setEmoji(
                            "⚖️"
                        )
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        // ======================================================
        ligne2.addComponents(new ButtonBuilder().setCustomId(QUESTION_BUTTON_ID).setLabel("Questions").setEmoji("📋").setStyle(ButtonStyle.Secondary));

        // DEBUG DES BOUTONS
        // ======================================================

        console.log(
            "✅ BOUTONS LIGNE 1 :",
            ligne1.components.map(
                button =>
                    button.data.label
            )
        );

        console.log(
            "✅ BOUTONS LIGNE 2 :",
            ligne2.components.map(
                button =>
                    button.data.label
            )
        );

        console.log("");

        // ======================================================
        // ENVOI DU PANEL
        // ======================================================

        return interaction.editReply({
            embeds: [
                embed
            ],

            components: autorise ? [ligne1, ligne2] : [new ActionRowBuilder().addComponents(ligne2.components[2], ligne2.components[3])]
        });
    }
};