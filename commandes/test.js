const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const {
    SlashCommandBuilder,
    MessageFlags,
    Events
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

const {
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

// ======================================================
// CONFIG
// ======================================================

const TEST_GROUP =
    "legacy-test-follow";

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const NORMAL_AUDIO =
    path.join(
        DATA_DIR,
        "recruitmentProcess.mp3"
    );

const TEST_AUDIO =
    path.join(
        DATA_DIR,
        "recruitmentProcess_test_05x.mp3"
    );

// ======================================================
// PERMISSION
// ======================================================

function hasPermission(member) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// AUDIO 0.5X
// ======================================================

function createHalfSpeedAudio() {
    return new Promise(
        (resolve, reject) => {

            if (
                fs.existsSync(
                    TEST_AUDIO
                )
            ) {
                return resolve(
                    TEST_AUDIO
                );
            }

            if (
                !fs.existsSync(
                    NORMAL_AUDIO
                )
            ) {
                return reject(
                    new Error(
                        "AUDIO_RECRUTEMENT_INTROUVABLE"
                    )
                );
            }

            console.log(
                "🐢 Création audio /test en 0.5x..."
            );

            const ffmpeg =
                spawn(
                    "ffmpeg",
                    [
                        "-y",

                        "-i",
                        NORMAL_AUDIO,

                        "-filter:a",
                        "atempo=0.5",

                        "-vn",

                        TEST_AUDIO
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
                        code !== 0
                    ) {
                        return reject(
                            new Error(
                                `FFMPEG_EXIT_${code}`
                            )
                        );
                    }

                    console.log(
                        "✅ Audio /test 0.5x créé."
                    );

                    resolve(
                        TEST_AUDIO
                    );
                }
            );
        }
    );
}

// ======================================================
// STOCKAGE
// ======================================================

function ensureTestStorage(client) {
    if (
        !client.testVoiceSessions
    ) {
        client.testVoiceSessions =
            new Map();
    }
}

// ======================================================
// RETIRER LA MENOTTE CRÉÉE PAR /TEST
// ======================================================

function removeTestMenotte(
    client,
    session
) {
    if (
        !session ||
        !session.testMenotteCreated
    ) {
        return;
    }

    const current =
        client.menottes.get(
            session.targetId
        );

    if (
        current &&
        current.testSession === true
    ) {
        client.menottes.delete(
            session.targetId
        );

        console.log(
            `🔓 Menotte /test retirée pour ${session.targetId}`
        );
    }

    session.testMenotteCreated =
        false;
}

// ======================================================
// ARRÊT SESSION
// ======================================================

function stopTestSession(
    client,
    guildId
) {
    ensureTestStorage(
        client
    );

    const session =
        client.testVoiceSessions.get(
            guildId
        );

    if (!session) {
        return;
    }

    session.ended =
        true;

    session.waitingForTarget =
        false;

    // ==================================================
    // RETIRER MENOTTE /TEST
    // ==================================================

    removeTestMenotte(
        client,
        session
    );

    // ==================================================
    // PLAYER
    // ==================================================

    if (
        session.player
    ) {
        try {
            session.player.stop(
                true
            );
        } catch {}
    }

    // ==================================================
    // CONNECTION
    // ==================================================

    if (
        session.connection
    ) {
        try {
            session.connection.destroy();
        } catch {}
    }

    const connection =
        getVoiceConnection(
            guildId,
            TEST_GROUP
        );

    if (connection) {
        try {
            connection.destroy();
        } catch {}
    }

    client.testVoiceSessions.delete(
        guildId
    );

    console.log(
        "🛑 Session /test terminée."
    );
}

// ======================================================
// CONNECTION À LA CIBLE
// ======================================================

async function connectToTarget(
    client,
    guild,
    session,
    channelId
) {
    if (
        session.ended
    ) {
        return null;
    }

    let connection =
        getVoiceConnection(
            guild.id,
            TEST_GROUP
        );

    // ==================================================
    // REJOIN
    // ==================================================

    if (connection) {
        try {
            connection.rejoin({
                channelId,

                selfDeaf:
                    false,

                selfMute:
                    false
            });

            session.connection =
                connection;

            await entersState(
                connection,
                VoiceConnectionStatus.Ready,
                15_000
            );

            return connection;

        } catch {
            try {
                connection.destroy();
            } catch {}

            connection =
                null;
        }
    }

    // ==================================================
    // NOUVELLE CONNECTION
    // ==================================================

    connection =
        joinVoiceChannel({
            channelId,

            guildId:
                guild.id,

            adapterCreator:
                guild.voiceAdapterCreator,

            selfDeaf:
                false,

            selfMute:
                false,

            group:
                TEST_GROUP
        });

    session.connection =
        connection;

    await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        15_000
    );

    return connection;
}

// ======================================================
// LISTENER VOCAL /TEST
// ======================================================

