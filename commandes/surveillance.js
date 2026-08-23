const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
    Events
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR = 0x3B6475;
const SUCCESS_COLOR = 0x57F287;
const WARNING_COLOR = 0xFEE75C;
const ERROR_COLOR = 0xED4245;

const MAX_DURATION_HOURS = 168; // 7 jours

// ======================================================
// FILES
// ======================================================

const DATA_DIR = path.join(
    __dirname,
    "..",
    "data"
);

const SURVEILLANCE_FILE = path.join(
    DATA_DIR,
    "surveillance.json"
);

// ======================================================
// DEFAULT
// ======================================================

function createDefaultData() {
    return {
        version: 1,
        active: {},
        history: []
    };
}

// ======================================================
// FILE
// ======================================================

function ensureFile() {
    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (
        !fs.existsSync(
            SURVEILLANCE_FILE
        )
    ) {
        fs.writeFileSync(
            SURVEILLANCE_FILE,
            JSON.stringify(
                createDefaultData(),
                null,
                4
            ),
            "utf8"
        );
    }
}

// ======================================================
// LOAD
// ======================================================

function loadData() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                SURVEILLANCE_FILE,
                "utf8"
            );

        const parsed =
            raw.trim()
                ? JSON.parse(raw)
                : createDefaultData();

        if (
            !parsed.active
        ) {
            parsed.active = {};
        }

        if (
            !Array.isArray(
                parsed.history
            )
        ) {
            parsed.history = [];
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ Chargement surveillance.json :",
            error
        );

        return createDefaultData();
    }
}

// ======================================================
// SAVE
// ======================================================

