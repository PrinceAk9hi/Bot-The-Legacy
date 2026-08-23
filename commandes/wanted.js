const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR =
    0x3B6475;

// ======================================================
// RAISONS ALÉATOIRES
// ======================================================

const RANDOM_REASONS = [
    "Vol aggravé de biscuits dans les locaux de The Legacy",
    "Activité beaucoup trop suspecte dans les salons vocaux",
    "Disparition inexpliquée au moment de prendre ses responsabilités",
    "Excès de charisme non autorisé",
    "Tentative de corruption avec des Robux",
    "Présence inquiétante dans les vocaux à 4h du matin",
    "Détention illégale de memes douteux",
    "Abus manifeste de réactions Discord",
    "Soupçonné d'avoir dérangé la tranquillité de The Legacy",
    "Utilisation excessive du mot « wsh »",
    "Vol du dernier cookie de la Fondation",
    "Comportement beaucoup trop mystérieux",
    "Fuite après avoir été aperçu en train de préparer quelque chose de louche"
];

// ======================================================
// AVERTISSEMENTS
// ======================================================

const RANDOM_WARNINGS = [
    "⚠️ Individu potentiellement dangereux. Ne pas approcher sans biscuits.",
    "⚠️ Peut paraître innocent. Les apparences sont trompeuses.",
    "⚠️ Si vous le croisez, restez calme et contactez immédiatement The Legacy.",
    "⚠️ Sujet instable. Peut rejoindre un vocal sans prévenir.",
    "⚠️ Individu particulièrement imprévisible.",
    "⚠️ N'essayez pas de négocier seul avec cet individu.",
    "⚠️ Toute ressemblance avec une personne innocente serait totalement fortuite.",
    "⚠️ Approchez uniquement avec l'autorisation de la Fondation."
];

// ======================================================
// RÉCOMPENSES ALÉATOIRES
// ======================================================

const RANDOM_REWARDS = [
    "500$",
    "1 000$",
    "2 500$",
    "5 000$",
    "10 000$",
    "25 000$",
    "50 Robux",
    "1 paquet de cookies",
    "Une place VIP dans le vocal",
    "La reconnaissance éternelle de The Legacy"
];

// ======================================================
// HELPERS
// ======================================================

