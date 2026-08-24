const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    ROLES,
    ROLE_GROUPS,
    PRESETS,
    CAMPS,

    getRole,
    getCampDisplay,

    resolvePreset,
    validateComposition,
    countComposition,

    getActiveRoleIds,
    getActiveRules,

    buildPresetDescription,
    compareConfigs,
    compareRoleCounts
} = require("../systems/loupgarouRoles");

const {
    loupgarouSystem
} = require("../systems/loupgarou");

const voice =
    require("../systems/loupgarouVoice");

// ======================================================
// CONFIG
// ======================================================

const COLOR =
    0x3B6475;

const SUCCESS =
    0x57F287;

const WARNING =
    0xFEE75C;

const ERROR =
    0xED4245;

const MIN_PLAYERS =
    5;

const MAX_PLAYERS =
    25;

// ======================================================
// PRESETS AUTORISÉS
// ======================================================

const ALLOWED_PRESETS = [
    "classic",
    "advanced",
    "chaos",
    "wolves_power",
    "special"
];

// ======================================================
// UTILS
// ======================================================

function getClient(
    interaction,
    client = null
) {
    return (
        client ||
        interaction.client
    );
}

function getGame(
    gameId
) {
    return loupgarouSystem.getGame(
        gameId
    );
}

function getGuildGame(
    guildId
) {
    return loupgarouSystem.getGuildGame(
        guildId
    );
}

function saveGame(
    game
) {
    return loupgarouSystem.saveGame(
        game
    );
}

function isHostOrAdmin(
    interaction,
    game
) {
    if (
        interaction.user.id ===
        game.hostId
    ) {
        return true;
    }

    return Boolean(
        interaction.member
            ?.permissions
            ?.has(
                PermissionFlagsBits.Administrator
            ) ||
        interaction.member
            ?.permissions
            ?.has(
                PermissionFlagsBits.ManageGuild
            )
    );
}

async function replyPrivate(
    interaction,
    payload
) {
    const finalPayload = {
        ...payload,

        flags:
            MessageFlags.Ephemeral
    };

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        return interaction.followUp(
            finalPayload
        );
    }

    return interaction.reply(
        finalPayload
    );
}

function cleanCounts(
    roleCounts
) {
    const result =
        {};

    for (
        const [
            roleId,
            rawAmount
        ]
        of Object.entries(
            roleCounts ||
            {}
        )
    ) {
        const amount =
            Math.max(
                0,
                Math.floor(
                    Number(
                        rawAmount
                    ) ||
                    0
                )
            );

        if (
            amount >
            0
        ) {
            result[
                roleId
            ] =
                amount;
        }
    }

    return result;
}

// ======================================================
// MODE TEST
// ======================================================

function updateTestComposition(
    game
) {
    if (
        !game?.config?.testMode
    ) {
        return;
    }

    const count =
        game.players.length;

    game.config.presetId =
        "custom";

    if (
        count <=
        1
    ) {
        game.customRoleCounts = {
            wolf: 1
        };
    }

    else if (
        count ===
        2
    ) {
        game.customRoleCounts = {
            wolf: 1,
            villager: 1
        };
    }

    else if (
        count ===
        3
    ) {
        game.customRoleCounts = {
            wolf: 1,
            seer: 1,
            villager: 1
        };
    }

    else if (
        count ===
        4
    ) {
        game.customRoleCounts = {
            wolf: 1,
            seer: 1,
            witch: 1,
            villager: 1
        };
    }

    saveGame(
        game
    );
}

function getBlockingCompositionErrors(
    game,
    validation
) {
    return (
        validation?.errors ||
        []
    ).filter(
        error =>
            !(
                game.config?.testMode &&
                error ===
                "Il faut au minimum 5 joueurs."
            )
    );
}

// ======================================================
// CURRENT COMPOSITION
// ======================================================

function resolveCurrentComposition(
    game
) {
    if (
        game.config
            ?.presetId ===
        "custom"
    ) {
        const roleCounts =
            cleanCounts(
                game.customRoleCounts
            );

        return {
            roleCounts,

            validation:
                validateComposition(
                    roleCounts,
                    game.players.length
                )
        };
    }

    const preset =
        resolvePreset(
            game.config
                ?.presetId ||
            "classic",
            game.players.length
        );

    if (
        !preset
    ) {
        return {
            roleCounts:
                {},

            validation: {
                valid:
                    false,

                errors: [
                    "Preset introuvable."
                ],

                warnings:
                    []
            }
        };
    }

    return {
        roleCounts:
            preset.roleCounts,

        validation:
            validateComposition(
                preset.roleCounts,
                game.players.length
            )
    };
}

// ======================================================
// PRESET DISPLAY
// ======================================================

function getPresetDisplay(
    presetId
) {
    if (
        presetId ===
        "custom"
    ) {
        return "🛠️ Personnalisé";
    }

    const preset =
        PRESETS[
            presetId
        ];

    if (
        !preset
    ) {
        return presetId;
    }

    return (
        `${preset.emoji} ${preset.name}`
    );
}

// ======================================================
// LOBBY EMBED
// ======================================================