function saveData(
    data
) {
    ensureFile();

    try {
        fs.writeFileSync(
            SURVEILLANCE_FILE,
            JSON.stringify(
                data,
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde surveillance.json :",
            error
        );

        return false;
    }
}

// ======================================================
// KEY
// ======================================================

function makeKey(
    guildId,
    memberId
) {
    return (
        `${guildId}:${memberId}`
    );
}

// ======================================================
// GET ACTIVE
// ======================================================

function getActiveSurveillance(
    guildId,
    memberId
) {
    const data =
        loadData();

    return (
        data.active[
            makeKey(
                guildId,
                memberId
            )
        ] ||
        null
    );
}

// ======================================================
// ADD EVENT
// ======================================================

function addSurveillanceEvent({
    guildId,
    memberId,
    type,
    description,
    data: eventData = null
}) {
    const data =
        loadData();

    const key =
        makeKey(
            guildId,
            memberId
        );

    const surveillance =
        data.active[
            key
        ];

    if (
        !surveillance
    ) {
        return false;
    }

    if (
        Date.now() >=
        surveillance.endsAt
    ) {
        return false;
    }

    surveillance.events.push({
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 7)}`,

        type,

        description,

        timestamp:
            Date.now(),

        data:
            eventData
    });

    surveillance.counters[type] =
        (
            surveillance.counters[type] ||
            0
        ) + 1;

    saveData(
        data
    );

    return true;
}

// ======================================================
// FORMAT DURATION
// ======================================================

function formatDuration(
    milliseconds
) {
    milliseconds =
        Math.max(
            0,
            milliseconds || 0
        );

    const totalMinutes =
        Math.floor(
            milliseconds /
            60_000
        );

    const days =
        Math.floor(
            totalMinutes /
            1440
        );

    const hours =
        Math.floor(
            (
                totalMinutes %
                1440
            ) /
            60
        );

    const minutes =
        totalMinutes %
        60;

    const parts = [];

    if (
        days
    ) {
        parts.push(
            `${days} j`
        );
    }

    if (
        hours
    ) {
        parts.push(
            `${hours} h`
        );
    }

    if (
        minutes ||
        !parts.length
    ) {
        parts.push(
            `${minutes} min`
        );
    }

    return parts.join(
        " "
    );
}

// ======================================================
// EVENT EMOJI
// ======================================================

function getEventEmoji(
    type
) {
    switch (
        type
    ) {
        case "voice_join":
            return "🟢";

        case "voice_leave":
            return "🔴";

        case "voice_move":
            return "🔄";

        case "nickname":
            return "👤";

        case "role_add":
            return "➕";

        case "role_remove":
            return "➖";

        case "important":
            return "⚠️";

        default:
            return "•";
    }
}

// ======================================================
// EVENT LABEL
// ======================================================

function getEventLabel(
    type
) {
    switch (
        type
    ) {
        case "voice_join":
            return "Connexion vocale";

        case "voice_leave":
            return "Déconnexion vocale";

        case "voice_move":
            return "Déplacement vocal";

        case "nickname":
            return "Pseudo";

        case "role_add":
            return "Rôle obtenu";

        case "role_remove":
            return "Rôle perdu";

        case "important":
            return "Action importante";

        default:
            return type;
    }
}

// ======================================================
// BUILD REPORT
// ======================================================

function buildReportEmbed({
    surveillance,
    member,
    completed = false,
    stopped = false
}) {
    const now =
        completed || stopped
            ? (
                surveillance.finishedAt ||
                Date.now()
            )
            : Date.now();

    const duration =
        now -
        surveillance.startedAt;

    const events =
        surveillance.events ||
        [];

    const recentEvents =
        events.slice(
            -20
        );

    const eventLines =
        recentEvents.map(
            event => {
                return (
                    `${getEventEmoji(event.type)} ` +
                    `<t:${Math.floor(event.timestamp / 1000)}:t> — ` +
                    `${event.description}`
                );
            }
        );

    const hiddenCount =
        Math.max(
            0,
            events.length -
            recentEvents.length
        );

    const counters =
        surveillance.counters ||
        {};

    let stateText =
        "🟢 Surveillance en cours";

    if (
        completed
    ) {
        stateText =
            "✅ Surveillance terminée";
    }

    if (
        stopped
    ) {
        stateText =
            "🛑 Surveillance arrêtée manuellement";
    }

    const targetDisplay =
        member
            ? `<@${member.id}>`
            : `<@${surveillance.memberId}>`;

    const embed =
        new EmbedBuilder()
            .setColor(
                completed
                    ? SUCCESS_COLOR
                    : stopped
                        ? WARNING_COLOR
                        : COLOR
            )
            .setTitle(
                "🕵️ Dossier de surveillance"
            )
            .setDescription(
`${stateText}

### 👤 Cible
${targetDisplay}

**Lancée par :** <@${surveillance.startedBy}>
**Début :** <t:${Math.floor(surveillance.startedAt / 1000)}:F>
**Fin prévue :** <t:${Math.floor(surveillance.endsAt / 1000)}:F>
**Durée observée :** ${formatDuration(duration)}

### 📊 Résumé

🎙️ **Connexions vocales :** ${counters.voice_join || 0}
🚪 **Déconnexions vocales :** ${counters.voice_leave || 0}
🔄 **Déplacements vocaux :** ${counters.voice_move || 0}

👤 **Changements de pseudo :** ${counters.nickname || 0}

➕ **Rôles obtenus :** ${counters.role_add || 0}
➖ **Rôles perdus :** ${counters.role_remove || 0}

⚠️ **Actions importantes :** ${counters.important || 0}

### 📁 Activité enregistrée

${eventLines.length
    ? eventLines.join("\n")
    : "Aucun événement enregistré."}

${hiddenCount
    ? `\n-# + ${hiddenCount} autre(s) événement(s) plus ancien(s).`
    : ""}`
            )
            .setFooter({
                text:
                    `The Legacy • Surveillance • ${events.length} événement(s)`
            })
            .setTimestamp();

    if (
        member
    ) {
        embed.setThumbnail(
            member.displayAvatarURL({
                size: 512
            })
        );
    }

    return embed;
}

// ======================================================
// START
// ======================================================

function startSurveillance({
    guild,
    member,
    moderator,
    durationHours
}) {
    const data =
        loadData();

    const key =
        makeKey(
            guild.id,
            member.id
        );

    if (
        data.active[
            key
        ]
    ) {
        return {
            success: false,
            reason:
                "Ce membre est déjà sous surveillance."
        };
    }

    const now =
        Date.now();

    data.active[
        key
    ] = {
        id:
            `${now}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        guildId:
            guild.id,

        memberId:
            member.id,

        startedBy:
            moderator.id,

        startedAt:
            now,

        endsAt:
            now +
            (
                durationHours *
                60 *
                60 *
                1000
            ),

        finishedAt:
            null,

        status:
            "active",

        events:
            [],

        counters: {
            voice_join: 0,
            voice_leave: 0,
            voice_move: 0,
            nickname: 0,
            role_add: 0,
            role_remove: 0,
            important: 0
        }
    };

    saveData(
        data
    );

    return {
        success: true,
        surveillance:
            data.active[
                key
            ]
    };
}

