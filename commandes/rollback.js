const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js");

const {
    getRankHistory,
    addRankHistory
} = require("../utils/rankHistory");

// ======================================================
// CONFIG
// ======================================================

const COLOR =
    0x3B6475;

const SUCCESS_COLOR =
    0x57F287;

const WARNING_COLOR =
    0xFEE75C;

const ERROR_COLOR =
    0xED4245;

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const ACTION_HISTORY_FILE =
    path.join(
        DATA_DIR,
        "actionHistory.json"
    );

// ======================================================
// TYPES SUPPORTÉS
// ======================================================

const SUPPORTED_ACTION_TYPES = [
    "rank_add",
    "rank_remove",

    "role_add",
    "role_remove",

    "role_delete",

    "channel_delete",
    "category_delete",

    "message_delete"
];

// ======================================================
// FICHIER HISTORIQUE
// ======================================================

function ensureHistoryFile() {
    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive:
                    true
            }
        );
    }

    if (
        !fs.existsSync(
            ACTION_HISTORY_FILE
        )
    ) {
        fs.writeFileSync(
            ACTION_HISTORY_FILE,
            "[]",
            "utf8"
        );
    }
}

// ======================================================
// LECTURE
// ======================================================

function getActionHistory() {
    ensureHistoryFile();

    try {
        const raw =
            fs.readFileSync(
                ACTION_HISTORY_FILE,
                "utf8"
            );

        if (
            !raw.trim()
        ) {
            return [];
        }

        const parsed =
            JSON.parse(
                raw
            );

        return Array.isArray(
            parsed
        )
            ? parsed
            : [];

    } catch (error) {
        console.error(
            "❌ Lecture actionHistory.json :",
            error
        );

        return [];
    }
}

// ======================================================
// SAUVEGARDE
// ======================================================

