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
    // SANCTIONS
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

        // Fondation → bypass directement
        pingRoles:
            CONFIG.bypassRoles
    }
};

// ======================================================
// PROTECTION DOUBLE REGISTER
// ======================================================

let registered =
    false;

// ======================================================
// CLEAN NAME
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
            ""
        )
        .substring(
            0,
            30
        ) ||
        "membre";
}

// ======================================================
// METADATA TOPIC
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

    const result = {};

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
        const index =
            part.indexOf(
                ":"
            );

        if (
            index ===
            -1
        ) {
            continue;
        }

        const key =
            part.substring(
                0,
                index
            );

        const value =
            part.substring(
                index +
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
    const info =
        TICKET_TYPES[
            type
        ];

    if (
        !info
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
            ...info.responsibleRoles,
            ...info.gestionRoles
        ]
    );
}

// ======================================================
// TICKET EXISTANT
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
    const info =
        TICKET_TYPES[
            type
        ];

    const overwrites = [
        // Tout le serveur
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
            ...info.responsibleRoles,
            ...info.gestionRoles
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
// PING
// ======================================================

function buildPingContent(
    ownerId,
    type
) {
    const info =
        TICKET_TYPES[
            type
        ];

    const roles =
        info.pingRoles
            .map(
                id =>
                    `<@&${id}>`
            )
            .join(
                " "
            );

    return `${roles} <@${ownerId}>`;
}

// ======================================================
// EMBED TICKET
// ======================================================

function createTicketEmbed({
    owner,
    type,
    claimedBy = null
}) {
    const info =
        TICKET_TYPES[
            type
        ];

    const embed =
        new EmbedBuilder()
            .setColor(
                0x2B2D31
            )
            .setTitle(
                "🎫 Ticket Support"
            )
            .setDescription(
`Bienvenue <@${owner.id}>,

Merci d'expliquer **clairement et précisément la raison de votre demande**.

Afin que notre équipe puisse traiter votre ticket dans les meilleures conditions, n'hésitez pas à fournir toutes les informations utiles :

> • le contexte de votre demande ;
> • les personnes concernées si nécessaire ;
> • des captures ou preuves si la situation le nécessite ;
> • toute information complémentaire pouvant faciliter le traitement.

Un membre de notre équipe prendra en charge votre demande **dès que possible**.

-# Merci de ne pas mentionner inutilement les membres de la gestion et de patienter jusqu'à la prise en charge de votre ticket.`
            )
            .addFields(
                {
                    name:
                        "📂 Type",

                    value:
                        info.label,

                    inline:
                        true
                },

                {
                    name:
                        "👤 Créateur",

                    value:
                        `<@${owner.id}>`,

                    inline:
                        true
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
            .setThumbnail(
                owner.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Support"
            })
            .setTimestamp();

    return embed;
}

// ======================================================
// BOUTONS PRINCIPAUX
// ======================================================

function createTicketButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "legacy_ticket_claim"
                )
                .setLabel(
                    "Prendre en charge"
                )
                .setEmoji(
                    "🛠️"
                )
                .setStyle(
                    ButtonStyle.Success
                ),

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
                ),

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
                )
        );
}

