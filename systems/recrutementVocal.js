const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const OpenAI = require("openai");

const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");

// ======================================================
// CONFIG
// ======================================================

const WAITING_VOICE_ID =
    "1468699345443356885";

const VOICE_GROUP =
    "soul-recruitment-waiting";

const BUTTON_ID =
    "recruitment_replay";

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const PANEL_FILE =
    path.join(
        DATA_DIR,
        "recruitmentVoicePanel.json"
    );

const RAW_AUDIO_FILE =
    path.join(
        DATA_DIR,
        "recruitmentProcess_raw.mp3"
    );

const AUDIO_FILE =
    path.join(
        DATA_DIR,
        "recruitmentProcess.mp3"
    );

// Vitesse réelle appliquée par FFmpeg
const AUDIO_SPEED =
    1.18;

// ======================================================
// OPENAI
// ======================================================

let openai = null;

function getOpenAI() {
    if (openai) {
        return openai;
    }

    if (!process.env.OPENAI_API_KEY) {
        throw new Error(
            "OPENAI_API_KEY_MISSING"
        );
    }

    openai =
        new OpenAI({
            apiKey:
                process.env.OPENAI_API_KEY
        });

    return openai;
}

// ======================================================
// ÉTAT
// ======================================================

const guildStates =
    new Map();

function getGuildState(
    guildId
) {
    if (
        !guildStates.has(
            guildId
        )
    ) {
        guildStates.set(
            guildId,
            {
                speaking:
                    false,

                connection:
                    null,

                player:
                    null
            }
        );
    }

    return guildStates.get(
        guildId
    );
}

// ======================================================
// TEXTE ORAL
// ======================================================

const SPEECH_TEXT = `
Bienvenue dans l'espace d'attente des recrutements de Soul Society.

Avant de commencer, merci de rester tranquillement dans ce salon vocal et d'écouter attentivement les explications qui vont suivre.

Pendant votre attente, pensez à vérifier votre micro et assurez-vous de pouvoir correctement parler et entendre les recruteurs.

Toutes les informations importantes que je vais vous expliquer sont également écrites directement dans les messages de ce salon vocal.

Si vous souhaitez relire tranquillement le déroulement du recrutement, vous pouvez donc consulter le message prévu à cet effet.

Les candidats seront pris un par un par les recruteurs.

Il est donc totalement normal que certaines personnes passent avant vous et que l'attente soit parfois plus longue que prévu.

Un retard ne signifie absolument pas que vous avez été oublié.

Merci donc de patienter calmement, de ne pas quitter et rejoindre le vocal à répétition, de ne pas spammer les recruteurs, et de ne pas demander constamment quand viendra votre tour.

Prenez votre temps pour répondre et restez naturel.

Votre entretien se déroulera en trois grandes étapes.

Première étape : la présentation.

Lorsque vous serez déplacé avec les recruteurs, vous commencerez par vous présenter.

Deuxième étape : les questions.

Les recruteurs vous poseront ensuite différentes questions afin de mieux comprendre votre motivation, votre sérieux, votre comportement et votre façon de réfléchir.

Troisième étape : les mises en situation.

Vous pourrez ensuite recevoir plusieurs situations fictives.

Expliquez simplement ce que vous feriez et pourquoi vous le feriez dans certains cas.

Une fois ces trois étapes terminées, vous serez replacé dans ce salon vocal d'attente.

Les recruteurs discuteront alors entre eux afin de prendre leur décision.

Merci de rester dans ce salon vocal sans bouger.

Lorsque les recruteurs auront terminé leur délibération et auront leur réponse, vous serez déplacé de nouveau afin de recevoir votre résultat ainsi que les informations concernant la suite.

Et pour rappel : vous pouvez également retrouver toutes ces explications par écrit directement dans les messages de ce salon vocal.

Merci pour votre patience, votre sérieux et votre intérêt pour Soul Society.

Nous vous souhaitons bonne chance pour votre entretien.
`;

// ======================================================
// DATA
// ======================================================

function ensureDataFiles() {
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
            PANEL_FILE
        )
    ) {
        fs.writeFileSync(
            PANEL_FILE,
            "{}",
            "utf8"
        );
    }
}

