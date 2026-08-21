const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType
} = require("@discordjs/voice");

const prism = require("prism-media");
const OpenAI = require("openai");

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ======================================================
// VOIX OPENAI
// ======================================================

const VOIX = {
    alloy: {
        nom: "Alloy",
        voice: "alloy"
    },

    ash: {
        nom: "Ash",
        voice: "ash"
    },

    coral: {
        nom: "Coral",
        voice: "coral"
    },

    echo: {
        nom: "Echo",
        voice: "echo"
    },

    fable: {
        nom: "Fable",
        voice: "fable"
    },

    onyx: {
        nom: "Onyx",
        voice: "onyx"
    },

    nova: {
        nom: "Nova",
        voice: "nova"
    },

    sage: {
        nom: "Sage",
        voice: "sage"
    },

    shimmer: {
        nom: "Shimmer",
        voice: "shimmer"
    }
};

// ======================================================
// EFFETS DE HAUTEUR
// ======================================================

const EFFETS = {
    normale: {
        nom: "Normale",
        factor: 1
    },

    grave: {
        nom: "Grave",
        factor: 0.86
    },

    tres_grave: {
        nom: "Très grave",
        factor: 0.72
    },

    aigue: {
        nom: "Aiguë",
        factor: 1.18
    },

    tres_aigue: {
        nom: "Très aiguë",
        factor: 1.40
    }
};

// ======================================================
// CRÉER AUDIO OPENAI
// ======================================================

async function genererVoix(
    texte,
    voix,
    style
) {
    const fichierTemp = path.join(
        os.tmpdir(),
        `legacy-tts-${crypto.randomUUID()}.mp3`
    );

    const response =
        await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",

            voice: voix,

            input: texte,

            instructions: style,

            response_format: "mp3"
        });

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    fs.writeFileSync(
        fichierTemp,
        buffer
    );

    return fichierTemp;
}

// ======================================================
// FFMPEG / PITCH
// ======================================================

