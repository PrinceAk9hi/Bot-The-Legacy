const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR = 0x3B6475;
const SUCCESS = 0x57F287;
const WARNING = 0xFEE75C;
const ERROR = 0xED4245;

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const DATA_FILE =
    path.join(
        DATA_DIR,
        "legacyGames.json"
    );

// ======================================================
// JEUX
// ======================================================

const GAMES = {
    tictactoe: {
        emoji: "❌⭕",
        name: "Morpion",
        short:
            "Affronte un joueur sur une grille 3×3.",
        description:
            "Deux joueurs s'affrontent à tour de rôle. Le premier qui aligne trois symboles horizontalement, verticalement ou en diagonale remporte la partie."
    },

    bomb: {
        emoji: "💣",
        name: "Bombe",
        short:
            "Passe la bombe avant qu'elle explose.",
        description:
            "Les joueurs présents dans le vocal se passent une bombe. Personne ne connaît le moment exact de l'explosion. Le porteur est éliminé jusqu'au dernier survivant."
    },

    quiz: {
        emoji: "🧠",
        name: "Quiz",
        short:
            "Réponds aux questions avant les autres.",
        description:
            "Plusieurs questions à choix multiples sont posées. Le premier joueur à trouver la bonne réponse marque un point. Un classement est affiché à la fin."
    },

    hangman: {
        emoji: "🔤",
        name: "Pendu",
        short:
            "Découvre le mot lettre par lettre.",
        description:
            "Un mot est choisi secrètement. Les joueurs proposent des lettres et doivent découvrir le mot avant d'épuiser le nombre d'erreurs disponibles."
    },

    rps: {
        emoji: "🃏",
        name: "Pierre • Feuille • Ciseaux",
        short:
            "Un duel avec choix secrets.",
        description:
            "Deux joueurs choisissent secrètement Pierre, Feuille ou Ciseaux. Les choix sont révélés uniquement lorsque les deux joueurs ont joué."
    },

    memory: {
        emoji: "🎨",
        name: "Memory",
        short:
            "Retrouve les paires cachées.",
        description:
            "Deux joueurs retournent chacun deux cartes à leur tour. Une paire trouvée rapporte un point. Celui qui possède le plus de paires gagne."
    },

    higherlower: {
        emoji: "🔢",
        name: "Plus ou moins",
        short:
            "Trouve le nombre secret entre 1 et 100.",
        description:
            "Le bot choisit un nombre secret. Après chaque proposition il indique si le nombre recherché est plus haut ou plus bas."
    },

    code: {
        emoji: "🔐",
        name: "Code secret",
        short:
            "Découvre une combinaison de quatre chiffres.",
        description:
            "À chaque tentative, le bot indique combien de chiffres sont correctement placés et combien sont présents mais mal placés."
    }
};

// ======================================================
// QUESTIONS QUIZ
// ======================================================

const QUIZ = [
    {
        question:
            "Combien de côtés possède un hexagone ?",

        answers: [
            "5",
            "6",
            "7",
            "8"
        ],

        correct:
            1
    },

    {
        question:
            "Quelle planète est la plus proche du Soleil ?",

        answers: [
            "Vénus",
            "Mars",
            "Mercure",
            "Terre"
        ],

        correct:
            2
    },

    {
        question:
            "Combien font 12 × 8 ?",

        answers: [
            "86",
            "92",
            "96",
            "108"
        ],

        correct:
            2
    },

    {
        question:
            "Quel est le symbole chimique de l'or ?",

        answers: [
            "Ag",
            "Au",
            "Fe",
            "Or"
        ],

        correct:
            1
    },

    {
        question:
            "Quel nombre vient après 999 ?",

        answers: [
            "1000",
            "1001",
            "9990",
            "100"
        ],

        correct:
            0
    },

    {
        question:
            "Combien de minutes y a-t-il dans deux heures ?",

        answers: [
            "60",
            "90",
            "120",
            "180"
        ],

        correct:
            2
    },

    {
        question:
            "Dans Discord, que signifie DM ?",

        answers: [
            "Direct Message",
            "Discord Mode",
            "Display Member",
            "Direct Member"
        ],

        correct:
            0
    }
];

// ======================================================
// MOTS PENDU
// ======================================================

const HANGMAN_WORDS = [
    "LEGACY",
    "DISCORD",
    "HERITAGE",
    "VOCAL",
    "TRIBUNAL",
    "RECRUTEMENT",
    "FONDATION",
    "ROBLOX",
    "SURVEILLANCE",
    "MYSTERE"
];

// ======================================================
// MEMORY
// ======================================================

const MEMORY_SYMBOLS = [
    "👑",
    "💎",
    "🪽",
    "⚔️",
    "🔮",
    "🎭",
    "🗝️",
    "🌙"
];

// ======================================================
// DATA
// ======================================================

function defaultData() {
    return {
        version:
            2,

        sessions:
            {}
    };
}

function ensureFile() {
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
            DATA_FILE
        )
    ) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                defaultData(),
                null,
                4
            ),
            "utf8"
        );
    }
}

function loadData() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        const data =
            raw.trim()
                ? JSON.parse(
                    raw
                )
                : defaultData();

        if (
            !data.sessions
        ) {
            data.sessions =
                {};
        }

        data.version =
            2;

        return data;

    } catch (error) {
        console.error(
            "❌ legacyGames.json :",
            error
        );

        return defaultData();
    }
}

function saveData(
    data
) {
    ensureFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );
}

// ======================================================
// UTILS
// ======================================================

function sessionId() {
    return (
        `${Date.now()}${Math.random()
            .toString(36)
            .slice(2, 7)}`
    );
}

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
    const copy =
        [...array];

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

function getVoiceChannel(
    interaction,
    forcedChannelId = null
) {
    if (
        forcedChannelId &&
        forcedChannelId !==
        "none"
    ) {
        return (
            interaction.guild
                ?.channels
                ?.cache
                ?.get(
                    forcedChannelId
                ) ||
            null
        );
    }

    return (
        interaction.member
            ?.voice
            ?.channel ||
        null
    );
}

