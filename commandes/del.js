const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR = 0x3B6475;
const SUCCESS_COLOR = 0x57F287;
const ERROR_COLOR = 0xED4245;

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
// DATA
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
                recursive: true
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

function addActionHistory(
    entry
) {
    const history =
        getActionHistory();

    const finalEntry = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        type:
            entry.type,

        guildId:
            entry.guildId,

        executorId:
            entry.executorId,

        targetId:
            entry.targetId ||
            null,

        timestamp:
            Date.now(),

        data:
            entry.data ||
            {},

        rolledBack:
            false,

        rolledBackAt:
            null,

        rolledBackBy:
            null
    };

    history.push(
        finalEntry
    );

    // On évite de laisser grossir le fichier indéfiniment.
    if (
        history.length >
        1000
    ) {
        history.splice(
            0,
            history.length - 1000
        );
    }

    saveActionHistory(
        history
    );

    return finalEntry;
}

// ======================================================
// SERIALIZE PERMISSIONS
// ======================================================

function serializePermissionOverwrites(
    channel
) {
    try {
        return channel.permissionOverwrites.cache.map(
            overwrite => ({
                id:
                    overwrite.id,

                type:
                    overwrite.type,

                allow:
                    overwrite.allow.bitfield.toString(),

                deny:
                    overwrite.deny.bitfield.toString()
            })
        );

    } catch {
        return [];
    }
}

// ======================================================
// SERIALIZE CHANNEL
// ======================================================

function serializeChannel(
    channel
) {
    const data = {
        id:
            channel.id,

        name:
            channel.name,

        type:
            channel.type,

        position:
            channel.rawPosition ??
            channel.position ??
            null,

        parentId:
            channel.parentId ||
            null,

        permissionOverwrites:
            serializePermissionOverwrites(
                channel
            )
    };

    // ==================================================
    // TEXT / ANNOUNCEMENT
    // ==================================================

    if (
        [
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement
        ].includes(
            channel.type
        )
    ) {
        data.topic =
            channel.topic ??
            null;

        data.nsfw =
            Boolean(
                channel.nsfw
            );

        data.rateLimitPerUser =
            Number(
                channel.rateLimitPerUser ||
                0
            );
    }

    // ==================================================
    // VOICE / STAGE
    // ==================================================

    if (
        [
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice
        ].includes(
            channel.type
        )
    ) {
        data.bitrate =
            channel.bitrate ??
            null;

        data.userLimit =
            Number(
                channel.userLimit ||
                0
            );
    }

    // ==================================================
    // FORUM
    // ==================================================

    if (
        channel.type ===
        ChannelType.GuildForum
    ) {
        data.topic =
            channel.topic ??
            null;

        data.nsfw =
            Boolean(
                channel.nsfw
            );

        data.rateLimitPerUser =
            Number(
                channel.rateLimitPerUser ||
                0
            );
    }

    return data;
}

// ======================================================
// TYPE DISPLAY
// ======================================================

function getChannelTypeName(
    channel
) {
    switch (
        channel.type
    ) {
        case ChannelType.GuildCategory:
            return "Catégorie";

        case ChannelType.GuildText:
            return "Salon textuel";

        case ChannelType.GuildVoice:
            return "Salon vocal";

        case ChannelType.GuildAnnouncement:
            return "Salon d'annonces";

        case ChannelType.GuildStageVoice:
            return "Salon Stage";

        case ChannelType.GuildForum:
            return "Forum";

        default:
            return "Salon";
    }
}

// ======================================================
// TYPES AUTORISÉS
// ======================================================