function creerStreamFFmpeg(
    fichier,
    factor
) {
    const tempo =
        1 / factor;

    let filtre =
        "aresample=48000";

    if (factor !== 1) {
        filtre =
            `asetrate=48000*${factor},aresample=48000,atempo=${tempo}`;
    }

    console.log(
        "🎚️ Effet voix :",
        filtre
    );

    const ffmpeg =
        new prism.FFmpeg({
            args: [
                "-loglevel",
                "error",

                "-i",
                fichier,

                "-vn",

                "-filter:a",
                filtre,

                "-f",
                "s16le",

                "-ar",
                "48000",

                "-ac",
                "2",

                "pipe:1"
            ]
        });

    return ffmpeg;
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("parler")
            .setDescription(
                "Faire parler le bot dans le vocal"
            )

            .addStringOption(option =>
                option
                    .setName("texte")
                    .setDescription(
                        "Texte que le bot doit prononcer"
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("voix")
                    .setDescription(
                        "Voix utilisée par le bot"
                    )
                    .setRequired(false)
                    .addChoices(
                        {
                            name: "Alloy",
                            value: "alloy"
                        },
                        {
                            name: "Ash",
                            value: "ash"
                        },
                        {
                            name: "Coral",
                            value: "coral"
                        },
                        {
                            name: "Echo",
                            value: "echo"
                        },
                        {
                            name: "Fable",
                            value: "fable"
                        },
                        {
                            name: "Onyx",
                            value: "onyx"
                        },
                        {
                            name: "Nova",
                            value: "nova"
                        },
                        {
                            name: "Sage",
                            value: "sage"
                        },
                        {
                            name: "Shimmer",
                            value: "shimmer"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName("effet")
                    .setDescription(
                        "Hauteur de la voix"
                    )
                    .setRequired(false)
                    .addChoices(
                        {
                            name: "Normale",
                            value: "normale"
                        },
                        {
                            name: "Grave",
                            value: "grave"
                        },
                        {
                            name: "Très grave",
                            value: "tres_grave"
                        },
                        {
                            name: "Aiguë",
                            value: "aigue"
                        },
                        {
                            name: "Très aiguë",
                            value: "tres_aigue"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName("style")
                    .setDescription(
                        "Style de parole"
                    )
                    .setRequired(false)
                    .addChoices(
                        {
                            name: "Normal",
                            value: "normal"
                        },
                        {
                            name: "Calme",
                            value: "calme"
                        },
                        {
                            name: "Sérieux",
                            value: "serieux"
                        },
                        {
                            name: "Mystérieux",
                            value: "mysterieux"
                        },
                        {
                            name: "Énergique",
                            value: "energique"
                        },
                        {
                            name: "Autoritaire",
                            value: "autoritaire"
                        }
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

        // ==================================================
        // CONNEXION VOCALE
        // ==================================================

        if (
            !client.voiceConnection
        ) {
            return interaction.editReply({
                content:
                    "❌ Je dois d'abord rejoindre un vocal avec `/join`."
            });
        }

        // ==================================================
        // OPTIONS
        // ==================================================

        const texte =
            interaction.options.getString(
                "texte"
            );

        const voixChoisie =
            interaction.options.getString(
                "voix"
            ) ||
            "onyx";

        const effetChoisi =
            interaction.options.getString(
                "effet"
            ) ||
            "normale";

        const styleChoisi =
            interaction.options.getString(
                "style"
            ) ||
            "normal";

        const voix =
            VOIX[
                voixChoisie
            ] ||
            VOIX.onyx;

        const effet =
            EFFETS[
                effetChoisi
            ] ||
            EFFETS.normale;

        // ==================================================
        // INSTRUCTIONS DE STYLE
        // ==================================================

        const styles = {
            normal:
                "Parle naturellement en français, de façon claire.",

            calme:
                "Parle en français avec une voix calme, posée et douce.",

            serieux:
                "Parle en français avec un ton sérieux, professionnel et assuré.",

            mysterieux:
                "Parle en français avec un ton mystérieux, lent et légèrement dramatique.",

            energique:
                "Parle en français avec beaucoup d'énergie, de dynamisme et d'enthousiasme.",

            autoritaire:
                "Parle en français avec un ton autoritaire, ferme, grave et assuré."
        };

        const instructions =
            styles[
                styleChoisi
            ] ||
            styles.normal;

        let fichierTemp = null;

        try {
            console.log("");
            console.log(
                `🗣️ Génération voix ${voix.nom}`
            );

            console.log(
                `🎚️ Effet ${effet.nom}`
            );

            console.log(
                `🎭 Style ${styleChoisi}`
            );

            // ==================================================
            // GÉNÉRATION OPENAI
            // ==================================================

            fichierTemp =
                await genererVoix(
                    texte,
                    voix.voice,
                    instructions
                );

            // ==================================================
            // MODIFICATION FFMPEG
            // ==================================================

            const ffmpegStream =
                creerStreamFFmpeg(
                    fichierTemp,
                    effet.factor
                );

            const resource =
                createAudioResource(
                    ffmpegStream,
                    {
                        inputType:
                            StreamType.Raw
                    }
                );

            // ==================================================
            // PLAYER
            // ==================================================

            let player =
                client.voicePlayer;

            if (!player) {
                player =
                    createAudioPlayer({
                        behaviors: {
                            noSubscriber:
                                NoSubscriberBehavior.Play
                        }
                    });

                client.voicePlayer =
                    player;
            }

            client.voiceConnection.subscribe(
                player
            );

            player.play(
                resource
            );

            player.once(
                AudioPlayerStatus.Playing,
                () => {
                    console.log(
                        "🔊 Lecture démarrée"
                    );
                }
            );

            player.once(
                AudioPlayerStatus.Idle,
                () => {
                    console.log(
                        "✅ Fin de lecture"
                    );

                    try {
                        if (
                            fichierTemp &&
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
            );

            player.once(
                "error",
                error => {
                    console.error(
                        "❌ AudioPlayer :",
                        error
                    );

                    try {
                        if (
                            fichierTemp &&
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
            );

            return interaction.editReply({
                content:
`🗣️ **Voix : ${voix.nom}**
🎚️ **Effet : ${effet.nom}**
🎭 **Style : ${styleChoisi}**

> ${texte}`
            });

        } catch (error) {
            console.error("");
            console.error(
                "❌ ERREUR /PARLER"
            );

            console.error(
                error?.status ||
                error?.code ||
                error?.message ||
                error
            );

            if (fichierTemp) {
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

            return interaction.editReply({
                content:
                    `❌ Impossible de générer la voix.\n\`${error.message}\``
            });
        }
    }
};