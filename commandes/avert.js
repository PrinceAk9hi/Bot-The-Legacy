const { blockProtectedInteraction } = require("../utils/security");

const { hasBypass } = require("../utils/security");

const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const AVERT_CHANNEL_ID =
    "1478798666470002929";

// ======================================================
// RÔLES D'AVERTISSEMENT
// ======================================================

const WARNING_ROLES = {
    rappel: {
        label:
            "Avertissement 1",

        roleId:
            "1468698882002387044"
    },

    avertissement: {
        label:
            "Avertissement 2",

        roleId:
            "1468698901077823653"
    },

    derniere_chance: {
        label:
            "Dernière chance",

        roleId:
            "1468698902428516524"
    }
};

// ======================================================
// RÔLES AUTORISÉS
// ======================================================

const ALLOWED_ROLES = [
    "1473356789453029376",
    "1469803353964810250",
    "1522357970778718249",
    "1471546243653304392",
    "1504782476319526932",
    "1527996778727870496"
];

// ======================================================
// PERMISSION
// ======================================================

function hasPermission(
    member
) {
    if (hasBypass(member)) return true;

    return ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// SALON AVERT
// ======================================================

async function getAvertChannel(
    guild
) {
    return (
        guild.channels.cache.get(
            AVERT_CHANNEL_ID
        ) ||
        await guild.channels
            .fetch(
                AVERT_CHANNEL_ID
            )
            .catch(
                () => null
            )
    );
}

// ======================================================
// RETIRER LES AUTRES NIVEAUX
// ======================================================

async function removeOldWarningRoles(
    member,
    selectedRoleId,
    botMember
) {
    const removed = [];
    const failed = [];

    for (
        const warning
        of Object.values(
            WARNING_ROLES
        )
    ) {
        if (
            warning.roleId ===
            selectedRoleId
        ) {
            continue;
        }

        if (
            !member.roles.cache.has(
                warning.roleId
            )
        ) {
            continue;
        }

        const role =
            member.guild.roles.cache.get(
                warning.roleId
            );

        if (
            !role
        ) {
            continue;
        }

        if (
            role.managed ||
            role.position >=
                botMember.roles.highest.position
        ) {
            failed.push(
                role.name
            );

            continue;
        }

        try {
            await member.roles.remove(
                role,
                "Mise à jour du niveau disciplinaire"
            );

            removed.push(
                role.id
            );

        } catch (error) {
            console.error(
                `❌ /avert retrait ${role.name} :`,
                error
            );

            failed.push(
                role.name
            );
        }
    }

    return {
        removed,
        failed
    };
}

// ======================================================
// AJOUT DU RÔLE
// ======================================================

async function addWarningRole(
    member,
    warning,
    botMember,
    moderator,
    reason
) {
    const role =
        member.guild.roles.cache.get(
            warning.roleId
        );

    if (
        !role
    ) {
        return {
            success:
                false,

            error:
                "ROLE_NOT_FOUND"
        };
    }

    if (
        role.managed
    ) {
        return {
            success:
                false,

            error:
                "ROLE_MANAGED"
        };
    }

    if (
        role.position >=
        botMember.roles.highest.position
    ) {
        return {
            success:
                false,

            error:
                "ROLE_HIERARCHY"
        };
    }

    if (
        member.roles.cache.has(
            role.id
        )
    ) {
        return {
            success:
                true,

            alreadyHadRole:
                true
        };
    }

    try {
        await member.roles.add(
            role,
            `/avert par ${moderator.tag} • ${reason}`
        );

        return {
            success:
                true,

            alreadyHadRole:
                false
        };

    } catch (error) {
        console.error(
            "❌ /avert ajout rôle :",
            error
        );

        return {
            success:
                false,

            error:
                error.message
        };
    }
}

// ======================================================
// MESSAGE PUBLIC
// ======================================================

async function sendWarningMessage({
    guild,
    member,
    warning,
    reason
}) {
    const channel =
        await getAvertChannel(
            guild
        );

    if (
        !channel?.isTextBased()
    ) {
        return {
            success:
                false,

            error:
                "CHANNEL_NOT_FOUND"
        };
    }

    const content =
`**Mise à jour disciplinaire ⚠️**

Nous vous informons que <@${member.id}> reçoit un **${warning.label}**.

**Raison :** ${reason}

Nous demandons à chacun de respecter cette décision et de prendre en compte cet avertissement.

-# By <@&1471546243653304392> & <@&1504782476319526932> & <@&1527996778727870496> & <@&1471889647570260030>.`;

    try {
        const message =
            await channel.send({
                content,

                allowedMentions: {
                    users: [
                        member.id
                    ],

                    roles: [
                        "1471546243653304392",

                        "1504782476319526932",
                        "1527996778727870496",
                        "1471889647570260030"
                    ]
                }
            });

        return {
            success:
                true,

            message
        };

    } catch (error) {
        console.error(
            "❌ /avert message public :",
            error
        );

        return {
            success:
                false,

            error:
                error.message
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
                "avert"
            )
            .setDescription(
                "Donner un avertissement à un membre"
            )

            // ==================================================
            // MEMBRE
            // ==================================================

            .addUserOption(
                option =>
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

            // ==================================================
            // CHOIX AVERT
            // ==================================================

            .addStringOption(
                option =>
                    option
                        .setName(
                            "choixavert"
                        )
                        .setDescription(
                            "Choisir le niveau d'avertissement"
                        )
                        .setRequired(
                            true
                        )
                        .addChoices(
                            {
                                name:
                                    "Avertissement 1",

                                value:
                                    "rappel"
                            },

                            {
                                name:
                                    "Avertissement 2",

                                value:
                                    "avertissement"
                            },

                            {
                                name:
                                    "Dernière chance",

                                value:
                                    "derniere_chance"
                            }
                        )
            )

            // ==================================================
            // RAISON
            // ==================================================

            .addStringOption(
                option =>
                    option
                        .setName(
                            "raison"
                        )
                        .setDescription(
                            "Raison de l'avertissement"
                        )
                        .setRequired(
                            true
                        )
                        .setMaxLength(
                            1000
                        )
            ),

    // ======================================================
    // EXECUTION
    // ======================================================

    async execute(
        interaction
    ) {
        if (await blockProtectedInteraction(interaction, "avert")) return;

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSION
            // ==================================================

            if (
                !hasPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/avert`."
                });
            }

            // ==================================================
            // BOT
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (
                !botMember
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de récupérer le membre du bot."
                });
            }

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
            // OPTIONS
            // ==================================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const warningKey =
                interaction.options.getString(
                    "choixavert"
                );

            const reason =
                interaction.options.getString(
                    "raison"
                );

            const warning =
                WARNING_ROLES[
                    warningKey
                ];

            if (
                !warning
            ) {
                return interaction.editReply({
                    content:
                        "❌ Type d'avertissement invalide."
                });
            }

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

            // ==================================================
            // PROTECTION OWNER
            // ==================================================

            if (
                interaction.user.id !== "547192186547077130" && member.id ===
                interaction.guild.ownerId
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible d'avertir le propriétaire du serveur."
                });
            }

            // ==================================================
            // RETRAIT DES ANCIENS NIVEAUX
            // ==================================================

            const oldRolesResult =
                { removed: [], failed: [] };

            // ==================================================
            // AJOUT DU NOUVEAU
            // ==================================================

            const addResult =
                await addWarningRole(
                    member,
                    warning,
                    botMember,
                    interaction.user,
                    reason
                );

            if (
                !addResult.success
            ) {
                if (
                    addResult.error ===
                    "ROLE_NOT_FOUND"
                ) {
                    return interaction.editReply({
                        content:
                            `❌ Le rôle **${warning.label}** est introuvable.`
                    });
                }

                if (
                    addResult.error ===
                    "ROLE_MANAGED"
                ) {
                    return interaction.editReply({
                        content:
                            `❌ Le rôle **${warning.label}** est géré par Discord ou une intégration.`
                    });
                }

                if (
                    addResult.error ===
                    "ROLE_HIERARCHY"
                ) {
                    return interaction.editReply({
                        content:
                            `❌ Le rôle **${warning.label}** est au-dessus ou au même niveau que le rôle du bot.`
                    });
                }

                return interaction.editReply({
                    content:
                        `❌ Impossible d'ajouter le rôle.\n\`${addResult.error}\``
                });
            }

            // ==================================================
            // REFRESH
            // ==================================================

            await member.fetch()
                .catch(
                    () => {}
                );

            // ==================================================
            // MESSAGE PUBLIC
            // ==================================================

            const messageResult =
                await sendWarningMessage({
                    guild:
                        interaction.guild,

                    member,

                    warning,

                    reason
                });

            // ==================================================
            // CONFIRMATION
            // ==================================================

            let confirmation =
                `✅ <@${member.id}> a reçu **${warning.label}**.` +
                `\n🎭 Rôle appliqué : <@&${warning.roleId}>`;

            if (
                addResult.alreadyHadRole
            ) {
                confirmation +=
                    "\n⚠️ Le membre possédait déjà ce niveau d'avertissement.";
            }

            if (
                oldRolesResult.removed.length
            ) {
                confirmation +=
                    `\n🔄 **${oldRolesResult.removed.length} ancien(s) niveau(x)** retiré(s).`;
            }

            if (
                oldRolesResult.failed.length
            ) {
                confirmation +=
                    `\n⚠️ **${oldRolesResult.failed.length} rôle(s)** n'ont pas pu être retirés.`;
            }

            if (
                messageResult.success
            ) {
                confirmation +=
                    `\n📢 Message envoyé dans <#${AVERT_CHANNEL_ID}>.`;

            } else {
                confirmation +=
                    "\n⚠️ Le rôle a été appliqué, mais l'annonce publique n'a pas pu être envoyée.";
            }

            return interaction.editReply({
                content:
                    confirmation
            });

        } catch (error) {
            console.error(
                "❌ Erreur /avert :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue pendant l'avertissement.\n\`${String(
                        error?.message ||
                        error
                    ).substring(
                        0,
                        500
                    )}\``
            }).catch(
                () => {}
            );
        }
    }
};