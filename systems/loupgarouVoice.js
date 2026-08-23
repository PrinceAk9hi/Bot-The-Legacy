// ======================================================
// LOUP-GAROU — THE LEGACY
// SYSTÈME VOCAL / NARRATION
// ======================================================

const fs = require("fs");
const path = require("path");

const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior
} = require("@discordjs/voice");

const OpenAI = require("openai");

// ======================================================
// CONFIG
// ======================================================

const ASSETS_DIR = path.join(
    __dirname,
    "..",
    "assets",
    "loupgarou"
);

const CACHE_DIR = path.join(
    __dirname,
    "..",
    "data",
    "loupgarou-audio-cache"
);

// ======================================================
// OPENAI
// ======================================================

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    })
    : null;

// ======================================================
// RUNTIME
// ======================================================

const runtimes = new Map();

// ======================================================
// NARRATIONS
// ======================================================

const NARRATIONS = {
    gameStart:
        "La partie de Loup-Garou commence. Chacun découvre son rôle. Gardez votre identité secrète.",

    nightStart:
        "La nuit tombe sur le village. Tous les habitants ferment les yeux.",

    firstNight:
        "La première nuit commence. Certains rôles vont maintenant découvrir leurs pouvoirs.",

    dawn:
        "Le jour se lève doucement sur le village.",

    discussion:
        "Le village peut maintenant discuter. Observez, accusez et défendez-vous.",

    election:
        "Le village va maintenant élire son maire.",

    vote:
        "Le vote du village commence.",

    cupidWake:
        "Cupidon se réveille.",

    cupidSleep:
        "Cupidon se rendort.",

    guardWake:
        "Le Salvateur se réveille et choisit la personne qu'il souhaite protéger.",

    guardSleep:
        "Le Salvateur se rendort.",

    seerWake:
        "La Voyante se réveille et observe secrètement un habitant.",

    seerSleep:
        "La Voyante se rendort.",

    foxWake:
        "Le Renard se réveille et commence son inspection.",

    foxSleep:
        "Le Renard se rendort.",

    wolvesWake:
        "La Meute se réveille et choisit secrètement sa victime.",

    wolvesSleep:
        "La Meute se rendort.",

    witchWake:
        "La Sorcière se réveille.",

    witchSleep:
        "La Sorcière se rendort.",

    victoryVillage:
        "La menace lupine a disparu. Le Village remporte la partie.",

    victoryWolves:
        "La Meute contrôle désormais le village. Les Loups remportent la partie.",

    victorySolo:
        "Une victoire solitaire vient de mettre fin à la partie.",

    victoryLovers:
        "Les Amoureux ont survécu ensemble. Ils remportent la partie.",

    victoryDraw:
        "La partie se termine sans vainqueur."
};

// ======================================================
// FICHIERS
// ======================================================

function ensureDirectories() {
    if (
        !fs.existsSync(
            CACHE_DIR
        )
    ) {
        fs.mkdirSync(
            CACHE_DIR,
            {
                recursive: true
            }
        );
    }
}

// ======================================================
// RUNTIME
// ======================================================

function getRuntime(
    guildId
) {
    if (
        !runtimes.has(
            guildId
        )
    ) {
        const player =
            createAudioPlayer({
                behaviors: {
                    noSubscriber:
                        NoSubscriberBehavior.Play
                }
            });

        const runtime = {
            guildId,

            player,

            connection:
                null,

            queue:
                [],

            processing:
                false,

            currentResolve:
                null,

            ambienceTimer:
                null,

            ambienceEnabled:
                false,

            ambienceFile:
                null,

            volumes: {
                narration:
                    1,

                sounds:
                    0.65,

                ambience:
                    0.18
            },

            discreteMode:
                false
        };

        player.on(
            "error",
            error => {
                console.error(
                    `❌ Audio Loup-Garou ${guildId} :`,
                    error
                );

                finishCurrentAudio(
                    runtime
                );
            }
        );

        player.on(
            AudioPlayerStatus.Idle,
            () => {
                finishCurrentAudio(
                    runtime
                );
            }
        );

        runtimes.set(
            guildId,
            runtime
        );
    }

    return runtimes.get(
        guildId
    );
}

