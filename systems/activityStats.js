const fs = require("fs");
const path = require("path");

const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const STATS_FILE =
    path.join(
        DATA_DIR,
        "activityStats.json"
    );

const TRACKING_STARTED_AT =
    new Date(
        "2026-08-14T00:00:00+02:00"
    ).getTime();

const MESSAGE_MIN_LENGTH =
    10;

const PAGE_SIZE =
    5;

// ======================================================
// DONNÉES REPRISES DE L'ANCIEN SITE
// ======================================================
//
// discordId est renseigné uniquement lorsqu'on connaît
// déjà avec certitude l'ID Discord.
//
// aliases sert à retrouver automatiquement le compte
// correspondant même si son nickname a changé.
//
// ======================================================

const INITIAL_MEMBERS = [
    {
        key: "ak9hi",

        discordId:
            "547192186547077130",

        displayName:
            "Ak9hi",

        aliases: [
            "ak9hi"
        ],

        messages:
            1251,

        voiceSeconds:
            (
                (45 * 60) +
                50
            ) * 60
    },

    {
        key: "mme_mika",

        discordId:
            null,

        displayName:
            "Mme Mika",

        aliases: [
            "Mme Mika",
            "hael.k",
            "Mika"
        ],

        messages:
            684,

        voiceSeconds:
            (
                (370 * 60) +
                53
            ) * 60
    },

    {
        key: "zone",

        discordId:
            null,

        displayName:
            "Zone",

        aliases: [
            "Zone",
            "zone.lgcy"
        ],

        messages:
            581,

        voiceSeconds:
            (
                (205 * 60) +
                46
            ) * 60
    },

    {
        key: "dark_meg",

        discordId:
            null,

        displayName:
            "Dark Meg",

        aliases: [
            "Dark Meg",
            "meg.lgcy"
        ],

        messages:
            576,

        voiceSeconds:
            (
                (355 * 60) +
                51
            ) * 60
    },

    {
        key: "esta",

        discordId:
            null,

        displayName:
            "ESTA",

        aliases: [
            "ESTA",
            "esta.lgcy"
        ],

        messages:
            445,

        voiceSeconds:
            (
                (52 * 60) +
                1
            ) * 60
    },

    {
        key: "asnate",

        discordId:
            "883087428016046150",

        displayName:
            "ASNATE",

        aliases: [
            "ASNATE",
            "asnate",
            "snt.lgcy"
        ],

        messages:
            237,

        voiceSeconds:
            (
                (143 * 60) +
                29
            ) * 60
    },

    {
        key: "esteban",

        discordId:
            null,

        displayName:
            "ESTEBAN",

        aliases: [
            "ESTEBAN",
            "esteban.lgcy"
        ],

        messages:
            232,

        voiceSeconds:
            (
                (190 * 60) +
                54
            ) * 60
    },

    {
        key: "ems",

        discordId:
            null,

        displayName:
            "EMS.",

        aliases: [
            "EMS.",
            "EMS",
            "ems.lgcy"
        ],

        messages:
            158,

        voiceSeconds:
            (
                (27 * 60) +
                42
            ) * 60
    },

    {
        key: "shinra",

        discordId:
            null,

        displayName:
            "SHINRA",

        aliases: [
            "SHINRA",
            "shinra.lgcy"
        ],

        messages:
            101,

        voiceSeconds:
            (
                (83 * 60) +
                20
            ) * 60
    },

    {
        key: "zouzou",

        discordId:
            null,

        displayName:
            "ZOUZOU RABBIT",

        aliases: [
            "ZOUZOU RABBIT",
            "zouzou.lgcy"
        ],

        messages:
            47,

        voiceSeconds:
            (
                (57 * 60) +
                27
            ) * 60
    },

    {
        key: "mirage",

        discordId:
            null,

        displayName:
            "Mirage",

        aliases: [
            "Mirage",
            "mirage.lgcy"
        ],

        messages:
            22,

        voiceSeconds:
            (
                (4 * 60) +
                53
            ) * 60
    },

    {
        key: "pascal",

        discordId:
            null,

        displayName:
            "PASCAL",

        aliases: [
            "PASCAL",
            "pascal.lgcy"
        ],

        messages:
            18,

        voiceSeconds:
            (
                (8 * 60) +
                13
            ) * 60
    }
];

// ======================================================
// MÉMOIRE
// ======================================================

let stats =
    null;

// ======================================================
// FICHIERS
// ======================================================

function ensureFiles() {
    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive:
                    true
            }
        );
    }

    if (
        !fs.existsSync(
            STATS_FILE
        )
    ) {
        fs.writeFileSync(
            STATS_FILE,
            "{}",
            "utf8"
        );
    }
}

// ======================================================
// DEFAULT DATA
// ======================================================

function createDefaultStats() {
    return {
        version:
            2,

        trackingStartedAt:
            TRACKING_STARTED_AT,

        members:
            {},

        pendingLegacyMembers:
            INITIAL_MEMBERS.map(
                member => ({
                    ...member
                })
            ),

        voiceSessions:
            {},

        panel: {
            guildId:
                null,

            channelId:
                null,

            messageId:
                null
        }
    };
}

// ======================================================
// SAUVEGARDE
// ======================================================

