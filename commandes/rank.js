const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    MessageFlags
} = require("discord.js");

const {
    MAIN_RANKS,
    MANAGEMENT_ROLES,
    RANK_CONFIG,
    RANK_ALLOWED_ROLES,
    getRoleConfigByCategory
} = require("../config/ranks");

const {
    addRankHistory
} = require("../utils/rankHistory");

// ======================================================
// HELPERS
// ======================================================

function hasRankPermission(member) {
    return RANK_ALLOWED_ROLES.some(roleId =>
        member.roles.cache.has(roleId)
    );
}

function getCurrentMainRank(member) {
    return (
        Object.entries(MAIN_RANKS).find(
            ([, rank]) =>
                member.roles.cache.has(
                    rank.roleId
                )
        ) || null
    );
}

function getChoicesForCategory(category) {
    if (category === "grade") {
        return Object.entries(
            MAIN_RANKS
        ).map(([key, rank]) => ({
            name: rank.name,
            value: key,
            roleId: rank.roleId
        }));
    }

    if (category === "gestion") {
        return Object.entries(
            MANAGEMENT_ROLES
        ).map(([key, data]) => ({
            name:
                data.gestion.name,

            value:
                key,

            roleId:
                data.gestion.roleId
        }));
    }

    if (category === "responsable") {
        return Object.entries(
            MANAGEMENT_ROLES
        ).map(([key, data]) => ({
            name:
                data.responsable.name,

            value:
                key,

            roleId:
                data.responsable.roleId
        }));
    }

    return [];
}

function categoryLabel(category) {
    if (category === "grade") {
        return "Grade";
    }

    if (category === "gestion") {
        return "Gestion";
    }

    if (category === "responsable") {
        return "Responsable";
    }

    return category;
}

// ======================================================
// RÉCUPÉRATION OPTION BRUTE AUTOCOMPLETE
// ======================================================

function getRawOption(
    interaction,
    optionName
) {
    const option =
        interaction.options.data.find(
            item =>
                item.name ===
                optionName
        );

    if (!option) {
        return null;
    }

    return option.value ?? null;
}

// ======================================================
// LOGS
// ======================================================

async function sendRankLog({
    guild,
    member,
    moderator,
    category,
    action,
    roleName,
    oldRank,
    newRank,
    note,
    autoManagement
}) {
    const channel =
        await guild.channels
            .fetch(
                RANK_CONFIG.logChannelId
            )
            .catch(() => null);

    if (!channel?.isTextBased()) {
        console.log(
            "⚠️ Salon logs /rank introuvable."
        );

        return;
    }

    const now =
        Math.floor(
            Date.now() / 1000
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                action === "add"
                    ? RANK_CONFIG.embedColor
                    : RANK_CONFIG.removalColor
            )
            .setTitle(
                action === "add"
                    ? "📈 Utilisation de /rank"
                    : "📉 Retrait via /rank"
            )
            .addFields(
                {
                    name:
                        "👤 Membre",

                    value:
                        `<@${member.id}>\n\`${member.id}\``,

                    inline:
                        true
                },

                {
                    name:
                        "📂 Catégorie",

                    value:
                        categoryLabel(
                            category
                        ),

                    inline:
                        true
                },

                {
                    name:
                        "⚙️ Action",

                    value:
                        action === "add"
                            ? "Attribuer"
                            : "Retirer",

                    inline:
                        true
                },

                {
                    name:
                        "🎭 Rôle",

                    value:
                        roleName,

                    inline:
                        false
                },

                {
                    name:
                        "🛡️ Auteur",

                    value:
                        `<@${moderator.id}>\n\`${moderator.id}\``,

                    inline:
                        true
                },

                {
                    name:
                        "🕒 Date",

                    value:
                        `<t:${now}:F>`,

                    inline:
                        true
                }
            )
            .setTimestamp();

    if (category === "grade") {
        embed.addFields(
            {
                name:
                    "Ancien grade",

                value:
                    oldRank ||
                    "Aucun",

                inline:
                    true
            },

            {
                name:
                    "Nouveau grade",

                value:
                    newRank ||
                    "Aucun",

                inline:
                    true
            }
        );
    }

    if (autoManagement) {
        embed.addFields({
            name:
                "🔗 Gestion automatiquement attribuée",

            value:
                autoManagement,

            inline:
                false
        });
    }

    if (note) {
        embed.addFields({
            name:
                "📝 Note",

            value:
                note.substring(
                    0,
                    1024
                ),

            inline:
                false
        });
    }

    await channel.send({
        embeds: [embed]
    }).catch(error => {
        console.error(
            "❌ Erreur log /rank :",
            error
        );
    });
}