function getPanelData() {
    ensureDataFiles();

    try {
        const raw =
            fs.readFileSync(
                PANEL_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return {};
        }

        return JSON.parse(
            raw
        );

    } catch (error) {
        console.error(
            "❌ recruitmentVoicePanel.json :",
            error
        );

        return {};
    }
}

function savePanelData(
    data
) {
    ensureDataFiles();

    fs.writeFileSync(
        PANEL_FILE,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );
}

// ======================================================
// EMBED
// ======================================================

function createRecruitmentEmbed() {
    return new EmbedBuilder()
        .setColor(
            SOUL_COLORS.primary
        )
        .setTitle(
            "🎙️ Déroulement des recrutements"
        )
        .setDescription(
            [
                "Bienvenue dans l'espace d'attente des recrutements **Soul Society**.",
                "",
                "Les candidats sont pris **un par un**. Il peut donc y avoir un délai avant votre passage.",
                "",
                "📖 **Toutes les explications données oralement sont également disponibles ci-dessous.**",
                "",
                "Merci de rester disponible et de patienter calmement."
            ].join("\n")
        )
        .addFields(
            {
                name:
                    "🎤 Avant votre passage",

                value:
                    "Vérifiez votre micro et assurez-vous de pouvoir correctement parler et entendre les recruteurs."
            },

            {
                name:
                    "1️⃣ Présentation",

                value:
                    "Lorsque vous serez déplacé avec les recruteurs, vous commencerez par vous présenter."
            },

            {
                name:
                    "2️⃣ Questions",

                value:
                    "Les recruteurs vous poseront plusieurs questions afin de mieux comprendre votre motivation, votre sérieux, votre comportement et votre façon de réfléchir."
            },

            {
                name:
                    "3️⃣ Mises en situation",

                value:
                    "Vous recevrez ensuite différentes situations fictives et devrez expliquer comment vous réagiriez."
            },

            {
                name:
                    "⏳ Après l'entretien",

                value:
                    "Vous reviendrez dans ce salon pendant la délibération. Restez ici sans bouger. Lorsque les recruteurs auront leur réponse, vous serez déplacé de nouveau."
            },

            {
                name:
                    "📌 Important",

                value:
                    [
                        "• Les candidats passent un par un.",
                        "• Un retard ne signifie pas que vous avez été oublié.",
                        "• Ne spammez pas les recruteurs.",
                        "• Évitez les allers-retours inutiles.",
                        "• Restez disponible dans ce vocal."
                    ].join("\n")
            }
        )
        .setFooter({
            text:
                "Soul Society • Recrutements"
        });
}

// ======================================================
// BOUTON
// ======================================================

function createRecruitmentComponents(
    disabled = false
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        BUTTON_ID
                    )
                    .setLabel(
                        disabled
                            ? "Lecture en cours"
                            : "Réécouter"
                    )
                    .setEmoji(
                        disabled
                            ? "⏳"
                            : "🔊"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disabled
                    )
            )
    ];
}

// ======================================================
// PANEL
// ======================================================

async function getWaitingChannel(
    guild
) {
    return (
        guild.channels.cache.get(
            WAITING_VOICE_ID
        ) ||
        await guild.channels
            .fetch(
                WAITING_VOICE_ID
            )
            .catch(
                () => null
            )
    );
}

async function getPermanentPanel(
    guild
) {
    const data =
        getPanelData();

    const messageId =
        data[
            guild.id
        ]?.messageId;

    if (!messageId) {
        return null;
    }

    const channel =
        await getWaitingChannel(
            guild
        );

    if (!channel) {
        return null;
    }

    return channel.messages
        .fetch(
            messageId
        )
        .catch(
            () => null
        );
}

async function setReplayButtonState(
    guild,
    disabled
) {
    const message =
        await getPermanentPanel(
            guild
        );

    if (!message) {
        return;
    }

    await message.edit({
        embeds: [
            createRecruitmentEmbed()
        ],

        components:
            createRecruitmentComponents(
                disabled
            )
    }).catch(
        error => {
            console.error(
                "❌ Bouton recrutement :",
                error.message
            );
        }
    );
}

