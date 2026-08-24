// ======================================================
// LOUP-GAROU — THE LEGACY
// SYSTÈME VOCAL / NARRATION / AMBIANCES
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
// DOSSIERS
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
// AUDIO
// ======================================================

const AUDIO = {
    night: {
        file: "night.mp3",

        // 1 min 09
        durationMs: 69_000,

        // ≈ 0.12 avec ambienceVolume = 0.18
        volumeMultiplier: 0.67
    },

    dawn: {
        file: "dawn.mp3",

        // 47 secondes
        durationMs: 47_000,

        // ≈ 0.06 avec ambienceVolume = 0.18
        volumeMultiplier: 0.33
    },

    vote: {
        file: "vote.mp3",

        // 2 min 17
        durationMs: 137_000,

        // ≈ 0.10 avec ambienceVolume = 0.18
        volumeMultiplier: 0.56
    },

    death: {
        file: "death.mp3",

        // 2 secondes
        durationMs: 2_000,

        volumeMultiplier: 0.34
    },

    victory: {
        file: "victory.mp3",

        // 3 secondes
        durationMs: 3_000,

        volumeMultiplier: 0.40
    }
};

// ======================================================
// OPENAI
// ======================================================

const openai =
    process.env.OPENAI_API_KEY
        ? new OpenAI({
            apiKey:
                process.env.OPENAI_API_KEY
        })
        : null;

// ======================================================
// TTS
// ======================================================

// IMPORTANT :
// Cette version est incluse dans le nom du cache.
// Donc les anciennes voix "mystérieuses" ne seront pas
// réutilisées après la modification du style vocal.

const TTS_CACHE_VERSION =
    "natural-alloy-speed15-v2";

const TTS_CONFIG = {
    model:
        "gpt-4o-mini-tts",

    voice:
        "alloy",

    speed:
        1.5,

    instructions:
        "Parle en français de façon naturelle, fluide et claire, avec un ton de maître du jeu calme, vivant et agréable. La voix doit sembler humaine et spontanée. Ne prends pas une voix sombre, inquiétante, théâtrale ou excessivement mystérieuse. Articule correctement, reste légèrement immersif, mais parle comme quelqu'un qui anime naturellement une partie entre amis."
};

// ======================================================
// RUNTIME
// ======================================================

const runtimes =
    new Map();

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
        "Le jour se lève sur le village.",

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
// DOSSIERS
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
// OUTILS
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