// ======================================================
// COMPLETE
// ======================================================

async function completeSurveillance(
    client,
    guildId,
    memberId,
    {
        stoppedBy = null
    } = {}
) {
    const data =
        loadData();

    const key =
        makeKey(
            guildId,
            memberId
        );

    const surveillance =
        data.active[
            key
        ];

    if (
        !surveillance
    ) {
        return null;
    }

    surveillance.finishedAt =
        Date.now();

    surveillance.status =
        stoppedBy
            ? "stopped"
            : "completed";

    surveillance.stoppedBy =
        stoppedBy;

    delete data.active[
        key
    ];

    data.history.push(
        surveillance
    );

    // garde max 200 anciens dossiers
    if (
        data.history.length >
        200
    ) {
        data.history =
            data.history.slice(
                -200
            );
    }

    saveData(
        data
    );

    const guild =
        client.guilds.cache.get(
            guildId
        );

    const member =
        guild
            ? (
                guild.members.cache.get(
                    memberId
                ) ||
                await guild.members
                    .fetch(
                        memberId
                    )
                    .catch(
                        () => null
                    )
            )
            : null;

    const report =
        buildReportEmbed({
            surveillance,
            member,
            completed:
                !stoppedBy,
            stopped:
                Boolean(
                    stoppedBy
                )
        });

    // ==================================================
    // MP À LA PERSONNE QUI A LANCÉ
    // ==================================================

    const moderator =
        await client.users
            .fetch(
                surveillance.startedBy
            )
            .catch(
                () => null
            );

    if (
        moderator
    ) {
        await moderator.send({
            content:
                `🕵️ Le dossier de surveillance de <@${memberId}> est terminé.`,

            embeds: [
                report
            ]
        }).catch(
            () => {}
        );
    }

    // ==================================================
    // LOG
    // ==================================================

    if (
        guild &&
        client.logs?.logSystemAll
    ) {
        await client.logs
            .logSystemAll(
                guild,
                {
                    title:
                        "🕵️ Surveillance terminée",

                    description:
`**Membre :** <@${memberId}>
**Démarrée par :** <@${surveillance.startedBy}>
**Événements :** ${surveillance.events.length}
**État :** ${stoppedBy ? "Arrêt manuel" : "Terminée automatiquement"}`,

                    color:
                        stoppedBy
                            ? WARNING_COLOR
                            : SUCCESS_COLOR
                }
            )
            .catch(
                () => {}
            );
    }

    return {
        surveillance,
        report
    };
}

// ======================================================
// LATEST REPORT
// ======================================================

function getLatestReport(
    guildId,
    memberId
) {
    const data =
        loadData();

    const active =
        data.active[
            makeKey(
                guildId,
                memberId
            )
        ];

    if (
        active
    ) {
        return {
            surveillance:
                active,

            active:
                true
        };
    }

    const history =
        data.history
            .filter(
                item =>
                    item.guildId ===
                        guildId &&
                    item.memberId ===
                        memberId
            )
            .sort(
                (a, b) =>
                    (
                        b.finishedAt ||
                        b.startedAt ||
                        0
                    ) -
                    (
                        a.finishedAt ||
                        a.startedAt ||
                        0
                    )
            );

    if (
        !history.length
    ) {
        return null;
    }

    return {
        surveillance:
            history[0],

        active:
            false
    };
}

// ======================================================
// REGISTER
// ======================================================