// ======================================================
// FIN AUDIO
// ======================================================

function finishCurrentAudio(
    runtime
) {
    if (
        runtime.currentResolve
    ) {
        const resolve =
            runtime.currentResolve;

        runtime.currentResolve =
            null;

        resolve();
    }

    runtime.processing =
        false;

    processQueue(
        runtime
    ).catch(
        error => {
            console.error(
                "❌ Queue audio Loup-Garou :",
                error
            );
        }
    );
}

// ======================================================
// VOLUMES
// ======================================================

function clampVolume(
    value,
    fallback
) {
    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {
        return fallback;
    }

    return Math.max(
        0,
        Math.min(
            number,
            2
        )
    );
}

function setVolumes(
    guildId,
    {
        narration,
        sounds,
        ambience
    } = {}
) {
    const runtime =
        getRuntime(
            guildId
        );

    runtime.volumes.narration =
        clampVolume(
            narration,
            runtime.volumes.narration
        );

    runtime.volumes.sounds =
        clampVolume(
            sounds,
            runtime.volumes.sounds
        );

    runtime.volumes.ambience =
        clampVolume(
            ambience,
            runtime.volumes.ambience
        );

    return {
        ...runtime.volumes
    };
}

// ======================================================
// MODE DISCRET
// ======================================================

function setDiscreteMode(
    guildId,
    enabled
) {
    const runtime =
        getRuntime(
            guildId
        );

    runtime.discreteMode =
        Boolean(
            enabled
        );

    return runtime.discreteMode;
}

// ======================================================
// CONNECTION
// ======================================================

async function connectToVoice(
    guild,
    channelId
) {
    if (
        !guild
    ) {
        throw new Error(
            "Serveur Discord introuvable."
        );
    }

    const channel =
        guild.channels.cache.get(
            channelId
        ) ||
        await guild.channels
            .fetch(
                channelId
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isVoiceBased()
    ) {
        throw new Error(
            "Le salon sélectionné n'est pas un salon vocal valide."
        );
    }

    let connection =
        getVoiceConnection(
            guild.id
        );

    if (
        connection
    ) {
        try {
            connection.destroy();
        } catch {}
    }

    connection =
        joinVoiceChannel({
            channelId:
                channel.id,

            guildId:
                guild.id,

            adapterCreator:
                guild.voiceAdapterCreator,

            selfDeaf:
                true,

            selfMute:
                false
        });

    await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        15_000
    );

    const runtime =
        getRuntime(
            guild.id
        );

    runtime.connection =
        connection;

    connection.subscribe(
        runtime.player
    );

    return connection;
}

// ======================================================
// DISCONNECT
// ======================================================

function disconnect(
    guildId
) {
    const runtime =
        runtimes.get(
            guildId
        );

    if (
        runtime
    ) {
        stopAmbience(
            guildId
        );

        runtime.queue =
            [];

        try {
            runtime.player.stop(
                true
            );
        } catch {}
    }

    const connection =
        getVoiceConnection(
            guildId
        );

    if (
        connection
    ) {
        try {
            connection.destroy();
        } catch {}
    }

    runtimes.delete(
        guildId
    );
}

// ======================================================
// TTS CACHE NAME
// ======================================================

function makeSafeName(
    text
) {
    let hash =
        0;

    for (
        let index = 0;
        index < text.length;
        index++
    ) {
        hash =
            (
                (
                    hash << 5
                ) -
                hash
            ) +
            text.charCodeAt(
                index
            );

        hash |= 0;
    }

    return Math.abs(
        hash
    ).toString(
        36
    );
}

// ======================================================
// GENERATE TTS
// ======================================================

