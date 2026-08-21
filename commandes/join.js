const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    EndBehaviorType
} = require("@discordjs/voice");

const prism = require("prism-media");
const OpenAI = require("openai");

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// ======================================================
// CONFIGURATION
// ======================================================

const TRANSCRIPTION_CHANNEL_ID =
    "1540194578974515270";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Utilisateurs dont une phrase est actuellement enregistrée
const utilisateursEnCours = new Set();

// ======================================================
// CRÉER UN FICHIER WAV
// ======================================================

function creerWav(
    pcmBuffer,
    sampleRate = 48000,
    channels = 2,
    bitsPerSample = 16
) {
    const header = Buffer.alloc(44);

    const byteRate =
        sampleRate *
        channels *
        bitsPerSample /
        8;

    const blockAlign =
        channels *
        bitsPerSample /
        8;

    header.write(
        "RIFF",
        0
    );

    header.writeUInt32LE(
        36 + pcmBuffer.length,
        4
    );

    header.write(
        "WAVE",
        8
    );

    header.write(
        "fmt ",
        12
    );

    header.writeUInt32LE(
        16,
        16
    );

    header.writeUInt16LE(
        1,
        20
    );

    header.writeUInt16LE(
        channels,
        22
    );

    header.writeUInt32LE(
        sampleRate,
        24
    );

    header.writeUInt32LE(
        byteRate,
        28
    );

    header.writeUInt16LE(
        blockAlign,
        32
    );

    header.writeUInt16LE(
        bitsPerSample,
        34
    );

    header.write(
        "data",
        36
    );

    header.writeUInt32LE(
        pcmBuffer.length,
        40
    );

    return Buffer.concat([
        header,
        pcmBuffer
    ]);
}

// ======================================================
// TRANSCRIPTION OPENAI
// ======================================================

async function transcrireAudio(
    wavBuffer,
    username
) {
    const fichierTemp =
        path.join(
            os.tmpdir(),
            `legacy-${crypto.randomUUID()}.wav`
        );

    try {
        fs.writeFileSync(
            fichierTemp,
            wavBuffer
        );

        console.log(
            `🤖 Transcription OpenAI de ${username}...`
        );

        const resultat =
            await openai.audio.transcriptions.create({
                file:
                    fs.createReadStream(
                        fichierTemp
                    ),

                model:
                    "gpt-4o-mini-transcribe",

                language:
                    "fr"
            });

        const texte =
            resultat.text?.trim();

        if (!texte) {
            console.log(
                `⚠️ Aucun texte détecté pour ${username}`
            );

            return null;
        }

        console.log(
            `✅ ${username} → ${texte}`
        );

        return texte;

    } catch (error) {
        console.error("");
        console.error(
            "❌ ERREUR OPENAI"
        );

        console.error(
            "Status :",
            error?.status
        );

        console.error(
            "Code :",
            error?.code
        );

        console.error(
            "Message :",
            error?.message
        );

        console.error("");

        return null;

    } finally {
        try {
            if (
                fs.existsSync(
                    fichierTemp
                )
            ) {
                fs.unlinkSync(
                    fichierTemp
                );
            }
        } catch {}
    }
}

// ======================================================
// ENVOYER TRANSCRIPTION DANS DISCORD
// ======================================================

async function envoyerTranscription(
    guild,
    membre,
    texte
) {
    const salon =
        await guild.channels
            .fetch(
                TRANSCRIPTION_CHANNEL_ID
            )
            .catch(() => null);

    if (
        !salon ||
        !salon.isTextBased()
    ) {
        console.error(
            "❌ Salon de transcription introuvable."
        );

        return;
    }

    // Discord limite un message à 2000 caractères
    const texteFinal =
        texte.length > 1800
            ? texte.substring(
                0,
                1800
            ) + "..."
            : texte;

    await salon.send({
        content:
`🎙️ **${membre.displayName}**
> ${texteFinal.replace(/\n/g, "\n> ")}`
    });
}

// ======================================================
// ÉCOUTER UNE PHRASE D'UN UTILISATEUR
// ======================================================

