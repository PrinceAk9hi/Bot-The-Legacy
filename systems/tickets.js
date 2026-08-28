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
// THE LEGACY — SYSTÈME DE TICKETS
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const CONFIG = {
    // ==================================================
    // BYPASS
    // ==================================================

    bypassRoles: [
        "1467277541696868412",
        "1458414705717805189"
    ],

    // ==================================================
    // TICKETS GÉNÉRAUX
    // ==================================================

    ticketResponsible:
        "1532085331656970400",

    ticketGestion:
        "1495888679535644753",

    // ==================================================
    // ANIMATIONS
    // ==================================================

    animationResponsible:
        "1532084983748100237",

    animationGestion:
        "1458394404568957052",

    // ==================================================
    // SANCTIONS / RANKUPS
    // ==================================================

    sanctionResponsible:
        "1531760308761133229",

    sanctionGestion:
        "1516451475415367822",

    // ==================================================
    // CATÉGORIES
    // ==================================================

    categoryGeneral:
        "1521895023472414721",

    categoryReport:
        "1521894502485327962",

    categoryEvent:
        "1521890653439656038",

    categoryFoundation:
        "1458476133124407351",

    // ==================================================
    // LOGS
    // ==================================================

    logsChannel:
        "1542668828658634852"
};

// ======================================================
// TYPES DE TICKETS
// ======================================================

const TICKET_TYPES = {
    questions: {
        label:
            "Questions/Aide",

        channelPrefix:
            "aide",

        categoryId:
            CONFIG.categoryGeneral,

        responsibleRoles: [
            CONFIG.ticketResponsible
        ],

        gestionRoles: [
            CONFIG.ticketGestion
        ],

        pingRoles: [
            CONFIG.ticketGestion
        ]
    },

    event: {
        label:
            "Création d'un évènement",

        channelPrefix:
            "evenement",

        categoryId:
            CONFIG.categoryEvent,

        responsibleRoles: [
            CONFIG.animationResponsible
        ],

        gestionRoles: [
            CONFIG.animationGestion
        ],

        pingRoles: [
            CONFIG.animationGestion
        ]
    },

    report: {
        label:
            "Signaler un membre",

        channelPrefix:
            "signalement",

        categoryId:
            CONFIG.categoryReport,

        responsibleRoles: [
            CONFIG.sanctionResponsible
        ],

        gestionRoles: [
            CONFIG.sanctionGestion
        ],

        pingRoles: [
            CONFIG.sanctionGestion
        ]
    },

    partnership: {
        label:
            "Demander un partenariat",

        channelPrefix:
            "partenariat",

        categoryId:
            CONFIG.categoryGeneral,

        responsibleRoles: [
            CONFIG.ticketResponsible
        ],

        gestionRoles: [
            CONFIG.ticketGestion
        ],

        pingRoles: [
            CONFIG.ticketGestion
        ]
    },

    role: {
        label:
            "Demander un rôle particulier",

        channelPrefix:
            "role",

        categoryId:
            CONFIG.categoryGeneral,

        responsibleRoles: [
            CONFIG.ticketResponsible
        ],

        gestionRoles: [
            CONFIG.ticketGestion
        ],

        pingRoles: [
            CONFIG.ticketGestion
        ]
    },

    foundation: {
        label:
            "Contacter la fondation",

        channelPrefix:
            "fondation",

        categoryId:
            CONFIG.categoryFoundation,

        responsibleRoles:
            [],

        gestionRoles:
            [],

        pingRoles:
            CONFIG.bypassRoles
    }
};

// ======================================================
// ANTI DOUBLE REGISTER
// ======================================================

let registered =
    false;

// ======================================================
// CLEAN CHANNEL NAME
// ======================================================

function cleanChannelName(
    name
) {
    return String(
        name ||
        "membre"
    )
        .toLowerCase()
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .replace(
            /^-|-$/g,
            ""
        )
        .substring(
            0,
            80
        ) ||
        "membre";
}

// ======================================================
// TOPIC / MÉTADONNÉES
// ======================================================

function buildTopic({
    type,
    ownerId,
    claimedBy = null,
    messageId = null
}) {
    return [
        "legacy-ticket",
        `type:${type}`,
        `owner:${ownerId}`,
        `claimed:${claimedBy || "none"}`,
        `message:${messageId || "none"}`
    ].join(
        "|"
    );
}