function saveActionHistory(
    history
) {
    ensureHistoryFile();

    try {
        fs.writeFileSync(
            ACTION_HISTORY_FILE,
            JSON.stringify(
                history,
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde actionHistory.json :",
            error
        );

        return false;
    }
}

// ======================================================
// AJOUT
// ======================================================

function addActionHistory(
    entry
) {
    const history =
        getActionHistory();

    const finalEntry = {
        id:
            entry.id ||
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        type:
            entry.type ||
            null,

        guildId:
            entry.guildId ||
            null,

        executorId:
            entry.executorId ||
            null,

        targetId:
            entry.targetId ||
            null,

        timestamp:
            entry.timestamp ||
            Date.now(),

        data:
            entry.data ||
            {},

        rolledBack:
            Boolean(
                entry.rolledBack
            ),

        rolledBackAt:
            entry.rolledBackAt ||
            null,

        rolledBackBy:
            entry.rolledBackBy ||
            null
    };

    history.push(
        finalEntry
    );

    saveActionHistory(
        history
    );

    return finalEntry;
}

// ======================================================
// MARK ROLLBACK
// ======================================================

function markAsRolledBack(
    actionId,
    moderatorId
) {
    const history =
        getActionHistory();

    const action =
        history.find(
            entry =>
                entry.id ===
                actionId
        );

    if (!action) {
        return false;
    }

    action.rolledBack =
        true;

    action.rolledBackAt =
        Date.now();

    action.rolledBackBy =
        moderatorId;

    return saveActionHistory(
        history
    );
}

// ======================================================
// DERNIÈRE ACTION
// ======================================================

function getLastGlobalAction(
    guildId
) {
    return (
        getActionHistory()
            .filter(
                entry =>
                    entry.guildId ===
                        guildId &&
                    !entry.rolledBack &&
                    SUPPORTED_ACTION_TYPES.includes(
                        entry.type
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    (
                        b.timestamp ||
                        0
                    ) -
                    (
                        a.timestamp ||
                        0
                    )
            )[0] ||
        null
    );
}

// ======================================================
// NORMALIZE
// ======================================================

function normalize(
    value
) {
    return String(
        value ||
        ""
    )
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .trim();
}

// ======================================================
// TROUVER RÔLE
// ======================================================

function findRole(
    guild,
    ...values
) {
    const candidates =
        values
            .flat()
            .filter(
                Boolean
            );

    // ID

    for (
        const value
        of candidates
    ) {
        const text =
            String(
                value
            );

        const match =
            text.match(
                /^<?@?&?(\d{16,22})>?$/
            );

        if (match) {
            const role =
                guild.roles.cache.get(
                    match[1]
                );

            if (role) {
                return role;
            }
        }
    }

    // NOM

    for (
        const value
        of candidates
    ) {
        const wanted =
            normalize(
                value
            );

        const role =
            guild.roles.cache.find(
                currentRole =>
                    normalize(
                        currentRole.name
                    ) ===
                    wanted
            );

        if (role) {
            return role;
        }
    }

    return null;
}

// ======================================================
// HIÉRARCHIE RÔLES
// ======================================================

function canManageRole(
    guild,
    role
) {
    const botMember =
        guild.members.me;

    if (
        !botMember ||
        !role
    ) {
        return false;
    }

    if (
        role.managed ||
        role.id ===
            guild.id
    ) {
        return false;
    }

    return (
        botMember.roles.highest.position >
        role.position
    );
}

// ======================================================
// EMBED SUCCESS
// ======================================================

function buildSuccessEmbed({
    title,
    description,
    interaction
}) {
    return new EmbedBuilder()
        .setColor(
            SUCCESS_COLOR
        )
        .setTitle(
            `↩️ ${title}`
        )
        .setDescription(
            description
        )
        .setFooter({
            text:
                `The Legacy • Rollback par ${interaction.user.username}`
        })
        .setTimestamp();
}

// ======================================================
// PERMISSION OVERWRITES
// ======================================================

function deserializeOverwrites(
    overwrites
) {
    if (
        !Array.isArray(
            overwrites
        )
    ) {
        return [];
    }

    return overwrites
        .filter(
            overwrite =>
                overwrite?.id
        )
        .map(
            overwrite => ({
                id:
                    overwrite.id,

                type:
                    overwrite.type,

                allow:
                    BigInt(
                        overwrite.allow ||
                        "0"
                    ),

                deny:
                    BigInt(
                        overwrite.deny ||
                        "0"
                    )
            })
        );
}

// ======================================================
// TYPES SALONS
// ======================================================

function isSupportedChannelType(
    type
) {
    return [
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildCategory,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildStageVoice,
        ChannelType.GuildForum
    ].includes(
        type
    );
}

// ======================================================
// OPTIONS FORUM
// ======================================================

function deserializeForumTags(
    tags
) {
    if (
        !Array.isArray(
            tags
        )
    ) {
        return [];
    }

    return tags
        .filter(
            tag =>
                tag?.name
        )
        .map(
            tag => ({
                name:
                    tag.name,

                moderated:
                    Boolean(
                        tag.moderated
                    ),

                emoji:
                    tag.emoji
                        ? {
                            id:
                                tag.emoji.id ||
                                undefined,

                            name:
                                tag.emoji.name ||
                                undefined
                        }
                        : undefined
            })
        );
}

// ======================================================
// CRÉER SALON DEPUIS SNAPSHOT
// ======================================================

async function createChannelFromSnapshot({
    guild,
    data,
    interaction,
    forcedParentId = undefined
}) {
    const channelType =
        Number(
            data.type
        );

    if (
        !isSupportedChannelType(
            channelType
        )
    ) {
        throw new Error(
            `Le type de salon ${channelType} n'est pas restaurable automatiquement.`
        );
    }

    const options = {
        name:
            data.name,

        type:
            channelType,

        permissionOverwrites:
            deserializeOverwrites(
                data.permissionOverwrites
            ),

        reason:
            `Rollback demandé par ${interaction.user.tag}`
    };

    // ==================================================
    // PARENT
    // ==================================================

    let parentId =
        null;

    if (
        forcedParentId !==
        undefined
    ) {
        parentId =
            forcedParentId;

    } else if (
        data.parentId &&
        guild.channels.cache.has(
            data.parentId
        )
    ) {
        parentId =
            data.parentId;
    }

    if (
        parentId &&
        channelType !==
            ChannelType.GuildCategory
    ) {
        options.parent =
            parentId;
    }

    // ==================================================
    // TEXT / ANNOUNCEMENT / FORUM
    // ==================================================

    if (
        [
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum
        ].includes(
            channelType
        )
    ) {
        if (
            data.topic !==
            undefined
        ) {
            options.topic =
                data.topic ||
                null;
        }

        if (
            data.nsfw !==
            undefined
        ) {
            options.nsfw =
                Boolean(
                    data.nsfw
                );
        }

        if (
            data.rateLimitPerUser !==
            undefined
        ) {
            options.rateLimitPerUser =
                Number(
                    data.rateLimitPerUser ||
                    0
                );
        }

        if (
            data.defaultAutoArchiveDuration
        ) {
            options.defaultAutoArchiveDuration =
                Number(
                    data.defaultAutoArchiveDuration
                );
        }

        if (
            data.defaultThreadRateLimitPerUser !==
            undefined
        ) {
            options.defaultThreadRateLimitPerUser =
                Number(
                    data.defaultThreadRateLimitPerUser ||
                    0
                );
        }
    }

    // ==================================================
    // FORUM
    // ==================================================

    if (
        channelType ===
        ChannelType.GuildForum
    ) {
        const tags =
            deserializeForumTags(
                data.availableTags
            );

        if (
            tags.length
        ) {
            options.availableTags =
                tags;
        }

        if (
            data.defaultReactionEmoji
        ) {
            options.defaultReactionEmoji =
                {
                    emojiId:
                        data.defaultReactionEmoji.id ||
                        null,

                    emojiName:
                        data.defaultReactionEmoji.name ||
                        null
                };
        }

        if (
            data.defaultSortOrder !==
            undefined &&
            data.defaultSortOrder !==
            null
        ) {
            options.defaultSortOrder =
                data.defaultSortOrder;
        }

        if (
            data.defaultForumLayout !==
            undefined &&
            data.defaultForumLayout !==
            null
        ) {
            options.defaultForumLayout =
                data.defaultForumLayout;
        }
    }

    // ==================================================
    // VOICE / STAGE
    // ==================================================

    if (
        [
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice
        ].includes(
            channelType
        )
    ) {
        if (
            data.bitrate
        ) {
            /*
                Si l'ancien bitrate dépasse maintenant
                la limite du serveur, Discord refuserait.

                On limite donc à la limite actuelle.
            */

            options.bitrate =
                Math.min(
                    Number(
                        data.bitrate
                    ),
                    guild.maximumBitrate ||
                    Number(
                        data.bitrate
                    )
                );
        }

        if (
            data.userLimit !==
            undefined
        ) {
            options.userLimit =
                Number(
                    data.userLimit ||
                    0
                );
        }

        if (
            data.rtcRegion !==
            undefined
        ) {
            options.rtcRegion =
                data.rtcRegion ||
                null;
        }

        if (
            data.videoQualityMode !==
            undefined
        ) {
            options.videoQualityMode =
                data.videoQualityMode;
        }
    }

    const created =
        await guild.channels.create(
            options
        );

    if (
        Number.isInteger(
            data.position
        )
    ) {
        await created.setPosition(
            data.position
        ).catch(
            () => {}
        );
    }

    return created;
}

// ======================================================
// RÔLE SUPPRIMÉ
// ======================================================

async function rollbackDeletedRole({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const data =
        action.data ||
        {};

    if (!data.name) {
        throw new Error(
            "Les informations du rôle supprimé sont incomplètes."
        );
    }

    const newRole =
        await guild.roles.create({
            name:
                data.name,

            color:
                data.color ??
                undefined,

            hoist:
                Boolean(
                    data.hoist
                ),

            mentionable:
                Boolean(
                    data.mentionable
                ),

            permissions:
                data.permissions
                    ? BigInt(
                        data.permissions
                    )
                    : undefined,

            reason:
                `Rollback demandé par ${interaction.user.tag}`
        });

    if (
        Number.isInteger(
            data.position
        )
    ) {
        await newRole.setPosition(
            data.position
        ).catch(
            () => {}
        );
    }

    let restoredMembers =
        0;

    let failedMembers =
        0;

    const memberIds =
        Array.isArray(
            data.memberIds
        )
            ? data.memberIds
            : [];

    for (
        const memberId
        of memberIds
    ) {
        const member =
            guild.members.cache.get(
                memberId
            ) ||
            await guild.members
                .fetch(
                    memberId
                )
                .catch(
                    () => null
                );

        if (!member) {
            failedMembers++;
            continue;
        }

        try {
            await member.roles.add(
                newRole,
                "Restauration /rollback"
            );

            restoredMembers++;

        } catch {
            failedMembers++;
        }
    }

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    "Rôle restauré",

                description:
`Le rôle **${newRole.name}** a été recréé.

**Ancien ID :** \`${data.id || "Inconnu"}\`
**Nouvel ID :** \`${newRole.id}\`

👥 **Membres restaurés :** ${restoredMembers}
${failedMembers
    ? `⚠️ **Échecs :** ${failedMembers}`
    : "✅ Tous les membres enregistrés ont récupéré le rôle."}

> Le rôle possède obligatoirement un **nouvel ID Discord**.`
            }),

        recreatedId:
            newRole.id
    };
}

