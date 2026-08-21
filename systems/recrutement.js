const fs = require("fs");
const path = require("path");

const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    AttachmentBuilder
} = require("discord.js");

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG = {
    responsableRecrutement:
        "1532085431947100281",

    gestionRecrutement:
        "1458394180651843635",

    fondation:
        "1467924663337222196",

    rolesEntretienAccepte: [
        "1458391977073574012",
        "1531761113933414542"
    ],

    roleCandidatureAcceptee:
        "1458430688058671247",

    roleRefuse:
        "1458430849778319360",

    attenteEntretien:
        "1458501376702414848",

    categorieTickets:
        "1521890784725700760",

    salonNouvelleRecrue:
        "1533649548646551593",

    salonFormulaires:
        "1540160337230303302",

    salonDDS:
        "1540155393693450291",

    salonReponseDDS:
        "1540163216141983796",

    salonLogs:
        "1459682840915476628",

    salonCR:
        "1498087019459510332",

    ownerId:
        "547192186547077130",

    salonAnnonceEntretiens:
        "1534199749673091284"
};

// ======================================================
// COULEURS
// ======================================================

const COLORS = {
    attente: 0x2B2D31,
    accepte: 0x57F287,
    refuse: 0xED4245
};

// ======================================================
// DATA
// ======================================================

const dataDir =
    path.join(
        __dirname,
        "..",
        "data"
    );

const candidaturesPath =
    path.join(
        dataDir,
        "candidatures.json"
    );

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );
}

if (!fs.existsSync(candidaturesPath)) {
    fs.writeFileSync(
        candidaturesPath,
        "{}",
        "utf8"
    );
}

