const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const STATUS_CHANNEL_ID =
    "1541093908128338081";

const COLOR =
    0x3B6475;

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const MAINTENANCE_FILE =
    path.join(
        DATA_DIR,
        "maintenance.json"
    );

// ======================================================
// SERVICES
// ======================================================

const SERVICES = {
    bot: {
        label:
            "Bot Discord",

        emoji:
            "🤖"
    },

    tempvoice: {
        label:
            "Salons Vocaux Temporaires",

        emoji:
            "🎙️"
    },

    recrutement: {
        label:
            "Système de recrutement",

        emoji:
            "📨"
    },

    stats: {
        label:
            "Statistiques",

        emoji:
            "📊"
    },

    roblox: {
        label:
            "Liaison Roblox",

        emoji:
            "🔗"
    },

    admin: {
        label:
            "Administration",

        emoji:
            "🛡️"
    },

    fun: {
        label:
            "Commandes fun",

        emoji:
            "🎮"
    }
};

// ======================================================
// ÉTATS
// ======================================================

const STATUS_CONFIG = {
    operationnel: {
        label:
            "Opérationnel",

        emoji:
            "🟢",

        color:
            0x57F287
    },

    degrade: {
        label:
            "Dégradé",

        emoji:
            "🟠",

        color:
            0xFEE75C
    },

    maintenance: {
        label:
            "Maintenance",

        emoji:
            "🔴",

        color:
            0xED4245
    }
};

// ======================================================
// COMMANDES PAR SERVICE
// ======================================================

const SERVICE_COMMANDS = {
    recrutement: [
        "entretien",
        "fintest",
        "join",
        "leave",
        "setupcandidature",
        "setupinfos"
    ],

    tempvoice: [
        "setuptpv"
    ],

    stats: [
        "analyse",
        "setupstats"
    ],

    roblox: [
        "link",
        "seelink"
    ],

    admin: [
        "ban",
        "kick",
        "mute",
        "rank",
        "derank",
        "mrankup",
        "del",
        "sync",
        "mv",
        "back"
    ],

    fun: [
        "wanted",
        "ship",
        "union",
        "tribunal",
        "imposteur",
        "legacygames",
        "loupgarou"
    ]
};

// ======================================================
// COMMANDES TOUJOURS AUTORISÉES
// ======================================================

const ALWAYS_ALLOWED_COMMANDS = [
    "maintenance",
    "rollback",
    "update"
];

// ======================================================
// DEFAULT DATA
// ======================================================

function createDefaultData() {
    const services =
        {};

    for (
        const key
        of Object.keys(
            SERVICES
        )
    ) {
        services[key] = {
            status:
                "operationnel",

            reason:
                null,

            since:
                null,

            by:
                null
        };
    }

    return {
        version:
            1,

        services,

        panel: {
            guildId:
                null,

            channelId:
                STATUS_CHANNEL_ID,

            messageId:
                null
        },

        updatedAt:
            Date.now()
    };
}

// ======================================================
// FILES
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
            MAINTENANCE_FILE
        )
    ) {
        fs.writeFileSync(
            MAINTENANCE_FILE,
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

function loadMaintenance() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                MAINTENANCE_FILE,
                "utf8"
            );

        const parsed =
            raw.trim()
                ? JSON.parse(
                    raw
                )
                : createDefaultData();

        if (
            !parsed.services
        ) {
            parsed.services =
                {};
        }

        for (
            const key
            of Object.keys(
                SERVICES
            )
        ) {
            if (
                !parsed.services[
                    key
                ]
            ) {
                parsed.services[
                    key
                ] = {
                    status:
                        "operationnel",

                    reason:
                        null,

                    since:
                        null,

                    by:
                        null
                };
            }
        }

        if (
            !parsed.panel
        ) {
            parsed.panel = {
                guildId:
                    null,

                channelId:
                    STATUS_CHANNEL_ID,

                messageId:
                    null
            };
        }

        parsed.panel.channelId =
            STATUS_CHANNEL_ID;

        return parsed;

    } catch (error) {
        console.error(
            "❌ Chargement maintenance.json :",
            error
        );

        return createDefaultData();
    }
}