// ======================================================
// SALON SUPPRIMÉ
// ======================================================

async function rollbackDeletedChannel({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const data =
        action.data ||
        {};

    if (!data.name) {
        throw new Error(
            "Les informations du salon sont incomplètes."
        );
    }

    const channel =
        await createChannelFromSnapshot({
            guild,
            data,
            interaction
        });

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    "Salon restauré",

                description:
`**${channel.name}** a été recréé avec les informations sauvegardées.

**Ancien ID :** \`${data.id || "Inconnu"}\`
**Nouvel ID :** \`${channel.id}\`

${channel.parentId
    ? `📁 **Catégorie :** <#${channel.parentId}>`
    : "📁 **Catégorie :** aucune / catégorie d'origine indisponible"}

> Discord ne permet pas de restaurer l'ancien ID.`
            }),

        recreatedId:
            channel.id
    };
}

// ======================================================
// CATÉGORIE + ENFANTS
// ======================================================

async function rollbackDeletedCategory({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const data =
        action.data ||
        {};

    if (!data.name) {
        throw new Error(
            "Les informations de la catégorie sont incomplètes."
        );
    }

    // ==================================================
    // CATÉGORIE
    // ==================================================

    const category =
        await createChannelFromSnapshot({
            guild,
            data: {
                ...data,

                type:
                    ChannelType.GuildCategory
            },

            interaction,

            forcedParentId:
                null
        });

    // ==================================================
    // ENFANTS
    // ==================================================

    const children =
        Array.isArray(
            data.children
        )
            ? [
                ...data.children
            ].sort(
                (
                    a,
                    b
                ) =>
                    (
                        a.position ||
                        0
                    ) -
                    (
                        b.position ||
                        0
                    )
            )
            : [];

    let restored =
        0;

    let failed =
        0;

    const recreatedChannels =
        [];

    for (
        const child
        of children
    ) {
        try {
            const recreated =
                await createChannelFromSnapshot({
                    guild,

                    data:
                        child,

                    interaction,

                    forcedParentId:
                        category.id
                });

            recreatedChannels.push({
                oldId:
                    child.id,

                newId:
                    recreated.id,

                name:
                    recreated.name
            });

            restored++;

        } catch (error) {
            failed++;

            console.error(
                `❌ Rollback enfant ${child.name} :`,
                error
            );
        }
    }

    // ==================================================
    // EMBED
    // ==================================================

    const restoredList =
        recreatedChannels.length
            ? recreatedChannels
                .slice(
                    0,
                    15
                )
                .map(
                    item =>
                        `• <#${item.newId}> — ancien \`${item.oldId || "?"}\``
                )
                .join(
                    "\n"
                )
            : "Aucun salon recréé.";

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    "Catégorie restaurée",

                description:
`📁 **${category.name}** a été recréée.

**Ancien ID catégorie :** \`${data.id || "Inconnu"}\`
**Nouvel ID catégorie :** \`${category.id}\`

### Salons
✅ **Restaurés : ${restored}**
${failed
    ? `⚠️ **Échecs : ${failed}**`
    : "✅ Aucun échec."}

${restoredList}

> La structure, les permissions et la majorité des paramètres ont été restaurés.
> Les nouveaux salons et la nouvelle catégorie possèdent forcément de nouveaux IDs Discord.`
            }),

        recreatedId:
            category.id,

        recreatedChannels
    };
}