async function ensurePermanentPanel(
    guild
) {
    const channel =
        await getWaitingChannel(
            guild
        );

    if (
        !channel ||
        typeof channel.send !==
            "function"
    ) {
        console.log(
            "⚠️ Impossible d'envoyer le panel recrutement."
        );

        return;
    }

    const data =
        getPanelData();

    const messageId =
        data[
            guild.id
        ]?.messageId;

    if (messageId) {
        const existing =
            await channel.messages
                .fetch(
                    messageId
                )
                .catch(
                    () => null
                );

        if (existing) {
            await existing.edit({
                embeds: [
                    createRecruitmentEmbed()
                ],

                components:
                    createRecruitmentComponents(
                        false
                    )
            });

            console.log(
                "✅ Panel recrutement déjà présent."
            );

            return;
        }
    }

    const messages =
        await channel.messages
            .fetch({
                limit:
                    50
            })
            .catch(
                () => null
            );

    if (messages) {
        const oldPanel =
            messages.find(
                message =>
                    message.author.id ===
                        guild.members.me.id &&
                    message.components.some(
                        row =>
                            row.components.some(
                                component =>
                                    component.customId ===
                                    BUTTON_ID
                            )
                    )
            );

        if (oldPanel) {
            data[
                guild.id
            ] = {
                messageId:
                    oldPanel.id
            };

            savePanelData(
                data
            );

            await oldPanel.edit({
                embeds: [
                    createRecruitmentEmbed()
                ],

                components:
                    createRecruitmentComponents(
                        false
                    )
            });

            console.log(
                "✅ Ancien panel recrutement retrouvé."
            );

            return;
        }
    }

    const message =
        await channel.send({
            embeds: [
                createRecruitmentEmbed()
            ],

            components:
                createRecruitmentComponents(
                    false
                )
        });

    data[
        guild.id
    ] = {
        messageId:
            message.id
    };

    savePanelData(
        data
    );

    console.log(
        "✅ Panel recrutement créé."
    );
}

// ======================================================
// FFmpeg → ACCÉLÉRER AUDIO
// ======================================================

function speedUpAudio() {
    return new Promise(
        (resolve, reject) => {
            const ffmpeg =
                spawn(
                    "ffmpeg",
                    [
                        "-y",
                        "-i",
                        RAW_AUDIO_FILE,

                        "-filter:a",
                        `atempo=${AUDIO_SPEED}`,

                        "-vn",

                        AUDIO_FILE
                    ],
                    {
                        stdio:
                            "ignore"
                    }
                );

            ffmpeg.once(
                "error",
                reject
            );

            ffmpeg.once(
                "close",
                code => {
                    if (
                        code === 0
                    ) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                `FFMPEG_EXIT_${code}`
                            )
                        );
                    }
                }
            );
        }
    );
}

// ======================================================
// AUDIO
// ======================================================

async function ensureRecruitmentAudio() {
    ensureDataFiles();

    if (
        fs.existsSync(
            AUDIO_FILE
        )
    ) {
        return AUDIO_FILE;
    }

    console.log(
        "🎙️ Préparation de l'audio recrutement..."
    );

    const client =
        getOpenAI();

    const response =
        await client.audio.speech.create({
            model:
                "gpt-4o-mini-tts",

            voice:
                "coral",

            input:
                SPEECH_TEXT,

            instructions:
                "Parle en français, avec une voix claire, naturelle, professionnelle et accueillante. Garde un ton sérieux mais agréable. Parle assez rapidement, avec très peu de pauses inutiles, tout en restant parfaitement compréhensible."
        });

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    fs.writeFileSync(
        RAW_AUDIO_FILE,
        buffer
    );

    console.log(
        "⚡ Accélération de l'audio..."
    );

    await speedUpAudio();

    try {
        fs.unlinkSync(
            RAW_AUDIO_FILE
        );
    } catch {}

    console.log(
        `✅ Audio recrutement prêt • vitesse x${AUDIO_SPEED}`
    );

    return AUDIO_FILE;
}

// ======================================================
// HUMAINS
// ======================================================

function getHumanMembers(
    channel
) {
    if (!channel?.members) {
        return [];
    }

    return [
        ...channel.members.values()
    ].filter(
        member =>
            !member.user.bot
    );
}