function installTestVoiceListener(
    client
) {
    if (
        client.testVoiceListenerInstalled
    ) {
        return;
    }

    client.testVoiceListenerInstalled =
        true;

    ensureTestStorage(
        client
    );

    client.on(
        Events.VoiceStateUpdate,
        async (
            oldState,
            newState
        ) => {
            try {
                const guild =
                    newState.guild;

                const session =
                    client.testVoiceSessions.get(
                        guild.id
                    );

                if (
                    !session ||
                    session.ended
                ) {
                    return;
                }

                // ==================================================
                // PROTECTION DU BOT CONTRE MUTE / SOURDINE
                // ==================================================

                if (
                    newState.id ===
                    client.user.id
                ) {
                    // ==============================================
                    // MUTE SERVEUR
                    // ==============================================

                    if (
                        newState.serverMute
                    ) {
                        console.log(
                            "🛡️ Quelqu'un a mute le bot → unmute immédiat."
                        );

                        await newState.setMute(
                            false,
                            "Protection du bot pendant /test"
                        ).catch(
                            error =>
                                console.error(
                                    "❌ Auto-unmute bot :",
                                    error.message
                                )
                        );
                    }

                    // ==============================================
                    // SOURDINE SERVEUR
                    // ==============================================

                    if (
                        newState.serverDeaf
                    ) {
                        console.log(
                            "🛡️ Quelqu'un a mis le bot en sourdine → retrait immédiat."
                        );

                        await newState.setDeaf(
                            false,
                            "Protection du bot pendant /test"
                        ).catch(
                            error =>
                                console.error(
                                    "❌ Auto-undeaf bot :",
                                    error.message
                                )
                        );
                    }

                    return;
                }

                // ==================================================
                // UNIQUEMENT LA PERSONNE TESTÉE
                // ==================================================

                if (
                    newState.id !==
                    session.targetId
                ) {
                    return;
                }

                // ==================================================
                // PERSONNE MENOTTÉE PAR /TEST
                // ==================================================

                if (
                    session.testMenotteCreated &&
                    session.lockedChannelId
                ) {
                    // La personne essaie de changer de vocal
                    if (
                        newState.channelId &&
                        newState.channelId !==
                            session.lockedChannelId
                    ) {
                        console.log(
                            "🔒 /test : cible tente de quitter son vocal → retour."
                        );

                        await newState.setChannel(
                            session.lockedChannelId
                        ).catch(
                            error =>
                                console.error(
                                    "❌ Menotte /test :",
                                    error
                                )
                        );

                        return;
                    }
                }

                // ==================================================
                // LA CIBLE SE DÉCONNECTE
                // ==================================================

                if (
                    oldState.channelId &&
                    !newState.channelId
                ) {
                    console.log(
                        "🧪 Cible déconnectée → bot en pause."
                    );

                    if (
                        session.player
                    ) {
                        try {
                            session.player.pause(
                                true
                            );
                        } catch {}
                    }

                    if (
                        session.connection
                    ) {
                        try {
                            session.connection.destroy();
                        } catch {}
                    }

                    const existing =
                        getVoiceConnection(
                            guild.id,
                            TEST_GROUP
                        );

                    if (existing) {
                        try {
                            existing.destroy();
                        } catch {}
                    }

                    session.connection =
                        null;

                    session.waitingForTarget =
                        true;

                    return;
                }

                // ==================================================
                // CIBLE REJOINT / CHANGE DE VOC
                // ==================================================

                if (
                    newState.channelId &&
                    oldState.channelId !==
                        newState.channelId
                ) {
                    // Si menottée, le handler ci-dessus s'occupe
                    // de la remettre dans son vocal.
                    if (
                        session.testMenotteCreated
                    ) {
                        return;
                    }

                    console.log(
                        `🧪 Cible déplacée → suivi vers ${newState.channelId}`
                    );

                    try {
                        const connection =
                            await connectToTarget(
                                client,
                                guild,
                                session,
                                newState.channelId
                            );

                        if (
                            !connection ||
                            session.ended
                        ) {
                            return;
                        }

                        connection.subscribe(
                            session.player
                        );

                        if (
                            session.waitingForTarget
                        ) {
                            session.waitingForTarget =
                                false;

                            try {
                                session.player.unpause();
                            } catch {}
                        }

                    } catch (error) {
                        console.error(
                            "❌ /test suivi vocal :",
                            error
                        );
                    }
                }

            } catch (error) {
                console.error(
                    "❌ Listener /test :",
                    error
                );
            }
        }
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("test")
            .setDescription(
                "Tester le speech recrutement sur un membre"
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            "membre"
                        )
                        .setDescription(
                            "Membre que le bot doit suivre"
                        )
                        .setRequired(
                            true
                        )
            )

            .addBooleanOption(
                option =>
                    option
                        .setName(
                            "menotter"
                        )
                        .setDescription(
                            "Bloquer le membre dans son vocal actuel pendant le test"
                        )
                        .setRequired(
                            true
                        )
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSION
            // ==================================================

            if (
                !hasPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/test`."
                });
            }

            const client =
                interaction.client;

            const guild =
                interaction.guild;

            ensureTestStorage(
                client
            );

            installTestVoiceListener(
                client
            );

            // ==================================================
            // OPTIONS
            // ==================================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const shouldMenotte =
                interaction.options.getBoolean(
                    "menotter",
                    true
                );

            const target =
                await guild.members
                    .fetch(
                        user.id
                    )
                    .catch(
                        () => null
                    );

            if (!target) {
                return interaction.editReply({
                    content:
                        "❌ Membre introuvable."
                });
            }

            // ==================================================
            // COMPTE PROTÉGÉ
            // ==================================================

            if (
                typeof client.isProtectedUser ===
                    "function" &&
                client.isProtectedUser(
                    target.id
                )
            ) {
                return interaction.editReply({
                    content:
                        "🛡️ Ce membre est protégé et ne peut pas être ciblé par `/test`."
                });
            }

            if (
                target.user.bot
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu ne peux pas lancer `/test` sur un bot."
                });
            }

            if (
                !target.voice.channelId
            ) {
                return interaction.editReply({
                    content:
                        "❌ Ce membre doit être dans un salon vocal."
                });
            }

            // ==================================================
            // ARRÊTER ANCIEN TEST
            // ==================================================

            if (
                client.testVoiceSessions.has(
                    guild.id
                )
            ) {
                stopTestSession(
                    client,
                    guild.id
                );
            }

            // ==================================================
            // AUDIO
            // ==================================================

            let audioPath;

            try {
                audioPath =
                    await createHalfSpeedAudio();

            } catch (error) {
                if (
                    error.message ===
                        "AUDIO_RECRUTEMENT_INTROUVABLE"
                ) {
                    return interaction.editReply({
                        content:
                            "❌ `data/recruitmentProcess.mp3` n'existe pas encore."
                    });
                }

                throw error;
            }

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

            const session = {
                targetId:
                    target.id,

                ownerId:
                    interaction.user.id,

                player,

                connection:
                    null,

                waitingForTarget:
                    false,

                ended:
                    false,

                testMenotteCreated:
                    false,

                lockedChannelId:
                    null
            };

            // ==================================================
            // MENOTTER SI DEMANDÉ
            // ==================================================

            if (
                shouldMenotte
            ) {
                const lockedChannelId =
                    target.voice.channelId;

                client.menottes.set(
                    target.id,
                    {
                        guildId:
                            guild.id,

                        channelId:
                            lockedChannelId,

                        moderatorId:
                            interaction.user.id,

                        testSession:
                            true
                    }
                );

                session.testMenotteCreated =
                    true;

                session.lockedChannelId =
                    lockedChannelId;

                console.log(
                    `🔒 /test : ${target.user.tag} menotté dans ${lockedChannelId}`
                );
            }

            client.testVoiceSessions.set(
                guild.id,
                session
            );

            // ==================================================
            // CONNECTION
            // ==================================================

            const connection =
                await connectToTarget(
                    client,
                    guild,
                    session,
                    target.voice.channelId
                );

            if (!connection) {
                stopTestSession(
                    client,
                    guild.id
                );

                return interaction.editReply({
                    content:
                        "❌ Impossible de rejoindre le vocal du membre."
                });
            }

            // ==================================================
            // RETIRER MUTE / SOURDINE DU BOT SI BESOIN
            // ==================================================

            const botMember =
                guild.members.me;

            if (
                botMember?.voice?.serverMute
            ) {
                await botMember.voice.setMute(
                    false,
                    "Démarrage /test"
                ).catch(
                    () => {}
                );
            }

            if (
                botMember?.voice?.serverDeaf
            ) {
                await botMember.voice.setDeaf(
                    false,
                    "Démarrage /test"
                ).catch(
                    () => {}
                );
            }

            // ==================================================
            // AUDIO
            // ==================================================

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
                `🧪 /test lancé sur ${target.user.tag} • 0.5x • Menotte : ${shouldMenotte ? "OUI" : "NON"}`
            );

            // ==================================================
            // FIN AUDIO
            // ==================================================

            player.once(
                AudioPlayerStatus.Idle,
                () => {
                    const current =
                        client.testVoiceSessions.get(
                            guild.id
                        );

                    if (
                        !current ||
                        current !==
                            session ||
                        session.waitingForTarget
                    ) {
                        return;
                    }

                    console.log(
                        "✅ Speech /test terminé."
                    );

                    stopTestSession(
                        client,
                        guild.id
                    );
                }
            );

            player.on(
                "error",
                error => {
                    console.error(
                        "❌ Audio /test :",
                        error
                    );

                    stopTestSession(
                        client,
                        guild.id
                    );
                }
            );

            // ==================================================
            // RÉPONSE
            // ==================================================

            return interaction.editReply({
                content:
                    [
                        `🧪 Test lancé sur <@${target.id}>.`,
                        "",
                        "🐢 Speech : **0,5×**",
                        shouldMenotte
                            ? `🔒 Menotte : **activée** dans <#${target.voice.channelId}>`
                            : "🔓 Menotte : **désactivée**",
                        "👣 Suivi vocal : **activé**",
                        "🛡️ Anti-mute / anti-sourdine du bot : **activé**"
                    ].join("\n")
            });

        } catch (error) {
            console.error(
                "❌ Erreur /test :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};