function lireCandidatures() {
    try {
        return JSON.parse(
            fs.readFileSync(
                candidaturesPath,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function sauvegarderCandidatures(data) {
    fs.writeFileSync(
        candidaturesPath,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );
}

// ======================================================
// QUESTIONS
// ======================================================

const QUESTIONS = [
    {
        key: "question1",
        titre: "Question 1",
        texte:
`> @ Roblox :`
    },

    {
        key: "question2",
        titre: "Question 2",
        texte:
`> Présentation (Prénom IRL, âge, les passions qui t'animent, 2 défauts et 2 qualités) :
> -# 3 à 5 lignes attendues !`
    },

    {
        key: "question3",
        titre: "Question 3",
        texte:
`> Ton temps de jeu sur School RP :`
    },

    {
        key: "question4",
        titre: "Question 4",
        texte:
`> Ton casier judiciaire (avec des explications attendues) :`
    },

    {
        key: "question5",
        titre: "Question 5",
        texte:
`> As-tu déjà fait partie d'une ou plusieurs familles ? (Explications attendues de pourquoi vous n'êtes plus dedans) :`
    },

    {
        key: "question6",
        titre: "Question 6",
        texte:
`> Ton ambition, ta vision de notre famille, ce que tu cherches dans notre famille (3 à 5 ligne attendues) :`
    },

    {
        key: "question7",
        titre: "Question 7",
        texte:
`> Comment as-tu connu notre famille :`
    },

    {
        key: "question8",
        titre: "Question 8",
        texte:
`> Sur quels appareils joues-tu :`
    },

    {
        key: "question9",
        titre: "Question 9",
        texte:
`> Peux-tu être en vocal tout en jouant en même temps :`
    },

    {
        key: "question10",
        titre: "Question 10",
        texte:
`> Es-tu prêt(e) à démontrer, par ton activté, ton engagement, et ta loyauté, que tu mérites de rejoindre notre famille ? (3 à 5 lignes attendues) :`
    },

    {
        key: "question11",
        titre: "Question 11",
        texte:
`> Nous souhaitons t’informer, futur candidat, que l’activité entraîne un rank-up et que l’inactivité entraîne un derank, également, si les conditions ne sont pas remplit lors de ta candidature, la durée de ta période en test peut se voir être plus longue.
>
> Confirmes-tu avoir pris connaissance de ces informations ?`
    }
];

const questionnairesActifs =
    new Set();

// ======================================================
// HELPERS
// ======================================================

function cleanChannelName(name) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9-_]/g,
            ""
        )
        .substring(0, 50) ||
        "membre";
}

function formatDuree(ms) {
    const secondes =
        Math.max(
            0,
            Math.floor(ms / 1000)
        );

    const minutes =
        Math.floor(
            secondes / 60
        );

    const reste =
        secondes % 60;

    if (!minutes) {
        return `${reste}s`;
    }

    return `${minutes}m ${reste}s`;
}

function safeField(text) {
    if (!text) {
        return "Aucune réponse";
    }

    if (text.length <= 500) {
        return text;
    }

    return (
        text.substring(
            0,
            497
        ) +
        "..."
    );
}

async function getMember(
    guild,
    id
) {
    return guild.members
        .fetch(id)
        .catch(() => null);
}

function recruteurAutorise(member) {
    return [
        CONFIG.responsableRecrutement,
        CONFIG.gestionRecrutement,
        CONFIG.fondation
    ].some(roleId =>
        member.roles.cache.has(
            roleId
        )
    );
}

// ======================================================
// LOG
// ======================================================

async function logAction(
    guild,
    title,
    executant,
    cible,
    description = null
) {
    const salon =
        guild.channels.cache.get(
            CONFIG.salonLogs
        );

    if (!salon?.isTextBased()) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setTitle(title)
            .addFields(
                {
                    name:
                        "Exécutant",
                    value:
                        `<@${executant.id}>\n\`${executant.id}\``,
                    inline:
                        true
                },
                {
                    name:
                        "Membre",
                    value:
                        `<@${cible.id}>\n\`${cible.id}\``,
                    inline:
                        true
                }
            )
            .setTimestamp();

    if (description) {
        embed.setDescription(
            description
        );
    }

    await salon.send({
        embeds: [embed]
    }).catch(() => {});
}

// ======================================================
// TRANSCRIPT
// ======================================================

async function createTranscript(channel) {
    let messages = [];
    let before;

    while (messages.length < 500) {
        const fetched =
            await channel.messages.fetch({
                limit: 100,
                before
            });

        if (!fetched.size) {
            break;
        }

        messages.push(
            ...fetched.values()
        );

        before =
            fetched.last().id;

        if (fetched.size < 100) {
            break;
        }
    }

    messages.sort(
        (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
    );

    const contenu =
        messages
            .map(message => {
                const date =
                    new Date(
                        message.createdTimestamp
                    ).toLocaleString(
                        "fr-FR"
                    );

                return (
                    `[${date}] ` +
                    `${message.author.tag} (${message.author.id}) : ` +
                    `${message.content || "[Embed / composant / pièce jointe]"}`
                );
            })
            .join("\n");

    return Buffer.from(
        contenu ||
        "Ticket vide.",
        "utf8"
    );
}

// ======================================================
// EMBEDS STATUTS
// ======================================================

function embedAttente(membre) {
    return new EmbedBuilder()
        .setColor(
            COLORS.attente
        )
        .setTitle(
            "Mise à jour de votre candidature <a:1181maruloader:1533145507201814689>"
        )
        .setDescription(
`**Votre candidature a bien été reçue et est désormais en attente d'examen par notre équipe de recrutement.**

Nous vous remercions pour l'intérêt que vous portez à The Legacy. **Chaque candidature est étudiée avec attention afin de garantir une intégration cohérente avec nos valeurs et nos exigences.**

Nous vous invitons à faire preuve de patience. Une réponse vous sera communiquée dans les prochaines 24h. En attendant, veillez à rester actif sur le serveur et à respecter son règlement.

> <@${membre.id}>`
        );
}

function embedAccepte(membre) {
    return new EmbedBuilder()
        .setColor(
            COLORS.accepte
        )
        .setTitle(
            "Mise à jour de votre candidature <a:1181maruloader:1533145507201814689>"
        )
        .setDescription(
`Après un examen attentif de votre candidature, **nous avons le plaisir de vous annoncer que celle-ci a été acceptée**.

Cette première étape vous ouvre désormais **les portes de l'entretien de recrutement**, **une phase essentielle de notre processus d'intégration**. **Cet échange nous permettra de mieux vous connaître**, d'**évaluer votre motivation** et de **nous assurer que vous partagez les valeurs qui définissent The Legacy**.

Les sessions d'entretien seront mis dans ce salon : <#${CONFIG.salonAnnonceEntretiens}>. **Nous vous invitons à rester attentif aux annonces afin de ne manquer aucune convocation**.

**L'entretien dure généralement une vingtaine de minutes et se déroule dans une atmosphère calme et respectueuse**. Nous vous recommandons d'être disponible, muni d'un microphone fonctionnel et de prendre connaissance du règlement avant votre passage.

**Nous vous souhaitons bonne chance pour cette nouvelle étape. Que votre détermination vous ouvre les portes de l'héritage**.

> <@${membre.id}>`
        );
}

function embedRefuse(membre) {
    return new EmbedBuilder()
        .setColor(
            COLORS.refuse
        )
        .setTitle(
            "Mise à jour de votre candidature <a:1181maruloader:1533145507201814689>"
        )
        .setDescription(
`Après une étude attentive de votre candidature, **nous vous informons que celle-ci n'a malheureusement pas été retenue**.

Cette décision ne remet pas en cause votre potentiel, mais reflète simplement le fait que votre profil ne correspond pas, à ce jour, aux attentes de The Legacy.

Nous vous invitons à **poursuivre votre évolution**, à **gagner en expérience** et à **revenir avec une candidature plus aboutie**. Un nouveau dépôt de candidature sera possible dans un délai d'**un mois à compter d'aujourd'hui**.

Nous vous remercions pour le temps que vous avez consacré à votre candidature et vous souhaitons une excellente continuation.

**L'héritage récompense ceux qui savent patienter**.

> <@${membre.id}>`
        );
}

// ======================================================
// PANEL RECRUTEUR
// ======================================================

function createReviewButtons(
    userId,
    ticketId,
    ddsStatus = "none",
    decision = "pending"
) {
    const decisionPrise =
        decision !== "pending";

    let ddsLabel =
        "DDS";

    let ddsDisabled =
        false;

    let ddsStyle =
        ButtonStyle.Secondary;

    if (ddsStatus === "pending") {
        ddsLabel =
            "DDS déjà en cours...";

        ddsDisabled =
            true;
    }

    if (ddsStatus === "received") {
        ddsLabel =
            "Résultat DDS reçu";

        ddsDisabled =
            true;

        ddsStyle =
            ButtonStyle.Success;
    }

    if (decisionPrise) {
        ddsDisabled = true;
    }

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `legacy_accept_${userId}_${ticketId}`
                )
                .setLabel(
                    decision === "accepted"
                        ? "Accepté"
                        : "Accepter"
                )
                .setStyle(
                    ButtonStyle.Success
                )
                .setDisabled(
                    decisionPrise
                ),

            new ButtonBuilder()
                .setCustomId(
                    `legacy_refuse_${userId}_${ticketId}`
                )
                .setLabel(
                    decision === "refused"
                        ? "Refusé"
                        : "Refuser"
                )
                .setStyle(
                    ButtonStyle.Danger
                )
                .setDisabled(
                    decisionPrise
                ),

            new ButtonBuilder()
                .setCustomId(
                    `legacy_dds_${userId}`
                )
                .setLabel(
                    ddsLabel
                )
                .setStyle(
                    ddsStyle
                )
                .setDisabled(
                    ddsDisabled
                )
        );
}