function hasHumans(
    channel
) {
    return (
        getHumanMembers(
            channel
        ).length > 0
    );
}

// ======================================================
// STOP
// ======================================================

async function stopRecruitmentSpeech(
    guild
) {
    const state =
        getGuildState(
            guild.id
        );

    if (
        state.player
    ) {
        try {
            state.player.stop(
                true
            );
        } catch {}
    }

    if (
        state.connection
    ) {
        try {
            state.connection.destroy();
        } catch {}
    }

    const existing =
        getVoiceConnection(
            guild.id,
            VOICE_GROUP
        );

    if (existing) {
        try {
            existing.destroy();
        } catch {}
    }

    state.player =
        null;

    state.connection =
        null;

    state.speaking =
        false;

    await setReplayButtonState(
        guild,
        false
    );

    console.log(
        "👋 Vocal recrutement quitté."
    );
}

// ======================================================
// LECTURE
// ======================================================

async function playRecruitmentSpeech(
    guild
) {
    const state =
        getGuildState(
            guild.id
        );

    if (
        state.speaking
    ) {
        return {
            success: false,
            error:
                "ALREADY_SPEAKING"
        };
    }

    const channel =
        await getWaitingChannel(
            guild
        );

    if (
        !channel ||
        !channel.isVoiceBased()
    ) {
        return {
            success: false,
            error:
                "WAITING_VOICE_NOT_FOUND"
        };
    }

    if (
        !hasHumans(
            channel
        )
    ) {
        return {
            success: false,
            error:
                "NO_HUMANS"
        };
    }

    state.speaking =
        true;

    await setReplayButtonState(
        guild,
        true
    );

    try {
        // ==================================================
        // LE BOT JOIN IMMÉDIATEMENT
        // ==================================================

        let connection =
            getVoiceConnection(
                guild.id,
                VOICE_GROUP
            );

        if (!connection) {
            connection =
                joinVoiceChannel({
                    channelId:
                        WAITING_VOICE_ID,

                    guildId:
                        guild.id,

                    adapterCreator:
                        guild.voiceAdapterCreator,

                    selfDeaf:
                        false,

                    selfMute:
                        false,

                    group:
                        VOICE_GROUP
                });
        }

        state.connection =
            connection;

        console.log(
            "⚡ Connexion immédiate au vocal recrutement..."
        );

        // L'audio est normalement déjà préchargé
        const audioPath =
            await ensureRecruitmentAudio();

        await entersState(
            connection,
            VoiceConnectionStatus.Ready,
            15_000
        );

        if (
            !hasHumans(
                channel
            )
        ) {
            await stopRecruitmentSpeech(
                guild
            );

            return {
                success: false,
                error:
                    "NO_HUMANS"
            };
        }

        console.log(
            "🎙️ Bot connecté au vocal recrutement."
        );

        const player =
            createAudioPlayer({
                behaviors: {
                    noSubscriber:
                        NoSubscriberBehavior.Play
                }
            });

        state.player =
            player;

        const resource =
            createAudioResource(
                audioPath
            );

        connection.subscribe(
            player
        );

        player.play(
            resource
        );

        console.log(
            "🔊 Lecture recrutement démarrée."
        );

        await new Promise(
            (resolve, reject) => {
                player.once(
                    AudioPlayerStatus.Idle,
                    resolve
                );

                player.once(
                    "error",
                    reject
                );
            }
        );

        if (
            !state.speaking
        ) {
            return {
                success: true,
                stoppedBecauseEmpty:
                    true
            };
        }

        console.log(
            "✅ Lecture recrutement terminée."
        );

        await stopRecruitmentSpeech(
            guild
        );

        return {
            success: true
        };

    } catch (error) {
        console.error(
            "❌ Recrutement vocal :",
            error
        );

        await stopRecruitmentSpeech(
            guild
        );

        return {
            success: false,

            error:
                String(
                    error?.message ||
                    error
                )
        };
    }
}

// ======================================================
// SYSTÈME
// ======================================================