async function generateTTS(
    text
) {
    ensureDirectories();

    if (
        !openai
    ) {
        return null;
    }

    const filename =
        `tts-${makeSafeName(text)}.mp3`;

    const filePath =
        path.join(
            CACHE_DIR,
            filename
        );

    if (
        fs.existsSync(
            filePath
        )
    ) {
        return filePath;
    }

    try {
        const response =
            await openai.audio.speech.create({
                model:
                    "gpt-4o-mini-tts",

                voice:
                    "onyx",

                input:
                    text,

                instructions:
                    "Parle en français avec une voix sombre, mystérieuse, calme et immersive, comme le narrateur d'une partie de Loup-Garou."
            });

        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        fs.writeFileSync(
            filePath,
            buffer
        );

        return filePath;

    } catch (error) {
        console.error(
            "❌ Génération TTS Loup-Garou :",
            error.message
        );

        return null;
    }
}

// ======================================================
// AUDIO FILE
// ======================================================

function getAssetPath(
    name
) {
    if (
        !name
    ) {
        return null;
    }

    const filePath =
        path.join(
            ASSETS_DIR,
            name
        );

    return fs.existsSync(
        filePath
    )
        ? filePath
        : null;
}

// ======================================================
// QUEUE
// ======================================================

function enqueue(
    guildId,
    action
) {
    const runtime =
        getRuntime(
            guildId
        );

    return new Promise(
        resolve => {
            runtime.queue.push({
                ...action,
                resolve
            });

            processQueue(
                runtime
            ).catch(
                error => {
                    console.error(
                        "❌ Queue audio :",
                        error
                    );

                    resolve();
                }
            );
        }
    );
}

// ======================================================
// PROCESS QUEUE
// ======================================================

async function processQueue(
    runtime
) {
    if (
        runtime.processing
    ) {
        return;
    }

    const action =
        runtime.queue.shift();

    if (
        !action
    ) {
        return;
    }

    runtime.processing =
        true;

    let filePath =
        action.filePath ||
        null;

    if (
        action.text
    ) {
        filePath =
            await generateTTS(
                action.text
            );
    }

    if (
        !filePath ||
        !fs.existsSync(
            filePath
        )
    ) {
        runtime.processing =
            false;

        action.resolve?.();

        processQueue(
            runtime
        ).catch(
            () => {}
        );

        return;
    }

    const connection =
        runtime.connection ||
        getVoiceConnection(
            runtime.guildId
        );

    if (
        !connection
    ) {
        runtime.processing =
            false;

        action.resolve?.();

        processQueue(
            runtime
        ).catch(
            () => {}
        );

        return;
    }

    runtime.connection =
        connection;

    connection.subscribe(
        runtime.player
    );

    let volume =
        runtime.volumes.sounds;

    if (
        action.type ===
        "narration"
    ) {
        volume =
            runtime.volumes.narration;
    }

    if (
        action.type ===
        "ambience"
    ) {
        volume =
            runtime.volumes.ambience;
    }

    try {
        const resource =
            createAudioResource(
                filePath,
                {
                    inlineVolume:
                        true
                }
            );

        if (
            resource.volume
        ) {
            resource.volume
                .setVolume(
                    volume
                );
        }

        runtime.currentResolve =
            action.resolve;

        runtime.player.play(
            resource
        );

    } catch (error) {
        console.error(
            "❌ Lecture audio Loup-Garou :",
            error
        );

        runtime.currentResolve =
            null;

        runtime.processing =
            false;

        action.resolve?.();

        processQueue(
            runtime
        ).catch(
            () => {}
        );
    }
}

// ======================================================
// NARRATION
// ======================================================

async function narrateAndWait(
    guildId,
    text
) {
    if (
        !text
    ) {
        return;
    }

    return enqueue(
        guildId,
        {
            type:
                "narration",

            text
        }
    );
}

// ======================================================
// NARRATION KEY
// ======================================================