// ======================================================
// BOUTONS CONFIRMATION CLOSE
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
        guild.channels.cache.get(
            CONFIG.logsChannel
        ) ||
        await guild.channels
            .fetch(
                CONFIG.logsChannel
            )
            .catch(
                () => null
            );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    const info =
        TICKET_TYPES[
            type
        ];

    const embed =
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
                        info.label,

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
            .setTimestamp();

    await logs.send({
        embeds: [
            embed
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// LOG CLAIM
// ======================================================

async function logTicketClaim(
    guild,
    channel,
    member
) {
    const logs =
        guild.channels.cache.get(
            CONFIG.logsChannel
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
**Pris en charge par :** <@${member.id}>`
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
        guild.channels.cache.get(
            CONFIG.logsChannel
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
`**Par :** <@${member.id}>

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
    const guild =
        channel.guild;

    const logs =
        guild.channels.cache.get(
            CONFIG.logsChannel
        ) ||
        await guild.channels
            .fetch(
                CONFIG.logsChannel
            )
            .catch(
                () => null
            );

    if (
        !logs?.isTextBased()
    ) {
        return;
    }

    const info =
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
                        info?.label ||
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
// CREATE TICKET
// ======================================================

async function createTicket(
    interaction,
    type
) {
    const info =
        TICKET_TYPES[
            type
        ];

    if (
        !info
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
    // UN TICKET PAR TYPE
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
                `❌ Tu possèdes déjà un ticket **${info.label}** : ${existing}`
        });
    }

    // ==================================================
    // CATÉGORIE
    // ==================================================

    const category =
        guild.channels.cache.get(
            info.categoryId
        ) ||
        await guild.channels
            .fetch(
                info.categoryId
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
    // CRÉATION
    // ==================================================

    const channel =
        await guild.channels.create({
            name:
                `${info.channelPrefix}-${cleanChannelName(owner.username)}`,

            type:
                ChannelType.GuildText,

            parent:
                info.categoryId,

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
    // MESSAGE
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
                    info.pingRoles
            },

            embeds: [
                createTicketEmbed({
                    owner,

                    type
                })
            ],

            components: [
                createTicketButtons()
            ]
        });

    // ==================================================
    // ENREGISTRE ID MESSAGE
    // ==================================================

    await channel.setTopic(
        buildTopic({
            type,

            ownerId:
                owner.id,

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
// UPDATE EMBED CLAIM
// ======================================================

async function updateTicketClaimEmbed(
    channel,
    metadata,
    claimedBy
) {
    if (
        !metadata.messageId
    ) {
        return;
    }

    const message =
        await channel.messages.fetch(
            metadata.messageId
        ).catch(
            () => null
        );

    if (
        !message ||
        !message.embeds.length
    ) {
        return;
    }

    const embed =
        EmbedBuilder.from(
            message.embeds[0]
        );

    const fields =
        embed.data.fields ||
        [];

    const claimIndex =
        fields.findIndex(
            field =>
                field.name ===
                "🛠️ Prise en charge"
        );

    if (
        claimIndex >=
        0
    ) {
        fields[
            claimIndex
        ].value =
            `<@${claimedBy}>`;
    }

    embed.setFields(
        fields
    );

    await message.edit({
        embeds: [
            embed
        ],

        components: [
            createTicketButtons()
        ]
    });
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
                // SELECT PANEL
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
                        interaction.values[
                            0
                        ];

                    await createTicket(
                        interaction,
                        type
                    );

                    return;
                }

                // ==================================================
                // LE RESTE NÉCESSITE UN TICKET
                // ==================================================

                const metadata =
                    parseTopic(
                        interaction.channel?.topic
                    );

                // ==================================================
                // CLAIM
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_claim"
                ) {
                    if (
                        !metadata
                    ) {
                        return;
                    }

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

                    // Déjà pris
                    if (
                        metadata.claimedBy
                    ) {
                        if (
                            metadata.claimedBy ===
                            interaction.user.id
                        ) {
                            return interaction.reply({
                                content:
                                    "✅ Tu as déjà pris en charge ce ticket.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        return interaction.reply({
                            content:
                                `❌ Ce ticket est déjà pris en charge par <@${metadata.claimedBy}>.`,

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    metadata.claimedBy =
                        interaction.user.id;

                    await interaction.channel.setTopic(
                        buildTopic({
                            type:
                                metadata.type,

                            ownerId:
                                metadata.ownerId,

                            claimedBy:
                                interaction.user.id,

                            messageId:
                                metadata.messageId
                        })
                    );

                    await updateTicketClaimEmbed(
                        interaction.channel,
                        metadata,
                        interaction.user.id
                    );

                    await interaction.channel.send({
                        content:
                            `🛠️ Ce ticket est désormais pris en charge par <@${interaction.user.id}>.`
                    });

                    await logTicketClaim(
                        interaction.guild,
                        interaction.channel,
                        interaction.user
                    );

                    return interaction.editReply({
                        content:
                            "✅ Tu as pris en charge ce ticket."
                    });
                }

                // ==================================================
                // RENAME
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_rename"
                ) {
                    if (
                        !metadata
                    ) {
                        return;
                    }

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
                            .setMaxLength(
                                90
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
                // RENAME MODAL
                // ==================================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId ===
                        "legacy_ticket_rename_modal"
                ) {
                    if (
                        !metadata
                    ) {
                        return;
                    }

                    if (
                        !isTicketStaff(
                            interaction.member,
                            metadata.type
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Tu n'as pas la permission.",

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
                                "❌ Nom invalide."
                        });
                    }

                    const oldName =
                        interaction.channel.name;

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
                // CLOSE
                // UTILISABLE PAR TOUS CEUX QUI VOIENT LE TICKET
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close"
                ) {
                    if (
                        !metadata
                    ) {
                        return;
                    }

                    return interaction.reply({
                        content:
                            "⚠️ Es-tu sûr de vouloir fermer ce ticket ?",

                        components: [
                            createCloseConfirmButtons()
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==================================================
                // ANNULER CLOSE
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close_cancel"
                ) {
                    return interaction.update({
                        content:
                            "✅ Fermeture annulée.",

                        components:
                            []
                    });
                }

                // ==================================================
                // CONFIRMER CLOSE
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        "legacy_ticket_close_confirm"
                ) {
                    if (
                        !metadata
                    ) {
                        return;
                    }

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
                    // MESSAGE
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

-# Fermeture du salon dans quelques secondes...`
                                )
                                .setTimestamp()
                        ]
                    }).catch(
                        () => {}
                    );

                    // ==================================================
                    // DELETE
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
                        await interaction.editReply({
                            content:
                                "❌ Une erreur est survenue avec le système de tickets."
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