function registerRecruitmentVoiceSystem(
    client
) {
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
                await ensurePermanentPanel(
                    guild
                );

                // ==================================================
                // PRÉCHARGER LE TTS AU DÉMARRAGE
                // ==================================================

                ensureRecruitmentAudio()
                    .then(
                        () => {
                            console.log(
                                "🚀 Audio recrutement préchargé."
                            );
                        }
                    )
                    .catch(
                        error => {
                            console.error(
                                "❌ Préchargement audio recrutement :",
                                error
                            );
                        }
                    );

                // ==================================================
                // PERSONNES DÉJÀ PRÉSENTES
                // ==================================================

                const channel =
                    await getWaitingChannel(
                        guild
                    );

                if (
                    !channel ||
                    !channel.isVoiceBased()
                ) {
                    continue;
                }

                const humans =
                    getHumanMembers(
                        channel
                    );

                console.log(
                    `🎙️ Attente recrutement : ${humans.length} humain(s).`
                );

                if (
                    humans.length > 0
                ) {
                    setTimeout(
                        async () => {
                            const state =
                                getGuildState(
                                    guild.id
                                );

                            if (
                                !state.speaking &&
                                hasHumans(
                                    channel
                                )
                            ) {
                                await playRecruitmentSpeech(
                                    guild
                                );
                            }
                        },
                        500
                    );
                }
            }
        }
    );

    // ==================================================
    // VOCAL
    // ==================================================

    client.on(
        Events.VoiceStateUpdate,
        async (
            oldState,
            newState
        ) => {
            try {
                if (
                    newState.member
                        ?.user
                        ?.bot
                ) {
                    return;
                }

                const guild =
                    newState.guild;

                const state =
                    getGuildState(
                        guild.id
                    );

                // ==================================================
                // QUITTE LE VOCAL
                // ==================================================

                if (
                    oldState.channelId ===
                        WAITING_VOICE_ID &&
                    newState.channelId !==
                        WAITING_VOICE_ID
                ) {
                    const channel =
                        await getWaitingChannel(
                            guild
                        );

                    // Laisse juste Discord actualiser le cache
                    setTimeout(
                        async () => {
                            if (
                                channel &&
                                !hasHumans(
                                    channel
                                )
                            ) {
                                if (
                                    state.speaking ||
                                    state.connection
                                ) {
                                    await stopRecruitmentSpeech(
                                        guild
                                    );
                                }
                            }
                        },
                        100
                    );

                    return;
                }

                // ==================================================
                // REJOINT LE VOCAL
                // ==================================================

                if (
                    newState.channelId !==
                        WAITING_VOICE_ID ||
                    oldState.channelId ===
                        WAITING_VOICE_ID
                ) {
                    return;
                }

                console.log(
                    `👤 ${newState.member.user.tag} rejoint l'attente recrutement.`
                );

                if (
                    state.speaking
                ) {
                    console.log(
                        "🔊 Lecture déjà en cours."
                    );

                    return;
                }

                // ==================================================
                // PLUS DE 750MS / 2 SECONDES
                // → DÉCLENCHEMENT QUASI IMMÉDIAT
                // ==================================================

                setTimeout(
                    async () => {
                        if (
                            !state.speaking
                        ) {
                            await playRecruitmentSpeech(
                                guild
                            );
                        }
                    },
                    100
                );

            } catch (error) {
                console.error(
                    "❌ VoiceState recrutement :",
                    error
                );
            }
        }
    );

    // ==================================================
    // BOUTON
    // ==================================================

    client.on(
        Events.InteractionCreate,
        async interaction => {
            if (
                !interaction.isButton() ||
                interaction.customId !==
                    BUTTON_ID
            ) {
                return;
            }

            const guild =
                interaction.guild;

            if (!guild) {
                return;
            }

            const state =
                getGuildState(
                    guild.id
                );

            if (
                state.speaking
            ) {
                return interaction.reply({
                    content:
                        "⏳ L'explication est déjà en cours.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            const channel =
                await getWaitingChannel(
                    guild
                );

            if (
                !channel ||
                !hasHumans(
                    channel
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Personne n'est actuellement dans le vocal d'attente.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await interaction.reply({
                content:
                    "🔊 Relance de l'explication dans le vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            await playRecruitmentSpeech(
                guild
            );
        }
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    registerRecruitmentVoiceSystem;