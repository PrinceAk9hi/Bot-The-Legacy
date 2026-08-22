const fs = require("fs");
const path = require("path");

const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR = path.join(
    __dirname,
    "..",
    "data"
);

const CONFIG_FILE = path.join(
    DATA_DIR,
    "logsConfig.json"
);

// ======================================================
// CONFIGURATION DES SALONS
// ======================================================

const LOG_CHANNELS = {
    commands: "logs-commandes",
    rank: "logs-rank",
    moderation: "logs-moderation",
    controls: "logs-ch-mn",
    test: "logs-test",
    tpv: "logs-tpv",
    recruitment: "logs-recrutement",
    roblox: "logs-roblox",
    voice: "logs-vocaux",
    system: "logs-systeme"
};

// ======================================================
// ROUTAGE AUTOMATIQUE DES COMMANDES
// ======================================================

const COMMAND_ROUTES = {
    rank: "rank",
    derank: "rank",

    ban: "moderation",
    kick: "moderation",
    mute: "moderation",

    ch: "controls",
    uch: "controls",
    mn: "controls",
    umn: "controls",

    test: "test",
    fintest: "test",

    setuptpv: "tpv",

    entretien: "recruitment",
    join: "recruitment",
    setupcandidature: "recruitment",

    link: "roblox",

    update: "system",
    setuplogs: "system",
    setupstats: "system",
    setupinfos: "system",
    sync: "system",
    setlogs: "system"
};

// ======================================================
// MÉMOIRE
// ======================================================

const configMap = new Map();

// ======================================================
// FICHIERS
// ======================================================

function ensureFiles() {
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
            CONFIG_FILE
        )
    ) {
        fs.writeFileSync(
            CONFIG_FILE,
            "{}",
            "utf8"
        );
    }
}

function readConfig() {
    ensureFiles();

    try {
        const raw = fs.readFileSync(
            CONFIG_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return {};
        }

        return JSON.parse(
            raw
        );

    } catch (error) {
        console.error(
            "❌ Lecture logsConfig.json :",
            error
        );

        return {};
    }
}

function saveConfigs() {
    ensureFiles();

    try {
        fs.writeFileSync(
            CONFIG_FILE,
            JSON.stringify(
                Object.fromEntries(
                    configMap.entries()
                ),
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde logsConfig.json :",
            error
        );

        return false;
    }
}

function loadConfigs() {
    configMap.clear();

    const data = readConfig();

    for (
        const [
            guildId,
            config
        ]
        of Object.entries(
            data
        )
    ) {
        configMap.set(
            guildId,
            config
        );
    }
}

// ======================================================
// OPTIONS D'UNE COMMANDE
// ======================================================

function formatOptionValue(
    option
) {
    if (
        option.value === undefined ||
        option.value === null
    ) {
        return null;
    }

    switch (
        option.type
    ) {
        // USER
        case 6:
            return `<@${option.value}> • \`${option.value}\``;

        // CHANNEL
        case 7:
            return `<#${option.value}> • \`${option.value}\``;

        // ROLE
        case 8:
            return `<@&${option.value}> • \`${option.value}\``;

        // MENTIONABLE
        case 9:
            return `\`${option.value}\``;

        default:
            return `\`${String(option.value)}\``;
    }
}

function flattenOptions(
    options,
    depth = 0
) {
    if (
        !Array.isArray(options) ||
        options.length === 0
    ) {
        return [];
    }

    const lines = [];

    for (
        const option
        of options
    ) {
        // SUBCOMMAND / GROUP
        if (
            Array.isArray(
                option.options
            )
        ) {
            lines.push(
                `${"  ".repeat(depth)}**↳ ${option.name}**`
            );

            lines.push(
                ...flattenOptions(
                    option.options,
                    depth + 1
                )
            );

            continue;
        }

        const value =
            formatOptionValue(
                option
            );

        if (
            value !== null
        ) {
            lines.push(
                `${"  ".repeat(depth)}• **${option.name} :** ${value}`
            );
        }
    }

    return lines;
}

// ======================================================
// COMMANDE COMPLÈTE
// ======================================================

function buildCommandText(
    interaction
) {
    let text =
        `/${interaction.commandName}`;

    function append(
        options
    ) {
        if (
            !Array.isArray(
                options
            )
        ) {
            return;
        }

        for (
            const option
            of options
        ) {
            if (
                Array.isArray(
                    option.options
                )
            ) {
                text +=
                    ` ${option.name}`;

                append(
                    option.options
                );

                continue;
            }

            if (
                option.value !== undefined
            ) {
                text +=
                    ` ${option.name}:${option.value}`;
            }
        }
    }

    append(
        interaction.options?.data
    );

    return text.slice(
        0,
        1000
    );
}

// ======================================================
// RÉCUPÉRATION CONFIG
// ======================================================

function getGuildConfig(
    guildId
) {
    return configMap.get(
        guildId
    ) || null;
}

// ======================================================
// RÉCUPÉRATION SALON
// ======================================================

async function getLogChannel(
    guild,
    key
) {
    const config =
        getGuildConfig(
            guild.id
        );

    if (
        !config ||
        !config.channels
    ) {
        return null;
    }

    const channelId =
        config.channels[
            key
        ];

    if (!channelId) {
        return null;
    }

    let channel =
        guild.channels.cache.get(
            channelId
        );

    if (!channel) {
        channel =
            await guild.channels
                .fetch(
                    channelId
                )
                .catch(
                    () => null
                );
    }

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return null;
    }

    return channel;
}

