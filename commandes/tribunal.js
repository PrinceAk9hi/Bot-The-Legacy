const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR = 0x3B6475;
const SUCCESS_COLOR = 0x57F287;
const WARNING_COLOR = 0xFEE75C;
const ERROR_COLOR = 0xED4245;

const MAX_JURORS = 5;

const TRIBUNAL_ROLE_NAME =
    "⚖️ Condamné du Tribunal";

// ======================================================
// FILES
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const TRIBUNALS_FILE =
    path.join(
        DATA_DIR,
        "tribunals.json"
    );

// ======================================================
// PEINES
// ======================================================

const RANDOM_NICKNAMES = [
    "⚖️ Coupable officiel",
    "⚖️ Suspect n°1",
    "⚖️ Sous contrôle judiciaire",
    "⚖️ Condamné du Tribunal",
    "⚖️ Déclaré coupable",
    "⚖️ En liberté surveillée",
    "⚖️ Cas judiciaire",
    "⚖️ Dossier classé coupable"
];

const CUSTOM_SENTENCES = [
    "Présenter des excuses officielles dans le salon choisi par le juge.",
    "Porter publiquement le statut de condamné pendant la durée décidée.",
    "Se présenter devant la Fondation pour expliquer ses actes.",
    "Faire une déclaration publique reconnaissant le verdict du Tribunal.",
    "Être placé sous surveillance renforcée par la gestion pendant la durée décidée.",
    "Accepter sans contestation le surnom imposé par le Tribunal.",
    "Recevoir publiquement le titre de « Coupable officiel du jour ».",
    "Faire face à une période de contrôle judiciaire décidée par le Tribunal."
];

// ======================================================
// DEFAULT
// ======================================================

function createDefaultData() {
    return {
        version: 1,

        active: {},

        history: [],

        temporaryPenalties: []
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
            TRIBUNALS_FILE
        )
    ) {
        fs.writeFileSync(
            TRIBUNALS_FILE,
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
                TRIBUNALS_FILE,
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

        if (
            !Array.isArray(
                parsed.temporaryPenalties
            )
        ) {
            parsed.temporaryPenalties = [];
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ Chargement tribunals.json :",
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
            TRIBUNALS_FILE,
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
            "❌ Sauvegarde tribunals.json :",
            error
        );

        return false;
    }
}

// ======================================================
// RANDOM
// ======================================================

function randomItem(
    array
) {
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
    const clone =
        [...array];

    for (
        let i =
            clone.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (
                    i + 1
                )
            );

        [
            clone[i],
            clone[j]
        ] = [
            clone[j],
            clone[i]
        ];
    }

    return clone;
}

// ======================================================
// ID
// ======================================================