function parseTopic(
    topic
) {
    if (
        !topic ||
        !topic.startsWith(
            "legacy-ticket|"
        )
    ) {
        return null;
    }

    const result =
        {};

    const parts =
        topic.split(
            "|"
        );

    for (
        const part
        of parts.slice(
            1
        )
    ) {
        const separator =
            part.indexOf(
                ":"
            );

        if (
            separator ===
            -1
        ) {
            continue;
        }

        const key =
            part.substring(
                0,
                separator
            );

        const value =
            part.substring(
                separator +
                1
            );

        result[
            key
        ] =
            value;
    }

    if (
        !result.type ||
        !result.owner
    ) {
        return null;
    }

    return {
        type:
            result.type,

        ownerId:
            result.owner,

        claimedBy:
            result.claimed &&
            result.claimed !==
                "none"
                ? result.claimed
                : null,

        messageId:
            result.message &&
            result.message !==
                "none"
                ? result.message
                : null
    };
}

// ======================================================
// ROLES
// ======================================================

function memberHasAnyRole(
    member,
    roleIds
) {
    if (
        !member ||
        !Array.isArray(
            roleIds
        )
    ) {
        return false;
    }

    return roleIds.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

function isBypass(
    member
) {
    return memberHasAnyRole(
        member,
        CONFIG.bypassRoles
    );
}

function isTicketStaff(
    member,
    type
) {
    const ticketType =
        TICKET_TYPES[
            type
        ];

    if (
        !ticketType
    ) {
        return false;
    }

    if (
        isBypass(
            member
        )
    ) {
        return true;
    }

    return memberHasAnyRole(
        member,
        [
            ...ticketType.responsibleRoles,
            ...ticketType.gestionRoles
        ]
    );
}

// ======================================================
// VÉRIFICATION TICKET EXISTANT
// ======================================================

function findExistingTicket(
    guild,
    ownerId,
    type
) {
    return guild.channels.cache.find(
        channel => {
            const metadata =
                parseTopic(
                    channel.topic
                );

            return (
                metadata &&
                metadata.ownerId ===
                    ownerId &&
                metadata.type ===
                    type
            );
        }
    );
}

// ======================================================
// PERMISSIONS
// ======================================================

function buildPermissions(
    guild,
    ownerId,
    type
) {
    const ticketType =
        TICKET_TYPES[
            type
        ];

    const overwrites = [
        // @everyone
        {
            id:
                guild.id,

            deny: [
                PermissionFlagsBits.ViewChannel
            ]
        },

        // Créateur
        {
            id:
                ownerId,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions
            ]
        }
    ];

    const staffRoles =
        new Set([
            ...CONFIG.bypassRoles,
            ...ticketType.responsibleRoles,
            ...ticketType.gestionRoles
        ]);

    for (
        const roleId
        of staffRoles
    ) {
        overwrites.push({
            id:
                roleId,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions
            ]
        });
    }

    return overwrites;
}

// ======================================================
// PING À L'OUVERTURE
// ======================================================

function buildPingContent(
    ownerId,
    type
) {
    const ticketType =
        TICKET_TYPES[
            type
        ];

    const roles =
        ticketType.pingRoles
            .map(
                roleId =>
                    `<@&${roleId}>`
            )
            .join(
                " "
            );

    return `${roles} <@${ownerId}>`;
}

// ======================================================
// EMBED DU TICKET
// ======================================================

function createTicketEmbed({
    ownerId,
    ownerAvatar = null,
    type,
    claimedBy = null
}) {
    const ticketType =
        TICKET_TYPES[
            type
        ];

    const embed =
        new EmbedBuilder()
            .setColor(
                0x2B2D31
            )
            .setTitle(
                "Ticket Support 🎫"
            )
            .setDescription(
`Bienvenue <@${ownerId}>,

Merci de nous expliquer **clairement et précisément la raison de votre ticket** afin que notre équipe puisse traiter votre demande dans les meilleures conditions.

Vous pouvez joindre toutes les informations utiles :

> • le contexte de votre demande ;
> • les personnes concernées si nécessaire ;
> • des captures ou preuves si besoin ;
> • toute information complémentaire pouvant faciliter le traitement.

Un membre de notre équipe prendra en charge votre demande **dès que possible**.

*Merci de ne pas mentionner inutilement les membres de la gestion et de patienter jusqu'à la prise en charge de votre ticket.*`
            )
            .addFields(
                {
                    name:
                        "📂 Type",

                    value:
                        ticketType?.label ||
                        type,

                    inline:
                        false
                },

                {
                    name:
                        "👤 Créateur",

                    value:
                        `<@${ownerId}>`,

                    inline:
                        false
                },

                {
                    name:
                        "🛠️ Prise en charge",

                    value:
                        claimedBy
                            ? `<@${claimedBy}>`
                            : "En attente",

                    inline:
                        false
                }
            )
            .setFooter({
                text:
                    "The Legacy • Support"
            })
            .setTimestamp();

    if (
        ownerAvatar
    ) {
        embed.setThumbnail(
            ownerAvatar
        );
    }

    return embed;
}

