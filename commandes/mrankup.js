const {
    SlashCommandBuilder,
    PermissionsBitField,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

const noblox = require("noblox.js");

const {
    MAIN_RANKS,
    RANK_CONFIG,
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

const {
    getRobloxLink,
    updateLastRobloxSync
} = require("../utils/robloxLinks");

const {
    addRankHistory
} = require("../utils/rankHistory");

// ======================================================
// CONFIG
// ======================================================

const MAX_MEMBERS = 20;

// ======================================================
// PERMISSIONS
// ======================================================

function hasRankPermission(member) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// GRADE ACTUEL
// ======================================================

function getCurrentMainRank(member) {
    return (
        Object.entries(
            MAIN_RANKS
        ).find(
            ([, rank]) =>
                member.roles.cache.has(
                    rank.roleId
                )
        ) || null
    );
}

// ======================================================
// ROBLOX
// ======================================================

let robloxAuthenticated =
    false;

async function ensureRobloxAuthenticated() {
    if (
        robloxAuthenticated
    ) {
        return true;
    }

    const cookie =
        process.env.ROBLOX_COOKIE;

    if (!cookie) {
        throw new Error(
            "ROBLOX_COOKIE absent des variables Railway."
        );
    }

    await noblox.setCookie(
        cookie
    );

    robloxAuthenticated =
        true;

    return true;
}

async function syncRobloxRank(
    discordUserId,
    rankConfig
) {
    const link =
        getRobloxLink(
            discordUserId
        );

    // Aucun compte lié
    if (!link) {
        return {
            status:
                "unlinked",

            text:
                "Compte Roblox non relié"
        };
    }

    // Aucun grade Roblox configuré
    if (
        rankConfig.robloxRank ===
            null ||
        rankConfig.robloxRank ===
            undefined ||
        rankConfig.robloxRank ===
            ""
    ) {
        return {
            status:
                "not_configured",

            username:
                link.robloxUsername,

            text:
                "Rang Roblox non configuré"
        };
    }

    const groupId =
        Number(
            process.env.ROBLOX_GROUP_ID
        );

    if (
        !groupId ||
        Number.isNaN(
            groupId
        )
    ) {
        return {
            status:
                "error",

            username:
                link.robloxUsername,

            text:
                "ROBLOX_GROUP_ID invalide"
        };
    }

    try {
        await ensureRobloxAuthenticated();

        const robloxUserId =
            Number(
                link.robloxUserId
            );

        if (
            !robloxUserId ||
            Number.isNaN(
                robloxUserId
            )
        ) {
            throw new Error(
                "ID Roblox invalide."
            );
        }

        const result =
            await noblox.setRank(
                groupId,
                robloxUserId,
                rankConfig.robloxRank
            );

        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "success",

                rank:
                    result?.name ||
                    rankConfig.robloxRank,

                error:
                    null
            }
        );

        return {
            status:
                "success",

            username:
                link.robloxUsername,

            rank:
                result?.name ||
                String(
                    rankConfig.robloxRank
                ),

            text:
                `Roblox synchronisé → ${result?.name || rankConfig.robloxRank}`
        };

    } catch (error) {
        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "error",

                rank:
                    rankConfig.robloxRank,

                error:
                    error.message
            }
        );

        return {
            status:
                "error",

            username:
                link.robloxUsername,

            text:
                error.message
        };
    }
}

// ======================================================
// LOG
// ======================================================