async function ecouterUtilisateur(
    connection,
    guild,
    userId
) {
    if (
        utilisateursEnCours.has(
            userId
        )
    ) {
        return;
    }

    utilisateursEnCours.add(
        userId
    );

    const membre =
        await guild.members
            .fetch(
                userId
            )
            .catch(() => null);

    if (
        !membre ||
        membre.user.bot
    ) {
        utilisateursEnCours.delete(
            userId
        );

        return;
    }

    console.log("");
    console.log(
        `🎙️ ${membre.user.username} commence à parler`
    );

    try {
        // ==============================================
        // AUDIO OPUS DE DISCORD
        // ==============================================

        const opusStream =
            connection.receiver.subscribe(
                userId,
                {
                    end: {
                        behavior:
                            EndBehaviorType.AfterSilence,

                        // Après 1,2 seconde de silence,
                        // la phrase est considérée terminée
                        duration:
                            1200
                    }
                }
            );

        // ==============================================
        // DÉCODAGE OPUS → PCM
        // ==============================================

        const decoder =
            new prism.opus.Decoder({
                rate:
                    48000,

                channels:
                    2,

                frameSize:
                    960
            });

        const pcmStream =
            opusStream.pipe(
                decoder
            );

        const morceaux = [];

        pcmStream.on(
            "data",
            chunk => {
                morceaux.push(
                    chunk
                );
            }
        );

        opusStream.on(
            "error",
            error => {
                console.error(
                    "❌ Erreur stream Opus :",
                    error
                );
            }
        );

        decoder.on(
            "error",
            error => {
                console.error(
                    "❌ Erreur décodeur Opus :",
                    error
                );
            }
        );

        pcmStream.on(
            "end",
            async () => {
                utilisateursEnCours.delete(
                    userId
                );

                console.log(
                    `🔇 ${membre.user.username} a terminé sa phrase`
                );

                if (
                    morceaux.length === 0
                ) {
                    console.log(
                        "⚠️ Aucun morceau audio reçu."
                    );

                    return;
                }

                const pcmBuffer =
                    Buffer.concat(
                        morceaux
                    );

                console.log(
                    `📦 Audio : ${pcmBuffer.length} octets`
                );

                // Ignore petits bruits / clics micro
                if (
                    pcmBuffer.length <
                    15000
                ) {
                    console.log(
                        "⚠️ Audio trop court, ignoré."
                    );

                    return;
                }

                const wavBuffer =
                    creerWav(
                        pcmBuffer
                    );

                const texte =
                    await transcrireAudio(
                        wavBuffer,
                        membre.user.username
                    );

                if (!texte) {
                    return;
                }

                await envoyerTranscription(
                    guild,
                    membre,
                    texte
                ).catch(error => {
                    console.error(
                        "❌ Envoi transcription :",
                        error
                    );
                });
            }
        );

    } catch (error) {
        utilisateursEnCours.delete(
            userId
        );

        console.error(
            "❌ Erreur écoute utilisateur :",
            error
        );
    }
}

// ======================================================
// COMMANDE /JOIN
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "join"
            )
            .setDescription(
                "Faire rejoindre un vocal au bot avec retranscription"
            )
            .addChannelOption(option =>
                option
                    .setName(
                        "salon"
                    )
                    .setDescription(
                        "Salon vocal à rejoindre"
                    )
                    .addChannelTypes(
                        ChannelType.GuildVoice
                    )
                    .setRequired(
                        true
                    )
            ),

    async execute(
        interaction,
        client
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const salon =
            interaction.options.getChannel(
                "salon"
            );

        if (!salon) {
            return interaction.editReply({
                content:
                    "❌ Salon vocal introuvable."
            });
        }

        try {
            // ==============================================
            // DÉTRUIRE ANCIENNE CONNEXION
            // ==============================================

            if (
                client.voiceConnection
            ) {
                try {
                    client.voiceConnection.destroy();
                } catch {}
            }

            // ==============================================
            // REJOINDRE VOCAL
            // ==============================================

            const connection =
                joinVoiceChannel({
                    channelId:
                        salon.id,

                    guildId:
                        interaction.guild.id,

                    adapterCreator:
                        interaction.guild
                            .voiceAdapterCreator,

                    // OBLIGATOIRE POUR RECEVOIR LES VOIX
                    selfDeaf:
                        false,

                    selfMute:
                        false
                });

            client.voiceConnection =
                connection;

            client.voiceChannelId =
                salon.id;

            // ==============================================
            // ATTENDRE QUE DISCORD SOIT PRÊT
            // ==============================================

            console.log(
                "🟠 Connexion au vocal..."
            );

            await entersState(
                connection,
                VoiceConnectionStatus.Ready,
                20000
            );

            console.log(
                `🟢 Connecté : ${salon.name}`
            );

            console.log(
                "🎧 Réception audio activée"
            );

            console.log(
                `📝 Transcription → ${TRANSCRIPTION_CHANNEL_ID}`
            );

            // ==============================================
            // DÉTECTION PAROLE
            // ==============================================

            connection.receiver.speaking.on(
                "start",
                userId => {
                    console.log(
                        `🔊 Parole détectée : ${userId}`
                    );

                    ecouterUtilisateur(
                        connection,
                        interaction.guild,
                        userId
                    );
                }
            );

            connection.on(
                "error",
                error => {
                    console.error(
                        "❌ Erreur VoiceConnection :",
                        error
                    );
                }
            );

            connection.on(
                VoiceConnectionStatus.Disconnected,
                () => {
                    console.log(
                        "🔴 Connexion vocale interrompue."
                    );
                }
            );

            // ==============================================
            // MESSAGE DANS LE SALON DE TRANSCRIPTION
            // ==============================================

            const transcriptionSalon =
                await interaction.guild.channels
                    .fetch(
                        TRANSCRIPTION_CHANNEL_ID
                    )
                    .catch(() => null);

            if (
                transcriptionSalon?.isTextBased()
            ) {
                await transcriptionSalon.send({
                    content:
`🎙️ **Retranscription vocale activée**

🔊 Salon : ${salon}
🤖 Bot : <@${client.user.id}>

-# Les paroles sont retranscrites automatiquement après chaque phrase.`
                }).catch(() => {});
            }

            return interaction.editReply({
                content:
`✅ J'ai rejoint **${salon.name}**.

🎙️ Retranscription activée dans <#${TRANSCRIPTION_CHANNEL_ID}>.`
            });

        } catch (error) {
            console.error("");
            console.error(
                "❌ ERREUR /JOIN :",
                error
            );
            console.error("");

            return interaction.editReply({
                content:
                    `❌ Impossible de rejoindre le vocal.\n\`${error.message}\``
            });
        }
    }
};