function createTribunalId() {
    return (
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`
    );
}

// ======================================================
// GET TRIBUNAL
// ======================================================

function getTribunal(
    tribunalId
) {
    const data =
        loadData();

    return (
        data.active[
            tribunalId
        ] ||
        null
    );
}

// ======================================================
// SAVE TRIBUNAL
// ======================================================

function updateTribunal(
    tribunal
) {
    const data =
        loadData();

    if (
        !data.active[
            tribunal.id
        ]
    ) {
        return false;
    }

    data.active[
        tribunal.id
    ] =
        tribunal;

    return saveData(
        data
    );
}

// ======================================================
// COUNT VOTES
// ======================================================

function countVotes(
    tribunal
) {
    const votes =
        Object.values(
            tribunal.votes ||
            {}
        );

    const guilty =
        votes.filter(
            vote =>
                vote ===
                "guilty"
        ).length;

    const innocent =
        votes.filter(
            vote =>
                vote ===
                "innocent"
        ).length;

    return {
        guilty,
        innocent,
        total:
            guilty +
            innocent
    };
}

// ======================================================
// PERCENT
// ======================================================

function percent(
    value,
    total
) {
    if (
        !total
    ) {
        return 0;
    }

    return Math.round(
        (
            value /
            total
        ) *
        100
    );
}

// ======================================================
// BUILD TRIBUNAL EMBED
// ======================================================

function buildTribunalEmbed(
    tribunal
) {
    const result =
        countVotes(
            tribunal
        );

    const votedJurors =
        Object.keys(
            tribunal.votes ||
            {}
        );

    const waitingJurors =
        tribunal.jurors.filter(
            id =>
                !votedJurors.includes(
                    id
                )
        );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "⚖️ Tribunal de The Legacy"
        )
        .setDescription(
`Un nouveau procès vient d'être ouvert.

### 👤 Accusé
<@${tribunal.accusedId}>

### 📜 Motif
${tribunal.reason}

### 🏛️ Composition du Tribunal

🛡️ **Avocat :** <@${tribunal.lawyerId}>
⚔️ **Procureur :** <@${tribunal.prosecutorId}>

### 👥 Jurés

${tribunal.jurors
    .map(
        id =>
            `• <@${id}>`
    )
    .join("\n")}

━━━━━━━━━━━━━━━━━━━━

### 🗳️ Vote en cours

🔴 **COUPABLE :** ${result.guilty}
🟢 **NON COUPABLE :** ${result.innocent}

🗳️ **Votes exprimés :**
${result.total}/${tribunal.jurors.length}

${waitingJurors.length
    ? `⏳ **En attente :** ${waitingJurors
        .map(
            id =>
                `<@${id}>`
        )
        .join(", ")}`
    : "✅ Tous les jurés ont voté."}

### ⏳ Fin du vote

<t:${Math.floor(
    tribunal.endsAt /
    1000
)}:R>

-# Seuls les jurés peuvent participer au vote.`
        )
        .setFooter({
            text:
                `The Legacy • Tribunal ${tribunal.id}`
        })
        .setTimestamp();
}

// ======================================================
// BUTTONS
// ======================================================

