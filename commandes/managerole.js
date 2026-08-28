const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    getRules,
    getRule,
    saveRule,
    deleteRule,
    toggleRule,
    createRuleId
} = require("../utils/manageRoleStore");

// ======================================================
// DRAFTS EN COURS
// ======================================================

const drafts =
    new Map();

// ======================================================
// HELPERS
// ======================================================

function draftKey(
    interaction
) {
    return (
        `${interaction.guild.id}:` +
        `${interaction.user.id}`
    );
}

function createEmptyDraft(
    interaction
) {
    return {
        id:
            createRuleId(),

        guildId:
            interaction.guild.id,

        enabled:
            true,

        triggerRoleIds:
            [],

        condition:
            "any",

        onMatchAddRoleIds:
            [],

        onMatchRemoveRoleIds:
            [],

        onUnmatchAddRoleIds:
            [],

        onUnmatchRemoveRoleIds:
            [],

        createdBy:
            interaction.user.id,

        createdAt:
            Date.now(),

        updatedBy:
            interaction.user.id,

        updatedAt:
            Date.now(),

        editingExisting:
            false
    };
}

function setDraft(
    interaction,
    draft
) {
    drafts.set(
        draftKey(
            interaction
        ),
        draft
    );

    return draft;
}

function getDraft(
    interaction
) {
    return drafts.get(
        draftKey(
            interaction
        )
    ) ||
    null;
}

function clearDraft(
    interaction
) {
    drafts.delete(
        draftKey(
            interaction
        )
    );
}

// ======================================================
// FORMAT ROLES
// ======================================================

function formatRoles(
    roleIds
) {
    if (
        !Array.isArray(
            roleIds
        ) ||
        !roleIds.length
    ) {
        return "*Aucun rôle sélectionné*";
    }

    return roleIds
        .map(
            roleId =>
                `<@&${roleId}>`
        )
        .join(
            "\n"
        );
}

// ======================================================
// MAIN PANEL
// ======================================================

function createMainEmbed(
    interaction
) {
    const rules =
        getRules(
            interaction.guild.id
        );

    const enabled =
        rules.filter(
            rule =>
                rule.enabled
        ).length;

    return new EmbedBuilder()
        .setColor(
            0x2B2D31
        )
        .setTitle(
            "🧩 Gestion automatique des rôles"
        )
        .setDescription(
`Configure directement depuis Discord les rôles qui doivent être **ajoutés ou retirés automatiquement** lorsqu'un membre obtient ou perd certains rôles.

**Règles enregistrées :** ${rules.length}
**Règles actives :** ${enabled}

> Une règle peut contenir **plusieurs rôles déclencheurs** et appliquer **plusieurs rôles simultanément**.`
        )
        .setFooter({
            text:
                "The Legacy • ManageRole"
        });
}

function createMainRows() {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_create"
                    )
                    .setLabel(
                        "Créer une règle"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_list"
                    )
                    .setLabel(
                        "Liste des rôles aménagés"
                    )
                    .setEmoji(
                        "📋"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            )
    ];
}

// ======================================================
// EDITOR
// ======================================================

function createEditorEmbed(
    draft
) {
    return new EmbedBuilder()
        .setColor(
            0x5865F2
        )
        .setTitle(
            draft.editingExisting
                ? "✏️ Modifier une règle"
                : "➕ Nouvelle règle"
        )
        .setDescription(
`### 🎯 Rôles déclencheurs
${formatRoles(draft.triggerRoleIds)}

**Condition :**
${draft.condition === "all"
    ? "Tous les rôles doivent être présents"
    : "Au moins un des rôles doit être présent"}

### ✅ Quand la condition est remplie

**➕ Ajouter :**
${formatRoles(draft.onMatchAddRoleIds)}

**➖ Retirer :**
${formatRoles(draft.onMatchRemoveRoleIds)}

### ❌ Quand la condition n'est plus remplie

**➕ Ajouter :**
${formatRoles(draft.onUnmatchAddRoleIds)}

**➖ Retirer :**
${formatRoles(draft.onUnmatchRemoveRoleIds)}`
        )
        .setFooter({
            text:
                `ID : ${draft.id}`
        });
}

