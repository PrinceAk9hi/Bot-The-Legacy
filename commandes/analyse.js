const { ROLES } = require("../config/soulSociety");
const { MAIN_RANKS } = require("../config/ranks");

const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const {
    getLastRankup
} = require("../utils/rankHistory");

// ======================================================
// CONFIG
// ======================================================

const COLOR = SOUL_COLORS.primary;

// ======================================================
// GRADES Soul Society
// ======================================================

const rankEntries = Object.entries(MAIN_RANKS);
const GRADES = rankEntries.map(([key, rank], index) => ({
    key,
    roleId: rank.roleId,
    name: rank.name,
    nextRoleId: rankEntries[index + 1]?.[1].roleId || null,
    nextName: rankEntries[index + 1]?.[1].name || null,
    minimumDays: rank.promotionMinimumDays,
    idealDays: rank.promotionIdealDays
}));

// ======================================================
// GESTIONS
// ======================================================

const MANAGEMENT_ROLES = [
    {
        "id": "1473356789453029376",
        "name": "Gestion Recrutement"
    },
    {
        "id": "1477056805103206450",
        "name": "Gestion Animation"
    },
    {
        "id": "1505974229118750851",
        "name": "Gestion Roleplay"
    },
    {
        "id": "1471557970079912047",
        "name": "Gestion Ticket"
    }
];

// ======================================================
// HELPERS
// ======================================================

function clamp(
    value,
    min,
    max
) {
    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );
}

// ======================================================
// FORMAT TEMPS
// ======================================================

function formatSeconds(
    totalSeconds
) {
    totalSeconds =
        Math.max(
            0,
            Math.floor(
                totalSeconds || 0
            )
        );

    const hours =
        Math.floor(
            totalSeconds / 3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );

    if (
        hours <= 0
    ) {
        return `${minutes} min`;
    }

    return (
        `${hours.toLocaleString("fr-FR")} h ` +
        `${String(minutes).padStart(2, "0")} min`
    );
}

// ======================================================
// FORMAT DURÉE EN JOURS
// ======================================================

function formatDays(
    totalDays
) {
    totalDays =
        Math.max(
            0,
            Math.floor(
                totalDays || 0
            )
        );

    const months =
        Math.floor(
            totalDays / 30
        );

    const days =
        totalDays % 30;

    if (
        months <= 0
    ) {
        if (
            totalDays === 1
        ) {
            return "1 jour";
        }

        return `${totalDays} jours`;
    }

    if (
        days === 0
    ) {
        return (
            `${months} mois`
        );
    }

    return (
        `${months} mois et ${days} jour${days > 1 ? "s" : ""}`
    );
}

// ======================================================
// GRADE ACTUEL
// ======================================================

function getCurrentGrade(
    member
) {
    return [...GRADES].reverse().find(
        grade =>
            member.roles.cache.has(
                grade.roleId
            )
    ) || null;
}

// ======================================================
// GESTIONS ACTUELLES
// ======================================================

function getMemberManagements(
    member
) {
    return MANAGEMENT_ROLES.filter(
        role =>
            member.roles.cache.has(
                role.id
            )
    );
}

// ======================================================
// STATS MEMBRE
// ======================================================