function registerSurveillanceSystem(
    client
) {
    if (
        client.__surveillanceRegistered
    ) {
        return;
    }

    client.__surveillanceRegistered =
        true;

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

                // rejoint
                if (
                    !oldState.channelId &&
                    newState.channelId
                ) {
                    addSurveillanceEvent({
                        guildId:
                            member.guild.id,

                        memberId:
                            member.id,

                        type:
                            "voice_join",

                        description:
                            `a rejoint <#${newState.channelId}>`,

                        data: {
                            channelId:
                                newState.channelId
                        }
                    });

                    return;
                }

                // quitte
                if (
                    oldState.channelId &&
                    !newState.channelId
                ) {
                    addSurveillanceEvent({
                        guildId:
                            member.guild.id,

                        memberId:
                            member.id,

                        type:
                            "voice_leave",

                        description:
                            `a quitté <#${oldState.channelId}>`,

                        data: {
                            channelId:
                                oldState.channelId
                        }
                    });

                    return;
                }

                // déplacement
                if (
                    oldState.channelId &&
                    newState.channelId
                ) {
                    addSurveillanceEvent({
                        guildId:
                            member.guild.id,

                        memberId:
                            member.id,

                        type:
                            "voice_move",

                        description:
                            `est passé de <#${oldState.channelId}> vers <#${newState.channelId}>`,

                        data: {
                            oldChannelId:
                                oldState.channelId,

                            newChannelId:
                                newState.channelId
                        }
                    });
                }

            } catch (error) {
                console.error(
                    "❌ Surveillance vocal :",
                    error
                );
            }
        }
    );

    // ==================================================
    // MEMBER UPDATE
    // ==================================================

    client.on(
        Events.GuildMemberUpdate,
        (
            oldMember,
            newMember
        ) => {
            try {
                if (
                    newMember.user.bot
                ) {
                    return;
                }

                // ==========================================
                // NICKNAME
                // ==========================================

                const oldName =
                    oldMember.nickname ||
                    oldMember.user.globalName ||
                    oldMember.user.username;

                const newName =
                    newMember.nickname ||
                    newMember.user.globalName ||
                    newMember.user.username;

                if (
                    oldName !==
                    newName
                ) {
                    addSurveillanceEvent({
                        guildId:
                            newMember.guild.id,

                        memberId:
                            newMember.id,

                        type:
                            "nickname",

                        description:
                            `pseudo modifié : \`${oldName}\` → \`${newName}\``,

                        data: {
                            oldName,
                            newName
                        }
                    });
                }

                // ==========================================
                // ROLES
                // ==========================================

                const oldRoles =
                    new Set(
                        oldMember.roles.cache.keys()
                    );

                const newRoles =
                    new Set(
                        newMember.roles.cache.keys()
                    );

                // ajoutés
                for (
                    const roleId
                    of newRoles
                ) {
                    if (
                        roleId ===
                        newMember.guild.id
                    ) {
                        continue;
                    }

                    if (
                        !oldRoles.has(
                            roleId
                        )
                    ) {
                        const role =
                            newMember.guild.roles.cache.get(
                                roleId
                            );

                        addSurveillanceEvent({
                            guildId:
                                newMember.guild.id,

                            memberId:
                                newMember.id,

                            type:
                                "role_add",

                            description:
                                role
                                    ? `a obtenu le rôle <@&${role.id}>`
                                    : `a obtenu le rôle \`${roleId}\``,

                            data: {
                                roleId,
                                roleName:
                                    role?.name ||
                                    null
                            }
                        });
                    }
                }

                // retirés
                for (
                    const roleId
                    of oldRoles
                ) {
                    if (
                        roleId ===
                        newMember.guild.id
                    ) {
                        continue;
                    }

                    if (
                        !newRoles.has(
                            roleId
                        )
                    ) {
                        const role =
                            oldMember.guild.roles.cache.get(
                                roleId
                            );

                        addSurveillanceEvent({
                            guildId:
                                newMember.guild.id,

                            memberId:
                                newMember.id,

                            type:
                                "role_remove",

                            description:
                                role
                                    ? `a perdu le rôle <@&${role.id}>`
                                    : `a perdu le rôle \`${roleId}\``,

                            data: {
                                roleId,
                                roleName:
                                    role?.name ||
                                    null
                            }
                        });
                    }
                }

            } catch (error) {
                console.error(
                    "❌ Surveillance membre :",
                    error
                );
            }
        }
    );

    // ==================================================
    // AUTO FIN
    // ==================================================

    setInterval(
        async () => {
            try {
                const data =
                    loadData();

                const now =
                    Date.now();

                const expired =
                    Object.values(
                        data.active
                    )
                        .filter(
                            surveillance =>
                                now >=
                                surveillance.endsAt
                        );

                for (
                    const surveillance
                    of expired
                ) {
                    await completeSurveillance(
                        client,
                        surveillance.guildId,
                        surveillance.memberId
                    ).catch(
                        error => {
                            console.error(
                                "❌ Fin surveillance :",
                                error
                            );
                        }
                    );
                }

            } catch (error) {
                console.error(
                    "❌ Surveillance timer :",
                    error
                );
            }
        },
        60_000
    );

    console.log(
        "🕵️ Système de surveillance : ✅ actif"
    );
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "surveillance"
            )
            .setDescription(
                "Gérer la surveillance d'un membre"
            )

            // ==================================================
            // START
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "start"
                        )
                        .setDescription(
                            "Placer un membre sous surveillance"
                        )

                        .addUserOption(
                            option =>
                                option
                                    .setName(
                                        "membre"
                                    )
                                    .setDescription(
                                        "Membre à surveiller"
                                    )
                                    .setRequired(
                                        true
                                    )
                        )

                        .addIntegerOption(
                            option =>
                                option
                                    .setName(
                                        "duree"
                                    )
                                    .setDescription(
                                        "Durée de surveillance en heures"
                                    )
                                    .setMinValue(
                                        1
                                    )
                                    .setMaxValue(
                                        MAX_DURATION_HOURS
                                    )
                                    .setRequired(
                                        true
                                    )
                        )
            )

            // ==================================================
            // STOP
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "stop"
                        )
                        .setDescription(
                            "Arrêter une surveillance"
                        )

                        .addUserOption(
                            option =>
                                option
                                    .setName(
                                        "membre"
                                    )
                                    .setDescription(
                                        "Membre concerné"
                                    )
                                    .setRequired(
                                        true
                                    )
                        )
            )

            // ==================================================
            // RAPPORT
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "rapport"
                        )
                        .setDescription(
                            "Voir le dernier rapport d'un membre"
                        )

                        .addUserOption(
                            option =>
                                option
                                    .setName(
                                        "membre"
                                    )
                                    .setDescription(
                                        "Membre concerné"
                                    )
                                    .setRequired(
                                        true
                                    )
                        )
            )

            // ==================================================
            // LISTE
            // ==================================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "liste"
                        )
                        .setDescription(
                            "Voir les surveillances actuellement actives"
                        )
            ),

    // ==================================================
    // EXECUTE
    // ==================================================

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            const allowed =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                );

            if (
                !allowed
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/surveillance`."
                });
            }

            const subcommand =
                interaction.options
                    .getSubcommand();

            // ==================================================
            // START
            // ==================================================

            if (
                subcommand ===
                "start"
            ) {
                const user =
                    interaction.options
                        .getUser(
                            "membre"
                        );

                const hours =
                    interaction.options
                        .getInteger(
                            "duree"
                        );

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

                if (
                    !member
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                if (
                    member.user.bot
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Impossible de placer un bot sous surveillance."
                    });
                }

                const result =
                    startSurveillance({
                        guild:
                            interaction.guild,

                        member,

                        moderator:
                            interaction.user,

                        durationHours:
                            hours
                    });

                if (
                    !result.success
                ) {
                    return interaction.editReply({
                        content:
                            `❌ ${result.reason}`
                    });
                }

                const surveillance =
                    result.surveillance;

                if (
                    interaction.client.logs
                        ?.logSystemAll
                ) {
                    await interaction.client.logs
                        .logSystemAll(
                            interaction.guild,
                            {
                                title:
                                    "🕵️ Surveillance démarrée",

                                description:
`**Cible :** <@${member.id}>
**Durée :** ${hours} heure(s)
**Par :** <@${interaction.user.id}>
**Fin :** <t:${Math.floor(surveillance.endsAt / 1000)}:F>`,

                                color:
                                    COLOR
                            }
                        )
                        .catch(
                            () => {}
                        );
                }

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLOR
                            )
                            .setTitle(
                                "🕵️ Surveillance activée"
                            )
                            .setThumbnail(
                                member.displayAvatarURL({
                                    size:
                                        512
                                })
                            )
                            .setDescription(
`<@${member.id}> est désormais placé sous surveillance.

**Durée :** ${hours} heure(s)
**Début :** <t:${Math.floor(surveillance.startedAt / 1000)}:F>
**Fin prévue :** <t:${Math.floor(surveillance.endsAt / 1000)}:F>

### Éléments surveillés

🎙️ Connexions et déplacements vocaux
👤 Changements de pseudo
🎭 Rôles obtenus et retirés
⚠️ Actions importantes enregistrées par le bot

> Le rapport final te sera envoyé automatiquement en MP.`
                            )
                            .setFooter({
                                text:
                                    "The Legacy • Surveillance"
                            })
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // STOP
            // ==================================================

            if (
                subcommand ===
                "stop"
            ) {
                const user =
                    interaction.options
                        .getUser(
                            "membre"
                        );

                const existing =
                    getActiveSurveillance(
                        interaction.guild.id,
                        user.id
                    );

                if (
                    !existing
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Ce membre n'est actuellement pas sous surveillance."
                    });
                }

                const result =
                    await completeSurveillance(
                        interaction.client,
                        interaction.guild.id,
                        user.id,
                        {
                            stoppedBy:
                                interaction.user.id
                        }
                    );

                return interaction.editReply({
                    content:
                        "🛑 Surveillance arrêtée.",

                    embeds: [
                        result.report
                    ]
                });
            }

            // ==================================================
            // RAPPORT
            // ==================================================

            if (
                subcommand ===
                "rapport"
            ) {
                const user =
                    interaction.options
                        .getUser(
                            "membre"
                        );

                const result =
                    getLatestReport(
                        interaction.guild.id,
                        user.id
                    );

                if (
                    !result
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Aucun dossier de surveillance trouvé pour ce membre."
                    });
                }

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

                return interaction.editReply({
                    embeds: [
                        buildReportEmbed({
                            surveillance:
                                result.surveillance,

                            member,

                            completed:
                                !result.active &&
                                result.surveillance.status ===
                                    "completed",

                            stopped:
                                !result.active &&
                                result.surveillance.status ===
                                    "stopped"
                        })
                    ]
                });
            }

            // ==================================================
            // LISTE
            // ==================================================

            if (
                subcommand ===
                "liste"
            ) {
                const data =
                    loadData();

                const active =
                    Object
                        .values(
                            data.active
                        )
                        .filter(
                            surveillance =>
                                surveillance.guildId ===
                                interaction.guild.id
                        )
                        .sort(
                            (a, b) =>
                                a.endsAt -
                                b.endsAt
                        );

                if (
                    !active.length
                ) {
                    return interaction.editReply({
                        content:
                            "🕵️ Aucun membre n'est actuellement sous surveillance."
                    });
                }

                const lines =
                    active.map(
                        (
                            surveillance,
                            index
                        ) =>
`**${index + 1}.** <@${surveillance.memberId}>
> Lancée par <@${surveillance.startedBy}>
> Fin <t:${Math.floor(surveillance.endsAt / 1000)}:R>
> ${surveillance.events.length} événement(s) enregistré(s)`
                    );

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLOR
                            )
                            .setTitle(
                                "🕵️ Surveillances actives"
                            )
                            .setDescription(
                                lines.join(
                                    "\n\n"
                                )
                            )
                            .setFooter({
                                text:
                                    `The Legacy • ${active.length} surveillance(s)`
                            })
                            .setTimestamp()
                    ]
                });
            }

        } catch (error) {
            console.error(
                "❌ /surveillance :",
                error
            );

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            ERROR_COLOR
                        )
                        .setTitle(
                            "❌ Surveillance"
                        )
                        .setDescription(
                            `Une erreur est survenue.\n\`${error.message}\``
                        )
                        .setTimestamp()
                ]
            }).catch(
                () => {}
            );
        }
    },

    // ==================================================
    // SYSTÈME À BRANCHER DANS INDEX.JS FINAL
    // ==================================================

    surveillanceSystem: {
        register:
            registerSurveillanceSystem,

        addEvent:
            addSurveillanceEvent,

        getActive:
            getActiveSurveillance,

        complete:
            completeSurveillance,

        getLatestReport
    }
};