async function narrateKeyAndWait(
    guildId,
    key
) {
    const text =
        NARRATIONS[
            key
        ];

    if (
        !text
    ) {
        return;
    }

    return narrateAndWait(
        guildId,
        text
    );
}

// ======================================================
// SOUND
// ======================================================

async function playSound(
    guildId,
    filename
) {
    const runtime =
        getRuntime(
            guildId
        );

    if (
        runtime.discreteMode
    ) {
        return;
    }

    const filePath =
        getAssetPath(
            filename
        );

    if (
        !filePath
    ) {
        return;
    }

    return enqueue(
        guildId,
        {
            type:
                "sound",

            filePath
        }
    );
}

// ======================================================
// AMBIENCE
// ======================================================

function stopAmbience(
    guildId
) {
    const runtime =
        runtimes.get(
            guildId
        );

    if (
        !runtime
    ) {
        return;
    }

    runtime.ambienceEnabled =
        false;

    runtime.ambienceFile =
        null;

    if (
        runtime.ambienceTimer
    ) {
        clearTimeout(
            runtime.ambienceTimer
        );

        runtime.ambienceTimer =
            null;
    }
}

// ======================================================
// NIGHT AUDIO
// ======================================================

async function beginNightAudio(
    guildId,
    {
        firstNight = false,
        ambience = true
    } = {}
) {
    if (
        firstNight
    ) {
        await narrateKeyAndWait(
            guildId,
            "firstNight"
        );
    } else {
        await narrateKeyAndWait(
            guildId,
            "nightStart"
        );
    }

    if (
        ambience
    ) {
        await playSound(
            guildId,
            "night.mp3"
        );
    }
}

// ======================================================
// DAWN AUDIO
// ======================================================

async function beginDawnAudio(
    guildId,
    {
        ambience = true
    } = {}
) {
    await narrateKeyAndWait(
        guildId,
        "dawn"
    );

    if (
        ambience
    ) {
        await playSound(
            guildId,
            "dawn.mp3"
        );
    }
}

// ======================================================
// VOTE AUDIO
// ======================================================

async function beginVoteAudio(
    guildId,
    {
        ambience = true
    } = {}
) {
    await narrateKeyAndWait(
        guildId,
        "vote"
    );

    if (
        ambience
    ) {
        await playSound(
            guildId,
            "vote.mp3"
        );
    }
}

// ======================================================
// DEATH AUDIO
// ======================================================

async function deathAudio(
    guildId
) {
    return playSound(
        guildId,
        "death.mp3"
    );
}

// ======================================================
// VICTORY AUDIO
// ======================================================

async function victoryAudio(
    guildId,
    winnerType,
    {
        ambience = true
    } = {}
) {
    let key =
        "victorySolo";

    if (
        winnerType ===
        "village"
    ) {
        key =
            "victoryVillage";
    }

    if (
        winnerType ===
        "wolves"
    ) {
        key =
            "victoryWolves";
    }

    if (
        winnerType ===
        "lovers"
    ) {
        key =
            "victoryLovers";
    }

    if (
        winnerType ===
        "draw"
    ) {
        key =
            "victoryDraw";
    }

    await narrateKeyAndWait(
        guildId,
        key
    );

    if (
        ambience
    ) {
        await playSound(
            guildId,
            "victory.mp3"
        );
    }
}

// ======================================================
// MEMBER FETCH
// ======================================================

async function getMember(
    guild,
    userId
) {
    return (
        guild.members.cache.get(
            userId
        ) ||
        await guild.members
            .fetch(
                userId
            )
            .catch(
                () => null
            )
    );
}

// ======================================================
// NIGHT MUTE
// ======================================================