function getAssetPath(
    name
) {
    if (!name) {
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

            // Sons ponctuels + TTS
            queue:
                [],

            processing:
                false,

            currentResolve:
                null,

            currentType:
                null,

            // Ambiance actuelle
            ambienceEnabled:
                false,

            ambienceName:
                null,

            ambienceFile:
                null,

            ambienceVolumeMultiplier:
                1,

            // Permet d'éviter qu'un ancien Idle
            // relance une mauvaise ambiance.
            ambienceGeneration:
                0,

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

                handleAudioFinished(
                    runtime
                );
            }
        );

        player.on(
            AudioPlayerStatus.Idle,
            () => {
                handleAudioFinished(
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
// FIN D'UN AUDIO
// ======================================================

function handleAudioFinished(
    runtime
) {
    // ==================================================
    // FIN D'UNE ACTION QUEUE
    // ==================================================

    if (
        runtime.currentType ===
        "queue"
    ) {
        const resolve =
            runtime.currentResolve;

        runtime.currentResolve =
            null;

        runtime.currentType =
            null;

        runtime.processing =
            false;

        resolve?.();

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

        return;
    }

    // ==================================================
    // FIN D'UNE BOUCLE D'AMBIANCE
    // ==================================================

    if (
        runtime.currentType ===
        "ambience"
    ) {
        runtime.currentType =
            null;

        if (
            runtime.queue.length
        ) {
            processQueue(
                runtime
            ).catch(
                () => {}
            );

            return;
        }

        if (
            runtime.ambienceEnabled &&
            runtime.ambienceFile
        ) {
            setTimeout(
                () => {
                    if (
                        runtime.ambienceEnabled &&
                        !runtime.processing &&
                        !runtime.queue.length &&
                        runtime.currentType ===
                            null
                    ) {
                        playAmbienceNow(
                            runtime
                        );
                    }
                },
                100
            );
        }

        return;
    }

    // ==================================================
    // RIEN EN COURS
    // ==================================================

    if (
        runtime.queue.length
    ) {
        processQueue(
            runtime
        ).catch(
            () => {}
        );

        return;
    }

    if (
        runtime.ambienceEnabled &&
        runtime.ambienceFile
    ) {
        playAmbienceNow(
            runtime
        );
    }
}

// ======================================================
// VOLUMES
// ======================================================

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
    if (!guild) {
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

    if (connection) {
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

    if (runtime) {
        stopAmbience(
            guildId
        );

        runtime.queue =
            [];

        runtime.processing =
            false;

        runtime.currentType =
            null;

        runtime.currentResolve =
            null;

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

    if (connection) {
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

    const source =
        `${TTS_CACHE_VERSION}|${text}`;

    for (
        let index = 0;
        index < source.length;
        index++
    ) {
        hash =
            (
                (
                    hash << 5
                ) -
                hash
            ) +
            source.charCodeAt(
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

    if (!openai) {
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
                    TTS_CONFIG.model,

                voice:
                    TTS_CONFIG.voice,

                input:
                    text,

                instructions:
                    TTS_CONFIG.instructions,

                speed:
                    TTS_CONFIG.speed
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

            // Si une ambiance tourne actuellement,
            // le TTS / SFX la coupe immédiatement.
            // Elle reprendra automatiquement ensuite.
            if (
                runtime.currentType ===
                "ambience"
            ) {
                runtime.player.stop(
                    true
                );
            } else {
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
        runtime.processing ||
        runtime.currentType ===
            "queue"
    ) {
        return;
    }

    // Une ambiance est encore en train de s'arrêter.
    if (
        runtime.currentType ===
        "ambience"
    ) {
        runtime.player.stop(
            true
        );

        return;
    }

    const action =
        runtime.queue.shift();

    if (!action) {
        if (
            runtime.ambienceEnabled &&
            runtime.ambienceFile
        ) {
            playAmbienceNow(
                runtime
            );
        }

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

    if (!connection) {
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
        Number.isFinite(
            action.volume
        )
    ) {
        volume =
            action.volume;
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

        runtime.currentType =
            "queue";

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

        runtime.currentType =
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
    if (!text) {
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

    if (!text) {
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
    filename,
    {
        volume = null
    } = {}
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

    if (!filePath) {
        console.warn(
            `⚠️ Audio Loup-Garou absent : ${filename}`
        );

        return;
    }

    return enqueue(
        guildId,
        {
            type:
                "sound",

            filePath,

            volume:
                Number.isFinite(
                    volume
                )
                    ? volume
                    : runtime.volumes.sounds
        }
    );
}

// ======================================================
// AMBIANCE — LECTURE
// ======================================================

function playAmbienceNow(
    runtime
) {
    if (
        !runtime ||
        !runtime.ambienceEnabled ||
        !runtime.ambienceFile ||
        runtime.processing ||
        runtime.queue.length ||
        runtime.currentType
    ) {
        return;
    }

    if (
        !fs.existsSync(
            runtime.ambienceFile
        )
    ) {
        runtime.ambienceEnabled =
            false;

        runtime.ambienceFile =
            null;

        runtime.ambienceName =
            null;

        return;
    }

    const connection =
        runtime.connection ||
        getVoiceConnection(
            runtime.guildId
        );

    if (!connection) {
        return;
    }

    runtime.connection =
        connection;

    connection.subscribe(
        runtime.player
    );

    try {
        const resource =
            createAudioResource(
                runtime.ambienceFile,
                {
                    inlineVolume:
                        true
                }
            );

        const volume =
            clampVolume(
                runtime.volumes.ambience *
                    runtime.ambienceVolumeMultiplier,
                0.06
            );

        resource.volume?.setVolume(
            volume
        );

        runtime.currentType =
            "ambience";

        runtime.player.play(
            resource
        );

    } catch (error) {
        console.error(
            "❌ Ambiance Loup-Garou :",
            error
        );

        runtime.currentType =
            null;
    }
}

// ======================================================
// START AMBIENCE
// ======================================================

function startAmbience(
    guildId,
    ambienceName
) {
    const runtime =
        getRuntime(
            guildId
        );

    if (
        runtime.discreteMode
    ) {
        stopAmbience(
            guildId
        );

        return false;
    }

    const config =
        AUDIO[
            ambienceName
        ];

    if (!config) {
        return false;
    }

    const filePath =
        getAssetPath(
            config.file
        );

    if (!filePath) {
        console.warn(
            `⚠️ Ambiance Loup-Garou absente : ${config.file}`
        );

        return false;
    }

    runtime.ambienceGeneration++;

    runtime.ambienceEnabled =
        true;

    runtime.ambienceName =
        ambienceName;

    runtime.ambienceFile =
        filePath;

    runtime.ambienceVolumeMultiplier =
        config.volumeMultiplier;

    // Changement d'ambiance immédiat.
    if (
        runtime.currentType ===
        "ambience"
    ) {
        runtime.player.stop(
            true
        );

        return true;
    }

    // Si aucun TTS/SFX n'est en cours,
    // on lance immédiatement l'ambiance.
    if (
        !runtime.processing &&
        !runtime.queue.length &&
        runtime.currentType ===
            null
    ) {
        playAmbienceNow(
            runtime
        );
    }

    return true;
}

// ======================================================
// STOP AMBIENCE
// ======================================================

function stopAmbience(
    guildId
) {
    const runtime =
        runtimes.get(
            guildId
        );

    if (!runtime) {
        return;
    }

    runtime.ambienceGeneration++;

    runtime.ambienceEnabled =
        false;

    runtime.ambienceName =
        null;

    runtime.ambienceFile =
        null;

    runtime.ambienceVolumeMultiplier =
        1;

    if (
        runtime.currentType ===
        "ambience"
    ) {
        runtime.player.stop(
            true
        );
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
    // Coupe Dawn / Vote immédiatement.
    stopAmbience(
        guildId
    );

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

    if (ambience) {
        startAmbience(
            guildId,
            "night"
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
    // Arrête night.mp3
    stopAmbience(
        guildId
    );

    await narrateKeyAndWait(
        guildId,
        "dawn"
    );

    // Dawn devient ensuite l'ambiance très discrète
    // de la journée.
    if (ambience) {
        startAmbience(
            guildId,
            "dawn"
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
    // Arrête dawn.mp3
    stopAmbience(
        guildId
    );

    await narrateKeyAndWait(
        guildId,
        "vote"
    );

    if (ambience) {
        startAmbience(
            guildId,
            "vote"
        );
    }
}

// ======================================================
// DEATH AUDIO
// ======================================================

async function deathAudio(
    guildId
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

    const config =
        AUDIO.death;

    const volume =
        clampVolume(
            runtime.volumes.sounds *
                config.volumeMultiplier,
            0.22
        );

    // L'ambiance est interrompue 2 secondes,
    // puis reprend automatiquement depuis le début.
    return playSound(
        guildId,
        config.file,
        {
            volume
        }
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
    // Plus aucune ambiance en boucle à la fin.
    stopAmbience(
        guildId
    );

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
        const runtime =
            getRuntime(
                guildId
            );

        const config =
            AUDIO.victory;

        const volume =
            clampVolume(
                runtime.volumes.sounds *
                    config.volumeMultiplier,
                0.25
            );

        await playSound(
            guildId,
            config.file,
            {
                volume
            }
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
    // Le système appelle déjà muteDeadPlayer()
    // lorsqu'une vraie mort est enregistrée.
    // On en profite donc pour déclencher death.mp3
    // sans avoir besoin de modifier loupgarou.js.

    await deathAudio(
        guild.id
    ).catch(
        () => {}
    );

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

    if (!player) {
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

    startAmbience,
    stopAmbience,

    muteLivingPlayersForNight,
    unmuteLivingPlayersForDay,

    muteDeadPlayer,
    restoreAllMutes,
    enforcePlayerMute
};