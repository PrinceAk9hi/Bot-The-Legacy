const { syncSoulMember } = require("../utils/syncSoulMember");
const { hasBypass } = require("../utils/security");

const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

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

    gestionRecrutement:
        "1473356789453029376",

    direction:
        "1467924663337222196",

    rolesEntretienAccepte: [
        "1513698444588482650",
        "1468701337243090954"
    ],

    roleCandidatureAcceptee:
        "1468703799995666636",

    attenteEntretien:
        "1468699345443356885",

    categorieTickets:
        "1477270568611876934",

    salonNouvelleRecrue:
        "1471562633802023115",

    salonFormulaires:
        "1550247801437290607",

    salonDDS:
        "1550248050226892810",

    gestionRequete: "1550252288365436998",

    salonLogs:
        "1468699236475474032",

    salonCR:
        "1550241655255203921",

    ownerId: "547192186547077130"
};

// ======================================================
// REFUS / FERMETURE
// ======================================================

const REFUSED_CLOSE_DELAY =
    12 * 60 * 60 * 1000;

const REFUSED_CHECK_INTERVAL =
    60 * 1000;

// ======================================================
// COULEURS
// ======================================================

const COLORS = {
    attente:
        SOUL_COLORS.primary,

    accepte:
        SOUL_COLORS.success,

    refuse:
        SOUL_COLORS.error
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

if (
    !fs.existsSync(
        dataDir
    )
) {
    fs.mkdirSync(
        dataDir,
        {
            recursive:
                true
        }
    );
}

if (
    !fs.existsSync(
        candidaturesPath
    )
) {
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

function sauvegarderCandidatures(
    data
) {
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
        "key": "question1",
        "titre": "Question 1",
        "texte": "Votre âge IRL ?"
    },
    {
        "key": "question2",
        "titre": "Question 2",
        "texte": "Depuis combien de temps jouez-vous à School RP (en minutes exact) et qu'est-ce qui vous plait dans le jeu ?"
    },
    {
        "key": "question3",
        "titre": "Question 3",
        "texte": "Pourquoi souhaitez-vous rejoindre notre famille ? (3 lignes minimum)"
    },
    {
        "key": "question4",
        "titre": "Question 4",
        "texte": "Quelle est votre expérience en roleplay ? (débutant, intermédiaire, avancé)"
    },
    {
        "key": "question5",
        "titre": "Question 5",
        "texte": "Êtes-vous actif lors des événements RP ? (battle royal, cache cache, réunions...)"
    },
    {
        "key": "question6",
        "titre": "Question 6",
        "texte": "Comment réagissez vous en cas de conflit ou de problème en RP / de l'anti famille ?"
    },
    {
        "key": "question7",
        "titre": "Question 7",
        "texte": "Avez-vous déjà fait partie d'autres familles ou organisations dans School-RP ? Si oui, laquelle ?"
    },
    {
        "key": "question8",
        "titre": "Question 8",
        "texte": "Quel est votre pseudo Roblox (@) ainsi que votre nom RP actuel ?"
    },
    {
        "key": "question9",
        "titre": "Question 9",
        "texte": "Quelles sont vos disponibilités ? (Semaines, week-ends, vacances, horaires approximatives)"
    },
    {
        "key": "question10",
        "titre": "Question 10",
        "texte": "Êtes-vous capable de respecter les règles et l'ambiance de la famille sur le long terme ?"
    },
    {
        "key": "question11",
        "titre": "Question 11",
        "texte": "Décrivez votre personnalité,aussi bien en RP qu'en dehors du RP (8 à 10 lignes minimum)"
    },
    {
        "key": "question12",
        "titre": "Question 12",
        "texte": "Quelles sont vos principales motivations pour intégrer la famille et quels sont vos objectifs au sein de celle-ci?"
    }
];

const questionnairesActifs =
    new Set();

// ======================================================
// HELPERS
// ======================================================

function cleanChannelName(
    name
) {
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
        .substring(
            0,
            50
        ) ||
        "membre";
}

function formatDuree(
    ms
) {
    const secondes =
        Math.max(
            0,
            Math.floor(
                ms / 1000
            )
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

function safeField(
    text
) {
    if (!text) {
        return "Aucune réponse";
    }

    if (
        text.length <=
        500
    ) {
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
        .fetch(
            id
        )
        .catch(
            () => null
        );
}

function recruteurAutorise(
    member
) {
    if (hasBypass(member)) return true;

    return [        CONFIG.gestionRecrutement,
        "1527996778727870496"
    ].some(
        roleId =>
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

    if (
        !salon?.isTextBased()
    ) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setTitle(
                title
            )
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

    if (
        description
    ) {
        embed.setDescription(
            description
        );
    }

    await salon.send({
        embeds: [
            embed
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// TRANSCRIPT
// ======================================================

async function createTranscript(
    channel
) {
    let messages =
        [];

    let before;

    while (
        messages.length <
        500
    ) {
        const fetched =
            await channel.messages.fetch({
                limit:
                    100,

                before
            });

        if (
            !fetched.size
        ) {
            break;
        }

        messages.push(
            ...fetched.values()
        );

        before =
            fetched.last().id;

        if (
            fetched.size <
            100
        ) {
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
            .map(
                message => {
                    const date =
                        new Date(
                            message.createdTimestamp
                        )
                            .toLocaleString(
                                "fr-FR"
                            );

                    return (
                        `[${date}] ` +
                        `${message.author.tag} (${message.author.id}) : ` +
                        `${message.content || "[Embed / composant / pièce jointe]"}`
                    );
                }
            )
            .join(
                "\n"
            );

    return Buffer.from(
        contenu ||
        "Ticket vide.",
        "utf8"
    );
}

// ======================================================
// BOUTON FERMETURE REFUS
// ======================================================

function createCloseRefusedButton(
    userId,
    ticketId
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `soul_close_refused_${userId}_${ticketId}`
                )
                .setLabel(
                    "Fermer le ticket"
                )
                .setEmoji(
                    "🗑️"
                )
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

// ======================================================
// MP REFUS
// ======================================================

async function envoyerMPRefus(
    membre
) {
    try {
        await membre.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        COLORS.refuse
                    )
                    .setTitle(
                        "Mise à jour de votre candidature"
                    )
                    .setDescription(
`Bonjour <@${membre.id}>,

Suite à ta candidature pour rejoindre **Soul Society**, nous t'annonçons que celle-ci a été **refusée**.

Tu peux retrouver les informations concernant cette décision directement dans ton ticket de candidature, tant que celui-ci est encore ouvert.

Tu pourras déposer une nouvelle candidature dans un délai d'**un mois**.

**Soul Society**`
                    )
                    .setTimestamp()
            ]
        });

        return true;

    } catch {
        return false;
    }
}

// ======================================================
// LOG FERMETURE TICKET
// ======================================================

async function logTicketClosure(
    guild,
    {
        candidateId,
        closedById = null,
        ticketName,
        transcript,
        automatic = false
    }
) {
    const logs =
        guild.channels.cache.get(
            CONFIG.salonLogs
        );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                COLORS.refuse
            )
            .setTitle(
                automatic
                    ? "🕒 Ticket refusé fermé automatiquement"
                    : "🗑️ Ticket refusé fermé"
            )
            .setDescription(
                [
                    `**Candidat :** <@${candidateId}>`,
                    `**ID :** \`${candidateId}\``,
                    `**Ticket :** \`${ticketName}\``,
                    "",
                    automatic
                        ? "**Fermeture :** automatique après 12 heures"
                        : `**Fermé par :** <@${closedById}>`
                ].join(
                    "\n"
                )
            )
            .setTimestamp();

    const payload = {
        embeds: [
            embed
        ]
    };

    if (
        transcript
    ) {
        payload.files = [
            new AttachmentBuilder(
                transcript,
                {
                    name:
                        `candidature-refusee-${candidateId}.txt`
                }
            )
        ];
    }

    await logs.send(
        payload
    ).catch(
        () => {}
    );
}

// ======================================================
// FERMETURE TICKET REFUSÉ
// ======================================================

async function closeRefusedTicket(
    client,
    guild,
    ticket,
    candidateId,
    {
        closedById = null,
        automatic = false
    } = {}
) {
    if (
        !ticket
    ) {
        return false;
    }

    const candidatures =
        lireCandidatures();

    const candidature =
        candidatures[
            candidateId
        ];

    if (
        candidature
    ) {
        candidature.ticketClosedAt =
            Date.now();

        candidature.ticketClosedBy =
            automatic
                ? "AUTO_12H"
                : closedById;

        sauvegarderCandidatures(
            candidatures
        );
    }

    let transcript =
        null;

    if (
        ticket.isTextBased()
    ) {
        transcript =
            await createTranscript(
                ticket
            ).catch(
                () => null
            );
    }

    await logTicketClosure(
        guild,
        {
            candidateId,

            closedById,

            ticketName:
                ticket.name,

            transcript,

            automatic
        }
    );

    await ticket.delete(
        automatic
            ? "Candidature refusée • fermeture automatique après 12h"
            : "Candidature refusée • fermeture manuelle"
    ).catch(
        error => {
            console.error(
                "❌ Fermeture ticket refusé :",
                error
            );
        }
    );

    return true;
}

// ======================================================
// VÉRIFICATION DES TICKETS REFUSÉS
// ======================================================

async function checkExpiredRefusedTickets(
    client
) {
    const candidatures =
        lireCandidatures();

    let changed =
        false;

    for (
        const [
            candidateId,
            candidature
        ]
        of Object.entries(
            candidatures
        )
    ) {
        if (
            candidature.decision !==
                "refused" ||
            !candidature.closeAt ||
            candidature.ticketClosedAt
        ) {
            continue;
        }

        if (
            Date.now() <
            candidature.closeAt
        ) {
            continue;
        }

        const ticketId =
            candidature.ticketId;

        if (
            !ticketId
        ) {
            candidature.ticketClosedAt =
                Date.now();

            candidature.ticketClosedBy =
                "AUTO_12H";

            changed =
                true;

            continue;
        }

        const ticket =
            await client.channels
                .fetch(
                    ticketId
                )
                .catch(
                    () => null
                );

        if (
            !ticket
        ) {
            candidature.ticketClosedAt =
                Date.now();

            candidature.ticketClosedBy =
                "AUTO_12H";

            changed =
                true;

            continue;
        }

        const guild =
            ticket.guild;

        if (
            !guild
        ) {
            continue;
        }

        await closeRefusedTicket(
            client,
            guild,
            ticket,
            candidateId,
            {
                automatic:
                    true
            }
        );
    }

    if (
        changed
    ) {
        sauvegarderCandidatures(
            candidatures
        );
    }
}

// ======================================================
// EMBEDS STATUTS
// ======================================================

function embedAttente(
    membre
) {
    return new EmbedBuilder()
        .setColor(
            COLORS.attente
        )
        .setTitle(
            "Mise à jour de votre candidature <a:Loading:1548784199782244382>"
        )
        .setDescription(
`**Votre candidature a bien été reçue et est désormais en attente d'examen par notre équipe de recrutement.**

Nous vous remercions pour l'intérêt que vous portez à Soul Society. **Chaque candidature est étudiée avec attention afin de garantir une intégration cohérente avec nos valeurs et nos exigences.**

Nous vous invitons à faire preuve de patience. Une réponse vous sera communiquée dans les prochaines 24h. En attendant, veillez à rester actif sur le serveur et à respecter son règlement.

> <@${membre.id}>`
        );
}

function embedAccepte(
    membre
) {
    return new EmbedBuilder()
        .setColor(
            COLORS.accepte
        )
        .setTitle(
            "Mise à jour de votre candidature <a:Loading:1548784199782244382>"
        )
        .setDescription(
`Après un examen attentif de votre candidature, **nous avons le plaisir de vous annoncer que celle-ci a été acceptée**.

Cette première étape vous ouvre désormais **les portes de l'entretien de recrutement**, **une phase essentielle de notre processus d'intégration**. **Cet échange nous permettra de mieux vous connaître**, d'**évaluer votre motivation** et de **nous assurer que vous partagez les valeurs qui définissent Soul Society**.

Un membre de l’équipe de recrutement vous contactera pour vous demander vos disponibilités vocales et organiser votre entretien.

**L'entretien dure généralement une vingtaine de minutes et se déroule dans une atmosphère calme et respectueuse**. Nous vous recommandons d'être disponible, muni d'un microphone fonctionnel et de prendre connaissance du règlement avant votre passage.

**Nous vous souhaitons bonne chance pour cette nouvelle étape. Que votre détermination vous ouvre les portes de l'héritage**.

> <@${membre.id}>`
        );
}

function embedRefuse(
    membre
) {
    return new EmbedBuilder()
        .setColor(
            COLORS.refuse
        )
        .setTitle(
            "Mise à jour de votre candidature <a:Loading:1548784199782244382>"
        )
        .setDescription(
`Après une étude attentive de votre candidature, **nous vous informons que celle-ci n'a malheureusement pas été retenue**.

Cette décision ne remet pas en cause votre potentiel, mais reflète simplement le fait que votre profil ne correspond pas, à ce jour, aux attentes de Soul Society.

Nous vous invitons à **poursuivre votre évolution**, à **gagner en expérience** et à **revenir avec une candidature plus aboutie**. Un nouveau dépôt de candidature sera possible dans un délai d'**un mois à compter d'aujourd'hui**.

Nous vous remercions pour le temps que vous avez consacré à votre candidature et vous souhaitons une excellente continuation.

**L'héritage récompense ceux qui savent patienter**.

> 🗑️ Ce ticket peut être fermé avec le bouton ci-dessous. Dans le cas contraire, il sera automatiquement supprimé dans **12 heures**.

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
        decision !==
        "pending";

    let ddsLabel =
        "DDS";

    let ddsDisabled =
        false;

    let ddsStyle =
        ButtonStyle.Secondary;

    if (
        ddsStatus ===
        "pending"
    ) {
        ddsLabel =
            "DDS déjà en cours...";

        ddsDisabled =
            true;
    }

    if (
        ddsStatus ===
        "received"
    ) {
        ddsLabel =
            "Résultat DDS reçu";

        ddsDisabled =
            true;

        ddsStyle =
            ButtonStyle.Success;
    }

    if (
        decisionPrise
    ) {
        ddsDisabled =
            true;
    }

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `soul_accept_${userId}_${ticketId}`
                )
                .setLabel(
                    decision ===
                    "accepted"
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
                    `soul_refuse_${userId}_${ticketId}`
                )
                .setLabel(
                    decision ===
                    "refused"
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
                    `soul_dds_${userId}`
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
                    size:
                        512
                })
            )
            .setDescription(
`**Statut :** En attente d'examen **Temps total :** \`${formatDuree(totalDuration)}\`

**Discord :** <@${membre.id}>
**ID Discord :** \`${membre.id}\`
**@ Roblox :** ${String(answers.question8 || "Non renseigné").slice(0, 250)}`
            );

    for (
        let i = 0;
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
                ).slice(0, 350),

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
        ).catch(
            () => null
        );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const message =
        await channel.messages.fetch(
            candidature.reviewMessageId
        ).catch(
            () => null
        );

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

    if (
        decision ===
        "accepted"
    ) {
        color =
            COLORS.accepte;

        statut =
            "Acceptée";
    }

    if (
        decision ===
        "refused"
    ) {
        color =
            COLORS.refuse;

        statut =
            "Refusée";
    }

    const embeds =
        message.embeds.map(
            (
                oldEmbed,
                index
            ) => {
                const embed =
                    EmbedBuilder.from(
                        oldEmbed
                    );

                if (
                    index ===
                    0
                ) {
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

    const answers =
        {};

    const durations =
        {};

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

                    max:
                        1,

                    time:
                        5 *
                        60 *
                        1000,

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
                    .catch(
                        () => {}
                    );

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
                    .catch(
                        () => {}
                    ),

                response
                    .delete()
                    .catch(
                        () => {}
                    )
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

const oralInvitations = new Map();
async function demanderDisponibilitesOrales(guild, membre) {
    if (oralInvitations.has(membre.id)) return oralInvitations.get(membre.id);
    const sending = (async () => {
        const candidature = lireCandidatures()[membre.id];
        if (!candidature) throw new Error("Candidature introuvable pour la convocation orale.");
        if (candidature.oralAvailabilityMessageId) return;
        const salon = await guild.channels.fetch("1540836643433615360");
        if (!salon?.isTextBased() || salon.guildId !== guild.id) throw new Error("Salon des entretiens oraux inaccessible.");
        const message = await salon.send({
            content: '<@' + membre.id + '>',
            allowedMentions: { parse: [], users: [membre.id] },
            embeds: [new EmbedBuilder().setColor(COLORS.attente)
                .setTitle("🎙️ Prochaine étape : ton entretien oral")
                .setDescription("**Félicitations, ta candidature écrite a été acceptée !** 🌸\n\nBienvenue dans l’espace dédié aux candidats ayant validé cette première étape. Nous souhaitons maintenant échanger avec toi lors d’un **entretien oral**, afin de mieux te connaître et de poursuivre ton recrutement au sein de **Soul Society**.\n\nMerci d’indiquer **tes disponibilités dans ce salon**, en précisant les jours et les horaires auxquels tu peux être présent en vocal.\n\nPrévois **au moins 30 minutes** : l’échange pourra durer un peu plus longtemps si nécessaire. Un membre de l’équipe de recrutement prendra contact avec toi pour convenir d’un créneau.\n\nÀ bientôt pour ton entretien !")
                .setFooter({ text: "Soul Society • Équipe de recrutement" })]
        });
        const latest = lireCandidatures();
        if (latest[membre.id]) {
            latest[membre.id].oralAvailabilityMessageId = message.id;
            latest[membre.id].oralAvailabilityChannelId = salon.id;
            sauvegarderCandidatures(latest);
        }
    })();
    oralInvitations.set(membre.id, sending);
    try { return await sending; }
    finally { oralInvitations.delete(membre.id); }
}

async function envoyerNouvelleRecrue(
    guild,
    membre
) {
    await require("./memberOnboarding").notifyRecruit(membre);
    const salon =
        guild.channels.cache.get(
            CONFIG.salonNouvelleRecrue
        );

    if (
        !salon?.isTextBased()
    ) {
        return;
    }

    await salon.send({
        content:
            "<@&1513698444588482650>",

        embeds: [
            new EmbedBuilder()
                .setColor(
                    COLORS.accepte
                )
                .setTitle(
                    "Nouvelle recrue ! <:Soul_Society:1548783936010977380>"
                )
                .setDescription(
`Félicitations à <@${membre.id}>, qui rejoint désormais **Soul Society** en tant que **Membre Test** !

**Ton aventure commence aujourd'hui.** Durant cette période d'observation, tu auras l'occasion de démontrer ton sérieux, ton implication et ta capacité à représenter les valeurs qui font la réputation de notre héritage.

**Fais preuve de loyauté, de respect, de discrétion et de discipline.** Chaque action compte, et chaque étape te rapproche de ta place parmi les membres.

> Nous attendons de la part de l'ensemble des membres, un accueil chaleureux, et que vous l'intégriez correctement !

Bienvenue dans Soul Society. Que ton histoire commence.

> PS : Nous rappelons que nous demandons une très forte activité vocale !

-# By <@&1471546243653304392> & <@&1504782476319526932> & <@&1527996778727870496> & <@&1473356789453029376>`
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
    // ==================================================
    // RESTAURATION DES FERMETURES 12H
    // ==================================================

    client.once(
        Events.ClientReady,
        async () => {
            await checkExpiredRefusedTickets(
                client
            ).catch(
                error =>
                    console.error(
                        "❌ Vérification tickets refusés :",
                        error
                    )
            );

            setInterval(
                () => {
                    checkExpiredRefusedTickets(
                        client
                    ).catch(
                        error =>
                            console.error(
                                "❌ Fermeture automatique candidature :",
                                error
                            )
                    );
                },
                REFUSED_CHECK_INTERVAL
            );

            console.log(
                "🕒 Fermeture automatique des candidatures refusées : ✅ 12h"
            );
        }
    );

    client.on(
        Events.InteractionCreate,
        client.handleRecruitmentInteraction = async interaction => {
            if (interaction.customId?.startsWith("entretien_") && !/^entretien_(candidature|sanctions)_/.test(interaction.customId) && !recruteurAutorise(interaction.member)) {
                return interaction.reply({ content: "❌ Action réservée à l’équipe de recrutement.", flags: MessageFlags.Ephemeral });
            }


            // ==================================================
            // FERMER TICKET REFUSÉ
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "soul_close_refused_"
                )
            ) {
                const parts =
                    interaction.customId.split(
                        "_"
                    );

                const candidateId =
                    parts[3];

                const ticketId =
                    parts[4];

                const isCandidate =
                    interaction.user.id ===
                    candidateId;

                const isRecruiter =
                    recruteurAutorise(
                        interaction.member
                    );

                if (
                    !isCandidate &&
                    !isRecruiter
                ) {
                    return interaction.reply({
                        content:
                            "❌ Tu ne peux pas fermer ce ticket.",

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    interaction.channel.id !==
                    ticketId
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ce bouton ne correspond pas à ce ticket.",

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.reply({
                    content:
                        "🗑️ Fermeture du ticket...",

                    flags:
                        MessageFlags.Ephemeral
                });

                setTimeout(
                    async () => {
                        await closeRefusedTicket(
                            client,
                            interaction.guild,
                            interaction.channel,
                            candidateId,
                            {
                                closedById:
                                    interaction.user.id,

                                automatic:
                                    false
                            }
                        );
                    },
                    1500
                );

                return;
            }

            // ==================================================
            // REJOINDRE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "soul_join"
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

                if (
                    existing
                ) {
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
                                    CONFIG.gestionRecrutement,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },

                            ...["1527996778727870496", "1471546243653304392", "1504782476319526932", "1469803353964810250", "1522357970778718249", "1497660642436448266"].map(id => ({ id, allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ] }))
                        ]
                    });

                const boutons =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `soul_form_${membre.id}`
                                )
                                .setLabel(
                                    "Formulaire de candidature"
                                )
                                .setEmoji(
                                    "📝"
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `soul_cancel_${membre.id}`
                                )
                                .setLabel(
                                    "Annuler ma candidature"
                                )
                                .setEmoji(
                                    "✖️"
                                )
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                await ticket.send({
                    content:
                        `<@&${CONFIG.gestionRecrutement}> <@${membre.id}>`,

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

Ce ticket est ton espace personnel de candidature pour rejoindre **Soul Society**.

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
                                    "Soul Society • Recrutements"
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
                    "soul_cancel_"
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

                if (
                    logs?.isTextBased()
                ) {
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
                            .catch(
                                () => {}
                            );
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
                    "soul_form_"
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

                if (
                    !resultat
                ) {
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

                    formVersion: 3,
                    answers,

                    durations,

                    totalDuration,

                    ddsStatus:
                        "none",

                    ddsResult:
                        null,

                    decision:
                        "pending",

                    closeAt:
                        null,

                    ticketClosedAt:
                        null,

                    ticketClosedBy:
                        null
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

                if (
                    !salonForm?.isTextBased()
                ) {
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
                        files: [{ attachment: Buffer.from(QUESTIONS.map(q => q.texte + "\n" + (answers[q.key] || "")).join("\n\n"), "utf8"), name: "candidature-complete.txt" }],
                        content:
`<@&${CONFIG.gestionRecrutement}>

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

                if (
                    !cible
                ) {
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
                        .setRequired(
                            true
                        );

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
                        .setRequired(
                            true
                        );

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
                        .setRequired(
                            true
                        );

                const discord =
                    new TextInputBuilder()
                        .setCustomId(
                            "discord"
                        )
                        .setLabel(
                            "@ Discord du candidat"
                        )
                        .setPlaceholder(
                            "@"
                        )
                        .setValue(
                            `@${cible.user.username}`
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        );

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

                if (
                    !cible
                ) {
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

                if (
                    !salon?.isTextBased()
                ) {
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
                                size:
                                    512
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
            // Voir la candidature complète, y compris depuis les anciens panels.
            if (interaction.isButton() && /^entretien_(candidature|sanctions)_/.test(interaction.customId)) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const [, , ownerId, candidateId] = interaction.customId.split("_");
                if (interaction.user.id !== ownerId) return interaction.editReply("❌ Ce panel ne t’appartient pas.");
                return interaction.editReply(require("../utils/candidateSummary").buildSummary(candidateId));
            }

            // ==================================================
            // ACCEPTER CANDIDATURE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "soul_accept_"
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

                if (
                    !membre
                ) {
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

                if (
                    ticket?.isTextBased()
                ) {
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

                    candidatures[
                        userId
                    ].closeAt =
                        null;

                    sauvegarderCandidatures(
                        candidatures
                    );
                }

                let oralInvitationSent = true;
                await demanderDisponibilitesOrales(interaction.guild, membre).catch(error => {
                    oralInvitationSent = false;
                    console.error("❌ Demande de disponibilités orales :", error.message);
                });

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
                        `✅ Candidature de **${membre.user.username}** acceptée.` + (oralInvitationSent ? " La demande de disponibilités orales a été envoyée." : " ⚠️ La demande de disponibilités n’a pas pu être envoyée : vérifie l’accès du bot au salon 1540836643433615360, puis réessaie l’acceptation.")
                });
            }

            // ==================================================
            // REFUSER CANDIDATURE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "soul_refuse_"
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

                if (
                    !membre
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                // Aucun rôle attribué lors du refus écrit.

                const closeAt =
                    Date.now() +
                    REFUSED_CLOSE_DELAY;

                const candidatures =
                    lireCandidatures();

                if (
                    !candidatures[
                        userId
                    ]
                ) {
                    candidatures[
                        userId
                    ] = {
                        userId,

                        ticketId,

                        date:
                            Date.now()
                    };
                }

                candidatures[
                    userId
                ].decision =
                    "refused";

                candidatures[
                    userId
                ].ticketId =
                    ticketId;

                candidatures[
                    userId
                ].refusedAt =
                    Date.now();

                candidatures[
                    userId
                ].closeAt =
                    closeAt;

                candidatures[
                    userId
                ].ticketClosedAt =
                    null;

                candidatures[
                    userId
                ].ticketClosedBy =
                    null;

                sauvegarderCandidatures(
                    candidatures
                );

                // ==========================================
                // MESSAGE DANS LE TICKET
                // ==========================================

                const ticket =
                    interaction.guild.channels.cache.get(
                        ticketId
                    );

                if (
                    ticket?.isTextBased()
                ) {
                    await ticket.send({
                        content:
                            `<@${membre.id}>`,

                        embeds: [
                            embedRefuse(
                                membre
                            )
                        ],

                        components: [
                            createCloseRefusedButton(
                                membre.id,
                                ticketId
                            )
                        ]
                    });
                }

                // ==========================================
                // MP UNIQUEMENT SI REFUS
                // ==========================================

                const dmSent =
                    await envoyerMPRefus(
                        membre
                    );

                await updateReviewMessage(
                    client,
                    userId
                );

                await logAction(
                    interaction.guild,
                    "❌ Candidature refusée",
                    interaction.user,
                    membre.user,
                    [
                        "Ticket programmé pour fermeture automatique dans 12 heures.",
                        dmSent
                            ? "✅ MP de refus envoyé."
                            : "⚠️ Impossible d'envoyer le MP."
                    ].join(
                        "\n"
                    )
                );

                return interaction.editReply({
                    content:
                        [
                            `❌ Candidature de **${membre.user.username}** refusée.`,
                            "",
                            "🕒 Le ticket sera automatiquement supprimé dans **12 heures**.",
                            dmSent
                                ? "📩 Le candidat a reçu un MP."
                                : "⚠️ Le candidat n'accepte pas les MP du bot."
                        ].join(
                            "\n"
                        )
                });
            }

            // ==================================================
            // DDS
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "soul_dds_"
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

                if (
                    !salon?.isTextBased()
                ) {
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
                        `<@&${CONFIG.gestionRequete}>`,
                    allowedMentions: { parse: [], roles: [CONFIG.gestionRequete] },

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
**@ Roblox :** ${candidature.formVersion === 3 ? candidature.answers.question8 : candidature.answers.question1}`
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
            // Réponses DDS : un résultat lié à la candidature et un ghost ping du demandeur.
            if (/^dds_(reply|form|none|minor)_/.test(interaction.customId || "")) {
                const [, action, candidateId] = interaction.customId.split("_");
                if (!hasBypass(interaction) && !recruteurAutorise(interaction.member) && !interaction.member.roles.cache.has(CONFIG.gestionRequete)) {
                    return interaction.reply({ content: "❌ Accès réservé à la gestion des requêtes et au recrutement.", flags: MessageFlags.Ephemeral });
                }
                if (action === "reply" && interaction.isButton()) {
                    const modal = new ModalBuilder().setCustomId('dds_form_' + candidateId).setTitle("Sanctions");
                    for (let n = 1; n <= 4; n++) modal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('sanction' + n).setLabel('Sanction ' + n)
                            .setStyle(TextInputStyle.Paragraph).setMaxLength(900).setRequired(n === 1)));
                    return interaction.showModal(modal);
                }
                if ((action === "form" && interaction.isModalSubmit()) || (["none", "minor"].includes(action) && interaction.isButton())) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const result = action === "form"
                        ? [1,2,3,4].map(n => interaction.fields.getTextInputValue('sanction' + n).trim()).filter(Boolean).join("\n\n")
                        : "Aucune sanction n’a été trouvée pour ce membre.";
                    return require("../utils/ddsResponse").sendResult(interaction, candidateId, result, {
                        read: lireCandidatures, save: sauvegarderCandidatures,
                        refresh: () => updateReviewMessage(client, candidateId)
                    });
                }
                return;
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

                if (
                    !cible
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Membre introuvable."
                    });
                }

                if (
                    action ===
                    "accept"
                ) {
                    for (
                        const roleId
                        of CONFIG.rolesEntretienAccepte
                    ) {
                        await cible.roles.add(
                            roleId
                        );
                    }

                    await cible.roles.remove(CONFIG.roleCandidatureAcceptee);
                    const robloxSync = await syncSoulMember(cible, { discordRank: "novice" }).catch(() => ({ success: false }));
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
                            "✅ Membre accepté." + (robloxSync.success ? " Rôles Roblox synchronisés." : " Synchronisation Roblox à terminer ; consulte les logs.")
                    });
                }

                if (
                    action ===
                    "refuse"
                ) {
                    // Aucun rôle attribué lors du refus oral.

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
                    action ===
                    "attente"
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
                    action ===
                    "move"
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