async function sendMassRankLog({
    guild,
    moderator,
    rank,
    results,
    note
}) {
    const channel =
        await guild.channels
            .fetch(
                RANK_CONFIG.logChannelId
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const successes =
        results.filter(
            result =>
                result.discordSuccess
        );

    const failures =
        results.filter(
            result =>
                !result.discordSuccess
        );

    const robloxSuccess =
        results.filter(
            result =>
                result.roblox?.status ===
                "success"
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                RANK_CONFIG.embedColor
            )
            .setTitle(
                "👑 Utilisation de /mrankup"
            )
            .setDescription(
`**Nouveau grade :** ${rank.name}

**Membres sélectionnés :** ${results.length}
**Discord réussis :** ${successes.length}
**Discord échoués :** ${failures.length}
**Roblox synchronisés :** ${robloxSuccess.length}`
            )
            .addFields({
                name:
                    "🛡️ Auteur",

                value:
                    `<@${moderator.id}>\n\`${moderator.id}\``,

                inline:
                    false
            })
            .setTimestamp();

    if (
        successes.length
    ) {
        embed.addFields({
            name:
                "✅ Membres rankup",

            value:
                successes
                    .map(
                        result =>
                            `<@${result.memberId}> • ${result.oldRank || "Aucun"} → ${rank.name}`
                    )
                    .join(
                        "\n"
                    )
                    .substring(
                        0,
                        1024
                    ),

            inline:
                false
        });
    }

    if (
        failures.length
    ) {
        embed.addFields({
            name:
                "❌ Échecs",

            value:
                failures
                    .map(
                        result =>
                            `<@${result.memberId}> • ${result.error}`
                    )
                    .join(
                        "\n"
                    )
                    .substring(
                        0,
                        1024
                    ),

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
                )
        });
    }

    await channel.send({
        embeds: [
            embed
        ]
    }).catch(
        error =>
            console.error(
                "❌ Log /mrankup :",
                error
            )
    );
}

// ======================================================
// MESSAGE PUBLIC
// ======================================================