// ======================================================
// ENVOI
// ======================================================

async function sendEmbed(
    guild,
    key,
    embed
) {
    const channel =
        await getLogChannel(
            guild,
            key
        );

    if (!channel) {
        return false;
    }

    await channel.send({
        embeds: [
            embed
        ]
    }).catch(
        error => {
            console.error(
                `❌ Logs ${key} :`,
                error
            );
        }
    );

    return true;
}

// ======================================================
// SETUP
// ======================================================

async function setupGuild(
    guild,
    creatorId,
    accessRoleId = null
) {
    let existingConfig =
        getGuildConfig(
            guild.id
        ) || {};

    let category =
        existingConfig.categoryId
            ? guild.channels.cache.get(
                existingConfig.categoryId
            )
            : null;

    // ==================================================
    // RECHERCHE CATÉGORIE EXISTANTE
    // ==================================================

    if (!category) {
        category =
            guild.channels.cache.find(
                channel =>
                    channel.type ===
                        ChannelType.GuildCategory &&
                    channel.name ===
                        "📁 LOGS THE LEGACY"
            );
    }

    // ==================================================
    // CRÉATION CATÉGORIE
    // ==================================================

    if (!category) {
        const overwrites = [
            {
                id:
                    guild.roles.everyone.id,

                deny: [
                    PermissionFlagsBits
                        .ViewChannel
                ]
            },

            {
                id:
                    creatorId,

                allow: [
                    PermissionFlagsBits
                        .ViewChannel,

                    PermissionFlagsBits
                        .ReadMessageHistory
                ]
            }
        ];

        if (
            accessRoleId
        ) {
            overwrites.push({
                id:
                    accessRoleId,

                allow: [
                    PermissionFlagsBits
                        .ViewChannel,

                    PermissionFlagsBits
                        .ReadMessageHistory
                ]
            });
        }

        if (
            guild.members.me
        ) {
            overwrites.push({
                id:
                    guild.members.me.id,

                allow: [
                    PermissionFlagsBits
                        .ViewChannel,

                    PermissionFlagsBits
                        .SendMessages,

                    PermissionFlagsBits
                        .EmbedLinks,

                    PermissionFlagsBits
                        .ReadMessageHistory,

                    PermissionFlagsBits
                        .ManageChannels
                ]
            });
        }

        category =
            await guild.channels.create({
                name:
                    "📁 LOGS THE LEGACY",

                type:
                    ChannelType.GuildCategory,

                permissionOverwrites:
                    overwrites,

                reason:
                    "Installation du système de logs The Legacy"
            });
    }

    // ==================================================
    // SI UN RÔLE D'ACCÈS EST FOURNI
    // ==================================================

    if (
        accessRoleId
    ) {
        await category
            .permissionOverwrites
            .edit(
                accessRoleId,
                {
                    ViewChannel:
                        true,

                    ReadMessageHistory:
                        true
                }
            )
            .catch(
                () => {}
            );
    }

    // Toujours donner accès au créateur
    await category
        .permissionOverwrites
        .edit(
            creatorId,
            {
                ViewChannel:
                    true,

                ReadMessageHistory:
                    true
            }
        )
        .catch(
            () => {}
        );

    const channels = {};

    // ==================================================
    // SALONS
    // ==================================================

    for (
        const [
            key,
            channelName
        ]
        of Object.entries(
            LOG_CHANNELS
        )
    ) {
        let channel = null;

        const savedId =
            existingConfig
                ?.channels
                ?.[key];

        if (
            savedId
        ) {
            channel =
                guild.channels.cache.get(
                    savedId
                );
        }

        if (!channel) {
            channel =
                guild.channels.cache.find(
                    candidate =>
                        candidate.parentId ===
                            category.id &&
                        candidate.name ===
                            channelName
                );
        }

        if (!channel) {
            channel =
                await guild.channels.create({
                    name:
                        channelName,

                    type:
                        ChannelType.GuildText,

                    parent:
                        category.id,

                    reason:
                        "Installation du système de logs The Legacy"
                });
        }

        // Resynchronise les permissions avec la catégorie
        await channel
            .lockPermissions()
            .catch(
                () => {}
            );

        channels[
            key
        ] =
            channel.id;
    }

    const config = {
        categoryId:
            category.id,

        channels,

        accessRoleId:
            accessRoleId ||
            existingConfig.accessRoleId ||
            null,

        installedBy:
            creatorId,

        installedAt:
            existingConfig.installedAt ||
            Date.now(),

        updatedAt:
            Date.now()
    };

    configMap.set(
        guild.id,
        config
    );

    saveConfigs();

    return {
        category,
        channels,
        config
    };
}