function createVoteButtons(
    tribunalId,
    disabled = false
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `tribunal_guilty_${tribunalId}`
                    )
                    .setLabel(
                        "COUPABLE"
                    )
                    .setEmoji(
                        "🔴"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tribunal_innocent_${tribunalId}`
                    )
                    .setLabel(
                        "NON COUPABLE"
                    )
                    .setEmoji(
                        "🟢"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        disabled
                    )
            )
    ];
}

// ======================================================
// TROUVER MEMBRE
// ======================================================

async function fetchMember(
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
// RÔLE TRIBUNAL
// ======================================================

async function getOrCreateTribunalRole(
    guild
) {
    let role =
        guild.roles.cache.find(
            item =>
                item.name ===
                TRIBUNAL_ROLE_NAME
        );

    if (
        role
    ) {
        return role;
    }

    role =
        await guild.roles.create({
            name:
                TRIBUNAL_ROLE_NAME,

            reason:
                "Système Tribunal The Legacy",

            hoist:
                false,

            mentionable:
                false
        });

    return role;
}

// ======================================================
// AJOUT PEINE TEMPORAIRE
// ======================================================

function addTemporaryPenalty(
    penalty
) {
    const data =
        loadData();

    data.temporaryPenalties.push(
        penalty
    );

    saveData(
        data
    );
}

// ======================================================
// RESTORE ORIGINAL NICKNAME
// ======================================================

async function restoreNickname(
    client,
    penalty
) {
    const guild =
        client.guilds.cache.get(
            penalty.guildId
        );

    if (
        !guild
    ) {
        return;
    }

    const member =
        await fetchMember(
            guild,
            penalty.memberId
        );

    if (
        !member
    ) {
        return;
    }

    await member.setNickname(
        penalty.originalNickname,
        "Fin de peine Tribunal"
    ).catch(
        () => {}
    );
}

// ======================================================
// REMOVE TEMP ROLE
// ======================================================

async function removeTemporaryRole(
    client,
    penalty
) {
    const guild =
        client.guilds.cache.get(
            penalty.guildId
        );

    if (
        !guild
    ) {
        return;
    }

    const member =
        await fetchMember(
            guild,
            penalty.memberId
        );

    if (
        !member
    ) {
        return;
    }

    const role =
        guild.roles.cache.get(
            penalty.roleId
        );

    if (
        !role
    ) {
        return;
    }

    await member.roles.remove(
        role,
        "Fin de peine Tribunal"
    ).catch(
        () => {}
    );
}

// ======================================================
// APPLY NICKNAME PENALTY
// ======================================================

async function applyNicknamePenalty({
    guild,
    member,
    durationMinutes
}) {
    const nickname =
        randomItem(
            RANDOM_NICKNAMES
        );

    const originalNickname =
        member.nickname;

    await member.setNickname(
        nickname,
        "Peine du Tribunal The Legacy"
    );

    const penalty = {
        id:
            createTribunalId(),

        type:
            "nickname",

        guildId:
            guild.id,

        memberId:
            member.id,

        originalNickname:
            originalNickname ||
            null,

        temporaryNickname:
            nickname,

        endsAt:
            Date.now() +
            (
                durationMinutes *
                60_000
            )
    };

    addTemporaryPenalty(
        penalty
    );

    return {
        applied:
            true,

        text:
`👤 Le pseudo de <@${member.id}> devient temporairement **${nickname}** pendant **${durationMinutes} minute(s)**.`
    };
}

// ======================================================
// APPLY ROLE PENALTY
// ======================================================

async function applyRolePenalty({
    guild,
    member,
    durationMinutes
}) {
    const role =
        await getOrCreateTribunalRole(
            guild
        );

    const bot =
        guild.members.me;

    if (
        !bot ||
        bot.roles.highest.position <=
        role.position
    ) {
        return {
            applied:
                false,

            text:
                `⚠️ La peine prévoyait le rôle **${TRIBUNAL_ROLE_NAME}**, mais le bot ne peut pas le gérer à cause de la hiérarchie Discord.`
        };
    }

    await member.roles.add(
        role,
        "Peine du Tribunal The Legacy"
    );

    const penalty = {
        id:
            createTribunalId(),

        type:
            "role",

        guildId:
            guild.id,

        memberId:
            member.id,

        roleId:
            role.id,

        endsAt:
            Date.now() +
            (
                durationMinutes *
                60_000
            )
    };

    addTemporaryPenalty(
        penalty
    );

    return {
        applied:
            true,

        text:
`⚖️ <@${member.id}> reçoit le rôle <@&${role.id}> pendant **${durationMinutes} minute(s)**.`
    };
}

// ======================================================
// APPLY SENTENCE
// ======================================================

async function applySentence({
    guild,
    tribunal,
    member
}) {
    const type =
        tribunal.sentenceType;

    const duration =
        tribunal.sentenceDuration;

    if (
        type ===
        "pseudo"
    ) {
        return applyNicknamePenalty({
            guild,
            member,
            durationMinutes:
                duration
        });
    }

    if (
        type ===
        "role"
    ) {
        return applyRolePenalty({
            guild,
            member,
            durationMinutes:
                duration
        });
    }

    if (
        type ===
        "personnalisee"
    ) {
        return {
            applied:
                false,

            text:
`📜 **Peine décidée par le Tribunal :**

${tribunal.customSentence}`
        };
    }

    // ==================================================
    // ALÉATOIRE
    // ==================================================

    const randomType =
        Math.random() <
        0.5
            ? "pseudo"
            : "role";

    if (
        randomType ===
        "pseudo"
    ) {
        return applyNicknamePenalty({
            guild,
            member,
            durationMinutes:
                duration
        });
    }

    return applyRolePenalty({
        guild,
        member,
        durationMinutes:
            duration
    });
}

// ======================================================
// FIN TRIBUNAL
// ======================================================

async function finishTribunal(
    client,
    tribunalId
) {
    const data =
        loadData();

    const tribunal =
        data.active[
            tribunalId
        ];

    if (
        !tribunal
    ) {
        return null;
    }

    const guild =
        client.guilds.cache.get(
            tribunal.guildId
        );

    if (
        !guild
    ) {
        return null;
    }

    const channel =
        guild.channels.cache.get(
            tribunal.channelId
        ) ||
        await guild.channels
            .fetch(
                tribunal.channelId
            )
            .catch(
                () => null
            );

    const message =
        channel?.isTextBased()
            ? await channel.messages
                .fetch(
                    tribunal.messageId
                )
                .catch(
                    () => null
                )
            : null;

    const result =
        countVotes(
            tribunal
        );

    // égalité => innocent
    const guilty =
        result.guilty >
        result.innocent;

    tribunal.finishedAt =
        Date.now();

    tribunal.status =
        "finished";

    tribunal.verdict =
        guilty
            ? "guilty"
            : "innocent";

    // ==================================================
    // PEINE
    // ==================================================

    let sentenceResult =
        null;

    const accused =
        await fetchMember(
            guild,
            tribunal.accusedId
        );

    if (
        guilty &&
        accused
    ) {
        try {
            sentenceResult =
                await applySentence({
                    guild,
                    tribunal,
                    member:
                        accused
                });

        } catch (error) {
            sentenceResult = {
                applied:
                    false,

                text:
                    `⚠️ La peine n'a pas pu être appliquée automatiquement : \`${error.message}\``
            };
        }
    }

    // ==================================================
    // VERDICT EMBED
    // ==================================================

    const guiltyPercent =
        percent(
            result.guilty,
            result.total
        );

    const innocentPercent =
        percent(
            result.innocent,
            result.total
        );

    const verdictEmbed =
        new EmbedBuilder()
            .setColor(
                guilty
                    ? ERROR_COLOR
                    : SUCCESS_COLOR
            )
            .setTitle(
                guilty
                    ? "🔨 VERDICT — COUPABLE"
                    : "🪽 VERDICT — NON COUPABLE"
            )
            .setDescription(
`Le **Tribunal de The Legacy** vient de rendre sa décision.

### 👤 Accusé
<@${tribunal.accusedId}>

### 📜 Motif
${tribunal.reason}

### ⚖️ Verdict

${guilty
    ? "🔴 **COUPABLE**"
    : "🟢 **NON COUPABLE**"}

### 🗳️ Résultat du vote

🔴 **Coupable :** ${result.guilty} — ${guiltyPercent}%
🟢 **Non coupable :** ${result.innocent} — ${innocentPercent}%

**Votes exprimés :** ${result.total}/${tribunal.jurors.length}

${result.guilty === result.innocent
    ? "> ⚖️ En raison de l'égalité, le bénéfice du doute est accordé à l'accusé."
    : ""}

${guilty
    ? `### ⛓️ Peine prononcée

${sentenceResult?.text || randomItem(CUSTOM_SENTENCES)}`
    : `### 🪽 Acquittement

<@${tribunal.accusedId}> est acquitté et quitte officiellement le Tribunal libre de toute condamnation liée à cette affaire.`}

━━━━━━━━━━━━━━━━━━━━

🛡️ **Avocat :** <@${tribunal.lawyerId}>
⚔️ **Procureur :** <@${tribunal.prosecutorId}>`
            )
            .setFooter({
                text:
                    "The Legacy • Tribunal"
            })
            .setTimestamp();

    // ==================================================
    // EDIT ORIGINAL
    // ==================================================

    if (
        message
    ) {
        await message.edit({
            embeds: [
                verdictEmbed
            ],

            components:
                createVoteButtons(
                    tribunal.id,
                    true
                )
        }).catch(
            () => {}
        );
    }

    // ==================================================
    // HISTORY
    // ==================================================

    delete data.active[
        tribunalId
    ];

    data.history.push(
        tribunal
    );

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

    // ==================================================
    // LOG
    // ==================================================

    if (
        client.logs
            ?.logSystemAll
    ) {
        await client.logs
            .logSystemAll(
                guild,
                {
                    title:
                        "⚖️ Verdict du Tribunal",

                    description:
`**Accusé :** <@${tribunal.accusedId}>
**Verdict :** ${guilty ? "COUPABLE" : "NON COUPABLE"}
**Coupable :** ${result.guilty}
**Non coupable :** ${result.innocent}`,

                    color:
                        guilty
                            ? ERROR_COLOR
                            : SUCCESS_COLOR
                }
            )
            .catch(
                () => {}
            );
    }

    return tribunal;
}