function isSupportedChannel(
    channel
) {
    return [
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildCategory,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildStageVoice,
        ChannelType.GuildForum
    ].includes(
        channel.type
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "del"
            )
            .setDescription(
                "Supprimer un salon ou une catégorie"
            )

            .addChannelOption(
                option =>
                    option
                        .setName(
                            "cible"
                        )
                        .setDescription(
                            "Salon ou catégorie à supprimer"
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
                            "Raison de la suppression"
                        )
                        .setRequired(
                            false
                        )
                        .setMaxLength(
                            500
                        )
            ),

    // ==================================================
    // EXECUTE
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
            // GUILD
            // ==================================================

            if (
                !interaction.guild
            ) {
                return interaction.editReply({
                    content:
                        "❌ Cette commande doit être utilisée dans un serveur."
                });
            }

            // ==================================================
            // PERMISSIONS UTILISATEUR
            // ==================================================

            const allowed =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (
                !allowed
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission de supprimer des salons."
                });
            }

            // ==================================================
            // PERMISSIONS BOT
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (
                !botMember?.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Je n'ai pas la permission **Gérer les salons**."
                });
            }

            // ==================================================
            // CIBLE
            // ==================================================

            const channel =
                interaction.options.getChannel(
                    "cible",
                    true
                );

            const reason =
                interaction.options.getString(
                    "raison"
                ) ||
                "Aucune raison précisée";

            // ==================================================
            // SÉCURITÉS
            // ==================================================

            if (
                !isSupportedChannel(
                    channel
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Ce type de salon n'est pas pris en charge par `/del`."
                });
            }

            if (
                !channel.deletable
            ) {
                return interaction.editReply({
                    content:
                        "❌ Je ne peux pas supprimer ce salon. Vérifie mes permissions et la hiérarchie Discord."
                });
            }

            // ==================================================
            // SNAPSHOT AVANT SUPPRESSION
            // ==================================================

            const snapshot =
                serializeChannel(
                    channel
                );

            const isCategory =
                channel.type ===
                ChannelType.GuildCategory;

            const actionType =
                isCategory
                    ? "category_delete"
                    : "channel_delete";

            // ==================================================
            // SAUVEGARDE POUR /ROLLBACK
            // ==================================================

            const historyEntry =
                addActionHistory({
                    type:
                        actionType,

                    guildId:
                        interaction.guild.id,

                    executorId:
                        interaction.user.id,

                    targetId:
                        channel.id,

                    data: {
                        ...snapshot,

                        reason
                    }
                });

            // ==================================================
            // EMBED AVANT DELETE
            // ==================================================

            const successEmbed =
                new EmbedBuilder()
                    .setColor(
                        SUCCESS_COLOR
                    )
                    .setTitle(
                        isCategory
                            ? "🗑️ Catégorie supprimée"
                            : "🗑️ Salon supprimé"
                    )
                    .setDescription(
                        `**${channel.name}** va être supprimé.\n\n` +
                        `**Type :** ${getChannelTypeName(channel)}\n` +
                        `**ID :** \`${channel.id}\`\n` +
                        `**Raison :** ${reason}\n\n` +
                        `↩️ Cette suppression a été sauvegardée et peut être annulée avec **/rollback**.`
                    )
                    .setFooter({
                        text:
                            `The Legacy • Action ${historyEntry.id}`
                    })
                    .setTimestamp();

            await interaction.editReply({
                embeds: [
                    successEmbed
                ]
            });

            // ==================================================
            // LOG AVANT SUPPRESSION
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
                                isCategory
                                    ? "🗑️ Catégorie supprimée"
                                    : "🗑️ Salon supprimé",

                            description:
                                `**Exécuté par :** <@${interaction.user.id}>\n` +
                                `**Nom :** ${channel.name}\n` +
                                `**ID :** \`${channel.id}\`\n` +
                                `**Type :** ${getChannelTypeName(channel)}\n` +
                                `**Raison :** ${reason}\n` +
                                `**Action rollback :** \`${historyEntry.id}\``,

                            color:
                                COLOR
                        }
                    )
                    .catch(
                        () => {}
                    );
            }

            // ==================================================
            // SUPPRESSION
            // ==================================================

            try {
                await channel.delete(
                    `The Legacy • /del par ${interaction.user.tag} • ${reason}`
                );

            } catch (deleteError) {
                // La suppression a échoué :
                // on retire l'action de l'historique pour éviter
                // qu'un /rollback tente de restaurer quelque chose
                // qui n'a jamais été supprimé.

                const history =
                    getActionHistory();

                const cleaned =
                    history.filter(
                        entry =>
                            entry.id !==
                            historyEntry.id
                    );

                saveActionHistory(
                    cleaned
                );

                throw deleteError;
            }

            return;

        } catch (error) {
            console.error(
                "❌ /del :",
                error
            );

            const errorEmbed =
                new EmbedBuilder()
                    .setColor(
                        ERROR_COLOR
                    )
                    .setTitle(
                        "❌ Suppression impossible"
                    )
                    .setDescription(
                        `Le salon ou la catégorie n'a pas pu être supprimé.\n\n` +
                        `\`\`\`\n${String(
                            error.message ||
                            error
                        ).slice(
                            0,
                            1500
                        )}\n\`\`\``
                    )
                    .setFooter({
                        text:
                            "The Legacy • /del"
                    })
                    .setTimestamp();

            return interaction.editReply({
                embeds: [
                    errorEmbed
                ]
            }).catch(
                () => {}
            );
        }
    },

    // ==================================================
    // EXPORTS UTILES
    // ==================================================

    actionHistory: {
        getActionHistory,
        saveActionHistory,
        addActionHistory
    }
};