// ======================================================
// SAVE
// ======================================================

function saveMaintenance(
    data
) {
    ensureFile();

    try {
        data.updatedAt =
            Date.now();

        fs.writeFileSync(
            MAINTENANCE_FILE,
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
            "❌ Sauvegarde maintenance.json :",
            error
        );

        return false;
    }
}

// ======================================================
// GET STATUS
// ======================================================

function getMaintenanceData() {
    return loadMaintenance();
}

// ======================================================
// SET SERVICE STATUS
// ======================================================

function setServiceStatus({
    service,
    status,
    reason,
    userId
}) {
    const data =
        loadMaintenance();

    const serviceData =
        data.services[
            service
        ];

    if (
        !serviceData
    ) {
        return null;
    }

    serviceData.status =
        status;

    if (
        status ===
        "operationnel"
    ) {
        serviceData.reason =
            null;

        serviceData.since =
            null;

        serviceData.by =
            null;

    } else {
        serviceData.reason =
            reason ||
            "Aucune raison précisée.";

        serviceData.since =
            Date.now();

        serviceData.by =
            userId;
    }

    saveMaintenance(
        data
    );

    return data;
}

// ======================================================
// SET ALL
// ======================================================

function setAllServices({
    status,
    reason,
    userId
}) {
    const data =
        loadMaintenance();

    for (
        const key
        of Object.keys(
            SERVICES
        )
    ) {
        data.services[
            key
        ].status =
            status;

        if (
            status ===
            "operationnel"
        ) {
            data.services[
                key
            ].reason =
                null;

            data.services[
                key
            ].since =
                null;

            data.services[
                key
            ].by =
                null;

        } else {
            data.services[
                key
            ].reason =
                reason ||
                "Aucune raison précisée.";

            data.services[
                key
            ].since =
                Date.now();

            data.services[
                key
            ].by =
                userId;
        }
    }

    saveMaintenance(
        data
    );

    return data;
}

// ======================================================
// SERVICE STATUS DISPLAY
// ======================================================

function getServiceDisplay(
    serviceKey,
    serviceData
) {
    const config =
        SERVICES[
            serviceKey
        ];

    const statusConfig =
        STATUS_CONFIG[
            serviceData.status
        ] ||
        STATUS_CONFIG.operationnel;

    let text =
        `${config.emoji} **${config.label}**\n`;

    text +=
        `${statusConfig.emoji} ${statusConfig.label}`;

    if (
        serviceData.status !==
        "operationnel"
    ) {
        if (
            serviceData.reason
        ) {
            text +=
                `\n> ${serviceData.reason}`;
        }

        if (
            serviceData.since
        ) {
            text +=
                `\n> Depuis <t:${Math.floor(
                    serviceData.since /
                    1000
                )}:R>`;
        }
    }

    return text;
}

// ======================================================
// GLOBAL STATUS
// ======================================================

function getGlobalStatus(
    data
) {
    const statuses =
        Object
            .values(
                data.services
            )
            .map(
                service =>
                    service.status
            );

    if (
        statuses.includes(
            "maintenance"
        )
    ) {
        return {
            label:
                "Maintenance partielle",

            emoji:
                "🔴",

            color:
                0xED4245
        };
    }

    if (
        statuses.includes(
            "degrade"
        )
    ) {
        return {
            label:
                "Services dégradés",

            emoji:
                "🟠",

            color:
                0xFEE75C
        };
    }

    return {
        label:
            "Tous les systèmes opérationnels",

        emoji:
            "🟢",

        color:
            COLOR
    };
}

// ======================================================
// BUILD STATUS EMBED
// ======================================================

