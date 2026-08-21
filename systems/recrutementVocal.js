const fs = require("fs");
const path = require("path");
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
    "1458501376702414848";

const VOICE_GROUP =
    "legacy-recruitment-waiting";

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

const AUDIO_FILE =
    path.join(
        DATA_DIR,
        "recruitmentProcess.mp3"
    );

// ======================================================
// OPENAI
// ======================================================

let openai = null;

function getOpenAI() {
    if (openai) {
        return openai;
    }

    if (
        !process.env.OPENAI_API_KEY
    ) {
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
Bienvenue dans l'espace d'attente des recrutements de The Legacy.

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

Pour résumer :

vous serez pris un par un,

vous commencerez par une présentation,

vous répondrez ensuite aux questions,

vous passerez les mises en situation,

puis vous reviendrez dans ce salon d'attente pendant la délibération des recruteurs.

Enfin, vous serez déplacé une dernière fois lorsque les recruteurs auront leur réponse.

Vous pouvez également retrouver toutes ces explications par écrit directement dans les messages de ce salon vocal.

Merci pour votre patience, votre sérieux et votre intérêt pour The Legacy.

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
                recursive:
                    true
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

        if (
            !raw.trim()
        ) {
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
            0x3B6475
        )
        .setTitle(
            "🎙️ Déroulement des recrutements"
        )
        .setDescription(
            [
                "Bienvenue dans l'espace d'attente des recrutements **The Legacy**.",
                "",
                "🔊 Une explication vocale est automatiquement lancée lorsqu'un candidat rejoint ce salon.",
                "",
                "📖 **Toutes les explications sont également disponibles ici par écrit.**",
                "",
                "Les candidats sont pris **un par un**. Il peut donc y avoir du retard selon le nombre de personnes et la durée des entretiens.",
                "",
                "**Si vous attendez, cela ne signifie pas que vous avez été oublié.** Merci de patienter."
            ].join(
                "\n"
            )
        )
        .addFields(
            {
                name:
                    "1️⃣ Présentation",

                value:
                    "Vous commencerez par vous présenter : expérience, motivations, disponibilités et ce que vous souhaitez apporter à The Legacy.",

                inline:
                    false
            },

            {
                name:
                    "2️⃣ Questions",

                value:
                    "Les recruteurs vous poseront différentes questions afin de mieux connaître votre sérieux, votre motivation et votre manière de réfléchir.",

                inline:
                    false
            },

            {
                name:
                    "3️⃣ Mises en situation",

                value:
                    "Plusieurs situations fictives pourront vous être proposées. Vous devrez expliquer comment vous réagiriez et pourquoi.",

                inline:
                    false
            },

            {
                name:
                    "⏳ Après l'entretien",

                value:
                    "Vous serez replacé dans ce salon pendant que les recruteurs délibèrent. Lorsque leur décision sera prise, vous serez déplacé de nouveau afin de recevoir votre réponse.",

                inline:
                    false
            },

            {
                name:
                    "📌 Pendant l'attente",

                value:
                    [
                        "• Restez disponible.",
                        "• Gardez votre micro prêt.",
                        "• Ne spammez pas les recruteurs.",
                        "• Évitez les allers-retours inutiles.",
                        "• Un retard peut arriver.",
                        "• Vous serez déplacé lorsque ce sera votre tour."
                    ].join(
                        "\n"
                    ),

                inline:
                    false
            }
        )
        .setFooter({
            text:
                "The Legacy • Recrutements"
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
// RÉCUPÉRER LE PANEL
// ======================================================

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
        await guild.channels
            .fetch(
                WAITING_VOICE_ID
            )
            .catch(
                () => null
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

// ======================================================
// ACTIVER / DÉSACTIVER BOUTON
// ======================================================

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

// ======================================================
// PANEL UNIQUE
// ======================================================

async function ensurePermanentPanel(
    guild
) {
    const channel =
        await guild.channels
            .fetch(
                WAITING_VOICE_ID
            )
            .catch(
                () => null
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

    const savedMessageId =
        data[
            guild.id
        ]?.messageId;

    // ==================================================
    // PANEL DÉJÀ ENREGISTRÉ
    // ==================================================

    if (
        savedMessageId
    ) {
        const existingMessage =
            await channel.messages
                .fetch(
                    savedMessageId
                )
                .catch(
                    () => null
                );

        if (
            existingMessage
        ) {
            await existingMessage.edit({
                embeds: [
                    createRecruitmentEmbed()
                ],

                components:
                    createRecruitmentComponents(
                        false
                    )
            }).catch(
                () => {}
            );

            console.log(
                "✅ Panel recrutement déjà présent."
            );

            return;
        }
    }

    // ==================================================
    // RECHERCHE PANEL EXISTANT
    // ==================================================

    try {
        const messages =
            await channel.messages.fetch({
                limit:
                    50
            });

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

        if (
            oldPanel
        ) {
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
            }).catch(
                () => {}
            );

            console.log(
                "✅ Ancien panel recrutement retrouvé."
            );

            return;
        }

    } catch (error) {
        console.error(
            "⚠️ Recherche panel recrutement :",
            error.message
        );
    }

    // ==================================================
    // CRÉATION
    // ==================================================

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
        "🎙️ Génération du message vocal recrutement..."
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
                "Parle en français avec une voix naturelle, claire, accueillante et professionnelle. Garde un ton sérieux mais rassurant. Parle légèrement plus vite qu'un débit normal, sans précipiter les phrases. Fais seulement de courtes pauses entre les différentes étapes."
        });

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    fs.writeFileSync(
        AUDIO_FILE,
        buffer
    );

    console.log(
        "✅ Audio recrutement généré."
    );

    return AUDIO_FILE;
}

// ======================================================
// HUMAINS
// ======================================================

function getHumanMembers(
    channel
) {
    if (
        !channel?.members
    ) {
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
// ARRÊT IMMÉDIAT
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

    if (
        existing
    ) {
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
        "👋 Bot sorti du vocal recrutement : plus aucun candidat."
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

    // ==================================================
    // DÉJÀ EN COURS
    // ==================================================

    if (
        state.speaking
    ) {
        return {
            success:
                false,

            error:
                "ALREADY_SPEAKING"
        };
    }

    let channel =
        await guild.channels
            .fetch(
                WAITING_VOICE_ID,
                {
                    force:
                        true
                }
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isVoiceBased()
    ) {
        return {
            success:
                false,

            error:
                "WAITING_VOICE_NOT_FOUND"
        };
    }

    // ==================================================
    // PERSONNE DANS LA VOC
    // ==================================================

    if (
        !hasHumans(
            channel
        )
    ) {
        return {
            success:
                false,

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
        // AUDIO
        // ==================================================

        const audioPath =
            await ensureRecruitmentAudio();

        // ==================================================
        // REFETCH AVANT JOIN
        // ==================================================

        channel =
            await guild.channels
                .fetch(
                    WAITING_VOICE_ID,
                    {
                        force:
                            true
                    }
                )
                .catch(
                    () => null
                );

        if (
            !channel ||
            !hasHumans(
                channel
            )
        ) {
            state.speaking =
                false;

            await setReplayButtonState(
                guild,
                false
            );

            return {
                success:
                    false,

                error:
                    "NO_HUMANS"
            };
        }

        // ==================================================
        // CONNECTION
        // ==================================================

        let connection =
            getVoiceConnection(
                guild.id,
                VOICE_GROUP
            );

        if (
            !connection
        ) {
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

        await entersState(
            connection,
            VoiceConnectionStatus.Ready,
            20_000
        );

        // ==================================================
        // VÉRIF APRÈS ARRIVÉE DU BOT
        // ==================================================

        channel =
            await guild.channels
                .fetch(
                    WAITING_VOICE_ID,
                    {
                        force:
                            true
                    }
                )
                .catch(
                    () => null
                );

        if (
            !channel ||
            !hasHumans(
                channel
            )
        ) {
            await stopRecruitmentSpeech(
                guild
            );

            return {
                success:
                    false,

                error:
                    "NO_HUMANS"
            };
        }

        console.log(
            "🎙️ Bot arrivé dans l'attente recrutement."
        );

        // ==================================================
        // PLAYER
        // ==================================================

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
            "🔊 Lecture du déroulement recrutement..."
        );

        // ==================================================
        // ATTENDRE LA FIN
        // ==================================================

        await new Promise(
            (resolve, reject) => {
                const onIdle =
                    () => {
                        cleanup();

                        resolve();
                    };

                const onError =
                    error => {
                        cleanup();

                        reject(
                            error
                        );
                    };

                function cleanup() {
                    player.off(
                        AudioPlayerStatus.Idle,
                        onIdle
                    );

                    player.off(
                        "error",
                        onError
                    );
                }

                player.on(
                    AudioPlayerStatus.Idle,
                    onIdle
                );

                player.on(
                    "error",
                    onError
                );
            }
        );

        // ==================================================
        // PEUT AVOIR ÉTÉ COUPÉ SI VOC VIDE
        // ==================================================

        if (
            !state.speaking
        ) {
            return {
                success:
                    true,

                stoppedBecauseEmpty:
                    true
            };
        }

        console.log(
            "✅ Explication recrutement terminée."
        );

        // ==================================================
        // DÉCONNEXION
        // ==================================================

        state.player =
            null;

        if (
            state.connection
        ) {
            try {
                state.connection.destroy();
            } catch {}
        }

        state.connection =
            null;

        state.speaking =
            false;

        await setReplayButtonState(
            guild,
            false
        );

        console.log(
            "👋 Bot sorti du vocal recrutement."
        );

        return {
            success:
                true
        };

    } catch (error) {
        console.error(
            "❌ Recrutement vocal :",
            error
        );

        if (
            state.connection
        ) {
            try {
                state.connection.destroy();
            } catch {}
        }

        state.connection =
            null;

        state.player =
            null;

        state.speaking =
            false;

        await setReplayButtonState(
            guild,
            false
        );

        return {
            success:
                false,

            error:
                String(
                    error?.message ||
                    error
                )
        };
    }
}

// ======================================================
// SYSTÈME PRINCIPAL
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
                // ==========================================
                // PANEL
                // ==========================================

                await ensurePermanentPanel(
                    guild
                );

                // ==========================================
                // VOCAL
                // ==========================================

                const waitingChannel =
                    await guild.channels
                        .fetch(
                            WAITING_VOICE_ID,
                            {
                                force:
                                    true
                            }
                        )
                        .catch(
                            () => null
                        );

                if (
                    !waitingChannel ||
                    !waitingChannel.isVoiceBased()
                ) {
                    console.log(
                        `❌ Vocal attente recrutement introuvable : ${WAITING_VOICE_ID}`
                    );

                    continue;
                }

                const humans =
                    getHumanMembers(
                        waitingChannel
                    );

                console.log(
                    `🎙️ Attente recrutement : ${humans.length} humain(s) présent(s).`
                );

                // ==================================================
                // QUELQU'UN EST DÉJÀ DANS LE VOC AU DÉMARRAGE
                // ==================================================

                if (
                    humans.length > 0
                ) {
                    console.log(
                        "👤 Candidat déjà présent → explication dans 2 secondes."
                    );

                    setTimeout(
                        async () => {
                            const state =
                                getGuildState(
                                    guild.id
                                );

                            if (
                                state.speaking
                            ) {
                                return;
                            }

                            const refreshed =
                                await guild.channels
                                    .fetch(
                                        WAITING_VOICE_ID,
                                        {
                                            force:
                                                true
                                        }
                                    )
                                    .catch(
                                        () => null
                                    );

                            if (
                                refreshed &&
                                hasHumans(
                                    refreshed
                                )
                            ) {
                                await playRecruitmentSpeech(
                                    guild
                                );
                            }
                        },
                        2000
                    );
                }
            }
        }
    );

    // ==================================================
    // VOICE STATE
    // ==================================================

    client.on(
        Events.VoiceStateUpdate,
        async (
            oldState,
            newState
        ) => {
            try {
                // ==================================================
                // IGNORER TOUS LES BOTS
                // ==================================================

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
                // HUMAIN QUITTE LE SALON D'ATTENTE
                // ==================================================

                if (
                    oldState.channelId ===
                        WAITING_VOICE_ID &&
                    newState.channelId !==
                        WAITING_VOICE_ID
                ) {
                    // Petite attente Discord
                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                300
                            )
                    );

                    const waitingChannel =
                        await guild.channels
                            .fetch(
                                WAITING_VOICE_ID,
                                {
                                    force:
                                        true
                                }
                            )
                            .catch(
                                () => null
                            );

                    if (
                        waitingChannel &&
                        !hasHumans(
                            waitingChannel
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

                    return;
                }

                // ==================================================
                // HUMAIN REJOINT LE SALON D'ATTENTE
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

                // ==================================================
                // DÉJÀ EN TRAIN DE PARLER
                // ==================================================

                if (
                    state.speaking
                ) {
                    console.log(
                        "🔊 Explication déjà en cours → aucune deuxième lecture."
                    );

                    return;
                }

                // ==================================================
                // LAISSER DISCORD ACTUALISER LES MEMBRES
                // ==================================================

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            750
                        )
                );

                const refreshedChannel =
                    await guild.channels
                        .fetch(
                            WAITING_VOICE_ID,
                            {
                                force:
                                    true
                            }
                        )
                        .catch(
                            () => null
                        );

                if (
                    !refreshedChannel
                ) {
                    console.log(
                        "❌ Vocal recrutement introuvable après arrivée."
                    );

                    return;
                }

                const humans =
                    getHumanMembers(
                        refreshedChannel
                    );

                console.log(
                    `👥 Humains détectés dans l'attente : ${humans.length}`
                );

                if (
                    humans.length === 0
                ) {
                    return;
                }

                console.log(
                    "🎙️ Lancement automatique de l'explication..."
                );

                await playRecruitmentSpeech(
                    guild
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
    // BOUTON RÉÉCOUTER
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

            // ==================================================
            // LECTURE DÉJÀ EN COURS
            // ==================================================

            if (
                state.speaking
            ) {
                return interaction.reply({
                    content:
                        "⏳ L'explication est déjà en cours. Attends simplement la fin.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            // ==================================================
            // VÉRIFIER SI QUELQU'UN EST DANS LA VOC
            // ==================================================

            const voiceChannel =
                await guild.channels
                    .fetch(
                        WAITING_VOICE_ID,
                        {
                            force:
                                true
                        }
                    )
                    .catch(
                        () => null
                    );

            if (
                !voiceChannel ||
                !hasHumans(
                    voiceChannel
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Il n'y a actuellement personne dans le vocal d'attente.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await interaction.reply({
                content:
                    "🔊 L'explication complète va être relue dans le vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            const result =
                await playRecruitmentSpeech(
                    guild
                );

            if (
                !result.success &&
                result.error !==
                    "ALREADY_SPEAKING"
            ) {
                await interaction.followUp({
                    content:
                        `❌ Impossible de lancer la lecture.\n\`${result.error}\``,

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }
        }
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    registerRecruitmentVoiceSystem;