// ======================================================
// FORMULAIRE RECRUTEURS
// ======================================================

function createFormEmbed(
    membre,
    answers,
    durations,
    totalDuration
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                COLORS.attente
            )
            .setTitle(
                `📋 Candidature • ${membre.user.username}`
            )
            .setThumbnail(
                membre.user.displayAvatarURL({
                    size: 512
                })
            )
            .setDescription(
`**Statut :** En attente d'examen
**Temps total :** \`${formatDuree(totalDuration)}\`

**Discord :** <@${membre.id}>
**ID Discord :** \`${membre.id}\`
**@ Roblox :** ${answers.question1 || "Non renseigné"}`
            );

    for (
        let i = 1;
        i < QUESTIONS.length;
        i++
    ) {
        const question =
            QUESTIONS[i];

        embed.addFields({
            name:
                `${question.titre} • ${formatDuree(
                    durations[
                        question.key
                    ] || 0
                )}`,

            value:
                safeField(
                    answers[
                        question.key
                    ]
                ),

            inline:
                false
        });
    }

    embed
        .setFooter({
            text:
                "Statut : En attente"
        })
        .setTimestamp();

    return embed;
}

// ======================================================
// UPDATE PANEL RECRUTEUR
// ======================================================

async function updateReviewMessage(
    client,
    candidateId
) {
    const candidatures =
        lireCandidatures();

    const candidature =
        candidatures[
            candidateId
        ];

    if (
        !candidature ||
        !candidature.reviewChannelId ||
        !candidature.reviewMessageId
    ) {
        return;
    }

    const channel =
        await client.channels.fetch(
            candidature.reviewChannelId
        ).catch(() => null);

    if (!channel?.isTextBased()) {
        return;
    }

    const message =
        await channel.messages.fetch(
            candidature.reviewMessageId
        ).catch(() => null);

    if (!message) {
        return;
    }

    const decision =
        candidature.decision ||
        "pending";

    let color =
        COLORS.attente;

    let statut =
        "En attente";

    if (decision === "accepted") {
        color =
            COLORS.accepte;

        statut =
            "Acceptée";
    }

    if (decision === "refused") {
        color =
            COLORS.refuse;

        statut =
            "Refusée";
    }

    const embeds =
        message.embeds.map(
            (oldEmbed, index) => {
                const embed =
                    EmbedBuilder.from(
                        oldEmbed
                    );

                if (index === 0) {
                    embed
                        .setColor(
                            color
                        )
                        .setFooter({
                            text:
                                `Statut : ${statut}`
                        });
                }

                return embed;
            }
        );

    await message.edit({
        embeds,

        components: [
            createReviewButtons(
                candidateId,
                candidature.ticketId,
                candidature.ddsStatus ||
                "none",
                decision
            )
        ]
    });
}

// ======================================================
// QUESTIONNAIRE
// ======================================================

async function lancerQuestionnaire(
    channel,
    membre
) {
    if (
        questionnairesActifs.has(
            membre.id
        )
    ) {
        return null;
    }

    questionnairesActifs.add(
        membre.id
    );

    const answers = {};
    const durations = {};

    const debutTotal =
        Date.now();

    try {
        for (
            let index = 0;
            index < QUESTIONS.length;
            index++
        ) {
            const question =
                QUESTIONS[index];

            const debutQuestion =
                Date.now();

            const questionMessage =
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLORS.attente
                            )
                            .setTitle(
                                `${question.titre} • ${index + 1}/${QUESTIONS.length}`
                            )
                            .setDescription(
                                question.texte
                            )
                            .setFooter({
                                text:
                                    "Réponds dans un seul message • 5 minutes maximum"
                            })
                    ]
                });

            const collected =
                await channel.awaitMessages({
                    filter:
                        message =>
                            message.author.id ===
                            membre.id &&
                            !message.author.bot,

                    max: 1,

                    time:
                        5 * 60 * 1000,

                    errors: [
                        "time"
                    ]
                }).catch(
                    () => null
                );

            if (
                !collected ||
                !collected.size
            ) {
                await questionMessage
                    .delete()
                    .catch(() => {});

                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLORS.refuse
                            )
                            .setTitle(
                                "⏱️ Questionnaire expiré"
                            )
                            .setDescription(
                                `<@${membre.id}>, tu n'as pas répondu dans le délai de **5 minutes**.\n\nTu peux relancer le questionnaire depuis le bouton prévu à cet effet.`
                            )
                    ]
                });

                return null;
            }

            const response =
                collected.first();

            answers[
                question.key
            ] =
                response.content
                    .trim();

            durations[
                question.key
            ] =
                Date.now() -
                debutQuestion;

            await Promise.all([
                questionMessage
                    .delete()
                    .catch(() => {}),

                response
                    .delete()
                    .catch(() => {})
            ]);
        }

        return {
            answers,

            durations,

            totalDuration:
                Date.now() -
                debutTotal
        };

    } finally {
        questionnairesActifs.delete(
            membre.id
        );
    }
}

