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
// DONNÉES REPRISES DU SITE
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

    // ==================================================
    // ASNATE
    // ==================================================

    {
        key: "asnate",

        discordId:
            null,

        displayName:
            "ASNATE",

        aliases: [
            "ASNATE",
            "asnate",
            "snt.lgcy",
            "mini_jivoxx"
        ],

        messages:
            237,

        voiceSeconds:
            (
                (143 * 60) +
                29
            ) * 60
    },

    // ==================================================
    // ESTEBAN
    // ==================================================

    {
        key: "esteban",

        discordId:
            null,

        displayName:
            "ESTEBAN",

        aliases: [
            "ESTEBAN",
            "esteban.lgcy",
            "esteban.grv18"
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

    // ==================================================
    // SHINRA
    // ==================================================

    {
        key: "shinra",

        discordId:
            null,

        displayName:
            "SHINRA",

        aliases: [
            "SHINRA",
            "shinra.lgcy",
            "ultra._3"
        ],

        messages:
            101,

        voiceSeconds:
            (
                (83 * 60) +
                20
            ) * 60
    },

    // ==================================================
    // ZOUZOU
    // ==================================================

    {
        key: "zouzou",

        discordId:
            null,

        displayName:
            "ZOUZOU RABBIT",

        aliases: [
            "ZOUZOU RABBIT",
            "zouzou.lgcy",
            "zouzou_loul67"
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
// MEMORY
// ======================================================

let stats =
    null;

// ======================================================
// FILES
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
// DEFAULT
// ======================================================

function createDefaultStats() {
    return {
        version:
            3,

        trackingStartedAt:
            TRACKING_STARTED_AT,

        members:
            {},

        pendingLegacyMembers:
            INITIAL_MEMBERS.map(
                member => ({
                    ...member,
                    aliases: [
                        ...(member.aliases || [])
                    ]
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
// SAVE
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
// RESYNC DES PROFILS EN ATTENTE
// ======================================================

function syncPendingLegacyMembers() {
    if (
        !Array.isArray(
            stats.pendingLegacyMembers
        )
    ) {
        stats.pendingLegacyMembers =
            [];
    }

    const importedKeys =
        new Set(
            Object
                .values(
                    stats.members ||
                    {}
                )
                .map(
                    member =>
                        member.legacySourceKey
                )
                .filter(
                    Boolean
                )
        );

    const newPending =
        [];

    for (
        const source
        of INITIAL_MEMBERS
    ) {
        if (
            importedKeys.has(
                source.key
            )
        ) {
            continue;
        }

        const existing =
            stats.pendingLegacyMembers.find(
                item =>
                    item.key ===
                    source.key
            );

        newPending.push({
            ...(existing || {}),
            ...source,

            aliases: [
                ...new Set([
                    ...(existing?.aliases || []),
                    ...(source.aliases || [])
                ])
            ]
        });
    }

    stats.pendingLegacyMembers =
        newPending;

    saveStats();
}

// ======================================================
// LOAD
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
            !stats.members
        ) {
            stats.members =
                {};
        }

        if (
            !stats.voiceSessions
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

        stats.version =
            3;

        syncPendingLegacyMembers();

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
// NORMALIZE
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
// MEMBER
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
// FIND MEMBER
// ======================================================

function findGuildMemberForLegacy(
    guild,
    legacy
) {
    if (
        legacy.discordId
    ) {
        const member =
            guild.members.cache.get(
                legacy.discordId
            );

        if (
            member
        ) {
            return member;
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

    return guild.members.cache.find(
        member => {
            const names = [
                member.user.username,
                member.user.globalName,
                member.displayName,
                member.nickname
            ]
                .map(
                    normalizeName
                )
                .filter(
                    Boolean
                );

            return aliases.some(
                alias =>
                    names.includes(
                        alias
                    )
            );
        }
    );
}

// ======================================================
// MIGRATION
// ======================================================

async function migrateLegacyMembers(
    guild
) {
    syncPendingLegacyMembers();

    if (
        stats.pendingLegacyMembers.length ===
        0
    ) {
        console.log(
            "📊 Migration stats : tous les profils sont associés."
        );

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

        if (
            data.legacySourceKey ===
            legacy.key
        ) {
            continue;
        }

        data.messages =
            (
                data.messages ||
                0
            ) +
            (
                legacy.messages ||
                0
            );

        data.voiceSeconds =
            (
                data.voiceSeconds ||
                0
            ) +
            (
                legacy.voiceSeconds ||
                0
            );

        data.legacyImported =
            true;

        data.legacySourceKey =
            legacy.key;

        data.legacyImportedAt =
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
// FORMAT TIME
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
// VOICE
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

function startVoiceSession(
    member,
    channelId
) {
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

    saveStats();
}

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
// CHECKPOINT
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
// GLOBAL TOTALS
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
    return (
        Object
            .values(
                stats.members
            )
            .reduce(
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
            ) +
        getPendingMessageTotal()
    );
}

function getGlobalVoiceSeconds() {
    return (
        Object
            .keys(
                stats.members
            )
            .reduce(
                (
                    total,
                    memberId
                ) =>
                    total +
                    getTotalVoiceSeconds(
                        memberId
                    ),
                0
            ) +
        getPendingVoiceSeconds()
    );
}

// ======================================================
// RANKINGS
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
// ACTIVITY
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
                const messageScore =
                    (
                        (
                            member.messages ||
                            0
                        ) /
                        maxMessages
                    ) *
                    100;

                const voiceScore =
                    (
                        getTotalVoiceSeconds(
                            member.discordId
                        ) /
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
// PROGRESS BAR
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
// PERCENT
// ======================================================

function getPercentage(
    value,
    max
) {
    if (
        !max ||
        max <=
        0
    ) {
        return 0;
    }

    return Math.round(
        (
            value /
            max
        ) *
        100
    );
}

// ======================================================
// RANK ICON
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
// RANK VALUE
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

function formatRankingValue(
    type,
    value
) {
    if (
        type ===
        "messages"
    ) {
        return (
            `${Number(value).toLocaleString("fr-FR")} messages`
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
// RANKING EMBED
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

    const podium =
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
                            12
                        );

                    const extra =
                        type ===
                            "activity"
                            ? `\n> 💬 ${member.messageScore}% • 🎙️ ${member.voiceScore}%`
                            : "";

                    return [
                        `${getRankIcon(rank)} **<@${member.discordId}>**`,
                        `> ${formatRankingValue(type, value)}`,
                        `> \`${bar}\` **${percent}%**${extra}`
                    ].join(
                        "\n"
                    );
                }
            );

    const start =
        page *
        PAGE_SIZE;

    const pageEntries =
        ranking
            .slice(
                start,
                start +
                PAGE_SIZE
            )
            .map(
                (
                    member,
                    index
                ) => {
                    const rank =
                        start +
                        index +
                        1;

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

                    return (
                        `${getRankIcon(rank)} **<@${member.discordId}>**\n` +
                        `> └ ${formatRankingValue(type, value)}`
                    );
                }
            )
            .filter(
                Boolean
            );

    let viewer =
        null;

    if (
        viewerId
    ) {
        const index =
            ranking.findIndex(
                member =>
                    member.discordId ===
                    viewerId
            );

        if (
            index !==
            -1
        ) {
            const member =
                ranking[
                    index
                ];

            viewer =
                [
                    "### 👤 Ta position",
                    `**#${index + 1}** sur **${ranking.length}**`,
                    formatRankingValue(
                        type,
                        getRankingValue(
                            type,
                            member
                        )
                    )
                ].join(
                    "\n"
                );
        }
    }

    let title =
        "🏆・Activité générale";

    if (
        type ===
        "messages"
    ) {
        title =
            "💬・Classement des messages";
    }

    if (
        type ===
        "voice"
    ) {
        title =
            "🎙️・Classement vocal";
    }

    return {
        embed:
            new EmbedBuilder()
                .setColor(
                    0x3B6475
                )
                .setTitle(
                    title
                )
                .setDescription(
                    [
                        "### ✦ PODIUM",
                        "",
                        podium.length
                            ? podium.join(
                                "\n\n"
                            )
                            : "Aucune donnée.",
                        "",
                        pageEntries.length
                            ? "### ✦ CLASSEMENT"
                            : null,
                        pageEntries.length
                            ? pageEntries.join(
                                "\n\n"
                            )
                            : null,
                        viewer
                            ? ""
                            : null,
                        viewer
                            ? "━━━━━━━━━━━━━━━━━━━━"
                            : null,
                        viewer,
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
                        )
                )
                .setFooter({
                    text:
                        "The Legacy • Classements"
                })
                .setTimestamp(),

        page,
        totalPages
    };
}

// ======================================================
// RANK BUTTONS
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
// CURRENT VOICE
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
        activity
            .slice(
                0,
                3
            )
            .map(
                (
                    member,
                    index
                ) =>
                    `${["🥇", "🥈", "🥉"][index]} <@${member.discordId}> — **${member.activity}%**`
            )
            .join(
                "\n"
            );

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
                podium || "Aucune donnée."
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
// MAIN BUTTONS
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
// PERSONAL EMBED
// ======================================================

function buildPersonalEmbed(
    member
) {
    const data =
        ensureMember(
            member.id,
            {
                username:
                    member.user.username,

                displayName:
                    member.displayName
            }
        );

    const messageRanking =
        getMessageRanking();

    const voiceRanking =
        getVoiceRanking();

    const activityRanking =
        calculateActivityRanking();

    const messagePosition =
        messageRanking.findIndex(
            entry =>
                entry.discordId ===
                member.id
        ) +
        1;

    const voicePosition =
        voiceRanking.findIndex(
            entry =>
                entry.discordId ===
                member.id
        ) +
        1;

    const activityPosition =
        activityRanking.findIndex(
            entry =>
                entry.discordId ===
                member.id
        ) +
        1;

    const activity =
        activityRanking.find(
            entry =>
                entry.discordId ===
                member.id
        );

    return new EmbedBuilder()
        .setColor(
            0x3B6475
        )
        .setAuthor({
            name:
                member.displayName,

            iconURL:
                member.displayAvatarURL()
        })
        .setTitle(
            "📊・Mes statistiques"
        )
        .setDescription(
            [
                "### 💬 Messages",
                `**${(data.messages || 0).toLocaleString("fr-FR")}**`,
                `> Classement : **${messagePosition > 0 ? `#${messagePosition}` : "-"}**`,
                "",
                "### 🎙️ Temps vocal",
                `**${formatSeconds(getTotalVoiceSeconds(member.id))}**`,
                `> Classement : **${voicePosition > 0 ? `#${voicePosition}` : "-"}**`,
                "",
                "### 🏆 Activité générale",
                `**${activity?.activity || 0}%**`,
                `> Classement : **${activityPosition > 0 ? `#${activityPosition}` : "-"}**`,
                `> 💬 ${activity?.messageScore || 0}% • 🎙️ ${activity?.voiceScore || 0}%`,
                "",
                "### 🔊 Statut",
                member.voice.channelId
                    ? `🟢 En vocal dans <#${member.voice.channelId}>`
                    : "⚫ Hors vocal"
            ].join(
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
// PERSONAL BUTTONS
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
// REFRESH PUBLIC PANEL
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

    if (
        oldMessage &&
        oldMessage.channelId ===
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
// RESPOND RANKING
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

    if (
        interaction.message?.id ===
        stats.panel.messageId
    ) {
        return interaction.reply({
            ...payload,

            flags:
                MessageFlags.Ephemeral
        });
    }

    return interaction.update(
        payload
    );
}

// ======================================================
// REGISTER SYSTEM
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
            for (
                const guild
                of client.guilds.cache.values()
            ) {
                await migrateLegacyMembers(
                    guild
                );
            }

            stats.voiceSessions =
                {};

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
    // MESSAGE CREATE
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
                    "❌ Stats messages :",
                    error
                );
            }
        }
    );

    // ==================================================
    // VOICE STATE
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

                if (
                    oldState.channelId &&
                    !newState.channelId
                ) {
                    closeVoiceSession(
                        member.id
                    );

                    return;
                }

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

                    } else {
                        startVoiceSession(
                            member,
                            newState.channelId
                        );
                    }
                }

            } catch (error) {
                console.error(
                    "❌ Stats voice :",
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
                            "🔄 **Statistiques actualisées.**"
                    });
                }

                if (
                    interaction.customId
                        .startsWith(
                            "stats_rankrefresh_"
                        )
                ) {
                    const parts =
                        interaction.customId.split(
                            "_"
                        );

                    const type =
                        parts[2];

                    const page =
                        Number(
                            parts[3]
                        ) ||
                        0;

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

                const parts =
                    interaction.customId.split(
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
                    return respondWithRanking(
                        interaction,
                        parts[1],
                        Number(
                            parts[2]
                        ) ||
                        0
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
                            "❌ Une erreur est survenue avec les statistiques.",

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
    // CHECKPOINT
    // ==================================================

    setInterval(
        () => {
            checkpointVoiceSessions();
        },
        60_000
    );

    // ==================================================
    // AUTO REFRESH
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