async function muteLivingPlayersForNight(
    guild,
    game
) {
    for (
        const player
        of game.players ||
        []
    ) {
        if (
            !player.alive
        ) {
            continue;
        }

        const member =
            await getMember(
                guild,
                player.userId
            );

        if (
            !member ||
            member.voice.channelId !==
                game.voiceChannelId
        ) {
            continue;
        }

        if (
            !member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    true,
                    "Loup-Garou • Nuit"
                )
                .catch(
                    () => {}
                );
        }
    }
}

// ======================================================
// DAY UNMUTE
// ======================================================

async function unmuteLivingPlayersForDay(
    guild,
    game
) {
    for (
        const player
        of game.players ||
        []
    ) {
        const member =
            await getMember(
                guild,
                player.userId
            );

        if (
            !member ||
            member.voice.channelId !==
                game.voiceChannelId
        ) {
            continue;
        }

        if (
            !player.alive
        ) {
            if (
                !member.voice.serverMute
            ) {
                await member.voice
                    .setMute(
                        true,
                        "Loup-Garou • Spectateur"
                    )
                    .catch(
                        () => {}
                    );
            }

            continue;
        }

        const baseline =
            Boolean(
                game.voiceMuteBaseline
                    ?.[player.userId]
            );

        if (
            !baseline &&
            member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    false,
                    "Loup-Garou • Jour"
                )
                .catch(
                    () => {}
                );
        }
    }
}

// ======================================================
// DEAD PLAYER
// ======================================================

async function muteDeadPlayer(
    guild,
    userId
) {
    const member =
        await getMember(
            guild,
            userId
        );

    if (
        !member?.voice.channelId
    ) {
        return;
    }

    if (
        !member.voice.serverMute
    ) {
        await member.voice
            .setMute(
                true,
                "Loup-Garou • Joueur mort"
            )
            .catch(
                () => {}
            );
    }
}

// ======================================================
// RESTORE MUTES
// ======================================================

async function restoreAllMutes(
    guild,
    game
) {
    for (
        const player
        of game.players ||
        []
    ) {
        const member =
            await getMember(
                guild,
                player.userId
            );

        if (
            !member?.voice.channelId
        ) {
            continue;
        }

        const baseline =
            Boolean(
                game.voiceMuteBaseline
                    ?.[player.userId]
            );

        if (
            member.voice.serverMute !==
            baseline
        ) {
            await member.voice
                .setMute(
                    baseline,
                    "Loup-Garou • Fin de partie"
                )
                .catch(
                    () => {}
                );
        }
    }
}

// ======================================================
// ENFORCE MUTE
// ======================================================

async function enforcePlayerMute(
    guild,
    game,
    member
) {
    if (
        !member ||
        !game ||
        member.voice.channelId !==
            game.voiceChannelId
    ) {
        return;
    }

    const player =
        game.players?.find(
            entry =>
                entry.userId ===
                member.id
        );

    if (
        !player
    ) {
        return;
    }

    const nightPhase =
        [
            "night",
            "dawn",
            "hunter"
        ].includes(
            game.phase
        );

    if (
        !player.alive ||
        nightPhase
    ) {
        if (
            !member.voice.serverMute
        ) {
            await member.voice
                .setMute(
                    true,
                    "Loup-Garou • Contrôle vocal"
                )
                .catch(
                    () => {}
                );
        }

        return;
    }

    const baseline =
        Boolean(
            game.voiceMuteBaseline
                ?.[member.id]
        );

    if (
        !baseline &&
        member.voice.serverMute
    ) {
        await member.voice
            .setMute(
                false,
                "Loup-Garou • Contrôle vocal"
            )
            .catch(
                () => {}
            );
    }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    setVolumes,
    setDiscreteMode,

    connectToVoice,
    disconnect,

    narrateAndWait,
    narrateKeyAndWait,

    beginNightAudio,
    beginDawnAudio,
    beginVoteAudio,

    deathAudio,
    victoryAudio,

    playSound,

    stopAmbience,

    muteLivingPlayersForNight,
    unmuteLivingPlayersForDay,

    muteDeadPlayer,
    restoreAllMutes,
    enforcePlayerMute
};