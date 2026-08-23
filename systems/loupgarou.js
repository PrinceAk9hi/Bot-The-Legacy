const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    ROLES,
    ROLE_GROUPS,
    PRESETS,
    CAMPS,

    getRole,

    resolvePreset,
    validateComposition,
    createRoleState,
    buildRoleDeck,

    getActiveRoleIds,
    getActiveRules,
    getActorBorrowableRoles,

    buildPresetDescription
} = require("./loupgarouRoles");

const voice = require("./loupgarouVoice");

// ======================================================
// DATA
// ======================================================

const DATA_DIR = path.join(
    __dirname,
    "..",
    "data"
);

const DATA_FILE = path.join(
    DATA_DIR,
    "loupgarou.json"
);

// ======================================================
// CONFIG
// ======================================================

const CONFIG = {
    minPlayers: 5,
    maxPlayers: 25,

    roleTimeoutMs: 45_000,
    wolvesTimeoutMs: 60_000,

    mayorCandidateMs: 60_000,
    mayorVoteMs: 60_000,

    discussionMs: 180_000,

    voteMs: 60_000,
    secondVoteMs: 45_000,

    hunterTimeoutMs: 30_000,
    successorTimeoutMs: 30_000,
    scapegoatTimeoutMs: 45_000,

    ravenExtraVotes: 2,

    nextNightDelayMs: 5_000,

    actorMaxBorrowedRoles: 3
};

// ======================================================
// DEFAULT DATA
// ======================================================

function createDefaultData() {
    return {
        version: 4,

        games: {},

        history: []
    };
}

// ======================================================
// FILE
// ======================================================

function ensureDataFile() {
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
            DATA_FILE
        )
    ) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                createDefaultData(),
                null,
                2
            ),
            "utf8"
        );
    }
}

function loadData() {
    ensureDataFile();

    try {
        const raw =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        const parsed =
            raw.trim()
                ? JSON.parse(
                    raw
                )
                : createDefaultData();

        return {
            version: 4,

            games:
                parsed.games ||
                {},

            history:
                Array.isArray(
                    parsed.history
                )
                    ? parsed.history
                    : []
        };

    } catch (error) {
        console.error(
            "❌ Lecture loupgarou.json :",
            error
        );

        return createDefaultData();
    }
}

let data =
    loadData();

function saveData() {
    ensureDataFile();

    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde loupgarou.json :",
            error
        );

        return false;
    }
}

function saveGame(
    game
) {
    if (
        !game?.id
    ) {
        return false;
    }

    game.updatedAt =
        Date.now();

    data.games[
        game.id
    ] =
        game;

    saveData();

    return true;
}

// ======================================================
// RUNTIME
// ======================================================

const waiters =
    new Map();

const executionLocks =
    new Set();

const resumeLocks =
    new Set();

// ======================================================
// UTILS
// ======================================================

function randomItem(
    array
) {
    if (
        !Array.isArray(
            array
        ) ||
        !array.length
    ) {
        return null;
    }

    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

function shuffle(
    array
) {
    const copy = [
        ...array
    ];

    for (
        let i =
            copy.length - 1;
        i >
        0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (
                    i +
                    1
                )
            );

        [
            copy[i],
            copy[j]
        ] = [
            copy[j],
            copy[i]
        ];
    }

    return copy;
}

function sleep(
    ms
) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

function createToken() {
    return crypto
        .randomBytes(
            5
        )
        .toString(
            "hex"
        );
}

function clone(
    value
) {
    return JSON.parse(
        JSON.stringify(
            value
        )
    );
}

// ======================================================
// WAITERS
// ======================================================

function waiterKey(
    gameId,
    token
) {
    return `${gameId}:${token}`;
}

function registerWaiter(
    gameId,
    token,
    timeoutMs
) {
    return new Promise(
        resolve => {
            const key =
                waiterKey(
                    gameId,
                    token
                );

            const timer =
                setTimeout(
                    () => {
                        waiters.delete(
                            key
                        );

                        resolve({
                            timeout: true,
                            cancelled: false,
                            value: null
                        });
                    },
                    timeoutMs
                );

            waiters.set(
                key,
                {
                    gameId,
                    token,
                    timer,
                    resolve
                }
            );
        }
    );
}

function resolveWaiter(
    gameId,
    token,
    value
) {
    const key =
        waiterKey(
            gameId,
            token
        );

    const waiter =
        waiters.get(
            key
        );

    if (
        !waiter
    ) {
        return false;
    }

    clearTimeout(
        waiter.timer
    );

    waiters.delete(
        key
    );

    waiter.resolve({
        timeout: false,
        cancelled: false,
        value
    });

    return true;
}

function cancelGameWaiters(
    gameId
) {
    for (
        const [
            key,
            waiter
        ]
        of waiters.entries()
    ) {
        if (
            waiter.gameId !==
            gameId
        ) {
            continue;
        }

        clearTimeout(
            waiter.timer
        );

        waiters.delete(
            key
        );

        waiter.resolve({
            timeout: false,
            cancelled: true,
            value: null
        });
    }
}

// ======================================================
// GAME HELPERS
// ======================================================

function isRunning(
    game
) {
    return Boolean(
        game &&
        game.status ===
        "running"
    );
}

function getGame(
    gameId
) {
    return (
        data.games[
            gameId
        ] ||
        null
    );
}

function getGuildGame(
    guildId
) {
    return (
        Object.values(
            data.games
        ).find(
            game =>
                game.guildId ===
                    guildId &&
                ![
                    "finished",
                    "cancelled"
                ].includes(
                    game.status
                )
        ) ||
        null
    );
}

function getPlayer(
    game,
    userId
) {
    return (
        game?.players?.find(
            player =>
                player.userId ===
                userId
        ) ||
        null
    );
}

function getAlivePlayers(
    game
) {
    return (
        game?.players ||
        []
    ).filter(
        player =>
            player.alive ===
            true
    );
}

function getDeadPlayers(
    game
) {
    return (
        game?.players ||
        []
    ).filter(
        player =>
            player.alive ===
            false
    );
}

function getRolePlayers(
    game,
    roleId,
    {
        aliveOnly = true
    } = {}
) {
    return (
        game?.players ||
        []
    ).filter(
        player =>
            player.roleId ===
                roleId &&
            (
                !aliveOnly ||
                player.alive
            )
    );
}

function getRolePlayer(
    game,
    roleId
) {
    return (
        getRolePlayers(
            game,
            roleId
        )[0] ||
        null
    );
}

// ======================================================
// CAMPS
// ======================================================

function isWolfAligned(
    player
) {
    if (
        !player
    ) {
        return false;
    }

    if (
        player.convertedToWolf
    ) {
        return true;
    }

    if (
        player.roleId ===
            "wild_child" &&
        player.roleState
            ?.transformed
    ) {
        return true;
    }

    if (
        player.roleId ===
            "wolf_dog" &&
        player.roleState
            ?.chosenCamp ===
            CAMPS.WOLVES
    ) {
        return true;
    }

    const role =
        getRole(
            player.roleId
        );

    return (
        role?.camp ===
            CAMPS.WOLVES ||
        role?.apparentCamp ===
            CAMPS.WOLVES
    );
}

function isStandardWolfWinner(
    player
) {
    if (
        !player
    ) {
        return false;
    }

    if (
        player.roleId ===
        "white_wolf"
    ) {
        return false;
    }

    return isWolfAligned(
        player
    );
}

function getAliveWolves(
    game
) {
    return getAlivePlayers(
        game
    ).filter(
        isWolfAligned
    );
}

function getWolfVictoryMembers(
    game
) {
    return getAlivePlayers(
        game
    ).filter(
        isStandardWolfWinner
    );
}

function getEffectiveCamp(
    player
) {
    if (
        !player
    ) {
        return null;
    }

    if (
        player.roleId ===
        "white_wolf"
    ) {
        return CAMPS.SOLO;
    }

    if (
        isWolfAligned(
            player
        )
    ) {
        return CAMPS.WOLVES;
    }

    return (
        getRole(
            player.roleId
        )?.camp ||
        null
    );
}

// ======================================================
// JOURNAL
// ======================================================

function addJournal(
    game,
    text,
    {
        secret = false
    } = {}
) {
    if (
        !Array.isArray(
            game.journal
        )
    ) {
        game.journal =
            [];
    }

    game.journal.push({
        day: game.day,
        night: game.night,
        phase: game.phase,

        text,
        secret,

        timestamp:
            Date.now()
    });

    if (
        game.journal.length >
        150
    ) {
        game.journal =
            game.journal.slice(
                -150
            );
    }

    saveGame(
        game
    );
}

// ======================================================
// NIGHT STATE
// ======================================================

function createNightState(
    nightNumber
) {
    return {
        number:
            nightNumber,

        completedSteps:
            [],

        infected:
            false,

        bigBadTarget:
            null,

        whiteWolfTarget:
            null,

        resolvedDeaths:
            [],

        alphaEmpowered:
            false,

        startedAt:
            Date.now(),

        completedAt:
            null
    };
}

function nightStepDone(
    game,
    step
) {
    return Boolean(
        game.nightState &&
        game.nightState.number ===
            game.night &&
        game.nightState
            .completedSteps
            ?.includes(
                step
            )
    );
}

function markNightStep(
    game,
    step
) {
    if (
        !game.nightState ||
        game.nightState.number !==
        game.night
    ) {
        game.nightState =
            createNightState(
                game.night
            );
    }

    if (
        !game.nightState
            .completedSteps
            .includes(
                step
            )
    ) {
        game.nightState
            .completedSteps
            .push(
                step
            );
    }

    saveGame(
        game
    );
}

async function runNightStep(
    game,
    step,
    callback
) {
    if (
        !isRunning(
            game
        )
    ) {
        return null;
    }

    if (
        nightStepDone(
            game,
            step
        )
    ) {
        return null;
    }

    const result =
        await callback();

    if (
        isRunning(
            game
        )
    ) {
        markNightStep(
            game,
            step
        );
    }

    return result;
}

// ======================================================
// DAY STATE
// ======================================================

function ensureDayState(
    game
) {
    if (
        !game.dayState ||
        game.dayState.day !==
        game.day
    ) {
        game.dayState = {
            day:
                game.day,

            mayorHandled:
                false,

            mayorPhase:
                null,

            discussionCompleted:
                false,

            voteCompleted:
                false,

            executedTargetId:
                null,

            judgeHandled:
                false,

            angelResolved:
                false,

            inheritedRestrictedVoters:
                Array.isArray(
                    game.nextVoteRestrictedVoters
                )
                    ? [
                        ...game.nextVoteRestrictedVoters
                    ]
                    : null,

            restrictionConsumed:
                false
        };

        game.nextVoteRestrictedVoters =
            null;

        saveGame(
            game
        );
    }

    return game.dayState;
}

// ======================================================
// DISPLAY
// ======================================================

async function getDisplayName(
    guild,
    userId
) {
    const member =
        guild.members.cache.get(
            userId
        ) ||
        await guild.members
            .fetch(
                userId
            )
            .catch(
                () => null
            );

    return (
        member?.displayName ||
        member?.user?.username ||
        userId
    );
}

async function buildPlayerOptions(
    guild,
    players,
    {
        excludeIds = []
    } = {}
) {
    const options =
        [];

    for (
        const player
        of players
    ) {
        if (
            !player ||
            excludeIds.includes(
                player.userId
            )
        ) {
            continue;
        }

        const displayName =
            await getDisplayName(
                guild,
                player.userId
            );

        options.push({
            label:
                String(
                    displayName
                ).slice(
                    0,
                    100
                ),

            value:
                player.userId
        });
    }

    return options.slice(
        0,
        25
    );
}

// ======================================================
// PUBLIC EMBED
// ======================================================

function phaseDisplay(
    game
) {
    const phases = {
        lobby:
            "🛋️ Lobby",

        distributing:
            "🎭 Distribution",

        night:
            "🌙 Nuit",

        dawn:
            "☀️ Lever du jour",

        mayor_candidates:
            "👑 Candidatures Maire",

        mayor_vote:
            "👑 Élection du Maire",

        mayor_runoff:
            "👑 Second tour du Maire",

        discussion:
            "💬 Discussion",

        day_vote:
            "🗳️ Vote du Village",

        runoff_vote:
            "⚖️ Second tour",

        hunter:
            "🏹 Dernier tir",

        between_days:
            "🌘 Préparation de la prochaine nuit",

        finished:
            "🏆 Partie terminée",

        cancelled:
            "❌ Partie annulée"
    };

    return (
        phases[
            game.phase
        ] ||
        game.phase ||
        "Inconnue"
    );
}

function buildGameEmbed(
    game
) {
    const alive =
        getAlivePlayers(
            game
        );

    const dead =
        getDeadPlayers(
            game
        );

    const aliveText =
        alive.length
            ? alive
                .map(
                    player => {
                        const mayor =
                            game.mayorId ===
                            player.userId
                                ? " 👑"
                                : "";

                        return (
                            `🟢 <@${player.userId}>${mayor}`
                        );
                    }
                )
                .join(
                    "\n"
                )
            : "Aucun joueur vivant.";

    const deadText =
        dead.length
            ? dead
                .map(
                    player => {
                        if (
                            game.config
                                ?.hardcore &&
                            game.status !==
                                "finished"
                        ) {
                            return (
                                `⚫ <@${player.userId}> — rôle caché`
                            );
                        }

                        const role =
                            getRole(
                                player.roleId
                            );

                        return (
                            `⚫ <@${player.userId}> — ${role?.emoji || "❔"} ${role?.name || "Inconnu"}`
                        );
                    }
                )
                .join(
                    "\n"
                )
            : "Aucun mort.";

    const journal =
        (
            game.journal ||
            []
        )
            .filter(
                entry =>
                    !entry.secret
            )
            .slice(
                -7
            )
            .map(
                entry =>
                    `• ${entry.text}`
            )
            .join(
                "\n"
            ) ||
        "Aucun événement public.";

    const embed =
        new EmbedBuilder()
            .setColor(
                0x3B6475
            )
            .setTitle(
                "🐺 Loup-Garou — The Legacy"
            )
            .setDescription(
                `**Phase :** ${phaseDisplay(game)}\n` +
                `**Jour :** ${game.day}\n` +
                `**Nuit :** ${game.night}\n` +
                `**Joueurs vivants :** ${alive.length}/${game.players.length}`
            )
            .addFields(
                {
                    name:
                        `🌿 Vivants — ${alive.length}`,

                    value:
                        aliveText.slice(
                            0,
                            1024
                        )
                },

                {
                    name:
                        `💀 Morts — ${dead.length}`,

                    value:
                        deadText.slice(
                            0,
                            1024
                        )
                },

                {
                    name:
                        "📜 Journal",

                    value:
                        journal.slice(
                            0,
                            1024
                        )
                }
            )
            .setFooter({
                text:
                    `Partie ${game.id}`
            })
            .setTimestamp();

    if (
        game.mayorId
    ) {
        embed.addFields({
            name:
                "👑 Maire",

            value:
                `<@${game.mayorId}>`
        });
    }

    return embed;
}

async function updatePublicMessage(
    client,
    game
) {
    if (
        !client ||
        !game.channelId ||
        !game.messageId
    ) {
        return false;
    }

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !guild
    ) {
        return false;
    }

    const channel =
        guild.channels.cache.get(
            game.channelId
        ) ||
        await guild.channels
            .fetch(
                game.channelId
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        return false;
    }

    const message =
        await channel.messages
            .fetch(
                game.messageId
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
            buildGameEmbed(
                game
            )
        ]
    }).catch(
        () => {}
    );

    return true;
}

// ======================================================
// CREATE GAME
// ======================================================