function getHumanVoiceMembers(
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

// ======================================================
// SESSION
// ======================================================

function createGameSession(
    session
) {
    const data =
        loadData();

    session.createdAt =
        session.createdAt ||
        Date.now();

    session.updatedAt =
        Date.now();

    data.sessions[
        session.id
    ] =
        session;

    saveData(
        data
    );

    return session;
}

function getSession(
    id
) {
    return (
        loadData()
            .sessions[
                id
            ] ||
        null
    );
}

function updateSession(
    session
) {
    const data =
        loadData();

    if (
        !data.sessions[
            session.id
        ]
    ) {
        return false;
    }

    session.updatedAt =
        Date.now();

    data.sessions[
        session.id
    ] =
        session;

    saveData(
        data
    );

    return true;
}

function deleteSession(
    id
) {
    const data =
        loadData();

    delete data.sessions[
        id
    ];

    saveData(
        data
    );
}

// ======================================================
// MESSAGE SESSION
// ======================================================

async function getSessionMessage(
    client,
    session
) {
    const guild =
        client.guilds.cache.get(
            session.guildId
        );

    if (!guild) {
        return null;
    }

    const channel =
        guild.channels.cache.get(
            session.channelId
        ) ||
        await guild.channels
            .fetch(
                session.channelId
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return null;
    }

    if (
        !session.messageId
    ) {
        return null;
    }

    return await channel.messages
        .fetch(
            session.messageId
        )
        .catch(
            () => null
        );
}

// ======================================================
// MEMBRE ENCORE DANS LE VOCAL
// ======================================================

function isMemberStillInGameVoice(
    interaction,
    session,
    userId
) {
    if (
        !session.voiceChannelId
    ) {
        return true;
    }

    const channel =
        interaction.guild
            ?.channels
            ?.cache
            ?.get(
                session.voiceChannelId
            );

    return Boolean(
        channel
            ?.members
            ?.has(
                userId
            )
    );
}

// ======================================================
// HUB
// ======================================================

function buildHubEmbed(
    voiceChannel = null
) {
    const descriptions =
        Object.values(
            GAMES
        )
            .map(
                game =>
`### ${game.emoji} ${game.name}
${game.description}`
            )
            .join(
                "\n\n"
            );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🎮 Legacy Games"
        )
        .setDescription(
`Bienvenue dans le centre de jeux de **The Legacy**.

${voiceChannel
    ? `🔊 **Vocal lié :** <#${voiceChannel.id}>`
    : "🔊 **Aucun vocal lié.** Les jeux nécessitant plusieurs participants demanderont d'en rejoindre un."}

━━━━━━━━━━━━━━━━━━━━

${descriptions}

━━━━━━━━━━━━━━━━━━━━

Choisis maintenant le jeu que tu souhaites lancer dans le menu ci-dessous.`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        })
        .setTimestamp();
}

function createHubComponents(
    voiceChannelId = "none"
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lg_game_${voiceChannelId}`
            )
            .setPlaceholder(
                "🎮 Choisir un mini-jeu"
            );

    for (
        const [
            key,
            game
        ]
        of Object.entries(
            GAMES
        )
    ) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    game.name
                )
                .setValue(
                    key
                )
                .setEmoji(
                    game.emoji
                )
                .setDescription(
                    game.short.slice(
                        0,
                        100
                    )
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                menu
            )
    ];
}

async function openHub(
    interaction,
    forcedVoiceChannelId = null
) {
    const voice =
        getVoiceChannel(
            interaction,
            forcedVoiceChannelId
        );

    const payload = {
        embeds: [
            buildHubEmbed(
                voice
            )
        ],

        components:
            createHubComponents(
                voice?.id ||
                "none"
            ),

        flags:
            MessageFlags.Ephemeral
    };

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        return interaction.followUp(
            payload
        );
    }

    return interaction.reply(
        payload
    );
}

// ======================================================
// PUBLICATION DU JEU
// ======================================================

async function publishGame(
    interaction,
    payload
) {
    if (
        !interaction.channel ||
        !interaction.channel.isTextBased()
    ) {
        throw new Error(
            "Impossible de publier la partie dans ce salon."
        );
    }

    const message =
        await interaction.channel.send(
            payload
        );

    try {
        if (
            interaction.isMessageComponent()
        ) {
            await interaction.update({
                content:
                    `✅ **${payload.embeds?.[0]?.data?.title || "Partie"} lancée !**\nLa partie publique est maintenant visible dans ce salon.`,

                embeds:
                    [],

                components:
                    []
            });

        } else if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    "✅ Partie lancée.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

    } catch {}

    return message;
}

// ======================================================
// PLAYER SELECT
// ======================================================

function opponentSelector({
    type,
    voiceChannelId
}) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(
                        `lg_opponent_${type}_${voiceChannelId || "none"}`
                    )
                    .setPlaceholder(
                        "👤 Choisir ton adversaire"
                    )
                    .setMinValues(
                        1
                    )
                    .setMaxValues(
                        1
                    )
            )
    ];
}

// ======================================================
// MORPION
// ======================================================

function ticTacToeComponents(
    session
) {
    const rows =
        [];

    for (
        let row = 0;
        row <
        3;
        row++
    ) {
        const actionRow =
            new ActionRowBuilder();

        for (
            let col = 0;
            col <
            3;
            col++
        ) {
            const index =
                (
                    row *
                    3
                ) +
                col;

            const value =
                session.board[
                    index
                ];

            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_ttt_${session.id}_${index}`
                    )
                    .setLabel(
                        value ||
                        "‎"
                    )
                    .setStyle(
                        value ===
                        "X"
                            ? ButtonStyle.Danger
                            : value ===
                                "O"
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                    )
                    .setDisabled(
                        Boolean(
                            value
                        ) ||
                        session.finished
                    )
            );
        }

        rows.push(
            actionRow
        );
    }

    return rows;
}

function ticTacToeWinner(
    board
) {
    const possibilities = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];

    for (
        const [
            a,
            b,
            c
        ]
        of possibilities
    ) {
        if (
            board[a] &&
            board[a] ===
                board[b] &&
            board[a] ===
                board[c]
        ) {
            return board[a];
        }
    }

    return null;
}

function buildTicTacToeEmbed(
    session
) {
    const player =
        session.players[
            session.turn
        ];

    let status =
        `🎮 Au tour de <@${player}>`;

    if (
        session.winner
    ) {
        status =
            `🏆 <@${session.winner}> remporte la partie !`;
    }

    if (
        session.draw
    ) {
        status =
            "🤝 Match nul !";
    }

    return new EmbedBuilder()
        .setColor(
            session.finished
                ? SUCCESS
                : COLOR
        )
        .setTitle(
            "❌⭕ Morpion"
        )
        .setDescription(
`<@${session.players[0]}> **X**
contre
<@${session.players[1]}> **O**

${status}`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        });
}

// ======================================================
// RPS
// ======================================================

function rpsButtons(
    id
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_rps_${id}_rock`
                    )
                    .setLabel(
                        "Pierre"
                    )
                    .setEmoji(
                        "🪨"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_rps_${id}_paper`
                    )
                    .setLabel(
                        "Feuille"
                    )
                    .setEmoji(
                        "📄"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_rps_${id}_scissors`
                    )
                    .setLabel(
                        "Ciseaux"
                    )
                    .setEmoji(
                        "✂️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

function rpsWinner(
    a,
    b
) {
    if (
        a ===
        b
    ) {
        return "draw";
    }

    if (
        (
            a ===
            "rock" &&
            b ===
            "scissors"
        ) ||
        (
            a ===
            "paper" &&
            b ===
            "rock"
        ) ||
        (
            a ===
            "scissors" &&
            b ===
            "paper"
        )
    ) {
        return "a";
    }

    return "b";
}

function rpsName(
    value
) {
    return {
        rock:
            "🪨 Pierre",

        paper:
            "📄 Feuille",

        scissors:
            "✂️ Ciseaux"
    }[
        value
    ];
}

// ======================================================
// PLUS OU MOINS
// ======================================================

function higherLowerEmbed(
    session
) {
    const last =
        session.lastGuess;

    let clue =
        "Fais ta première proposition.";

    if (
        last
    ) {
        clue =
            last.value <
            session.secret
                ? `📈 **Plus haut que ${last.value} !**`
                : `📉 **Plus bas que ${last.value} !**`;
    }

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🔢 Plus ou moins"
        )
        .setDescription(
`J'ai choisi un nombre entre **1 et 100**.

${clue}

🎯 **Tentatives :** ${session.attempts}

Clique sur le bouton pour proposer un nombre.`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        });
}

function higherLowerButtons(
    id
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_hl_guess_${id}`
                    )
                    .setLabel(
                        "Proposer un nombre"
                    )
                    .setEmoji(
                        "🔢"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// CODE SECRET
// ======================================================

function evaluateCode(
    secret,
    guess
) {
    let exact =
        0;

    const secretRemaining =
        [];

    const guessRemaining =
        [];

    for (
        let i = 0;
        i <
        secret.length;
        i++
    ) {
        if (
            secret[i] ===
            guess[i]
        ) {
            exact++;

        } else {
            secretRemaining.push(
                secret[i]
            );

            guessRemaining.push(
                guess[i]
            );
        }
    }

    let misplaced =
        0;

    for (
        const digit
        of guessRemaining
    ) {
        const index =
            secretRemaining.indexOf(
                digit
            );

        if (
            index !==
            -1
        ) {
            misplaced++;

            secretRemaining.splice(
                index,
                1
            );
        }
    }

    return {
        exact,
        misplaced
    };
}

function codeEmbed(
    session
) {
    const history =
        session.history
            .slice(
                -8
            )
            .map(
                item =>
                    `\`${item.guess}\` → ✅ ${item.exact} bien placé(s) • 🔄 ${item.misplaced} mal placé(s)`
            )
            .join(
                "\n"
            );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🔐 Code secret"
        )
        .setDescription(
`Découvre le code secret composé de **4 chiffres**.

✅ = bon chiffre, bonne position
🔄 = bon chiffre, mauvaise position

### Tentatives

${history ||
"Aucune tentative pour le moment."}`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        });
}

