require("dotenv").config();

// ======================================================
// VÉRIFICATION ENV
// ======================================================

console.log(
    "TOKEN DISCORD :",
    process.env.TOKEN
        ? "✅ chargé"
        : "❌ absent"
);

console.log(
    "OPENAI API :",
    process.env.OPENAI_API_KEY
        ? "✅ chargée"
        : "❌ absente"
);

console.log(
    "ROBLOX COOKIE :",
    process.env.ROBLOX_COOKIE
        ? "✅ chargé"
        : "❌ absent"
);

console.log(
    "ROBLOX GROUP :",
    process.env.ROBLOX_GROUP_ID
        ? `✅ ${process.env.ROBLOX_GROUP_ID}`
        : "❌ absent"
);

// ======================================================
// IMPORTS
// ======================================================

const fs = require("fs");
const path = require("path");

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    MessageFlags,
    ApplicationCommandOptionType
} = require("discord.js");

// ======================================================
// SYSTÈMES PRINCIPAUX
// ======================================================

const registerLogsSystem =
    require("./systems/logs");

const registerRecruitmentSystem =
    require("./systems/recrutement");

const registerRecruitmentVoiceSystem =
    require("./systems/recrutementVocal");

const registerTempVoiceSystem =
    require("./systems/tempVoice");

const registerRobloxLinkPanel =
    require("./systems/robloxLinkPanel");

const registerActivityStats =
    require("./systems/activityStats");

// ======================================================
// PANEL CANDIDATURE DYNAMIQUE
// ======================================================

const registerCandidaturePanelWatch =
    require("./systems/candidaturePanelWatch");

// ======================================================
// SURVEILLANCE TAG SERVEUR
// ======================================================

const {
    startServerTagWatch
} = require("./systems/serverTagWatch");

// ======================================================
// PERSISTANCE
// ======================================================

const {
    loadControlStates,
    saveControlStates
} = require("./utils/controlStates");

// ======================================================
// COMPTES PROTÉGÉS
// ======================================================

const PROTECTED_USER_IDS =
    new Set([
        "547192186547077130",
        "883087428016046150"
    ]);

function isProtectedUser(
    userId
) {
    return (
        Boolean(userId) &&
        PROTECTED_USER_IDS.has(
            String(userId)
        )
    );
}

// ======================================================
// CLIENT
// ======================================================

const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildPresences
        ],

        presence: {
            status:
                "dnd"
        }
    });

// ======================================================
// STOCKAGES
// ======================================================

client.commands =
    new Collection();

client.chiens =
    new Map();

client.menottes =
    new Map();

client.previousVoice =
    new Map();

client.lockedNames =
    new Map();

// ======================================================
// PROTECTION
// ======================================================

client.protectedUserIds =
    PROTECTED_USER_IDS;

client.isProtectedUser =
    isProtectedUser;

// ======================================================
// PERSISTANCE CH / MN / PSEUDO
// ======================================================

loadControlStates(
    client
);

client.saveControlStates =
    function () {
        return saveControlStates(
            client
        );
    };

// ======================================================
// DOSSIER COMMANDES
// ======================================================

const commandsPath =
    path.join(
        __dirname,
        "commandes"
    );

// ======================================================
// CHARGEMENT COMMANDES
// ======================================================

function loadCommands() {
    const collection =
        new Collection();

    const commandsJSON =
        [];

    let files =
        [];

    try {
        files =
            fs.readdirSync(
                commandsPath
            )
                .filter(
                    file =>
                        file.endsWith(
                            ".js"
                        )
                )
                .sort();

    } catch (error) {
        console.error(
            "❌ Impossible de lire le dossier commandes :",
            error
        );

        client.commands =
            collection;

        return commandsJSON;
    }

    console.log("");

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
        "🔄 Chargement des commandes..."
    );

    for (
        const file
        of files
    ) {
        const filePath =
            path.join(
                commandsPath,
                file
            );

        try {
            delete require.cache[
                require.resolve(
                    filePath
                )
            ];

            const command =
                require(
                    filePath
                );

            if (
                !command?.data ||
                typeof command.execute !==
                    "function"
            ) {
                console.log(
                    `❌ Commande invalide : ${file}`
                );

                continue;
            }

            if (
                !command.data.name
            ) {
                console.log(
                    `❌ Nom de commande absent : ${file}`
                );

                continue;
            }

            collection.set(
                command.data.name,
                command
            );

            commandsJSON.push(
                command.data.toJSON()
            );

            console.log(
                `✅ Commande chargée : ${file} → /${command.data.name}`
            );

            if (
                typeof command.autocomplete ===
                    "function"
            ) {
                console.log(
                    `   ↳ 🔎 Autocomplete détecté pour /${command.data.name}`
                );
            }

        } catch (error) {
            console.error(
                `❌ ${file} :`,
                error
            );
        }
    }

    client.commands =
        collection;

    console.log(
        `📦 ${commandsJSON.length} commande(s) chargée(s)`
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log("");

    return commandsJSON;
}

// ======================================================
// RÉCUPÉRATION MODULE COMMANDE
// ======================================================

function getCommandModule(
    name
) {
    return (
        client.commands.get(
            name
        ) ||
        null
    );
}

// ======================================================
// SYSTÈMES EXPORTÉS PAR LES COMMANDES
// ======================================================