function buildLobbyEmbed(
    game
) {
    const composition =
        resolveCurrentComposition(
            game
        );

    const playerText =
        game.players.length
            ? game.players
                .map(
                    (
                        player,
                        index
                    ) => {
                        const host =
                            player.userId ===
                            game.hostId
                                ? " 👑"
                                : "";

                        return (
                            `${index + 1}. <@${player.userId}>${host}`
                        );
                    }
                )
                .join(
                    "\n"
                )
            : "Aucun joueur.";

    const validation =
        composition.validation;

    const blockingErrors =
        getBlockingCompositionErrors(
            game,
            validation
        );

    const compositionValid =
        blockingErrors.length ===
        0;

    const status =
        compositionValid
            ? "✅ Composition valide"
            : "❌ Composition incomplète";

    const warningText =
        validation.warnings
            ?.length
            ? validation.warnings
                .slice(
                    0,
                    4
                )
                .map(
                    warning =>
                        `• ${warning}`
                )
                .join(
                    "\n"
                )
            : "Aucun avertissement.";

    const testText =
        game.config
            ?.testMode
            ? "🧪 **MODE TEST ACTIF**\nLa partie peut être démarrée avec moins de 5 joueurs.\n\n"
            : "";

    return new EmbedBuilder()
        .setColor(
            compositionValid
                ? COLOR
                : WARNING
        )
        .setTitle(
            "🐺 Loup-Garou — The Legacy"
        )
        .setDescription(
`${testText}Une nouvelle partie de Loup-Garou se prépare.

### 🔊 Vocal lié

<#${game.voiceChannelId}>

### 🎮 Mode

${getPresetDisplay(
    game.config.presetId
)}

### 🎭 Composition

**${countComposition(
    composition.roleCounts
)}/${game.players.length} carte(s)**

${status}

### 👥 Joueurs • ${game.players.length}/${MAX_PLAYERS}

${playerText}

━━━━━━━━━━━━━━━━━━━━

### ⚙️ Règles principales

${game.config.mayorElection
    ? "👑 Maire : **activé**"
    : "👑 Maire : **désactivé**"}

${game.config.anonymousVotes
    ? "🔒 Votes : **anonymes**"
    : "👁️ Votes : **visibles**"}

${game.config.hardcore
    ? "🎭 Hardcore : **activé**"
    : "🎭 Hardcore : **désactivé**"}

${game.config.ambience
    ? "🌙 Ambiance sonore : **activée**"
    : "🔇 Ambiance sonore : **désactivée**"}

${game.config.discreteMode
    ? "🤫 Mode discret : **activé**"
    : "🔊 Mode discret : **désactivé**"}

### ⚠️ Avertissements

${warningText}`
        )
        .setFooter({
            text:
                game.config?.testMode
                    ? "The Legacy • Loup-Garou • MODE TEST"
                    : "The Legacy • Loup-Garou"
        })
        .setTimestamp();
}

// ======================================================
// LOBBY COMPONENTS
// ======================================================

function buildLobbyComponents(
    game
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_join_${game.id}`
                    )
                    .setLabel(
                        "Rejoindre"
                    )
                    .setEmoji(
                        "✅"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_leave_${game.id}`
                    )
                    .setLabel(
                        "Quitter"
                    )
                    .setEmoji(
                        "🚪"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_config_${game.id}`
                    )
                    .setLabel(
                        "Configuration"
                    )
                    .setEmoji(
                        "⚙️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_rules_${game.id}`
                    )
                    .setLabel(
                        "Règles"
                    )
                    .setEmoji(
                        "📖"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_start_${game.id}`
                    )
                    .setLabel(
                        game.config?.testMode
                            ? "Démarrer le test"
                            : "Démarrer"
                    )
                    .setEmoji(
                        "▶️"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_lobby_cancel_${game.id}`
                    )
                    .setLabel(
                        "Annuler"
                    )
                    .setEmoji(
                        "❌"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

// ======================================================
// CONFIG EMBED
// ======================================================

function buildConfigEmbed(
    game,
    changes = []
) {
    const composition =
        resolveCurrentComposition(
            game
        );

    const configChanges =
        changes.length
            ? changes
                .map(
                    change =>
                        `• ${change}`
                )
                .join(
                    "\n"
                )
            : "Aucune modification lors de cette ouverture.";

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "⚙️ Configuration du Loup-Garou"
        )
        .setDescription(
`### 🎮 Preset actuel

${getPresetDisplay(
    game.config.presetId
)}

${game.config?.testMode
    ? "🧪 **Mode test actif**\n"
    : ""}

### ⚙️ Paramètres

👑 **Maire**
${game.config.mayorElection
    ? "✅ Activé"
    : "❌ Désactivé"}

🗳️ **Votes**
${game.config.anonymousVotes
    ? "🔒 Anonymes"
    : "👁️ Visibles"}

🎭 **Hardcore**
${game.config.hardcore
    ? "✅ Activé"
    : "❌ Désactivé"}

🌙 **Ambiance sonore**
${game.config.ambience
    ? "✅ Activée"
    : "❌ Désactivée"}

🤫 **Mode discret**
${game.config.discreteMode
    ? "✅ Activé"
    : "❌ Désactivé"}

### 🎚️ Volumes

🗣️ Narrateur : **${Math.round(
    Number(
        game.config.narrationVolume ??
        1
    ) *
    100
)} %**

🔊 Effets : **${Math.round(
    Number(
        game.config.soundVolume ??
        0.65
    ) *
    100
)} %**

🌙 Ambiance : **${Math.round(
    Number(
        game.config.ambienceVolume ??
        0.18
    ) *
    100
)} %**

### 🎭 Cartes

**${countComposition(
    composition.roleCounts
)}/${game.players.length}**

### 📝 Dernières modifications

${configChanges}`
        )
        .setFooter({
            text:
                "Seul l'hôte ou un administrateur peut modifier ces paramètres."
        });
}

// ======================================================
// PRESET MENU
// ======================================================