function codeButtons(
    id
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_code_guess_${id}`
                    )
                    .setLabel(
                        "Proposer un code"
                    )
                    .setEmoji(
                        "🔐"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// PENDU
// ======================================================

function maskedWord(
    session
) {
    return session.word
        .split(
            ""
        )
        .map(
            char =>
                session.correct.includes(
                    char
                )
                    ? char
                    : "_"
        )
        .join(
            " "
        );
}

function hangmanEmbed(
    session
) {
    return new EmbedBuilder()
        .setColor(
            session.finished
                ? (
                    session.won
                        ? SUCCESS
                        : ERROR
                )
                : COLOR
        )
        .setTitle(
            "🔤 Pendu"
        )
        .setDescription(
`### Mot

\`${maskedWord(session)}\`

❤️ **Erreurs restantes :** ${session.maxErrors - session.errors}

✅ **Lettres trouvées :**
${session.correct.join(", ") || "Aucune"}

❌ **Lettres incorrectes :**
${session.wrong.join(", ") || "Aucune"}

${session.finished
    ? session.won
        ? `🏆 Le mot **${session.word}** a été découvert !`
        : `💀 Partie perdue. Le mot était **${session.word}**.`
    : "Propose une lettre grâce au bouton ci-dessous."}`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        });
}

function hangmanButtons(
    id,
    disabled = false
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_hang_letter_${id}`
                    )
                    .setLabel(
                        "Proposer une lettre"
                    )
                    .setEmoji(
                        "🔤"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setDisabled(
                        disabled
                    )
            )
    ];
}

// ======================================================
// QUIZ
// ======================================================

function quizEmbed(
    session
) {
    const question =
        session.questions[
            session.index
        ];

    const scores =
        Object.entries(
            session.scores
        )
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b -
                    a
            )
            .map(
                (
                    [
                        userId,
                        score
                    ],
                    index
                ) =>
                    `${index + 1}. <@${userId}> — **${score} pt${score > 1 ? "s" : ""}**`
            )
            .join(
                "\n"
            );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            `🧠 Quiz • Question ${session.index + 1}/${session.questions.length}`
        )
        .setDescription(
`### ${question.question}

${question.answers
    .map(
        (
            answer,
            index
        ) =>
            `**${index + 1}.** ${answer}`
    )
    .join("\n")}

### 🏆 Classement

${scores ||
"Personne n'a encore marqué de point."}`
        )
        .setFooter({
            text:
                "The Legacy • Legacy Games"
        });
}

function quizButtons(
    session
) {
    const question =
        session.questions[
            session.index
        ];

    return [
        new ActionRowBuilder()
            .addComponents(
                question.answers.map(
                    (
                        answer,
                        index
                    ) =>
                        new ButtonBuilder()
                            .setCustomId(
                                `lg_quiz_${session.id}_${index}`
                            )
                            .setLabel(
                                String(
                                    index +
                                    1
                                )
                            )
                            .setStyle(
                                ButtonStyle.Secondary
                            )
                )
            )
    ];
}

// ======================================================
// MEMORY
// ======================================================

function memoryEmbed(
    session
) {
    return new EmbedBuilder()
        .setColor(
            session.finished
                ? SUCCESS
                : COLOR
        )
        .setTitle(
            "🎨 Memory"
        )
        .setDescription(
`<@${session.players[0]}> contre <@${session.players[1]}>

### Scores

<@${session.players[0]}> — **${session.scores[session.players[0]] || 0} paire(s)**
<@${session.players[1]}> — **${session.scores[session.players[1]] || 0} paire(s)**

${session.finished
    ? session.winner
        ? `🏆 <@${session.winner}> remporte le Memory !`
        : "🤝 Égalité parfaite !"
    : `🎮 Au tour de <@${session.players[session.turn]}>`}`
        );
}

function memoryComponents(
    session
) {
    const rows =
        [];

    for (
        let row = 0;
        row <
        4;
        row++
    ) {
        const components =
            new ActionRowBuilder();

        for (
            let col = 0;
            col <
            4;
            col++
        ) {
            const index =
                (
                    row *
                    4
                ) +
                col;

            const revealed =
                session.revealed.includes(
                    index
                ) ||
                session.matched.includes(
                    index
                );

            components.addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_mem_${session.id}_${index}`
                    )
                    .setLabel(
                        revealed
                            ? session.cards[
                                index
                            ]
                            : "?"
                    )
                    .setStyle(
                        session.matched.includes(
                            index
                        )
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
                    .setDisabled(
                        session.matched.includes(
                            index
                        ) ||
                        session.finished ||
                        session.locked
                    )
            );
        }

        rows.push(
            components
        );
    }

    return rows;
}

// ======================================================
// BOMBE
// ======================================================

function bombEmbed(
    session
) {
    const alive =
        session.alive
            .map(
                id =>
                    `<@${id}>`
            )
            .join(
                "\n"
            );

    return new EmbedBuilder()
        .setColor(
            session.finished
                ? SUCCESS
                : ERROR
        )
        .setTitle(
            "💣 Bombe Legacy"
        )
        .setDescription(
`### 💣 Porteur actuel

${session.finished
    ? "💥 La bombe a terminé sa course."
    : `<@${session.holderId}>`}

Personne ne connaît le moment exact de l'explosion...

### 👥 Survivants • ${session.alive.length}

${alive || "Aucun survivant."}

${session.finished
    ? `🏆 <@${session.winner}> est le dernier survivant !`
    : `<@${session.holderId}>, passe vite la bombe !`}`
        )
        .setFooter({
            text:
                session.finished
                    ? "The Legacy • Partie terminée"
                    : "The Legacy • Ne tarde pas..."
        });
}