function registerCommandSystems() {
    // ==================================================
    // MAINTENANCE
    // ==================================================

    try {
        const maintenance =
            getCommandModule(
                "maintenance"
            )
                ?.maintenanceSystem;

        maintenance
            ?.register
            ?.(client);

        if (
            maintenance
        ) {
            client.maintenanceSystem =
                maintenance;
        }

    } catch (error) {
        console.error(
            "❌ Register Maintenance :",
            error
        );
    }

    // ==================================================
    // SURVEILLANCE
    // ==================================================

    try {
        const surveillance =
            getCommandModule(
                "surveillance"
            )
                ?.surveillanceSystem;

        surveillance
            ?.register
            ?.(client);

        if (
            surveillance
        ) {
            client.surveillanceSystem =
                surveillance;
        }

    } catch (error) {
        console.error(
            "❌ Register Surveillance :",
            error
        );
    }

    // ==================================================
    // TRIBUNAL
    // ==================================================

    try {
        const tribunal =
            getCommandModule(
                "tribunal"
            )
                ?.tribunalSystem;

        tribunal
            ?.register
            ?.(client);

        if (
            tribunal
        ) {
            client.tribunalSystem =
                tribunal;
        }

    } catch (error) {
        console.error(
            "❌ Register Tribunal :",
            error
        );
    }

    // ==================================================
    // LEGACY GAMES
    // ==================================================

    try {
        const legacyGames =
            getCommandModule(
                "legacygames"
            )
                ?.legacyGamesSystem;

        legacyGames
            ?.register
            ?.(client);

        if (
            legacyGames
        ) {
            client.legacyGamesSystem =
                legacyGames;
        }

    } catch (error) {
        console.error(
            "❌ Register Legacy Games :",
            error
        );
    }

    // ==================================================
    // IMPOSTEUR
    // ==================================================

    try {
        const imposteur =
            getCommandModule(
                "imposteur"
            )
                ?.imposteurSystem;

        imposteur
            ?.register
            ?.(client);

        if (
            imposteur
        ) {
            client.imposteurSystem =
                imposteur;
        }

    } catch (error) {
        console.error(
            "❌ Register Imposteur :",
            error
        );
    }

    // ==================================================
    // LOUP-GAROU
    // ==================================================

    try {
        const loupgarou =
            getCommandModule(
                "loupgarou"
            )
                ?.loupgarouSystem;

        loupgarou
            ?.register
            ?.(client);

        if (
            loupgarou
        ) {
            client.loupgarouSystem =
                loupgarou;
        }

    } catch (error) {
        console.error(
            "❌ Register Loup-Garou :",
            error
        );
    }
}

// ======================================================
// /UPDATE
// ======================================================

client.reloadCommands =
    async function () {
        const commands =
            loadCommands();

        registerCommandSystems();

        const rest =
            new REST({
                version:
                    "10"
            }).setToken(
                process.env.TOKEN
            );

        // ==================================================
        // SUPPRESSION COMMANDES GLOBALES
        // ==================================================

        await rest.put(
            Routes.applicationCommands(
                client.user.id
            ),
            {
                body:
                    []
            }
        );

        let guildCount =
            0;

        // ==================================================
        // COMMANDES SERVEUR
        // ==================================================

        for (
            const guild
            of client.guilds.cache.values()
        ) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(
                        client.user.id,
                        guild.id
                    ),
                    {
                        body:
                            commands
                    }
                );

                guildCount++;

            } catch (error) {
                console.error(
                    `❌ Update ${guild.name} :`,
                    error
                );
            }
        }

        return {
            commands:
                commands.length,

            guilds:
                guildCount
        };
    };

// ======================================================
// LANCEMENT SYSTÈMES PRINCIPAUX
// ======================================================

// Logs
registerLogsSystem(
    client
);

// Candidatures
registerRecruitmentSystem(
    client
);

// ======================================================
// PANEL CANDIDATURE DYNAMIQUE
// ======================================================

registerCandidaturePanelWatch(
    client
);

// Vocal recrutement
registerRecruitmentVoiceSystem(
    client
);

// TPV
registerTempVoiceSystem(
    client
);

// Roblox
registerRobloxLinkPanel(
    client
);

// Stats
registerActivityStats(
    client
);

// ======================================================
// PREMIER CHARGEMENT LOCAL DES COMMANDES
// ======================================================

try {
    loadCommands();

    registerCommandSystems();

} catch (error) {
    console.error(
        "❌ Préchargement commandes :",
        error
    );
}

// ======================================================
// PROTECTION OPTIONS SLASH
// ======================================================

function findProtectedUserInOptions(
    options
) {
    if (
        !Array.isArray(
            options
        )
    ) {
        return null;
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
            const nested =
                findProtectedUserInOptions(
                    option.options
                );

            if (
                nested
            ) {
                return nested;
            }
        }

        if (
            option.type ===
                ApplicationCommandOptionType.User &&
            isProtectedUser(
                option.value
            )
        ) {
            return String(
                option.value
            );
        }

        if (
            option.type ===
                ApplicationCommandOptionType.Mentionable &&
            isProtectedUser(
                option.value
            )
        ) {
            return String(
                option.value
            );
        }
    }

    return null;
}

// ======================================================
// RÉPONSE PROTECTION
// ======================================================