function buildPresetMenu(
    game
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lg_config_preset_${game.id}`
            )
            .setPlaceholder(
                "🎮 Choisir un preset"
            );

    for (
        const presetId
        of ALLOWED_PRESETS
    ) {
        const preset =
            PRESETS[
                presetId
            ];

        if (
            !preset
        ) {
            continue;
        }

        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    preset.name
                )
                .setValue(
                    presetId
                )
                .setEmoji(
                    preset.emoji
                )
                .setDescription(
                    String(
                        preset.summary
                    ).slice(
                        0,
                        100
                    )
                )
                .setDefault(
                    game.config
                        .presetId ===
                    presetId
                )
        );
    }

    menu.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel(
                "Personnalisé"
            )
            .setValue(
                "custom"
            )
            .setEmoji(
                "🛠️"
            )
            .setDescription(
                "Choisir manuellement les rôles de la partie."
            )
            .setDefault(
                game.config
                    .presetId ===
                "custom"
            )
    );

    return new ActionRowBuilder()
        .addComponents(
            menu
        );
}

// ======================================================
// CONFIG BUTTONS
// ======================================================

function buildConfigButtons(
    game
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_mayor_${game.id}`
                    )
                    .setLabel(
                        "Maire"
                    )
                    .setEmoji(
                        "👑"
                    )
                    .setStyle(
                        game.config
                            .mayorElection
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_votes_${game.id}`
                    )
                    .setLabel(
                        game.config
                            .anonymousVotes
                            ? "Votes anonymes"
                            : "Votes visibles"
                    )
                    .setEmoji(
                        game.config
                            .anonymousVotes
                            ? "🔒"
                            : "👁️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_hardcore_${game.id}`
                    )
                    .setLabel(
                        "Hardcore"
                    )
                    .setEmoji(
                        "🎭"
                    )
                    .setStyle(
                        game.config
                            .hardcore
                            ? ButtonStyle.Danger
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_ambience_${game.id}`
                    )
                    .setLabel(
                        "Ambiance"
                    )
                    .setEmoji(
                        "🌙"
                    )
                    .setStyle(
                        game.config
                            .ambience
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_discrete_${game.id}`
                    )
                    .setLabel(
                        "Discret"
                    )
                    .setEmoji(
                        "🤫"
                    )
                    .setStyle(
                        game.config
                            .discreteMode
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_roles_${game.id}`
                    )
                    .setLabel(
                        "Composition"
                    )
                    .setEmoji(
                        "🎭"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_audio_${game.id}`
                    )
                    .setLabel(
                        "Volumes"
                    )
                    .setEmoji(
                        "🎚️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_rules_${game.id}`
                    )
                    .setLabel(
                        "Règles actives"
                    )
                    .setEmoji(
                        "📖"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_config_back_${game.id}`
                    )
                    .setLabel(
                        "Retour"
                    )
                    .setEmoji(
                        "⬅️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

function buildConfigComponents(
    game
) {
    return [
        buildPresetMenu(
            game
        ),

        ...buildConfigButtons(
            game
        )
    ];
}

// ======================================================
// ACTIVE RULES
// ======================================================

function buildActiveRulesEmbed(
    game
) {
    const composition =
        resolveCurrentComposition(
            game
        );

    const active =
        getActiveRules(
            composition.roleCounts,
            game.config
        );

    const roleText =
        active.roles.length
            ? active.roles
                .map(
                    role =>
                        `${role.emoji} **${role.name}** — ${role.description}`
                )
                .join(
                    "\n\n"
                )
            : "Aucun rôle actif.";

    const settings = [
        game.config.mayorElection
            ? "👑 Élection du Maire active"
            : "👑 Élection du Maire désactivée",

        game.config.anonymousVotes
            ? "🔒 Votes anonymes"
            : "👁️ Votes visibles",

        game.config.hardcore
            ? "🎭 Identités des morts cachées"
            : "💀 Identités des morts révélables",

        game.config.ambience
            ? "🌙 Ambiance sonore active"
            : "🔇 Ambiance sonore désactivée",

        game.config.discreteMode
            ? "🤫 Mode discret actif"
            : "🔊 Mode audio normal",

        game.config.testMode
            ? "🧪 Mode test actif"
            : null
    ].filter(
        Boolean
    );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "📖 Règles de cette partie"
        )
        .setDescription(
`Ce panneau montre uniquement les règles réellement actives pour **cette partie**.

### ⚙️ Paramètres actifs

${settings
    .map(
        value =>
            `• ${value}`
    )
    .join(
        "\n"
    )}

### 🎭 Rôles présents

${roleText.slice(
    0,
    3000
)}`
        )
        .setFooter({
            text:
                "The Legacy • Loup-Garou"
        });
}

// ======================================================
// ROLE GROUP MENU
// ======================================================

function buildRoleGroupMenu(
    game
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lg_custom_group_${game.id}`
            )
            .setPlaceholder(
                "Choisir une catégorie de rôles"
            );

    for (
        const [
            groupId,
            group
        ]
        of Object.entries(
            ROLE_GROUPS
        )
    ) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    group.name
                )
                .setValue(
                    groupId
                )
                .setEmoji(
                    group.emoji
                )
        );
    }

    return new ActionRowBuilder()
        .addComponents(
            menu
        );
}

// ======================================================
// CUSTOM COMPOSITION HOME
// ======================================================

function buildCustomHomeEmbed(
    game
) {
    const counts =
        cleanCounts(
            game.customRoleCounts
        );

    const total =
        countComposition(
            counts
        );

    const lines =
        Object.entries(
            counts
        )
            .filter(
                (
                    [
                        ,
                        amount
                    ]
                ) =>
                    amount >
                    0
            )
            .map(
                (
                    [
                        roleId,
                        amount
                    ]
                ) => {
                    const role =
                        getRole(
                            roleId
                        );

                    return (
                        `${role?.emoji || "❔"} ${role?.name || roleId} ×**${amount}**`
                    );
                }
            );

    const validation =
        validateComposition(
            counts,
            game.players.length
        );

    const blockingErrors =
        getBlockingCompositionErrors(
            game,
            validation
        );

    return new EmbedBuilder()
        .setColor(
            blockingErrors.length ===
            0
                ? SUCCESS
                : WARNING
        )
        .setTitle(
            "🛠️ Composition personnalisée"
        )
        .setDescription(
`### 🎭 Cartes

${lines.length
    ? lines.join("\n")
    : "Aucun rôle sélectionné."}

### 🔢 Total

**${total}/${game.players.length} carte(s)**

${blockingErrors.length === 0
    ? "✅ La composition correspond au nombre actuel de joueurs."
    : "⚠️ La composition doit contenir exactement autant de cartes que de joueurs."}

### ⚠️ Validation

${blockingErrors.length
    ? blockingErrors
        .map(
            error =>
                `❌ ${error}`
        )
        .join(
            "\n"
        )
    : "✅ Aucune erreur bloquante."}

${validation.warnings.length
    ? `\n### 🟠 Avertissements\n${validation.warnings
        .slice(
            0,
            6
        )
        .map(
            warning =>
                `• ${warning}`
        )
        .join(
            "\n"
        )}`
    : ""}`
        );
}

// ======================================================
// ROLE GROUP EMBED
// ======================================================

