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

const fs =
    require("fs");

const path =
    require("path");

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
// SYSTÈMES
// ======================================================

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
// PERSISTANCE CH / MN / PSEUDOS
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
        !!userId &&
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
// PERSISTANCE
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

    const files =
        fs.readdirSync(
            commandsPath
        ).filter(
            file =>
                file.endsWith(".js")
        );

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
                !command.data ||
                typeof command.execute !==
                    "function"
            ) {
                console.log(
                    `❌ Commande invalide : ${file}`
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
// /UPDATE
// ======================================================

client.reloadCommands =
async function () {
    const commands =
        loadCommands();

    const rest =
        new REST({
            version:
                "10"
        }).setToken(
            process.env.TOKEN
        );

    // Supprime les anciennes commandes globales
    await rest.put(
        Routes.applicationCommands(
            client.user.id
        ),
        {
            body: []
        }
    );

    let guildCount =
        0;

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
// LANCEMENT DES SYSTÈMES
// ======================================================

// Candidatures / recrutements
registerRecruitmentSystem(
    client
);

// Vocal recrutement
registerRecruitmentVoiceSystem(
    client
);

// Vocaux temporaires
registerTempVoiceSystem(
    client
);

// Panel changement compte Roblox
registerRobloxLinkPanel(
    client
);

// Statistiques Discord
registerActivityStats(
    client
);

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

        try {
            await target.voice.setChannel(
                previous.channelId
            );

            client.previousVoice.delete(
                target.id
            );

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
    // MENOTTE
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
    // DÉMENOTTE
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
        if (
            target.id ===
                owner.id
        ) {
            await interaction.followUp({
                content:
                    "❌ Tu ne peux pas te mettre toi-même en CH.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

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
    // LOCK PSEUDO
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
    // UNLOCK PSEUDO
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
        await interaction.followUp({
            content:
                "❌ Impossible d'utiliser ce menu.",

            flags:
                MessageFlags.Ephemeral
        }).catch(
            () => {}
        );

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
            // BOUTONS /USER
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
            // MENU /USER
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
            // IMPORTANT
            // ==================================================
            //
            // Les interactions suivantes sont gérées
            // directement par leurs systèmes :
            //
            // tpv_*   → systems/tempVoice.js
            // stats_* → systems/activityStats.js
            // legacy_change_roblox
            //          → systems/robloxLinkPanel.js
            //
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

            // ==================================================
            // PROTECTION GLOBALE
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

                return;
            }

            console.log(
                `⚡ Commande reçue : /${interaction.commandName} par ${interaction.user.tag}`
            );

            try {
                await command.execute(
                    interaction,
                    client
                );

            } catch (error) {
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

        } catch (error) {
            console.error(
                "❌ Interaction globale :",
                error
            );
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
                newState.guild;

            // ==================================================
            // PROTECTION
            // ==================================================

            if (
                isProtectedUser(
                    newState.id
                )
            ) {
                let changed =
                    false;

                if (
                    client.chiens.delete(
                        newState.id
                    )
                ) {
                    changed =
                        true;
                }

                if (
                    client.menottes.delete(
                        newState.id
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
                    newState.id
                );

            if (
                menotte &&
                menotte.guildId ===
                    guild.id &&
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

                // Maître change de vocal
                if (
                    newState.id ===
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

                // Cible change de vocal
                if (
                    newState.id ===
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
                    newMember.guild.id ||
                newMember.displayName ===
                    verrou.nickname
            ) {
                return;
            }

            await newMember
                .setNickname(
                    verrou.nickname,
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

            continue;
        }

        const guild =
            client.guilds.cache.get(
                data.guildId
            );

        if (!guild) {
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

            continue;
        }

        const guild =
            client.guilds.cache.get(
                data.guildId
            );

        if (!guild) {
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
            // COMMANDES
            // ==================================================

            const result =
                await client.reloadCommands();

            console.log(
                `✅ ${result.commands} commande(s) enregistrée(s) !`
            );

            // ==================================================
            // DEBUG COMMANDES
            // ==================================================

            console.log(
                "🔎 /rank autocomplete :",
                typeof client.commands
                    .get("rank")
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
                "🔻 /derank :",
                client.commands.has(
                    "derank"
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
                "🦴 /uch :",
                client.commands.has(
                    "uch"
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
                "🔓 /umn :",
                client.commands.has(
                    "umn"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🧪 /test :",
                client.commands.has(
                    "test"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🛑 /fintest :",
                client.commands.has(
                    "fintest"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🏢 /setuptpv :",
                client.commands.has(
                    "setuptpv"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "ℹ️ /setupinfos :",
                client.commands.has(
                    "setupinfos"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "📊 /setupstats :",
                client.commands.has(
                    "setupstats"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            console.log(
                "🔗 /link :",
                client.commands.has(
                    "link"
                )
                    ? "✅ chargé"
                    : "❌ absent"
            );

            // ==================================================
            // SYSTÈMES
            // ==================================================

            console.log("");
            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

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
                "💾 Persistance CH/MN : ✅ active"
            );

            console.log(
                "🛡️ Protection comptes : ✅ active"
            );

            console.log(
                "👁️ Activités Discord : ✅ intent chargé"
            );

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            // ==================================================
            // RESTAURATION
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
// SAUVEGARDE AVANT ARRÊT
// ======================================================

process.on(
    "SIGINT",
    () => {
        try {
            client.saveControlStates();
        } catch {}

        try {
            client.activityStats
                ?.saveStats
                ?.();
        } catch {}

        console.log(
            "💾 États sauvegardés avant arrêt."
        );

        process.exit(0);
    }
);

process.on(
    "SIGTERM",
    () => {
        try {
            client.saveControlStates();
        } catch {}

        try {
            client.activityStats
                ?.saveStats
                ?.();
        } catch {}

        process.exit(0);
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

client.login(
    process.env.TOKEN
);