async function replyProtected(
    interaction
) {
    const content =
        "🛡️ **Ce membre est protégé.** Aucune commande ou action du bot ne peut être utilisée sur ce compte.";

    try {
        if (
            interaction.deferred
        ) {
            await interaction.editReply({
                content
            });

            return;
        }

        if (
            interaction.replied
        ) {
            await interaction.followUp({
                content,

                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }

        await interaction.reply({
            content,

            flags:
                MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error(
            "❌ Réponse protection :",
            error
        );
    }
}

// ======================================================
// MAINTENANCE
// ======================================================

function getMaintenanceSystem() {
    return (
        getCommandModule(
            "maintenance"
        )
            ?.maintenanceSystem ||
        client.maintenanceSystem ||
        null
    );
}

// ======================================================
// RÉPONSE MAINTENANCE
// ======================================================

async function replyMaintenanceBlocked(
    interaction,
    result
) {
    const maintenanceSystem =
        getMaintenanceSystem();

    const embed =
        maintenanceSystem
            ?.buildMaintenanceBlockedEmbed
            ? maintenanceSystem
                .buildMaintenanceBlockedEmbed(
                    result
                )
            : null;

    const payload =
        embed
            ? {
                embeds: [
                    embed
                ],

                flags:
                    MessageFlags.Ephemeral
            }
            : {
                content:
                    `🛠️ Cette fonctionnalité est actuellement en maintenance.\n\n**Raison :** ${result?.reason || "Aucune raison précisée."}`,

                flags:
                    MessageFlags.Ephemeral
            };

    try {
        if (
            interaction.deferred
        ) {
            const editPayload = {
                ...payload
            };

            delete editPayload.flags;

            await interaction.editReply(
                editPayload
            );

            return;
        }

        if (
            interaction.replied
        ) {
            await interaction.followUp(
                payload
            );

            return;
        }

        await interaction.reply(
            payload
        );

    } catch (error) {
        console.error(
            "❌ Réponse maintenance :",
            error
        );
    }
}

// ======================================================
// CHECK MAINTENANCE SLASH
// ======================================================

function checkCommandMaintenance(
    commandName
) {
    const maintenanceSystem =
        getMaintenanceSystem();

    if (
        !maintenanceSystem
    ) {
        return {
            blocked:
                false
        };
    }

    try {
        if (
            typeof maintenanceSystem.checkCommandMaintenance ===
                "function"
        ) {
            return (
                maintenanceSystem
                    .checkCommandMaintenance(
                        commandName
                    ) ||
                {
                    blocked:
                        false
                }
            );
        }

        if (
            typeof maintenanceSystem.check ===
                "function"
        ) {
            return (
                maintenanceSystem.check(
                    commandName
                ) ||
                {
                    blocked:
                        false
                }
            );
        }

    } catch (error) {
        console.error(
            "❌ Check maintenance commande :",
            error
        );
    }

    return {
        blocked:
            false
    };
}

// ======================================================
// CHECK MAINTENANCE COMPONENT
// ======================================================

function checkComponentMaintenance(
    interaction
) {
    const maintenanceSystem =
        getMaintenanceSystem();

    if (
        !maintenanceSystem
    ) {
        return {
            blocked:
                false
        };
    }

    try {
        if (
            typeof maintenanceSystem.checkComponentMaintenance ===
                "function"
        ) {
            return (
                maintenanceSystem
                    .checkComponentMaintenance(
                        interaction
                    ) ||
                {
                    blocked:
                        false
                }
            );
        }

        if (
            typeof maintenanceSystem.check ===
                "function"
        ) {
            return (
                maintenanceSystem.check(
                    interaction
                ) ||
                {
                    blocked:
                        false
                }
            );
        }

    } catch (error) {
        console.error(
            "❌ Check maintenance composant :",
            error
        );
    }

    return {
        blocked:
            false
    };
}

// ======================================================
// IDENTIFICATION SELECT MENU
// ======================================================

function isAnySelectInteraction(
    interaction
) {
    return (
        interaction.isStringSelectMenu?.() ||
        interaction.isUserSelectMenu?.() ||
        interaction.isChannelSelectMenu?.() ||
        interaction.isRoleSelectMenu?.() ||
        interaction.isMentionableSelectMenu?.()
    );
}

// ======================================================
// HELPER /USER
// ======================================================

async function getUserPanelMembers(
    interaction,
    ownerId,
    targetId
) {
    if (
        interaction.user.id !==
        ownerId
    ) {
        return {
            success:
                false,

            error:
                "NOT_OWNER"
        };
    }

    if (
        isProtectedUser(
            targetId
        )
    ) {
        return {
            success:
                false,

            error:
                "PROTECTED_USER"
        };
    }

    const owner =
        await interaction.guild.members
            .fetch(
                ownerId
            )
            .catch(
                () => null
            );

    const target =
        await interaction.guild.members
            .fetch(
                targetId
            )
            .catch(
                () => null
            );

    if (
        !owner ||
        !target
    ) {
        return {
            success:
                false,

            error:
                "MEMBER_NOT_FOUND"
        };
    }

    return {
        success:
            true,

        owner,
        target
    };
}

// ======================================================
// BOUTONS /USER
// ======================================================

async function handleUserButton(
    interaction
) {
    if (
        !interaction.customId
            .startsWith(
                "user_"
            )
    ) {
        return false;
    }

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
        !action ||
        !ownerId ||
        !targetId
    ) {
        await interaction.reply({
            content:
                "❌ Bouton invalide.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    if (
        isProtectedUser(
            targetId
        )
    ) {
        await replyProtected(
            interaction
        );

        return true;
    }

    await interaction.deferUpdate();

    const result =
        await getUserPanelMembers(
            interaction,
            ownerId,
            targetId
        );

    if (
        !result.success
    ) {
        if (
            result.error ===
            "NOT_OWNER"
        ) {
            await interaction.followUp({
                content:
                    "❌ Seule la personne ayant ouvert ce panel peut utiliser ces boutons.",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );

            return true;
        }

        if (
            result.error ===
            "PROTECTED_USER"
        ) {
            await interaction.followUp({
                content:
                    "🛡️ Ce membre est protégé.",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );

            return true;
        }

        await interaction.followUp({
            content:
                "❌ Impossible de récupérer le membre.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

        return true;
    }

    const {
        owner,
        target
    } =
        result;

    // ==================================================
    // BRING
    // ==================================================

    if (
        action ===
        "bring"
    ) {
        if (
            !owner.voice.channelId
        ) {
            await interaction.followUp({
                content:
                    "❌ Tu dois être connecté dans un salon vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        if (
            !target.voice.channelId
        ) {
            await interaction.followUp({
                content:
                    "❌ Ce membre n'est pas en vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        client.previousVoice.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                channelId:
                    target.voice.channelId
            }
        );

        try {
            await target.voice.setChannel(
                owner.voice.channelId
            );

            await interaction.followUp({
                content:
                    `✅ <@${target.id}> a été déplacé dans ton vocal.`,

                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {
            await interaction.followUp({
                content:
                    `❌ Impossible de déplacer ce membre.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // ==================================================
    // BACK
    // ==================================================

    if (
        action ===
        "back"
    ) {
        const previous =
            client.previousVoice.get(
                target.id
            );

        if (
            !previous ||
            previous.guildId !==
                interaction.guild.id ||
            !previous.channelId
        ) {
            await interaction.followUp({
                content:
                    "❌ Aucun ancien vocal enregistré.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const previousChannel =
            interaction.guild.channels.cache.get(
                previous.channelId
            );

        if (
            !previousChannel
        ) {
            client.previousVoice.delete(
                target.id
            );

            await interaction.followUp({
                content:
                    "❌ L'ancien vocal n'existe plus.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const currentChannelId =
            target.voice.channelId;

        try {
            await target.voice.setChannel(
                previous.channelId
            );

            if (
                currentChannelId &&
                currentChannelId !==
                    previous.channelId
            ) {
                client.previousVoice.set(
                    target.id,
                    {
                        guildId:
                            interaction.guild.id,

                        channelId:
                            currentChannelId
                    }
                );

            } else {
                client.previousVoice.delete(
                    target.id
                );
            }

            await interaction.followUp({
                content:
                    `↩️ <@${target.id}> a été remis dans son ancien vocal.`,

                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {
            await interaction.followUp({
                content:
                    `❌ Impossible de déplacer le membre.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // ==================================================
    // DISCONNECT
    // ==================================================

    if (
        action ===
        "disconnect"
    ) {
        if (
            !target.voice.channelId
        ) {
            await interaction.followUp({
                content:
                    "⚠️ Ce membre n'est pas en vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        client.previousVoice.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                channelId:
                    target.voice.channelId
            }
        );

        try {
            await target.voice.disconnect();

            await interaction.followUp({
                content:
                    `☎️ <@${target.id}> a été déconnecté.`,

                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {
            await interaction.followUp({
                content:
                    `❌ Impossible de déconnecter ce membre.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    // ==================================================
    // MN
    // ==================================================

    if (
        action ===
        "mn"
    ) {
        if (
            !target.voice.channelId
        ) {
            await interaction.followUp({
                content:
                    "❌ Le membre doit être dans un vocal.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        client.menottes.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                channelId:
                    target.voice.channelId,

                moderatorId:
                    interaction.user.id
            }
        );

        client.saveControlStates();

        await interaction.followUp({
            content:
                `🔒 <@${target.id}> est menotté dans <#${target.voice.channelId}>.`,

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // ==================================================
    // DMN
    // ==================================================

    if (
        action ===
        "dmn"
    ) {
        const existed =
            client.menottes.delete(
                target.id
            );

        client.saveControlStates();

        await interaction.followUp({
            content:
                existed
                    ? `🔓 <@${target.id}> a été démenotté.`
                    : "⚠️ Ce membre n'était pas menotté.",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // ==================================================
    // CH
    // ==================================================

    if (
        action ===
        "ch"
    ) {
        client.chiens.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                maitreId:
                    owner.id
            }
        );

        client.saveControlStates();

        if (
            owner.voice.channelId &&
            target.voice.channelId &&
            target.voice.channelId !==
                owner.voice.channelId
        ) {
            await target.voice
                .setChannel(
                    owner.voice.channelId
                )
                .catch(
                    () => {}
                );
        }

        await interaction.followUp({
            content:
                `🐕 <@${target.id}> est maintenant en CH avec <@${owner.id}>.`,

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // ==================================================
    // UCH
    // ==================================================

    if (
        action ===
        "uch"
    ) {
        const existed =
            client.chiens.delete(
                target.id
            );

        client.saveControlStates();

        await interaction.followUp({
            content:
                existed
                    ? `🦴 <@${target.id}> n'est plus en CH.`
                    : "⚠️ Ce membre n'était pas en CH.",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // ==================================================
    // LOCK NAME
    // ==================================================

    if (
        action ===
        "lockname"
    ) {
        client.lockedNames.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                nickname:
                    target.displayName,

                moderatorId:
                    interaction.user.id
            }
        );

        client.saveControlStates();

        await interaction.followUp({
            content:
                `🔐 Le pseudo de <@${target.id}> est verrouillé sur **${target.displayName}**.`,

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    // ==================================================
    // UNLOCK NAME
    // ==================================================

    if (
        action ===
        "unlockname"
    ) {
        const existed =
            client.lockedNames.delete(
                target.id
            );

        client.saveControlStates();

        await interaction.followUp({
            content:
                existed
                    ? `🔑 Le pseudo de <@${target.id}> est déverrouillé.`
                    : "⚠️ Ce pseudo n'était pas verrouillé.",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    await interaction.followUp({
        content:
            "❌ Action inconnue.",

        flags:
            MessageFlags.Ephemeral
    }).catch(
        () => {}
    );

    return true;
}

// ======================================================
// MENU VOCAL /USER
// ======================================================

async function handleUserChannelSelect(
    interaction
) {
    if (
        !interaction.customId
            .startsWith(
                "user_move_"
            )
    ) {
        return false;
    }

    const parts =
        interaction.customId.split(
            "_"
        );

    const ownerId =
        parts[2];

    const targetId =
        parts[3];

    if (
        !ownerId ||
        !targetId
    ) {
        return true;
    }

    if (
        isProtectedUser(
            targetId
        )
    ) {
        await replyProtected(
            interaction
        );

        return true;
    }

    await interaction.deferUpdate();

    const result =
        await getUserPanelMembers(
            interaction,
            ownerId,
            targetId
        );

    if (
        !result.success
    ) {
        if (
            result.error ===
            "NOT_OWNER"
        ) {
            await interaction.followUp({
                content:
                    "❌ Seule la personne ayant ouvert ce panel peut utiliser ce menu.",

                flags:
                    MessageFlags.Ephemeral
            }).catch(
                () => {}
            );
        }

        return true;
    }

    const target =
        result.target;

    const channelId =
        interaction.values?.[0];

    if (
        !channelId
    ) {
        return true;
    }

    if (
        target.voice.channelId
    ) {
        client.previousVoice.set(
            target.id,
            {
                guildId:
                    interaction.guild.id,

                channelId:
                    target.voice.channelId
            }
        );
    }

    try {
        await target.voice.setChannel(
            channelId
        );

        await interaction.followUp({
            content:
                `✅ <@${target.id}> déplacé dans <#${channelId}>.`,

            flags:
                MessageFlags.Ephemeral
        });

    } catch (error) {
        await interaction.followUp({
            content:
                `❌ ${error.message}`,

            flags:
                MessageFlags.Ephemeral
        });
    }

    return true;
}

// ======================================================
// HELPERS ROUTAGE COMPOSANTS
// ======================================================

async function runCommandButtonHandler(
    commandName,
    interaction
) {
    const command =
        getCommandModule(
            commandName
        );

    if (
        !command ||
        typeof command.handleButton !==
            "function"
    ) {
        return false;
    }

    return Boolean(
        await command.handleButton(
            interaction,
            client
        )
    );
}

async function runCommandSelectHandler(
    commandName,
    interaction
) {
    const command =
        getCommandModule(
            commandName
        );

    if (
        !command ||
        typeof command.handleSelect !==
            "function"
    ) {
        return false;
    }

    return Boolean(
        await command.handleSelect(
            interaction,
            client
        )
    );
}

async function runCommandModalHandler(
    commandName,
    interaction
) {
    const command =
        getCommandModule(
            commandName
        );

    if (
        !command ||
        typeof command.handleModal !==
            "function"
    ) {
        return false;
    }

    return Boolean(
        await command.handleModal(
            interaction,
            client
        )
    );
}

// ======================================================
// DÉTECTION DES COMPOSANTS LOUP-GAROU
// ======================================================

function isLoupgarouComponentId(
    customId
) {
    if (
        !customId
    ) {
        return false;
    }

    const prefixes = [
        "lg_info_role_",
        "lg_info_rules_",
        "lg_info_game_",

        "lg_choice_",
        "lg_action_",

        "lg_rules_group_",
        "lg_rules_role_",

        "lg_mayor_join_",
        "lg_mayor_leave_",
        "lg_mayor_vote_",

        "lg_day_vote_",

        "lg_lobby_",
        "lg_join_",
        "lg_leave_",
        "lg_start_",
        "lg_cancel_",
        "lg_config_",
        "lg_preset_",
        "lg_custom_",
        "lg_rule_",
        "lg_role_"
    ];

    return prefixes.some(
        prefix =>
            customId.startsWith(
                prefix
            )
    );
}

// ======================================================
// ROUTEUR BOUTONS COMMANDES
// ======================================================

async function routeCommandButton(
    interaction
) {
    const customId =
        interaction.customId ||
        "";

    if (
        isLoupgarouComponentId(
            customId
        )
    ) {
        try {
            const handled =
                await runCommandButtonHandler(
                    "loupgarou",
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                "❌ Bouton loupgarou :",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    const modules = [
        "wanted",
        "ship",
        "union",
        "tribunal",
        "legacygames",
        "imposteur",
        "loupgarou"
    ];

    for (
        const name
        of modules
    ) {
        if (
            name ===
                "loupgarou" &&
            isLoupgarouComponentId(
                customId
            )
        ) {
            continue;
        }

        try {
            const handled =
                await runCommandButtonHandler(
                    name,
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                `❌ Bouton ${name} :`,
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    return false;
}

// ======================================================
// ROUTEUR SELECTS
// ======================================================

async function routeCommandSelect(
    interaction
) {
    const customId =
        interaction.customId ||
        "";

    if (
        isLoupgarouComponentId(
            customId
        )
    ) {
        try {
            const handled =
                await runCommandSelectHandler(
                    "loupgarou",
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                "❌ Select loupgarou :",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    const modules = [
        "legacygames",
        "imposteur",
        "tribunal",
        "loupgarou"
    ];

    for (
        const name
        of modules
    ) {
        if (
            name ===
                "loupgarou" &&
            isLoupgarouComponentId(
                customId
            )
        ) {
            continue;
        }

        try {
            const handled =
                await runCommandSelectHandler(
                    name,
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                `❌ Select ${name} :`,
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    return false;
}

// ======================================================
// ROUTEUR MODALS
// ======================================================

async function routeCommandModal(
    interaction
) {
    const customId =
        interaction.customId ||
        "";

    if (
        isLoupgarouComponentId(
            customId
        )
    ) {
        try {
            const handled =
                await runCommandModalHandler(
                    "loupgarou",
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                "❌ Modal loupgarou :",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    const modules = [
        "legacygames",
        "tribunal",
        "imposteur",
        "loupgarou"
    ];

    for (
        const name
        of modules
    ) {
        if (
            name ===
                "loupgarou" &&
            isLoupgarouComponentId(
                customId
            )
        ) {
            continue;
        }

        try {
            const handled =
                await runCommandModalHandler(
                    name,
                    interaction
                );

            if (
                handled
            ) {
                return true;
            }

        } catch (error) {
            console.error(
                `❌ Modal ${name} :`,
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Une erreur est survenue.",

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            }

            return true;
        }
    }

    return false;
}

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
    Events.InteractionCreate,
    async interaction => {
        try {
            // ==================================================
            // AUTOCOMPLETE
            // ==================================================

            if (
                interaction.isAutocomplete()
            ) {
                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (
                    !command ||
                    typeof command.autocomplete !==
                        "function"
                ) {
                    try {
                        await interaction.respond(
                            []
                        );
                    } catch {}

                    return;
                }

                try {
                    await command.autocomplete(
                        interaction,
                        client
                    );

                } catch (error) {
                    console.error(
                        `❌ Autocomplete /${interaction.commandName} :`,
                        error
                    );

                    try {
                        await interaction.respond(
                            []
                        );
                    } catch {}
                }

                return;
            }

            // ==================================================
            // MAINTENANCE DES COMPOSANTS
            // ==================================================

            if (
                interaction.isButton() ||
                isAnySelectInteraction(
                    interaction
                ) ||
                interaction.isModalSubmit()
            ) {
                const maintenance =
                    checkComponentMaintenance(
                        interaction
                    );

                if (
                    maintenance.blocked
                ) {
                    await replyMaintenanceBlocked(
                        interaction,
                        maintenance
                    );

                    return;
                }
            }

            // ==================================================
            // /USER CHANNEL SELECT
            // ==================================================

            if (
                interaction.isChannelSelectMenu() &&
                interaction.customId
                    .startsWith(
                        "user_move_"
                    )
            ) {
                await handleUserChannelSelect(
                    interaction
                );

                return;
            }

            // ==================================================
            // /USER BUTTONS
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId
                    .startsWith(
                        "user_"
                    )
            ) {
                await handleUserButton(
                    interaction
                );

                return;
            }

            // ==================================================
            // BUTTONS COMMANDES
            // ==================================================

            if (
                interaction.isButton()
            ) {
                const handled =
                    await routeCommandButton(
                        interaction
                    );

                if (
                    handled
                ) {
                    return;
                }
            }

            // ==================================================
            // SELECT MENUS COMMANDES
            // ==================================================

            if (
                interaction.isStringSelectMenu() ||
                interaction.isUserSelectMenu()
            ) {
                const handled =
                    await routeCommandSelect(
                        interaction
                    );

                if (
                    handled
                ) {
                    return;
                }
            }

            // ==================================================
            // MODALS COMMANDES
            // ==================================================

            if (
                interaction.isModalSubmit()
            ) {
                const handled =
                    await routeCommandModal(
                        interaction
                    );

                if (
                    handled
                ) {
                    return;
                }
            }

            // ==================================================
            // SLASH UNIQUEMENT
            // ==================================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            const command =
                client.commands.get(
                    interaction.commandName
                );

            if (
                !command
            ) {
                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            "❌ Commande introuvable.",

                        flags:
                            MessageFlags.Ephemeral
                    }).catch(
                        () => {}
                    );
                }

                return;
            }

            const startedAt =
                Date.now();

            // ==================================================
            // MAINTENANCE
            // ==================================================

            const maintenance =
                checkCommandMaintenance(
                    interaction.commandName
                );

            if (
                maintenance.blocked
            ) {
                console.log(
                    `🛠️ /${interaction.commandName} bloquée : maintenance`
                );

                await replyMaintenanceBlocked(
                    interaction,
                    maintenance
                );

                await client.logs
                    ?.logCommand(
                        interaction,
                        {
                            status:
                                "blocked",

                            durationMs:
                                Date.now() -
                                startedAt,

                            note:
                                `Maintenance : ${maintenance.serviceLabel || maintenance.service || "service"}`
                        }
                    )
                    .catch(
                        () => {}
                    );

                return;
            }

            // ==================================================
            // PROTECTION COMPTES
            // ==================================================

            const protectedTarget =
                findProtectedUserInOptions(
                    interaction.options.data
                );

            if (
                protectedTarget
            ) {
                console.log(
                    `🛡️ /${interaction.commandName} bloquée sur ${protectedTarget}`
                );

                await replyProtected(
                    interaction
                );

                await client.logs
                    ?.logCommand(
                        interaction,
                        {
                            status:
                                "blocked",

                            durationMs:
                                Date.now() -
                                startedAt,

                            note:
                                `Cible protégée : ${protectedTarget}`
                        }
                    )
                    .catch(
                        () => {}
                    );

                return;
            }

            console.log(
                `⚡ Commande reçue : /${interaction.commandName} par ${interaction.user.tag}`
            );

            let executionError =
                null;

            // ==================================================
            // EXECUTION
            // ==================================================

            try {
                await command.execute(
                    interaction,
                    client
                );

            } catch (error) {
                executionError =
                    error;

                console.error(
                    `❌ /${interaction.commandName} :`,
                    error
                );

                try {
                    if (
                        interaction.deferred
                    ) {
                        await interaction.editReply({
                            content:
                                "❌ Une erreur est survenue."
                        });

                    } else if (
                        interaction.replied
                    ) {
                        await interaction.followUp({
                            content:
                                "❌ Une erreur est survenue.",

                            flags:
                                MessageFlags.Ephemeral
                        });

                    } else {
                        await interaction.reply({
                            content:
                                "❌ Une erreur est survenue.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                } catch {}
            }

            // ==================================================
            // LOG AUTOMATIQUE
            // ==================================================

            await client.logs
                ?.logCommand(
                    interaction,
                    {
                        status:
                            executionError
                                ? "error"
                                : "success",

                        error:
                            executionError,

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "❌ Log commande :",
                            error
                        );
                    }
                );

        } catch (error) {
            console.error(
                "❌ Interaction globale :",
                error
            );

            try {
                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            "❌ Une erreur interne est survenue.",

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

            } catch {}
        }
    }
);

// ======================================================
// MENOTTE + CH
// ======================================================

client.on(
    Events.VoiceStateUpdate,
    async (
        oldState,
        newState
    ) => {
        try {
            const guild =
                newState.guild ||
                oldState.guild;

            if (
                !guild
            ) {
                return;
            }

            const memberId =
                newState.id ||
                oldState.id;

            if (
                !memberId
            ) {
                return;
            }

            if (
                isProtectedUser(
                    memberId
                )
            ) {
                let changed =
                    false;

                if (
                    client.chiens.delete(
                        memberId
                    )
                ) {
                    changed =
                        true;
                }

                if (
                    client.menottes.delete(
                        memberId
                    )
                ) {
                    changed =
                        true;
                }

                if (
                    changed
                ) {
                    client.saveControlStates();
                }

                return;
            }

            // ==================================================
            // MENOTTE
            // ==================================================

            const menotte =
                client.menottes.get(
                    memberId
                );

            if (
                menotte &&
                menotte.guildId ===
                    guild.id
            ) {
                if (
                    newState.channelId &&
                    newState.channelId !==
                        menotte.channelId
                ) {
                    try {
                        await newState.setChannel(
                            menotte.channelId
                        );

                    } catch (error) {
                        console.error(
                            "❌ Menotte persistante :",
                            error
                        );
                    }
                }
            }

            // ==================================================
            // CH
            // ==================================================

            for (
                const [
                    targetId,
                    data
                ]
                of client.chiens
            ) {
                if (
                    isProtectedUser(
                        targetId
                    )
                ) {
                    client.chiens.delete(
                        targetId
                    );

                    client.saveControlStates();

                    continue;
                }

                if (
                    data.guildId !==
                    guild.id
                ) {
                    continue;
                }

                const cible =
                    await guild.members
                        .fetch(
                            targetId
                        )
                        .catch(
                            () => null
                        );

                const maitre =
                    await guild.members
                        .fetch(
                            data.maitreId
                        )
                        .catch(
                            () => null
                        );

                if (
                    !cible ||
                    !maitre
                ) {
                    continue;
                }

                if (
                    memberId ===
                        data.maitreId &&
                    newState.channelId &&
                    cible.voice.channelId &&
                    cible.voice.channelId !==
                        newState.channelId
                ) {
                    await cible.voice
                        .setChannel(
                            newState.channelId
                        )
                        .catch(
                            () => {}
                        );
                }

                if (
                    memberId ===
                        targetId &&
                    newState.channelId &&
                    maitre.voice.channelId &&
                    newState.channelId !==
                        maitre.voice.channelId
                ) {
                    await newState
                        .setChannel(
                            maitre.voice.channelId
                        )
                        .catch(
                            () => {}
                        );
                }

                if (
                    memberId ===
                        targetId &&
                    oldState.channelId ===
                        null &&
                    newState.channelId &&
                    maitre.voice.channelId &&
                    newState.channelId !==
                        maitre.voice.channelId
                ) {
                    await newState
                        .setChannel(
                            maitre.voice.channelId
                        )
                        .catch(
                            () => {}
                        );
                }
            }

        } catch (error) {
            console.error(
                "❌ VoiceState global CH/MN :",
                error
            );
        }
    }
);

// ======================================================
// LOCK PSEUDO
// ======================================================

client.on(
    Events.GuildMemberUpdate,
    async (
        oldMember,
        newMember
    ) => {
        try {
            if (
                isProtectedUser(
                    newMember.id
                )
            ) {
                if (
                    client.lockedNames.delete(
                        newMember.id
                    )
                ) {
                    client.saveControlStates();
                }

                return;
            }

            const verrou =
                client.lockedNames.get(
                    newMember.id
                );

            if (
                !verrou ||
                verrou.guildId !==
                    newMember.guild.id
            ) {
                return;
            }

            const expectedNickname =
                verrou.nickname;

            if (
                newMember.displayName ===
                expectedNickname
            ) {
                return;
            }

            await newMember
                .setNickname(
                    expectedNickname,
                    "Pseudo verrouillé"
                )
                .catch(
                    error =>
                        console.error(
                            "❌ Lock pseudo :",
                            error
                        )
                );

        } catch (error) {
            console.error(
                "❌ GuildMemberUpdate :",
                error
            );
        }
    }
);

// ======================================================
// RESTAURATION CH / MN
// ======================================================

async function restoreActiveVoiceControls() {
    let changed =
        false;

    // ==================================================
    // MENOTTES
    // ==================================================

    for (
        const [
            memberId,
            data
        ]
        of [
            ...client.menottes.entries()
        ]
    ) {
        if (
            isProtectedUser(
                memberId
            )
        ) {
            client.menottes.delete(
                memberId
            );

            changed =
                true;

            continue;
        }

        const guild =
            client.guilds.cache.get(
                data.guildId
            );

        if (
            !guild
        ) {
            continue;
        }

        const member =
            await guild.members
                .fetch(
                    memberId
                )
                .catch(
                    () => null
                );

        if (
            !member ||
            !member.voice.channelId
        ) {
            continue;
        }

        if (
            member.voice.channelId !==
                data.channelId
        ) {
            await member.voice
                .setChannel(
                    data.channelId
                )
                .catch(
                    () => {}
                );
        }
    }

    // ==================================================
    // CH
    // ==================================================

    for (
        const [
            targetId,
            data
        ]
        of [
            ...client.chiens.entries()
        ]
    ) {
        if (
            isProtectedUser(
                targetId
            )
        ) {
            client.chiens.delete(
                targetId
            );

            changed =
                true;

            continue;
        }

        const guild =
            client.guilds.cache.get(
                data.guildId
            );

        if (
            !guild
        ) {
            continue;
        }

        const target =
            await guild.members
                .fetch(
                    targetId
                )
                .catch(
                    () => null
                );

        const master =
            await guild.members
                .fetch(
                    data.maitreId
                )
                .catch(
                    () => null
                );

        if (
            !target ||
            !master ||
            !target.voice.channelId ||
            !master.voice.channelId
        ) {
            continue;
        }

        if (
            target.voice.channelId !==
                master.voice.channelId
        ) {
            await target.voice
                .setChannel(
                    master.voice.channelId
                )
                .catch(
                    () => {}
                );
        }
    }

    client.saveControlStates();

    if (
        changed
    ) {
        console.log(
            "💾 Contrôles vocaux protégés nettoyés."
        );
    }
}

// ======================================================
// READY
// ======================================================

client.once(
    Events.ClientReady,
    async readyClient => {
        console.log("");

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            `✅ ${readyClient.user.tag} est connecté !`
        );

        console.log(
            `🛡️ ${PROTECTED_USER_IDS.size} compte(s) protégé(s)`
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        try {
            // ==================================================
            // ENREGISTREMENT COMMANDES
            // ==================================================

            const result =
                await client.reloadCommands();

            console.log(
                `✅ ${result.commands} commande(s) enregistrée(s) sur ${result.guilds} serveur(s) !`
            );

            console.log("");

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            // ==================================================
            // COMMANDES PRINCIPALES
            // ==================================================

            console.log(
                "🔎 /rank autocomplete :",
                typeof client.commands
                    .get(
                        "rank"
                    )
                    ?.autocomplete ===
                    "function"
                    ? "✅ présent"
                    : "❌ absent"
            );

            console.log(
                "👤 /user :",
                client.commands.has(
                    "user"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🐕 /ch :",
                client.commands.has(
                    "ch"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🔒 /mn :",
                client.commands.has(
                    "mn"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "📜 /setuplogs :",
                client.commands.has(
                    "setuplogs"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            // ==================================================
            // CANDIDATURE
            // ==================================================

            console.log(
                "📨 /candidature :",
                client.commands.has(
                    "candidature"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "📝 /setupcandidature :",
                client.commands.has(
                    "setupcandidature"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            // ==================================================
            // NOUVEAUX SYSTÈMES
            // ==================================================

            console.log(
                "🛠️ Maintenance :",
                client.commands.has(
                    "maintenance"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "↩️ Rollback :",
                client.commands.has(
                    "rollback"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "👁️ Surveillance :",
                client.commands.has(
                    "surveillance"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "⚖️ Tribunal :",
                client.commands.has(
                    "tribunal"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🎮 Legacy Games :",
                client.commands.has(
                    "legacygames"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🕵️ Imposteur :",
                client.commands.has(
                    "imposteur"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🐺 Loup-Garou :",
                client.commands.has(
                    "loupgarou"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🎯 Wanted :",
                client.commands.has(
                    "wanted"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "💘 Ship :",
                client.commands.has(
                    "ship"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "💍 Union :",
                client.commands.has(
                    "union"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "💔 DelUnion :",
                client.commands.has(
                    "delunion"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "📊 Analyse :",
                client.commands.has(
                    "analyse"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log("");

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            // ==================================================
            // SYSTÈMES DE BASE
            // ==================================================

            console.log(
                "🎙️ Recrutement vocal : ✅ actif"
            );

            console.log(
                "🏢 Salons vocaux temporaires :",
                client.tempVoiceSystem
                    ? "✅ actif"
                    : "❌ absent"
            );

            console.log(
                "🔗 Changement Roblox : ✅ actif"
            );

            console.log(
                "📊 Statistiques Discord :",
                client.activityStats
                    ? "✅ actif"
                    : "❌ absent"
            );

            console.log(
                "📜 Logs complets :",
                client.logs
                    ? "✅ actif"
                    : "❌ absent"
            );

            console.log(
                "💾 Persistance CH/MN : ✅ active"
            );

            console.log(
                "🛡️ Protection comptes : ✅ active"
            );

            console.log(
                "👁️ Activités Discord : ✅ intent chargé"
            );

            console.log(
                "📨 Panel candidature dynamique : ✅ actif"
            );

            // ==================================================
            // SURVEILLANCE TAG SERVEUR
            // ==================================================

            startServerTagWatch(
                client
            );

            console.log(
                "🏷️ Surveillance tag serveur : ✅ active"
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            // ==================================================
            // RESTAURATION CH/MN
            // ==================================================

            await restoreActiveVoiceControls();

        } catch (error) {
            console.error(
                "❌ Synchronisation :",
                error
            );
        }
    }
);

// ======================================================
// ARRÊT PROPRE
// ======================================================

function saveBeforeExit() {
    try {
        client.saveControlStates();

    } catch (error) {
        console.error(
            "❌ Sauvegarde ControlStates :",
            error
        );
    }

    try {
        if (
            typeof client.activityStats
                ?.save ===
                "function"
        ) {
            client.activityStats.save();

        } else if (
            typeof client.activityStats
                ?.saveStats ===
                "function"
        ) {
            client.activityStats.saveStats();
        }

    } catch (error) {
        console.error(
            "❌ Sauvegarde ActivityStats :",
            error
        );
    }

    console.log(
        "💾 États sauvegardés avant arrêt."
    );
}

// ======================================================
// SIGINT
// ======================================================

process.on(
    "SIGINT",
    () => {
        saveBeforeExit();

        client.destroy();

        process.exit(
            0
        );
    }
);

// ======================================================
// SIGTERM
// ======================================================

process.on(
    "SIGTERM",
    () => {
        saveBeforeExit();

        client.destroy();

        process.exit(
            0
        );
    }
);

// ======================================================
// ERREURS
// ======================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ Unhandled rejection :",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "❌ Uncaught exception :",
            error
        );
    }
);

// ======================================================
// CONNEXION
// ======================================================

if (
    !process.env.TOKEN
) {
    console.error(
        "❌ Impossible de lancer le bot : TOKEN absent."
    );

    process.exit(
        1
    );
}

client.login(
    process.env.TOKEN
);