// ======================================================
// CHECK TEMP PENALTIES
// ======================================================

async function checkTemporaryPenalties(
    client
) {
    const data =
        loadData();

    const now =
        Date.now();

    const expired =
        data.temporaryPenalties
            .filter(
                penalty =>
                    now >=
                    penalty.endsAt
            );

    if (
        !expired.length
    ) {
        return;
    }

    for (
        const penalty
        of expired
    ) {
        try {
            if (
                penalty.type ===
                "nickname"
            ) {
                await restoreNickname(
                    client,
                    penalty
                );
            }

            if (
                penalty.type ===
                "role"
            ) {
                await removeTemporaryRole(
                    client,
                    penalty
                );
            }

        } catch (error) {
            console.error(
                "❌ Fin peine Tribunal :",
                error
            );
        }
    }

    const expiredIds =
        new Set(
            expired.map(
                item =>
                    item.id
            )
        );

    data.temporaryPenalties =
        data.temporaryPenalties.filter(
            item =>
                !expiredIds.has(
                    item.id
                )
        );

    saveData(
        data
    );
}

// ======================================================
// CHECK EXPIRED TRIBUNALS
// ======================================================

async function checkExpiredTribunals(
    client
) {
    const data =
        loadData();

    const now =
        Date.now();

    const expired =
        Object.values(
            data.active
        ).filter(
            tribunal =>
                now >=
                tribunal.endsAt
        );

    for (
        const tribunal
        of expired
    ) {
        await finishTribunal(
            client,
            tribunal.id
        ).catch(
            error => {
                console.error(
                    "❌ Verdict Tribunal :",
                    error
                );
            }
        );
    }
}