function buildCustomGroupEmbed(
    game,
    groupId
) {
    const group =
        ROLE_GROUPS[
            groupId
        ];

    if (
        !group
    ) {
        return null;
    }

    const counts =
        game.customRoleCounts ||
        {};

    const lines =
        group.roles
            .filter(
                roleId =>
                    ROLES[
                        roleId
                    ]
            )
            .map(
                roleId => {
                    const role =
                        ROLES[
                            roleId
                        ];

                    const amount =
                        Number(
                            counts[
                                roleId
                            ]
                        ) ||
                        0;

                    return (
                        `${role.emoji} **${role.name}** — ×${amount}\n` +
                        `> ${role.description}`
                    );
                }
            )
            .join(
                "\n\n"
            );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            `${group.emoji} ${group.name}`
        )
        .setDescription(
            lines.slice(
                0,
                4000
            )
        );
}

// ======================================================
// ROLE SELECT
// ======================================================

function buildCustomRoleMenu(
    game,
    groupId
) {
    const group =
        ROLE_GROUPS[
            groupId
        ];

    if (
        !group
    ) {
        return null;
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `lg_custom_role_${game.id}_${groupId}`
            )
            .setPlaceholder(
                "Choisir un rôle à modifier"
            );

    for (
        const roleId
        of group.roles.slice(
            0,
            25
        )
    ) {
        const role =
            getRole(
                roleId
            );

        if (
            !role
        ) {
            continue;
        }

        const amount =
            Number(
                game.customRoleCounts
                    ?.[
                        roleId
                    ]
            ) ||
            0;

        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    role.name
                )
                .setValue(
                    roleId
                )
                .setEmoji(
                    role.emoji
                )
                .setDescription(
                    `Quantité actuelle : ${amount}`
                )
        );
    }

    return new ActionRowBuilder()
        .addComponents(
            menu
        );
}

// ======================================================
// ROLE EDIT
// ======================================================

function buildRoleEditEmbed(
    game,
    roleId
) {
    const role =
        getRole(
            roleId
        );

    if (
        !role
    ) {
        return null;
    }

    const amount =
        Number(
            game.customRoleCounts
                ?.[
                    roleId
                ]
        ) ||
        0;

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            `${role.emoji} ${role.name}`
        )
        .setDescription(
`${role.description}

### 🎭 Quantité actuelle

## ${amount}

### 🏕️ Camp

${getCampDisplay(
    role.camp
)}

### 👥 Recommandé à partir de

**${role.minPlayers || MIN_PLAYERS} joueurs**

${role.unique
    ? "⚠️ Ce rôle est **unique** : maximum 1 exemplaire."
    : "✅ Ce rôle peut avoir plusieurs exemplaires."}`
        );
}