// ======================================================
// LOG COMMANDE
// ======================================================

async function logCommand(
    interaction,
    {
        status = "success",
        error = null,
        durationMs = null,
        note = null
    } = {}
) {
    if (
        !interaction.guild
    ) {
        return;
    }

    const config =
        getGuildConfig(
            interaction.guild.id
        );

    if (!config) {
        return;
    }

    let color =
        0x57F287;

    let statusText =
        "✅ Succès";

    if (
        status ===
        "error"
    ) {
        color =
            0xED4245;

        statusText =
            "❌ Erreur";
    }

    if (
        status ===
        "blocked"
    ) {
        color =
            0xFEE75C;

        statusText =
            "🛡️ Bloquée";
    }

    const optionLines =
        flattenOptions(
            interaction.options
                ?.data || []
        );

    const channel =
        interaction.channel;

    const fields = [
        {
            name:
                "👤 Exécutant",

            value:
                `<@${interaction.user.id}>\n\`${interaction.user.id}\``,

            inline:
                true
        },

        {
            name:
                "📜 Commande",

            value:
                `\`${interaction.commandName}\``,

            inline:
                true
        },

        {
            name:
                "📌 Statut",

            value:
                statusText,

            inline:
                true
        },

        {
            name:
                "📍 Salon",

            value:
                channel
                    ? `<#${channel.id}>\n\`${channel.id}\``
                    : "Inconnu",

            inline:
                true
        },

        {
            name:
                "📁 Catégorie",

            value:
                channel?.parent
                    ? `${channel.parent.name}\n\`${channel.parent.id}\``
                    : "Aucune",

            inline:
                true
        },

        {
            name:
                "⏱️ Temps",

            value:
                durationMs !== null
                    ? `\`${durationMs} ms\``
                    : "Non mesuré",

            inline:
                true
        }
    ];

    if (
        optionLines.length
    ) {
        fields.push({
            name:
                "⚙️ Options",

            value:
                optionLines
                    .join("\n")
                    .slice(
                        0,
                        1024
                    ),

            inline:
                false
        });
    }

    fields.push({
        name:
            "💻 Commande complète",

        value:
            `\`${buildCommandText(interaction)}\``,

        inline:
            false
    });

    if (
        note
    ) {
        fields.push({
            name:
                "📝 Information",

            value:
                String(note)
                    .slice(
                        0,
                        1024
                    ),

            inline:
                false
        });
    }

    if (
        error
    ) {
        fields.push({
            name:
                "⚠️ Erreur",

            value:
                `\`\`\`${String(
                    error.message ||
                    error
                ).slice(
                    0,
                    900
                )}\`\`\``,

            inline:
                false
        });
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                color
            )
            .setTitle(
                status === "success"
                    ? "📜 Commande exécutée"
                    : status === "blocked"
                        ? "🛡️ Commande bloquée"
                        : "❌ Erreur de commande"
            )
            .addFields(
                fields
            )
            .setFooter({
                text:
                    `The Legacy • ${interaction.guild.name}`
            })
            .setTimestamp();

    // ==================================================
    // LOG GÉNÉRAL
    // ==================================================

    await sendEmbed(
        interaction.guild,
        "commands",
        embed
    );

    // ==================================================
    // LOG SPÉCIALISÉ
    // ==================================================

    const route =
        COMMAND_ROUTES[
            interaction.commandName
        ];

    if (
        route &&
        route !==
            "commands"
    ) {
        await sendEmbed(
            interaction.guild,
            route,
            EmbedBuilder.from(
                embed
            )
        );
    }
}