function bombButtons(
    session
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_bomb_pass_${session.id}`
                    )
                    .setLabel(
                        "Passer la bombe"
                    )
                    .setEmoji(
                        "💣"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        session.finished
                    )
            )
    ];
}

// ======================================================
// START SELECTED GAME
// ======================================================

async function startSelectedGame(
    interaction,
    game,
    voiceChannelId
) {
    const voice =
        getVoiceChannel(
            interaction,
            voiceChannelId
        );

    // ==================================================
    // DUELS
    // ==================================================

    if (
        [
            "tictactoe",
            "rps",
            "memory"
        ].includes(
            game
        )
    ) {
        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        COLOR
                    )
                    .setTitle(
                        `${GAMES[game].emoji} ${GAMES[game].name}`
                    )
                    .setDescription(
`${GAMES[game].description}

👤 Choisis maintenant ton adversaire.`
                    )
            ],

            components:
                opponentSelector({
                    type:
                        game,

                    voiceChannelId:
                        voice?.id ||
                        "none"
                })
        });
    }

    // ==================================================
    // GROUPE VOCAL
    // ==================================================

    const groupGames = [
        "bomb",
        "quiz",
        "hangman",
        "higherlower",
        "code"
    ];

    if (
        groupGames.includes(
            game
        ) &&
        !voice
    ) {
        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        ERROR
                    )
                    .setTitle(
                        "❌ Vocal requis"
                    )
                    .setDescription(
                        "Ce jeu utilise les participants présents dans un salon vocal. Rejoins un vocal puis relance `/legacygames`."
                    )
            ],

            components:
                []
        });
    }

    const humans =
        getHumanVoiceMembers(
            voice
        );

    if (
        game ===
        "bomb" &&
        humans.length <
        2
    ) {
        return interaction.update({
            content:
                "❌ Il faut au moins **2 joueurs** dans le vocal pour lancer la bombe.",

            embeds:
                [],

            components:
                []
        });
    }

    if (
        [
            "quiz",
            "hangman",
            "higherlower",
            "code"
        ].includes(
            game
        ) &&
        humans.length <
        1
    ) {
        return interaction.update({
            content:
                "❌ Aucun joueur humain détecté dans le vocal.",

            embeds:
                [],

            components:
                []
        });
    }

    // ==================================================
    // BOMBE
    // ==================================================

    if (
        game ===
        "bomb"
    ) {
        const id =
            sessionId();

        const playerIds =
            shuffle(
                humans.map(
                    member =>
                        member.id
                )
            );

        const session = {
            id,

            type:
                "bomb",

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            voiceChannelId:
                voice.id,

            hostId:
                interaction.user.id,

            alive:
                playerIds,

            holderId:
                randomItem(
                    playerIds
                ),

            explodesAt:
                Date.now() +
                (
                    15_000 +
                    Math.floor(
                        Math.random() *
                        25_000
                    )
                ),

            finished:
                false,

            winner:
                null
        };

        const message =
            await publishGame(
                interaction,
                {
                    content:
                        "💣 **La bombe est amorcée !**",

                    embeds: [
                        bombEmbed(
                            session
                        )
                    ],

                    components:
                        bombButtons(
                            session
                        ),

                    allowedMentions: {
                        users:
                            playerIds
                    }
                }
            );

        session.messageId =
            message.id;

        createGameSession(
            session
        );

        return;
    }

    // ==================================================
    // QUIZ
    // ==================================================

    if (
        game ===
        "quiz"
    ) {
        const session = {
            id:
                sessionId(),

            type:
                "quiz",

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            voiceChannelId:
                voice.id,

            hostId:
                interaction.user.id,

            players:
                humans.map(
                    member =>
                        member.id
                ),

            questions:
                shuffle(
                    QUIZ
                ).slice(
                    0,
                    5
                ),

            index:
                0,

            scores:
                {},

            answered:
                false,

            finished:
                false
        };

        const message =
            await publishGame(
                interaction,
                {
                    embeds: [
                        quizEmbed(
                            session
                        )
                    ],

                    components:
                        quizButtons(
                            session
                        )
                }
            );

        session.messageId =
            message.id;

        createGameSession(
            session
        );

        return;
    }

    // ==================================================
    // PENDU
    // ==================================================

    if (
        game ===
        "hangman"
    ) {
        const session = {
            id:
                sessionId(),

            type:
                "hangman",

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            voiceChannelId:
                voice.id,

            players:
                humans.map(
                    member =>
                        member.id
                ),

            word:
                randomItem(
                    HANGMAN_WORDS
                ),

            correct:
                [],

            wrong:
                [],

            errors:
                0,

            maxErrors:
                7,

            finished:
                false,

            won:
                false
        };

        const message =
            await publishGame(
                interaction,
                {
                    embeds: [
                        hangmanEmbed(
                            session
                        )
                    ],

                    components:
                        hangmanButtons(
                            session.id
                        )
                }
            );

        session.messageId =
            message.id;

        createGameSession(
            session
        );

        return;
    }

    // ==================================================
    // PLUS OU MOINS
    // ==================================================

    if (
        game ===
        "higherlower"
    ) {
        const session = {
            id:
                sessionId(),

            type:
                "higherlower",

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            voiceChannelId:
                voice.id,

            players:
                humans.map(
                    member =>
                        member.id
                ),

            secret:
                Math.floor(
                    Math.random() *
                    100
                ) +
                1,

            attempts:
                0,

            lastGuess:
                null,

            finished:
                false
        };

        const message =
            await publishGame(
                interaction,
                {
                    embeds: [
                        higherLowerEmbed(
                            session
                        )
                    ],

                    components:
                        higherLowerButtons(
                            session.id
                        )
                }
            );

        session.messageId =
            message.id;

        createGameSession(
            session
        );

        return;
    }

    // ==================================================
    // CODE SECRET
    // ==================================================

    if (
        game ===
        "code"
    ) {
        const secret =
            String(
                Math.floor(
                    Math.random() *
                    10_000
                )
            ).padStart(
                4,
                "0"
            );

        const session = {
            id:
                sessionId(),

            type:
                "code",

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            voiceChannelId:
                voice.id,

            players:
                humans.map(
                    member =>
                        member.id
                ),

            secret,

            history:
                [],

            finished:
                false
        };

        const message =
            await publishGame(
                interaction,
                {
                    embeds: [
                        codeEmbed(
                            session
                        )
                    ],

                    components:
                        codeButtons(
                            session.id
                        )
                }
            );

        session.messageId =
            message.id;

        createGameSession(
            session
        );

        return;
    }
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "legacygames"
            )
            .setDescription(
                "Ouvrir le centre de mini-jeux The Legacy"
            ),

    async execute(
        interaction
    ) {
        return openHub(
            interaction
        );
    },

    // ==================================================
    // HANDLE SELECT
    // ==================================================

    async handleSelect(
        interaction,
        client
    ) {
        // ==============================================
        // CHOIX DU JEU
        // ==============================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId
                .startsWith(
                    "lg_game_"
                )
        ) {
            const voiceChannelId =
                interaction.customId
                    .replace(
                        "lg_game_",
                        ""
                    );

            const game =
                interaction.values[
                    0
                ];

            if (
                !GAMES[
                    game
                ]
            ) {
                return true;
            }

            await startSelectedGame(
                interaction,
                game,
                voiceChannelId
            );

            return true;
        }

        // ==============================================
        // ADVERSAIRE
        // ==============================================

        if (
            interaction.isUserSelectMenu() &&
            interaction.customId
                .startsWith(
                    "lg_opponent_"
                )
        ) {
            const match =
                interaction.customId.match(
                    /^lg_opponent_([^_]+)_(.+)$/
                );

            if (!match) {
                return false;
            }

            const type =
                match[1];

            const voiceChannelId =
                match[2];

            const opponentId =
                interaction.values[
                    0
                ];

            if (
                opponentId ===
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "😭 Tu ne peux pas jouer contre toi-même.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const opponent =
                await interaction.guild
                    .members
                    .fetch(
                        opponentId
                    )
                    .catch(
                        () => null
                    );

            if (
                !opponent ||
                opponent.user.bot
            ) {
                await interaction.reply({
                    content:
                        "❌ Adversaire invalide.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            // ==========================================
            // VOCAL LIÉ
            // ==========================================

            if (
                voiceChannelId !==
                "none"
            ) {
                const voice =
                    interaction.guild.channels.cache.get(
                        voiceChannelId
                    );

                if (
                    voice &&
                    (
                        !voice.members.has(
                            interaction.user.id
                        ) ||
                        !voice.members.has(
                            opponentId
                        )
                    )
                ) {
                    await interaction.reply({
                        content:
                            `❌ Vous devez tous les deux être dans <#${voiceChannelId}> pour lancer ce duel.`,

                        flags:
                            MessageFlags.Ephemeral
                    });

                    return true;
                }
            }

            // ==========================================
            // MORPION
            // ==========================================

            if (
                type ===
                "tictactoe"
            ) {
                const session = {
                    id:
                        sessionId(),

                    type:
                        "tictactoe",

                    guildId:
                        interaction.guild.id,

                    channelId:
                        interaction.channel.id,

                    messageId:
                        null,

                    voiceChannelId:
                        voiceChannelId !==
                        "none"
                            ? voiceChannelId
                            : null,

                    players: [
                        interaction.user.id,
                        opponentId
                    ],

                    board:
                        Array(
                            9
                        ).fill(
                            null
                        ),

                    turn:
                        0,

                    winner:
                        null,

                    draw:
                        false,

                    finished:
                        false
                };

                const message =
                    await publishGame(
                        interaction,
                        {
                            content:
                                `<@${interaction.user.id}> défie <@${opponentId}> !`,

                            embeds: [
                                buildTicTacToeEmbed(
                                    session
                                )
                            ],

                            components:
                                ticTacToeComponents(
                                    session
                                ),

                            allowedMentions: {
                                users: [
                                    interaction.user.id,
                                    opponentId
                                ]
                            }
                        }
                    );

                session.messageId =
                    message.id;

                createGameSession(
                    session
                );

                return true;
            }

            // ==========================================
            // RPS
            // ==========================================

            if (
                type ===
                "rps"
            ) {
                const session = {
                    id:
                        sessionId(),

                    type:
                        "rps",

                    guildId:
                        interaction.guild.id,

                    channelId:
                        interaction.channel.id,

                    messageId:
                        null,

                    voiceChannelId:
                        voiceChannelId !==
                        "none"
                            ? voiceChannelId
                            : null,

                    players: [
                        interaction.user.id,
                        opponentId
                    ],

                    choices:
                        {},

                    finished:
                        false
                };

                const message =
                    await publishGame(
                        interaction,
                        {
                            content:
                                `<@${interaction.user.id}> défie <@${opponentId}> !`,

                            embeds: [
                                new EmbedBuilder()
                                    .setColor(
                                        COLOR
                                    )
                                    .setTitle(
                                        "🃏 Pierre • Feuille • Ciseaux"
                                    )
                                    .setDescription(
`<@${interaction.user.id}> contre <@${opponentId}>

Les deux joueurs doivent choisir secrètement leur coup.

🔐 Les choix ne seront révélés qu'une fois les deux réponses reçues.`
                                    )
                            ],

                            components:
                                rpsButtons(
                                    session.id
                                ),

                            allowedMentions: {
                                users: [
                                    interaction.user.id,
                                    opponentId
                                ]
                            }
                        }
                    );

                session.messageId =
                    message.id;

                createGameSession(
                    session
                );

                return true;
            }

            // ==========================================
            // MEMORY
            // ==========================================

            if (
                type ===
                "memory"
            ) {
                const cards =
                    shuffle([
                        ...MEMORY_SYMBOLS,
                        ...MEMORY_SYMBOLS
                    ]);

                const session = {
                    id:
                        sessionId(),

                    type:
                        "memory",

                    guildId:
                        interaction.guild.id,

                    channelId:
                        interaction.channel.id,

                    messageId:
                        null,

                    voiceChannelId:
                        voiceChannelId !==
                        "none"
                            ? voiceChannelId
                            : null,

                    players: [
                        interaction.user.id,
                        opponentId
                    ],

                    cards,

                    matched:
                        [],

                    revealed:
                        [],

                    scores: {
                        [interaction.user.id]:
                            0,

                        [opponentId]:
                            0
                    },

                    turn:
                        0,

                    locked:
                        false,

                    finished:
                        false,

                    winner:
                        null
                };

                const message =
                    await publishGame(
                        interaction,
                        {
                            content:
                                `<@${interaction.user.id}> contre <@${opponentId}>`,

                            embeds: [
                                memoryEmbed(
                                    session
                                )
                            ],

                            components:
                                memoryComponents(
                                    session
                                ),

                            allowedMentions: {
                                users: [
                                    interaction.user.id,
                                    opponentId
                                ]
                            }
                        }
                    );

                session.messageId =
                    message.id;

                createGameSession(
                    session
                );

                return true;
            }

            return true;
        }

        // ==============================================
        // CIBLE BOMBE
        // ==============================================

        if (
            interaction.isUserSelectMenu() &&
            interaction.customId
                .startsWith(
                    "lg_bomb_target_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_bomb_target_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (
                !session ||
                session.finished
            ) {
                await interaction.reply({
                    content:
                        "❌ Cette partie n'est plus disponible.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );

                return true;
            }

            if (
                session.holderId !==
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu n'as plus la bombe.",

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

            if (
                targetId ===
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "😭 Tu ne peux pas te passer la bombe à toi-même.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                !session.alive.includes(
                    targetId
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Ce joueur est déjà éliminé ou ne participe pas à la partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const voice =
                interaction.guild.channels.cache.get(
                    session.voiceChannelId
                );

            if (
                !voice ||
                !voice.members.has(
                    targetId
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Cette personne n'est plus dans le vocal de la partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            // ==========================================
            // PASSAGE DE LA BOMBE
            // ==========================================

            session.holderId =
                targetId;

            updateSession(
                session
            );

            const gameMessage =
                await getSessionMessage(
                    client ||
                    interaction.client,
                    session
                );

            await gameMessage
                ?.edit({
                    embeds: [
                        bombEmbed(
                            session
                        )
                    ],

                    components:
                        bombButtons(
                            session
                        )
                })
                .catch(
                    () => {}
                );

            await interaction.update({
                content:
                    `💣 Bombe passée à <@${targetId}> !`,

                components:
                    []
            });

            return true;
        }

        return false;
    },

    // ==================================================
    // HANDLE BUTTON
    // ==================================================

    async handleButton(
        interaction,
        client
    ) {
        // ==============================================
        // MORPION
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_ttt_"
                )
        ) {
            const match =
                interaction.customId.match(
                    /^lg_ttt_(.+)_(\d)$/
                );

            if (!match) {
                return false;
            }

            const session =
                getSession(
                    match[1]
                );

            const index =
                Number(
                    match[2]
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à cette partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.players[
                    session.turn
                ] !==
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "⏳ Ce n'est pas ton tour.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.board[
                    index
                ]
            ) {
                return true;
            }

            session.board[
                index
            ] =
                session.turn ===
                0
                    ? "X"
                    : "O";

            const winnerSymbol =
                ticTacToeWinner(
                    session.board
                );

            if (
                winnerSymbol
            ) {
                session.winner =
                    winnerSymbol ===
                    "X"
                        ? session.players[
                            0
                        ]
                        : session.players[
                            1
                        ];

                session.finished =
                    true;

            } else if (
                session.board.every(
                    Boolean
                )
            ) {
                session.draw =
                    true;

                session.finished =
                    true;

            } else {
                session.turn =
                    session.turn ===
                    0
                        ? 1
                        : 0;
            }

            updateSession(
                session
            );

            await interaction.update({
                embeds: [
                    buildTicTacToeEmbed(
                        session
                    )
                ],

                components:
                    ticTacToeComponents(
                        session
                    )
            });

            if (
                session.finished
            ) {
                deleteSession(
                    session.id
                );
            }

            return true;
        }

        // ==============================================
        // RPS
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_rps_"
                )
        ) {
            const match =
                interaction.customId.match(
                    /^lg_rps_(.+)_(rock|paper|scissors)$/
                );

            if (!match) {
                return false;
            }

            const session =
                getSession(
                    match[1]
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à ce duel.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.choices[
                    interaction.user.id
                ]
            ) {
                await interaction.reply({
                    content:
                        "⚠️ Tu as déjà fait ton choix.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            session.choices[
                interaction.user.id
            ] =
                match[2];

            updateSession(
                session
            );

            const a =
                session.choices[
                    session.players[
                        0
                    ]
                ];

            const b =
                session.choices[
                    session.players[
                        1
                    ]
                ];

            if (
                !a ||
                !b
            ) {
                await interaction.reply({
                    content:
                        `✅ Choix enregistré : **${rpsName(match[2])}**.\nTon adversaire ne peut pas voir ton choix.`,

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const result =
                rpsWinner(
                    a,
                    b
                );

            let verdict =
                "🤝 Égalité !";

            if (
                result ===
                "a"
            ) {
                verdict =
                    `🏆 <@${session.players[0]}> remporte le duel !`;
            }

            if (
                result ===
                "b"
            ) {
                verdict =
                    `🏆 <@${session.players[1]}> remporte le duel !`;
            }

            session.finished =
                true;

            updateSession(
                session
            );

            // IMPORTANT :
            // Le deuxième joueur répond en éphémère,
            // mais on modifie le message PUBLIC.
            const gameMessage =
                await getSessionMessage(
                    client ||
                    interaction.client,
                    session
                );

            await gameMessage
                ?.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                SUCCESS
                            )
                            .setTitle(
                                "🃏 Résultat du duel"
                            )
                            .setDescription(
`<@${session.players[0]}> → **${rpsName(a)}**

<@${session.players[1]}> → **${rpsName(b)}**

## ${verdict}`
                            )
                    ],

                    components:
                        []
                })
                .catch(
                    () => {}
                );

            await interaction.reply({
                content:
                    "✅ Les deux choix sont enregistrés. Résultat révélé dans le salon !",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );

            deleteSession(
                session.id
            );

            return true;
        }

        // ==============================================
        // PLUS OU MOINS MODAL
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_hl_guess_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_hl_guess_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (!session) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                ) ||
                !isMemberStillInGameVoice(
                    interaction,
                    session,
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à cette partie ou tu as quitté le vocal.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `lg_hl_modal_${id}`
                    )
                    .setTitle(
                        "Plus ou moins"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "guess"
                            )
                            .setLabel(
                                "Ton nombre entre 1 et 100"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setMaxLength(
                                3
                            )
                            .setRequired(
                                true
                            )
                    )
            );

            await interaction.showModal(
                modal
            );

            return true;
        }

        // ==============================================
        // CODE MODAL
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_code_guess_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_code_guess_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (!session) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                ) ||
                !isMemberStillInGameVoice(
                    interaction,
                    session,
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à cette partie ou tu as quitté le vocal.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `lg_code_modal_${id}`
                    )
                    .setTitle(
                        "Code secret"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "guess"
                            )
                            .setLabel(
                                "Code de quatre chiffres"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setMinLength(
                                4
                            )
                            .setMaxLength(
                                4
                            )
                            .setRequired(
                                true
                            )
                    )
            );

            await interaction.showModal(
                modal
            );

            return true;
        }

        // ==============================================
        // PENDU MODAL
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_hang_letter_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_hang_letter_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (!session) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                ) ||
                !isMemberStillInGameVoice(
                    interaction,
                    session,
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à cette partie ou tu as quitté le vocal.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `lg_hang_modal_${id}`
                    )
                    .setTitle(
                        "Proposer une lettre"
                    );

            modal.addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId(
                                "letter"
                            )
                            .setLabel(
                                "Une lettre"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setMinLength(
                                1
                            )
                            .setMaxLength(
                                1
                            )
                            .setRequired(
                                true
                            )
                    )
            );

            await interaction.showModal(
                modal
            );

            return true;
        }

        // ==============================================
        // QUIZ
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_quiz_"
                )
        ) {
            const match =
                interaction.customId.match(
                    /^lg_quiz_(.+)_(\d)$/
                );

            if (!match) {
                return false;
            }

            const session =
                getSession(
                    match[1]
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            if (
                !session.players.includes(
                    interaction.user.id
                ) ||
                !isMemberStillInGameVoice(
                    interaction,
                    session,
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu dois être un joueur de cette partie et rester dans le vocal.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.answered
            ) {
                await interaction.reply({
                    content:
                        "⏳ Quelqu'un a déjà trouvé cette réponse.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const answer =
                Number(
                    match[2]
                );

            const question =
                session.questions[
                    session.index
                ];

            if (
                answer !==
                question.correct
            ) {
                await interaction.reply({
                    content:
                        "❌ Mauvaise réponse !",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            session.answered =
                true;

            session.scores[
                interaction.user.id
            ] =
                (
                    session.scores[
                        interaction.user.id
                    ] ||
                    0
                ) +
                1;

            updateSession(
                session
            );

            await interaction.reply({
                content:
                    "✅ Bonne réponse ! **+1 point**",

                flags:
                    MessageFlags.Ephemeral
            });

            setTimeout(
                async () => {
                    const current =
                        getSession(
                            session.id
                        );

                    if (!current) {
                        return;
                    }

                    current.index++;

                    current.answered =
                        false;

                    const message =
                        await getSessionMessage(
                            client ||
                            interaction.client,
                            current
                        );

                    if (
                        current.index >=
                        current.questions.length
                    ) {
                        current.finished =
                            true;

                        const ranking =
                            Object.entries(
                                current.scores
                            )
                                .sort(
                                    (
                                        [, a],
                                        [, b]
                                    ) =>
                                        b -
                                        a
                                )
                                .map(
                                    (
                                        [
                                            userId,
                                            score
                                        ],
                                        index
                                    ) =>
                                        `${index + 1}. <@${userId}> — **${score} point(s)**`
                                )
                                .join(
                                    "\n"
                                );

                        await message
                            ?.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor(
                                            SUCCESS
                                        )
                                        .setTitle(
                                            "🏆 Quiz terminé"
                                        )
                                        .setDescription(
`### Classement final

${ranking ||
"Aucun point marqué."}`
                                        )
                                ],

                                components:
                                    []
                            })
                            .catch(
                                () => {}
                            );

                        deleteSession(
                            current.id
                        );

                        return;
                    }

                    updateSession(
                        current
                    );

                    await message
                        ?.edit({
                            embeds: [
                                quizEmbed(
                                    current
                                )
                            ],

                            components:
                                quizButtons(
                                    current
                                )
                        })
                        .catch(
                            () => {}
                        );

                },
                2000
            );

            return true;
        }

        // ==============================================
        // MEMORY
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_mem_"
                )
        ) {
            const match =
                interaction.customId.match(
                    /^lg_mem_(.+)_(\d+)$/
                );

            if (!match) {
                return false;
            }

            const session =
                getSession(
                    match[1]
                );

            const index =
                Number(
                    match[2]
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            if (
                session.players[
                    session.turn
                ] !==
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "⏳ Ce n'est pas ton tour.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.locked ||
                session.revealed.includes(
                    index
                ) ||
                session.matched.includes(
                    index
                )
            ) {
                return true;
            }

            session.revealed.push(
                index
            );

            updateSession(
                session
            );

            await interaction.update({
                embeds: [
                    memoryEmbed(
                        session
                    )
                ],

                components:
                    memoryComponents(
                        session
                    )
            });

            if (
                session.revealed.length <
                2
            ) {
                return true;
            }

            const [
                first,
                second
            ] =
                session.revealed;

            if (
                session.cards[
                    first
                ] ===
                session.cards[
                    second
                ]
            ) {
                session.matched.push(
                    first,
                    second
                );

                session.scores[
                    interaction.user.id
                ]++;

                session.revealed =
                    [];

                if (
                    session.matched.length ===
                    16
                ) {
                    session.finished =
                        true;

                    const a =
                        session.scores[
                            session.players[
                                0
                            ]
                        ];

                    const b =
                        session.scores[
                            session.players[
                                1
                            ]
                        ];

                    if (
                        a >
                        b
                    ) {
                        session.winner =
                            session.players[
                                0
                            ];
                    }

                    if (
                        b >
                        a
                    ) {
                        session.winner =
                            session.players[
                                1
                            ];
                    }
                }

                updateSession(
                    session
                );

                await interaction.message
                    .edit({
                        embeds: [
                            memoryEmbed(
                                session
                            )
                        ],

                        components:
                            memoryComponents(
                                session
                            )
                    })
                    .catch(
                        () => {}
                    );

                if (
                    session.finished
                ) {
                    deleteSession(
                        session.id
                    );
                }

                return true;
            }

            // PAS DE PAIRE
            session.locked =
                true;

            updateSession(
                session
            );

            await interaction.message
                .edit({
                    embeds: [
                        memoryEmbed(
                            session
                        )
                    ],

                    components:
                        memoryComponents(
                            session
                        )
                })
                .catch(
                    () => {}
                );

            setTimeout(
                async () => {
                    const current =
                        getSession(
                            session.id
                        );

                    if (!current) {
                        return;
                    }

                    current.revealed =
                        [];

                    current.locked =
                        false;

                    current.turn =
                        current.turn ===
                        0
                            ? 1
                            : 0;

                    updateSession(
                        current
                    );

                    const message =
                        await getSessionMessage(
                            client ||
                            interaction.client,
                            current
                        );

                    await message
                        ?.edit({
                            embeds: [
                                memoryEmbed(
                                    current
                                )
                            ],

                            components:
                                memoryComponents(
                                    current
                                )
                        })
                        .catch(
                            () => {}
                        );

                },
                1800
            );

            return true;
        }

        // ==============================================
        // BOMBE
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_bomb_pass_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_bomb_pass_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            if (
                session.holderId !==
                interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu n'as pas la bombe.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const voice =
                interaction.guild.channels.cache.get(
                    session.voiceChannelId
                );

            const possible =
                session.alive.filter(
                    userId =>
                        userId !==
                            interaction.user.id &&
                        voice?.members.has(
                            userId
                        )
                );

            if (
                !possible.length
            ) {
                await interaction.reply({
                    content:
                        "❌ Il n'y a aucun autre survivant valide à qui passer la bombe.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await interaction.reply({
                content:
                    "💣 À qui veux-tu passer la bombe ?",

                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new UserSelectMenuBuilder()
                                .setCustomId(
                                    `lg_bomb_target_${session.id}`
                                )
                                .setPlaceholder(
                                    "Choisir un joueur"
                                )
                                .setMinValues(
                                    1
                                )
                                .setMaxValues(
                                    1
                                )
                        )
                ],

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        return false;
    },

    // ==================================================
    // MODALS
    // ==================================================

    async handleModal(
        interaction,
        client
    ) {
        // ==============================================
        // PLUS OU MOINS
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_hl_modal_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_hl_modal_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            const guess =
                Number(
                    interaction.fields
                        .getTextInputValue(
                            "guess"
                        )
                );

            if (
                !Number.isInteger(
                    guess
                ) ||
                guess <
                    1 ||
                guess >
                    100
            ) {
                await interaction.reply({
                    content:
                        "❌ Entre un nombre entier entre 1 et 100.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            session.attempts++;

            const message =
                await getSessionMessage(
                    client ||
                    interaction.client,
                    session
                );

            if (
                guess ===
                session.secret
            ) {
                session.finished =
                    true;

                await message
                    ?.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    SUCCESS
                                )
                                .setTitle(
                                    "🏆 Nombre trouvé !"
                                )
                                .setDescription(
                                    `<@${interaction.user.id}> a trouvé **${session.secret}** en **${session.attempts} tentative(s)** !`
                                )
                        ],

                        components:
                            []
                    })
                    .catch(
                        () => {}
                    );

                await interaction.reply({
                    content:
                        "🏆 Tu as trouvé le nombre !",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );

                deleteSession(
                    session.id
                );

                return true;
            }

            session.lastGuess = {
                value:
                    guess,

                userId:
                    interaction.user.id
            };

            updateSession(
                session
            );

            await message
                ?.edit({
                    embeds: [
                        higherLowerEmbed(
                            session
                        )
                    ],

                    components:
                        higherLowerButtons(
                            session.id
                        )
                })
                .catch(
                    () => {}
                );

            await interaction.reply({
                content:
                    guess <
                    session.secret
                        ? "📈 C'est plus haut !"
                        : "📉 C'est plus bas !",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==============================================
        // CODE
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_code_modal_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_code_modal_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            const guess =
                interaction.fields
                    .getTextInputValue(
                        "guess"
                    )
                    .trim();

            if (
                !/^\d{4}$/.test(
                    guess
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Le code doit contenir exactement 4 chiffres.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            const result =
                evaluateCode(
                    session.secret,
                    guess
                );

            session.history.push({
                guess,

                ...result,

                userId:
                    interaction.user.id
            });

            const message =
                await getSessionMessage(
                    client ||
                    interaction.client,
                    session
                );

            if (
                result.exact ===
                4
            ) {
                session.finished =
                    true;

                await message
                    ?.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    SUCCESS
                                )
                                .setTitle(
                                    "🔓 Code découvert !"
                                )
                                .setDescription(
`<@${interaction.user.id}> a découvert le code secret :

## \`${session.secret}\`

après **${session.history.length} tentative(s)**.`
                                )
                        ],

                        components:
                            []
                    })
                    .catch(
                        () => {}
                    );

                await interaction.reply({
                    content:
                        "🔓 Tu as découvert le code !",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );

                deleteSession(
                    session.id
                );

                return true;
            }

            updateSession(
                session
            );

            await message
                ?.edit({
                    embeds: [
                        codeEmbed(
                            session
                        )
                    ],

                    components:
                        codeButtons(
                            session.id
                        )
                })
                .catch(
                    () => {}
                );

            await interaction.reply({
                content:
                    `✅ ${result.exact} bien placé(s) • 🔄 ${result.misplaced} mal placé(s)`,

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==============================================
        // HANGMAN
        // ==============================================

        if (
            interaction.customId
                .startsWith(
                    "lg_hang_modal_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "lg_hang_modal_",
                        ""
                    );

            const session =
                getSession(
                    id
                );

            if (
                !session ||
                session.finished
            ) {
                return true;
            }

            const letter =
                interaction.fields
                    .getTextInputValue(
                        "letter"
                    )
                    .trim()
                    .toUpperCase();

            if (
                !/^[A-Z]$/.test(
                    letter
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Entre une seule lettre.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.correct.includes(
                    letter
                ) ||
                session.wrong.includes(
                    letter
                )
            ) {
                await interaction.reply({
                    content:
                        "⚠️ Cette lettre a déjà été proposée.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                session.word.includes(
                    letter
                )
            ) {
                session.correct.push(
                    letter
                );

            } else {
                session.wrong.push(
                    letter
                );

                session.errors++;
            }

            const completed =
                session.word
                    .split(
                        ""
                    )
                    .every(
                        char =>
                            session.correct.includes(
                                char
                            )
                    );

            if (
                completed
            ) {
                session.finished =
                    true;

                session.won =
                    true;
            }

            if (
                session.errors >=
                session.maxErrors
            ) {
                session.finished =
                    true;

                session.won =
                    false;
            }

            updateSession(
                session
            );

            const message =
                await getSessionMessage(
                    client ||
                    interaction.client,
                    session
                );

            await message
                ?.edit({
                    embeds: [
                        hangmanEmbed(
                            session
                        )
                    ],

                    components:
                        hangmanButtons(
                            session.id,
                            session.finished
                        )
                })
                .catch(
                    () => {}
                );

            await interaction.reply({
                content:
                    session.word.includes(
                        letter
                    )
                        ? `✅ **${letter}** est dans le mot !`
                        : `❌ **${letter}** n'est pas dans le mot.`,

                flags:
                    MessageFlags.Ephemeral
            });

            if (
                session.finished
            ) {
                deleteSession(
                    session.id
                );
            }

            return true;
        }

        return false;
    },

    // ==================================================
    // TPV + INDEX
    // ==================================================

    legacyGamesSystem: {
        GAMES,

        openHub,

        getSession,

        register(
            client
        ) {
            if (
                client.__legacyGamesRegistered
            ) {
                return;
            }

            client.__legacyGamesRegistered =
                true;

            client.legacyGames = {
                GAMES,
                openHub,
                getSession
            };

            // ==========================================
            // BOMBE : EXPLOSIONS
            // ==========================================

            client.__legacyGamesBombInterval =
                setInterval(
                    async () => {
                        const data =
                            loadData();

                        for (
                            const session
                            of Object.values(
                                data.sessions
                            )
                        ) {
                            if (
                                session.type !==
                                    "bomb" ||
                                session.finished ||
                                Date.now() <
                                    session.explodesAt
                            ) {
                                continue;
                            }

                            const guild =
                                client.guilds.cache.get(
                                    session.guildId
                                );

                            const channel =
                                guild?.channels?.cache?.get(
                                    session.channelId
                                ) ||
                                await guild?.channels
                                    ?.fetch(
                                        session.channelId
                                    )
                                    .catch(
                                        () => null
                                    );

                            if (
                                !channel ||
                                !channel.isTextBased()
                            ) {
                                deleteSession(
                                    session.id
                                );

                                continue;
                            }

                            const message =
                                await getSessionMessage(
                                    client,
                                    session
                                );

                            // ==================================
                            // RETIRE LES JOUEURS AYANT QUITTÉ
                            // ==================================

                            const voice =
                                guild.channels.cache.get(
                                    session.voiceChannelId
                                );

                            if (
                                voice?.members
                            ) {
                                session.alive =
                                    session.alive.filter(
                                        id =>
                                            voice.members.has(
                                                id
                                            )
                                    );
                            }

                            // ==================================
                            // LE PORTEUR A QUITTÉ
                            // ==================================

                            if (
                                !session.alive.includes(
                                    session.holderId
                                )
                            ) {
                                if (
                                    session.alive.length <=
                                    1
                                ) {
                                    session.finished =
                                        true;

                                    session.winner =
                                        session.alive[
                                            0
                                        ] ||
                                        null;

                                    if (
                                        session.winner
                                    ) {
                                        await message
                                            ?.edit({
                                                embeds: [
                                                    bombEmbed(
                                                        session
                                                    )
                                                ],

                                                components:
                                                    []
                                            })
                                            .catch(
                                                () => {}
                                            );
                                    }

                                    deleteSession(
                                        session.id
                                    );

                                    continue;
                                }

                                session.holderId =
                                    randomItem(
                                        session.alive
                                    );
                            }

                            const eliminated =
                                session.holderId;

                            session.alive =
                                session.alive.filter(
                                    id =>
                                        id !==
                                        eliminated
                                );

                            // ==================================
                            // GAGNANT
                            // ==================================

                            if (
                                session.alive.length <=
                                1
                            ) {
                                session.finished =
                                    true;

                                session.winner =
                                    session.alive[
                                        0
                                    ] ||
                                    null;

                                updateSession(
                                    session
                                );

                                await message
                                    ?.edit({
                                        content:
                                            `💥 **BOOM !** <@${eliminated}> est éliminé !`,

                                        embeds: [
                                            bombEmbed(
                                                session
                                            )
                                        ],

                                        components:
                                            []
                                    })
                                    .catch(
                                        () => {}
                                    );

                                deleteSession(
                                    session.id
                                );

                                continue;
                            }

                            // ==================================
                            // NOUVEAU PORTEUR
                            // ==================================

                            session.holderId =
                                randomItem(
                                    session.alive
                                );

                            session.explodesAt =
                                Date.now() +
                                (
                                    15_000 +
                                    Math.floor(
                                        Math.random() *
                                        25_000
                                    )
                                );

                            updateSession(
                                session
                            );

                            // IMPORTANT :
                            // on MODIFIE le message original
                            // au lieu d'envoyer uniquement
                            // un nouveau message séparé.

                            await message
                                ?.edit({
                                    content:
`💥 **BOOM !**

<@${eliminated}> est éliminé !

💣 Nouvelle bombe : <@${session.holderId}>`,

                                    embeds: [
                                        bombEmbed(
                                            session
                                        )
                                    ],

                                    components:
                                        bombButtons(
                                            session
                                        )
                                })
                                .catch(
                                    () => {}
                                );
                        }

                    },
                    1000
                );

            // ==========================================
            // NETTOYAGE SESSIONS TRÈS ANCIENNES
            // ==========================================

            client.__legacyGamesCleanupInterval =
                setInterval(
                    () => {
                        const data =
                            loadData();

                        let changed =
                            false;

                        const maxAge =
                            6 *
                            60 *
                            60 *
                            1000;

                        for (
                            const [
                                id,
                                session
                            ]
                            of Object.entries(
                                data.sessions
                            )
                        ) {
                            const timestamp =
                                session.updatedAt ||
                                session.createdAt ||
                                0;

                            if (
                                timestamp &&
                                Date.now() -
                                    timestamp >
                                    maxAge
                            ) {
                                delete data.sessions[
                                    id
                                ];

                                changed =
                                    true;
                            }
                        }

                        if (
                            changed
                        ) {
                            saveData(
                                data
                            );
                        }

                    },
                    10 *
                    60 *
                    1000
                );

            console.log(
                "🎮 Legacy Games : ✅ actif"
            );
        }
    }
};