// ======================================================
// BOUTONS PRINCIPAUX
// ======================================================

function createTicketButtons(
    claimedBy = null
) {
    const claimButton =
        new ButtonBuilder()
            .setCustomId(
                "legacy_ticket_claim"
            )
            .setLabel(
                claimedBy
                    ? "Pris en charge"
                    : "Prendre en charge"
            )
            .setEmoji(
                "🛠️"
            )
            .setStyle(
                claimedBy
                    ? ButtonStyle.Secondary
                    : ButtonStyle.Success
            )
            .setDisabled(
                Boolean(
                    claimedBy
                )
            );

    const renameButton =
        new ButtonBuilder()
            .setCustomId(
                "legacy_ticket_rename"
            )
            .setLabel(
                "Renommer"
            )
            .setEmoji(
                "✏️"
            )
            .setStyle(
                ButtonStyle.Secondary
            );

    const closeButton =
        new ButtonBuilder()
            .setCustomId(
                "legacy_ticket_close"
            )
            .setLabel(
                "Fermer"
            )
            .setEmoji(
                "🔒"
            )
            .setStyle(
                ButtonStyle.Danger
            );

    return new ActionRowBuilder()
        .addComponents(
            claimButton,
            renameButton,
            closeButton
        );
}

// ======================================================
// CONFIRMATION CLOSE
// ======================================================

function createCloseConfirmButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "legacy_ticket_close_confirm"
                )
                .setLabel(
                    "Confirmer la fermeture"
                )
                .setEmoji(
                    "🔒"
                )
                .setStyle(
                    ButtonStyle.Danger
                ),

            new ButtonBuilder()
                .setCustomId(
                    "legacy_ticket_close_cancel"
                )
                .setLabel(
                    "Annuler"
                )
                .setEmoji(
                    "✖️"
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
}

// ======================================================
// GET LOG CHANNEL
// ======================================================

async function getLogsChannel(
    guild
) {
    return (
        guild.channels.cache.get(
            CONFIG.logsChannel
        ) ||
        await guild.channels
            .fetch(
                CONFIG.logsChannel
            )
            .catch(
                () => null
            )
    );
}

// ======================================================
// TRANSCRIPT
// ======================================================

async function createTranscript(
    channel
) {
    const messages =
        [];

    let before =
        undefined;

    while (
        messages.length <
        1000
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
            fetched.last()?.id;

        if (
            fetched.size <
            100
        ) {
            break;
        }
    }

    messages.sort(
        (
            a,
            b
        ) =>
            a.createdTimestamp -
            b.createdTimestamp
    );

    const lines =
        messages.map(
            message => {
                const date =
                    new Date(
                        message.createdTimestamp
                    ).toLocaleString(
                        "fr-FR"
                    );

                const attachments =
                    [
                        ...message.attachments.values()
                    ]
                        .map(
                            attachment =>
                                attachment.url
                        )
                        .join(
                            " "
                        );

                let content =
                    message.content ||
                    "";

                if (
                    attachments
                ) {
                    content +=
                        ` ${attachments}`;
                }

                if (
                    !content.trim()
                ) {
                    content =
                        "[Embed / composant]";
                }

                return (
                    `[${date}] ` +
                    `${message.author.tag} (${message.author.id}) : ` +
                    content
                );
            }
        );

    return Buffer.from(
        lines.join(
            "\n"
        ) ||
        "Ticket vide.",
        "utf8"
    );
}

// ======================================================
// LOG OUVERTURE
// ======================================================