// ======================================================
// NOUVELLE RECRUE
// ======================================================

async function envoyerNouvelleRecrue(
    guild,
    membre
) {
    const salon =
        guild.channels.cache.get(
            CONFIG.salonNouvelleRecrue
        );

    if (!salon?.isTextBased()) {
        return;
    }

    await salon.send({
        content:
            "<@&1458391977073574012>",

        embeds: [
            new EmbedBuilder()
                .setColor(
                    COLORS.accepte
                )
                .setTitle(
                    "Nouvelle recrue ! <:coeurpnllgcy:1533222807423418479>"
                )
                .setDescription(
`Félicitations à <@${membre.id}>, qui rejoint désormais **The Legacy** en tant que **Membre Test** !

**Ton aventure commence aujourd'hui.** Durant cette période d'observation, tu auras l'occasion de démontrer ton sérieux, ton implication et ta capacité à représenter les valeurs qui font la réputation de notre héritage.

**Fais preuve de loyauté, de respect, de discrétion et de discipline.** Chaque action compte, et chaque étape te rapproche de ta place parmi les Héritiers.

> Nous attendons de la part de l'ensemble des membres, un accueil chaleureux, et que vous l'intégriez correctement !

Bienvenue dans The Legacy. Que ton histoire commence.

> PS : Nous rappelons que nous demandons une très forte activité vocale !

-# By <@&1458414705717805189> & <@&1467277541696868412> & <@&1532085431947100281>`
                )
        ]
    });
}

// ======================================================
// REGISTER
// ======================================================