function createGame({
    guildId,
    channelId,
    voiceChannelId,
    hostId,
    presetId = "classic"
}) {
    const id =
        Date.now()
            .toString(
                36
            ) +
        crypto
            .randomBytes(
                2
            )
            .toString(
                "hex"
            );

    const preset =
        PRESETS[
            presetId
        ] ||
        PRESETS.classic;

    const game = {
        id,

        guildId,
        channelId,
        voiceChannelId,

        messageId:
            null,

        hostId,

        status:
            "lobby",

        phase:
            "lobby",

        day:
            0,

        night:
            0,

        createdAt:
            Date.now(),

        updatedAt:
            Date.now(),

        players:
            [],

        config: {
            presetId:
                preset.id,

            mayorElection:
                preset.mayorElection !==
                false,

            anonymousVotes:
                Boolean(
                    preset.anonymousVotes
                ),

            hardcore:
                false,

            revealRolesOnDeath:
                true,

            guardSelfProtect:
                true,

            ambience:
                true,

            discreteMode:
                false,

            narrationVolume:
                1,

            soundVolume:
                0.65,

            ambienceVolume:
                0.18,

            roleTimeoutMs:
                CONFIG.roleTimeoutMs,

            discussionMs:
                CONFIG.discussionMs
        },

        roleCounts:
            {},

        customRoleCounts: {
            wolf:
                1,

            seer:
                1,

            witch:
                1,

            villager:
                2
        },

        mayorId:
            null,

        mayorElectionDone:
            false,

        mayorCandidates:
            [],

        lovers:
            [],

        wolfVictimId:
            null,

        protectedId:
            null,

        poisonVictimId:
            null,

        ravenTargetId:
            null,

        pendingRustyWolfId:
            null,

        nextVoteRestrictedVoters:
            null,

        votes:
            {},

        publicVoteToken:
            null,

        pendingActions:
            {},

        nightState:
            null,

        dayState:
            null,

        journal:
            [],

        winner:
            null,

        firstNightCompleted:
            false,

        voiceMuteBaseline:
            {},

        wolfTeamNotified:
            false
    };

    data.games[
        id
    ] =
        game;

    saveData();

    return game;
}

// ======================================================
// JOIN / LEAVE
// ======================================================

function joinGame(
    game,
    userId
) {
    if (
        game.status !==
        "lobby"
    ) {
        return {
            ok: false,

            reason:
                "La partie a déjà commencé."
        };
    }

    if (
        game.players.length >=
        CONFIG.maxPlayers
    ) {
        return {
            ok: false,

            reason:
                `La partie est limitée à ${CONFIG.maxPlayers} joueurs.`
        };
    }

    if (
        getPlayer(
            game,
            userId
        )
    ) {
        return {
            ok: false,

            reason:
                "Tu es déjà dans cette partie."
        };
    }

    game.players.push({
        userId,

        seatIndex:
            game.players.length,

        alive:
            true,

        roleId:
            null,

        roleState:
            {},

        convertedToWolf:
            false,

        canVote:
            true,

        charmed:
            false,

        deathCause:
            null,

        deathAt:
            null
    });

    saveGame(
        game
    );

    return {
        ok: true
    };
}

function leaveGame(
    game,
    userId
) {
    if (
        game.status !==
        "lobby"
    ) {
        return {
            ok: false,

            reason:
                "Impossible de quitter après le démarrage."
        };
    }

    game.players =
        game.players.filter(
            player =>
                player.userId !==
                userId
        );

    game.players.forEach(
        (
            player,
            index
        ) => {
            player.seatIndex =
                index;
        }
    );

    saveGame(
        game
    );

    return {
        ok: true
    };
}

// ======================================================
// PRESET
// ======================================================

function applyPreset(
    game,
    presetId
) {
    if (
        presetId ===
        "custom"
    ) {
        game.config.presetId =
            "custom";

        saveGame(
            game
        );

        return {
            ok: true,

            description:
                "🎛️ Mode personnalisé activé."
        };
    }

    const preset =
        PRESETS[
            presetId
        ];

    if (
        !preset
    ) {
        return {
            ok: false,

            reason:
                "Preset inconnu."
        };
    }

    game.config.presetId =
        preset.id;

    game.config.mayorElection =
        preset.mayorElection !==
        false;

    game.config.anonymousVotes =
        Boolean(
            preset.anonymousVotes
        );

    // Hardcore reste un toggle indépendant.
    game.config.hardcore =
        Boolean(
            game.config.hardcore
        );

    game.config.revealRolesOnDeath =
        !game.config.hardcore;

    saveGame(
        game
    );

    return {
        ok: true,

        description:
            buildPresetDescription(
                presetId,
                game.players.length ||
                null
            )
    };
}

// ======================================================
// COMPOSITION
// ======================================================

function resolveGameComposition(
    game
) {
    const playerCount =
        game.players.length;

    if (
        game.config.presetId ===
        "custom"
    ) {
        const roleCounts =
            clone(
                game.customRoleCounts ||
                {}
            );

        return {
            roleCounts,

            validation:
                validateComposition(
                    roleCounts,
                    playerCount
                )
        };
    }

    const resolved =
        resolvePreset(
            game.config.presetId,
            playerCount
        );

    if (
        !resolved
    ) {
        return {
            roleCounts:
                {},

            validation: {
                valid:
                    false,

                errors: [
                    "Impossible de résoudre le preset choisi."
                ],

                warnings:
                    []
            }
        };
    }

    return {
        roleCounts:
            resolved.roleCounts,

        validation:
            validateComposition(
                resolved.roleCounts,
                playerCount
            )
    };
}

// ======================================================
// VOICE VALIDATION
// ======================================================

async function validatePlayersInVoice(
    client,
    game
) {
    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !guild
    ) {
        return {
            ok: false,

            reason:
                "Serveur Discord introuvable."
        };
    }

    const missing =
        [];

    for (
        const player
        of game.players
    ) {
        const member =
            guild.members.cache.get(
                player.userId
            ) ||
            await guild.members
                .fetch(
                    player.userId
                )
                .catch(
                    () => null
                );

        if (
            !member ||
            member.voice.channelId !==
                game.voiceChannelId
        ) {
            missing.push(
                player.userId
            );
        }
    }

    if (
        missing.length
    ) {
        return {
            ok: false,

            reason:
                `Tous les joueurs doivent être dans le vocal.\n\nAbsents : ${missing.map(id => `<@${id}>`).join(", ")}`
        };
    }

    return {
        ok: true
    };
}

// ======================================================
// MUTES
// ======================================================

async function captureMuteBaseline(
    client,
    game
) {
    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !guild
    ) {
        return;
    }

    game.voiceMuteBaseline =
        {};

    for (
        const player
        of game.players
    ) {
        const member =
            guild.members.cache.get(
                player.userId
            ) ||
            await guild.members
                .fetch(
                    player.userId
                )
                .catch(
                    () => null
                );

        game.voiceMuteBaseline[
            player.userId
        ] =
            Boolean(
                member?.voice
                    ?.serverMute
            );
    }

    saveGame(
        game
    );
}

async function normalizeMutesAfterCrash(
    client,
    game
) {
    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !guild
    ) {
        return;
    }

    for (
        const player
        of game.players
    ) {
        const member =
            guild.members.cache.get(
                player.userId
            ) ||
            await guild.members
                .fetch(
                    player.userId
                )
                .catch(
                    () => null
                );

        if (
            !member ||
            member.voice.channelId !==
                game.voiceChannelId
        ) {
            continue;
        }

        const baseline =
            Boolean(
                game.voiceMuteBaseline
                    ?.[
                        player.userId
                    ]
            );

        const shouldMute =
            !player.alive ||
            [
                "night",
                "dawn",
                "hunter"
            ].includes(
                game.phase
            );

        if (
            shouldMute &&
            !member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    true,
                    "Loup-Garou • Reprise"
                )
                .catch(
                    () => {}
                );

            continue;
        }

        if (
            !shouldMute &&
            !baseline &&
            member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    false,
                    "Loup-Garou • Reprise"
                )
                .catch(
                    () => {}
                );
        }
    }
}

async function restoreGameMutes(
    client,
    game
) {
    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !guild
    ) {
        return;
    }

    await voice.restoreAllMutes(
        guild,
        game
    );

    for (
        const player
        of game.players
    ) {
        if (
            !game.voiceMuteBaseline
                ?.[
                    player.userId
                ]
        ) {
            continue;
        }

        const member =
            guild.members.cache.get(
                player.userId
            ) ||
            await guild.members
                .fetch(
                    player.userId
                )
                .catch(
                    () => null
                );

        if (
            member?.voice.channelId &&
            !member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    true,
                    "Loup-Garou • Restauration du mute précédent"
                )
                .catch(
                    () => {}
                );
        }
    }
}

// ======================================================
// PREFLIGHT DM
// ======================================================

async function preflightDMs(
    client,
    game
) {
    const failed =
        [];

    for (
        const player
        of game.players
    ) {
        const user =
            await client.users
                .fetch(
                    player.userId
                )
                .catch(
                    () => null
                );

        if (
            !user
        ) {
            failed.push(
                player.userId
            );

            continue;
        }

        const success =
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0x3B6475
                        )
                        .setTitle(
                            "🐺 Préparation du Loup-Garou"
                        )
                        .setDescription(
                            "✅ Tes messages privés fonctionnent.\n\nTon véritable rôle sera envoyé uniquement lorsque la partie démarrera."
                        )
                ]
            })
                .then(
                    () =>
                        true
                )
                .catch(
                    () =>
                        false
                );

        if (
            !success
        ) {
            failed.push(
                player.userId
            );
        }

        await sleep(
            100
        );
    }

    if (
        failed.length
    ) {
        return {
            ok: false,

            reason:
                `Impossible d'envoyer des DM à : ${failed.map(id => `<@${id}>`).join(", ")}.\n\nIls doivent autoriser les messages privés du serveur.`
        };
    }

    return {
        ok: true
    };
}

// ======================================================
// ROLE BUTTONS
// ======================================================

function roleButtons(
    game,
    player
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_info_role_${game.id}_${player.userId}`
                    )
                    .setLabel(
                        "Mon rôle"
                    )
                    .setEmoji(
                        "🎭"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_info_rules_${game.id}_${player.userId}`
                    )
                    .setLabel(
                        "Règlement"
                    )
                    .setEmoji(
                        "📖"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_info_game_${game.id}_${player.userId}`
                    )
                    .setLabel(
                        "Partie"
                    )
                    .setEmoji(
                        "📊"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

// ======================================================
// ACTOR SETUP
// ======================================================

function setupActor(
    game,
    roleCounts
) {
    const actor =
        getRolePlayer(
            game,
            "actor"
        );

    if (
        !actor
    ) {
        return;
    }

    const candidates =
        shuffle(
            getActorBorrowableRoles(
                roleCounts
            )
        );

    actor.roleState
        .borrowedRoleIds =
        candidates.slice(
            0,
            CONFIG.actorMaxBorrowedRoles
        );

    actor.roleState
        .usedRoleIds =
        [];

    saveGame(
        game
    );
}

// ======================================================
// DISTRIBUTION
// ======================================================

async function distributeRoles(
    client,
    game,
    roleCounts
) {
    const deck =
        shuffle(
            buildRoleDeck(
                roleCounts
            )
        );

    if (
        deck.length !==
        game.players.length
    ) {
        throw new Error(
            `La composition contient ${deck.length} cartes pour ${game.players.length} joueurs.`
        );
    }

    // IMPORTANT :
    // l'ordre du lobby reste inchangé.
    // Seules les cartes sont mélangées.

    for (
        let i =
            0;
        i <
        game.players.length;
        i++
    ) {
        const player =
            game.players[
                i
            ];

        const roleId =
            deck[
                i
            ];

        player.roleId =
            roleId;

        player.roleState =
            createRoleState(
                roleId
            );

        player.alive =
            true;

        player.convertedToWolf =
            false;

        player.canVote =
            true;

        player.charmed =
            false;

        player.deathCause =
            null;

        player.deathAt =
            null;

        player.seatIndex =
            i;
    }

    game.roleCounts =
        clone(
            roleCounts
        );

    setupActor(
        game,
        roleCounts
    );

    saveGame(
        game
    );

    for (
        const player
        of game.players
    ) {
        const success =
            await sendRoleDM(
                client,
                game,
                player
            );

        if (
            !success
        ) {
            throw new Error(
                `Impossible d'envoyer le rôle à <@${player.userId}>.`
            );
        }

        await sleep(
            120
        );
    }

    await sendSiblingDMs(
        client,
        game
    );

    await notifyWolfTeam(
        client,
        game
    );
}

// ======================================================
// SEND ROLE
// ======================================================

async function sendRoleDM(
    client,
    game,
    player
) {
    const user =
        await client.users
            .fetch(
                player.userId
            )
            .catch(
                () => null
            );

    const role =
        getRole(
            player.roleId
        );

    if (
        !user ||
        !role
    ) {
        return false;
    }

    try {
        await user.send({
            content:
                "🐺 **La partie commence. Garde ton rôle secret.**",

            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        `${role.emoji} ${role.name}`
                    )
                    .setDescription(
                        role.roleSummary
                    )
                    .addFields({
                        name:
                            "🏆 Ton objectif",

                        value:
                            role.objective
                    })
            ],

            components:
                roleButtons(
                    game,
                    player
                )
        });

        return true;

    } catch {
        return false;
    }
}

// ======================================================
// SIBLINGS
// ======================================================

async function sendSiblingDMs(
    client,
    game
) {
    const sisters =
        getRolePlayers(
            game,
            "two_sisters"
        );

    if (
        sisters.length ===
        2
    ) {
        for (
            const sister
            of sisters
        ) {
            const other =
                sisters.find(
                    player =>
                        player.userId !==
                        sister.userId
                );

            const user =
                await client.users
                    .fetch(
                        sister.userId
                    )
                    .catch(
                        () => null
                    );

            await user?.send(
                `👭 Ta sœur est <@${other.userId}>. Vous appartenez toutes les deux au Village.`
            ).catch(
                () => {}
            );
        }
    }

    const brothers =
        getRolePlayers(
            game,
            "three_brothers"
        );

    if (
        brothers.length ===
        3
    ) {
        for (
            const brother
            of brothers
        ) {
            const others =
                brothers
                    .filter(
                        player =>
                            player.userId !==
                            brother.userId
                    )
                    .map(
                        player =>
                            `<@${player.userId}>`
                    )
                    .join(
                        " et "
                    );

            const user =
                await client.users
                    .fetch(
                        brother.userId
                    )
                    .catch(
                        () => null
                    );

            await user?.send(
                `👨‍👨‍👦 Tes frères sont ${others}. Vous appartenez tous les trois au Village.`
            ).catch(
                () => {}
            );
        }
    }
}

// ======================================================
// WOLF TEAM
// ======================================================

async function notifyWolfTeam(
    client,
    game
) {
    const wolves =
        getAliveWolves(
            game
        );

    if (
        wolves.length <
        1
    ) {
        return;
    }

    const list =
        wolves
            .map(
                player => {
                    const role =
                        getRole(
                            player.roleId
                        );

                    return (
                        `<@${player.userId}> — ${role?.emoji || "🐺"} ${role?.name || "Allié"}`
                    );
                }
            )
            .join(
                "\n"
            );

    for (
        const wolf
        of wolves
    ) {
        const user =
            await client.users
                .fetch(
                    wolf.userId
                )
                .catch(
                    () => null
                );

        await user?.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        "🐺 La Meute"
                    )
                    .setDescription(
                        `Voici les membres actuellement connus de la Meute :\n\n${list}`
                    )
            ]
        }).catch(
            () => {}
        );
    }

    game.wolfTeamNotified =
        true;

    saveGame(
        game
    );
}

// ======================================================
// DYNAMIC ROLE INFO
// ======================================================