function createEditorRows(
    draft
) {
    return [
        // ==================================================
        // TRIGGERS
        // ==================================================

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_trigger"
                    )
                    .setLabel(
                        "Rôles déclencheurs"
                    )
                    .setEmoji(
                        "🎯"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_condition"
                    )
                    .setLabel(
                        draft.condition ===
                            "all"
                            ? "Condition : Tous"
                            : "Condition : Au moins un"
                    )
                    .setEmoji(
                        "⚙️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            ),

        // ==================================================
        // CONDITION TRUE
        // ==================================================

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_match_add"
                    )
                    .setLabel(
                        "Si vrai : Ajouter"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_match_remove"
                    )
                    .setLabel(
                        "Si vrai : Retirer"
                    )
                    .setEmoji(
                        "➖"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            ),

        // ==================================================
        // CONDITION FALSE
        // ==================================================

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_unmatch_add"
                    )
                    .setLabel(
                        "Si perdu : Ajouter"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_unmatch_remove"
                    )
                    .setLabel(
                        "Si perdu : Retirer"
                    )
                    .setEmoji(
                        "➖"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            ),

        // ==================================================
        // SAVE
        // ==================================================

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_save"
                    )
                    .setLabel(
                        "Enregistrer"
                    )
                    .setEmoji(
                        "💾"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_cancel"
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
            )
    ];
}

// ======================================================
// ROLE SELECT
// ======================================================

function createRoleSelector(
    customId,
    placeholder,
    currentRoleIds = []
) {
    const selector =
        new RoleSelectMenuBuilder()
            .setCustomId(
                customId
            )
            .setPlaceholder(
                placeholder
            )
            .setMinValues(
                1
            )
            .setMaxValues(
                20
            );

    if (
        Array.isArray(
            currentRoleIds
        ) &&
        currentRoleIds.length
    ) {
        selector.setDefaultRoles(
            currentRoleIds.slice(
                0,
                20
            )
        );
    }

    return new ActionRowBuilder()
        .addComponents(
            selector
        );
}

// ======================================================
// RULE LIST
// ======================================================

function createRulesListEmbed(
    interaction
) {
    const rules =
        getRules(
            interaction.guild.id
        );

    if (
        !rules.length
    ) {
        return new EmbedBuilder()
            .setColor(
                0x2B2D31
            )
            .setTitle(
                "📋 Rôles aménagés"
            )
            .setDescription(
                "Aucune règle automatique n'est actuellement enregistrée."
            );
    }

    const lines =
        rules
            .slice(
                0,
                25
            )
            .map(
                (
                    rule,
                    index
                ) => {
                    const trigger =
                        rule.triggerRoleIds?.[0]
                            ? `<@&${rule.triggerRoleIds[0]}>`
                            : "Aucun déclencheur";

                    const more =
                        Math.max(
                            0,
                            (
                                rule.triggerRoleIds?.length ||
                                0
                            ) -
                            1
                        );

                    return (
                        `**${index + 1}.** ` +
                        `${rule.enabled ? "🟢" : "🔴"} ` +
                        `${trigger}` +
                        `${more ? ` +${more}` : ""}`
                    );
                }
            );

    return new EmbedBuilder()
        .setColor(
            0x2B2D31
        )
        .setTitle(
            "📋 Liste des rôles aménagés"
        )
        .setDescription(
            lines.join(
                "\n"
            )
        );
}