// ======================================================
// MESSAGE
// ======================================================

async function rollbackDeletedMessage({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const data =
        action.data ||
        {};

    const channelId =
        data.channelId;

    if (!channelId) {
        throw new Error(
            "Le salon d'origine du message n'a pas été enregistré."
        );
    }

    const channel =
        guild.channels.cache.get(
            channelId
        ) ||
        await guild.channels
            .fetch(
                channelId
            )
            .catch(
                () => null
            );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        throw new Error(
            "Le salon d'origine du message n'existe plus."
        );
    }

    const payload = {};

    if (
        data.content
    ) {
        payload.content =
            data.content;
    }

    if (
        Array.isArray(
            data.embeds
        ) &&
        data.embeds.length
    ) {
        payload.embeds =
            data.embeds.slice(
                0,
                10
            );
    }

    if (
        !payload.content &&
        !payload.embeds
    ) {
        payload.content =
            "↩️ **Message restauré**\n\nLe contenu original n'était plus intégralement disponible.";
    }

    if (
        data.authorId
    ) {
        payload.content =
            (
                payload.content
                    ? `${payload.content}\n\n`
                    : ""
            ) +
            `-# Message original de <@${data.authorId}> • restauré par /rollback`;
    }

    const message =
        await channel.send(
            payload
        );

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    "Message restauré",

                description:
`Le message supprimé a été republié dans <#${channel.id}>.

**Ancien ID :** \`${data.id || "Inconnu"}\`
**Nouveau message :** ${message.url}

> Le message restauré est envoyé par le bot et possède un nouvel ID.`
            }),

        recreatedId:
            message.id
    };
}