function randomItem(array) {
    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

function randomThreatLevel() {
    return (
        Math.floor(
            Math.random() * 5
        ) + 1
    );
}

function buildThreatStars(
    level
) {
    return (
        "★".repeat(
            level
        ) +
        "☆".repeat(
            5 - level
        )
    );
}

function buildCaseNumber() {
    const time =
        Date.now()
            .toString()
            .slice(
                -6
            );

    const random =
        Math.floor(
            Math.random() *
            999
        )
            .toString()
            .padStart(
                3,
                "0"
            );

    return (
        `TL-${time}-${random}`
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "wanted"
            )
            .setDescription(
                "Mettre un membre sur la liste des personnes recherchées"
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            "membre"
                        )
                        .setDescription(
                            "Membre recherché"
                        )
                        .setRequired(
                            true
                        )
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            "raison"
                        )
                        .setDescription(
                            "Motif de recherche (facultatif)"
                        )
                        .setMaxLength(
                            300
                        )
                        .setRequired(
                            false
                        )
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            "recompense"
                        )
                        .setDescription(
                            "Récompense proposée (facultatif)"
                        )
                        .setMaxLength(
                            100
                        )
                        .setRequired(
                            false
                        )
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(
        interaction
    ) {
        await interaction.deferReply();

        try {
            // ==========================================
            // OPTIONS
            // ==========================================

            const user =
                interaction.options
                    .getUser(
                        "membre"
                    );

            const customReason =
                interaction.options
                    .getString(
                        "raison"
                    );

            const customReward =
                interaction.options
                    .getString(
                        "recompense"
                    );

            // ==========================================
            // MEMBRE
            // ==========================================

            const member =
                interaction.guild
                    .members
                    .cache
                    .get(
                        user.id
                    ) ||
                await interaction.guild
                    .members
                    .fetch(
                        user.id
                    )
                    .catch(
                        () => null
                    );

            if (!member) {
                return interaction.editReply({
                    content:
                        "❌ Membre introuvable."
                });
            }

            // ==========================================
            // DONNÉES
            // ==========================================

            const reason =
                customReason ||
                randomItem(
                    RANDOM_REASONS
                );

            const reward =
                customReward ||
                randomItem(
                    RANDOM_REWARDS
                );

            const warning =
                randomItem(
                    RANDOM_WARNINGS
                );

            const threatLevel =
                randomThreatLevel();

            const stars =
                buildThreatStars(
                    threatLevel
                );

            const caseNumber =
                buildCaseNumber();

            // ==========================================
            // EMBED
            // ==========================================

            const embed =
                new EmbedBuilder()
                    .setColor(
                        COLOR
                    )

                    .setAuthor({
                        name:
                            "THE LEGACY • AVIS DE RECHERCHE",

                        iconURL:
                            interaction.guild
                                .iconURL({
                                    size:
                                        256
                                }) ||
                            undefined
                    })

                    .setTitle(
                        "🚨 RECHERCHÉ PAR THE LEGACY"
                    )

                    .setDescription(
`## <@${member.id}>

> Un nouvel individu vient officiellement d'être placé sur la liste des personnes recherchées de **The Legacy**.

${warning}`
                    )

                    .setThumbnail(
                        member.user
                            .displayAvatarURL({
                                size:
                                    512
                            })
                    )

                    .setImage(
                        member.user
                            .displayAvatarURL({
                                size:
                                    1024
                            })
                    )

                    .addFields(
                        {
                            name:
                                "👤 Individu",

                            value:
                                `<@${member.id}>\n\`${member.user.username}\``,

                            inline:
                                true
                        },

                        {
                            name:
                                "📁 Dossier",

                            value:
                                `\`${caseNumber}\``,

                            inline:
                                true
                        },

                        {
                            name:
                                "🚨 Statut",

                            value:
                                "**EN FUITE**",

                            inline:
                                true
                        },

                        {
                            name:
                                "🎭 Motif",

                            value:
                                reason,

                            inline:
                                false
                        },

                        {
                            name:
                                "💰 Récompense",

                            value:
                                `**${reward}**`,

                            inline:
                                true
                        },

                        {
                            name:
                                "⚠️ Menace",

                            value:
                                `\`${stars}\`\n**${threatLevel}/5**`,

                            inline:
                                true
                        },

                        {
                            name:
                                "📍 Dernière localisation connue",

                            value:
                                member.voice
                                    .channelId
                                    ? `<#${member.voice.channelId}> 👀`
                                    : "Localisation inconnue.",

                            inline:
                                false
                        }
                    )

                    .setFooter({
                        text:
                            `Signalement humoristique • Demandé par ${interaction.user.username}`
                    })

                    .setTimestamp();

            // ==========================================
            // BOUTONS
            // ==========================================

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `wanted_seen_${member.id}`
                            )
                            .setLabel(
                                "Je l'ai aperçu"
                            )
                            .setEmoji(
                                "👁️"
                            )
                            .setStyle(
                                ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `wanted_capture_${member.id}`
                            )
                            .setLabel(
                                "Tenter de le capturer"
                            )
                            .setEmoji(
                                "🚨"
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            // ==========================================
            // ENVOI
            // ==========================================

            return interaction.editReply({
                embeds: [
                    embed
                ],

                components: [
                    row
                ],

                allowedMentions: {
                    users: [
                        member.id
                    ]
                }
            });

        } catch (error) {
            console.error(
                "❌ /wanted :",
                error
            );

            return interaction
                .editReply({
                    content:
                        `❌ Une erreur est survenue.\n\`${error.message}\``
                })
                .catch(
                    () => {}
                );
        }
    },

    // ==================================================
    // BOUTONS
    // ==================================================

    async handleButton(
        interaction
    ) {
        // ==================================================
        // APERÇU
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "wanted_seen_"
                )
        ) {
            const targetId =
                interaction.customId
                    .replace(
                        "wanted_seen_",
                        ""
                    );

            const messages = [
                `👁️ <@${interaction.user.id}> affirme avoir aperçu <@${targetId}> dans les environs...`,

                `🚨 Signalement reçu ! <@${interaction.user.id}> prétend avoir vu <@${targetId}>.`,

                `📡 Nouvelle information : <@${targetId}> aurait été aperçu par <@${interaction.user.id}>.`,

                `🕵️ <@${interaction.user.id}> vient de transmettre une information capitale concernant <@${targetId}>.`
            ];

            await interaction.reply({
                content:
                    randomItem(
                        messages
                    ),

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==================================================
        // CAPTURE
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "wanted_capture_"
                )
        ) {
            const targetId =
                interaction.customId
                    .replace(
                        "wanted_capture_",
                        ""
                    );

            // 35 % de réussite
            const success =
                Math.random() <
                0.35;

            if (success) {
                await interaction.reply({
                    content:
`🚨 **CAPTURE RÉUSSIE !**

<@${interaction.user.id}> vient officiellement de capturer <@${targetId}> !

> La Fondation de **The Legacy** étudie actuellement le versement de la récompense... 👀`,

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const failures = [
                `💨 <@${targetId}> s'est enfui juste avant l'arrivée de <@${interaction.user.id}> !`,

                `❌ Tentative ratée. <@${targetId}> était beaucoup trop rapide.`,

                `🏃 <@${targetId}> a repéré <@${interaction.user.id}> et a pris la fuite.`,

                `😭 Échec total. <@${interaction.user.id}> est revenu les mains vides.`,

                `🚪 <@${targetId}> aurait mystérieusement disparu juste avant sa capture.`
            ];

            await interaction.reply({
                content:
                    randomItem(
                        failures
                    ),

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        return false;
    }
};