// ======================================================
// MESSAGE PUBLIC
// ======================================================

async function sendPublicMessage({
    guild,
    member,
    moderator,
    category,
    action,
    roleName,
    oldRank,
    newRank,
    note
}) {
    if (
        action === "remove" &&
        !RANK_CONFIG.publishRemovals
    ) {
        return;
    }

    const channel =
        await guild.channels
            .fetch(
                RANK_CONFIG.publicChannelId
            )
            .catch(() => null);

    if (!channel?.isTextBased()) {
        console.log(
            "⚠️ Salon public /rank introuvable."
        );

        return;
    }

    let embed = null;

    // ==================================================
    // GRADE
    // ==================================================

    if (
        category === "grade" &&
        action === "add"
    ) {
        embed =
            new EmbedBuilder()
                .setColor(
                    RANK_CONFIG.rankupColor
                )
                .setTitle(
                    "🎉 RANKUP"
                )
                .setDescription(
                    `**<@${member.id}> vient d'évoluer au sein de The Legacy !**`
                )
                .addFields(
                    {
                        name:
                            "Ancien grade",

                        value:
                            `\`${oldRank || "Aucun"}\``,

                        inline:
                            true
                    },

                    {
                        name:
                            "Nouveau grade",

                        value:
                            `\`${newRank}\``,

                        inline:
                            true
                    },

                    {
                        name:
                            "Rankup effectué par",

                        value:
                            `<@${moderator.id}>`,

                        inline:
                            false
                    }
                );

        if (note) {
            embed.addFields({
                name:
                    "📝 Note du staff",

                value:
                    note.substring(
                        0,
                        1024
                    ),

                inline:
                    false
            });
        }

        embed
            .setFooter({
                text:
                    "Félicitations pour cette évolution. 🩵"
            })
            .setTimestamp();
    }

    // ==================================================
    // GESTION
    // ==================================================

    if (
        category === "gestion" &&
        action === "add"
    ) {
        embed =
            new EmbedBuilder()
                .setColor(
                    RANK_CONFIG.managementColor
                )
                .setTitle(
                    "🛡️ NOUVELLE RESPONSABILITÉ"
                )
                .setDescription(
`<@${member.id}> rejoint désormais :

**${roleName}**

Attribué par <@${moderator.id}>.`
                )
                .setTimestamp();

        if (note) {
            embed.addFields({
                name:
                    "📝 Note",

                value:
                    note.substring(
                        0,
                        1024
                    )
            });
        }
    }

    // ==================================================
    // RESPONSABLE
    // ==================================================

    if (
        category === "responsable" &&
        action === "add"
    ) {
        embed =
            new EmbedBuilder()
                .setColor(
                    RANK_CONFIG.responsibleColor
                )
                .setTitle(
                    "👑 NOUVEAU RESPONSABLE"
                )
                .setDescription(
`<@${member.id}> devient désormais :

**${roleName}**

Attribué par <@${moderator.id}>.`
                )
                .setTimestamp();

        if (note) {
            embed.addFields({
                name:
                    "📝 Note",

                value:
                    note.substring(
                        0,
                        1024
                    )
            });
        }
    }

    // ==================================================
    // RETRAIT PUBLIC
    // ==================================================

    if (
        action === "remove" &&
        RANK_CONFIG.publishRemovals
    ) {
        embed =
            new EmbedBuilder()
                .setColor(
                    RANK_CONFIG.removalColor
                )
                .setTitle(
                    "🔄 MODIFICATION DES RESPONSABILITÉS"
                )
                .setDescription(
`Le rôle :

**${roleName}**

a été retiré à <@${member.id}>.

**Modification effectuée par :**
<@${moderator.id}>`
                )
                .setTimestamp();
    }

    if (!embed) {
        return;
    }

    await channel.send({
        embeds: [embed]
    }).catch(error => {
        console.error(
            "❌ Message public /rank :",
            error
        );
    });
}