// ======================================================
// LOG SPÉCIAL
// ======================================================

async function logSpecial(
    guild,
    key,
    {
        title,
        description = null,
        fields = [],
        color = 0x5865F2,
        footer = "The Legacy • Logs"
    }
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                color
            )
            .setTitle(
                title
            )
            .setTimestamp();

    if (
        description
    ) {
        embed.setDescription(
            description
        );
    }

    if (
        fields.length
    ) {
        embed.addFields(
            fields
        );
    }

    embed.setFooter({
        text:
            footer
    });

    return sendEmbed(
        guild,
        key,
        embed
    );
}

// ======================================================
// LOG SYSTÈME POUR TOUS LES SERVEURS CONFIGURÉS
// ======================================================

async function logSystemAll(
    client,
    title,
    description,
    color = 0x5865F2
) {
    for (
        const [
            guildId
        ]
        of configMap
    ) {
        const guild =
            client.guilds.cache.get(
                guildId
            );

        if (!guild) {
            continue;
        }

        await logSpecial(
            guild,
            "system",
            {
                title,
                description,
                color
            }
        ).catch(
            () => {}
        );
    }
}

// ======================================================
// REGISTER
// ======================================================

function registerLogsSystem(
    client
) {
    ensureFiles();
    loadConfigs();

    client.logs = {
        setupGuild,
        logCommand,
        logSpecial,
        logSystemAll,

        getConfig:
            guildId =>
                getGuildConfig(
                    guildId
                ),

        save:
            saveConfigs
    };

    client.once(
        "clientReady",
        async () => {
            console.log(
                `📜 Logs : ${configMap.size} serveur(s) configuré(s)`
            );

            await logSystemAll(
                client,
                "🟢 Bot démarré",
                [
                    `**Bot :** ${client.user}`,
                    `**ID :** \`${client.user.id}\``,
                    "",
                    "Le bot vient de démarrer ou d'être redéployé."
                ].join("\n"),
                0x57F287
            ).catch(
                () => {}
            );
        }
    );
}

module.exports =
    registerLogsSystem;