function buildStatusEmbed(
    guild
) {
    const data =
        loadMaintenance();

    const global =
        getGlobalStatus(
            data
        );

    const serviceBlocks =
        Object
            .keys(
                SERVICES
            )
            .map(
                key =>
                    getServiceDisplay(
                        key,
                        data.services[
                            key
                        ]
                    )
            );

    const activeIssues =
        Object
            .entries(
                data.services
            )
            .filter(
                (
                    [
                        ,
                        service
                    ]
                ) =>
                    service.status !==
                    "operationnel"
            );

    let footerText =
        "The Legacy • État des services";

    if (
        activeIssues.length
    ) {
        footerText +=
            ` • ${activeIssues.length} service(s) affecté(s)`;
    }

    return new EmbedBuilder()
        .setColor(
            global.color
        )

        .setAuthor({
            name:
                "THE LEGACY • STATUT DES SERVICES",

            iconURL:
                guild
                    ?.iconURL({
                        size:
                            256
                    }) ||
                undefined
        })

        .setTitle(
            `${global.emoji} ${global.label}`
        )

        .setDescription(
            [
                "> Suivi en temps réel de l'état des différents systèmes de **The Legacy**.",
                "",
                serviceBlocks.join(
                    "\n\n"
                ),
                "",
                "━━━━━━━━━━━━━━━━━━━━",
                "",
                activeIssues.length
                    ? "⚠️ **Certains services rencontrent actuellement des perturbations.**"
                    : "✅ **Tous les services fonctionnent normalement.**"
            ].join(
                "\n"
            )
        )

        .setFooter({
            text:
                footerText
        })

        .setTimestamp();
}

// ======================================================
// GET STATUS CHANNEL
// ======================================================