function saveStats() {
    ensureFiles();

    try {
        fs.writeFileSync(
            STATS_FILE,
            JSON.stringify(
                stats,
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde activityStats :",
            error
        );

        return false;
    }
}

// ======================================================
// CHARGEMENT
// ======================================================

function loadStats() {
    ensureFiles();

    try {
        const raw =
            fs.readFileSync(
                STATS_FILE,
                "utf8"
            );

        const parsed =
            raw.trim()
                ? JSON.parse(
                    raw
                )
                : {};

        if (
            !parsed ||
            !parsed.version
        ) {
            stats =
                createDefaultStats();

            saveStats();

            return;
        }

        stats =
            parsed;

        if (
            !stats.members ||
            typeof stats.members !==
                "object"
        ) {
            stats.members =
                {};
        }

        if (
            !stats.voiceSessions ||
            typeof stats.voiceSessions !==
                "object"
        ) {
            stats.voiceSessions =
                {};
        }

        if (
            !stats.panel
        ) {
            stats.panel = {
                guildId:
                    null,

                channelId:
                    null,

                messageId:
                    null
            };
        }

        // ==================================================
        // MIGRATION V1 → V2
        // ==================================================

        if (
            stats.version <
            2
        ) {
            stats.version =
                2;

            if (
                !Array.isArray(
                    stats.pendingLegacyMembers
                )
            ) {
                stats.pendingLegacyMembers =
                    INITIAL_MEMBERS.map(
                        member => ({
                            ...member
                        })
                    );
            }

            // Convertir les anciens voiceMinutes
            for (
                const legacy
                of stats.pendingLegacyMembers
            ) {
                if (
                    legacy.voiceSeconds ===
                        undefined &&
                    legacy.voiceMinutes !==
                        undefined
                ) {
                    legacy.voiceSeconds =
                        legacy.voiceMinutes *
                        60;
                }
            }

            saveStats();
        }

    } catch (error) {
        console.error(
            "❌ Chargement activityStats :",
            error
        );

        stats =
            createDefaultStats();

        saveStats();
    }
}

// ======================================================
// NORMALISATION NOM
// ======================================================

function normalizeName(
    value
) {
    return String(
        value ||
        ""
    )
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .replace(
            /[^a-z0-9]/g,
            ""
        );
}

// ======================================================
// MEMBRE
// ======================================================

function ensureMember(
    userId,
    data = {}
) {
    if (
        !stats.members[
            userId
        ]
    ) {
        stats.members[
            userId
        ] = {
            discordId:
                userId,

            username:
                data.username ||
                null,

            displayName:
                data.displayName ||
                null,

            messages:
                0,

            voiceSeconds:
                0,

            firstSeenAt:
                Date.now(),

            lastMessageAt:
                null,

            lastVoiceAt:
                null,

            legacyImported:
                false,

            legacySourceKey:
                null
        };
    }

    const member =
        stats.members[
            userId
        ];

    if (
        data.username
    ) {
        member.username =
            data.username;
    }

    if (
        data.displayName
    ) {
        member.displayName =
            data.displayName;
    }

    return member;
}

// ======================================================
// TROUVER UN MEMBRE POUR L'IMPORT
// ======================================================

function findGuildMemberForLegacy(
    guild,
    legacy
) {
    // ==================================================
    // ID CONNU
    // ==================================================

    if (
        legacy.discordId
    ) {
        const byId =
            guild.members.cache.get(
                legacy.discordId
            );

        if (
            byId
        ) {
            return byId;
        }
    }

    const aliases =
        [
            legacy.displayName,
            ...(legacy.aliases || [])
        ]
            .map(
                normalizeName
            )
            .filter(
                Boolean
            );

    // ==================================================
    // USERNAME / DISPLAY NAME / GLOBAL NAME
    // ==================================================

    return guild.members.cache.find(
        candidate => {
            const candidateNames = [
                candidate.user.username,
                candidate.user.globalName,
                candidate.displayName,
                candidate.nickname
            ]
                .map(
                    normalizeName
                )
                .filter(
                    Boolean
                );

            return aliases.some(
                alias =>
                    candidateNames.includes(
                        alias
                    )
            );
        }
    );
}

// ======================================================
// IMPORT ANCIENNES STATS
// ======================================================

async function migrateLegacyMembers(
    guild
) {
    if (
        !Array.isArray(
            stats.pendingLegacyMembers
        )
    ) {
        stats.pendingLegacyMembers =
            INITIAL_MEMBERS.map(
                member => ({
                    ...member
                })
            );
    }

    if (
        stats.pendingLegacyMembers.length ===
        0
    ) {
        return;
    }

    console.log(
        "📊 Recherche des anciennes statistiques..."
    );

    await guild.members
        .fetch()
        .catch(
            () => null
        );

    const remaining =
        [];

    for (
        const legacy
        of stats.pendingLegacyMembers
    ) {
        const discordMember =
            findGuildMemberForLegacy(
                guild,
                legacy
            );

        if (
            !discordMember
        ) {
            console.log(
                `⚠️ Stats : ${legacy.displayName} non associé pour le moment`
            );

            remaining.push(
                legacy
            );

            continue;
        }

        const memberData =
            ensureMember(
                discordMember.id,
                {
                    username:
                        discordMember.user.username,

                    displayName:
                        discordMember.displayName
                }
            );

        if (
            memberData.legacyImported &&
            memberData.legacySourceKey ===
                legacy.key
        ) {
            continue;
        }

        memberData.messages =
            (
                memberData.messages ||
                0
            ) +
            (
                legacy.messages ||
                0
            );

        memberData.voiceSeconds =
            (
                memberData.voiceSeconds ||
                0
            ) +
            (
                legacy.voiceSeconds ||
                0
            );

        memberData.legacyImported =
            true;

        memberData.legacySourceKey =
            legacy.key;

        memberData.legacyImportedAt =
            Date.now();

        console.log(
            `✅ Stats importées : ${legacy.displayName} → ${discordMember.user.username}`
        );
    }

    stats.pendingLegacyMembers =
        remaining;

    saveStats();

    console.log(
        `📊 Migration terminée • ${remaining.length} profil(s) encore en attente`
    );
}

// ======================================================
// TEMPS
// ======================================================

function formatSeconds(
    totalSeconds
) {
    totalSeconds =
        Math.max(
            0,
            Math.floor(
                totalSeconds ||
                0
            )
        );

    const hours =
        Math.floor(
            totalSeconds /
            3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );

    if (
        hours <=
        0
    ) {
        return `${minutes} min`;
    }

    return (
        `${hours.toLocaleString("fr-FR")} h ` +
        `${String(minutes).padStart(2, "0")} min`
    );
}

// ======================================================
// SESSION VOCALE
// ======================================================

function getCurrentVoiceSeconds(
    memberId
) {
    const session =
        stats.voiceSessions[
            memberId
        ];

    if (
        !session ||
        !session.startedAt
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor(
            (
                Date.now() -
                session.startedAt
            ) /
            1000
        )
    );
}

function getTotalVoiceSeconds(
    memberId
) {
    const member =
        stats.members[
            memberId
        ];

    if (
        !member
    ) {
        return 0;
    }

    return (
        member.voiceSeconds ||
        0
    ) +
    getCurrentVoiceSeconds(
        memberId
    );
}

// ======================================================
// START VOCAL
// ======================================================

function startVoiceSession(
    member,
    channelId
) {
    const memberData =
        ensureMember(
            member.id,
            {
                username:
                    member.user.username,

                displayName:
                    member.displayName
            }
        );

    if (
        stats.voiceSessions[
            member.id
        ]
    ) {
        stats.voiceSessions[
            member.id
        ].channelId =
            channelId;

        return;
    }

    stats.voiceSessions[
        member.id
    ] = {
        guildId:
            member.guild.id,

        channelId,

        startedAt:
            Date.now()
    };

    memberData.lastVoiceAt =
        Date.now();

    saveStats();
}

// ======================================================
// CLOSE VOCAL
// ======================================================

function closeVoiceSession(
    memberId
) {
    const session =
        stats.voiceSessions[
            memberId
        ];

    if (
        !session ||
        !session.startedAt
    ) {
        return;
    }

    const elapsed =
        Math.max(
            0,
            Math.floor(
                (
                    Date.now() -
                    session.startedAt
                ) /
                1000
            )
        );

    const member =
        ensureMember(
            memberId
        );

    member.voiceSeconds =
        (
            member.voiceSeconds ||
            0
        ) +
        elapsed;

    member.lastVoiceAt =
        Date.now();

    delete stats.voiceSessions[
        memberId
    ];

    saveStats();
}

// ======================================================
// CHECKPOINT SESSIONS
// ======================================================

function checkpointVoiceSessions() {
    const now =
        Date.now();

    for (
        const [
            memberId,
            session
        ]
        of Object.entries(
            stats.voiceSessions
        )
    ) {
        if (
            !session.startedAt
        ) {
            continue;
        }

        const elapsed =
            Math.max(
                0,
                Math.floor(
                    (
                        now -
                        session.startedAt
                    ) /
                    1000
                )
            );

        if (
            elapsed <=
            0
        ) {
            continue;
        }

        const member =
            ensureMember(
                memberId
            );

        member.voiceSeconds =
            (
                member.voiceSeconds ||
                0
            ) +
            elapsed;

        session.startedAt =
            now;
    }

    saveStats();
}

// ======================================================
// TOTALS
// ======================================================

function getPendingMessageTotal() {
    return (
        stats.pendingLegacyMembers ||
        []
    ).reduce(
        (
            total,
            member
        ) =>
            total +
            (
                member.messages ||
                0
            ),
        0
    );
}

function getPendingVoiceSeconds() {
    return (
        stats.pendingLegacyMembers ||
        []
    ).reduce(
        (
            total,
            member
        ) =>
            total +
            (
                member.voiceSeconds ||
                0
            ),
        0
    );
}

function getGlobalMessageTotal() {
    const membersTotal =
        Object.values(
            stats.members
        ).reduce(
            (
                total,
                member
            ) =>
                total +
                (
                    member.messages ||
                    0
                ),
            0
        );

    return (
        membersTotal +
        getPendingMessageTotal()
    );
}

function getGlobalVoiceSeconds() {
    const membersTotal =
        Object.keys(
            stats.members
        ).reduce(
            (
                total,
                memberId
            ) =>
                total +
                getTotalVoiceSeconds(
                    memberId
                ),
            0
        );

    return (
        membersTotal +
        getPendingVoiceSeconds()
    );
}

// ======================================================
// CLASSEMENTS
// ======================================================

function getMessageRanking() {
    return Object
        .values(
            stats.members
        )
        .sort(
            (
                a,
                b
            ) =>
                (
                    b.messages ||
                    0
                ) -
                (
                    a.messages ||
                    0
                )
        );
}

function getVoiceRanking() {
    return Object
        .values(
            stats.members
        )
        .map(
            member => ({
                ...member,

                totalVoiceSeconds:
                    getTotalVoiceSeconds(
                        member.discordId
                    )
            })
        )
        .sort(
            (
                a,
                b
            ) =>
                b.totalVoiceSeconds -
                a.totalVoiceSeconds
        );
}

// ======================================================
// ACTIVITÉ GÉNÉRALE
// ======================================================
//
// EXACTEMENT le principe utilisé sur les anciens screens :
//
// Messages = pourcentage par rapport au meilleur
// Vocal    = pourcentage par rapport au meilleur
//
// Activité = moyenne des deux.
//
// Exemple Ak9hi :
// 100% messages + ~12% vocal / 2 ≈ 56%
//
// ======================================================

function calculateActivityRanking() {
    const members =
        Object.values(
            stats.members
        );

    if (
        members.length ===
        0
    ) {
        return [];
    }

    const maxMessages =
        Math.max(
            1,
            ...members.map(
                member =>
                    member.messages ||
                    0
            )
        );

    const maxVoice =
        Math.max(
            1,
            ...members.map(
                member =>
                    getTotalVoiceSeconds(
                        member.discordId
                    )
            )
        );

    return members
        .map(
            member => {
                const messages =
                    member.messages ||
                    0;

                const voice =
                    getTotalVoiceSeconds(
                        member.discordId
                    );

                const messageScore =
                    (
                        messages /
                        maxMessages
                    ) *
                    100;

                const voiceScore =
                    (
                        voice /
                        maxVoice
                    ) *
                    100;

                return {
                    ...member,

                    messageScore:
                        Math.round(
                            messageScore
                        ),

                    voiceScore:
                        Math.round(
                            voiceScore
                        ),

                    activity:
                        Math.round(
                            (
                                messageScore +
                                voiceScore
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
}

// ======================================================
// BARRE DE PROGRESSION
// ======================================================

function createProgressBar(
    value,
    maxValue,
    size = 14
) {
    if (
        !maxValue ||
        maxValue <=
            0
    ) {
        return "░".repeat(
            size
        );
    }

    const ratio =
        Math.max(
            0,
            Math.min(
                1,
                value /
                maxValue
            )
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
// POURCENTAGE
// ======================================================

function getPercentage(
    value,
    maximum
) {
    if (
        !maximum ||
        maximum <=
            0
    ) {
        return 0;
    }

    return Math.round(
        (
            value /
            maximum
        ) *
        100
    );
}

// ======================================================
// ICONE RANG
// ======================================================

function getRankIcon(
    rank
) {
    if (
        rank ===
        1
    ) {
        return "🥇";
    }

    if (
        rank ===
        2
    ) {
        return "🥈";
    }

    if (
        rank ===
        3
    ) {
        return "🥉";
    }

    return `\`${String(rank).padStart(2, "0")}\``;
}

// ======================================================
// VALEUR RANKING
// ======================================================

function getRankingValue(
    type,
    member
) {
    if (
        type ===
        "messages"
    ) {
        return (
            member.messages ||
            0
        );
    }

    if (
        type ===
        "voice"
    ) {
        return (
            member.totalVoiceSeconds ||
            getTotalVoiceSeconds(
                member.discordId
            )
        );
    }

    return (
        member.activity ||
        0
    );
}

// ======================================================
// FORMAT RANKING
// ======================================================

function formatRankingValue(
    type,
    value
) {
    if (
        type ===
        "messages"
    ) {
        return (
            `${Number(value).toLocaleString("fr-FR")} ` +
            (
                Number(value) > 1
                    ? "messages"
                    : "message"
            )
        );
    }

    if (
        type ===
        "voice"
    ) {
        return formatSeconds(
            value
        );
    }

    return `${value}% d'activité`;
}

// ======================================================
// TITRE DU CLASSEMENT
// ======================================================

function getRankingTitle(
    type
) {
    if (
        type ===
        "messages"
    ) {
        return "💬・Classement des messages";
    }

    if (
        type ===
        "voice"
    ) {
        return "🎙️・Classement vocal";
    }

    return "🏆・Activité générale";
}

// ======================================================
// SOUS-TITRE
// ======================================================

function getRankingSubtitle(
    type
) {
    if (
        type ===
        "messages"
    ) {
        return (
            "*Classement basé sur les messages valides " +
            "de plus de 10 caractères.*"
        );
    }

    if (
        type ===
        "voice"
    ) {
        return (
            "*Classement basé sur le temps cumulé " +
            "dans les salons vocaux.*"
        );
    }

    return (
        "*Activité calculée à parts égales entre " +
        "les messages et le temps vocal.*"
    );
}

// ======================================================
// RANKING DATA
// ======================================================

function getRankingByType(
    type
) {
    if (
        type ===
        "messages"
    ) {
        return getMessageRanking();
    }

    if (
        type ===
        "voice"
    ) {
        return getVoiceRanking();
    }

    return calculateActivityRanking();
}

// ======================================================
// CLASSEMENT PREMIUM
// ======================================================

function buildRankingEmbed(
    type,
    requestedPage,
    viewerId = null
) {
    const ranking =
        getRankingByType(
            type
        );

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                ranking.length /
                PAGE_SIZE
            )
        );

    const page =
        Math.max(
            0,
            Math.min(
                Number(
                    requestedPage
                ) ||
                0,
                totalPages -
                1
            )
        );

    const maximum =
        ranking.length
            ? getRankingValue(
                type,
                ranking[0]
            )
            : 0;

    // ==================================================
    // PODIUM
    // ==================================================

    const podiumLines =
        ranking
            .slice(
                0,
                3
            )
            .map(
                (
                    member,
                    index
                ) => {
                    const rank =
                        index +
                        1;

                    const value =
                        getRankingValue(
                            type,
                            member
                        );

                    const percent =
                        type ===
                            "activity"
                            ? value
                            : getPercentage(
                                value,
                                maximum
                            );

                    const bar =
                        createProgressBar(
                            value,
                            maximum,
                            15
                        );

                    let extra =
                        "";

                    if (
                        type ===
                        "activity"
                    ) {
                        extra =
                            `\n> 💬 ${member.messageScore}% • 🎙️ ${member.voiceScore}%`;
                    }

                    return [
                        `${getRankIcon(rank)} **<@${member.discordId}>**`,
                        `> **${formatRankingValue(type, value)}**`,
                        `> \`${bar}\` **${percent}%**${extra}`
                    ].join(
                        "\n"
                    );
                }
            );

    // ==================================================
    // PAGE
    // ==================================================

    const start =
        page *
        PAGE_SIZE;

    const pageMembers =
        ranking.slice(
            start,
            start +
            PAGE_SIZE
        );

    const pageLines =
        pageMembers
            .map(
                (
                    member,
                    index
                ) => {
                    const rank =
                        start +
                        index +
                        1;

                    // Top 3 déjà montré au-dessus
                    if (
                        rank <=
                        3
                    ) {
                        return null;
                    }

                    const value =
                        getRankingValue(
                            type,
                            member
                        );

                    if (
                        type ===
                        "activity"
                    ) {
                        return [
                            `${getRankIcon(rank)} **<@${member.discordId}>**`,
                            `> └ **${value}%** d'activité`,
                            `> └ 💬 ${member.messageScore}% • 🎙️ ${member.voiceScore}%`
                        ].join(
                            "\n"
                        );
                    }

                    return [
                        `${getRankIcon(rank)} **<@${member.discordId}>**`,
                        `> └ ${formatRankingValue(type, value)}`
                    ].join(
                        "\n"
                    );
                }
            )
            .filter(
                Boolean
            );

    // ==================================================
    // POSITION PERSONNELLE
    // ==================================================

    let viewerText =
        null;

    if (
        viewerId
    ) {
        const viewerIndex =
            ranking.findIndex(
                member =>
                    member.discordId ===
                    viewerId
            );

        if (
            viewerIndex !==
            -1
        ) {
            const viewer =
                ranking[
                    viewerIndex
                ];

            const value =
                getRankingValue(
                    type,
                    viewer
                );

            viewerText =
                [
                    "### 👤 Ta position",
                    `**#${viewerIndex + 1}** sur **${ranking.length}**`,
                    `${formatRankingValue(type, value)}`
                ].join(
                    "\n"
                );
        }
    }

    // ==================================================
    // DESCRIPTION
    // ==================================================

    const description = [
        getRankingSubtitle(
            type
        ),

        "",

        "### ✦ PODIUM",
        "",

        podiumLines.length
            ? podiumLines.join(
                "\n\n"
            )
            : "Aucune donnée.",

        pageLines.length
            ? ""
            : null,

        pageLines.length
            ? "### ✦ SUITE DU CLASSEMENT"
            : null,

        pageLines.length
            ? ""
            : null,

        pageLines.length
            ? pageLines.join(
                "\n\n"
            )
            : null,

        viewerText
            ? ""
            : null,

        viewerText
            ? "━━━━━━━━━━━━━━━━━━━━"
            : null,

        viewerText,

        "",
        `📄 **Page ${page + 1} / ${totalPages}**`
    ]
        .filter(
            value =>
                value !==
                null
        )
        .join(
            "\n"
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                0x3B6475
            )

            .setTitle(
                getRankingTitle(
                    type
                )
            )

            .setDescription(
                description
            )

            .setFooter({
                text:
                    "The Legacy • Classements"
            })

            .setTimestamp();

    return {
        embed,
        page,
        totalPages
    };
}

// ======================================================
// BOUTONS CLASSEMENT
// ======================================================

function createRankingButtons(
    type,
    page,
    totalPages
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `stats_${type}_${page - 1}`
                    )
                    .setLabel(
                        "Précédent"
                    )
                    .setEmoji(
                        "◀️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page <=
                        0
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `stats_${type}_0`
                    )
                    .setLabel(
                        "Top"
                    )
                    .setEmoji(
                        "🏠"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page ===
                        0
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `stats_${type}_${page + 1}`
                    )
                    .setLabel(
                        "Suivant"
                    )
                    .setEmoji(
                        "▶️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        page >=
                        totalPages -
                        1
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `stats_rankrefresh_${type}_${page}`
                    )
                    .setLabel(
                        "Actualiser"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// ACTUELLEMENT EN VOCAL
// ======================================================

function getCurrentlyInVoice(
    guild
) {
    return guild.members.cache.filter(
        member =>
            !member.user.bot &&
            !!member.voice.channelId
    ).size;
}

// ======================================================
// MAIN EMBED
// ======================================================

function buildMainEmbed(
    guild
) {
    const activity =
        calculateActivityRanking();

    const podium =
        activity.slice(
            0,
            3
        );

    const podiumText =
        podium.length
            ? podium.map(
                (
                    member,
                    index
                ) => {
                    const medals = [
                        "🥇",
                        "🥈",
                        "🥉"
                    ];

                    return (
                        `${medals[index]} <@${member.discordId}> ` +
                        `— **${member.activity}%**`
                    );
                }
            ).join(
                "\n"
            )
            : "Aucune statistique.";

    return new EmbedBuilder()
        .setColor(
            0x3B6475
        )

        .setTitle(
            "📊・Statistiques The Legacy"
        )

        .setDescription(
            [
                `> Suivi actif depuis <t:${Math.floor(TRACKING_STARTED_AT / 1000)}:D>`,
                "",
                "### 🎙️ Temps vocal cumulé",
                `**${formatSeconds(getGlobalVoiceSeconds())}**`,
                "",
                "### 💬 Messages comptabilisés",
                `**${getGlobalMessageTotal().toLocaleString("fr-FR")}**`,
                "",
                "### 🔴 Actuellement en vocal",
                `**${getCurrentlyInVoice(guild)} membre(s)**`,
                "",
                "━━━━━━━━━━━━━━━━━━━━",
                "",
                "### 🏆 Podium communautaire",
                podiumText,
                "",
                "-# Les statistiques sont enregistrées directement par le bot."
            ].join(
                "\n"
            )
        )

        .setFooter({
            text:
                "The Legacy • Activité Discord"
        })

        .setTimestamp();
}

// ======================================================
// BOUTONS PRINCIPAUX
// ======================================================

function createMainButtons() {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "stats_me"
                    )
                    .setLabel(
                        "Mes statistiques"
                    )
                    .setEmoji(
                        "👤"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "stats_messages_0"
                    )
                    .setLabel(
                        "Messages"
                    )
                    .setEmoji(
                        "💬"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "stats_voice_0"
                    )
                    .setLabel(
                        "Vocal"
                    )
                    .setEmoji(
                        "🎙️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "stats_activity_0"
                    )
                    .setLabel(
                        "Activité générale"
                    )
                    .setEmoji(
                        "🏆"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "stats_refresh"
                    )
                    .setLabel(
                        "Actualiser"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// POSITION
// ======================================================

function getPosition(
    ranking,
    memberId
) {
    const index =
        ranking.findIndex(
            member =>
                member.discordId ===
                memberId
        );

    return (
        index ===
        -1
            ? null
            : index +
            1
    );
}

// ======================================================
// STATS PERSONNELLES
// ======================================================

function buildPersonalEmbed(
    discordMember
) {
    const data =
        ensureMember(
            discordMember.id,
            {
                username:
                    discordMember.user.username,

                displayName:
                    discordMember.displayName
            }
        );

    const messageRanking =
        getMessageRanking();

    const voiceRanking =
        getVoiceRanking();

    const activityRanking =
        calculateActivityRanking();

    const messagePosition =
        getPosition(
            messageRanking,
            discordMember.id
        );

    const voicePosition =
        getPosition(
            voiceRanking,
            discordMember.id
        );

    const activityPosition =
        getPosition(
            activityRanking,
            discordMember.id
        );

    const activity =
        activityRanking.find(
            member =>
                member.discordId ===
                discordMember.id
        );

    const isInVoice =
        !!discordMember.voice.channelId;

    const currentSession =
        getCurrentVoiceSeconds(
            discordMember.id
        );

    return new EmbedBuilder()
        .setColor(
            0x3B6475
        )

        .setAuthor({
            name:
                discordMember.displayName,

            iconURL:
                discordMember.displayAvatarURL()
        })

        .setTitle(
            "📊・Mes statistiques"
        )

        .setDescription(
            [
                "### 💬 Messages",
                `**${(data.messages || 0).toLocaleString("fr-FR")}** messages`,
                `> Classement : **${messagePosition ? `#${messagePosition}` : "Non classé"}**`,
                "",
                "### 🎙️ Temps vocal",
                `**${formatSeconds(getTotalVoiceSeconds(discordMember.id))}**`,
                `> Classement : **${voicePosition ? `#${voicePosition}` : "Non classé"}**`,
                "",
                "### 🏆 Activité générale",
                `**${activity?.activity || 0}%**`,
                `> Classement : **${activityPosition ? `#${activityPosition}` : "Non classé"}**`,
                `> 💬 Messages : **${activity?.messageScore || 0}%**`,
                `> 🎙️ Vocal : **${activity?.voiceScore || 0}%**`,
                "",
                "### 🔊 Statut vocal",
                isInVoice
                    ? `🟢 Dans <#${discordMember.voice.channelId}>`
                    : "⚫ Pas actuellement en vocal",
                isInVoice
                    ? `> Session actuelle : **${formatSeconds(currentSession)}**`
                    : null
            ]
                .filter(
                    value =>
                        value !==
                        null
                )
                .join(
                    "\n"
                )
        )

        .setFooter({
            text:
                "The Legacy • Profil d'activité"
        })

        .setTimestamp();
}

// ======================================================
// BOUTON STATS PERSONNELLES
// ======================================================

function createPersonalButtons() {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "stats_me_refresh"
                    )
                    .setLabel(
                        "Actualiser mes statistiques"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// REFRESH PANEL
// ======================================================

async function refreshPublicPanel(
    client
) {
    if (
        !stats.panel.guildId ||
        !stats.panel.channelId ||
        !stats.panel.messageId
    ) {
        return false;
    }

    const guild =
        client.guilds.cache.get(
            stats.panel.guildId
        );

    if (
        !guild
    ) {
        return false;
    }

    const channel =
        guild.channels.cache.get(
            stats.panel.channelId
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return false;
    }

    const message =
        await channel.messages
            .fetch(
                stats.panel.messageId
            )
            .catch(
                () => null
            );

    if (
        !message
    ) {
        return false;
    }

    await message.edit({
        embeds: [
            buildMainEmbed(
                guild
            )
        ],

        components:
            createMainButtons()
    });

    return true;
}

// ======================================================
// INSTALL PANEL
// ======================================================

async function installPanel(
    interaction,
    channel
) {
    let oldMessage =
        null;

    if (
        stats.panel.guildId &&
        stats.panel.channelId &&
        stats.panel.messageId
    ) {
        const oldGuild =
            interaction.client.guilds.cache.get(
                stats.panel.guildId
            );

        const oldChannel =
            oldGuild?.channels.cache.get(
                stats.panel.channelId
            );

        oldMessage =
            oldChannel
                ? await oldChannel.messages
                    .fetch(
                        stats.panel.messageId
                    )
                    .catch(
                        () => null
                    )
                : null;
    }

    // ==================================================
    // MÊME SALON → UPDATE
    // ==================================================

    if (
        oldMessage &&
        stats.panel.channelId ===
            channel.id
    ) {
        await oldMessage.edit({
            embeds: [
                buildMainEmbed(
                    interaction.guild
                )
            ],

            components:
                createMainButtons()
        });

        return oldMessage;
    }

    // ==================================================
    // ANCIEN PANEL AILLEURS
    // ==================================================

    if (
        oldMessage
    ) {
        await oldMessage.edit({
            components:
                []
        }).catch(
            () => {}
        );
    }

    // ==================================================
    // NOUVEAU PANEL
    // ==================================================

    const message =
        await channel.send({
            embeds: [
                buildMainEmbed(
                    interaction.guild
                )
            ],

            components:
                createMainButtons()
        });

    stats.panel = {
        guildId:
            interaction.guild.id,

        channelId:
            channel.id,

        messageId:
            message.id
    };

    saveStats();

    return message;
}

// ======================================================
// SAVOIR SI LE BOUTON VIENT DU PANEL PUBLIC
// ======================================================

function isPublicPanelInteraction(
    interaction
) {
    return (
        interaction.message?.id &&
        interaction.message.id ===
            stats.panel.messageId
    );
}

// ======================================================
// OUVRIR / UPDATE UN CLASSEMENT
// ======================================================

async function respondWithRanking(
    interaction,
    type,
    page
) {
    const result =
        buildRankingEmbed(
            type,
            page,
            interaction.user.id
        );

    const payload = {
        embeds: [
            result.embed
        ],

        components:
            createRankingButtons(
                type,
                result.page,
                result.totalPages
            )
    };

    // ==================================================
    // CLIC DEPUIS LE PANEL PUBLIC
    // ==================================================

    if (
        isPublicPanelInteraction(
            interaction
        )
    ) {
        return interaction.reply({
            ...payload,

            flags:
                MessageFlags.Ephemeral
        });
    }

    // ==================================================
    // PAGINATION D'UN CLASSEMENT ÉPHÉMÈRE
    // ==================================================

    return interaction.update(
        payload
    );
}

// ======================================================
// SYSTEM
// ======================================================

function registerActivityStats(
    client
) {
    loadStats();

    client.activityStats = {
        stats,

        saveStats,

        checkpointVoiceSessions,

        installPanel,

        refreshPublicPanel
    };

    // ==================================================
    // READY
    // ==================================================

    client.once(
        Events.ClientReady,
        async () => {
            // ==========================================
            // IMPORT ANCIENNES STATS
            // ==========================================

            for (
                const guild
                of client.guilds.cache.values()
            ) {
                await migrateLegacyMembers(
                    guild
                );
            }

            // ==========================================
            // NETTOYER LES ANCIENNES SESSIONS SAUVEGARDÉES
            // ==========================================

            stats.voiceSessions =
                {};

            // ==========================================
            // RESTAURER LES GENS ACTUELLEMENT EN VOCAL
            // ==========================================

            for (
                const guild
                of client.guilds.cache.values()
            ) {
                await guild.members
                    .fetch()
                    .catch(
                        () => null
                    );

                for (
                    const member
                    of guild.members.cache.values()
                ) {
                    if (
                        member.user.bot ||
                        !member.voice.channelId
                    ) {
                        continue;
                    }

                    startVoiceSession(
                        member,
                        member.voice.channelId
                    );
                }
            }

            saveStats();

            await refreshPublicPanel(
                client
            ).catch(
                () => {}
            );

            console.log(
                "📊 Statistiques Discord : ✅ actives"
            );
        }
    );

    // ==================================================
    // MESSAGES
    // ==================================================

    client.on(
        Events.MessageCreate,
        message => {
            try {
                if (
                    !message.guild ||
                    message.author.bot
                ) {
                    return;
                }

                const content =
                    message.content
                        ?.trim() ||
                    "";

                // Plus de 10 caractères
                if (
                    content.length <=
                    MESSAGE_MIN_LENGTH
                ) {
                    return;
                }

                const member =
                    ensureMember(
                        message.author.id,
                        {
                            username:
                                message.author.username,

                            displayName:
                                message.member
                                    ?.displayName ||
                                message.author.username
                        }
                    );

                member.messages =
                    (
                        member.messages ||
                        0
                    ) +
                    1;

                member.lastMessageAt =
                    Date.now();

                saveStats();

            } catch (error) {
                console.error(
                    "❌ Stats MessageCreate :",
                    error
                );
            }
        }
    );

    // ==================================================
    // VOCAL
    // ==================================================

    client.on(
        Events.VoiceStateUpdate,
        (
            oldState,
            newState
        ) => {
            try {
                const member =
                    newState.member ||
                    oldState.member;

                if (
                    !member ||
                    member.user.bot
                ) {
                    return;
                }

                if (
                    oldState.channelId ===
                    newState.channelId
                ) {
                    return;
                }

                // ======================================
                // ARRIVÉE
                // ======================================

                if (
                    !oldState.channelId &&
                    newState.channelId
                ) {
                    startVoiceSession(
                        member,
                        newState.channelId
                    );

                    return;
                }

                // ======================================
                // DÉPART
                // ======================================

                if (
                    oldState.channelId &&
                    !newState.channelId
                ) {
                    closeVoiceSession(
                        member.id
                    );

                    return;
                }

                // ======================================
                // CHANGEMENT DE VOCAL
                // ======================================

                if (
                    oldState.channelId &&
                    newState.channelId
                ) {
                    if (
                        stats.voiceSessions[
                            member.id
                        ]
                    ) {
                        stats.voiceSessions[
                            member.id
                        ].channelId =
                            newState.channelId;

                        saveStats();
                    }

                    else {
                        startVoiceSession(
                            member,
                            newState.channelId
                        );
                    }
                }

            } catch (error) {
                console.error(
                    "❌ Stats VoiceStateUpdate :",
                    error
                );
            }
        }
    );

    // ==================================================
    // INTERACTIONS
    // ==================================================

    client.on(
        Events.InteractionCreate,
        async interaction => {
            try {
                if (
                    !interaction.isButton() ||
                    !interaction.customId
                        .startsWith(
                            "stats_"
                        )
                ) {
                    return;
                }

                // ==========================================
                // MES STATS
                // ==========================================

                if (
                    interaction.customId ===
                    "stats_me"
                ) {
                    return interaction.reply({
                        embeds: [
                            buildPersonalEmbed(
                                interaction.member
                            )
                        ],

                        components:
                            createPersonalButtons(),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==========================================
                // REFRESH MES STATS
                // ==========================================

                if (
                    interaction.customId ===
                    "stats_me_refresh"
                ) {
                    return interaction.update({
                        embeds: [
                            buildPersonalEmbed(
                                interaction.member
                            )
                        ],

                        components:
                            createPersonalButtons()
                    });
                }

                // ==========================================
                // REFRESH PANEL PUBLIC
                // ==========================================

                if (
                    interaction.customId ===
                    "stats_refresh"
                ) {
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    await refreshPublicPanel(
                        client
                    );

                    return interaction.editReply({
                        content:
                            "🔄 **Les statistiques ont été actualisées.**"
                    });
                }

                // ==========================================
                // REFRESH CLASSEMENT
                // stats_rankrefresh_messages_0
                // ==========================================

                if (
                    interaction.customId
                        .startsWith(
                            "stats_rankrefresh_"
                        )
                ) {
                    const parts =
                        interaction.customId
                            .split(
                                "_"
                            );

                    const type =
                        parts[2];

                    const page =
                        Number(
                            parts[3]
                        ) ||
                        0;

                    if (
                        ![
                            "messages",
                            "voice",
                            "activity"
                        ].includes(
                            type
                        )
                    ) {
                        return;
                    }

                    const result =
                        buildRankingEmbed(
                            type,
                            page,
                            interaction.user.id
                        );

                    return interaction.update({
                        embeds: [
                            result.embed
                        ],

                        components:
                            createRankingButtons(
                                type,
                                result.page,
                                result.totalPages
                            )
                    });
                }

                // ==========================================
                // MESSAGES / VOCAL / ACTIVITÉ
                // ==========================================

                const parts =
                    interaction.customId
                        .split(
                            "_"
                        );

                if (
                    parts.length ===
                    3 &&
                    [
                        "messages",
                        "voice",
                        "activity"
                    ].includes(
                        parts[1]
                    )
                ) {
                    const type =
                        parts[1];

                    const page =
                        Number(
                            parts[2]
                        ) ||
                        0;

                    return respondWithRanking(
                        interaction,
                        type,
                        page
                    );
                }

            } catch (error) {
                console.error(
                    "❌ Stats interaction :",
                    error
                );

                if (
                    interaction.isRepliable() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            "❌ Une erreur est survenue avec le système de statistiques.",

                        flags:
                            MessageFlags.Ephemeral
                    }).catch(
                        () => {}
                    );
                }
            }
        }
    );

    // ==================================================
    // CHECKPOINT VOCAL CHAQUE MINUTE
    // ==================================================

    setInterval(
        () => {
            checkpointVoiceSessions();
        },
        60_000
    );

    // ==================================================
    // REFRESH PANEL TOUTES LES 5 MINUTES
    // ==================================================

    setInterval(
        async () => {
            await refreshPublicPanel(
                client
            ).catch(
                () => {}
            );
        },
        5 * 60_000
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    registerActivityStats;