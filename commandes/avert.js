const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const AVERT_CHANNEL_ID =
    "1531375423424823407";

// ======================================================
// RÔLES D'AVERTISSEMENT
// ======================================================

const WARNING_ROLES = {
    rappel: {
        label:
            "Rappel à l'ordre",

        roleId:
            "1533805294130561186"
    },

    avertissement: {
        label:
            "Avertissement",

        roleId:
            "1533805396274315314"
    },

    derniere_chance: {
        label:
            "Dernière chance",

        roleId:
            "1533805482052161666"
    }
};

// ======================================================
// RÔLES AUTORISÉS À UTILISER /AVERT
// ======================================================

const ALLOWED_ROLES = [
    // Fondation / bypass
    "1458414705717805189",
    "1467277541696868412",

    // Responsable sanctions / rankups
    "1531760308761133229",

    // Gestion sanctions / rankups
    "1516451475415367822"
];

// ======================================================
// PERMISSION
// ======================================================

function hasPermission(
    member
) {
    return ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// RÉCUPÉRATION DU SALON
// ======================================================

async function getAvertChannel(
    guild
) {
    return (
        guild.channels.cache.get(
            AVERT_CHANNEL_ID
        ) ||
        await guild.channels.fetch(
            AVERT_CHANNEL_ID
        ).catch(
            () => null
        )
    );
}

// ======================================================
// RETIRER LES ANCIENS RÔLES D'AVERTISSEMENT
// ======================================================

async function removeOldWarningRoles(
    member,
    selectedRoleId,
    botMember
) {
    const removed =
        [];

    const failed =
        [];

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
                "Mise à jour du niveau d'avertissement"
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
// AJOUT DU NOUVEAU RÔLE
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
`**Mise à jour disciplinaire <a:1181maruloader:1533145507201814689>**

Nous vous informons que <@${member.id}> reçoit un **${warning.label}**.

**Raison :** ${reason}

Nous demandons à chacun de respecter cette décision. Cette mesure a pour objectif de rappeler les règles et les attentes au sein de **The Legacy**.

-# By <@&1458414705717805189> & <@&1467277541696868412> & <@&1531760308761133229>.`;

    try {
        const message =
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
                            "Membre concerné par l'avertissement"
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
                            "Choix de l'avertissement"
                        )
                        .setDescription(
                            "Niveau d'avertissement"
                        )
                        .setRequired(
                            true
                        )
                        .addChoices(
                            {
                                name:
                                    "Rappel à l'ordre",

                                value:
                                    "rappel"
                            },

                            {
                                name:
                                    "Avertissement",

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
            // BOT PERMISSIONS
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

            // ==================================================
            // TYPE AVERT
            // ==================================================

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
                await interaction.guild.members.fetch(
                    user.id
                ).catch(
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
            // PROPRIÉTAIRE
            // ==================================================

            if (
                member.id ===
                interaction.guild.ownerId
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible d'avertir le propriétaire du serveur."
                });
            }

            // ==================================================
            // RETRAIT DES AUTRES NIVEAUX
            // ==================================================

            const oldRolesResult =
                await removeOldWarningRoles(
                    member,
                    warning.roleId,
                    botMember
                );

            // ==================================================
            // AJOUT DU NOUVEAU NIVEAU
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
                let errorMessage =
                    "❌ Impossible d'ajouter le rôle d'avertissement.";

                if (
                    addResult.error ===
                    "ROLE_NOT_FOUND"
                ) {
                    errorMessage =
                        `❌ Le rôle **${warning.label}** est introuvable.`;
                }

                if (
                    addResult.error ===
                    "ROLE_HIERARCHY"
                ) {
                    errorMessage =
                        `❌ Le rôle **${warning.label}** est placé au-dessus ou au même niveau que le rôle du bot.`;
                }

                return interaction.editReply({
                    content:
                        errorMessage
                });
            }

            // ==================================================
            // ACTUALISER LE MEMBRE
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
                `\n🎭 Rôle : <@&${warning.roleId}>`;

            if (
                addResult.alreadyHadRole
            ) {
                confirmation +=
                    "\n⚠️ Le membre possédait déjà ce rôle.";
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
                    `\n⚠️ ${oldRolesResult.failed.length} ancien(s) rôle(s) n'ont pas pu être retirés.`;
            }

            if (
                messageResult.success
            ) {
                confirmation +=
                    `\n📢 Message envoyé dans <#${AVERT_CHANNEL_ID}>.`;

            } else {
                confirmation +=
                    "\n⚠️ L'avertissement a été appliqué, mais le message public n'a pas pu être envoyé.";
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