async function getStatusChannel(
    guild
) {
    const channel =
        guild.channels.cache.get(
            STATUS_CHANNEL_ID
        ) ||
        await guild.channels
            .fetch(
                STATUS_CHANNEL_ID
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

    return channel;
}

// ======================================================
// CREATE / UPDATE PANEL
// ======================================================

async function refreshMaintenancePanel(
    guild
) {
    const data =
        loadMaintenance();

    const channel =
        await getStatusChannel(
            guild
        );

    if (
        !channel
    ) {
        return {
            success:
                false,

            reason:
                "Salon de statut introuvable."
        };
    }

    let message =
        null;

    // ==================================================
    // ANCIEN MESSAGE
    // ==================================================

    if (
        data.panel.messageId
    ) {
        message =
            await channel.messages
                .fetch(
                    data.panel.messageId
                )
                .catch(
                    () => null
                );
    }

    // ==================================================
    // CRÉATION
    // ==================================================

    if (
        !message
    ) {
        message =
            await channel.send({
                embeds: [
                    buildStatusEmbed(
                        guild
                    )
                ]
            });

        data.panel.guildId =
            guild.id;

        data.panel.channelId =
            channel.id;

        data.panel.messageId =
            message.id;

        saveMaintenance(
            data
        );

        return {
            success:
                true,

            created:
                true,

            message
        };
    }

    // ==================================================
    // UPDATE
    // ==================================================

    await message.edit({
        embeds: [
            buildStatusEmbed(
                guild
            )
        ]
    });

    return {
        success:
            true,

        created:
            false,

        message
    };
}

// ======================================================
// COMMAND -> SERVICE
// ======================================================

function getServiceForCommand(
    commandName
) {
    for (
        const [
            service,
            commands
        ]
        of Object.entries(
            SERVICE_COMMANDS
        )
    ) {
        if (
            commands.includes(
                commandName
            )
        ) {
            return service;
        }
    }

    return null;
}

// ======================================================
// COMMAND BLOCK CHECK
// ======================================================

function checkCommandMaintenance(
    commandName
) {
    if (
        ALWAYS_ALLOWED_COMMANDS.includes(
            commandName
        )
    ) {
        return {
            blocked:
                false
        };
    }

    const data =
        loadMaintenance();

    // ==================================================
    // BOT GLOBAL
    // ==================================================

    const botStatus =
        data.services.bot;

    if (
        botStatus.status ===
        "maintenance"
    ) {
        return {
            blocked:
                true,

            service:
                "bot",

            serviceLabel:
                SERVICES.bot.label,

            status:
                botStatus.status,

            reason:
                botStatus.reason,

            since:
                botStatus.since
        };
    }

    // ==================================================
    // SERVICE SPÉCIFIQUE
    // ==================================================

    const service =
        getServiceForCommand(
            commandName
        );

    if (
        !service
    ) {
        return {
            blocked:
                false
        };
    }

    const serviceData =
        data.services[
            service
        ];

    if (
        serviceData.status ===
        "maintenance"
    ) {
        return {
            blocked:
                true,

            service,

            serviceLabel:
                SERVICES[
                    service
                ].label,

            status:
                serviceData.status,

            reason:
                serviceData.reason,

            since:
                serviceData.since
        };
    }

    return {
        blocked:
            false,

        degraded:
            serviceData.status ===
            "degrade",

        service,

        serviceLabel:
            SERVICES[
                service
            ].label,

        reason:
            serviceData.reason,

        since:
            serviceData.since
    };
}

// ======================================================
// BUILD BLOCKED EMBED
// ======================================================

function buildMaintenanceBlockedEmbed(
    result
) {
    return new EmbedBuilder()
        .setColor(
            0xED4245
        )
        .setTitle(
            "🛠️ Service actuellement en maintenance"
        )
        .setDescription(
`Cette commande est temporairement indisponible.

**Service concerné :**
${result.serviceLabel}

**État :**
🔴 Maintenance

**Raison :**
${result.reason || "Aucune raison précisée."}

${result.since
    ? `**Depuis :** <t:${Math.floor(
        result.since /
        1000
    )}:R>`
    : ""}

-# The Legacy • Merci de patienter.`
        )
        .setTimestamp();
}

// ======================================================
// PRESENCE
// ======================================================

function updateBotPresence(
    client
) {
    const data =
        loadMaintenance();

    const botService =
        data.services.bot;

    if (
        botService.status ===
        "maintenance"
    ) {
        client.user.setPresence({
            status:
                "dnd",

            activities: [
                {
                    name:
                        "🛠️ Maintenance The Legacy",

                    type:
                        4
                }
            ]
        });

        return;
    }

    if (
        botService.status ===
        "degrade"
    ) {
        client.user.setPresence({
            status:
                "idle",

            activities: [
                {
                    name:
                        "⚠️ Services dégradés",

                    type:
                        4
                }
            ]
        });

        return;
    }

    client.user.setPresence({
        status:
            "dnd",

        activities: [
            {
                name:
                    "The Legacy",

                type:
                    4
            }
        ]
    });
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "maintenance"
            )
            .setDescription(
                "Gérer l'état des services de The Legacy"
            )

            .addStringOption(option =>
                option
                    .setName(
                        "service"
                    )
                    .setDescription(
                        "Service à modifier"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        {
                            name:
                                "🤖 Bot Discord",

                            value:
                                "bot"
                        },

                        {
                            name:
                                "🎙️ Salons Vocaux Temporaires",

                            value:
                                "tempvoice"
                        },

                        {
                            name:
                                "📨 Système de recrutement",

                            value:
                                "recrutement"
                        },

                        {
                            name:
                                "📊 Statistiques",

                            value:
                                "stats"
                        },

                        {
                            name:
                                "🔗 Liaison Roblox",

                            value:
                                "roblox"
                        },

                        {
                            name:
                                "🛡️ Administration",

                            value:
                                "admin"
                        },

                        {
                            name:
                                "🎮 Commandes fun",

                            value:
                                "fun"
                        },

                        {
                            name:
                                "🌐 Tous les services",

                            value:
                                "tout"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "etat"
                    )
                    .setDescription(
                        "Nouvel état du service"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        {
                            name:
                                "🟢 Opérationnel",

                            value:
                                "operationnel"
                        },

                        {
                            name:
                                "🟠 Dégradé",

                            value:
                                "degrade"
                        },

                        {
                            name:
                                "🔴 Maintenance",

                            value:
                                "maintenance"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "raison"
                    )
                    .setDescription(
                        "Raison de la maintenance ou du mode dégradé"
                    )
                    .setRequired(
                        false
                    )
                    .setMaxLength(
                        500
                    )
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            const allowed =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                );

            if (
                !allowed
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission de modifier l'état des services."
                });
            }

            // ==================================================
            // OPTIONS
            // ==================================================

            const service =
                interaction.options
                    .getString(
                        "service"
                    );

            const status =
                interaction.options
                    .getString(
                        "etat"
                    );

            const reason =
                interaction.options
                    .getString(
                        "raison"
                    );

            // ==================================================
            // RAISON OBLIGATOIRE SI PAS OPÉRATIONNEL
            // ==================================================

            if (
                status !==
                    "operationnel" &&
                !reason
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu dois préciser une `raison` pour mettre un service en maintenance ou en mode dégradé."
                });
            }

            // ==================================================
            // UPDATE
            // ==================================================

            if (
                service ===
                "tout"
            ) {
                setAllServices({
                    status,
                    reason,
                    userId:
                        interaction.user.id
                });

            } else {
                setServiceStatus({
                    service,
                    status,
                    reason,
                    userId:
                        interaction.user.id
                });
            }

            // ==================================================
            // PRESENCE
            // ==================================================

            updateBotPresence(
                interaction.client
            );

            // ==================================================
            // PANEL
            // ==================================================

            const panelResult =
                await refreshMaintenancePanel(
                    interaction.guild
                );

            // ==================================================
            // STATUS
            // ==================================================

            const statusConfig =
                STATUS_CONFIG[
                    status
                ];

            const serviceLabel =
                service ===
                    "tout"
                    ? "Tous les services"
                    : SERVICES[
                        service
                    ].label;

            // ==================================================
            // EMBED RESULT
            // ==================================================

            const embed =
                new EmbedBuilder()
                    .setColor(
                        statusConfig.color
                    )
                    .setTitle(
                        `${statusConfig.emoji} État des services modifié`
                    )
                    .setDescription(
`**Service :**
${serviceLabel}

**Nouvel état :**
${statusConfig.emoji} ${statusConfig.label}

${status !== "operationnel"
    ? `**Raison :**
${reason}`
    : "✅ Le service est de nouveau disponible normalement."}

**Modifié par :**
<@${interaction.user.id}>

${panelResult.success
    ? `📡 Le panneau de statut a été actualisé dans <#${STATUS_CHANNEL_ID}>.`
    : "⚠️ Le panneau permanent n'a pas pu être actualisé."}`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Maintenance"
                    })
                    .setTimestamp();

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
                                "🛠️ État d'un service modifié",

                            description:
`**Service :** ${serviceLabel}
**État :** ${statusConfig.label}
**Raison :** ${reason || "Aucune"}
**Par :** <@${interaction.user.id}>`,

                            color:
                                statusConfig.color
                        }
                    )
                    .catch(
                        () => {}
                    );
            }

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });

        } catch (error) {
            console.error(
                "❌ /maintenance :",
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
    // EXPORTS POUR L'INDEX FINAL
    // ==================================================

    maintenanceSystem: {
        SERVICES,
        STATUS_CONFIG,
        SERVICE_COMMANDS,
        ALWAYS_ALLOWED_COMMANDS,

        getMaintenanceData,
        setServiceStatus,
        setAllServices,

        getServiceForCommand,
        checkCommandMaintenance,

        buildMaintenanceBlockedEmbed,
        buildStatusEmbed,

        refreshMaintenancePanel,
        updateBotPresence
    }
};