// ======================================================
// ROLE ADD / REMOVE
// ======================================================

async function rollbackRoleChange({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const data =
        action.data ||
        {};

    const targetId =
        action.targetId ||
        data.memberId ||
        data.userId;

    if (!targetId) {
        throw new Error(
            "Le membre concerné n'est pas enregistré."
        );
    }

    const member =
        guild.members.cache.get(
            targetId
        ) ||
        await guild.members
            .fetch(
                targetId
            )
            .catch(
                () => null
            );

    if (!member) {
        throw new Error(
            "Le membre concerné n'est plus présent sur le serveur."
        );
    }

    const role =
        findRole(
            guild,
            data.roleId,
            data.roleName,
            data.newRank,
            data.oldRank
        );

    if (!role) {
        throw new Error(
            "Le rôle concerné est introuvable."
        );
    }

    if (
        !canManageRole(
            guild,
            role
        )
    ) {
        throw new Error(
            `Je ne peux pas gérer le rôle ${role.name} à cause de la hiérarchie Discord.`
        );
    }

    // ==================================================
    // AJOUT → RETIRER
    // ==================================================

    if (
        [
            "role_add",
            "rank_add"
        ].includes(
            action.type
        )
    ) {
        if (
            member.roles.cache.has(
                role.id
            )
        ) {
            await member.roles.remove(
                role,
                "Rollback"
            );
        }

        return {
            embed:
                buildSuccessEmbed({
                    interaction,

                    title:
                        action.type ===
                        "rank_add"
                            ? "Rankup annulé"
                            : "Ajout de rôle annulé",

                    description:
`<@${member.id}> a perdu <@&${role.id}>.

> L'action précédente a été annulée.`
                })
        };
    }

    // ==================================================
    // RETRAIT → REMETTRE
    // ==================================================

    if (
        !member.roles.cache.has(
            role.id
        )
    ) {
        await member.roles.add(
            role,
            "Rollback"
        );
    }

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    action.type ===
                    "rank_remove"
                        ? "Derank annulé"
                        : "Retrait de rôle annulé",

                description:
`<@${member.id}> a récupéré <@&${role.id}>.

> L'action précédente a été annulée.`
            })
    };
}

// ======================================================
// LEGACY RANK HISTORY
// ======================================================

function getRolledBackRankIds(
    history
) {
    const ids =
        new Set();

    for (
        const entry
        of history
    ) {
        if (
            entry.action !==
            "rollback"
        ) {
            continue;
        }

        const note =
            String(
                entry.note ||
                ""
            );

        const match =
            note.match(
                /rollbackOf:([^\s]+)/i
            );

        if (
            match?.[1]
        ) {
            ids.add(
                match[1]
            );
        }
    }

    return ids;
}

