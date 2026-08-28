const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
    MessageFlags
} = require("discord.js");

const noblox = require("noblox.js");

const {
    MAIN_RANKS,
    MANAGEMENT_ROLES,
    RANK_CONFIG,
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

const {
    addRankHistory
} = require("../utils/rankHistory");

const {
    getRobloxLink,
    updateLastRobloxSync
} = require("../utils/robloxLinks");

const {
    ensureRobloxLogin
} = require("../utils/robloxGroup");

// ======================================================
// CONFIG ROBLOX
// ======================================================

const GROUP_ID =
    Number(
        process.env.ROBLOX_GROUP_ID ||
        "194530241"
    );

// ======================================================
// SALON ANNONCE DERANK
// ======================================================

const DERANK_ANNOUNCEMENT_CHANNEL_ID =
    "1531375423424823407";

// ======================================================
// RÔLES SUPPLÉMENTAIRES À RETIRER AU DERANK
// ======================================================

const EXTRA_DERANK_ROLES = [
    {
        key:
            "acces_legacy",

        category:
            "extra",

        name:
            "Accès Legacy",

        roleId:
            "1458391977073574012"
    },

    {
        key:
            "extra_1467277541696868412",

        category:
            "extra",

        name:
            "Rôle Legacy",

        roleId:
            "1467277541696868412"
    }
];

// ======================================================
// PERMISSIONS
// ======================================================

function hasDerankPermission(
    member
) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// TOUS LES RÔLES À RETIRER
// ======================================================

function getAllDerankRoles() {
    const roles =
        [];

    // ==================================================
    // GRADES
    // ==================================================

    for (
        const [
            key,
            rank
        ]
        of Object.entries(
            MAIN_RANKS
        )
    ) {
        roles.push({
            key,

            category:
                "grade",

            name:
                rank.name,

            roleId:
                rank.roleId
        });
    }

    // ==================================================
    // GESTION + RESPONSABLE
    // ==================================================

    for (
        const [
            key,
            data
        ]
        of Object.entries(
            MANAGEMENT_ROLES
        )
    ) {
        if (
            data?.gestion?.roleId
        ) {
            roles.push({
                key,

                category:
                    "gestion",

                name:
                    data.gestion.name,

                roleId:
                    data.gestion.roleId
            });
        }

        if (
            data?.responsable?.roleId
        ) {
            roles.push({
                key,

                category:
                    "responsable",

                name:
                    data.responsable.name,

                roleId:
                    data.responsable.roleId
            });
        }
    }

    // ==================================================
    // RÔLES SUPPLÉMENTAIRES
    // ==================================================

    for (
        const extraRole
        of EXTRA_DERANK_ROLES
    ) {
        roles.push(
            extraRole
        );
    }

    // ==================================================
    // ÉVITER LES DOUBLONS
    // ==================================================

    const uniqueRoles =
        new Map();

    for (
        const role
        of roles
    ) {
        uniqueRoles.set(
            role.roleId,
            role
        );
    }

    return [
        ...uniqueRoles.values()
    ];
}

// ======================================================
// GRADE ACTUEL
// ======================================================

function getCurrentMainRank(
    member
) {
    const current =
        Object.entries(
            MAIN_RANKS
        ).find(
            ([, rank]) =>
                member.roles.cache.has(
                    rank.roleId
                )
        );

    if (
        !current
    ) {
        return null;
    }

    return {
        key:
            current[0],

        name:
            current[1].name,

        roleId:
            current[1].roleId
    };
}

// ======================================================
// ANNONCE PUBLIQUE DERANK
// ======================================================

async function sendDerankAnnouncement(
    guild,
    member
) {
    const channel =
        guild.channels.cache.get(
            DERANK_ANNOUNCEMENT_CHANNEL_ID
        ) ||
        await guild.channels.fetch(
            DERANK_ANNOUNCEMENT_CHANNEL_ID
        ).catch(
            () => null
        );

    if (
        !channel?.isTextBased()
    ) {
        console.error(
            "❌ Salon d'annonce derank introuvable."
        );

        return false;
    }

    const content =
`**Mise à jour des effectifs <a:1181maruloader:1533145507201814689>**

Nous vous informons que <@${member.id}> **ne fait désormais plus partie de The Legacy**.

**Conformément à nos principes de discrétion et de respect de la confidentialité**, **les raisons de ce départ ne seront pas rendues publiques**. **Nous demandons à chacun de respecter cette décision et de ne pas alimenter de spéculations ou de débats à ce sujet**.

*Nous remercions <@${member.id}> pour le temps passé à nos côtés et lui souhaitons une excellente continuation pour la suite de son parcours*.

-# By <@&1458414705717805189> & <@&1467277541696868412> & <@&1531760308761133229>.`;

    await channel.send({
        content,

        allowedMentions: {
            users: [
                member.id
            ],

            roles: [
                "1458414705717805189",
                "1467277541696868412",
                "1531760308761133229"
            ]
        }
    });

    return true;
}

// ======================================================
// EXPULSER DE ROBLOX
// ======================================================

async function exileFromRoblox(
    discordUserId
) {
    const link =
        getRobloxLink(
            discordUserId
        );

    if (
        !link
    ) {
        return {
            attempted:
                false,

            success:
                false,

            error:
                "USER_NOT_LINKED"
        };
    }

    try {
        await ensureRobloxLogin();

        const currentRank =
            await noblox.getRankInGroup(
                GROUP_ID,
                Number(
                    link.robloxUserId
                )
            );

        // ==================================================
        // DÉJÀ HORS DE LA COMMUNAUTÉ
        // ==================================================

        if (
            Number(
                currentRank
            ) ===
            0
        ) {
            updateLastRobloxSync(
                discordUserId,
                {
                    status:
                        "success",

                    rank:
                        null,

                    error:
                        null
                }
            );

            return {
                attempted:
                    true,

                success:
                    true,

                alreadyOutside:
                    true
            };
        }

        // ==================================================
        // EXPULSION DE LA COMMUNAUTÉ
        // ==================================================

        await noblox.exile(
            GROUP_ID,
            Number(
                link.robloxUserId
            )
        );

        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "success",

                rank:
                    null,

                error:
                    null
            }
        );

        console.log(
            `✅ Roblox : ${link.robloxUsername} expulsé de la communauté.`
        );

        return {
            attempted:
                true,

            success:
                true,

            alreadyOutside:
                false,

            username:
                link.robloxUsername
        };

    } catch (error) {
        const safeError =
            String(
                error?.message ||
                error
            );

        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "failed",

                rank:
                    null,

                error:
                    safeError
            }
        );

        console.error(
            "❌ Roblox derank / exile :",
            safeError
        );

        return {
            attempted:
                true,

            success:
                false,

            error:
                safeError
        };
    }
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "derank"
            )
            .setDescription(
                "Derank complètement un membre"
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            "membre"
                        )
                        .setDescription(
                            "Membre à derank"
                        )
                        .setRequired(
                            true
                        )
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            "raison"
                        )
                        .setDescription(
                            "Raison du derank"
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            1000
                        )
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            "note"
                        )
                        .setDescription(
                            "Note interne facultative"
                        )
                        .setRequired(
                            false
                        )
                        .setMaxLength(
                            1000
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
            // PERMISSION
            // ==================================================

            if (
                !hasDerankPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/derank`."
                });
            }

            // ==================================================
            // OPTIONS
            // ==================================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const reason =
                interaction.options.getString(
                    "raison"
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

            if (
                !member
            ) {
                return interaction.editReply({
                    content:
                        "❌ Ce membre est introuvable sur le serveur."
                });
            }

            if (
                member.id ===
                interaction.guild.ownerId
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de derank le propriétaire du serveur."
                });
            }

            // ==================================================
            // PERMISSIONS BOT
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

            // ==================================================
            // ÉTAT AVANT
            // ==================================================

            const oldMainRank =
                getCurrentMainRank(
                    member
                );

            const allDerankRoles =
                getAllDerankRoles();

            const possessedRoles =
                allDerankRoles.filter(
                    role =>
                        member.roles.cache.has(
                            role.roleId
                        )
                );

            // ==================================================
            // RETRAIT DES RÔLES
            // ==================================================

            const removedRoles =
                [];

            const failedRoles =
                [];

            for (
                const roleData
                of possessedRoles
            ) {
                const discordRole =
                    interaction.guild.roles.cache.get(
                        roleData.roleId
                    );

                if (
                    !discordRole
                ) {
                    continue;
                }

                // ==================================================
                // HIÉRARCHIE
                // ==================================================

                if (
                    discordRole.position >=
                    botMember.roles.highest.position
                ) {
                    failedRoles.push(
                        `${discordRole.name} (hiérarchie)`
                    );

                    continue;
                }

                try {
                    await member.roles.remove(
                        discordRole
                    );

                    removedRoles.push(
                        roleData
                    );

                } catch (error) {
                    failedRoles.push(
                        `${discordRole.name} (${error.message})`
                    );

                    console.error(
                        `❌ Impossible de retirer ${discordRole.name} :`,
                        error.message
                    );
                }
            }

            await member.fetch();

            // ==================================================
            // ROBLOX
            // ==================================================

            const robloxResult =
                await exileFromRoblox(
                    member.id
                );

            // ==================================================
            // HISTORIQUE
            // ==================================================

            addRankHistory({
                userId:
                    member.id,

                moderatorId:
                    interaction.user.id,

                category:
                    "derank",

                action:
                    "remove",

                roleKey:
                    "all",

                roleName:
                    "DERANK COMPLET",

                oldRank:
                    oldMainRank
                        ?.name ||
                    null,

                newRank:
                    null,

                note:
                    note
                        ? `${reason}\n\n${note}`
                        : reason,

                autoManagement:
                    null,

                removedRoles:
                    removedRoles.map(
                        role =>
                            role.name
                    )
            });

            // ==================================================
            // LOG INTERNE
            // ==================================================

            const logChannel =
                await interaction.guild.channels
                    .fetch(
                        RANK_CONFIG.logChannelId
                    )
                    .catch(
                        () => null
                    );

            if (
                logChannel?.isTextBased()
            ) {
                const removedText =
                    removedRoles.length
                        ? removedRoles
                            .map(
                                role =>
                                    `• ${role.name}`
                            )
                            .join(
                                "\n"
                            )
                        : "Aucun rôle";

                const failedText =
                    failedRoles.length
                        ? failedRoles
                            .map(
                                role =>
                                    `• ${role}`
                            )
                            .join(
                                "\n"
                            )
                        : null;

                let robloxText =
                    "⚪ Non tenté";

                if (
                    robloxResult.attempted &&
                    robloxResult.success
                ) {
                    robloxText =
                        robloxResult.alreadyOutside
                            ? "✅ Déjà hors de la communauté"
                            : "✅ Expulsé de la communauté";
                }

                if (
                    robloxResult.attempted &&
                    !robloxResult.success
                ) {
                    robloxText =
                        `❌ Échec : \`${String(
                            robloxResult.error
                        ).substring(
                            0,
                            500
                        )}\``;
                }

                if (
                    !robloxResult.attempted &&
                    robloxResult.error ===
                    "USER_NOT_LINKED"
                ) {
                    robloxText =
                        "⚠️ Aucun compte Roblox relié";
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            RANK_CONFIG.removalColor ||
                            0xED4245
                        )
                        .setTitle(
                            "🔻 DERANK COMPLET"
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
                                    "🛡️ Auteur",

                                value:
                                    `<@${interaction.user.id}>`,

                                inline:
                                    true
                            },

                            {
                                name:
                                    "📉 Ancien grade",

                                value:
                                    oldMainRank
                                        ?.name ||
                                    "Aucun",

                                inline:
                                    true
                            },

                            {
                                name:
                                    "🎭 Rôles retirés",

                                value:
                                    removedText.substring(
                                        0,
                                        1024
                                    ),

                                inline:
                                    false
                            },

                            {
                                name:
                                    "📄 Raison",

                                value:
                                    reason.substring(
                                        0,
                                        1024
                                    ),

                                inline:
                                    false
                            },

                            {
                                name:
                                    "🎮 Roblox",

                                value:
                                    robloxText,

                                inline:
                                    false
                            }
                        )
                        .setTimestamp();

                if (
                    failedText
                ) {
                    embed.addFields({
                        name:
                            "⚠️ Rôles non retirés",

                        value:
                            failedText.substring(
                                0,
                                1024
                            ),

                        inline:
                            false
                    });
                }

                if (
                    note
                ) {
                    embed.addFields({
                        name:
                            "📝 Note interne",

                        value:
                            note.substring(
                                0,
                                1024
                            ),

                        inline:
                            false
                    });
                }

                await logChannel.send({
                    embeds: [
                        embed
                    ]
                }).catch(
                    error =>
                        console.error(
                            "❌ Log /derank :",
                            error
                        )
                );
            }

            // ==================================================
            // ANNONCE PUBLIQUE
            // ==================================================

            let announcementSent =
                false;

            try {
                announcementSent =
                    await sendDerankAnnouncement(
                        interaction.guild,
                        member
                    );

            } catch (error) {
                console.error(
                    "❌ Annonce publique /derank :",
                    error
                );
            }

            // ==================================================
            // CONFIRMATION
            // ==================================================

            let confirmation =
                `✅ <@${member.id}> a été **derank complètement**.` +
                `\n🎭 **${removedRoles.length} rôle(s)** retiré(s).`;

            if (
                failedRoles.length
            ) {
                confirmation +=
                    `\n⚠️ **${failedRoles.length} rôle(s)** n'ont pas pu être retirés.`;
            }

            if (
                robloxResult.attempted &&
                robloxResult.success
            ) {
                confirmation +=
                    robloxResult.alreadyOutside
                        ? "\n🎮 Roblox : déjà hors de la communauté."
                        : "\n🎮 Roblox : expulsé de la communauté.";
            }

            if (
                robloxResult.attempted &&
                !robloxResult.success
            ) {
                confirmation +=
                    `\n⚠️ Roblox : impossible de l'expulser (\`${String(
                        robloxResult.error
                    ).substring(
                        0,
                        150
                    )}\`).`;
            }

            if (
                !robloxResult.attempted &&
                robloxResult.error ===
                "USER_NOT_LINKED"
            ) {
                confirmation +=
                    "\n⚠️ Roblox : aucun compte relié.";
            }

            if (
                announcementSent
            ) {
                confirmation +=
                    `\n📢 Annonce envoyée dans <#${DERANK_ANNOUNCEMENT_CHANNEL_ID}>.`;

            } else {
                confirmation +=
                    "\n⚠️ L'annonce publique n'a pas pu être envoyée.";
            }

            return interaction.editReply({
                content:
                    confirmation
            });

        } catch (error) {
            console.error(
                "❌ Erreur /derank :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue pendant le derank.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};