function buildDynamicRoleInfo(
    game,
    player
) {
    if (
        !player
    ) {
        return "Joueur introuvable.";
    }

    const role =
        getRole(
            player.roleId
        );

    if (
        !role
    ) {
        return "Rôle inconnu.";
    }

    const sections = [
        role.roleSummary
    ];

    if (
        player.roleId ===
        "witch"
    ) {
        sections.push(
            `### 🧪 Potions\n` +
            `Potion de vie : ${player.roleState.healPotion ? "✅ Disponible" : "❌ Utilisée"}\n` +
            `Potion de mort : ${player.roleState.poisonPotion ? "✅ Disponible" : "❌ Utilisée"}`
        );
    }

    if (
        player.roleId ===
        "infect_father"
    ) {
        sections.push(
            `### 🩸 Infection\n${player.roleState.infectionAvailable ? "✅ Disponible" : "❌ Déjà utilisée"}`
        );
    }

    if (
        player.roleId ===
        "alpha_wolf"
    ) {
        sections.push(
            `### 👑 Autorité Alpha\n${player.roleState.alphaPowerAvailable ? "✅ Disponible" : "❌ Déjà utilisée"}`
        );
    }

    if (
        player.roleId ===
        "fox"
    ) {
        sections.push(
            `### 🦊 Pouvoir\n${player.roleState.abilityActive ? "✅ Disponible" : "❌ Pouvoir perdu"}`
        );
    }

    if (
        player.roleId ===
        "actor"
    ) {
        const borrowed =
            (
                player.roleState
                    ?.borrowedRoleIds ||
                []
            );

        const used =
            new Set(
                player.roleState
                    ?.usedRoleIds ||
                []
            );

        const text =
            borrowed.length
                ? borrowed
                    .map(
                        roleId => {
                            const borrowedRole =
                                getRole(
                                    roleId
                                );

                            return (
                                `${used.has(roleId) ? "❌" : "✅"} ${borrowedRole?.emoji || "🎭"} ${borrowedRole?.name || roleId}`
                            );
                        }
                    )
                    .join(
                        "\n"
                    )
                : "Aucun pouvoir emprunté.";

        sections.push(
            `### 🎭 Pouvoirs empruntés\n${text}`
        );
    }

    if (
        player.roleId ===
        "wild_child"
    ) {
        sections.push(
            `### 🧒 Modèle\n${player.roleState.modelId ? `<@${player.roleState.modelId}>` : "Pas encore choisi"}`
        );
    }

    if (
        player.convertedToWolf
    ) {
        sections.push(
            "🩸 **Ton camp actuel est secrètement la Meute.**"
        );
    }

    if (
        game.lovers
            ?.includes(
                player.userId
            )
    ) {
        const partner =
            game.lovers.find(
                id =>
                    id !==
                    player.userId
            );

        sections.push(
            `💘 **Tu es Amoureux de <@${partner}>.**`
        );
    }

    if (
        game.mayorId ===
        player.userId
    ) {
        sections.push(
            "👑 **Tu es Maire du Village. Ton vote compte double.**"
        );
    }

    if (
        !player.alive
    ) {
        sections.push(
            "💀 **Tu es mort et désormais spectateur.**"
        );
    }

    return sections.join(
        "\n\n"
    );
}

// ======================================================
// PENDING ACTIONS
// ======================================================

function addPendingAction(
    game,
    token,
    value
) {
    if (
        !game.pendingActions ||
        typeof game.pendingActions !==
        "object"
    ) {
        game.pendingActions =
            {};
    }

    game.pendingActions[
        token
    ] = {
        ...value,

        token,

        createdAt:
            Date.now()
    };

    saveGame(
        game
    );
}

function removePendingAction(
    game,
    token
) {
    if (
        game.pendingActions
    ) {
        delete game.pendingActions[
            token
        ];
    }

    saveGame(
        game
    );
}

// ======================================================
// ASK SELECT
// ======================================================