function getLastRankActionFallback() {
    const history =
        getRankHistory();

    const rolledBack =
        getRolledBackRankIds(
            history
        );

    return (
        history
            .filter(
                entry =>
                    entry?.id &&
                    [
                        "grade",
                        "gestion",
                        "responsable"
                    ].includes(
                        entry.category
                    ) &&
                    [
                        "add",
                        "remove"
                    ].includes(
                        entry.action
                    ) &&
                    entry.userId &&
                    !rolledBack.has(
                        entry.id
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    (
                        b.timestamp ||
                        0
                    ) -
                    (
                        a.timestamp ||
                        0
                    )
            )[0] ||
        null
    );
}

async function rollbackLegacyRank({
    interaction,
    action
}) {
    const guild =
        interaction.guild;

    const member =
        guild.members.cache.get(
            action.userId
        ) ||
        await guild.members
            .fetch(
                action.userId
            )
            .catch(
                () => null
            );

    if (!member) {
        throw new Error(
            "Le membre concerné par ce rank n'est plus présent."
        );
    }

    const currentRole =
        findRole(
            guild,
            action.newRank,
            action.roleKey,
            action.roleName
        );

    const oldRole =
        findRole(
            guild,
            action.oldRank
        );

    const changes =
        [];

    if (
        action.action ===
        "add"
    ) {
        if (
            currentRole &&
            member.roles.cache.has(
                currentRole.id
            )
        ) {
            if (
                !canManageRole(
                    guild,
                    currentRole
                )
            ) {
                throw new Error(
                    `Impossible de retirer ${currentRole.name} à cause de la hiérarchie.`
                );
            }

            await member.roles.remove(
                currentRole,
                "Rollback"
            );

            changes.push(
                `➖ <@&${currentRole.id}>`
            );
        }

        if (
            oldRole &&
            !member.roles.cache.has(
                oldRole.id
            ) &&
            canManageRole(
                guild,
                oldRole
            )
        ) {
            await member.roles.add(
                oldRole,
                "Rollback"
            );

            changes.push(
                `➕ <@&${oldRole.id}>`
            );
        }
    }

    if (
        action.action ===
        "remove"
    ) {
        const roleToRestore =
            currentRole ||
            oldRole;

        if (!roleToRestore) {
            throw new Error(
                "Impossible de retrouver le rôle retiré."
            );
        }

        if (
            !canManageRole(
                guild,
                roleToRestore
            )
        ) {
            throw new Error(
                `Impossible de restaurer ${roleToRestore.name} à cause de la hiérarchie.`
            );
        }

        if (
            !member.roles.cache.has(
                roleToRestore.id
            )
        ) {
            await member.roles.add(
                roleToRestore,
                "Rollback"
            );

            changes.push(
                `➕ <@&${roleToRestore.id}>`
            );
        }
    }

    addRankHistory({
        userId:
            member.id,

        moderatorId:
            interaction.user.id,

        category:
            action.category,

        action:
            "rollback",

        roleKey:
            action.roleKey,

        roleName:
            action.roleName,

        oldRank:
            action.newRank,

        newRank:
            action.oldRank,

        note:
            `rollbackOf:${action.id}`
    });

    return {
        embed:
            buildSuccessEmbed({
                interaction,

                title:
                    "Action de rank annulée",

                description:
`La dernière action concernant <@${member.id}> a été annulée.

### Modifications
${changes.length
    ? changes.join("\n")
    : "Aucune modification supplémentaire n'était nécessaire."}

**Action d'origine :** \`${action.action}\`
**Catégorie :** \`${action.category}\`
**Date :** <t:${Math.floor(action.timestamp / 1000)}:F>`
            })
    };
}

// ======================================================
// DESCRIPTION
// ======================================================

function describeAction(
    action
) {
    switch (
        action.type
    ) {
        case "role_delete":
            return (
                `Suppression du rôle **${action.data?.name || "Inconnu"}**`
            );

        case "channel_delete":
            return (
                `Suppression du salon **${action.data?.name || "Inconnu"}**`
            );

        case "category_delete":
            return (
                `Suppression de la catégorie **${action.data?.name || "Inconnue"}**`
            );

        case "message_delete":
            return "Suppression d'un message";

        case "role_add":
            return (
                `Ajout du rôle **${action.data?.roleName || "Inconnu"}**`
            );

        case "role_remove":
            return (
                `Retrait du rôle **${action.data?.roleName || "Inconnu"}**`
            );

        case "rank_add":
            return "Rankup";

        case "rank_remove":
            return "Derank";

        default:
            return (
                action.type ||
                "Action inconnue"
            );
    }
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "rollback"
            )
            .setDescription(
                "Annuler la dernière action réversible effectuée via le bot"
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            const allowed =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageRoles
                );

            if (!allowed) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/rollback`."
                });
            }

            // ==================================================
            // HISTORIQUES
            // ==================================================

            const globalAction =
                getLastGlobalAction(
                    interaction.guild.id
                );

            const rankAction =
                getLastRankActionFallback();

            let useGlobal =
                false;

            if (
                globalAction &&
                rankAction
            ) {
                useGlobal =
                    (
                        globalAction.timestamp ||
                        0
                    ) >=
                    (
                        rankAction.timestamp ||
                        0
                    );

            } else if (
                globalAction
            ) {
                useGlobal =
                    true;

            } else if (
                !rankAction
            ) {
                return interaction.editReply({
                    content:
`❌ **Aucune action réversible trouvée.**

Le bot n'a actuellement aucune action enregistrée pouvant être annulée.`
                });
            }

            // ==================================================
            // LEGACY RANK
            // ==================================================

            if (
                !useGlobal
            ) {
                const result =
                    await rollbackLegacyRank({
                        interaction,

                        action:
                            rankAction
                    });

                return interaction.editReply({
                    embeds: [
                        result.embed
                    ]
                });
            }

            // ==================================================
            // GLOBAL
            // ==================================================

            const action =
                globalAction;

            let result =
                null;

            switch (
                action.type
            ) {
                case "role_delete":
                    result =
                        await rollbackDeletedRole({
                            interaction,
                            action
                        });

                    break;

                case "channel_delete":
                    result =
                        await rollbackDeletedChannel({
                            interaction,
                            action
                        });

                    break;

                case "category_delete":
                    result =
                        await rollbackDeletedCategory({
                            interaction,
                            action
                        });

                    break;

                case "message_delete":
                    result =
                        await rollbackDeletedMessage({
                            interaction,
                            action
                        });

                    break;

                case "role_add":
                case "role_remove":
                case "rank_add":
                case "rank_remove":
                    result =
                        await rollbackRoleChange({
                            interaction,
                            action
                        });

                    break;

                default:
                    throw new Error(
                        `Le type \`${action.type}\` n'est pas encore pris en charge.`
                    );
            }

            // ==================================================
            // MARQUAGE
            // ==================================================

            const marked =
                markAsRolledBack(
                    action.id,
                    interaction.user.id
                );

            if (!marked) {
                console.warn(
                    `⚠️ Rollback effectué mais action ${action.id} non marquée.`
                );
            }

            // ==================================================
            // LOG
            // ==================================================

            if (
                interaction.client.logs
                    ?.logSystemAll
            ) {
                await interaction.client.logs
                    .logSystemAll(
                        interaction.guild,
                        {
                            title:
                                "↩️ Rollback",

                            description:
`**Exécuté par :** <@${interaction.user.id}>
**Action annulée :** ${describeAction(action)}
**ID action :** \`${action.id}\``,

                            color:
                                SUCCESS_COLOR
                        }
                    )
                    .catch(
                        () => {}
                    );
            }

            return interaction.editReply({
                embeds: [
                    result.embed
                ]
            });

        } catch (error) {
            console.error(
                "❌ /rollback :",
                error
            );

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            ERROR_COLOR
                        )
                        .setTitle(
                            "❌ Rollback impossible"
                        )
                        .setDescription(
`L'action n'a pas pu être restaurée.

\`\`\`
${String(
    error.message ||
    error
).slice(
    0,
    1500
)}
\`\`\`

Aucune action n'a été marquée comme restaurée.`
                        )
                        .setFooter({
                            text:
                                "The Legacy • Rollback"
                        })
                        .setTimestamp()
                ]
            }).catch(
                () => {}
            );
        }
    },

    // ==================================================
    // EXPORTS
    // ==================================================

    actionHistory: {
        getActionHistory,
        saveActionHistory,
        addActionHistory,
        markAsRolledBack
    }
};