function getMemberStats(
    client,
    memberId
) {
    const activitySystem =
        client.activityStats;

    if (
        !activitySystem ||
        !activitySystem.stats
    ) {
        return null;
    }

    const stats =
        activitySystem.stats;

    const data =
        stats.members?.[
            memberId
        ];

    if (
        !data
    ) {
        return {
            messages: 0,
            voiceSeconds: 0,
            activity: 0,
            messageScore: 0,
            voiceScore: 0,
            activityPosition: null,
            totalMembers: 0
        };
    }

    // ==================================================
    // VOCAL EN COURS
    // ==================================================

    let currentVoiceSeconds =
        0;

    const currentSession =
        stats.voiceSessions?.[
            memberId
        ];

    if (
        currentSession?.startedAt
    ) {
        currentVoiceSeconds =
            Math.max(
                0,
                Math.floor(
                    (
                        Date.now() -
                        currentSession.startedAt
                    ) / 1000
                )
            );
    }

    const voiceSeconds =
        (
            data.voiceSeconds ||
            0
        ) +
        currentVoiceSeconds;

    const members =
        Object.values(
            stats.members || {}
        );

    // ==================================================
    // MAX MESSAGES
    // ==================================================

    const maxMessages =
        Math.max(
            1,
            ...members.map(
                item =>
                    item.messages ||
                    0
            )
        );

    // ==================================================
    // MAX VOCAL
    // ==================================================

    let maxVoice =
        1;

    const calculated =
        members.map(
            item => {
                const id =
                    item.discordId;

                let extra =
                    0;

                const session =
                    stats.voiceSessions?.[
                        id
                    ];

                if (
                    session?.startedAt
                ) {
                    extra =
                        Math.max(
                            0,
                            Math.floor(
                                (
                                    Date.now() -
                                    session.startedAt
                                ) / 1000
                            )
                        );
                }

                const total =
                    (
                        item.voiceSeconds ||
                        0
                    ) +
                    extra;

                maxVoice =
                    Math.max(
                        maxVoice,
                        total
                    );

                return {
                    discordId:
                        id,

                    messages:
                        item.messages ||
                        0,

                    voiceSeconds:
                        total
                };
            }
        );

    // ==================================================
    // SCORES
    // ==================================================

    const messageScore =
        Math.round(
            (
                (
                    data.messages ||
                    0
                ) /
                maxMessages
            ) *
            100
        );

    const voiceScore =
        Math.round(
            (
                voiceSeconds /
                maxVoice
            ) *
            100
        );

    const activity =
        Math.round(
            (
                messageScore +
                voiceScore
            ) /
            2
        );

    // ==================================================
    // POSITION
    // ==================================================

    const ranking =
        calculated
            .map(
                item => {
                    const ms =
                        (
                            item.messages /
                            maxMessages
                        ) *
                        100;

                    const vs =
                        (
                            item.voiceSeconds /
                            maxVoice
                        ) *
                        100;

                    return {
                        discordId:
                            item.discordId,

                        activity:
                            Math.round(
                                (
                                    ms +
                                    vs
                                ) /
                                2
                            )
                    };
                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.activity -
                    a.activity
            );

    const position =
        ranking.findIndex(
            item =>
                item.discordId ===
                memberId
        );

    return {
        messages:
            data.messages ||
            0,

        voiceSeconds,

        messageScore,

        voiceScore,

        activity,

        activityPosition:
            position !== -1
                ? position + 1
                : null,

        totalMembers:
            ranking.length
    };
}

// ======================================================
// ANCIENNETÉ DANS LE GRADE
// ======================================================

function getGradeAge(
    memberId,
    currentGrade
) {
    const lastRankup =
        getLastRankup(
            memberId
        );

    if (
        !lastRankup
    ) {
        return {
            known: false,
            days: null,
            timestamp: null
        };
    }

    // ==================================================
    // VÉRIFICATION QUE LE DERNIER RANK CORRESPOND
    // AU GRADE ACTUEL
    // ==================================================

    const historyRank =
        String(
            lastRankup.newRank ||
            lastRankup.roleName ||
            ""
        )
            .toLowerCase();

    const currentName =
        currentGrade.name
            .toLowerCase();

    const roughlyMatches =
        historyRank.includes(
            currentName
                .replace(
                    "membre ",
                    ""
                )
        ) ||
        historyRank.includes(
            currentName
        );

    /*
     * Même si les noms ne correspondent pas parfaitement,
     * on garde le timestamp car certains anciens historiques
     * utilisent les clés techniques.
     */

    const timestamp =
        lastRankup.timestamp;

    if (
        !timestamp
    ) {
        return {
            known: false,
            days: null,
            timestamp: null
        };
    }

    const days =
        Math.floor(
            (
                Date.now() -
                timestamp
            ) /
            86_400_000
        );

    return {
        known: true,
        days:
            Math.max(
                0,
                days
            ),
        timestamp,
        roughlyMatches
    };
}

// ======================================================
// NIVEAU D'ACTIVITÉ
// ======================================================

function getActivityLevel(
    score
) {
    if (
        score >= 75
    ) {
        return {
            label:
                "Très forte",

            emoji:
                "🟢"
        };
    }

    if (
        score >= 60
    ) {
        return {
            label:
                "Forte",

            emoji:
                "🟢"
        };
    }

    if (
        score >= 45
    ) {
        return {
            label:
                "Correcte",

            emoji:
                "🟠"
        };
    }

    if (
        score >= 30
    ) {
        return {
            label:
                "Faible",

            emoji:
                "🟠"
        };
    }

    return {
        label:
            "Très faible",

        emoji:
            "🔴"
    };
}

// ======================================================
// ANALYSE DU PASSAGE
// ======================================================

function evaluatePromotion({
    grade,
    gradeAge,
    stats,
    managementCount
}) {
    if (
        !grade.nextName
    ) {
        return {
            color:
                SOUL_COLORS.success,

            emoji:
                "👑",

            status:
                "Grade maximal atteint",

            explanation:
                `Ce membre possède déjà le grade **${grade.name}**. Aucun passage supérieur n'est actuellement prévu.`,

            timeStatus:
                "➖",

            activityStatus:
                stats.activity >= 60
                    ? "✅"
                    : stats.activity >= 45
                        ? "⚠️"
                        : "❌"
        };
    }

    // Aucun délai de promotion n'a encore été fourni pour les nouveaux paliers.
    if (!Number.isFinite(grade.minimumDays) || grade.minimumDays <= 0) {
        return {
            color: SOUL_COLORS.secondary,
            emoji: "ℹ️",
            status: "Critères de passage à configurer",
            explanation: `Le prochain grade est **${grade.nextName}**. Aucun délai de promotion n'est configuré pour ce palier ; une décision manuelle est nécessaire.`,
            timeStatus: "❔",
            activityStatus: stats.activity >= 60 ? "✅" : "⚠️"
        };
    }

    const activityStrong =
        stats.activity >=
        60;

    const activityMedium =
        stats.activity >=
        45;

    const hasManagement =
        managementCount > 0;

    // ==================================================
    // HISTORIQUE INCONNU
    // ==================================================

    if (
        !gradeAge.known
    ) {
        if (
            activityStrong
        ) {
            return {
                color:
                    0xFEE75C,

                emoji:
                    "🟠",

                status:
                    "Analyse incomplète",

                explanation:
`L'activité du membre est suffisamment élevée, mais **l'ancienneté exacte dans son grade actuel n'est pas disponible dans l'historique**.

Une vérification manuelle de sa date de passage est recommandée avant tout rankup.`,

                timeStatus:
                    "❔",

                activityStatus:
                    "✅"
            };
        }

        return {
            color:
                SOUL_COLORS.error,

            emoji:
                "🔴",

            status:
                "Passage non recommandé",

            explanation:
`L'ancienneté exacte du membre n'est pas disponible et son activité actuelle n'est pas suffisamment forte pour recommander un passage.`,

            timeStatus:
                "❔",

            activityStatus:
                activityMedium
                    ? "⚠️"
                    : "❌"
        };
    }

    const days =
        gradeAge.days;

    const minimum =
        grade.minimumDays;

    const ideal =
        grade.idealDays;

    const timeReached =
        days >=
        minimum;

    const nearTime =
        days >=
        minimum *
        0.8;

    // ==================================================
    // EXPERT → SENIOR
    // ==================================================

    if (
        grade.key ===
        "expert"
    ) {
        const idealReached =
            days >=
            ideal;

        if (
            idealReached &&
            activityStrong
        ) {
            return {
                color:
                    SOUL_COLORS.success,

                emoji:
                    "🟢",

                status:
                    "Passage fortement recommandé",

                explanation:
`Le membre possède une **ancienneté idéale pour le passage Sénior** et maintient une forte activité.${hasManagement ? "\n\nSon implication dans une ou plusieurs gestions renforce également son profil." : ""}`,

                timeStatus:
                    "✅",

                activityStatus:
                    "✅"
            };
        }

        if (
            timeReached &&
            activityStrong
        ) {
            return {
                color:
                    SOUL_COLORS.success,

                emoji:
                    "🟢",

                status:
                    "Passage envisageable",

                explanation:
`Le membre a dépassé le **minimum de 3 mois et demi** et possède une forte activité.

Le passage Sénior peut être envisagé, même si une ancienneté comprise autour de **5 à 6 mois reste idéale**.${hasManagement ? "\n\nLe membre est également impliqué dans la gestion de Soul Society." : ""}`,

                timeStatus:
                    "✅",

                activityStatus:
                    "✅"
            };
        }

        if (
            timeReached &&
            activityMedium
        ) {
            return {
                color:
                    0xFEE75C,

                emoji:
                    "🟠",

                status:
                    "À surveiller",

                explanation:
`L'ancienneté minimale est atteinte, mais l'activité du membre reste seulement correcte.

Il serait préférable d'attendre une activité plus forte avant un passage en **Membre Sénior**.`,

                timeStatus:
                    "✅",

                activityStatus:
                    "⚠️"
            };
        }

        if (
            nearTime &&
            activityStrong
        ) {
            return {
                color:
                    0xFEE75C,

                emoji:
                    "🟠",

                status:
                    "Presque prêt",

                explanation:
`Le membre possède une forte activité mais n'a pas encore atteint le minimum conseillé de **3 mois et demi**.

Son profil est bon, mais il manque encore un peu d'ancienneté.`,

                timeStatus:
                    "⚠️",

                activityStatus:
                    "✅"
            };
        }

        return {
            color:
                SOUL_COLORS.error,

            emoji:
                "🔴",

            status:
                "Passage non recommandé",

            explanation:
`Le membre ne remplit pas encore suffisamment les critères nécessaires au passage **Membre Sénior**.`,

            timeStatus:
                timeReached
                    ? "✅"
                    : "❌",

            activityStatus:
                activityStrong
                    ? "✅"
                    : activityMedium
                        ? "⚠️"
                        : "❌"
        };
    }

    // ==================================================
    // AUTRES GRADES
    // ==================================================

    if (
        timeReached &&
        activityStrong
    ) {
        return {
            color:
                SOUL_COLORS.success,

            emoji:
                "🟢",

            status:
                "Passage recommandé",

            explanation:
`Le membre remplit les conditions principales pour envisager son passage en **${grade.nextName}**.${hasManagement ? "\n\nSon implication dans une ou plusieurs gestions constitue également un point positif." : ""}`,

            timeStatus:
                "✅",

            activityStatus:
                "✅"
        };
    }

    if (
        timeReached &&
        activityMedium
    ) {
        return {
            color:
                0xFEE75C,

            emoji:
                "🟠",

            status:
                "À surveiller",

            explanation:
`L'ancienneté nécessaire est atteinte, mais l'activité du membre pourrait encore être améliorée avant son passage en **${grade.nextName}**.`,

            timeStatus:
                "✅",

            activityStatus:
                "⚠️"
        };
    }

    if (
        nearTime &&
        activityStrong
    ) {
        return {
            color:
                0xFEE75C,

            emoji:
                "🟠",

            status:
                "Presque prêt",

            explanation:
`L'activité du membre est suffisamment forte, mais il n'a pas encore complètement atteint l'ancienneté demandée pour **${grade.nextName}**.`,

            timeStatus:
                "⚠️",

            activityStatus:
                "✅"
        };
    }

    return {
        color:
            SOUL_COLORS.error,

        emoji:
            "🔴",

        status:
            "Passage non recommandé",

        explanation:
`Le membre ne remplit pas encore suffisamment les critères nécessaires pour envisager son passage en **${grade.nextName}**.`,

        timeStatus:
            timeReached
                ? "✅"
                : "❌",

        activityStatus:
            activityStrong
                ? "✅"
                : activityMedium
                    ? "⚠️"
                    : "❌"
    };
}

// ======================================================
// PROGRESS BAR
// ======================================================

function progressBar(
    value,
    max,
    size = 10
) {
    if (
        !max
    ) {
        return (
            "░".repeat(
                size
            )
        );
    }

    const ratio =
        clamp(
            value / max,
            0,
            1
        );

    const filled =
        Math.round(
            ratio *
            size
        );

    return (
        "█".repeat(
            filled
        ) +
        "░".repeat(
            size -
            filled
        )
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "analyse"
            )
            .setDescription(
                "Analyser l'activité et le potentiel de rankup d'un membre"
            )

            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre à analyser"
                    )
                    .setRequired(
                        true
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
            // ==================================================
            // MEMBRE
            // ==================================================

            const user =
                interaction.options
                    .getUser(
                        "membre"
                    );

            const member = await interaction.guild.members.fetch({ user: user.id, force: true }).catch(() => null);

            if (
                !member
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de récupérer les rôles actuels de ce membre. Réessaie dans un instant."
                });
            }

            if (
                member.user.bot
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible d'analyser un bot."
                });
            }

            // ==================================================
            // GRADE
            // ==================================================

            const currentGrade =
                getCurrentGrade(
                    member
                );

            if (
                !currentGrade
            ) {
                return interaction.editReply({
                    content:
                        `⚠️ Aucun grade Test → Référent configuré n’a été reconnu pour <@${member.id}> sur ce serveur. ${member.roles.cache.has(ROLES.member) ? "Le rôle Membres de la Soul Society est bien présent, mais ce n’est pas un grade." : "Cela ne signifie pas que le membre ne possède aucun rôle Soul Society."}\nVérifie l’ID du grade porté et lance /analyse dans Soul Society.`
                });
            }

            // ==================================================
            // STATISTIQUES
            // ==================================================

            const memberStats =
                getMemberStats(
                    interaction.client,
                    member.id
                );

            if (
                !memberStats
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le système de statistiques n'est pas disponible."
                });
            }

            // ==================================================
            // ANCIENNETÉ
            // ==================================================

            const gradeAge =
                getGradeAge(
                    member.id,
                    currentGrade
                );

            // ==================================================
            // GESTIONS
            // ==================================================

            const managements =
                getMemberManagements(
                    member
                );

            // ==================================================
            // NIVEAU ACTIVITÉ
            // ==================================================

            const activityLevel =
                getActivityLevel(
                    memberStats.activity
                );

            // ==================================================
            // ÉVALUATION
            // ==================================================

            const evaluation =
                evaluatePromotion({
                    grade:
                        currentGrade,

                    gradeAge,

                    stats:
                        memberStats,

                    managementCount:
                        managements.length
                });

            // ==================================================
            // BARRE ACTIVITÉ
            // ==================================================

            const activityBar =
                progressBar(
                    memberStats.activity,
                    100
                );

            // ==================================================
            // ANCIENNETÉ
            // ==================================================

            let ageText =
                "Historique indisponible";

            let requirementText =
                "Aucun passage supérieur";

            let timeProgress =
                "";

            if (
                gradeAge.known
            ) {
                ageText =
                    formatDays(
                        gradeAge.days
                    );
            }

            if (
                currentGrade.nextName
            ) {
                requirementText =
                    Number.isFinite(currentGrade.minimumDays) && currentGrade.minimumDays > 0
                        ? `${formatDays(currentGrade.minimumDays)} minimum`
                        : "Délai non configuré — décision manuelle";

                if (gradeAge.known && Number.isFinite(currentGrade.minimumDays) && currentGrade.minimumDays > 0) {
                    timeProgress =
                        `\`${progressBar(
                            gradeAge.days,
                            currentGrade.minimumDays
                        )}\` **${Math.min(
                            100,
                            Math.round(
                                (
                                    gradeAge.days /
                                    currentGrade.minimumDays
                                ) *
                                100
                            )
                        )}%**`;
                }
            }

            // ==================================================
            // GESTION TEXTE
            // ==================================================

            const managementText =
                managements.length
                    ? managements
                        .map(
                            role =>
                                `• ${role.name}`
                        )
                        .join(
                            "\n"
                        )
                    : "Aucune gestion détectée.";

            // ==================================================
            // CONDITIONS
            // ==================================================

            const conditionLines =
                [];

            if (
                currentGrade.nextName
            ) {
                conditionLines.push(
                    `${evaluation.timeStatus} **Ancienneté** — ${requirementText}`
                );

                conditionLines.push(
                    `${evaluation.activityStatus} **Activité générale** — ${memberStats.activity}%`
                );

                conditionLines.push(
                    `${memberStats.messageScore >= 60 ? "✅" : memberStats.messageScore >= 45 ? "⚠️" : "❌"} **Activité messages** — ${memberStats.messageScore}%`
                );

                conditionLines.push(
                    `${memberStats.voiceScore >= 60 ? "✅" : memberStats.voiceScore >= 45 ? "⚠️" : "❌"} **Activité vocale** — ${memberStats.voiceScore}%`
                );

                conditionLines.push(
                    `${managements.length ? "✅" : "➖"} **Implication dans une gestion** — ${managements.length ? `${managements.length} rôle(s)` : "Aucune"}`
                );
            }

            // ==================================================
            // PARTICULARITÉ SENIOR
            // ==================================================

            let seniorNote =
                "";

            if (
                currentGrade.key ===
                "expert"
            ) {
                seniorNote =
`### 👑 Passage Sénior
> Le minimum retenu est d'environ **3 mois et demi** en Membre avancé.
> Une ancienneté autour de **5 à 6 mois** reste cependant considérée comme idéale.`;
            }

            // ==================================================
            // EMBED
            // ==================================================

            const embed =
                new EmbedBuilder()
                    .setColor(
                        evaluation.color
                    )

                    .setAuthor({
                        name:
                            `Analyse de ${member.displayName}`,

                        iconURL:
                            member.displayAvatarURL({
                                size:
                                    256
                            })
                    })

                    .setTitle(
                        `📊 Analyse • ${evaluation.emoji} ${evaluation.status}`
                    )

                    .setThumbnail(
                        member.displayAvatarURL({
                            size:
                                512
                        })
                    )

                    .setDescription(
`> Analyse automatique basée sur les statistiques Discord et l'historique de grades de **Soul Society**.

### 👑 Situation

**Grade actuel :** <@&${currentGrade.roleId}>
${currentGrade.nextName
    ? `**Prochain grade :** <@&${currentGrade.nextRoleId}>`
    : "**Prochain grade :** Aucun — grade maximal"}

**Ancienneté au grade :** ${ageText}
${timeProgress ? `${timeProgress}` : ""}

### 📈 Activité

💬 **Messages :** ${memberStats.messages.toLocaleString("fr-FR")}
🎙️ **Temps vocal :** ${formatSeconds(memberStats.voiceSeconds)}
🏆 **Activité générale :** **${memberStats.activity}%**
${activityLevel.emoji} **Niveau : ${activityLevel.label}**

\`${activityBar}\` **${memberStats.activity}%**

> 💬 Messages : **${memberStats.messageScore}%**
> 🎙️ Vocal : **${memberStats.voiceScore}%**
> 🏅 Classement activité : **${memberStats.activityPosition ? `#${memberStats.activityPosition}/${memberStats.totalMembers}` : "Non classé"}**

### ⚙️ Implication

${managementText}

${currentGrade.nextName
    ? `### 🎯 Conditions de passage

${conditionLines.join("\n")}`
    : ""}

${seniorNote}

## ${evaluation.emoji} ${evaluation.status}

${evaluation.explanation}

-# Cette analyse reste indicative : une décision de rankup reste à la discrétion de la gestion de Soul Society.`
                    )

                    .setFooter({
                        text:
                            `Soul Society • Analyse automatique • Demandée par ${interaction.user.username}`
                    })

                    .setTimestamp();

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });

        } catch (error) {
            console.error(
                "❌ /analyse :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue pendant l'analyse.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};