async function sendPublicMessage({
    guild,
    moderator,
    rank,
    results,
    note
}) {
    const channel =
        await guild.channels
            .fetch(
                RANK_CONFIG.publicChannelId
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const successful =
        results.filter(
            result =>
                result.discordSuccess
        );

    if (
        !successful.length
    ) {
        return;
    }

    const members =
        successful
            .map(
                result =>
                    `> • <@${result.memberId}>`
            )
            .join(
                "\n"
            );

    const content =
`## 👑 Rankup multiple — The Legacy

Une nouvelle vague d'évolution vient d'avoir lieu au sein de **The Legacy** !

### Nouveau grade
> **${rank.name}**

### Félicitations à
${members}

Votre activité, votre investissement et votre implication vous permettent aujourd'hui de franchir une nouvelle étape au sein de la famille.

Continuez ainsi, **l'héritage se construit étape par étape.** 🪽${note ? `

> 📝 **Note :** ${note}` : ""}

-# Rankup effectué par <@${moderator.id}>`;

    await channel.send({
        content,

        allowedMentions: {
            users: [
                ...successful.map(
                    result =>
                        result.memberId
                ),

                moderator.id
            ]
        }
    }).catch(
        error =>
            console.error(
                "❌ Message public /mrankup :",
                error
            )
    );
}

// ======================================================
// CONSTRUCTION COMMANDE
// ======================================================

const command =
    new SlashCommandBuilder()
        .setName(
            "mrankup"
        )
        .setDescription(
            "Rankup plusieurs membres en même temps"
        )

        .addStringOption(
            option =>
                option
                    .setName(
                        "grade"
                    )
                    .setDescription(
                        "Nouveau grade des membres"
                    )
                    .setRequired(
                        true
                    )
                    .addChoices(
                        ...Object.entries(
                            MAIN_RANKS
                        ).map(
                            ([key, rank]) => ({
                                name:
                                    rank.name,

                                value:
                                    key
                            })
                        )
                    )
        )

        .addUserOption(
            option =>
                option
                    .setName(
                        "membre1"
                    )
                    .setDescription(
                        "Premier membre"
                    )
                    .setRequired(
                        true
                    )
        );

// ======================================================
// MEMBRES 2 → 20
// ======================================================

for (
    let i = 2;
    i <= MAX_MEMBERS;
    i++
) {
    command.addUserOption(
        option =>
            option
                .setName(
                    `membre${i}`
                )
                .setDescription(
                    `Membre ${i}`
                )
                .setRequired(
                    false
                )
    );
}

// ======================================================
// NOTE
// ======================================================

command.addStringOption(
    option =>
        option
            .setName(
                "note"
            )
            .setDescription(
                "Note facultative"
            )
            .setMaxLength(
                500
            )
            .setRequired(
                false
            )
);

// ======================================================
// EXPORT
// ======================================================

module.exports = {

    data:
        command,

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==========================================
            // PERMISSION
            // ==========================================

            if (
                !hasRankPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/mrankup`."
                });
            }

            // ==========================================
            // GRADE
            // ==========================================

            const rankKey =
                interaction.options
                    .getString(
                        "grade"
                    );

            const rank =
                MAIN_RANKS[
                    rankKey
                ];

            if (!rank) {
                return interaction.editReply({
                    content:
                        "❌ Grade invalide."
                });
            }

            const newDiscordRole =
                interaction.guild
                    .roles
                    .cache
                    .get(
                        rank.roleId
                    );

            if (
                !newDiscordRole
            ) {
                return interaction.editReply({
                    content:
                        `❌ Le rôle Discord **${rank.name}** est introuvable.`
                });
            }

            // ==========================================
            // PERMISSIONS BOT
            // ==========================================

            const botMember =
                interaction.guild
                    .members
                    .me;

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
                newDiscordRole.position >=
                botMember.roles.highest.position
            ) {
                return interaction.editReply({
                    content:
                        `❌ Mon rôle doit être placé au-dessus de **${newDiscordRole.name}**.`
                });
            }

            // ==========================================
            // RÉCUPÉRATION MEMBRES
            // ==========================================

            const users =
                [];

            for (
                let i = 1;
                i <= MAX_MEMBERS;
                i++
            ) {
                const user =
                    interaction.options
                        .getUser(
                            `membre${i}`
                        );

                if (!user) {
                    continue;
                }

                if (
                    users.some(
                        existing =>
                            existing.id ===
                            user.id
                    )
                ) {
                    continue;
                }

                users.push(
                    user
                );
            }

            if (
                !users.length
            ) {
                return interaction.editReply({
                    content:
                        "❌ Aucun membre sélectionné."
                });
            }

            const note =
                interaction.options
                    .getString(
                        "note"
                    );

            const results =
                [];

            // ==========================================
            // TRAITEMENT DE CHAQUE MEMBRE
            // ==========================================

            for (
                const user
                of users
            ) {
                const result = {
                    memberId:
                        user.id,

                    username:
                        user.username,

                    discordSuccess:
                        false,

                    oldRank:
                        null,

                    newRank:
                        rank.name,

                    roblox:
                        null,

                    error:
                        null
                };

                try {
                    const member =
                        await interaction.guild
                            .members
                            .fetch(
                                user.id
                            );

                    // ==================================
                    // PROPRIÉTAIRE
                    // ==================================

                    if (
                        member.id ===
                        interaction.guild.ownerId
                    ) {
                        throw new Error(
                            "Impossible de modifier le propriétaire du serveur."
                        );
                    }

                    // ==================================
                    // GRADE ACTUEL
                    // ==================================

                    const currentRank =
                        getCurrentMainRank(
                            member
                        );

                    result.oldRank =
                        currentRank
                            ? currentRank[1].name
                            : null;

                    // ==================================
                    // RETIRER LES AUTRES GRADES
                    // ==================================

                    for (
                        const [
                            key,
                            oldRank
                        ]
                        of Object.entries(
                            MAIN_RANKS
                        )
                    ) {
                        if (
                            key ===
                            rankKey
                        ) {
                            continue;
                        }

                        if (
                            !member.roles.cache.has(
                                oldRank.roleId
                            )
                        ) {
                            continue;
                        }

                        const oldRole =
                            interaction.guild
                                .roles
                                .cache
                                .get(
                                    oldRank.roleId
                                );

                        if (
                            !oldRole
                        ) {
                            continue;
                        }

                        if (
                            oldRole.position >=
                            botMember.roles.highest.position
                        ) {
                            throw new Error(
                                `Impossible de retirer ${oldRole.name} : rôle au-dessus du bot.`
                            );
                        }

                        await member.roles.remove(
                            oldRole
                        );
                    }

                    // ==================================
                    // AJOUTER NOUVEAU GRADE
                    // ==================================

                    if (
                        !member.roles.cache.has(
                            newDiscordRole.id
                        )
                    ) {
                        await member.roles.add(
                            newDiscordRole
                        );
                    }

                    result.discordSuccess =
                        true;

                    // ==================================
                    // HISTORIQUE
                    // ==================================

                    addRankHistory({
                        userId:
                            member.id,

                        moderatorId:
                            interaction.user.id,

                        category:
                            "grade",

                        action:
                            "add",

                        roleKey:
                            rankKey,

                        roleName:
                            rank.name,

                        oldRank:
                            result.oldRank,

                        newRank:
                            rank.name,

                        note:
                            note ||
                            "Rankup multiple",

                        autoManagement:
                            null
                    });

                    // ==================================
                    // ROBLOX
                    // ==================================

                    result.roblox =
                        await syncRobloxRank(
                            member.id,
                            rank
                        );

                } catch (error) {
                    result.error =
                        error.message;
                }

                results.push(
                    result
                );
            }

            // ==========================================
            // LOG
            // ==========================================

            await sendMassRankLog({
                guild:
                    interaction.guild,

                moderator:
                    interaction.user,

                rank,

                results,

                note
            });

            // ==========================================
            // LOGS CENTRAUX
            // ==========================================

            if (
                interaction.client
                    .logs
                    ?.logSpecial
            ) {
                await interaction.client.logs
                    .logSpecial(
                        interaction.guild,
                        "rank",
                        {
                            title:
                                "👑 Rankup multiple",

                            description:
                                `**${results.length} membre(s)** traités vers **${rank.name}**.`,

                            fields: [
                                {
                                    name:
                                        "Auteur",

                                    value:
                                        `<@${interaction.user.id}>`
                                },

                                {
                                    name:
                                        "Réussites Discord",

                                    value:
                                        String(
                                            results.filter(
                                                result =>
                                                    result.discordSuccess
                                            ).length
                                        ),

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Synchronisations Roblox",

                                    value:
                                        String(
                                            results.filter(
                                                result =>
                                                    result.roblox
                                                        ?.status ===
                                                    "success"
                                            ).length
                                        ),

                                    inline:
                                        true
                                }
                            ]
                        }
                    )
                    .catch(
                        () => {}
                    );
            }

            // ==========================================
            // ANNONCE PUBLIQUE
            // ==========================================

            await sendPublicMessage({
                guild:
                    interaction.guild,

                moderator:
                    interaction.user,

                rank,

                results,

                note
            });

            // ==========================================
            // RÉCAPITULATIF
            // ==========================================

            const lines =
                results.map(
                    result => {
                        if (
                            !result.discordSuccess
                        ) {
                            return (
                                `❌ <@${result.memberId}>` +
                                `\n└ Discord : ${result.error}`
                            );
                        }

                        let robloxText =
                            "⚪ Non traité";

                        if (
                            result.roblox
                                ?.status ===
                            "success"
                        ) {
                            robloxText =
                                `✅ ${result.roblox.username} → ${result.roblox.rank}`;
                        }

                        if (
                            result.roblox
                                ?.status ===
                            "unlinked"
                        ) {
                            robloxText =
                                "⚠️ Compte non relié";
                        }

                        if (
                            result.roblox
                                ?.status ===
                            "not_configured"
                        ) {
                            robloxText =
                                "⚠️ Rang Roblox non configuré";
                        }

                        if (
                            result.roblox
                                ?.status ===
                            "error"
                        ) {
                            robloxText =
                                `❌ ${result.roblox.text}`;
                        }

                        return (
                            `✅ <@${result.memberId}>` +
                            `\n└ Discord : ${result.oldRank || "Aucun"} → ${rank.name}` +
                            `\n└ Roblox : ${robloxText}`
                        );
                    }
                );

            const successful =
                results.filter(
                    result =>
                        result.discordSuccess
                ).length;

            const robloxSuccessful =
                results.filter(
                    result =>
                        result.roblox
                            ?.status ===
                        "success"
                ).length;

            return interaction.editReply({
                content:
`## 👑 Rankup multiple terminé

**Grade :** ${rank.name}
**Membres :** ${results.length}
**Discord :** ${successful}/${results.length} réussis
**Roblox :** ${robloxSuccessful}/${results.length} synchronisés

${lines.join("\n\n")}`
                    .substring(
                        0,
                        2000
                    )
            });

        } catch (error) {
            console.error(
                "❌ Erreur /mrankup :",
                error
            );

            return interaction.editReply({
                content:
`❌ Une erreur est survenue pendant le rankup multiple.

\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};