module.exports =
function registerRecruitmentSystem(
    client
) {
    client.on(
        Events.InteractionCreate,
        async interaction => {

            // ==================================================
            // REJOINDRE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "legacy_join"
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const guild =
                    interaction.guild;

                const membre =
                    interaction.member;

                const existing =
                    guild.channels.cache.find(
                        channel =>
                            channel.topic ===
                            `candidature:${membre.id}`
                    );

                if (existing) {
                    return interaction.editReply({
                        content:
                            `❌ Tu possèdes déjà une candidature : ${existing}`
                    });
                }

                const ticket =
                    await guild.channels.create({
                        name:
                            `candidature-${cleanChannelName(
                                membre.user.username
                            )}`,

                        type:
                            ChannelType.GuildText,

                        parent:
                            CONFIG.categorieTickets,

                        topic:
                            `candidature:${membre.id}`,

                        permissionOverwrites: [
                            {
                                id:
                                    guild.id,

                                deny: [
                                    PermissionFlagsBits
                                        .ViewChannel
                                ]
                            },

                            {
                                id:
                                    membre.id,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    CONFIG.responsableRecrutement,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    CONFIG.gestionRecrutement,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    CONFIG.fondation,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            }
                        ]
                    });

                const boutons =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `legacy_form_${membre.id}`
                                )
                                .setLabel(
                                    "Formulaire de candidature"
                                )
                                .setEmoji("📝")
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `legacy_cancel_${membre.id}`
                                )
                                .setLabel(
                                    "Annuler ma candidature"
                                )
                                .setEmoji("✖️")
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                await ticket.send({
                    content:
                        `<@&${CONFIG.responsableRecrutement}> <@${membre.id}>`,

                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLORS.attente
                            )
                            .setTitle(
                                "Bienvenue dans ta candidature 🪽"
                            )
                            .setDescription(
`Bienvenue <@${membre.id}>,

Ce ticket est ton espace personnel de candidature pour rejoindre **The Legacy**.

Lorsque tu es prêt, clique sur **Formulaire de candidature**.

### Comment fonctionne le questionnaire ?

Le bot t'enverra les **11 questions une par une**, directement dans ce ticket.

Pour chaque question :

> **Tu dois envoyer toute ta réponse dans UN SEUL MESSAGE.**

Une fois ta réponse envoyée :
- elle est enregistrée automatiquement ;
- le message de la question est supprimé ;
- ton message de réponse est supprimé ;
- la question suivante apparaît automatiquement.

⏱️ **Tu disposes de 5 minutes maximum pour chaque question.**

Une fois les 11 questions terminées, ta candidature est automatiquement transmise à notre équipe de recrutement.

Prends le temps de fournir des réponses sérieuses, précises et complètes.`
                            )
                            .setFooter({
                                text:
                                    "The Legacy • Recrutements"
                            })
                    ],

                    components: [
                        boutons
                    ]
                });

                await logAction(
                    guild,
                    "📂 Ticket candidature créé",
                    membre.user,
                    membre.user,
                    `${ticket}`
                );

                return interaction.editReply({
                    content:
                        `✅ Ton ticket a été créé : ${ticket}`
                });
            }

            // ==================================================
            // ANNULER
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "legacy_cancel_"
                )
            ) {
                const userId =
                    interaction.customId.split(
                        "_"
                    )[2];

                if (
                    interaction.user.id !==
                    userId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ce n'est pas ta candidature.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const transcript =
                    await createTranscript(
                        interaction.channel
                    );

                const logs =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonLogs
                    );

                if (logs?.isTextBased()) {
                    await logs.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    COLORS.refuse
                                )
                                .setTitle(
                                    "❌ Candidature annulée !"
                                )
                                .setDescription(
`**Membre :** <@${interaction.user.id}>
**ID :** \`${interaction.user.id}\`
**Ticket :** \`${interaction.channel.name}\``
                                )
                                .setTimestamp()
                        ],

                        files: [
                            new AttachmentBuilder(
                                transcript,
                                {
                                    name:
                                        `candidature-${interaction.user.username}.txt`
                                }
                            )
                        ]
                    });
                }

                const candidatures =
                    lireCandidatures();

                delete candidatures[
                    interaction.user.id
                ];

                sauvegarderCandidatures(
                    candidatures
                );

                await interaction.editReply({
                    content:
                        "❌ Candidature annulée ! Fermeture du ticket..."
                });

                setTimeout(
                    () => {
                        interaction.channel
                            .delete(
                                "Candidature annulée"
                            )
                            .catch(() => {});
                    },
                    2500
                );

                return;
            }

            // ==================================================
            // LANCER QUESTIONNAIRE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "legacy_form_"
                )
            ) {
                const userId =
                    interaction.customId.split(
                        "_"
                    )[2];

                if (
                    interaction.user.id !==
                    userId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ce questionnaire ne t'appartient pas.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                if (
                    questionnairesActifs.has(
                        userId
                    )
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Ton questionnaire est déjà en cours."
                    });
                }

                const membre =
                    await getMember(
                        interaction.guild,
                        userId
                    );

                if (!membre) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                await interaction.editReply({
                    content:
                        "📝 Le questionnaire commence maintenant."
                });

                const resultat =
                    await lancerQuestionnaire(
                        interaction.channel,
                        membre
                    );

                if (!resultat) {
                    return;
                }

                const {
                    answers,
                    durations,
                    totalDuration
                } =
                    resultat;

                const candidatures =
                    lireCandidatures();

                candidatures[
                    membre.id
                ] = {
                    userId:
                        membre.id,

                    ticketId:
                        interaction.channel.id,

                    date:
                        Date.now(),

                    answers,

                    durations,

                    totalDuration,

                    ddsStatus:
                        "none",

                    ddsResult:
                        null,

                    decision:
                        "pending"
                };

                sauvegarderCandidatures(
                    candidatures
                );

                await interaction.channel.send({
                    embeds: [
                        embedAttente(
                            membre
                        )
                    ]
                });

                const salonForm =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonFormulaires
                    );

                if (!salonForm?.isTextBased()) {
                    return interaction.channel.send({
                        content:
                            "❌ Salon de réception des candidatures introuvable."
                    });
                }

                const embed =
                    createFormEmbed(
                        membre,
                        answers,
                        durations,
                        totalDuration
                    );

                const reviewMessage =
                    await salonForm.send({
                        content:
`<@&${CONFIG.responsableRecrutement}> <@&${CONFIG.gestionRecrutement}>

<@${membre.id}> vient de terminer son formulaire de candidature. Merci de l'examiner dès que possible.`,

                        embeds: [
                            embed
                        ],

                        components: [
                            createReviewButtons(
                                membre.id,
                                interaction.channel.id,
                                "none",
                                "pending"
                            )
                        ]
                    });

                const latest =
                    lireCandidatures();

                latest[
                    membre.id
                ].reviewChannelId =
                    salonForm.id;

                latest[
                    membre.id
                ].reviewMessageId =
                    reviewMessage.id;

                sauvegarderCandidatures(
                    latest
                );

                await logAction(
                    interaction.guild,
                    "✅ Formulaire terminé",
                    membre.user,
                    membre.user,
                    `Temps total : ${formatDuree(totalDuration)}`
                );

                return;
            }

            // ==================================================
            // ENTRETIEN → CR
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "entretien_cr_"
                )
            ) {
                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const ownerId =
                    parts[2];

                const targetId =
                    parts[3];

                if (
                    interaction.user.id !==
                    ownerId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ce panel ne t'appartient pas.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const cible =
                    await getMember(
                        interaction.guild,
                        targetId
                    );

                if (!cible) {
                    return interaction.reply({
                        content:
                            "❌ Membre introuvable.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            `entretien_crmodal_${targetId}_${interaction.user.id}`
                        )
                        .setTitle(
                            "Compte-rendu recrutement"
                        );

                const presentation =
                    new TextInputBuilder()
                        .setCustomId(
                            "presentation"
                        )
                        .setLabel(
                            "Présentation + Communication"
                        )
                        .setPlaceholder(
                            "Prénom + âge + activité actuelle (étudiant/travail/etc..) et timide ? à l'aise ? insolent ?"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true);

                const date =
                    new TextInputBuilder()
                        .setCustomId(
                            "date"
                        )
                        .setLabel(
                            "Date arrivée / refus + Accepté / Ref"
                        )
                        .setPlaceholder(
                            "Arrivé le 00/00 ou refusé le 00/00"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true);

                const pdt =
                    new TextInputBuilder()
                        .setCustomId(
                            "pdt"
                        )
                        .setLabel(
                            "Durée PDT"
                        )
                        .setPlaceholder(
                            "1 semaine minimum à 30 jours..."
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true);

                const discord =
                    new TextInputBuilder()
                        .setCustomId(
                            "discord"
                        )
                        .setLabel(
                            "@ Discord du candidat"
                        )
                        .setPlaceholder("@")
                        .setValue(
                            `@${cible.user.username}`
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(
                            presentation
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            date
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            pdt
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            discord
                        )
                );

                return interaction.showModal(
                    modal
                );
            }

            // ==================================================
            // CR → ENVOI
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "entretien_crmodal_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[2];

                const recruiterId =
                    parts[3];

                const cible =
                    await getMember(
                        interaction.guild,
                        candidateId
                    );

                if (!cible) {
                    return interaction.editReply({
                        content:
                            "❌ Candidat introuvable."
                    });
                }

                const presentation =
                    interaction.fields
                        .getTextInputValue(
                            "presentation"
                        );

                const date =
                    interaction.fields
                        .getTextInputValue(
                            "date"
                        );

                const pdt =
                    interaction.fields
                        .getTextInputValue(
                            "pdt"
                        );

                const discord =
                    interaction.fields
                        .getTextInputValue(
                            "discord"
                        );

                const salon =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonCR
                    );

                if (!salon?.isTextBased()) {
                    return interaction.editReply({
                        content:
                            "❌ Le salon des comptes-rendus est introuvable."
                    });
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            COLORS.attente
                        )
                        .setTitle(
                            "📑 Compte-rendu recrutement"
                        )
                        .setThumbnail(
                            cible.user.displayAvatarURL({
                                size: 512
                            })
                        )
                        .addFields(
                            {
                                name:
                                    "Présentation + Communication",
                                value:
                                    presentation
                            },
                            {
                                name:
                                    "Date arrivée / refus + Accepté / Ref",
                                value:
                                    date
                            },
                            {
                                name:
                                    "Durée de la PDT",
                                value:
                                    pdt
                            },
                            {
                                name:
                                    "@ Discord du candidat",
                                value:
                                    `${discord}\n<@${cible.id}>\n\`${cible.id}\``
                            },
                            {
                                name:
                                    "Recruteur",
                                value:
                                    `<@${recruiterId}>`
                            }
                        )
                        .setTimestamp();

                await salon.send({
                    embeds: [
                        embed
                    ]
                });

                await logAction(
                    interaction.guild,
                    "📑 Compte-rendu recrutement",
                    interaction.user,
                    cible.user,
                    `Compte-rendu envoyé dans <#${CONFIG.salonCR}>.`
                );

                return interaction.editReply({
                    content:
                        "✅ Le compte-rendu a été envoyé."
                });
            }

            // ==================================================
            // VOIR SANCTIONS
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "entretien_sanctions_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const ownerId =
                    parts[2];

                const candidateId =
                    parts[3];

                if (
                    interaction.user.id !==
                    ownerId
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Ce panel ne t'appartient pas."
                    });
                }

                const candidatures =
                    lireCandidatures();

                const candidature =
                    candidatures[
                        candidateId
                    ];

                if (!candidature) {
                    return interaction.editReply({
                        content:
                            "❌ Aucune candidature enregistrée pour ce membre."
                    });
                }

                if (
                    candidature.ddsStatus ===
                    "pending"
                ) {
                    return interaction.editReply({
                        content:
                            "⏳ Une DDS est actuellement en cours pour ce membre."
                    });
                }

                if (
                    candidature.ddsStatus !==
                    "received"
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Aucun résultat DDS n'a encore été reçu."
                    });
                }

                if (
                    !candidature.ddsResult
                ) {
                    return interaction.editReply({
                        content:
                            "⚠️ Le résultat DDS est indiqué comme reçu, mais aucun contenu n'est sauvegardé."
                    });
                }

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "⚖️ Résultat DDS"
                            )
                            .setDescription(
                                candidature.ddsResult
                            )
                            .addFields(
                                {
                                    name:
                                        "Membre",
                                    value:
                                        `<@${candidateId}>\n\`${candidateId}\``
                                },
                                {
                                    name:
                                        "@ Roblox",
                                    value:
                                        candidature.answers?.question1 ||
                                        "Inconnu"
                                }
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // ACCEPTER CANDIDATURE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "legacy_accept_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                if (
                    !recruteurAutorise(
                        interaction.member
                    )
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Tu n'as pas la permission."
                    });
                }

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const userId =
                    parts[2];

                const ticketId =
                    parts[3];

                const membre =
                    await getMember(
                        interaction.guild,
                        userId
                    );

                if (!membre) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                try {
                    await membre.roles.add(
                        CONFIG.roleCandidatureAcceptee
                    );

                } catch (error) {
                    return interaction.editReply({
                        content:
                            `❌ Impossible d'ajouter le rôle.\n\`${error.message}\``
                    });
                }

                const ticket =
                    interaction.guild.channels.cache.get(
                        ticketId
                    );

                if (ticket?.isTextBased()) {
                    await ticket.send({
                        content:
                            `<@${membre.id}>`,

                        embeds: [
                            embedAccepte(
                                membre
                            )
                        ]
                    });
                }

                const candidatures =
                    lireCandidatures();

                if (
                    candidatures[
                        userId
                    ]
                ) {
                    candidatures[
                        userId
                    ].decision =
                        "accepted";

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                await updateReviewMessage(
                    client,
                    userId
                );

                await logAction(
                    interaction.guild,
                    "✅ Candidature acceptée",
                    interaction.user,
                    membre.user
                );

                return interaction.editReply({
                    content:
                        `✅ Candidature de **${membre.user.username}** acceptée.`
                });
            }

            // ==================================================
            // REFUSER CANDIDATURE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "legacy_refuse_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                if (
                    !recruteurAutorise(
                        interaction.member
                    )
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Tu n'as pas la permission."
                    });
                }

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const userId =
                    parts[2];

                const ticketId =
                    parts[3];

                const membre =
                    await getMember(
                        interaction.guild,
                        userId
                    );

                if (!membre) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                try {
                    await membre.roles.add(
                        CONFIG.roleRefuse
                    );
                } catch (error) {
                    return interaction.editReply({
                        content:
                            `❌ Impossible d'ajouter le rôle.\n\`${error.message}\``
                    });
                }

                const ticket =
                    interaction.guild.channels.cache.get(
                        ticketId
                    );

                if (ticket?.isTextBased()) {
                    await ticket.send({
                        content:
                            `<@${membre.id}>`,

                        embeds: [
                            embedRefuse(
                                membre
                            )
                        ]
                    });
                }

                const candidatures =
                    lireCandidatures();

                if (
                    candidatures[
                        userId
                    ]
                ) {
                    candidatures[
                        userId
                    ].decision =
                        "refused";

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                await updateReviewMessage(
                    client,
                    userId
                );

                await logAction(
                    interaction.guild,
                    "❌ Candidature refusée",
                    interaction.user,
                    membre.user
                );

                return interaction.editReply({
                    content:
                        `❌ Candidature de **${membre.user.username}** refusée.`
                });
            }

            // ==================================================
            // DDS
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "legacy_dds_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                if (
                    !recruteurAutorise(
                        interaction.member
                    )
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Tu n'as pas la permission."
                    });
                }

                const candidateId =
                    interaction.customId.split(
                        "_"
                    )[2];

                const candidatures =
                    lireCandidatures();

                const candidature =
                    candidatures[
                        candidateId
                    ];

                if (
                    !candidature ||
                    !candidature.answers
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Candidature introuvable."
                    });
                }

                if (
                    candidature.ddsStatus ===
                    "pending"
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Une DDS est déjà en cours."
                    });
                }

                if (
                    candidature.ddsStatus ===
                    "received"
                ) {
                    return interaction.editReply({
                        content:
                            "✅ Le résultat DDS a déjà été reçu."
                    });
                }

                const salon =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonDDS
                    );

                if (!salon?.isTextBased()) {
                    return interaction.editReply({
                        content:
                            "❌ Salon DDS introuvable."
                    });
                }

                candidature.ddsStatus =
                    "pending";

                candidature.ddsRequesterId =
                    interaction.user.id;

                sauvegarderCandidatures(
                    candidatures
                );

                await updateReviewMessage(
                    client,
                    candidateId
                );

                const boutons =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `dds_reply_${candidateId}_${interaction.user.id}`
                                )
                                .setLabel(
                                    "Répondre avec formulaire sanctions"
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `dds_minor_${candidateId}_${interaction.user.id}`
                                )
                                .setLabel(
                                    "Aucune sanction importante"
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `dds_none_${candidateId}_${interaction.user.id}`
                                )
                                .setLabel(
                                    "Aucune sanction"
                                )
                                .setStyle(
                                    ButtonStyle.Success
                                )
                        );

                await salon.send({
                    content:
                        `<@${CONFIG.ownerId}>`,

                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                COLORS.attente
                            )
                            .setTitle(
                                "📋 Demande DDS"
                            )
                            .setDescription(
`<@${interaction.user.id}> souhaite consulter les sanctions de <@${candidateId}>.

**Discord :** <@${candidateId}>
**ID Discord :** \`${candidateId}\`
**@ Roblox :** ${candidature.answers.question1}`
                            )
                            .setTimestamp()
                    ],

                    components: [
                        boutons
                    ]
                });

                return interaction.editReply({
                    content:
                        "✅ DDS transmise."
                });
            }

            // ==================================================
            // DDS FORMULAIRE SANCTIONS
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "dds_reply_"
                )
            ) {
                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[2];

                const requesterId =
                    parts[3];

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            `dds_form_${candidateId}_${requesterId}`
                        )
                        .setTitle(
                            "Sanctions"
                        );

                for (
                    let i = 1;
                    i <= 4;
                    i++
                ) {
                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                new TextInputBuilder()
                                    .setCustomId(
                                        `sanction${i}`
                                    )
                                    .setLabel(
                                        `Sanction ${i}`
                                    )
                                    .setPlaceholder(
                                        i === 1
                                            ? "Sanction / raison / date..."
                                            : "Facultatif"
                                    )
                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )
                                    .setRequired(
                                        i === 1
                                    )
                            )
                    );
                }

                return interaction.showModal(
                    modal
                );
            }

            // ==================================================
            // DDS RÉPONSE FORMULAIRE
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "dds_form_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[2];

                const requesterId =
                    parts[3];

                const sanctions = [];

                for (
                    let i = 1;
                    i <= 4;
                    i++
                ) {
                    const value =
                        interaction.fields
                            .getTextInputValue(
                                `sanction${i}`
                            )
                            .trim();

                    if (value) {
                        sanctions.push(
                            `**Sanction ${i} :**\n${value}`
                        );
                    }
                }

                const resultatTexte =
                    sanctions.join(
                        "\n\n"
                    );

                const salon =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonReponseDDS
                    );

                if (!salon?.isTextBased()) {
                    return interaction.editReply({
                        content:
                            "❌ Salon réponse DDS introuvable."
                    });
                }

                await salon.send({
                    content:
                        `<@${requesterId}>`,

                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "⚖️ Résultat DDS"
                            )
                            .setDescription(
                                resultatTexte
                            )
                            .addFields(
                                {
                                    name:
                                        "Membre concerné",
                                    value:
                                        `<@${candidateId}>\n\`${candidateId}\``
                                }
                            )
                            .setTimestamp()
                    ]
                });

                const candidatures =
                    lireCandidatures();

                if (
                    candidatures[
                        candidateId
                    ]
                ) {
                    candidatures[
                        candidateId
                    ].ddsStatus =
                        "received";

                    candidatures[
                        candidateId
                    ].ddsResult =
                        resultatTexte;

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                await updateReviewMessage(
                    client,
                    candidateId
                );

                return interaction.editReply({
                    content:
                        "✅ Résultat DDS envoyé."
                });
            }

            // ==================================================
            // DDS AUCUNE IMPORTANTE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "dds_minor_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[2];

                const requesterId =
                    parts[3];

                const resultatTexte =
                    `Aucune sanction importante n'a été relevée pour <@${candidateId}>.`;

                const salon =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonReponseDDS
                    );

                if (!salon?.isTextBased()) {
                    return interaction.editReply({
                        content:
                            "❌ Salon introuvable."
                    });
                }

                await salon.send({
                    content:
                        `<@${requesterId}>`,

                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "⚖️ Résultat DDS"
                            )
                            .setDescription(
                                resultatTexte
                            )
                            .setTimestamp()
                    ]
                });

                const candidatures =
                    lireCandidatures();

                if (
                    candidatures[
                        candidateId
                    ]
                ) {
                    candidatures[
                        candidateId
                    ].ddsStatus =
                        "received";

                    candidatures[
                        candidateId
                    ].ddsResult =
                        resultatTexte;

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                await updateReviewMessage(
                    client,
                    candidateId
                );

                return interaction.editReply({
                    content:
                        "✅ Résultat DDS envoyé."
                });
            }

            // ==================================================
            // DDS AUCUNE SANCTION
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "dds_none_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[2];

                const requesterId =
                    parts[3];

                const resultatTexte =
                    `Aucune sanction n'a été trouvée pour <@${candidateId}>.`;

                const salon =
                    interaction.guild.channels.cache.get(
                        CONFIG.salonReponseDDS
                    );

                if (!salon?.isTextBased()) {
                    return interaction.editReply({
                        content:
                            "❌ Salon introuvable."
                    });
                }

                await salon.send({
                    content:
                        `<@${requesterId}>`,

                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "✅ Résultat DDS"
                            )
                            .setDescription(
                                resultatTexte
                            )
                            .setTimestamp()
                    ]
                });

                const candidatures =
                    lireCandidatures();

                if (
                    candidatures[
                        candidateId
                    ]
                ) {
                    candidatures[
                        candidateId
                    ].ddsStatus =
                        "received";

                    candidatures[
                        candidateId
                    ].ddsResult =
                        resultatTexte;

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                await updateReviewMessage(
                    client,
                    candidateId
                );

                return interaction.editReply({
                    content:
                        "✅ Résultat DDS envoyé."
                });
            }

            // ==================================================
            // PANEL ENTRETIEN CLASSIQUE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "entretien_"
                )
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const action =
                    parts[1];

                const ownerId =
                    parts[2];

                const targetId =
                    parts[3];

                if (
                    interaction.user.id !==
                    ownerId
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Ce panel ne t'appartient pas."
                    });
                }

                const cible =
                    await getMember(
                        interaction.guild,
                        targetId
                    );

                if (!cible) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                if (
                    action === "accept"
                ) {
                    for (
                        const roleId
                        of CONFIG.rolesEntretienAccepte
                    ) {
                        await cible.roles.add(
                            roleId
                        );
                    }

                    await envoyerNouvelleRecrue(
                        interaction.guild,
                        cible
                    );

                    await logAction(
                        interaction.guild,
                        "✅ Entretien accepté",
                        interaction.user,
                        cible.user
                    );

                    return interaction.editReply({
                        content:
                            "✅ Membre accepté."
                    });
                }

                if (
                    action === "refuse"
                ) {
                    await cible.roles.add(
                        CONFIG.roleRefuse
                    );

                    await logAction(
                        interaction.guild,
                        "❌ Entretien refusé",
                        interaction.user,
                        cible.user
                    );

                    return interaction.editReply({
                        content:
                            "❌ Membre refusé."
                    });
                }

                if (
                    action === "attente"
                ) {
                    if (
                        !cible.voice.channel
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Le membre n'est pas en vocal."
                        });
                    }

                    await cible.voice.setChannel(
                        CONFIG.attenteEntretien
                    );

                    await logAction(
                        interaction.guild,
                        "⏳ Attente entretien",
                        interaction.user,
                        cible.user
                    );

                    return interaction.editReply({
                        content:
                            "⏳ Membre déplacé."
                    });
                }

                if (
                    action === "move"
                ) {
                    if (
                        !interaction.member
                            .voice.channel
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Tu dois être en vocal."
                        });
                    }

                    if (
                        !cible.voice.channel
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Le membre n'est pas en vocal."
                        });
                    }

                    await cible.voice.setChannel(
                        interaction.member
                            .voice.channel
                    );

                    await logAction(
                        interaction.guild,
                        "🔊 Déplacé vers recruteur",
                        interaction.user,
                        cible.user
                    );

                    return interaction.editReply({
                        content:
                            "🔊 Membre déplacé."
                    });
                }
            }
        }
    );
};