// ======================================================
// REGISTER SYSTEM
// ======================================================

function registerTribunalSystem(
    client
) {
    if (
        client.__tribunalRegistered
    ) {
        return;
    }

    client.__tribunalRegistered =
        true;

    setInterval(
        async () => {
            await checkExpiredTribunals(
                client
            );

            await checkTemporaryPenalties(
                client
            );
        },
        30_000
    );

    console.log(
        "⚖️ Système Tribunal : ✅ actif"
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "tribunal"
            )
            .setDescription(
                "Organiser un procès humoristique The Legacy"
            )

            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre accusé"
                    )
                    .setRequired(
                        true
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "raison"
                    )
                    .setDescription(
                        "Motif du procès"
                    )
                    .setMaxLength(
                        500
                    )
                    .setRequired(
                        true
                    )
            )

            .addUserOption(option =>
                option
                    .setName(
                        "avocat"
                    )
                    .setDescription(
                        "Avocat de la défense (facultatif)"
                    )
                    .setRequired(
                        false
                    )
            )

            .addUserOption(option =>
                option
                    .setName(
                        "procureur"
                    )
                    .setDescription(
                        "Procureur (facultatif)"
                    )
                    .setRequired(
                        false
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "peine"
                    )
                    .setDescription(
                        "Peine appliquée si l'accusé est coupable"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        {
                            name:
                                "🎲 Aléatoire",

                            value:
                                "aleatoire"
                        },

                        {
                            name:
                                "👤 Pseudo temporaire",

                            value:
                                "pseudo"
                        },

                        {
                            name:
                                "⚖️ Rôle Condamné temporaire",

                            value:
                                "role"
                        },

                        {
                            name:
                                "📜 Peine personnalisée",

                            value:
                                "personnalisee"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "details_peine"
                    )
                    .setDescription(
                        "Texte de la peine si tu choisis personnalisée"
                    )
                    .setMaxLength(
                        500
                    )
                    .setRequired(
                        false
                    )
            )

            .addIntegerOption(option =>
                option
                    .setName(
                        "duree_vote"
                    )
                    .setDescription(
                        "Durée du vote en minutes"
                    )
                    .setMinValue(
                        1
                    )
                    .setMaxValue(
                        60
                    )
                    .setRequired(
                        false
                    )
            )

            .addIntegerOption(option =>
                option
                    .setName(
                        "duree_peine"
                    )
                    .setDescription(
                        "Durée de la peine automatique en minutes"
                    )
                    .setMinValue(
                        1
                    )
                    .setMaxValue(
                        1440
                    )
                    .setRequired(
                        false
                    )
            ),

    // ==================================================
    // EXECUTE
    // ==================================================

    async execute(
        interaction
    ) {
        await interaction.deferReply();

        try {
            // ==================================================
            // PERMISSION
            // ==================================================

            const allowed =
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (
                !allowed
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'organiser un Tribunal."
                });
            }

            // ==================================================
            // OPTIONS
            // ==================================================

            const accusedUser =
                interaction.options
                    .getUser(
                        "membre"
                    );

            const reason =
                interaction.options
                    .getString(
                        "raison"
                    );

            let lawyerUser =
                interaction.options
                    .getUser(
                        "avocat"
                    );

            let prosecutorUser =
                interaction.options
                    .getUser(
                        "procureur"
                    );

            const sentenceType =
                interaction.options
                    .getString(
                        "peine"
                    );

            const customSentence =
                interaction.options
                    .getString(
                        "details_peine"
                    );

            const voteDuration =
                interaction.options
                    .getInteger(
                        "duree_vote"
                    ) ||
                5;

            const sentenceDuration =
                interaction.options
                    .getInteger(
                        "duree_peine"
                    ) ||
                60;

            // ==================================================
            // CUSTOM SENTENCE
            // ==================================================

            if (
                sentenceType ===
                    "personnalisee" &&
                !customSentence
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu dois renseigner `details_peine` lorsque tu choisis une peine personnalisée."
                });
            }

            // ==================================================
            // ACCUSÉ
            // ==================================================

            const accused =
                await fetchMember(
                    interaction.guild,
                    accusedUser.id
                );

            if (
                !accused ||
                accused.user.bot
            ) {
                return interaction.editReply({
                    content:
                        "❌ L'accusé doit être un membre humain du serveur."
                });
            }

            // ==================================================
            // MEMBRES DISPONIBLES
            // ==================================================

            const candidates =
                interaction.guild
                    .members
                    .cache
                    .filter(
                        member =>
                            !member.user.bot &&
                            member.id !==
                                accused.id &&
                            member.id !==
                                interaction.user.id
                    )
                    .map(
                        member =>
                            member
                    );

            if (
                candidates.length <
                3
            ) {
                return interaction.editReply({
                    content:
                        "❌ Pas assez de membres disponibles pour constituer le Tribunal."
                });
            }

            // ==================================================
            // AVOCAT
            // ==================================================

            if (
                lawyerUser
            ) {
                if (
                    lawyerUser.bot ||
                    lawyerUser.id ===
                        accused.id
                ) {
                    return interaction.editReply({
                        content:
                            "❌ L'avocat sélectionné n'est pas valide."
                    });
                }

            } else {
                const possible =
                    candidates.filter(
                        member =>
                            member.id !==
                            prosecutorUser?.id
                    );

                lawyerUser =
                    randomItem(
                        possible
                    ).user;
            }

            // ==================================================
            // PROCUREUR
            // ==================================================

            if (
                prosecutorUser
            ) {
                if (
                    prosecutorUser.bot ||
                    prosecutorUser.id ===
                        accused.id ||
                    prosecutorUser.id ===
                        lawyerUser.id
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Le procureur sélectionné n'est pas valide."
                    });
                }

            } else {
                const possible =
                    candidates.filter(
                        member =>
                            member.id !==
                            lawyerUser.id
                    );

                prosecutorUser =
                    randomItem(
                        possible
                    ).user;
            }

            // ==================================================
            // JURÉS
            // ==================================================

            const excludedIds =
                new Set([
                    accused.id,
                    interaction.user.id,
                    lawyerUser.id,
                    prosecutorUser.id
                ]);

            const jurorCandidates =
                candidates.filter(
                    member =>
                        !excludedIds.has(
                            member.id
                        )
                );

            if (
                jurorCandidates.length <
                1
            ) {
                return interaction.editReply({
                    content:
                        "❌ Aucun membre disponible pour devenir juré."
                });
            }

            const jurors =
                shuffle(
                    jurorCandidates
                )
                    .slice(
                        0,
                        MAX_JURORS
                    )
                    .map(
                        member =>
                            member.id
                    );

            // ==================================================
            // TRIBUNAL
            // ==================================================

            const id =
                createTribunalId();

            const tribunal = {
                id,

                guildId:
                    interaction.guild.id,

                channelId:
                    interaction.channel.id,

                messageId:
                    null,

                creatorId:
                    interaction.user.id,

                accusedId:
                    accused.id,

                lawyerId:
                    lawyerUser.id,

                prosecutorId:
                    prosecutorUser.id,

                jurors,

                reason,

                sentenceType,

                customSentence:
                    customSentence ||
                    null,

                sentenceDuration,

                startedAt:
                    Date.now(),

                endsAt:
                    Date.now() +
                    (
                        voteDuration *
                        60_000
                    ),

                finishedAt:
                    null,

                status:
                    "active",

                votes: {}
            };

            // ==================================================
            // SEND
            // ==================================================

            const message =
                await interaction.editReply({
                    content:
`⚖️ <@${accused.id}> — Le Tribunal de **The Legacy** est désormais ouvert.

👥 Jurés : ${jurors
    .map(
        id =>
            `<@${id}>`
    )
    .join(" ")}`,

                    embeds: [
                        buildTribunalEmbed(
                            tribunal
                        )
                    ],

                    components:
                        createVoteButtons(
                            tribunal.id
                        )
                });

            tribunal.messageId =
                message.id;

            const data =
                loadData();

            data.active[
                tribunal.id
            ] =
                tribunal;

            saveData(
                data
            );

            // ==================================================
            // LOG
            // ==================================================

            if (
                interaction.client.logs
                    ?.logSystemAll
            ) {
                await interaction.client.logs
                    .logSystemAll(
                        interaction.guild,
                        {
                            title:
                                "⚖️ Tribunal ouvert",

                            description:
`**Accusé :** <@${accused.id}>
**Motif :** ${reason}
**Créé par :** <@${interaction.user.id}>
**Durée :** ${voteDuration} minute(s)`,

                            color:
                                COLOR
                        }
                    )
                    .catch(
                        () => {}
                    );
            }

        } catch (error) {
            console.error(
                "❌ /tribunal :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    },

    // ==================================================
    // BUTTON HANDLER
    // ==================================================

    async handleButton(
        interaction
    ) {
        if (
            !interaction.customId.startsWith(
                "tribunal_"
            )
        ) {
            return false;
        }

        const match =
            interaction.customId.match(
                /^tribunal_(guilty|innocent)_(.+)$/
            );

        if (
            !match
        ) {
            return false;
        }

        const vote =
            match[1];

        const tribunalId =
            match[2];

        const tribunal =
            getTribunal(
                tribunalId
            );

        if (
            !tribunal
        ) {
            await interaction.reply({
                content:
                    "❌ Ce Tribunal est déjà terminé ou n'existe plus.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==================================================
        // EXPIRED
        // ==================================================

        if (
            Date.now() >=
            tribunal.endsAt
        ) {
            await finishTribunal(
                interaction.client,
                tribunal.id
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "⚖️ Le vote est terminé.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }

        // ==================================================
        // ONLY JURORS
        // ==================================================

        if (
            !tribunal.jurors.includes(
                interaction.user.id
            )
        ) {
            await interaction.reply({
                content:
                    "❌ Seuls les **jurés désignés** peuvent participer au vote.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const previousVote =
            tribunal.votes[
                interaction.user.id
            ];

        tribunal.votes[
            interaction.user.id
        ] =
            vote;

        updateTribunal(
            tribunal
        );

        // ==================================================
        // UPDATE PUBLIC EMBED
        // ==================================================

        await interaction.update({
            embeds: [
                buildTribunalEmbed(
                    tribunal
                )
            ],

            components:
                createVoteButtons(
                    tribunal.id
                )
        });

        // ==================================================
        // TOUS LES JURÉS ONT VOTÉ
        // ==================================================

        const result =
            countVotes(
                tribunal
            );

        if (
            result.total >=
            tribunal.jurors.length
        ) {
            setTimeout(
                () => {
                    finishTribunal(
                        interaction.client,
                        tribunal.id
                    ).catch(
                        error => {
                            console.error(
                                "❌ Verdict immédiat Tribunal :",
                                error
                            );
                        }
                    );
                },
                1500
            );
        }

        return true;
    },

    // ==================================================
    // SYSTÈME POUR INDEX FINAL
    // ==================================================

    tribunalSystem: {
        register:
            registerTribunalSystem,

        finish:
            finishTribunal,

        getTribunal
    }
};