function createRulesListRows(
    interaction
) {
    const rules =
        getRules(
            interaction.guild.id
        )
            .slice(
                0,
                25
            );

    const rows =
        [];

    if (
        rules.length
    ) {
        const select =
            new StringSelectMenuBuilder()
                .setCustomId(
                    "managerole_rule_select"
                )
                .setPlaceholder(
                    "Choisir une fonction aménagée"
                )
                .addOptions(
                    rules.map(
                        (
                            rule,
                            index
                        ) => ({
                            label:
                                `Règle ${index + 1}`,

                            description:
                                rule.enabled
                                    ? "Règle activée"
                                    : "Règle désactivée",

                            value:
                                rule.id,

                            emoji:
                                rule.enabled
                                    ? "🟢"
                                    : "🔴"
                        })
                    )
                );

        rows.push(
            new ActionRowBuilder()
                .addComponents(
                    select
                )
        );
    }

    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "managerole_create"
                    )
                    .setLabel(
                        "Nouvelle règle"
                    )
                    .setEmoji(
                        "➕"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_home"
                    )
                    .setLabel(
                        "Retour"
                    )
                    .setEmoji(
                        "◀️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    );

    return rows;
}

// ======================================================
// DETAIL RULE
// ======================================================

function createRuleDetailEmbed(
    rule
) {
    return new EmbedBuilder()
        .setColor(
            rule.enabled
                ? 0x57F287
                : 0xED4245
        )
        .setTitle(
            "🧩 Fonction aménagée"
        )
        .setDescription(
`**Statut :** ${rule.enabled ? "🟢 Activée" : "🔴 Désactivée"}

### 🎯 Déclencheurs
${formatRoles(rule.triggerRoleIds)}

**Condition :**
${rule.condition === "all"
    ? "Tous les rôles"
    : "Au moins un rôle"}

### ✅ Condition remplie

**➕ Ajouter**
${formatRoles(rule.onMatchAddRoleIds)}

**➖ Retirer**
${formatRoles(rule.onMatchRemoveRoleIds)}

### ❌ Condition perdue

**➕ Ajouter**
${formatRoles(rule.onUnmatchAddRoleIds)}

**➖ Retirer**
${formatRoles(rule.onUnmatchRemoveRoleIds)}`
        )
        .setFooter({
            text:
                `ID : ${rule.id}`
        });
}

function createRuleDetailRows(
    rule
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `managerole_edit_${rule.id}`
                    )
                    .setLabel(
                        "Modifier"
                    )
                    .setEmoji(
                        "✏️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `managerole_toggle_${rule.id}`
                    )
                    .setLabel(
                        rule.enabled
                            ? "Désactiver"
                            : "Activer"
                    )
                    .setEmoji(
                        rule.enabled
                            ? "⏸️"
                            : "▶️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `managerole_sync_${rule.id}`
                    )
                    .setLabel(
                        "Synchroniser"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `managerole_delete_${rule.id}`
                    )
                    .setLabel(
                        "Supprimer"
                    )
                    .setEmoji(
                        "🗑️"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "managerole_list"
                    )
                    .setLabel(
                        "Retour à la liste"
                    )
                    .setEmoji(
                        "◀️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            )
    ];
}

// ======================================================
// VALIDATION
// ======================================================