async function logTicketOpen(
    guild,
    channel,
    owner,
    type
) {
    const logs =
        await getLogsChannel(
            guild
        );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    const ticketType =
        TICKET_TYPES[
            type
        ];

    await logs.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    0x57F287
                )
                .setTitle(
                    "🎫 Ticket ouvert"
                )
                .addFields(
                    {
                        name:
                            "Membre",

                        value:
                            `<@${owner.id}>\n\`${owner.id}\``,

                        inline:
                            true
                    },

                    {
                        name:
                            "Type",

                        value:
                            ticketType?.label ||
                            type,

                        inline:
                            true
                    },

                    {
                        name:
                            "Salon",

                        value:
                            `${channel}\n\`${channel.name}\``,

                        inline:
                            false
                    }
                )
                .setTimestamp()
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// LOG PRISE EN CHARGE
// ======================================================

async function logTicketClaim(
    guild,
    channel,
    member
) {
    const logs =
        await getLogsChannel(
            guild
        );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    await logs.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    0x5865F2
                )
                .setTitle(
                    "🛠️ Ticket pris en charge"
                )
                .setDescription(
`**Ticket :** ${channel}

**Pris en charge par :** <@${member.id}>
**ID :** \`${member.id}\``
                )
                .setTimestamp()
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// LOG RENAME
// ======================================================

async function logTicketRename(
    guild,
    channel,
    member,
    oldName,
    newName
) {
    const logs =
        await getLogsChannel(
            guild
        );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    await logs.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    0xFEE75C
                )
                .setTitle(
                    "✏️ Ticket renommé"
                )
                .setDescription(
`**Ticket :** ${channel}
**Par :** <@${member.id}>

**Ancien nom :** \`${oldName}\`
**Nouveau nom :** \`${newName}\``
                )
                .setTimestamp()
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// LOG FERMETURE
// ======================================================

async function logTicketClose(
    channel,
    member,
    metadata,
    transcript
) {
    const logs =
        await getLogsChannel(
            channel.guild
        );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    const ticketType =
        TICKET_TYPES[
            metadata.type
        ];

    const embed =
        new EmbedBuilder()
            .setColor(
                0xED4245
            )
            .setTitle(
                "🔒 Ticket fermé"
            )
            .addFields(
                {
                    name:
                        "Créateur",

                    value:
                        `<@${metadata.ownerId}>\n\`${metadata.ownerId}\``,

                    inline:
                        true
                },

                {
                    name:
                        "Fermé par",

                    value:
                        `<@${member.id}>\n\`${member.id}\``,

                    inline:
                        true
                },

                {
                    name:
                        "Type",

                    value:
                        ticketType?.label ||
                        metadata.type,

                    inline:
                        true
                },

                {
                    name:
                        "Prise en charge",

                    value:
                        metadata.claimedBy
                            ? `<@${metadata.claimedBy}>`
                            : "Aucune",

                    inline:
                        true
                },

                {
                    name:
                        "Salon",

                    value:
                        `\`${channel.name}\``,

                    inline:
                        true
                },

                {
                    name:
                        "Ouvert",

                    value:
                        `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`,

                    inline:
                        false
                }
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
                        `ticket-${metadata.type}-${metadata.ownerId}.txt`
                }
            )
        ];
    }

    await logs.send(
        payload
    );
}

// ======================================================
// CRÉATION TICKET
// ======================================================