// ======================================================
// COMMANDE /RANK
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "rank"
            )
            .setDescription(
                "Gérer les grades et responsabilités d'un membre"
            )

            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre concerné"
                    )
                    .setRequired(
                        true
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "categorie"
                    )
                    .setDescription(
                        "Catégorie du rôle"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        {
                            name:
                                "Grade",

                            value:
                                "grade"
                        },

                        {
                            name:
                                "Gestion",

                            value:
                                "gestion"
                        },

                        {
                            name:
                                "Responsable",

                            value:
                                "responsable"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "action"
                    )
                    .setDescription(
                        "Attribuer ou retirer"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        {
                            name:
                                "Attribuer",

                            value:
                                "add"
                        },

                        {
                            name:
                                "Retirer",

                            value:
                                "remove"
                        }
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "role"
                    )
                    .setDescription(
                        "Grade ou responsabilité"
                    )
                    .setRequired(
                        true
                    )
                    .setAutocomplete(
                        true
                    )
            )

            .addStringOption(option =>
                option
                    .setName(
                        "note"
                    )
                    .setDescription(
                        "Note facultative du staff"
                    )
                    .setMaxLength(
                        1000
                    )
                    .setRequired(
                        false
                    )
            ),

    // ==================================================
    // AUTOCOMPLETE
    // ==================================================

    async autocomplete(interaction) {
        try {
            const category =
                getRawOption(
                    interaction,
                    "categorie"
                );

            const action =
                getRawOption(
                    interaction,
                    "action"
                );

            const memberId =
                getRawOption(
                    interaction,
                    "membre"
                );

            const focused =
                String(
                    interaction.options
                        .getFocused() ||
                    ""
                ).toLowerCase();

            console.log("");
            console.log(
                "🔎 AUTOCOMPLETE /RANK"
            );

            console.log(
                "Catégorie :",
                category
            );

            console.log(
                "Action :",
                action
            );

            console.log(
                "Membre :",
                memberId
            );

            // Pas encore de catégorie sélectionnée
            if (!category) {
                return interaction.respond(
                    []
                );
            }

            let choices =
                getChoicesForCategory(
                    category
                );

            console.log(
                "Choix disponibles :",
                choices.map(
                    choice =>
                        choice.name
                )
            );

            // ==================================================
            // RETIRER → RÔLES POSSÉDÉS EN PRIORITÉ
            // ==================================================

            if (
                action === "remove" &&
                memberId
            ) {
                let member =
                    interaction.guild.members.cache.get(
                        memberId
                    );

                if (!member) {
                    member =
                        await interaction.guild.members
                            .fetch(
                                memberId
                            )
                            .catch(
                                () => null
                            );
                }

                if (member) {
                    const possessed =
                        choices.filter(
                            choice =>
                                member.roles.cache.has(
                                    choice.roleId
                                )
                        );

                    // Si le membre possède au moins
                    // un rôle de cette catégorie,
                    // on affiche uniquement ceux-là.
                    if (
                        possessed.length > 0
                    ) {
                        choices =
                            possessed;
                    }
                }
            }

            // ==================================================
            // RECHERCHE TEXTE
            // ==================================================

            if (focused) {
                choices =
                    choices.filter(
                        choice =>
                            choice.name
                                .toLowerCase()
                                .includes(
                                    focused
                                )
                    );
            }

            const response =
                choices
                    .slice(
                        0,
                        25
                    )
                    .map(
                        choice => ({
                            name:
                                choice.name,

                            value:
                                choice.value
                        })
                    );

            console.log(
                "✅ Réponse autocomplete :",
                response
            );

            return interaction.respond(
                response
            );

        } catch (error) {
            console.error("");
            console.error(
                "❌ AUTOCOMPLETE /RANK :",
                error
            );
            console.error("");

            try {
                await interaction.respond(
                    []
                );
            } catch {}

            return;
        }
    },

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            if (
                !hasRankPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser cette commande."
                });
            }

            // ==================================================
            // OPTIONS
            // ==================================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const category =
                interaction.options.getString(
                    "categorie"
                );

            const action =
                interaction.options.getString(
                    "action"
                );

            const roleKey =
                interaction.options.getString(
                    "role"
                );

            const note =
                interaction.options.getString(
                    "note"
                );

            // ==================================================
            // MEMBRE
            // ==================================================

            const member =
                await interaction.guild.members
                    .fetch(
                        user.id
                    )
                    .catch(
                        () => null
                    );

            if (!member) {
                return interaction.editReply({
                    content:
                        "❌ Ce membre est introuvable sur le serveur."
                });
            }

            // ==================================================
            // RÔLE CONFIGURÉ
            // ==================================================

            const roleConfig =
                getRoleConfigByCategory(
                    category,
                    roleKey
                );

            if (!roleConfig) {
                return interaction.editReply({
                    content:
                        "❌ Ce rôle n'existe pas dans la configuration."
                });
            }

            const discordRole =
                interaction.guild.roles.cache.get(
                    roleConfig.roleId
                );

            if (!discordRole) {
                return interaction.editReply({
                    content:
`❌ Le rôle **${roleConfig.name}** est introuvable sur Discord.

Vérifie son ID dans \`config/ranks.js\`.`
                });
            }

            // ==================================================
            // BOT / PERMISSIONS
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (
                !botMember.permissions.has(
                    PermissionsBitField
                        .Flags
                        .ManageRoles
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Je n'ai pas la permission **Gérer les rôles**."
                });
            }

            if (
                discordRole.position >=
                botMember.roles.highest.position
            ) {
                return interaction.editReply({
                    content:
`❌ Mon rôle Discord doit être placé au-dessus de **${discordRole.name}** dans la hiérarchie.`
                });
            }

            if (
                member.id ===
                interaction.guild.ownerId
            ) {
                return interaction.editReply({
                    content:
                        "❌ Je ne peux pas modifier les rôles du propriétaire du serveur."
                });
            }

            // ==================================================
            // ÉTAT ACTUEL
            // ==================================================

            const hasRole =
                member.roles.cache.has(
                    discordRole.id
                );

            if (
                action === "add" &&
                hasRole
            ) {
                return interaction.editReply({
                    content:
                        "⚠️ Ce membre possède déjà ce rôle."
                });
            }

            if (
                action === "remove" &&
                !hasRole
            ) {
                return interaction.editReply({
                    content:
                        "⚠️ Ce membre ne possède pas ce rôle."
                });
            }

            let oldRank = null;
            let newRank = null;

            let autoManagement =
                null;

            // ==================================================
            // GRADE PRINCIPAL
            // ==================================================

            if (
                category === "grade"
            ) {
                const currentRank =
                    getCurrentMainRank(
                        member
                    );

                oldRank =
                    currentRank
                        ? currentRank[1].name
                        : null;

                // ==============================================
                // ATTRIBUER
                // ==============================================

                if (
                    action === "add"
                ) {
                    // Retire UNIQUEMENT les autres
                    // grades principaux.
                    for (
                        const [
                            key,
                            rank
                        ]
                        of Object.entries(
                            MAIN_RANKS
                        )
                    ) {
                        if (
                            key === roleKey
                        ) {
                            continue;
                        }

                        if (
                            !member.roles.cache.has(
                                rank.roleId
                            )
                        ) {
                            continue;
                        }

                        const oldDiscordRole =
                            interaction.guild.roles.cache.get(
                                rank.roleId
                            );

                        if (!oldDiscordRole) {
                            continue;
                        }

                        if (
                            oldDiscordRole.position >=
                            botMember.roles.highest.position
                        ) {
                            return interaction.editReply({
                                content:
`❌ Je ne peux pas retirer l'ancien grade **${oldDiscordRole.name}** car il est placé au-dessus de mon rôle.`
                            });
                        }

                        await member.roles.remove(
                            oldDiscordRole
                        );
                    }

                    await member.roles.add(
                        discordRole
                    );

                    newRank =
                        roleConfig.name;
                }

                // ==============================================
                // RETIRER
                // ==============================================

                if (
                    action === "remove"
                ) {
                    await member.roles.remove(
                        discordRole
                    );

                    oldRank =
                        roleConfig.name;

                    newRank =
                        null;
                }
            }

            // ==================================================
            // GESTION
            // ==================================================

            if (
                category === "gestion"
            ) {
                if (
                    action === "add"
                ) {
                    await member.roles.add(
                        discordRole
                    );
                }

                if (
                    action === "remove"
                ) {
                    await member.roles.remove(
                        discordRole
                    );
                }
            }

            // ==================================================
            // RESPONSABLE
            // ==================================================

            if (
                category === "responsable"
            ) {
                if (
                    action === "add"
                ) {
                    await member.roles.add(
                        discordRole
                    );

                    // ==========================================
                    // RESPONSABLE → GESTION AUTO
                    // ==========================================

                    if (
                        RANK_CONFIG
                            .responsibleIncludesManagement
                    ) {
                        const managementData =
                            MANAGEMENT_ROLES[
                                roleKey
                            ];

                        const managementRoleId =
                            managementData
                                ?.gestion
                                ?.roleId;

                        if (
                            managementRoleId &&
                            !member.roles.cache.has(
                                managementRoleId
                            )
                        ) {
                            const managementRole =
                                interaction.guild.roles.cache.get(
                                    managementRoleId
                                );

                            if (
                                managementRole &&
                                managementRole.position <
                                botMember.roles.highest.position
                            ) {
                                await member.roles.add(
                                    managementRole
                                );

                                autoManagement =
                                    managementData
                                        .gestion
                                        .name;
                            }
                        }
                    }
                }

                if (
                    action === "remove"
                ) {
                    await member.roles.remove(
                        discordRole
                    );

                    if (
                        RANK_CONFIG
                            .removeManagementWithResponsible
                    ) {
                        const managementData =
                            MANAGEMENT_ROLES[
                                roleKey
                            ];

                        const managementRoleId =
                            managementData
                                ?.gestion
                                ?.roleId;

                        if (
                            managementRoleId &&
                            member.roles.cache.has(
                                managementRoleId
                            )
                        ) {
                            const managementRole =
                                interaction.guild.roles.cache.get(
                                    managementRoleId
                                );

                            if (
                                managementRole &&
                                managementRole.position <
                                botMember.roles.highest.position
                            ) {
                                await member.roles.remove(
                                    managementRole
                                );
                            }
                        }
                    }
                }
            }

            // ==================================================
            // HISTORIQUE
            // ==================================================

            addRankHistory({
                userId:
                    member.id,

                moderatorId:
                    interaction.user.id,

                category,

                action,

                roleKey,

                roleName:
                    roleConfig.name,

                oldRank,

                newRank,

                note:
                    note || null,

                autoManagement:
                    autoManagement ||
                    null
            });

            // ==================================================
            // LOG
            // ==================================================

            await sendRankLog({
                guild:
                    interaction.guild,

                member,

                moderator:
                    interaction.user,

                category,

                action,

                roleName:
                    roleConfig.name,

                oldRank,

                newRank,

                note,

                autoManagement
            });

            // ==================================================
            // MESSAGE PUBLIC
            // ==================================================

            await sendPublicMessage({
                guild:
                    interaction.guild,

                member,

                moderator:
                    interaction.user,

                category,

                action,

                roleName:
                    roleConfig.name,

                oldRank,

                newRank,

                note
            });

            // ==================================================
            // CONFIRMATION
            // ==================================================

            let confirmation =
                action === "add"
                    ? `✅ **${roleConfig.name}** a été attribué à <@${member.id}>.`
                    : `✅ **${roleConfig.name}** a été retiré à <@${member.id}>.`;

            if (
                category === "grade" &&
                action === "add" &&
                oldRank &&
                oldRank !== newRank
            ) {
                confirmation +=
                    `\n📈 **${oldRank} → ${newRank}**`;
            }

            if (autoManagement) {
                confirmation +=
                    `\n🔗 **${autoManagement}** a également été attribué automatiquement.`;
            }

            return interaction.editReply({
                content:
                    confirmation
            });

        } catch (error) {
            console.error(
                "❌ Erreur /rank :",
                error
            );

            return interaction.editReply({
                content:
`❌ Une erreur est survenue pendant la modification du rôle.

\`${error.message}\``
            }).catch(() => {});
        }
    }
}