function validateDraft(
    interaction,
    draft
) {
    if (
        !draft.triggerRoleIds.length
    ) {
        return "❌ Tu dois sélectionner au moins un rôle déclencheur.";
    }

    const hasActions =
        draft.onMatchAddRoleIds.length ||
        draft.onMatchRemoveRoleIds.length ||
        draft.onUnmatchAddRoleIds.length ||
        draft.onUnmatchRemoveRoleIds.length;

    if (
        !hasActions
    ) {
        return "❌ Cette règle ne contient encore aucune action.";
    }

    const everyRoleId =
        interaction.guild.id;

    const allSelected =
        [
            ...draft.triggerRoleIds,
            ...draft.onMatchAddRoleIds,
            ...draft.onMatchRemoveRoleIds,
            ...draft.onUnmatchAddRoleIds,
            ...draft.onUnmatchRemoveRoleIds
        ];

    if (
        allSelected.includes(
            everyRoleId
        )
    ) {
        return "❌ Le rôle `@everyone` ne peut pas être utilisé.";
    }

    // Les rôles d'action doivent être sous le bot.
    const actionRoleIds =
        new Set([
            ...draft.onMatchAddRoleIds,
            ...draft.onMatchRemoveRoleIds,
            ...draft.onUnmatchAddRoleIds,
            ...draft.onUnmatchRemoveRoleIds
        ]);

    const botMember =
        interaction.guild.members.me;

    for (
        const roleId
        of actionRoleIds
    ) {
        const role =
            interaction.guild.roles.cache.get(
                roleId
            );

        if (
            !role
        ) {
            return `❌ Le rôle \`${roleId}\` est introuvable.`;
        }

        if (
            role.managed
        ) {
            return `❌ ${role} est géré par Discord ou une intégration et ne peut pas être automatisé.`;
        }

        if (
            !botMember ||
            botMember.roles.highest.position <=
                role.position
        ) {
            return `❌ Le rôle ${role} est placé au-dessus du bot.`;
        }
    }

    return null;
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "managerole"
            )
            .setDescription(
                "Gérer les automatisations de rôles"
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageRoles
            ),

    async execute(
        interaction
    ) {
        return interaction.reply({
            embeds: [
                createMainEmbed(
                    interaction
                )
            ],

            components:
                createMainRows(),

            flags:
                MessageFlags.Ephemeral
        });
    },

    // ==================================================
    // BUTTON
    // ==================================================

    async handleButton(
        interaction,
        client
    ) {
        if (
            !interaction.customId.startsWith(
                "managerole_"
            )
        ) {
            return false;
        }

        // ==================================================
        // HOME
        // ==================================================

        if (
            interaction.customId ===
            "managerole_home"
        ) {
            clearDraft(
                interaction
            );

            await interaction.update({
                embeds: [
                    createMainEmbed(
                        interaction
                    )
                ],

                components:
                    createMainRows()
            });

            return true;
        }

        // ==================================================
        // CREATE
        // ==================================================

        if (
            interaction.customId ===
            "managerole_create"
        ) {
            const draft =
                setDraft(
                    interaction,
                    createEmptyDraft(
                        interaction
                    )
                );

            await interaction.update({
                embeds: [
                    createEditorEmbed(
                        draft
                    )
                ],

                components:
                    createEditorRows(
                        draft
                    )
            });

            return true;
        }

        // ==================================================
        // LIST
        // ==================================================

        if (
            interaction.customId ===
            "managerole_list"
        ) {
            clearDraft(
                interaction
            );

            await interaction.update({
                embeds: [
                    createRulesListEmbed(
                        interaction
                    )
                ],

                components:
                    createRulesListRows(
                        interaction
                    )
            });

            return true;
        }

        // ==================================================
        // CANCEL
        // ==================================================

        if (
            interaction.customId ===
            "managerole_cancel"
        ) {
            clearDraft(
                interaction
            );

            await interaction.update({
                embeds: [
                    createMainEmbed(
                        interaction
                    )
                ],

                components:
                    createMainRows()
            });

            return true;
        }

        // ==================================================
        // CONDITION
        // ==================================================

        if (
            interaction.customId ===
            "managerole_condition"
        ) {
            const draft =
                getDraft(
                    interaction
                );

            if (
                !draft
            ) {
                return interaction.reply({
                    content:
                        "❌ Ta configuration a expiré. Relance `/managerole`.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            draft.condition =
                draft.condition ===
                    "any"
                    ? "all"
                    : "any";

            draft.updatedAt =
                Date.now();

            setDraft(
                interaction,
                draft
            );

            await interaction.update({
                embeds: [
                    createEditorEmbed(
                        draft
                    )
                ],

                components:
                    createEditorRows(
                        draft
                    )
            });

            return true;
        }

        // ==================================================
        // ROLE SELECT BUTTONS
        // ==================================================

        const selectorMap = {
            managerole_trigger: {
                customId:
                    "managerole_select_trigger",

                placeholder:
                    "Sélectionne le(s) rôle(s) déclencheur(s)",

                property:
                    "triggerRoleIds"
            },

            managerole_match_add: {
                customId:
                    "managerole_select_match_add",

                placeholder:
                    "Rôles à AJOUTER quand la condition est vraie",

                property:
                    "onMatchAddRoleIds"
            },

            managerole_match_remove: {
                customId:
                    "managerole_select_match_remove",

                placeholder:
                    "Rôles à RETIRER quand la condition est vraie",

                property:
                    "onMatchRemoveRoleIds"
            },

            managerole_unmatch_add: {
                customId:
                    "managerole_select_unmatch_add",

                placeholder:
                    "Rôles à AJOUTER lorsque la condition est perdue",

                property:
                    "onUnmatchAddRoleIds"
            },

            managerole_unmatch_remove: {
                customId:
                    "managerole_select_unmatch_remove",

                placeholder:
                    "Rôles à RETIRER lorsque la condition est perdue",

                property:
                    "onUnmatchRemoveRoleIds"
            }
        };

        if (
            selectorMap[
                interaction.customId
            ]
        ) {
            const draft =
                getDraft(
                    interaction
                );

            if (
                !draft
            ) {
                return interaction.reply({
                    content:
                        "❌ Ta configuration a expiré.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const selector =
                selectorMap[
                    interaction.customId
                ];

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0x5865F2
                        )
                        .setTitle(
                            "🎭 Sélection des rôles"
                        )
                        .setDescription(
                            selector.placeholder
                        )
                ],

                components: [
                    createRoleSelector(
                        selector.customId,
                        selector.placeholder,
                        draft[
                            selector.property
                        ]
                    ),

                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "managerole_editor_back"
                                )
                                .setLabel(
                                    "Retour sans modifier"
                                )
                                .setEmoji(
                                    "◀️"
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
        // BACK EDITOR
        // ==================================================

        if (
            interaction.customId ===
            "managerole_editor_back"
        ) {
            const draft =
                getDraft(
                    interaction
                );

            if (
                !draft
            ) {
                return true;
            }

            await interaction.update({
                embeds: [
                    createEditorEmbed(
                        draft
                    )
                ],

                components:
                    createEditorRows(
                        draft
                    )
            });

            return true;
        }

        // ==================================================
        // SAVE
        // ==================================================

        if (
            interaction.customId ===
            "managerole_save"
        ) {
            const draft =
                getDraft(
                    interaction
                );

            if (
                !draft
            ) {
                return interaction.reply({
                    content:
                        "❌ Ta configuration a expiré.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const error =
                validateDraft(
                    interaction,
                    draft
                );

            if (
                error
            ) {
                return interaction.reply({
                    content:
                        error,

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            draft.updatedAt =
                Date.now();

            draft.updatedBy =
                interaction.user.id;

            saveRule(
                draft
            );

            clearDraft(
                interaction
            );

            await interaction.update({
                embeds: [
                    createRuleDetailEmbed(
                        draft
                    )
                ],

                components:
                    createRuleDetailRows(
                        draft
                    )
            });

            await interaction.followUp({
                content:
                    "✅ Règle automatique enregistrée.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==================================================
        // EDIT
        // ==================================================

        if (
            interaction.customId.startsWith(
                "managerole_edit_"
            )
        ) {
            const ruleId =
                interaction.customId.substring(
                    "managerole_edit_".length
                );

            const rule =
                getRule(
                    ruleId
                );

            if (
                !rule
            ) {
                return interaction.reply({
                    content:
                        "❌ Règle introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const draft = {
                ...rule,

                triggerRoleIds: [
                    ...(
                        rule.triggerRoleIds ||
                        []
                    )
                ],

                onMatchAddRoleIds: [
                    ...(
                        rule.onMatchAddRoleIds ||
                        []
                    )
                ],

                onMatchRemoveRoleIds: [
                    ...(
                        rule.onMatchRemoveRoleIds ||
                        []
                    )
                ],

                onUnmatchAddRoleIds: [
                    ...(
                        rule.onUnmatchAddRoleIds ||
                        []
                    )
                ],

                onUnmatchRemoveRoleIds: [
                    ...(
                        rule.onUnmatchRemoveRoleIds ||
                        []
                    )
                ],

                editingExisting:
                    true
            };

            setDraft(
                interaction,
                draft
            );

            await interaction.update({
                embeds: [
                    createEditorEmbed(
                        draft
                    )
                ],

                components:
                    createEditorRows(
                        draft
                    )
            });

            return true;
        }

        // ==================================================
        // TOGGLE
        // ==================================================

        if (
            interaction.customId.startsWith(
                "managerole_toggle_"
            )
        ) {
            const ruleId =
                interaction.customId.substring(
                    "managerole_toggle_".length
                );

            const current =
                getRule(
                    ruleId
                );

            if (
                !current
            ) {
                return interaction.reply({
                    content:
                        "❌ Règle introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const rule =
                toggleRule(
                    ruleId,
                    !current.enabled
                );

            await interaction.update({
                embeds: [
                    createRuleDetailEmbed(
                        rule
                    )
                ],

                components:
                    createRuleDetailRows(
                        rule
                    )
            });

            return true;
        }

        // ==================================================
        // SYNC
        // ==================================================

        if (
            interaction.customId.startsWith(
                "managerole_sync_"
            )
        ) {
            const ruleId =
                interaction.customId.substring(
                    "managerole_sync_".length
                );

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });

            const result =
                await client.manageRoleSystem
                    ?.syncRule(
                        interaction.guild,
                        ruleId
                    );

            if (
                !result?.success
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de synchroniser cette règle. Vérifie qu'elle est activée."
                });
            }

            return interaction.editReply({
                content:
                    `✅ Synchronisation terminée sur **${result.count} membre(s)**.`
            });
        }

        // ==================================================
        // DELETE
        // ==================================================

        if (
            interaction.customId.startsWith(
                "managerole_delete_"
            )
        ) {
            const ruleId =
                interaction.customId.substring(
                    "managerole_delete_".length
                );

            const deleted =
                deleteRule(
                    ruleId
                );

            if (
                !deleted
            ) {
                return interaction.reply({
                    content:
                        "❌ Règle introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await interaction.update({
                embeds: [
                    createRulesListEmbed(
                        interaction
                    )
                ],

                components:
                    createRulesListRows(
                        interaction
                    )
            });

            await interaction.followUp({
                content:
                    "🗑️ Règle supprimée.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        return false;
    },

    // ==================================================
    // SELECT
    // ==================================================

    async handleSelect(
        interaction
    ) {
        // ==================================================
        // RULE SELECT
        // ==================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId ===
                "managerole_rule_select"
        ) {
            const rule =
                getRule(
                    interaction.values[
                        0
                    ]
                );

            if (
                !rule
            ) {
                return interaction.reply({
                    content:
                        "❌ Règle introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            await interaction.update({
                embeds: [
                    createRuleDetailEmbed(
                        rule
                    )
                ],

                components:
                    createRuleDetailRows(
                        rule
                    )
            });

            return true;
        }

        // ==================================================
        // ROLE SELECTS
        // ==================================================

        if (
            !interaction.isRoleSelectMenu()
        ) {
            return false;
        }

        const mapping = {
            managerole_select_trigger:
                "triggerRoleIds",

            managerole_select_match_add:
                "onMatchAddRoleIds",

            managerole_select_match_remove:
                "onMatchRemoveRoleIds",

            managerole_select_unmatch_add:
                "onUnmatchAddRoleIds",

            managerole_select_unmatch_remove:
                "onUnmatchRemoveRoleIds"
        };

        const property =
            mapping[
                interaction.customId
            ];

        if (
            !property
        ) {
            return false;
        }

        const draft =
            getDraft(
                interaction
            );

        if (
            !draft
        ) {
            return interaction.reply({
                content:
                    "❌ Ta configuration a expiré.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        draft[
            property
        ] =
            [
                ...interaction.values
            ];

        draft.updatedAt =
            Date.now();

        setDraft(
            interaction,
            draft
        );

        await interaction.update({
            embeds: [
                createEditorEmbed(
                    draft
                )
            ],

            components:
                createEditorRows(
                    draft
                )
        });

        return true;
    }
};