async function createTicket(
    interaction,
    type
) {
    const ticketType =
        TICKET_TYPES[
            type
        ];

    if (
        !ticketType
    ) {
        return interaction.editReply({
            content:
                "❌ Type de ticket invalide."
        });
    }

    const guild =
        interaction.guild;

    const owner =
        interaction.user;

    // ==================================================
    // 1 TICKET PAR TYPE
    // ==================================================

    const existing =
        findExistingTicket(
            guild,
            owner.id,
            type
        );

    if (
        existing
    ) {
        return interaction.editReply({
            content:
                `❌ Tu possèdes déjà un ticket **${ticketType.label}** : ${existing}`
        });
    }

    // ==================================================
    // CATÉGORIE
    // ==================================================

    const category =
        guild.channels.cache.get(
            ticketType.categoryId
        ) ||
        await guild.channels
            .fetch(
                ticketType.categoryId
            )
            .catch(
                () => null
            );

    if (
        !category
    ) {
        return interaction.editReply({
            content:
                "❌ La catégorie prévue pour ce ticket est introuvable."
        });
    }

    // ==================================================
    // CRÉATION SALON
    // ==================================================

    const channel =
        await guild.channels.create({
            name:
                `${ticketType.channelPrefix}-${cleanChannelName(owner.username)}`,

            type:
                ChannelType.GuildText,

            parent:
                ticketType.categoryId,

            topic:
                buildTopic({
                    type,

                    ownerId:
                        owner.id
                }),

            permissionOverwrites:
                buildPermissions(
                    guild,
                    owner.id,
                    type
                )
        });

    // ==================================================
    // MESSAGE PRINCIPAL
    // ==================================================

    const ticketMessage =
        await channel.send({
            content:
                buildPingContent(
                    owner.id,
                    type
                ),

            allowedMentions: {
                users: [
                    owner.id
                ],

                roles:
                    ticketType.pingRoles
            },

            embeds: [
                createTicketEmbed({
                    ownerId:
                        owner.id,

                    ownerAvatar:
                        owner.displayAvatarURL({
                            size:
                                512
                        }),

                    type,

                    claimedBy:
                        null
                })
            ],

            components: [
                createTicketButtons(
                    null
                )
            ]
        });

    // ==================================================
    // MÉMORISE LE MESSAGE PRINCIPAL
    // ==================================================

    await channel.setTopic(
        buildTopic({
            type,

            ownerId:
                owner.id,

            claimedBy:
                null,

            messageId:
                ticketMessage.id
        })
    );

    // ==================================================
    // LOG
    // ==================================================

    await logTicketOpen(
        guild,
        channel,
        owner,
        type
    );

    return interaction.editReply({
        content:
            `✅ Ton ticket a été créé : ${channel}`
    });
}

// ======================================================
// UPDATE MESSAGE PRINCIPAL
// ======================================================

async function updateTicketMainMessage(
    channel,
    metadata
) {
    if (
        !metadata.messageId
    ) {
        console.error(
            `❌ Ticket ${channel.id} : message principal absent du topic.`
        );

        return false;
    }

    const message =
        await channel.messages
            .fetch(
                metadata.messageId
            )
            .catch(
                () => null
            );

    if (
        !message
    ) {
        console.error(
            `❌ Ticket ${channel.id} : message principal introuvable.`
        );

        return false;
    }

    const owner =
        await channel.guild.members
            .fetch(
                metadata.ownerId
            )
            .catch(
                () => null
            );

    const ownerAvatar =
        owner?.user
            ?.displayAvatarURL({
                size:
                    512
            }) ||
        null;

    await message.edit({
        embeds: [
            createTicketEmbed({
                ownerId:
                    metadata.ownerId,

                ownerAvatar,

                type:
                    metadata.type,

                claimedBy:
                    metadata.claimedBy
            })
        ],

        components: [
            createTicketButtons(
                metadata.claimedBy
            )
        ]
    });

    return true;
}

// ======================================================
// REGISTER
// ======================================================