async function askPlayerSelect(
    client,
    game,
    actorId,
    {
        title,
        description,
        players,
        excludeIds = [],
        minValues = 1,
        maxValues = 1,
        timeoutMs = null,
        placeholder = "Choisis un joueur"
    }
) {
    if (
        !isRunning(
            game
        )
    ) {
        return null;
    }

    const user =
        await client.users
            .fetch(
                actorId
            )
            .catch(
                () => null
            );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        !user ||
        !guild
    ) {
        return null;
    }

    const options =
        await buildPlayerOptions(
            guild,
            players,
            {
                excludeIds
            }
        );

    if (
        options.length <
        minValues
    ) {
        return null;
    }

    const token =
        createToken();

    addPendingAction(
        game,
        token,
        {
            type:
                "select",

            actorId
        }
    );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lg_action_${game.id}_${token}_${actorId}`
            )
            .setPlaceholder(
                placeholder
            )
            .setMinValues(
                minValues
            )
            .setMaxValues(
                Math.min(
                    maxValues,
                    options.length
                )
            )
            .addOptions(
                options
            );

    try {
        await user.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        title
                    )
                    .setDescription(
                        description
                    )
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        menu
                    )
            ]
        });

    } catch {
        removePendingAction(
            game,
            token
        );

        return null;
    }

    const result =
        await registerWaiter(
            game.id,
            token,
            timeoutMs ||
            game.config.roleTimeoutMs ||
            CONFIG.roleTimeoutMs
        );

    removePendingAction(
        game,
        token
    );

    if (
        result.timeout ||
        result.cancelled
    ) {
        return null;
    }

    return result.value;
}

// ======================================================
// ASK BUTTONS
// ======================================================

async function askPlayerButtons(
    client,
    game,
    actorId,
    {
        title,
        description,
        buttons,
        timeoutMs = null
    }
) {
    if (
        !isRunning(
            game
        )
    ) {
        return null;
    }

    const user =
        await client.users
            .fetch(
                actorId
            )
            .catch(
                () => null
            );

    if (
        !user
    ) {
        return null;
    }

    const token =
        createToken();

    addPendingAction(
        game,
        token,
        {
            type:
                "buttons",

            actorId
        }
    );

    const row =
        new ActionRowBuilder();

    for (
        const button
        of buttons.slice(
            0,
            5
        )
    ) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `lg_choice_${game.id}_${token}_${actorId}_${button.value}`
                )
                .setLabel(
                    button.label
                )
                .setEmoji(
                    button.emoji ||
                    undefined
                )
                .setStyle(
                    button.style ||
                    ButtonStyle.Secondary
                )
        );
    }

    try {
        await user.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        title
                    )
                    .setDescription(
                        description
                    )
            ],

            components: [
                row
            ]
        });

    } catch {
        removePendingAction(
            game,
            token
        );

        return null;
    }

    const result =
        await registerWaiter(
            game.id,
            token,
            timeoutMs ||
            game.config.roleTimeoutMs ||
            CONFIG.roleTimeoutMs
        );

    removePendingAction(
        game,
        token
    );

    if (
        result.timeout ||
        result.cancelled
    ) {
        return null;
    }

    return result.value;
}

// ======================================================
// NIGHT — CUPIDON
// ======================================================

async function runCupid(
    client,
    game
) {
    if (
        game.night !==
        1
    ) {
        return;
    }

    const cupid =
        getRolePlayer(
            game,
            "cupid"
        );

    if (
        !cupid ||
        cupid.roleState.used
    ) {
        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "cupidWake"
    );

    let choice =
        await askPlayerSelect(
            client,
            game,
            cupid.userId,
            {
                title:
                    "💘 Cupidon",

                description:
                    "Choisis les deux joueurs qui deviendront Amoureux.",

                players:
                    getAlivePlayers(
                        game
                    ),

                minValues:
                    2,

                maxValues:
                    2
            }
        );

    if (
        !Array.isArray(
            choice
        ) ||
        choice.length !==
        2
    ) {
        const available =
            shuffle(
                getAlivePlayers(
                    game
                )
            ).slice(
                0,
                2
            );

        choice =
            available.map(
                player =>
                    player.userId
            );
    }

    if (
        choice.length ===
        2
    ) {
        game.lovers = [
            choice[0],
            choice[1]
        ];

        cupid.roleState.used =
            true;

        saveGame(
            game
        );

        for (
            const loverId
            of game.lovers
        ) {
            const partner =
                game.lovers.find(
                    id =>
                        id !==
                        loverId
                );

            const user =
                await client.users
                    .fetch(
                        loverId
                    )
                    .catch(
                        () => null
                    );

            await user?.send(
                `💘 Tu es désormais **Amoureux** de <@${partner}>.\nSi l'un de vous meurt, l'autre mourra également.`
            ).catch(
                () => {}
            );
        }
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "cupidSleep"
    );
}

// ======================================================
// NIGHT — CHIEN LOUP
// ======================================================

async function runWolfDog(
    client,
    game
) {
    if (
        game.night !==
        1
    ) {
        return;
    }

    const player =
        getRolePlayer(
            game,
            "wolf_dog"
        );

    if (
        !player ||
        player.roleState
            .chosenCamp
    ) {
        return;
    }

    const choice =
        await askPlayerButtons(
            client,
            game,
            player.userId,
            {
                title:
                    "🐕 Chien-Loup",

                description:
                    "Choisis définitivement ton camp.",

                buttons: [
                    {
                        label:
                            "Village",

                        value:
                            "village",

                        emoji:
                            "🏘️",

                        style:
                            ButtonStyle.Success
                    },

                    {
                        label:
                            "Meute",

                        value:
                            "wolves",

                        emoji:
                            "🐺",

                        style:
                            ButtonStyle.Danger
                    }
                ]
            }
        );

    player.roleState
        .chosenCamp =
        choice ===
        "wolves"
            ? CAMPS.WOLVES
            : CAMPS.VILLAGE;

    if (
        player.roleState
            .chosenCamp ===
        CAMPS.WOLVES
    ) {
        player.convertedToWolf =
            true;

        saveGame(
            game
        );

        await notifyWolfTeam(
            client,
            game
        );
    }

    saveGame(
        game
    );
}

// ======================================================
// NIGHT — ENFANT SAUVAGE
// ======================================================

async function runWildChild(
    client,
    game
) {
    if (
        game.night !==
        1
    ) {
        return;
    }

    const player =
        getRolePlayer(
            game,
            "wild_child"
        );

    if (
        !player ||
        player.roleState
            .modelId
    ) {
        return;
    }

    const available =
        getAlivePlayers(
            game
        ).filter(
            target =>
                target.userId !==
                player.userId
        );

    if (
        !available.length
    ) {
        return;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            player.userId,
            {
                title:
                    "🧒 Enfant Sauvage",

                description:
                    "Choisis ton modèle.",

                players:
                    available
            }
        );

    let modelId =
        Array.isArray(
            choice
        )
            ? choice[0]
            : null;

    // Timeout => modèle aléatoire.
    if (
        !modelId
    ) {
        modelId =
            randomItem(
                available
            )?.userId ||
            null;
    }

    player.roleState.modelId =
        modelId;

    saveGame(
        game
    );

    const user =
        await client.users
            .fetch(
                player.userId
            )
            .catch(
                () => null
            );

    if (
        modelId
    ) {
        await user?.send(
            `🧒 Ton modèle est <@${modelId}>.`
        ).catch(
            () => {}
        );
    }
}

// ======================================================
// NIGHT — SALVATEUR
// ======================================================

async function runGuard(
    client,
    game,
    actorOverride = null
) {
    const guard =
        actorOverride ||
        getRolePlayer(
            game,
            "guard"
        );

    if (
        !guard
    ) {
        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "guardWake"
    );

    const excluded =
        [];

    if (
        guard.roleState
            ?.lastProtectedId
    ) {
        excluded.push(
            guard.roleState
                .lastProtectedId
        );
    }

    if (
        !game.config
            .guardSelfProtect
    ) {
        excluded.push(
            guard.userId
        );
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            guard.userId,
            {
                title:
                    actorOverride
                        ? "🎭 Acteur — Salvateur"
                        : "🛡️ Salvateur",

                description:
                    "Choisis la personne que tu protèges cette nuit.",

                players:
                    getAlivePlayers(
                        game
                    ),

                excludeIds:
                    excluded
            }
        );

    game.protectedId =
        Array.isArray(
            choice
        )
            ? choice[0] ||
                null
            : null;

    if (
        game.protectedId &&
        !actorOverride
    ) {
        guard.roleState
            .lastProtectedId =
            game.protectedId;
    }

    saveGame(
        game
    );

    await voice.narrateKeyAndWait(
        game.guildId,
        "guardSleep"
    );
}

// ======================================================
// NIGHT — VOYANTE
// ======================================================

async function runSeer(
    client,
    game,
    actorOverride = null
) {
    const seer =
        actorOverride ||
        getRolePlayer(
            game,
            "seer"
        );

    if (
        !seer
    ) {
        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "seerWake"
    );

    const choice =
        await askPlayerSelect(
            client,
            game,
            seer.userId,
            {
                title:
                    actorOverride
                        ? "🎭 Acteur — Voyante"
                        : "👁️ Voyante",

                description:
                    "Choisis le joueur dont tu veux découvrir le rôle.",

                players:
                    getAlivePlayers(
                        game
                    ),

                excludeIds: [
                    seer.userId
                ]
            }
        );

    const targetId =
        Array.isArray(
            choice
        )
            ? choice[0]
            : null;

    if (
        targetId
    ) {
        const target =
            getPlayer(
                game,
                targetId
            );

        const role =
            getRole(
                target?.roleId
            );

        const user =
            await client.users
                .fetch(
                    seer.userId
                )
                .catch(
                    () => null
                );

        let message =
            `👁️ <@${targetId}> est **${role?.emoji || "❔"} ${role?.name || "Inconnu"}**.`;

        if (
            target?.convertedToWolf &&
            role?.camp !==
                CAMPS.WOLVES
        ) {
            message +=
                "\n🩸 Une présence lupine supplémentaire semble l'entourer.";
        }

        await user?.send(
            message
        ).catch(
            () => {}
        );
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "seerSleep"
    );
}

// ======================================================
// NEIGHBOURS
// ======================================================

function livingNeighbours(
    game,
    targetId
) {
    const alive =
        getAlivePlayers(
            game
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.seatIndex -
                    b.seatIndex
            );

    const index =
        alive.findIndex(
            player =>
                player.userId ===
                targetId
        );

    if (
        index ===
        -1
    ) {
        return [];
    }

    if (
        alive.length ===
        1
    ) {
        return [
            alive[0]
        ];
    }

    return [
        alive[
            (
                index -
                1 +
                alive.length
            ) %
            alive.length
        ],

        alive[
            index
        ],

        alive[
            (
                index +
                1
            ) %
            alive.length
        ]
    ];
}

// ======================================================
// NIGHT — RENARD
// ======================================================

async function runFox(
    client,
    game,
    actorOverride = null
) {
    const fox =
        actorOverride ||
        getRolePlayer(
            game,
            "fox"
        );

    if (
        !fox
    ) {
        return;
    }

    if (
        !actorOverride &&
        !fox.roleState
            .abilityActive
    ) {
        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "foxWake"
    );

    const choice =
        await askPlayerSelect(
            client,
            game,
            fox.userId,
            {
                title:
                    actorOverride
                        ? "🎭 Acteur — Renard"
                        : "🦊 Renard",

                description:
                    "Choisis le joueur central de ton inspection.",

                players:
                    getAlivePlayers(
                        game
                    ),

                excludeIds: [
                    fox.userId
                ]
            }
        );

    const targetId =
        Array.isArray(
            choice
        )
            ? choice[0]
            : null;

    if (
        targetId
    ) {
        const inspected =
            livingNeighbours(
                game,
                targetId
            );

        const wolfPresent =
            inspected.some(
                isWolfAligned
            );

        const user =
            await client.users
                .fetch(
                    fox.userId
                )
                .catch(
                    () => null
                );

        if (
            wolfPresent
        ) {
            await user?.send(
                "🦊 Au moins un membre de la Meute se trouve dans le groupe inspecté."
            ).catch(
                () => {}
            );

        } else {
            if (
                !actorOverride
            ) {
                fox.roleState
                    .abilityActive =
                    false;

                saveGame(
                    game
                );
            }

            await user?.send(
                actorOverride
                    ? "🦊 Aucun Loup détecté dans ce groupe."
                    : "🦊 Aucun Loup détecté. Ton pouvoir est désormais perdu."
            ).catch(
                () => {}
            );
        }
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "foxSleep"
    );
}

// ======================================================
// NIGHT — CORBEAU
// ======================================================

async function runRaven(
    client,
    game,
    actorOverride = null
) {
    const raven =
        actorOverride ||
        getRolePlayer(
            game,
            "raven"
        );

    if (
        !raven
    ) {
        return;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            raven.userId,
            {
                title:
                    actorOverride
                        ? "🎭 Acteur — Corbeau"
                        : "🦅 Corbeau",

                description:
                    `Choisis la personne qui recevra ${CONFIG.ravenExtraVotes} voix supplémentaires au prochain vote.`,

                players:
                    getAlivePlayers(
                        game
                    ),

                excludeIds: [
                    raven.userId
                ]
            }
        );

    const target =
        Array.isArray(
            choice
        )
            ? choice[0] ||
                null
            : null;

    if (
        target
    ) {
        game.ravenTargetId =
            target;

        saveGame(
            game
        );
    }
}

// ======================================================
// ACTEUR
// ======================================================

async function runActor(
    client,
    game
) {
    const actor =
        getRolePlayer(
            game,
            "actor"
        );

    if (
        !actor
    ) {
        return;
    }

    const borrowed =
        actor.roleState
            ?.borrowedRoleIds ||
        [];

    const used =
        new Set(
            actor.roleState
                ?.usedRoleIds ||
            []
        );

    const available =
        borrowed.filter(
            roleId =>
                !used.has(
                    roleId
                )
        );

    if (
        !available.length
    ) {
        return;
    }

    const buttons =
        available
            .map(
                roleId => {
                    const role =
                        getRole(
                            roleId
                        );

                    return {
                        label:
                            role?.name ||
                            roleId,

                        value:
                            roleId,

                        emoji:
                            role?.emoji ||
                            "🎭",

                        style:
                            ButtonStyle.Primary
                    };
                }
            )
            .slice(
                0,
                4
            );

    buttons.push({
        label:
            "Passer",

        value:
            "pass",

        emoji:
            "🌙",

        style:
            ButtonStyle.Secondary
    });

    const choice =
        await askPlayerButtons(
            client,
            game,
            actor.userId,
            {
                title:
                    "🎭 Acteur",

                description:
                    "Choisis le pouvoir emprunté que tu veux utiliser cette nuit.",

                buttons
            }
        );

    if (
        !choice ||
        choice ===
            "pass" ||
        !available.includes(
            choice
        )
    ) {
        return;
    }

    actor.roleState
        .usedRoleIds
        .push(
            choice
        );

    saveGame(
        game
    );

    switch (
        choice
    ) {
        case "seer":
            await runSeer(
                client,
                game,
                actor
            );
            break;

        case "guard":
            await runGuard(
                client,
                game,
                actor
            );
            break;

        case "fox":
            await runFox(
                client,
                game,
                actor
            );
            break;

        case "raven":
            await runRaven(
                client,
                game,
                actor
            );
            break;

        default:
            break;
    }
}

// ======================================================
// ALPHA POWER
// ======================================================

async function askAlphaPower(
    client,
    game
) {
    const alpha =
        getRolePlayer(
            game,
            "alpha_wolf"
        );

    if (
        !alpha ||
        !alpha.roleState
            .alphaPowerAvailable
    ) {
        return false;
    }

    const choice =
        await askPlayerButtons(
            client,
            game,
            alpha.userId,
            {
                title:
                    "👑 Autorité du Loup Alpha",

                description:
                    "Veux-tu utiliser ton pouvoir cette nuit ?\n\nTon vote de Meute comptera **double**.",

                buttons: [
                    {
                        label:
                            "Utiliser",

                        value:
                            "use",

                        emoji:
                            "👑",

                        style:
                            ButtonStyle.Danger
                    },

                    {
                        label:
                            "Conserver",

                        value:
                            "pass",

                        emoji:
                            "❌",

                        style:
                            ButtonStyle.Secondary
                    }
                ]
            }
        );

    if (
        choice !==
        "use"
    ) {
        return false;
    }

    alpha.roleState
        .alphaPowerAvailable =
        false;

    game.nightState
        .alphaEmpowered =
        true;

    saveGame(
        game
    );

    return true;
}

// ======================================================
// WOLF VOTE
// ======================================================

async function runWolfVote(
    client,
    game
) {
    const wolves =
        getAliveWolves(
            game
        );

    const targets =
        getAlivePlayers(
            game
        ).filter(
            player =>
                !isWolfAligned(
                    player
                )
        );

    if (
        !wolves.length ||
        !targets.length
    ) {
        game.wolfVictimId =
            null;

        saveGame(
            game
        );

        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "wolvesWake"
    );

    await askAlphaPower(
        client,
        game
    );

    const alpha =
        getRolePlayer(
            game,
            "alpha_wolf"
        );

    const results =
        await Promise.all(
            wolves.map(
                wolf =>
                    askPlayerSelect(
                        client,
                        game,
                        wolf.userId,
                        {
                            title:
                                "🐺 Vote de la Meute",

                            description:
                                "Choisis la victime de la Meute.",

                            players:
                                targets,

                            timeoutMs:
                                CONFIG.wolvesTimeoutMs
                        }
                    ).then(
                        choice => ({
                            wolf,
                            choice
                        })
                    )
            )
        );

    const counts =
        {};

    for (
        const result
        of results
    ) {
        const targetId =
            Array.isArray(
                result.choice
            )
                ? result.choice[0]
                : null;

        if (
            !targetId
        ) {
            continue;
        }

        let weight =
            1;

        if (
            game.nightState
                ?.alphaEmpowered &&
            alpha &&
            result.wolf.userId ===
                alpha.userId
        ) {
            weight =
                2;
        }

        counts[
            targetId
        ] =
            (
                counts[
                    targetId
                ] ||
                0
            ) +
            weight;
    }

    const sorted =
        Object.entries(
            counts
        ).sort(
            (
                a,
                b
            ) =>
                b[1] -
                a[1]
        );

    // Aucun Loup n'a voté = aucune victime.
    if (
        !sorted.length
    ) {
        game.wolfVictimId =
            null;

        saveGame(
            game
        );

        await voice.narrateKeyAndWait(
            game.guildId,
            "wolvesSleep"
        );

        return;
    }

    const max =
        sorted[
            0
        ][
            1
        ];

    const leaders =
        sorted
            .filter(
                entry =>
                    entry[1] ===
                    max
            )
            .map(
                entry =>
                    entry[0]
            );

    if (
        leaders.length ===
        1
    ) {
        game.wolfVictimId =
            leaders[0];

    } else {
        const alphaResult =
            alpha
                ? results.find(
                    result =>
                        result.wolf.userId ===
                        alpha.userId
                )
                : null;

        const alphaChoice =
            Array.isArray(
                alphaResult?.choice
            )
                ? alphaResult.choice[0]
                : null;

        // IMPORTANT :
        // l'Alpha ne départage que la nuit où son pouvoir
        // a réellement été activé.
        if (
            game.nightState
                ?.alphaEmpowered &&
            alphaChoice &&
            leaders.includes(
                alphaChoice
            )
        ) {
            game.wolfVictimId =
                alphaChoice;

        } else {
            game.wolfVictimId =
                randomItem(
                    leaders
                );
        }
    }

    saveGame(
        game
    );

    await voice.narrateKeyAndWait(
        game.guildId,
        "wolvesSleep"
    );
}

// ======================================================
// LITTLE GIRL
// ======================================================

async function runLittleGirl(
    client,
    game
) {
    const girl =
        getRolePlayer(
            game,
            "little_girl"
        );

    if (
        !girl
    ) {
        return;
    }

    const choice =
        await askPlayerButtons(
            client,
            game,
            girl.userId,
            {
                title:
                    "👧 Petite Fille",

                description:
                    "Veux-tu tenter d'espionner la Meute ?",

                timeoutMs:
                    20_000,

                buttons: [
                    {
                        label:
                            "Espionner",

                        value:
                            "spy",

                        emoji:
                            "👀",

                        style:
                            ButtonStyle.Danger
                    },

                    {
                        label:
                            "Rester cachée",

                        value:
                            "pass",

                        emoji:
                            "🙈",

                        style:
                            ButtonStyle.Secondary
                    }
                ]
            }
        );

    if (
        choice !==
        "spy"
    ) {
        return;
    }

    const wolves =
        getAliveWolves(
            game
        ).filter(
            player =>
                player.userId !==
                girl.userId
        );

    const user =
        await client.users
            .fetch(
                girl.userId
            )
            .catch(
                () => null
            );

    const roll =
        Math.random();

    if (
        roll <
            0.6 &&
        wolves.length
    ) {
        girl.roleState
            .successfulSpies =
            (
                girl.roleState
                    .successfulSpies ||
                0
            ) +
            1;

        const wolf =
            randomItem(
                wolves
            );

        await user?.send(
            `👀 Tu as aperçu <@${wolf.userId}> parmi la Meute.`
        ).catch(
            () => {}
        );

    } else if (
        roll <
        0.88
    ) {
        await user?.send(
            "🌫️ Tu n'as rien réussi à distinguer."
        ).catch(
            () => {}
        );

    } else {
        girl.roleState
            .failedSpies =
            (
                girl.roleState
                    .failedSpies ||
                0
            ) +
            1;

        await user?.send(
            "⚠️ Tu as fait trop de bruit. La Meute sait qu'elle a été observée."
        ).catch(
            () => {}
        );

        for (
            const wolf
            of wolves
        ) {
            const wolfUser =
                await client.users
                    .fetch(
                        wolf.userId
                    )
                    .catch(
                        () => null
                    );

            await wolfUser?.send(
                "👀 Quelqu'un semble avoir espionné la Meute."
            ).catch(
                () => {}
            );
        }
    }

    saveGame(
        game
    );
}

// ======================================================
// INFECTION — UNIQUEMENT INFECT PÈRE
// ======================================================

async function runInfection(
    client,
    game
) {
    if (
        !game.wolfVictimId
    ) {
        return false;
    }

    const father =
        getRolePlayer(
            game,
            "infect_father"
        );

    if (
        !father ||
        !father.roleState
            .infectionAvailable
    ) {
        return false;
    }

    const choice =
        await askPlayerButtons(
            client,
            game,
            father.userId,
            {
                title:
                    "🩸 Infect Père des Loups",

                description:
                    "Veux-tu infecter la victime de la Meute au lieu de la tuer ?",

                buttons: [
                    {
                        label:
                            "Infecter",

                        value:
                            "infect",

                        emoji:
                            "🩸",

                        style:
                            ButtonStyle.Danger
                    },

                    {
                        label:
                            "Conserver",

                        value:
                            "pass",

                        emoji:
                            "❌",

                        style:
                            ButtonStyle.Secondary
                    }
                ]
            }
        );

    if (
        choice !==
        "infect"
    ) {
        return false;
    }

    const target =
        getPlayer(
            game,
            game.wolfVictimId
        );

    if (
        !target ||
        !target.alive ||
        isWolfAligned(
            target
        )
    ) {
        return false;
    }

    target.convertedToWolf =
        true;

    father.roleState
        .infectionAvailable =
        false;

    saveGame(
        game
    );

    const targetUser =
        await client.users
            .fetch(
                target.userId
            )
            .catch(
                () => null
            );

    await targetUser?.send(
        "🩸 Tu as été infecté. Tu conserves ton rôle et tes pouvoirs, mais ton camp secret est désormais la Meute."
    ).catch(
        () => {}
    );

    await notifyWolfTeam(
        client,
        game
    );

    return true;
}

// ======================================================
// BIG BAD WOLF
// ======================================================

function hasWolfAlreadyDied(
    game
) {
    return game.players.some(
        player =>
            !player.alive &&
            isWolfAligned(
                player
            )
    );
}

async function runBigBadWolf(
    client,
    game
) {
    const wolf =
        getRolePlayer(
            game,
            "big_bad_wolf"
        );

    if (
        !wolf ||
        !wolf.roleState
            .extraKillActive
    ) {
        return null;
    }

    if (
        hasWolfAlreadyDied(
            game
        )
    ) {
        wolf.roleState
            .extraKillActive =
            false;

        saveGame(
            game
        );

        return null;
    }

    const targets =
        getAlivePlayers(
            game
        ).filter(
            player =>
                !isWolfAligned(
                    player
                ) &&
                player.userId !==
                    game.wolfVictimId
        );

    if (
        !targets.length
    ) {
        return null;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            wolf.userId,
            {
                title:
                    "🐺 Grand Méchant Loup",

                description:
                    "Choisis ta seconde victime.",

                players:
                    targets
            }
        );

    return (
        Array.isArray(
            choice
        )
            ? choice[0] ||
                null
            : null
    );
}

// ======================================================
// WHITE WOLF
// ======================================================

async function runWhiteWolf(
    client,
    game
) {
    const wolf =
        getRolePlayer(
            game,
            "white_wolf"
        );

    if (
        !wolf ||
        game.night %
            2 !==
            0
    ) {
        return null;
    }

    const targets =
        getAliveWolves(
            game
        ).filter(
            player =>
                player.userId !==
                wolf.userId
        );

    if (
        !targets.length
    ) {
        return null;
    }

    const action =
        await askPlayerButtons(
            client,
            game,
            wolf.userId,
            {
                title:
                    "🐺 Loup Blanc",

                description:
                    "Veux-tu éliminer secrètement un membre de la Meute cette nuit ?",

                buttons: [
                    {
                        label:
                            "Tuer",

                        value:
                            "kill",

                        emoji:
                            "🐺",

                        style:
                            ButtonStyle.Danger
                    },

                    {
                        label:
                            "Passer",

                        value:
                            "pass",

                        emoji:
                            "🌙",

                        style:
                            ButtonStyle.Secondary
                    }
                ]
            }
        );

    if (
        action !==
        "kill"
    ) {
        return null;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            wolf.userId,
            {
                title:
                    "🐺 Loup Blanc",

                description:
                    "Choisis ta cible.",

                players:
                    targets
            }
        );

    return (
        Array.isArray(
            choice
        )
            ? choice[0] ||
                null
            : null
    );
}

// ======================================================
// WITCH
// ======================================================

async function runWitch(
    client,
    game
) {
    const witch =
        getRolePlayer(
            game,
            "witch"
        );

    if (
        !witch
    ) {
        return;
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "witchWake"
    );

    // IMPORTANT :
    // si l'Infect Père a déjà infecté la victime,
    // elle n'est plus considérée comme une personne
    // que la Sorcière doit sauver.
    if (
        witch.roleState
            .healPotion &&
        game.wolfVictimId &&
        !game.nightState
            ?.infected
    ) {
        const heal =
            await askPlayerButtons(
                client,
                game,
                witch.userId,
                {
                    title:
                        "🧙 Potion de vie",

                    description:
                        `La victime principale de la Meute est <@${game.wolfVictimId}>.\n\nVeux-tu la sauver ?`,

                    buttons: [
                        {
                            label:
                                "Sauver",

                            value:
                                "heal",

                            emoji:
                                "🧪",

                            style:
                                ButtonStyle.Success
                        },

                        {
                            label:
                                "Conserver",

                            value:
                                "pass",

                            emoji:
                                "❌",

                            style:
                                ButtonStyle.Secondary
                        }
                    ]
                }
            );

        if (
            heal ===
            "heal"
        ) {
            witch.roleState
                .healPotion =
                false;

            game.wolfVictimId =
                null;

            saveGame(
                game
            );
        }
    }

    if (
        witch.roleState
            .poisonPotion
    ) {
        const poison =
            await askPlayerButtons(
                client,
                game,
                witch.userId,
                {
                    title:
                        "☠️ Potion de mort",

                    description:
                        "Veux-tu utiliser ta potion de mort ?",

                    buttons: [
                        {
                            label:
                                "Empoisonner",

                            value:
                                "poison",

                            emoji:
                                "☠️",

                            style:
                                ButtonStyle.Danger
                        },

                        {
                            label:
                                "Conserver",

                            value:
                                "pass",

                            emoji:
                                "❌",

                            style:
                                ButtonStyle.Secondary
                        }
                    ]
                }
            );

        if (
            poison ===
            "poison"
        ) {
            const choice =
                await askPlayerSelect(
                    client,
                    game,
                    witch.userId,
                    {
                        title:
                            "☠️ Potion de mort",

                        description:
                            "Choisis le joueur à empoisonner.",

                        players:
                            getAlivePlayers(
                                game
                            )
                    }
                );

            const targetId =
                Array.isArray(
                    choice
                )
                    ? choice[0]
                    : null;

            if (
                targetId
            ) {
                game.poisonVictimId =
                    targetId;

                witch.roleState
                    .poisonPotion =
                    false;

                saveGame(
                    game
                );
            }
        }
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "witchSleep"
    );
}

// ======================================================
// FLUTE
// ======================================================

async function runFlutePlayer(
    client,
    game
) {
    const flute =
        getRolePlayer(
            game,
            "flute_player"
        );

    if (
        !flute
    ) {
        return;
    }

    const available =
        getAlivePlayers(
            game
        ).filter(
            player =>
                player.userId !==
                    flute.userId &&
                !player.charmed
        );

    if (
        !available.length
    ) {
        return;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            flute.userId,
            {
                title:
                    "🎶 Joueur de Flûte",

                description:
                    "Choisis jusqu'à deux joueurs à charmer.",

                players:
                    available,

                minValues:
                    1,

                maxValues:
                    Math.min(
                        2,
                        available.length
                    )
            }
        );

    if (
        !Array.isArray(
            choice
        )
    ) {
        return;
    }

    for (
        const id
        of choice
    ) {
        const target =
            getPlayer(
                game,
                id
            );

        if (
            !target
        ) {
            continue;
        }

        target.charmed =
            true;

        const targetUser =
            await client.users
                .fetch(
                    target.userId
                )
                .catch(
                    () => null
                );

        await targetUser?.send(
            "🎶 Une étrange mélodie t'a charmé cette nuit."
        ).catch(
            () => {}
        );
    }

    flute.roleState
        .charmedIds =
        game.players
            .filter(
                player =>
                    player.charmed
            )
            .map(
                player =>
                    player.userId
            );

    saveGame(
        game
    );
}

// ======================================================
// WILD CHILD TRANSFORMATION
// ======================================================

async function checkWildChild(
    client,
    game
) {
    const child =
        game.players.find(
            player =>
                player.alive &&
                player.roleId ===
                    "wild_child"
        );

    if (
        !child ||
        child.roleState
            ?.transformed ||
        !child.roleState
            ?.modelId
    ) {
        return;
    }

    const model =
        getPlayer(
            game,
            child.roleState
                .modelId
        );

    if (
        model?.alive
    ) {
        return;
    }

    child.roleState
        .transformed =
        true;

    child.convertedToWolf =
        true;

    saveGame(
        game
    );

    const user =
        await client.users
            .fetch(
                child.userId
            )
            .catch(
                () => null
            );

    await user?.send(
        "🐺 Ton modèle est mort. Tu rejoins désormais secrètement la Meute."
    ).catch(
        () => {}
    );

    await notifyWolfTeam(
        client,
        game
    );
}

// ======================================================
// RUSTY SWORD
// ======================================================

function findNextWolfInOrder(
    game,
    knightId
) {
    const ordered = [
        ...game.players
    ].sort(
        (
            a,
            b
        ) =>
            a.seatIndex -
            b.seatIndex
    );

    const index =
        ordered.findIndex(
            player =>
                player.userId ===
                knightId
        );

    if (
        index ===
        -1
    ) {
        return null;
    }

    for (
        let offset =
            1;
        offset <
        ordered.length;
        offset++
    ) {
        const player =
            ordered[
                (
                    index +
                    offset
                ) %
                ordered.length
            ];

        if (
            player.alive &&
            isWolfAligned(
                player
            )
        ) {
            return player.userId;
        }
    }

    return null;
}

// ======================================================
// MAYOR SUCCESSOR
// ======================================================

async function chooseMayorSuccessor(
    client,
    game,
    deadMayorId
) {
    const candidates =
        getAlivePlayers(
            game
        );

    if (
        !candidates.length
    ) {
        game.mayorId =
            null;

        saveGame(
            game
        );

        return;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            deadMayorId,
            {
                title:
                    "👑 Succession du Maire",

                description:
                    "Choisis secrètement ton successeur.",

                players:
                    candidates,

                timeoutMs:
                    CONFIG.successorTimeoutMs
            }
        );

    let successorId =
        Array.isArray(
            choice
        )
            ? choice[0]
            : null;

    if (
        !successorId
    ) {
        successorId =
            randomItem(
                candidates
            )?.userId ||
            null;
    }

    game.mayorId =
        successorId;

    saveGame(
        game
    );

    if (
        successorId
    ) {
        addJournal(
            game,
            `👑 <@${successorId}> devient le nouveau Maire.`
        );
    }
}

// ======================================================
// HUNTER
// ======================================================

async function runHunterDeath(
    client,
    game,
    hunter
) {
    hunter.roleState
        .shotUsed =
        true;

    const previousPhase =
        game.phase;

    game.phase =
        "hunter";

    saveGame(
        game
    );

    const choice =
        await askPlayerSelect(
            client,
            game,
            hunter.userId,
            {
                title:
                    "🏹 Dernier tir",

                description:
                    "Choisis le joueur que tu souhaites emporter avec toi.",

                players:
                    getAlivePlayers(
                        game
                    ),

                timeoutMs:
                    CONFIG.hunterTimeoutMs
            }
        );

    const targetId =
        Array.isArray(
            choice
        )
            ? choice[0]
            : null;

    if (
        targetId
    ) {
        await killPlayer(
            client,
            game,
            targetId,
            "hunter"
        );
    }

    if (
        isRunning(
            game
        )
    ) {
        game.phase =
            previousPhase;

        saveGame(
            game
        );
    }
}

// ======================================================
// KILL
// ======================================================

async function killPlayer(
    client,
    game,
    userId,
    cause,
    {
        allowHunter = true,
        allowLover = true,
        allowMayorSuccession = true
    } = {}
) {
    const player =
        getPlayer(
            game,
            userId
        );

    if (
        !player ||
        !player.alive
    ) {
        return false;
    }

    if (
        player.roleId ===
            "elder" &&
        cause ===
            "wolves" &&
        player.roleState
            ?.wolfProtection
    ) {
        player.roleState
            .wolfProtection =
            false;

        saveGame(
            game
        );

        addJournal(
            game,
            "🧓 L'Ancien a survécu à une attaque de la Meute."
        );

        return false;
    }

    const wasMayor =
        game.mayorId ===
        userId;

    player.alive =
        false;

    player.deathCause =
        cause;

    player.deathAt =
        Date.now();

    saveGame(
        game
    );

    const role =
        getRole(
            player.roleId
        );

    addJournal(
        game,
        game.config.hardcore
            ? `<@${userId}> est mort.`
            : `<@${userId}> est mort — ${role?.emoji || "❔"} ${role?.name || "Inconnu"}.`
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        guild
    ) {
        await voice.muteDeadPlayer(
            guild,
            userId
        );
    }

    if (
        player.roleId ===
            "rusty_sword_knight" &&
        cause ===
            "wolves"
    ) {
        game.pendingRustyWolfId =
            findNextWolfInOrder(
                game,
                userId
            );

        saveGame(
            game
        );
    }

    if (
        allowLover &&
        game.lovers
            ?.includes(
                userId
            )
    ) {
        const loverId =
            game.lovers.find(
                id =>
                    id !==
                    userId
            );

        const lover =
            getPlayer(
                game,
                loverId
            );

        if (
            lover?.alive
        ) {
            await killPlayer(
                client,
                game,
                loverId,
                "broken_heart",
                {
                    allowLover:
                        false
                }
            );
        }
    }

    if (
        allowHunter &&
        player.roleId ===
            "hunter" &&
        !player.roleState
            ?.shotUsed
    ) {
        await runHunterDeath(
            client,
            game,
            player
        );
    }

    if (
        wasMayor &&
        allowMayorSuccession &&
        getAlivePlayers(
            game
        ).length
    ) {
        await chooseMayorSuccessor(
            client,
            game,
            userId
        );
    }

    await checkWildChild(
        client,
        game
    );

    saveGame(
        game
    );

    return true;
}

// ======================================================
// NIGHT DEATHS
// ======================================================

async function resolveNightDeaths(
    client,
    game
) {
    const deaths =
        [];

    const infected =
        Boolean(
            game.nightState
                ?.infected
        );

    if (
        game.wolfVictimId &&
        !infected &&
        game.wolfVictimId !==
            game.protectedId
    ) {
        deaths.push({
            userId:
                game.wolfVictimId,

            cause:
                "wolves"
        });
    }

    if (
        game.nightState
            ?.bigBadTarget &&
        game.nightState
            .bigBadTarget !==
            game.protectedId
    ) {
        deaths.push({
            userId:
                game.nightState
                    .bigBadTarget,

            cause:
                "big_bad_wolf"
        });
    }

    if (
        game.nightState
            ?.whiteWolfTarget
    ) {
        deaths.push({
            userId:
                game.nightState
                    .whiteWolfTarget,

            cause:
                "white_wolf"
        });
    }

    if (
        game.poisonVictimId
    ) {
        deaths.push({
            userId:
                game.poisonVictimId,

            cause:
                "witch"
        });
    }

    const seen =
        new Set();

    const unique =
        deaths.filter(
            death => {
                if (
                    seen.has(
                        death.userId
                    )
                ) {
                    return false;
                }

                seen.add(
                    death.userId
                );

                return true;
            }
        );

    const actuallyDead =
        [];

    for (
        const death
        of unique
    ) {
        const killed =
            await killPlayer(
                client,
                game,
                death.userId,
                death.cause
            );

        if (
            killed
        ) {
            actuallyDead.push(
                death
            );
        }
    }

    game.nightState
        .resolvedDeaths =
        actuallyDead;

    saveGame(
        game
    );

    return actuallyDead;
}

// ======================================================
// RUSTY REVENGE
// ======================================================

async function resolveRustyRevenge(
    client,
    game
) {
    const targetId =
        game.pendingRustyWolfId;

    if (
        !targetId
    ) {
        return null;
    }

    game.pendingRustyWolfId =
        null;

    saveGame(
        game
    );

    const target =
        getPlayer(
            game,
            targetId
        );

    if (
        !target?.alive
    ) {
        return null;
    }

    const killed =
        await killPlayer(
            client,
            game,
            targetId,
            "rusty_sword"
        );

    return killed
        ? targetId
        : null;
}

// ======================================================
// BEAR MORNING
// ======================================================

async function runBearTamerMorning(
    game
) {
    const bear =
        getRolePlayer(
            game,
            "bear_tamer"
        );

    if (
        !bear
    ) {
        return;
    }

    const neighbours =
        livingNeighbours(
            game,
            bear.userId
        ).filter(
            player =>
                player.userId !==
                bear.userId
        );

    const wolfNearby =
        neighbours.some(
            isWolfAligned
        );

    if (
        wolfNearby
    ) {
        await voice.narrateAndWait(
            game.guildId,
            "L'ours grogne fortement ce matin."
        );

        addJournal(
            game,
            "🐻 L'Ours a grogné ce matin."
        );

    } else {
        await voice.narrateAndWait(
            game.guildId,
            "L'ours reste calme ce matin."
        );

        addJournal(
            game,
            "🐻 L'Ours est resté calme."
        );
    }
}

// ======================================================
// VOTES
// ======================================================

function countVotes(
    votes,
    {
        game = null,
        includeRaven = false
    } = {}
) {
    const counts =
        {};

    for (
        const [
            voterId,
            targetId
        ]
        of Object.entries(
            votes ||
            {}
        )
    ) {
        const voter =
            game
                ? getPlayer(
                    game,
                    voterId
                )
                : null;

        if (
            game &&
            (
                !voter?.alive ||
                !voter.canVote
            )
        ) {
            continue;
        }

        const weight =
            game?.mayorId ===
            voterId
                ? 2
                : 1;

        counts[
            targetId
        ] =
            (
                counts[
                    targetId
                ] ||
                0
            ) +
            weight;
    }

    if (
        includeRaven &&
        game?.ravenTargetId &&
        getPlayer(
            game,
            game.ravenTargetId
        )?.alive
    ) {
        counts[
            game.ravenTargetId
        ] =
            (
                counts[
                    game.ravenTargetId
                ] ||
                0
            ) +
            CONFIG.ravenExtraVotes;
    }

    const sorted =
        Object.entries(
            counts
        ).sort(
            (
                a,
                b
            ) =>
                b[1] -
                a[1]
        );

    if (
        !sorted.length
    ) {
        return {
            counts,
            leaders: [],
            max: 0
        };
    }

    const max =
        sorted[
            0
        ][
            1
        ];

    const leaders =
        sorted
            .filter(
                entry =>
                    entry[1] ===
                    max
            )
            .map(
                entry =>
                    entry[0]
            );

    return {
        counts,
        leaders,
        max
    };
}

// ======================================================
// MAYOR CANDIDATES
// ======================================================

async function runMayorCandidates(
    client,
    game
) {
    game.phase =
        "mayor_candidates";

    game.mayorCandidates =
        [];

    game.dayState
        .mayorPhase =
        "candidates";

    saveGame(
        game
    );

    await updatePublicMessage(
        client,
        game
    );

    await voice.narrateKeyAndWait(
        game.guildId,
        "election"
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    const channel =
        guild?.channels.cache.get(
            game.channelId
        );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const message =
        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        "👑 Élection du Maire"
                    )
                    .setDescription(
                        "Les candidatures sont ouvertes pendant une minute."
                    )
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `lg_mayor_join_${game.id}`
                            )
                            .setLabel(
                                "Se présenter"
                            )
                            .setEmoji(
                                "👑"
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `lg_mayor_leave_${game.id}`
                            )
                            .setLabel(
                                "Retirer ma candidature"
                            )
                            .setEmoji(
                                "❌"
                            )
                            .setStyle(
                                ButtonStyle.Secondary
                            )
                    )
            ]
        });

    await sleep(
        CONFIG.mayorCandidateMs
    );

    if (
        !isRunning(
            game
        )
    ) {
        return;
    }

    await message.edit({
        components:
            []
    }).catch(
        () => {}
    );

    game.mayorCandidates =
        game.mayorCandidates.filter(
            id =>
                getPlayer(
                    game,
                    id
                )?.alive
        );

    if (
        !game.mayorCandidates.length
    ) {
        game.mayorId =
            null;

        game.mayorElectionDone =
            true;

        game.dayState
            .mayorHandled =
            true;

        game.dayState
            .mayorPhase =
            "done";

        saveGame(
            game
        );

        addJournal(
            game,
            "👑 Aucun joueur ne s'est présenté à l'élection du Maire."
        );

        return;
    }

    if (
        game.mayorCandidates.length ===
        1
    ) {
        game.mayorId =
            game.mayorCandidates[
                0
            ];

        game.mayorElectionDone =
            true;

        game.dayState
            .mayorHandled =
            true;

        game.dayState
            .mayorPhase =
            "done";

        saveGame(
            game
        );

        addJournal(
            game,
            `👑 <@${game.mayorId}> est élu Maire sans opposition.`
        );

        return;
    }

    await runMayorVote(
        client,
        game,
        game.mayorCandidates,
        false
    );
}

// ======================================================
// MAYOR VOTE
// ======================================================

async function runMayorVote(
    client,
    game,
    candidateIds,
    secondRound
) {
    game.phase =
        secondRound
            ? "mayor_runoff"
            : "mayor_vote";

    game.dayState
        .mayorPhase =
        secondRound
            ? "runoff"
            : "vote";

    game.votes =
        {};

    saveGame(
        game
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    const channel =
        guild?.channels.cache.get(
            game.channelId
        );

    if (
        !guild ||
        !channel?.isTextBased()
    ) {
        return;
    }

    const candidates =
        candidateIds
            .map(
                id =>
                    getPlayer(
                        game,
                        id
                    )
            )
            .filter(
                player =>
                    player?.alive
            );

    const options =
        await buildPlayerOptions(
            guild,
            candidates
        );

    if (
        !options.length
    ) {
        game.mayorElectionDone =
            true;

        game.dayState
            .mayorHandled =
            true;

        saveGame(
            game
        );

        return;
    }

    const token =
        createToken();

    game.publicVoteToken =
        token;

    saveGame(
        game
    );

    const message =
        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        secondRound
                            ? "👑 Second tour — Maire"
                            : "👑 Vote du Maire"
                    )
                    .setDescription(
                        secondRound
                            ? "Votez entre les candidats arrivés à égalité."
                            : "Choisissez votre Maire parmi les candidats."
                    )
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(
                                `lg_mayor_vote_${game.id}_${token}`
                            )
                            .setPlaceholder(
                                "Choisis ton candidat"
                            )
                            .addOptions(
                                options
                            )
                    )
            ]
        });

    await sleep(
        CONFIG.mayorVoteMs
    );

    if (
        !isRunning(
            game
        )
    ) {
        return;
    }

    await message.edit({
        components:
            []
    }).catch(
        () => {}
    );

    const result =
        countVotes(
            game.votes
        );

    if (
        result.leaders.length ===
        1
    ) {
        game.mayorId =
            result.leaders[
                0
            ];

        game.mayorElectionDone =
            true;

        game.dayState
            .mayorHandled =
            true;

        game.dayState
            .mayorPhase =
            "done";

        game.votes =
            {};

        saveGame(
            game
        );

        addJournal(
            game,
            `👑 <@${game.mayorId}> est élu Maire.`
        );

        return;
    }

    // Aucun vote.
    if (
        !result.leaders.length
    ) {
        game.mayorId =
            null;

        game.mayorElectionDone =
            true;

        game.dayState
            .mayorHandled =
            true;

        game.dayState
            .mayorPhase =
            "done";

        game.votes =
            {};

        saveGame(
            game
        );

        addJournal(
            game,
            "👑 Aucun Maire n'a été élu."
        );

        return;
    }

    // Première égalité => second tour.
    if (
        !secondRound
    ) {
        return runMayorVote(
            client,
            game,
            result.leaders,
            true
        );
    }

    // Deuxième égalité => pas de Maire.
    game.mayorId =
        null;

    game.mayorElectionDone =
        true;

    game.dayState
        .mayorHandled =
        true;

    game.dayState
        .mayorPhase =
        "done";

    game.votes =
        {};

    saveGame(
        game
    );

    addJournal(
        game,
        "👑 Le second tour se termine encore sur une égalité : aucun Maire n'est élu."
    );
}

// ======================================================
// DISCUSSION
// ======================================================

async function runDiscussion(
    client,
    game,
    {
        resumed = false
    } = {}
) {
    const state =
        ensureDayState(
            game
        );

    if (
        state
            .discussionCompleted
    ) {
        return;
    }

    game.phase =
        "discussion";

    saveGame(
        game
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    if (
        guild
    ) {
        await voice.unmuteLivingPlayersForDay(
            guild,
            game
        );
    }

    await voice.narrateKeyAndWait(
        game.guildId,
        "discussion"
    );

    if (
        resumed
    ) {
        addJournal(
            game,
            "💬 La discussion du Village reprend après un redémarrage."
        );
    }

    await sleep(
        game.config.discussionMs ||
        CONFIG.discussionMs
    );

    if (
        !isRunning(
            game
        )
    ) {
        return;
    }

    state.discussionCompleted =
        true;

    saveGame(
        game
    );
}

// ======================================================
// SCAPEGOAT
// ======================================================

async function chooseScapegoatVoters(
    client,
    game,
    scapegoat
) {
    const alive =
        getAlivePlayers(
            game
        ).filter(
            player =>
                player.userId !==
                    scapegoat.userId &&
                player.canVote
        );

    if (
        !alive.length
    ) {
        return;
    }

    const choice =
        await askPlayerSelect(
            client,
            game,
            scapegoat.userId,
            {
                title:
                    "🐐 Dernière décision",

                description:
                    "Choisis les joueurs autorisés à voter lors du prochain vote principal du Village.",

                players:
                    alive,

                minValues:
                    1,

                maxValues:
                    Math.min(
                        alive.length,
                        25
                    ),

                timeoutMs:
                    CONFIG.scapegoatTimeoutMs,

                placeholder:
                    "Choisis les prochains votants"
            }
        );

    if (
        !Array.isArray(
            choice
        ) ||
        !choice.length
    ) {
        return;
    }

    game.nextVoteRestrictedVoters = [
        ...choice
    ];

    scapegoat.roleState
        .usedRestrictions =
        (
            scapegoat.roleState
                .usedRestrictions ||
            0
        ) +
        1;

    saveGame(
        game
    );
}

function canPlayerVoteToday(
    game,
    userId
) {
    const voter =
        getPlayer(
            game,
            userId
        );

    if (
        !voter?.alive ||
        !voter.canVote
    ) {
        return false;
    }

    const state =
        ensureDayState(
            game
        );

    const restricted =
        state
            .inheritedRestrictedVoters;

    if (
        !Array.isArray(
            restricted
        ) ||
        !restricted.length
    ) {
        return true;
    }

    return restricted.includes(
        userId
    );
}

// ======================================================
// DAY VOTE
// ======================================================

async function runDayVote(
    client,
    game,
    {
        candidates = null,
        secondRound = false,
        judgeVote = false
    } = {}
) {
    game.phase =
        secondRound
            ? "runoff_vote"
            : "day_vote";

    game.votes =
        {};

    saveGame(
        game
    );

    await voice.beginVoteAudio(
        game.guildId,
        {
            ambience:
                Boolean(
                    game.config.ambience
                )
        }
    ).catch(
        () => {}
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    const channel =
        guild?.channels.cache.get(
            game.channelId
        );

    if (
        !guild ||
        !channel?.isTextBased()
    ) {
        return null;
    }

    const targets =
        candidates
            ? candidates
                .map(
                    id =>
                        getPlayer(
                            game,
                            id
                        )
                )
                .filter(
                    player =>
                        player?.alive
                )
            : getAlivePlayers(
                game
            );

    const options =
        await buildPlayerOptions(
            guild,
            targets
        );

    if (
        !options.length
    ) {
        return null;
    }

    const token =
        createToken();

    game.publicVoteToken =
        token;

    saveGame(
        game
    );

    const message =
        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        secondRound
                            ? "⚖️ Second tour"
                            : judgeVote
                                ? "⚖️ Vote supplémentaire du Juge"
                                : "🗳️ Vote du Village"
                    )
                    .setDescription(
                        game.config.anonymousVotes
                            ? "🔒 Les votes individuels resteront anonymes."
                            : "👁️ Les votes sont visibles."
                    )
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(
                                `lg_day_vote_${game.id}_${token}`
                            )
                            .setPlaceholder(
                                "Choisis qui éliminer"
                            )
                            .addOptions(
                                options
                            )
                    )
            ]
        });

    await sleep(
        secondRound
            ? CONFIG.secondVoteMs
            : CONFIG.voteMs
    );

    if (
        !isRunning(
            game
        )
    ) {
        return null;
    }

    await message.edit({
        components:
            []
    }).catch(
        () => {}
    );

    const result =
        countVotes(
            game.votes,
            {
                game,

                includeRaven:
                    !secondRound &&
                    !judgeVote
            }
        );

    // La restriction du Bouc ne dure que ce vote.
    const state =
        ensureDayState(
            game
        );

    if (
        Array.isArray(
            state.inheritedRestrictedVoters
        )
    ) {
        state.restrictionConsumed =
            true;

        state.inheritedRestrictedVoters =
            null;

        saveGame(
            game
        );
    }

    if (
        !result.leaders.length
    ) {
        return null;
    }

    if (
        result.leaders.length ===
        1
    ) {
        return result.leaders[
            0
        ];
    }

    // Le Maire départage en privé.
    const mayor =
        getPlayer(
            game,
            game.mayorId
        );

    if (
        mayor?.alive
    ) {
        const choice =
            await askPlayerSelect(
                client,
                game,
                mayor.userId,
                {
                    title:
                        "👑 Égalité",

                    description:
                        "Choisis secrètement qui éliminer parmi les ex æquo.",

                    players:
                        result.leaders
                            .map(
                                id =>
                                    getPlayer(
                                        game,
                                        id
                                    )
                            )
                            .filter(
                                Boolean
                            ),

                    timeoutMs:
                        30_000
                }
            );

        const selected =
            Array.isArray(
                choice
            )
                ? choice[0]
                : null;

        if (
            selected
        ) {
            return selected;
        }
    }

    // Bouc seulement sur le premier vote principal.
    if (
        !secondRound &&
        !judgeVote
    ) {
        const scapegoat =
            getRolePlayer(
                game,
                "scapegoat"
            );

        if (
            scapegoat
        ) {
            await chooseScapegoatVoters(
                client,
                game,
                scapegoat
            );

            return scapegoat.userId;
        }
    }

    // Premier vote égal => second tour.
    if (
        !secondRound
    ) {
        return runDayVote(
            client,
            game,
            {
                candidates:
                    result.leaders,

                secondRound:
                    true,

                judgeVote
            }
        );
    }

    // Deuxième égalité => personne.
    return null;
}

// ======================================================
// ANGEL
// ======================================================

function transformAngelToVillager(
    game
) {
    const angel =
        game.players.find(
            player =>
                player.alive &&
                player.roleId ===
                    "angel"
        );

    if (
        !angel
    ) {
        return false;
    }

    angel.roleId =
        "villager";

    angel.roleState = {
        transformedFromAngel:
            true
    };

    saveGame(
        game
    );

    return true;
}

// ======================================================
// VILLAGE EXECUTION
// ======================================================

async function executeVillageTarget(
    client,
    game,
    targetId,
    {
        firstMainVote = false
    } = {}
) {
    if (
        !targetId
    ) {
        if (
            firstMainVote
        ) {
            transformAngelToVillager(
                game
            );
        }

        return;
    }

    const target =
        getPlayer(
            game,
            targetId
        );

    if (
        !target ||
        !target.alive
    ) {
        if (
            firstMainVote
        ) {
            transformAngelToVillager(
                game
            );
        }

        return;
    }

    if (
        target.roleId ===
            "angel" &&
        firstMainVote
    ) {
        await finishGame(
            client,
            game,
            {
                type:
                    "solo",

                roleId:
                    "angel",

                userId:
                    target.userId
            }
        );

        return;
    }

    if (
        firstMainVote
    ) {
        transformAngelToVillager(
            game
        );
    }

    if (
        target.roleId ===
            "village_idiot" &&
        !target.roleState
            ?.revealed
    ) {
        target.roleState
            .revealed =
            true;

        target.canVote =
            false;

        saveGame(
            game
        );

        addJournal(
            game,
            `🤡 <@${target.userId}> est révélé comme Idiot du Village et est gracié.`
        );

        return;
    }

    await killPlayer(
        client,
        game,
        targetId,
        "village_vote"
    );
}

// ======================================================
// JUDGE
// ======================================================

async function maybeRunJudgeVote(
    client,
    game
) {
    const judge =
        getRolePlayer(
            game,
            "stuttering_judge"
        );

    if (
        !judge ||
        judge.roleState
            ?.used
    ) {
        return;
    }

    const choice =
        await askPlayerButtons(
            client,
            game,
            judge.userId,
            {
                title:
                    "⚖️ Juge Bègue",

                description:
                    "Veux-tu déclencher immédiatement un second vote du Village ?",

                timeoutMs:
                    20_000,

                buttons: [
                    {
                        label:
                            "Nouveau vote",

                        value:
                            "use",

                        emoji:
                            "⚖️",

                        style:
                            ButtonStyle.Danger
                    },

                    {
                        label:
                            "Conserver",

                        value:
                            "pass",

                        emoji:
                            "❌",

                        style:
                            ButtonStyle.Secondary
                    }
                ]
            }
        );

    if (
        choice !==
        "use"
    ) {
        return;
    }

    judge.roleState.used =
        true;

    saveGame(
        game
    );

    const target =
        await runDayVote(
            client,
            game,
            {
                judgeVote:
                    true
            }
        );

    await executeVillageTarget(
        client,
        game,
        target,
        {
            firstMainVote:
                false
        }
    );
}

// ======================================================
// LOVERS
// ======================================================

function checkLoversVictory(
    game
) {
    if (
        !Array.isArray(
            game.lovers
        ) ||
        game.lovers.length !==
        2
    ) {
        return null;
    }

    const alive =
        getAlivePlayers(
            game
        );

    const lovers =
        game.lovers
            .map(
                id =>
                    getPlayer(
                        game,
                        id
                    )
            );

    if (
        lovers.some(
            player =>
                !player?.alive
        )
    ) {
        return null;
    }

    if (
        alive.length !==
        2
    ) {
        return null;
    }

    const firstCamp =
        getEffectiveCamp(
            lovers[0]
        );

    const secondCamp =
        getEffectiveCamp(
            lovers[1]
        );

    if (
        firstCamp ===
        secondCamp
    ) {
        return null;
    }

    return {
        type:
            "lovers",

        playerIds:
            lovers.map(
                player =>
                    player.userId
            )
    };
}

// ======================================================
// VICTORY
// ======================================================

function checkVictory(
    game
) {
    const alive =
        getAlivePlayers(
            game
        );

    if (
        !alive.length
    ) {
        return {
            type:
                "draw"
        };
    }

    // ==================================================
    // LOVERS
    // ==================================================

    const loversVictory =
        checkLoversVictory(
            game
        );

    if (
        loversVictory
    ) {
        return loversVictory;
    }

    // ==================================================
    // WHITE WOLF
    // ==================================================

    if (
        alive.length ===
            1 &&
        alive[0].roleId ===
            "white_wolf"
    ) {
        return {
            type:
                "solo",

            roleId:
                "white_wolf",

            userId:
                alive[0].userId
        };
    }

    // ==================================================
    // FLUTE PLAYER
    // ==================================================

    const flute =
        alive.find(
            player =>
                player.roleId ===
                "flute_player"
        );

    if (
        flute
    ) {
        const others =
            alive.filter(
                player =>
                    player.userId !==
                    flute.userId
            );

        if (
            others.length &&
            others.every(
                player =>
                    player.charmed
            )
        ) {
            return {
                type:
                    "solo",

                roleId:
                    "flute_player",

                userId:
                    flute.userId
            };
        }
    }

    // ==================================================
    // WOLVES
    // ==================================================

    const wolves =
        getWolfVictoryMembers(
            game
        );

    const nonWolfControl =
        alive.filter(
            player =>
                !isStandardWolfWinner(
                    player
                )
        );

    if (
        wolves.length >
            0 &&
        wolves.length >=
            nonWolfControl.length
    ) {
        return {
            type:
                "wolves",

            playerIds:
                wolves.map(
                    player =>
                        player.userId
                )
        };
    }

    // ==================================================
    // VILLAGE
    // ==================================================

    const wolfThreats =
        alive.filter(
            player =>
                isWolfAligned(
                    player
                )
        );

    const unresolvedSoloThreats =
        alive.filter(
            player =>
                [
                    "white_wolf",
                    "flute_player"
                ].includes(
                    player.roleId
                )
        );

    if (
        !wolfThreats.length &&
        !unresolvedSoloThreats.length
    ) {
        return {
            type:
                "village",

            playerIds:
                alive
                    .filter(
                        player =>
                            getEffectiveCamp(
                                player
                            ) ===
                            CAMPS.VILLAGE
                    )
                    .map(
                        player =>
                            player.userId
                    )
        };
    }

    return null;
}

// ======================================================
// FINISH
// ======================================================

async function finishGame(
    client,
    game,
    winner
) {
    if (
        [
            "finished",
            "cancelled"
        ].includes(
            game.status
        )
    ) {
        return;
    }

    cancelGameWaiters(
        game.id
    );

    executionLocks.delete(
        game.id
    );

    resumeLocks.delete(
        game.id
    );

    game.status =
        "finished";

    game.phase =
        "finished";

    game.winner =
        winner;

    saveGame(
        game
    );

    voice.stopAmbience(
        game.guildId
    );

    await voice.victoryAudio(
        game.guildId,
        winner.type,
        {
            ambience:
                Boolean(
                    game.config.ambience
                )
        }
    ).catch(
        () => {}
    );

    await restoreGameMutes(
        client,
        game
    );

    await updatePublicMessage(
        client,
        game
    );

    const guild =
        client.guilds.cache.get(
            game.guildId
        );

    const channel =
        guild?.channels.cache.get(
            game.channelId
        );

    if (
        channel?.isTextBased()
    ) {
        let result =
            "⚖️ Partie terminée.";

        if (
            winner.type ===
            "village"
        ) {
            result =
                "🏘️ **Victoire du Village !**";
        }

        if (
            winner.type ===
            "wolves"
        ) {
            result =
                "🐺 **Victoire de la Meute !**";
        }

        if (
            winner.type ===
            "lovers"
        ) {
            result =
                `💘 **Victoire des Amoureux : ${winner.playerIds.map(id => `<@${id}>`).join(" & ")} !**`;
        }

        if (
            winner.type ===
            "solo"
        ) {
            const role =
                getRole(
                    winner.roleId
                );

            result =
                `🎭 **Victoire solitaire de <@${winner.userId}> — ${role?.emoji || ""} ${role?.name || "Rôle spécial"} !**`;
        }

        if (
            winner.type ===
            "draw"
        ) {
            result =
                "🤝 **La partie se termine sans vainqueur.**";
        }

        const roleList =
            game.players
                .map(
                    player => {
                        const role =
                            getRole(
                                player.roleId
                            );

                        return (
                            `<@${player.userId}> → ` +
                            `${role?.emoji || "❔"} **${role?.name || "Inconnu"}**` +
                            `${player.convertedToWolf ? " 🩸 Meute" : ""}` +
                            `${game.mayorId === player.userId ? " 👑 Maire" : ""}`
                        );
                    }
                )
                .join(
                    "\n"
                );

        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x57F287
                    )
                    .setTitle(
                        "🏆 Fin de partie"
                    )
                    .setDescription(
                        result
                    )
                    .addFields({
                        name:
                            "🎭 Rôles finaux",

                        value:
                            roleList.slice(
                                0,
                                1024
                            )
                    })
            ]
        });
    }

    data.history.push({
        ...clone(
            game
        ),

        archivedAt:
            Date.now()
    });

    if (
        data.history.length >
        40
    ) {
        data.history =
            data.history.slice(
                -40
            );
    }

    saveData();

    setTimeout(
        () => {
            voice.disconnect(
                game.guildId
            );
        },
        10_000
    );
}

// ======================================================
// NIGHT ENGINE
// ======================================================

async function runNight(
    client,
    game,
    {
        resume = false
    } = {}
) {
    if (
        !isRunning(
            game
        )
    ) {
        return;
    }

    if (
        executionLocks.has(
            game.id
        )
    ) {
        return;
    }

    executionLocks.add(
        game.id
    );

    try {
        if (
            !resume ||
            !game.nightState ||
            game.nightState.number !==
                game.night
        ) {
            game.night++;

            game.nightState =
                createNightState(
                    game.night
                );

            game.wolfVictimId =
                null;

            game.protectedId =
                null;

            game.poisonVictimId =
                null;

            game.ravenTargetId =
                null;
        }

        game.phase =
            "night";

        saveGame(
            game
        );

        const guild =
            client.guilds.cache.get(
                game.guildId
            );

        if (
            !guild
        ) {
            return;
        }

        voice.setVolumes(
            game.guildId,
            {
                narration:
                    game.config
                        .narrationVolume,

                sounds:
                    game.config
                        .soundVolume,

                ambience:
                    game.config
                        .ambienceVolume
            }
        );

        voice.setDiscreteMode?.(
            game.guildId,
            Boolean(
                game.config
                    .discreteMode
            )
        );

        await voice.muteLivingPlayersForNight(
            guild,
            game
        );

        await runNightStep(
            game,
            "intro",
            async () => {
                await voice.beginNightAudio(
                    game.guildId,
                    {
                        firstNight:
                            game.night ===
                            1,

                        ambience:
                            Boolean(
                                game.config
                                    .ambience
                            )
                    }
                );
            }
        );

        await runNightStep(
            game,
            "cupid",
            () =>
                runCupid(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "wolf_dog",
            () =>
                runWolfDog(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "wild_child",
            () =>
                runWildChild(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "guard",
            () =>
                runGuard(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "seer",
            () =>
                runSeer(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "fox",
            () =>
                runFox(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "actor",
            () =>
                runActor(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "raven",
            () =>
                runRaven(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "wolves",
            () =>
                runWolfVote(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "little_girl",
            () =>
                runLittleGirl(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "infection",
            async () => {
                game.nightState
                    .infected =
                    await runInfection(
                        client,
                        game
                    );

                saveGame(
                    game
                );
            }
        );

        await runNightStep(
            game,
            "big_bad_wolf",
            async () => {
                game.nightState
                    .bigBadTarget =
                    await runBigBadWolf(
                        client,
                        game
                    );

                saveGame(
                    game
                );
            }
        );

        await runNightStep(
            game,
            "white_wolf",
            async () => {
                game.nightState
                    .whiteWolfTarget =
                    await runWhiteWolf(
                        client,
                        game
                    );

                saveGame(
                    game
                );
            }
        );

        await runNightStep(
            game,
            "witch",
            () =>
                runWitch(
                    client,
                    game
                )
        );

        await runNightStep(
            game,
            "flute",
            () =>
                runFlutePlayer(
                    client,
                    game
                )
        );

        game.phase =
            "dawn";

        saveGame(
            game
        );

        voice.stopAmbience(
            game.guildId
        );

        await runNightStep(
            game,
            "resolve_deaths",
            async () => {
                await voice.beginDawnAudio(
                    game.guildId,
                    {
                        ambience:
                            Boolean(
                                game.config
                                    .ambience
                            )
                    }
                ).catch(
                    () => {}
                );

                game.nightState
                    .resolvedDeaths =
                    await resolveNightDeaths(
                        client,
                        game
                    );

                saveGame(
                    game
                );
            }
        );

        await runNightStep(
            game,
            "rusty",
            async () => {
                const rusty =
                    await resolveRustyRevenge(
                        client,
                        game
                    );

                if (
                    rusty
                ) {
                    game.nightState
                        .resolvedDeaths
                        .push({
                            userId:
                                rusty,

                            cause:
                                "rusty_sword"
                        });
                }

                saveGame(
                    game
                );
            }
        );

        await runNightStep(
            game,
            "bear",
            () =>
                runBearTamerMorning(
                    game
                )
        );

        if (
            !nightStepDone(
                game,
                "day_increment"
            )
        ) {
            game.day++;

            game.dayState =
                null;

            ensureDayState(
                game
            );

            if (
                game.night ===
                1
            ) {
                game.firstNightCompleted =
                    true;
            }

            markNightStep(
                game,
                "day_increment"
            );
        }

        game.nightState
            .completedAt =
            Date.now();

        saveGame(
            game
        );

        const victory =
            checkVictory(
                game
            );

        if (
            victory
        ) {
            await finishGame(
                client,
                game,
                victory
            );

            return;
        }

    } finally {
        executionLocks.delete(
            game.id
        );
    }

    await runDay(
        client,
        game
    );
}

// ======================================================
// DAY ENGINE
// ======================================================

async function runDay(
    client,
    game,
    {
        resumed = false
    } = {}
) {
    if (
        !isRunning(
            game
        )
    ) {
        return;
    }

    if (
        executionLocks.has(
            game.id
        )
    ) {
        return;
    }

    executionLocks.add(
        game.id
    );

    try {
        const state =
            ensureDayState(
                game
            );

        // ==================================================
        // MAYOR AFTER FIRST NIGHT
        // ==================================================

        if (
            game.day ===
                1 &&
            game.config
                .mayorElection &&
            !game.mayorElectionDone &&
            !state
                .mayorHandled
        ) {
            await runMayorCandidates(
                client,
                game
            );

            state.mayorHandled =
                true;

            saveGame(
                game
            );
        }

        // ==================================================
        // DISCUSSION
        // ==================================================

        if (
            !state
                .discussionCompleted
        ) {
            await runDiscussion(
                client,
                game,
                {
                    resumed
                }
            );
        }

        // ==================================================
        // VOTE PRINCIPAL
        // ==================================================

        if (
            !state
                .voteCompleted
        ) {
            const firstMainVote =
                game.day ===
                    1 &&
                !state
                    .angelResolved;

            const target =
                await runDayVote(
                    client,
                    game
                );

            state.executedTargetId =
                target;

            state.voteCompleted =
                true;

            saveGame(
                game
            );

            await executeVillageTarget(
                client,
                game,
                target,
                {
                    firstMainVote
                }
            );

            if (
                firstMainVote &&
                isRunning(
                    game
                )
            ) {
                state.angelResolved =
                    true;

                saveGame(
                    game
                );
            }
        }

        let victory =
            checkVictory(
                game
            );

        if (
            victory
        ) {
            await finishGame(
                client,
                game,
                victory
            );

            return;
        }

        // ==================================================
        // JUDGE
        // ==================================================

        if (
            !state
                .judgeHandled
        ) {
            await maybeRunJudgeVote(
                client,
                game
            );

            state.judgeHandled =
                true;

            saveGame(
                game
            );
        }

        victory =
            checkVictory(
                game
            );

        if (
            victory
        ) {
            await finishGame(
                client,
                game,
                victory
            );

            return;
        }

        game.phase =
            "between_days";

        saveGame(
            game
        );

    } finally {
        executionLocks.delete(
            game.id
        );
    }

    await sleep(
        CONFIG.nextNightDelayMs
    );

    if (
        isRunning(
            game
        )
    ) {
        await runNight(
            client,
            game
        );
    }
}

// ======================================================
// START GAME
// ======================================================

// ==================================================
// START
// ==================================================

if (
    id.startsWith(
        "lg_lobby_start_"
    )
) {
    console.log(
        "🐺 [LOUP-GAROU] Bouton Démarrer reçu :",
        id
    );

    const gameId =
        id.slice(
            "lg_lobby_start_".length
        );

    console.log(
        "🐺 [LOUP-GAROU] ID partie :",
        gameId
    );

    let game =
        getGame(
            gameId
        );

    // ==================================================
    // FALLBACK :
    // si jamais l'ID du message n'est plus retrouvé,
    // on cherche la partie active du serveur.
    // ==================================================

    if (
        !game
    ) {
        console.warn(
            `⚠️ [LOUP-GAROU] Partie ${gameId} introuvable par ID. Recherche par serveur...`
        );

        const guildGame =
            getGuildGame(
                interaction.guild.id
            );

        if (
            guildGame &&
            guildGame.id ===
                gameId
        ) {
            game =
                guildGame;
        }
    }

    // ==================================================
    // PARTIE INTROUVABLE
    // ==================================================

    if (
        !game
    ) {
        console.error(
            `❌ [LOUP-GAROU] Partie ${gameId} totalement introuvable.`
        );

        await replyPrivate(
            interaction,
            {
                content:
                    "❌ Cette partie n'existe plus dans la mémoire du bot.\n\nAnnule ce lobby puis relance `/loupgarou lancer`."
            }
        );

        return true;
    }

    console.log(
        "🐺 [LOUP-GAROU] Partie trouvée :",
        {
            id:
                game.id,

            status:
                game.status,

            phase:
                game.phase,

            players:
                game.players.length,

            voiceChannelId:
                game.voiceChannelId,

            hostId:
                game.hostId
        }
    );

    // ==================================================
    // STATUT
    // ==================================================

    if (
        game.status !==
        "lobby"
    ) {
        console.warn(
            `⚠️ [LOUP-GAROU] Démarrage refusé : statut "${game.status}".`
        );

        await replyPrivate(
            interaction,
            {
                content:
                    `❌ Cette partie n'est plus dans le lobby.\n\n**Statut actuel :** \`${game.status}\`\n**Phase :** \`${game.phase}\``
            }
        );

        return true;
    }

    // ==================================================
    // HÔTE
    // ==================================================

    if (
        interaction.user.id !==
        game.hostId
    ) {
        console.log(
            `⚠️ [LOUP-GAROU] ${interaction.user.id} a tenté de démarrer sans être l'hôte.`
        );

        await replyPrivate(
            interaction,
            {
                content:
                    "❌ Seul l'hôte peut démarrer la partie."
            }
        );

        return true;
    }

    // ==================================================
    // JOUEURS
    // ==================================================

    if (
        game.players.length <
        MIN_PLAYERS
    ) {
        console.log(
            `⚠️ [LOUP-GAROU] Pas assez de joueurs : ${game.players.length}/${MIN_PLAYERS}`
        );

        await replyPrivate(
            interaction,
            {
                content:
                    `❌ Il faut au moins **${MIN_PLAYERS} joueurs**.\n\n👥 Joueurs actuellement inscrits : **${game.players.length}/${MIN_PLAYERS}**`
            }
        );

        return true;
    }

    // ==================================================
    // COMPOSITION
    // ==================================================

    const composition =
        resolveCurrentComposition(
            game
        );

    if (
        !composition
            .validation
            .valid
    ) {
        console.log(
            "⚠️ [LOUP-GAROU] Composition invalide :",
            composition
                .validation
                .errors
        );

        await replyPrivate(
            interaction,
            {
                content:
`❌ La composition n'est pas valide.

${composition.validation.errors
    .map(
        error =>
            `• ${error}`
    )
    .join("\n")}`
            }
        );

        return true;
    }

    // ==================================================
    // CONFIRMATION IMMÉDIATE DU CLIC
    // ==================================================

    await interaction.deferUpdate();

    await interaction.followUp({
        content:
`🐺 **Démarrage du Loup-Garou en cours...**

✅ Lobby validé
✅ ${game.players.length} joueurs
✅ Composition validée

🔊 Connexion au vocal et vérification des messages privés...`,

        flags:
            MessageFlags.Ephemeral
    }).catch(
        error => {
            console.error(
                "⚠️ [LOUP-GAROU] Impossible d'envoyer le message de progression :",
                error
            );
        }
    );

    console.log(
        `🚀 [LOUP-GAROU] Démarrage de la partie ${game.id}...`
    );

    const startedAt =
        Date.now();

    let result;

    try {
        result =
            await loupgarouSystem.startGame(
                client,
                game
            );

    } catch (error) {
        console.error(
            `❌ [LOUP-GAROU] startGame() a planté pour ${game.id} :`,
            error
        );

        await interaction.followUp({
            content:
                `❌ **Erreur pendant le démarrage du Loup-Garou.**\n\n\`${error.message || "Erreur inconnue"}\``,

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        await refreshLobbyMessage(
            interaction,
            game
        );

        return true;
    }

    console.log(
        `🐺 [LOUP-GAROU] startGame() terminé en ${Date.now() - startedAt} ms :`,
        result
    );

    // ==================================================
    // START REFUSÉ
    // ==================================================

    if (
        !result ||
        !result.ok
    ) {
        const reason =
            result?.reason ||
            "Le moteur n'a retourné aucune raison.";

        console.error(
            `❌ [LOUP-GAROU] Impossible de démarrer ${game.id} :`,
            reason
        );

        await interaction.followUp({
            content:
`❌ **Impossible de démarrer la partie.**

${reason}`,

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        await refreshLobbyMessage(
            interaction,
            game
        );

        return true;
    }

    // ==================================================
    // PARTIE LANCÉE
    // ==================================================

    console.log(
        `✅ [LOUP-GAROU] Partie ${game.id} démarrée avec ${game.players.length} joueurs.`
    );

    await interaction.message.edit({
        content:
            "🐺 **La partie commence. Les rôles sont envoyés en message privé...**",

        embeds: [
            loupgarouSystem.buildGameEmbed(
                game
            )
        ],

        components:
            []
    }).catch(
        error => {
            console.error(
                "⚠️ [LOUP-GAROU] Impossible de modifier le lobby après démarrage :",
                error
            );
        }
    );

    await interaction.followUp({
        content:
            "✅ **La partie est lancée !** Les rôles ont été distribués et la première nuit va commencer.",

        flags:
            MessageFlags.Ephemeral
    }).catch(
        () => {}
    );

    // ==================================================
    // WARNINGS
    // ==================================================

    if (
        result.warnings
            ?.length
    ) {
        await interaction.followUp({
            content:
`⚠️ Partie lancée avec quelques avertissements :

${result.warnings
    .map(
        warning =>
            `• ${warning}`
    )
    .join("\n")}`,

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );
    }

    return true;
}

// ======================================================
// RESUME
// ======================================================

async function resumeGame(
    client,
    game
) {
    if (
        !game ||
        game.status !==
        "running"
    ) {
        return {
            ok: false,

            reason:
                "Cette partie n'est pas en cours."
        };
    }

    if (
        resumeLocks.has(
            game.id
        ) ||
        executionLocks.has(
            game.id
        )
    ) {
        return {
            ok: true,

            reason:
                "La partie est déjà en cours de reprise."
        };
    }

    resumeLocks.add(
        game.id
    );

    try {
        const guild =
            client.guilds.cache.get(
                game.guildId
            );

        if (
            !guild
        ) {
            return {
                ok: false,

                reason:
                    "Serveur introuvable."
            };
        }

        try {
            await voice.connectToVoice(
                guild,
                game.voiceChannelId
            );

        } catch (error) {
            return {
                ok: false,

                reason:
                    error.message
            };
        }

        voice.setVolumes(
            game.guildId,
            {
                narration:
                    game.config
                        ?.narrationVolume ??
                    1,

                sounds:
                    game.config
                        ?.soundVolume ??
                    0.65,

                ambience:
                    game.config
                        ?.ambienceVolume ??
                    0.18
            }
        );

        voice.setDiscreteMode?.(
            game.guildId,
            Boolean(
                game.config
                    ?.discreteMode
            )
        );

        cancelGameWaiters(
            game.id
        );

        game.pendingActions =
            {};

        await normalizeMutesAfterCrash(
            client,
            game
        );

        saveGame(
            game
        );

        if (
            [
                "night",
                "dawn",
                "hunter"
            ].includes(
                game.phase
            )
        ) {
            setTimeout(
                () => {
                    runNight(
                        client,
                        game,
                        {
                            resume:
                                true
                        }
                    ).catch(
                        console.error
                    );
                },
                500
            );

            return {
                ok: true
            };
        }

        if (
            [
                "mayor_candidates",
                "mayor_vote",
                "mayor_runoff",
                "discussion",
                "day_vote",
                "runoff_vote"
            ].includes(
                game.phase
            )
        ) {
            const state =
                ensureDayState(
                    game
                );

            if (
                game.phase ===
                "discussion"
            ) {
                state.discussionCompleted =
                    false;
            }

            if (
                [
                    "day_vote",
                    "runoff_vote"
                ].includes(
                    game.phase
                )
            ) {
                state.voteCompleted =
                    false;
            }

            if (
                [
                    "mayor_candidates",
                    "mayor_vote",
                    "mayor_runoff"
                ].includes(
                    game.phase
                )
            ) {
                state.mayorHandled =
                    false;

                game.mayorElectionDone =
                    false;
            }

            saveGame(
                game
            );

            setTimeout(
                () => {
                    runDay(
                        client,
                        game,
                        {
                            resumed:
                                true
                        }
                    ).catch(
                        console.error
                    );
                },
                500
            );

            return {
                ok: true
            };
        }

        if (
            game.phase ===
            "between_days"
        ) {
            setTimeout(
                () => {
                    runNight(
                        client,
                        game
                    ).catch(
                        console.error
                    );
                },
                500
            );

            return {
                ok: true
            };
        }

        setTimeout(
            () => {
                runNight(
                    client,
                    game
                ).catch(
                    console.error
                );
            },
            500
        );

        return {
            ok: true
        };

    } finally {
        setTimeout(
            () => {
                resumeLocks.delete(
                    game.id
                );
            },
            2_000
        );
    }
}

// ======================================================
// CANCEL
// ======================================================

async function cancelGame(
    client,
    game
) {
    if (
        !game
    ) {
        return;
    }

    cancelGameWaiters(
        game.id
    );

    executionLocks.delete(
        game.id
    );

    resumeLocks.delete(
        game.id
    );

    game.status =
        "cancelled";

    game.phase =
        "cancelled";

    saveGame(
        game
    );

    voice.stopAmbience(
        game.guildId
    );

    await restoreGameMutes(
        client,
        game
    );

    voice.disconnect(
        game.guildId
    );

    await updatePublicMessage(
        client,
        game
    );
}

// ======================================================
// RULES UI
// ======================================================

function buildRulesHomeEmbed(
    game
) {
    const active =
        getActiveRules(
            game.roleCounts,
            game.config
        );

    const sections =
        active.sections
            .map(
                section =>
                    section.title
            )
            .join(
                "\n"
            );

    const roles =
        active.roles
            .map(
                role =>
                    `${role.emoji} ${role.name}`
            )
            .join(
                "\n"
            );

    return new EmbedBuilder()
        .setColor(
            0x3B6475
        )
        .setTitle(
            "📖 Règlement de cette partie"
        )
        .setDescription(
`Seules les règles réellement actives dans **cette partie** sont affichées.

### 📚 Sections actives

${sections}

### 🎭 Rôles présents

${roles || "Aucun rôle détecté."}`
        );
}

function getActiveGroups(
    game
) {
    const activeIds =
        new Set(
            getActiveRoleIds(
                game.roleCounts
            )
        );

    return Object.values(
        ROLE_GROUPS
    )
        .map(
            group => ({
                ...group,

                roles:
                    group.roles.filter(
                        roleId =>
                            activeIds.has(
                                roleId
                            )
                    )
            })
        )
        .filter(
            group =>
                group.roles.length
        );
}

function buildRulesGroupMenu(
    game,
    userId
) {
    const groups =
        getActiveGroups(
            game
        );

    if (
        !groups.length
    ) {
        return null;
    }

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(
                    `lg_rules_group_${game.id}_${userId}`
                )
                .setPlaceholder(
                    "Consulter les rôles actifs"
                )
                .addOptions(
                    groups.map(
                        group => ({
                            label:
                                group.name,

                            value:
                                group.id,

                            emoji:
                                group.emoji
                        })
                    )
                )
        );
}

function buildRoleGroupEmbed(
    game,
    groupId
) {
    const group =
        getActiveGroups(
            game
        ).find(
            entry =>
                entry.id ===
                groupId
        );

    if (
        !group
    ) {
        return null;
    }

    return new EmbedBuilder()
        .setColor(
            0x3B6475
        )
        .setTitle(
            `${group.emoji} ${group.name}`
        )
        .setDescription(
            group.roles
                .map(
                    roleId => {
                        const role =
                            ROLES[
                                roleId
                            ];

                        return (
                            `${role?.emoji || "❔"} **${role?.name || roleId}**\n${role?.description || ""}`
                        );
                    }
                )
                .join(
                    "\n\n"
                )
                .slice(
                    0,
                    4000
                )
        );
}

function buildRoleMenu(
    game,
    userId,
    groupId
) {
    const group =
        getActiveGroups(
            game
        ).find(
            entry =>
                entry.id ===
                groupId
        );

    if (
        !group
    ) {
        return null;
    }

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(
                    `lg_rules_role_${game.id}_${userId}`
                )
                .setPlaceholder(
                    "Choisis un rôle"
                )
                .addOptions(
                    group.roles
                        .map(
                            roleId => {
                                const role =
                                    ROLES[
                                        roleId
                                    ];

                                return {
                                    label:
                                        role?.name ||
                                        roleId,

                                    value:
                                        roleId,

                                    emoji:
                                        role?.emoji
                                };
                            }
                        )
                        .slice(
                            0,
                            25
                        )
                )
        );
}

// ======================================================
// BUTTON HANDLER
// ======================================================

async function handleButton(
    interaction,
    client
) {
    const id =
        interaction.customId;

    // ==================================================
    // MON RÔLE
    // ==================================================

    if (
        id.startsWith(
            "lg_info_role_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const userId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            userId
        ) {
            return true;
        }

        const game =
            getGame(
                gameId
            );

        const player =
            game
                ? getPlayer(
                    game,
                    userId
                )
                : null;

        if (
            !game ||
            !player
        ) {
            return true;
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        "🎭 Mon rôle"
                    )
                    .setDescription(
                        buildDynamicRoleInfo(
                            game,
                            player
                        )
                    )
            ],

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // RULES
    // ==================================================

    if (
        id.startsWith(
            "lg_info_rules_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const userId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            userId
        ) {
            return true;
        }

        const game =
            getGame(
                gameId
            );

        if (
            !game
        ) {
            return true;
        }

        const menu =
            buildRulesGroupMenu(
                game,
                userId
            );

        await interaction.reply({
            embeds: [
                buildRulesHomeEmbed(
                    game
                )
            ],

            components:
                menu
                    ? [
                        menu
                    ]
                    : [],

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // GAME INFO
    // ==================================================

    if (
        id.startsWith(
            "lg_info_game_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const userId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            userId
        ) {
            return true;
        }

        const game =
            getGame(
                gameId
            );

        if (
            !game
        ) {
            return true;
        }

        await interaction.reply({
            embeds: [
                buildGameEmbed(
                    game
                )
            ],

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // PRIVATE BUTTON CHOICE
    // ==================================================

    if (
        id.startsWith(
            "lg_choice_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                2
            ];

        const token =
            parts[
                3
            ];

        const actorId =
            parts[
                4
            ];

        const value =
            parts
                .slice(
                    5
                )
                .join(
                    "_"
                );

        if (
            interaction.user.id !==
            actorId
        ) {
            return true;
        }

        const resolved =
            resolveWaiter(
                gameId,
                token,
                value
            );

        if (
            resolved
        ) {
            await interaction.update({
                content:
                    "✅ Ton choix a été enregistré.",

                embeds:
                    [],

                components:
                    []
            }).catch(
                () => {}
            );
        }

        return true;
    }

    // ==================================================
    // MAYOR JOIN
    // ==================================================

    if (
        id.startsWith(
            "lg_mayor_join_"
        )
    ) {
        const gameId =
            id.replace(
                "lg_mayor_join_",
                ""
            );

        const game =
            getGame(
                gameId
            );

        const player =
            game
                ? getPlayer(
                    game,
                    interaction.user.id
                )
                : null;

        if (
            !game ||
            game.phase !==
                "mayor_candidates" ||
            !player?.alive
        ) {
            return true;
        }

        if (
            !game.mayorCandidates
                .includes(
                    interaction.user.id
                )
        ) {
            game.mayorCandidates.push(
                interaction.user.id
            );

            saveGame(
                game
            );
        }

        await interaction.reply({
            content:
                "👑 Candidature enregistrée.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // MAYOR LEAVE
    // ==================================================

    if (
        id.startsWith(
            "lg_mayor_leave_"
        )
    ) {
        const gameId =
            id.replace(
                "lg_mayor_leave_",
                ""
            );

        const game =
            getGame(
                gameId
            );

        if (
            !game ||
            game.phase !==
                "mayor_candidates"
        ) {
            return true;
        }

        game.mayorCandidates =
            game.mayorCandidates.filter(
                candidateId =>
                    candidateId !==
                    interaction.user.id
            );

        saveGame(
            game
        );

        await interaction.reply({
            content:
                "❌ Candidature retirée.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    return false;
}

// ======================================================
// SELECT HANDLER
// ======================================================

async function handleSelect(
    interaction,
    client
) {
    const id =
        interaction.customId;

    // ==================================================
    // PRIVATE SELECT
    // ==================================================

    if (
        id.startsWith(
            "lg_action_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                2
            ];

        const token =
            parts[
                3
            ];

        const actorId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            actorId
        ) {
            return true;
        }

        const resolved =
            resolveWaiter(
                gameId,
                token,
                interaction.values
            );

        if (
            resolved
        ) {
            await interaction.update({
                content:
                    "✅ Ton choix a été enregistré.",

                embeds:
                    [],

                components:
                    []
            }).catch(
                () => {}
            );
        }

        return true;
    }

    // ==================================================
    // RULE GROUP
    // ==================================================

    if (
        id.startsWith(
            "lg_rules_group_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const userId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            userId
        ) {
            return true;
        }

        const game =
            getGame(
                gameId
            );

        if (
            !game
        ) {
            return true;
        }

        const groupId =
            interaction.values[
                0
            ];

        const embed =
            buildRoleGroupEmbed(
                game,
                groupId
            );

        const roleMenu =
            buildRoleMenu(
                game,
                userId,
                groupId
            );

        await interaction.update({
            embeds:
                embed
                    ? [
                        embed
                    ]
                    : [],

            components:
                roleMenu
                    ? [
                        roleMenu
                    ]
                    : []
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // ROLE DETAILS
    // ==================================================

    if (
        id.startsWith(
            "lg_rules_role_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const userId =
            parts[
                4
            ];

        if (
            interaction.user.id !==
            userId
        ) {
            return true;
        }

        const game =
            getGame(
                gameId
            );

        if (
            !game
        ) {
            return true;
        }

        const roleId =
            interaction.values[
                0
            ];

        if (
            !getActiveRoleIds(
                game.roleCounts
            ).includes(
                roleId
            )
        ) {
            return true;
        }

        const role =
            getRole(
                roleId
            );

        if (
            !role
        ) {
            return true;
        }

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        `${role.emoji} ${role.name}`
                    )
                    .setDescription(
                        role.roleSummary
                    )
                    .addFields({
                        name:
                            "🏆 Objectif",

                        value:
                            role.objective
                    })
            ],

            components: [
                buildRulesGroupMenu(
                    game,
                    userId
                )
            ].filter(
                Boolean
            )
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // MAYOR VOTE
    // ==================================================

    if (
        id.startsWith(
            "lg_mayor_vote_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const token =
            parts[
                4
            ];

        const game =
            getGame(
                gameId
            );

        if (
            !game ||
            ![
                "mayor_vote",
                "mayor_runoff"
            ].includes(
                game.phase
            ) ||
            game.publicVoteToken !==
                token
        ) {
            return true;
        }

        const voter =
            getPlayer(
                game,
                interaction.user.id
            );

        if (
            !voter?.alive
        ) {
            return true;
        }

        const candidateId =
            interaction.values[
                0
            ];

        if (
            !game.mayorCandidates
                .includes(
                    candidateId
                )
        ) {
            return true;
        }

        game.votes[
            interaction.user.id
        ] =
            candidateId;

        saveGame(
            game
        );

        await interaction.reply({
            content:
                "👑 Vote enregistré.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    // ==================================================
    // DAY VOTE
    // ==================================================

    if (
        id.startsWith(
            "lg_day_vote_"
        )
    ) {
        const parts =
            id.split(
                "_"
            );

        const gameId =
            parts[
                3
            ];

        const token =
            parts[
                4
            ];

        const game =
            getGame(
                gameId
            );

        if (
            !game ||
            ![
                "day_vote",
                "runoff_vote"
            ].includes(
                game.phase
            ) ||
            game.publicVoteToken !==
                token
        ) {
            return true;
        }

        if (
            !canPlayerVoteToday(
                game,
                interaction.user.id
            )
        ) {
            await interaction.reply({
                content:
                    "❌ Tu ne peux pas voter pendant ce tour.",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );

            return true;
        }

        const targetId =
            interaction.values[
                0
            ];

        const target =
            getPlayer(
                game,
                targetId
            );

        if (
            !target?.alive
        ) {
            return true;
        }

        game.votes[
            interaction.user.id
        ] =
            targetId;

        saveGame(
            game
        );

        if (
            game.config
                .anonymousVotes
        ) {
            await interaction.reply({
                content:
                    "🔒 Ton vote a été enregistré anonymement.",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );

        } else {
            await interaction.reply({
                content:
                    `🗳️ <@${interaction.user.id}> vote contre <@${targetId}>.`
            }).catch(
                () => {}
            );
        }

        return true;
    }

    return false;
}

// ======================================================
// VOICE STATE
// ======================================================

async function handleVoiceState(
    oldState,
    newState
) {
    const guild =
        newState.guild ||
        oldState.guild;

    const game =
        getGuildGame(
            guild.id
        );

    if (
        !game ||
        game.status !==
        "running"
    ) {
        return;
    }

    const member =
        newState.member ||
        oldState.member;

    if (
        !member
    ) {
        return;
    }

    await voice.enforcePlayerMute(
        guild,
        game,
        member
    );
}

// ======================================================
// AUTO RESUME
// ======================================================

async function autoResumeGames(
    client
) {
    const running =
        Object.values(
            data.games
        ).filter(
            game =>
                game.status ===
                "running"
        );

    for (
        const game
        of running
    ) {
        if (
            resumeLocks.has(
                game.id
            ) ||
            executionLocks.has(
                game.id
            )
        ) {
            continue;
        }

        await sleep(
            750
        );

        await resumeGame(
            client,
            game
        ).catch(
            error => {
                console.error(
                    `❌ Reprise automatique Loup-Garou ${game.id} :`,
                    error
                );
            }
        );
    }
}

// ======================================================
// REGISTER
// ======================================================

function register(
    client
) {
    if (
        client.__loupgarouRegistered
    ) {
        return;
    }

    client.__loupgarouRegistered =
        true;

    client.on(
        "voiceStateUpdate",
        (
            oldState,
            newState
        ) => {
            handleVoiceState(
                oldState,
                newState
            ).catch(
                console.error
            );
        }
    );

    client.loupgarou = {
        createGame,

        getGame,
        getGuildGame,

        joinGame,
        leaveGame,

        applyPreset,
        saveGame,

        resolveGameComposition,

        startGame:
            game =>
                startGame(
                    client,
                    game
                ),

        resumeGame:
            game =>
                resumeGame(
                    client,
                    game
                ),

        cancelGame:
            game =>
                cancelGame(
                    client,
                    game
                ),

        updatePublicMessage:
            game =>
                updatePublicMessage(
                    client,
                    game
                )
    };

    const recovery =
        () => {
            setTimeout(
                () => {
                    autoResumeGames(
                        client
                    ).catch(
                        console.error
                    );
                },
                5_000
            );
        };

    if (
        typeof client.isReady ===
            "function" &&
        client.isReady()
    ) {
        recovery();

    } else {
        client.once(
            "ready",
            recovery
        );
    }

    console.log(
        "🐺 Loup-Garou : ✅ système actif"
    );
}

// ======================================================
// EXPORT
// ======================================================

const loupgarouSystem = {
    CONFIG,

    createGame,

    getGame,
    getGuildGame,

    joinGame,
    leaveGame,

    applyPreset,
    saveGame,

    resolveGameComposition,

    startGame,
    resumeGame,
    cancelGame,

    checkVictory,

    buildGameEmbed,
    updatePublicMessage,

    handleButton,
    handleSelect,

    register
};

module.exports = {
    CONFIG,

    createGame,

    getGame,
    getGuildGame,

    joinGame,
    leaveGame,

    applyPreset,
    saveGame,

    resolveGameComposition,

    startGame,
    resumeGame,
    cancelGame,

    checkVictory,

    buildGameEmbed,
    updatePublicMessage,

    handleButton,
    handleSelect,

    register,

    loupgarouSystem
};