function buildRoleEditButtons(
    game,
    roleId,
    groupId
) {
    const role =
        getRole(
            roleId
        );

    const amount =
        Number(
            game.customRoleCounts
                ?.[
                    roleId
                ]
        ) ||
        0;

    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_role_minus_${game.id}_${groupId}_${roleId}`
                    )
                    .setLabel(
                        "-1"
                    )
                    .setEmoji(
                        "➖"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        amount <=
                        0
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_role_plus_${game.id}_${groupId}_${roleId}`
                    )
                    .setLabel(
                        "+1"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        Boolean(
                            role?.unique &&
                            amount >=
                            1
                        )
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_role_group_back_${game.id}_${groupId}`
                    )
                    .setLabel(
                        "Retour"
                    )
                    .setEmoji(
                        "⬅️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

// ======================================================
// AUDIO CONFIG
// ======================================================

function buildAudioEmbed(
    game
) {
    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🎚️ Audio du Loup-Garou"
        )
        .setDescription(
`### 🗣️ Narrateur

**${Math.round(
    (
        game.config
            .narrationVolume ??
        1
    ) *
    100
)} %**

### 🔊 Effets sonores

**${Math.round(
    (
        game.config
            .soundVolume ??
        0.65
    ) *
    100
)} %**

### 🌙 Ambiance

**${Math.round(
    (
        game.config
            .ambienceVolume ??
        0.18
    ) *
    100
)} %**

### 🤫 Mode discret

${game.config.discreteMode
    ? "✅ Activé — narrateur uniquement."
    : "❌ Désactivé — sons et ambiances autorisés."}`
        );
}

function buildAudioComponents(
    game
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_narration_down_${game.id}`
                    )
                    .setLabel(
                        "Narrateur -"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_narration_up_${game.id}`
                    )
                    .setLabel(
                        "Narrateur +"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_sound_down_${game.id}`
                    )
                    .setLabel(
                        "Effets -"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_sound_up_${game.id}`
                    )
                    .setLabel(
                        "Effets +"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_ambience_down_${game.id}`
                    )
                    .setLabel(
                        "Ambiance -"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_ambience_up_${game.id}`
                    )
                    .setLabel(
                        "Ambiance +"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `lg_audio_back_${game.id}`
                    )
                    .setLabel(
                        "Retour"
                    )
                    .setEmoji(
                        "⬅️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

// ======================================================
// APPLY AUDIO SETTINGS
// ======================================================

function applyAudioRuntime(
    game
) {
    if (
        typeof voice.setVolumes ===
        "function"
    ) {
        voice.setVolumes(
            game.guildId,
            {
                narration:
                    game.config
                        .narrationVolume ??
                    1,

                sounds:
                    game.config
                        .soundVolume ??
                    0.65,

                ambience:
                    game.config
                        .ambienceVolume ??
                    0.18
            }
        );
    }

    if (
        typeof voice.setDiscreteMode ===
        "function"
    ) {
        voice.setDiscreteMode(
            game.guildId,
            Boolean(
                game.config
                    .discreteMode
            )
        );
    }
}

// ======================================================
// LOBBY UPDATE
// ======================================================

async function refreshLobbyMessage(
    interaction,
    game
) {
    if (
        interaction.message
    ) {
        return interaction.message
            .edit({
                embeds: [
                    buildLobbyEmbed(
                        game
                    )
                ],

                components:
                    buildLobbyComponents(
                        game
                    )
            })
            .catch(
                () => null
            );
    }

    return null;
}

// ======================================================
// STATUS EMBED
// ======================================================

function buildStatusEmbed(
    game
) {
    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🐺 État de la partie"
        )
        .setDescription(
`**ID :** \`${game.id}\`

**Statut :** ${game.status}

**Phase :** ${game.phase}

**Jour :** ${game.day}
**Nuit :** ${game.night}

**Joueurs :** ${game.players.length}

**Vivants :** ${game.players.filter(
    player =>
        player.alive
).length}

**Preset :** ${getPresetDisplay(
    game.config.presetId
)}

**Mode test :** ${game.config?.testMode
    ? "🧪 Oui"
    : "Non"}

**Vocal :** <#${game.voiceChannelId}>

**Hôte :** <@${game.hostId}>`
        )
        .setTimestamp();
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "loupgarou"
            )
            .setDescription(
                "Gérer une partie de Loup-Garou The Legacy"
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "lancer"
                        )
                        .setDescription(
                            "Créer une nouvelle partie"
                        )
                        .addBooleanOption(
                            option =>
                                option
                                    .setName(
                                        "test"
                                    )
                                    .setDescription(
                                        "Autoriser une partie de test avec moins de 5 joueurs"
                                    )
                                    .setRequired(
                                        false
                                    )
                        )
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "statut"
                        )
                        .setDescription(
                            "Afficher la partie actuellement active"
                        )
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "reprendre"
                        )
                        .setDescription(
                            "Reprendre une partie interrompue"
                        )
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "stop"
                        )
                        .setDescription(
                            "Arrêter la partie en cours"
                        )
            ),

    // ==================================================
    // EXECUTE
    // ==================================================

    async execute(
        interaction
    ) {
        const client =
            interaction.client;

        const subcommand =
            interaction.options
                .getSubcommand();

        // ==============================================
        // LANCER
        // ==============================================

        if (
            subcommand ===
            "lancer"
        ) {
            const testMode =
                interaction.options
                    .getBoolean(
                        "test"
                    ) ===
                true;

            const existing =
                getGuildGame(
                    interaction.guild.id
                );

            if (
                existing
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            `❌ Une partie est déjà active sur ce serveur.\n\nID : \`${existing.id}\``
                    }
                );
            }

            const voiceChannel =
                interaction.member
                    ?.voice
                    ?.channel;

            if (
                !voiceChannel
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Tu dois être dans un salon vocal pour créer une partie."
                    }
                );
            }

            const game =
                loupgarouSystem.createGame({
                    guildId:
                        interaction.guild.id,

                    channelId:
                        interaction.channel.id,

                    voiceChannelId:
                        voiceChannel.id,

                    hostId:
                        interaction.user.id,

                    presetId:
                        "classic"
                });

            game.config.testMode =
                testMode;

            game.config.discreteMode =
                false;

            game.config.narrationVolume =
                1;

            game.config.soundVolume =
                0.65;

            game.config.ambienceVolume =
                0.18;

            if (
                testMode
            ) {
                game.config.presetId =
                    "custom";

                game.customRoleCounts = {
                    wolf: 1
                };
            }

            const joined =
                loupgarouSystem.joinGame(
                    game,
                    interaction.user.id
                );

            if (
                !joined.ok
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            `❌ ${joined.reason}`
                    }
                );
            }

            updateTestComposition(
                game
            );

            saveGame(
                game
            );

            const message =
                await interaction.reply({
                    content:
                        testMode
                            ? "🧪 **Une partie de TEST Loup-Garou se prépare !**"
                            : "🐺 **Une nouvelle partie de Loup-Garou se prépare !**",

                    embeds: [
                        buildLobbyEmbed(
                            game
                        )
                    ],

                    components:
                        buildLobbyComponents(
                            game
                        ),

                    fetchReply:
                        true
                });

            game.messageId =
                message.id;

            saveGame(
                game
            );

            return;
        }

        // ==============================================
        // STATUT
        // ==============================================

        if (
            subcommand ===
            "statut"
        ) {
            const game =
                getGuildGame(
                    interaction.guild.id
                );

            if (
                !game
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Aucune partie active sur ce serveur."
                    }
                );
            }

            return replyPrivate(
                interaction,
                {
                    embeds: [
                        buildStatusEmbed(
                            game
                        )
                    ]
                }
            );
        }

        // ==============================================
        // REPRENDRE
        // ==============================================

        if (
            subcommand ===
            "reprendre"
        ) {
            const game =
                getGuildGame(
                    interaction.guild.id
                );

            if (
                !game
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Aucune partie active à reprendre."
                    }
                );
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Seul l'hôte ou un administrateur peut reprendre la partie."
                    }
                );
            }

            if (
                game.status !==
                "running"
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Cette partie n'est pas actuellement en cours."
                    }
                );
            }

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            applyAudioRuntime(
                game
            );

            const result =
                await loupgarouSystem.resumeGame(
                    client,
                    game
                );

            return interaction.editReply({
                content:
                    result.ok
                        ? "✅ La reprise de la partie a été lancée."
                        : `❌ ${result.reason}`
            });
        }

        // ==============================================
        // STOP
        // ==============================================

        if (
            subcommand ===
            "stop"
        ) {
            const game =
                getGuildGame(
                    interaction.guild.id
                );

            if (
                !game
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Aucune partie active."
                    }
                );
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Seul l'hôte ou un administrateur peut arrêter la partie."
                    }
                );
            }

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            await loupgarouSystem.cancelGame(
                client,
                game
            );

            return interaction.editReply({
                content:
                    "❌ La partie de Loup-Garou a été arrêtée."
            });
        }
    },

    // ==================================================
    // BUTTONS
    // ==================================================

    async handleButton(
        interaction
    ) {
        const id =
            interaction.customId;

        const client =
            interaction.client;

        // ==================================================
        // LOBBY JOIN
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_join_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_join_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game ||
                game.status !==
                "lobby"
            ) {
                return true;
            }

            if (
                interaction.member
                    ?.voice
                    ?.channelId !==
                game.voiceChannelId
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            `❌ Tu dois rejoindre <#${game.voiceChannelId}> avant de participer.`
                    }
                );

                return true;
            }

            const result =
                loupgarouSystem.joinGame(
                    game,
                    interaction.user.id
                );

            if (
                !result.ok
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            `⚠️ ${result.reason}`
                    }
                );

                return true;
            }

            updateTestComposition(
                game
            );

            await interaction.update({
                embeds: [
                    buildLobbyEmbed(
                        game
                    )
                ],

                components:
                    buildLobbyComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // LOBBY LEAVE
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_leave_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_leave_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game ||
                game.status !==
                "lobby"
            ) {
                return true;
            }

            if (
                interaction.user.id ===
                game.hostId
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ L'hôte ne peut pas quitter son propre lobby. Utilise **Annuler**."
                    }
                );

                return true;
            }

            const result =
                loupgarouSystem.leaveGame(
                    game,
                    interaction.user.id
                );

            if (
                !result.ok
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            `❌ ${result.reason}`
                    }
                );

                return true;
            }

            updateTestComposition(
                game
            );

            await interaction.update({
                embeds: [
                    buildLobbyEmbed(
                        game
                    )
                ],

                components:
                    buildLobbyComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // CONFIG
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_config_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_config_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Seul l'hôte ou un administrateur peut modifier la configuration."
                    }
                );

                return true;
            }

            await replyPrivate(
                interaction,
                {
                    embeds: [
                        buildConfigEmbed(
                            game
                        )
                    ],

                    components:
                        buildConfigComponents(
                            game
                        )
                }
            );

            return true;
        }

        // ==================================================
        // PUBLIC RULES
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_rules_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_rules_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            await replyPrivate(
                interaction,
                {
                    embeds: [
                        buildActiveRulesEmbed(
                            game
                        )
                    ]
                }
            );

            return true;
        }

        // ==================================================
        // START
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_start_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_start_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game ||
                game.status !==
                "lobby"
            ) {
                return true;
            }

            if (
                interaction.user.id !==
                game.hostId
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Seul l'hôte peut démarrer la partie."
                    }
                );

                return true;
            }

            if (
                !game.config?.testMode &&
                game.players.length <
                MIN_PLAYERS
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            `❌ Il faut au moins **${MIN_PLAYERS} joueurs**.`
                    }
                );

                return true;
            }

            if (
                game.config?.testMode
            ) {
                updateTestComposition(
                    game
                );
            }

            const composition =
                resolveCurrentComposition(
                    game
                );

            const blockingErrors =
                getBlockingCompositionErrors(
                    game,
                    composition.validation
                );

            if (
                blockingErrors.length
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
`❌ La composition n'est pas valide.

${blockingErrors
    .map(
        error =>
            `• ${error}`
    )
    .join(
        "\n"
    )}`
                    }
                );

                return true;
            }

            await interaction.deferUpdate();

            applyAudioRuntime(
                game
            );

            const result =
                await loupgarouSystem.startGame(
                    client,
                    game
                );

            if (
                !result.ok
            ) {
                await interaction.followUp({
                    content:
                        `❌ Impossible de démarrer :\n${result.reason}`,

                    flags:
                        MessageFlags.Ephemeral
                });

                await refreshLobbyMessage(
                    interaction,
                    game
                );

                return true;
            }

            await interaction.message.edit({
                content:
                    game.config?.testMode
                        ? "🧪 **Le test commence. Les rôles sont envoyés en message privé...**"
                        : "🐺 **La partie commence. Les rôles sont envoyés en message privé...**",

                embeds: [
                    loupgarouSystem.buildGameEmbed(
                        game
                    )
                ],

                components:
                    []
            }).catch(
                () => {}
            );

            if (
                result.warnings
                    ?.length
            ) {
                await interaction.followUp({
                    content:
`⚠️ Partie lancée avec quelques avertissements :

${result.warnings
    .map(
        warning =>
            `• ${warning}`
    )
    .join(
        "\n"
    )}`,

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return true;
        }

        // ==================================================
        // CANCEL
        // ==================================================

        if (
            id.startsWith(
                "lg_lobby_cancel_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_lobby_cancel_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                interaction.user.id !==
                    game.hostId &&
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Seul l'hôte ou un administrateur peut annuler la partie."
                    }
                );

                return true;
            }

            await loupgarouSystem.cancelGame(
                client,
                game
            );

            await interaction.update({
                content:
                    "❌ **La partie de Loup-Garou a été annulée.**",

                embeds:
                    [],

                components:
                    []
            });

            return true;
        }

        // ==================================================
        // CONFIG TOGGLES
        // ==================================================

        const configToggles = {
            "lg_config_mayor_":
                "mayorElection",

            "lg_config_votes_":
                "anonymousVotes",

            "lg_config_hardcore_":
                "hardcore",

            "lg_config_ambience_":
                "ambience",

            "lg_config_discrete_":
                "discreteMode"
        };

        for (
            const [
                prefix,
                property
            ]
            of Object.entries(
                configToggles
            )
        ) {
            if (
                !id.startsWith(
                    prefix
                )
            ) {
                continue;
            }

            const gameId =
                id.slice(
                    prefix.length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                await replyPrivate(
                    interaction,
                    {
                        content:
                            "❌ Tu ne peux pas modifier cette configuration."
                    }
                );

                return true;
            }

            const before =
                JSON.parse(
                    JSON.stringify(
                        game.config
                    )
                );

            game.config[
                property
            ] =
                !Boolean(
                    game.config[
                        property
                    ]
                );

            if (
                property ===
                "hardcore"
            ) {
                game.config
                    .revealRolesOnDeath =
                    !game.config
                        .hardcore;
            }

            saveGame(
                game
            );

            if (
                property ===
                    "discreteMode" ||
                property ===
                    "ambience"
            ) {
                applyAudioRuntime(
                    game
                );
            }

            const changes =
                compareConfigs(
                    before,
                    game.config
                );

            if (
                property ===
                "discreteMode"
            ) {
                changes.push(
                    game.config
                        .discreteMode
                        ? "🤫 Mode discret activé : les effets et ambiances sont coupés."
                        : "🔊 Mode discret désactivé : les effets sonores sont de nouveau disponibles."
                );
            }

            await interaction.update({
                embeds: [
                    buildConfigEmbed(
                        game,
                        changes
                    )
                ],

                components:
                    buildConfigComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // CUSTOM ROLES HOME
        // ==================================================

        if (
            id.startsWith(
                "lg_config_roles_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_config_roles_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return true;
            }

            game.config.presetId =
                "custom";

            saveGame(
                game
            );

            await interaction.update({
                embeds: [
                    buildCustomHomeEmbed(
                        game
                    )
                ],

                components: [
                    buildRoleGroupMenu(
                        game
                    ),

                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `lg_custom_back_${game.id}`
                                )
                                .setLabel(
                                    "Retour"
                                )
                                .setEmoji(
                                    "⬅️"
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        )
                ]
            });

            return true;
        }

        // ==================================================
        // ACTIVE RULES CONFIG
        // ==================================================

        if (
            id.startsWith(
                "lg_config_rules_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_config_rules_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    buildActiveRulesEmbed(
                        game
                    )
                ],

                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `lg_rules_back_${game.id}`
                                )
                                .setLabel(
                                    "Retour"
                                )
                                .setEmoji(
                                    "⬅️"
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        )
                ]
            });

            return true;
        }

        // ==================================================
        // AUDIO HOME
        // ==================================================

        if (
            id.startsWith(
                "lg_config_audio_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_config_audio_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    buildAudioEmbed(
                        game
                    )
                ],

                components:
                    buildAudioComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // AUDIO VOLUMES
        // ==================================================

        const audioPrefixes = [
            {
                prefix:
                    "lg_audio_narration_down_",

                key:
                    "narrationVolume",

                delta:
                    -0.1
            },

            {
                prefix:
                    "lg_audio_narration_up_",

                key:
                    "narrationVolume",

                delta:
                    0.1
            },

            {
                prefix:
                    "lg_audio_sound_down_",

                key:
                    "soundVolume",

                delta:
                    -0.1
            },

            {
                prefix:
                    "lg_audio_sound_up_",

                key:
                    "soundVolume",

                delta:
                    0.1
            },

            {
                prefix:
                    "lg_audio_ambience_down_",

                key:
                    "ambienceVolume",

                delta:
                    -0.05
            },

            {
                prefix:
                    "lg_audio_ambience_up_",

                key:
                    "ambienceVolume",

                delta:
                    0.05
            }
        ];

        for (
            const config
            of audioPrefixes
        ) {
            if (
                !id.startsWith(
                    config.prefix
                )
            ) {
                continue;
            }

            const gameId =
                id.slice(
                    config.prefix.length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return true;
            }

            const defaults = {
                narrationVolume:
                    1,

                soundVolume:
                    0.65,

                ambienceVolume:
                    0.18
            };

            const current =
                Number(
                    game.config[
                        config.key
                    ] ??
                    defaults[
                        config.key
                    ]
                );

            game.config[
                config.key
            ] =
                Math.max(
                    0,
                    Math.min(
                        2,
                        Math.round(
                            (
                                current +
                                config.delta
                            ) *
                            100
                        ) /
                        100
                    )
                );

            saveGame(
                game
            );

            applyAudioRuntime(
                game
            );

            await interaction.update({
                embeds: [
                    buildAudioEmbed(
                        game
                    )
                ],

                components:
                    buildAudioComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // ROLE + / -
        // ==================================================

        for (
            const mode
            of [
                "minus",
                "plus"
            ]
        ) {
            const prefix =
                `lg_role_${mode}_`;

            if (
                !id.startsWith(
                    prefix
                )
            ) {
                continue;
            }

            const rest =
                id.slice(
                    prefix.length
                );

            const separator =
                rest.indexOf(
                    "_"
                );

            if (
                separator ===
                -1
            ) {
                return true;
            }

            const gameId =
                rest.slice(
                    0,
                    separator
                );

            const remainder =
                rest.slice(
                    separator +
                    1
                );

            let matchedGroupId =
                null;

            for (
                const groupId
                of Object.keys(
                    ROLE_GROUPS
                )
            ) {
                if (
                    remainder.startsWith(
                        `${groupId}_`
                    )
                ) {
                    matchedGroupId =
                        groupId;

                    break;
                }
            }

            if (
                !matchedGroupId
            ) {
                return true;
            }

            const roleId =
                remainder.slice(
                    matchedGroupId.length +
                    1
                );

            const game =
                getGame(
                    gameId
                );

            const role =
                getRole(
                    roleId
                );

            if (
                !game ||
                !role
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return true;
            }

            const before =
                JSON.parse(
                    JSON.stringify(
                        game.customRoleCounts ||
                        {}
                    )
                );

            const current =
                Number(
                    game.customRoleCounts
                        ?.[
                            roleId
                        ]
                ) ||
                0;

            if (
                mode ===
                "plus"
            ) {
                if (
                    role.unique &&
                    current >=
                    1
                ) {
                    return true;
                }

                game.customRoleCounts[
                    roleId
                ] =
                    current +
                    1;

            } else {
                game.customRoleCounts[
                    roleId
                ] =
                    Math.max(
                        0,
                        current -
                        1
                    );

                if (
                    game.customRoleCounts[
                        roleId
                    ] ===
                    0
                ) {
                    delete game
                        .customRoleCounts[
                            roleId
                        ];
                }
            }

            game.config.presetId =
                "custom";

            saveGame(
                game
            );

            const changes =
                compareRoleCounts(
                    before,
                    game.customRoleCounts
                );

            await interaction.update({
                embeds: [
                    buildRoleEditEmbed(
                        game,
                        roleId
                    )
                ],

                components:
                    buildRoleEditButtons(
                        game,
                        roleId,
                        matchedGroupId
                    )
            });

            if (
                changes.length
            ) {
                await interaction.followUp({
                    content:
                        changes.join(
                            "\n"
                        ),

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            return true;
        }

        // ==================================================
        // GROUP BACK
        // ==================================================

        if (
            id.startsWith(
                "lg_role_group_back_"
            )
        ) {
            const rest =
                id.slice(
                    "lg_role_group_back_".length
                );

            const separator =
                rest.indexOf(
                    "_"
                );

            if (
                separator ===
                -1
            ) {
                return true;
            }

            const gameId =
                rest.slice(
                    0,
                    separator
                );

            const groupId =
                rest.slice(
                    separator +
                    1
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            const menu =
                buildCustomRoleMenu(
                    game,
                    groupId
                );

            await interaction.update({
                embeds: [
                    buildCustomGroupEmbed(
                        game,
                        groupId
                    )
                ],

                components:
                    menu
                        ? [
                            menu,

                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(
                                            `lg_custom_roles_back_${game.id}`
                                        )
                                        .setLabel(
                                            "Retour aux groupes"
                                        )
                                        .setEmoji(
                                            "⬅️"
                                        )
                                        .setStyle(
                                            ButtonStyle.Secondary
                                        )
                                )
                        ]
                        : []
            });

            return true;
        }

        // ==================================================
        // RETURN TO GROUPS
        // ==================================================

        if (
            id.startsWith(
                "lg_custom_roles_back_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_custom_roles_back_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    buildCustomHomeEmbed(
                        game
                    )
                ],

                components: [
                    buildRoleGroupMenu(
                        game
                    ),

                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `lg_custom_back_${game.id}`
                                )
                                .setLabel(
                                    "Retour"
                                )
                                .setEmoji(
                                    "⬅️"
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        )
                ]
            });

            return true;
        }

        // ==================================================
        // BACK CONFIG
        // ==================================================

        const backPrefixes = [
            "lg_config_back_",
            "lg_custom_back_",
            "lg_rules_back_",
            "lg_audio_back_"
        ];

        for (
            const prefix
            of backPrefixes
        ) {
            if (
                !id.startsWith(
                    prefix
                )
            ) {
                continue;
            }

            const gameId =
                id.slice(
                    prefix.length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                prefix ===
                "lg_config_back_"
            ) {
                await interaction.update({
                    embeds: [
                        buildLobbyEmbed(
                            game
                        )
                    ],

                    components:
                        buildLobbyComponents(
                            game
                        )
                });

                return true;
            }

            await interaction.update({
                embeds: [
                    buildConfigEmbed(
                        game
                    )
                ],

                components:
                    buildConfigComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // ENGINE BUTTONS
        // ==================================================

        const handledByEngine =
            await loupgarouSystem.handleButton(
                interaction,
                client
            );

        return Boolean(
            handledByEngine
        );
    },

    // ==================================================
    // SELECTS
    // ==================================================

    async handleSelect(
        interaction
    ) {
        const id =
            interaction.customId;

        const client =
            interaction.client;

        // ==================================================
        // PRESET
        // ==================================================

        if (
            id.startsWith(
                "lg_config_preset_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_config_preset_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            if (
                !isHostOrAdmin(
                    interaction,
                    game
                )
            ) {
                return true;
            }

            const presetId =
                interaction.values[
                    0
                ];

            const beforeConfig =
                JSON.parse(
                    JSON.stringify(
                        game.config
                    )
                );

            const beforeRoles =
                resolveCurrentComposition(
                    game
                ).roleCounts;

            if (
                presetId ===
                "custom"
            ) {
                game.config.presetId =
                    "custom";

                saveGame(
                    game
                );

            } else if (
                ALLOWED_PRESETS.includes(
                    presetId
                )
            ) {
                const result =
                    loupgarouSystem.applyPreset(
                        game,
                        presetId
                    );

                if (
                    !result.ok
                ) {
                    await replyPrivate(
                        interaction,
                        {
                            content:
                                `❌ ${result.reason}`
                        }
                    );

                    return true;
                }
            }

            /*
             * En mode test, si on est encore à moins de 5 joueurs,
             * on conserve une composition réellement lançable.
             */
            if (
                game.config?.testMode &&
                game.players.length <
                MIN_PLAYERS
            ) {
                updateTestComposition(
                    game
                );
            }

            const afterRoles =
                resolveCurrentComposition(
                    game
                ).roleCounts;

            const changes = [
                ...compareConfigs(
                    beforeConfig,
                    game.config
                ),

                ...compareRoleCounts(
                    beforeRoles,
                    afterRoles
                )
            ];

            if (
                !changes.length
            ) {
                changes.push(
                    `🎮 Preset sélectionné : ${getPresetDisplay(
                        game.config.presetId
                    )}.`
                );
            }

            await interaction.update({
                embeds: [
                    buildConfigEmbed(
                        game,
                        changes.slice(
                            0,
                            12
                        )
                    )
                ],

                components:
                    buildConfigComponents(
                        game
                    )
            });

            return true;
        }

        // ==================================================
        // CUSTOM GROUP
        // ==================================================

        if (
            id.startsWith(
                "lg_custom_group_"
            )
        ) {
            const gameId =
                id.slice(
                    "lg_custom_group_".length
                );

            const game =
                getGame(
                    gameId
                );

            if (
                !game
            ) {
                return true;
            }

            const groupId =
                interaction.values[
                    0
                ];

            const embed =
                buildCustomGroupEmbed(
                    game,
                    groupId
                );

            const menu =
                buildCustomRoleMenu(
                    game,
                    groupId
                );

            if (
                !embed ||
                !menu
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    embed
                ],

                components: [
                    menu,

                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `lg_custom_roles_back_${game.id}`
                                )
                                .setLabel(
                                    "Retour aux groupes"
                                )
                                .setEmoji(
                                    "⬅️"
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        )
                ]
            });

            return true;
        }

        // ==================================================
        // CUSTOM ROLE
        // ==================================================

        if (
            id.startsWith(
                "lg_custom_role_"
            )
        ) {
            const rest =
                id.slice(
                    "lg_custom_role_".length
                );

            const separator =
                rest.indexOf(
                    "_"
                );

            if (
                separator ===
                -1
            ) {
                return true;
            }

            const gameId =
                rest.slice(
                    0,
                    separator
                );

            const groupId =
                rest.slice(
                    separator +
                    1
                );

            const roleId =
                interaction.values[
                    0
                ];

            const game =
                getGame(
                    gameId
                );

            if (
                !game ||
                !getRole(
                    roleId
                )
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    buildRoleEditEmbed(
                        game,
                        roleId
                    )
                ],

                components:
                    buildRoleEditButtons(
                        game,
                        roleId,
                        groupId
                    )
            });

            return true;
        }

        // ==================================================
        // ENGINE SELECTS
        // ==================================================

        const handledByEngine =
            await loupgarouSystem.handleSelect(
                interaction,
                client
            );

        return Boolean(
            handledByEngine
        );
    },

    // ==================================================
    // EXPORT POUR INDEX
    // ==================================================

    loupgarouSystem
};