module.exports =
function registerTicketSystem(
    client
) {
    if (
        registered
    ) {
        return;
    }

    registered =
        true;

    console.log(
        "🎫 Système de tickets : ✅ enregistré"
    );

    client.on(
        Events.InteractionCreate,
        async interaction => {
            try {
                // ==================================================
                // OUVERTURE VIA SELECT
                // ==================================================

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId ===
                        "legacy_ticket_select"
                ) {
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const type =
                        interaction.values?.[
                            0
                        ];

                    await createTicket(
                        interaction,
                        type
                    );

                    return;
                }

                // ==================================================
                // UNIQUEMENT COMPOSANTS TICKETS
                // ==================================================

                const ticketComponent =
                    interaction.customId?.startsWith(
                        "legacy_ticket_"
                    );

                if (
                    !ticketComponent
                ) {
                    return;
                }

                const channel =
                    interaction.channel;

                if (
                    !channel
                ) {
                    return;
                }

                let metadata =
                    parseTopic(
                        channel.topic
                    );

                if (
                    !metadata
                ) {
                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {
                        await interaction.reply({
                            content:
                                "❌ Les informations de ce ticket sont introuvables.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return;
                }

                // ==================================================
                // PRENDRE EN CHARGE
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_claim"
                ) {
                    if (
                        !isTicketStaff(
                            interaction.member,
                            metadata.type
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Seule la gestion, le responsable ou un rôle bypass peut prendre en charge ce ticket.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ==================================================
                    // ACK IMMÉDIAT
                    // IMPORTANT : PLUS DE CHARGEMENT INFINI
                    // ==================================================

                    await interaction.deferUpdate();

                    // ==================================================
                    // RELIRE LE TOPIC APRÈS LE CLIC
                    // POUR ÉVITER 2 CLAIMS EN MÊME TEMPS
                    // ==================================================

                    metadata =
                        parseTopic(
                            interaction.channel.topic
                        );

                    if (
                        !metadata
                    ) {
                        await interaction.followUp({
                            content:
                                "❌ Impossible de récupérer les informations du ticket.",

                            flags:
                                MessageFlags.Ephemeral
                        });

                        return;
                    }

                    // ==================================================
                    // DÉJÀ PRIS
                    // ==================================================

                    if (
                        metadata.claimedBy
                    ) {
                        if (
                            metadata.claimedBy ===
                            interaction.user.id
                        ) {
                            await interaction.followUp({
                                content:
                                    "✅ Tu as déjà pris en charge ce ticket.",

                                flags:
                                    MessageFlags.Ephemeral
                            });

                            return;
                        }

                        await interaction.followUp({
                            content:
                                `❌ Ce ticket est déjà pris en charge par <@${metadata.claimedBy}>.`,

                            flags:
                                MessageFlags.Ephemeral
                        });

                        return;
                    }

                    // ==================================================
                    // ENREGISTREMENT CLAIM
                    // ==================================================

                    const claimedBy =
                        interaction.user.id;

                    const newMetadata = {
                        ...metadata,

                        claimedBy
                    };

                    await interaction.channel.setTopic(
                        buildTopic({
                            type:
                                newMetadata.type,

                            ownerId:
                                newMetadata.ownerId,

                            claimedBy:
                                newMetadata.claimedBy,

                            messageId:
                                newMetadata.messageId
                        }),
                        `Ticket pris en charge par ${interaction.user.tag}`
                    );

                    // ==================================================
                    // UPDATE EMBED + BOUTON
                    // ==================================================

                    const updated =
                        await updateTicketMainMessage(
                            interaction.channel,
                            newMetadata
                        );

                    if (
                        !updated
                    ) {
                        await interaction.followUp({
                            content:
                                "⚠️ Le ticket a été pris en charge, mais le message principal n'a pas pu être actualisé.",

                            flags:
                                MessageFlags.Ephemeral
                        });

                        return;
                    }

                    // ==================================================
                    // MESSAGE PUBLIC
                    // ==================================================

                    await interaction.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0x57F287
                                )
                                .setDescription(
`🛠️ Ce ticket est désormais pris en charge par <@${interaction.user.id}>.`
                                )
                                .setTimestamp()
                        ],

                        allowedMentions: {
                            users: [
                                interaction.user.id
                            ]
                        }
                    });

                    // ==================================================
                    // LOG
                    // ==================================================

                    await logTicketClaim(
                        interaction.guild,
                        interaction.channel,
                        interaction.user
                    );

                    // ==================================================
                    // CONFIRMATION PRIVÉE
                    // ==================================================

                    await interaction.followUp({
                        content:
                            "✅ Tu as pris en charge ce ticket.",

                        flags:
                            MessageFlags.Ephemeral
                    });

                    return;
                }

                // ==================================================
                // RENOMMER
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_rename"
                ) {
                    if (
                        !isTicketStaff(
                            interaction.member,
                            metadata.type
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Tu n'as pas la permission de renommer ce ticket.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                "legacy_ticket_rename_modal"
                            )
                            .setTitle(
                                "Renommer le ticket"
                            );

                    const input =
                        new TextInputBuilder()
                            .setCustomId(
                                "ticket_name"
                            )
                            .setLabel(
                                "Nouveau nom du salon"
                            )
                            .setPlaceholder(
                                "Ex : partenariat-serveur"
                            )
                            .setValue(
                                interaction.channel.name
                            )
                            .setRequired(
                                true
                            )
                            .setMinLength(
                                1
                            )
                            .setMaxLength(
                                80
                            )
                            .setStyle(
                                TextInputStyle.Short
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                input
                            )
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ==================================================
                // MODAL RENAME
                // ==================================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId ===
                        "legacy_ticket_rename_modal"
                ) {
                    if (
                        !isTicketStaff(
                            interaction.member,
                            metadata.type
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Tu n'as pas la permission de renommer ce ticket.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const requestedName =
                        interaction.fields
                            .getTextInputValue(
                                "ticket_name"
                            );

                    const newName =
                        cleanChannelName(
                            requestedName
                        );

                    if (
                        !newName
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Le nom indiqué est invalide."
                        });
                    }

                    const oldName =
                        interaction.channel.name;

                    if (
                        oldName ===
                        newName
                    ) {
                        return interaction.editReply({
                            content:
                                "⚠️ Le ticket porte déjà ce nom."
                        });
                    }

                    await interaction.channel.setName(
                        newName,
                        `Ticket renommé par ${interaction.user.tag}`
                    );

                    await logTicketRename(
                        interaction.guild,
                        interaction.channel,
                        interaction.user,
                        oldName,
                        newName
                    );

                    return interaction.editReply({
                        content:
                            `✅ Ticket renommé en \`${newName}\`.`
                    });
                }

                // ==================================================
                // FERMER
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close"
                ) {
                    const canClose =
                        interaction.user.id ===
                            metadata.ownerId ||
                        isTicketStaff(
                            interaction.member,
                            metadata.type
                        );

                    if (
                        !canClose
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Tu ne peux pas fermer ce ticket.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            "⚠️ **Es-tu sûr de vouloir fermer ce ticket ?**\n\nLe transcript sera sauvegardé dans les logs.",

                        components: [
                            createCloseConfirmButtons()
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==================================================
                // ANNULER FERMETURE
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close_cancel"
                ) {
                    return interaction.update({
                        content:
                            "✅ Fermeture du ticket annulée.",

                        components:
                            []
                    });
                }

                // ==================================================
                // CONFIRMER FERMETURE
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close_confirm"
                ) {
                    const canClose =
                        interaction.user.id ===
                            metadata.ownerId ||
                        isTicketStaff(
                            interaction.member,
                            metadata.type
                        );

                    if (
                        !canClose
                    ) {
                        return interaction.update({
                            content:
                                "❌ Tu n'as plus la permission de fermer ce ticket.",

                            components:
                                []
                        });
                    }

                    // ACK IMMÉDIAT
                    await interaction.update({
                        content:
                            "🔒 Fermeture du ticket en cours...",

                        components:
                            []
                    });

                    // ==================================================
                    // TRANSCRIPT
                    // ==================================================

                    const transcript =
                        await createTranscript(
                            interaction.channel
                        ).catch(
                            error => {
                                console.error(
                                    "❌ Transcript ticket :",
                                    error
                                );

                                return null;
                            }
                        );

                    // ==================================================
                    // LOG
                    // ==================================================

                    await logTicketClose(
                        interaction.channel,
                        interaction.user,
                        metadata,
                        transcript
                    ).catch(
                        error => {
                            console.error(
                                "❌ Log fermeture ticket :",
                                error
                            );
                        }
                    );

                    // ==================================================
                    // MESSAGE FERMETURE
                    // ==================================================

                    await interaction.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0xED4245
                                )
                                .setTitle(
                                    "🔒 Ticket fermé"
                                )
                                .setDescription(
`Ce ticket a été fermé par <@${interaction.user.id}>.

> Le transcript de la conversation a été sauvegardé dans les logs.

*Suppression du salon dans quelques secondes...*`
                                )
                                .setTimestamp()
                        ],

                        allowedMentions: {
                            users: [
                                interaction.user.id
                            ]
                        }
                    }).catch(
                        () => {}
                    );

                    // ==================================================
                    // DELETE 4 SEC
                    // ==================================================

                    setTimeout(
                        async () => {
                            await interaction.channel.delete(
                                `Ticket fermé par ${interaction.user.tag}`
                            ).catch(
                                error => {
                                    console.error(
                                        "❌ Suppression ticket :",
                                        error
                                    );
                                }
                            );
                        },
                        4000
                    );

                    return;
                }

            } catch (error) {
                console.error(
                    "❌ Système tickets :",
                    error
                );

                try {
                    if (
                        interaction.deferred
                    ) {
                        await interaction.followUp({
                            content:
                                "❌ Une erreur est survenue avec le système de tickets.",

                            flags:
                                MessageFlags.Ephemeral
                        });

                    } else if (
                        !interaction.replied
                    ) {
                        await interaction.reply({
                            content:
                                "❌ Une erreur est survenue avec le système de tickets.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                } catch {}
            }
        }
    );
};