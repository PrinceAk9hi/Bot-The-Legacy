const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("sync")
            .setDescription(
                "Synchroniser les permissions des salons avec leur catégorie"
            )

            .addRoleOption(
                option =>
                    option
                        .setName("role")
                        .setDescription(
                            "Synchroniser uniquement les permissions de ce rôle"
                        )
                        .setRequired(false)
            ),

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
            // PERMISSION UTILISATEUR
            // ==================================================

            const member =
                interaction.member;

            if (
                !member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                ) &&
                !member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu dois avoir la permission **Gérer les salons** pour utiliser `/sync`."
                });
            }

            // ==================================================
            // SALON ACTUEL
            // ==================================================

            const currentChannel =
                interaction.channel;

            if (!currentChannel) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de récupérer le salon actuel."
                });
            }

            // ==================================================
            // CATÉGORIE
            // ==================================================

            const category =
                currentChannel.parent;

            if (!category) {
                return interaction.editReply({
                    content:
                        "❌ Ce salon n'est dans aucune catégorie."
                });
            }

            // ==================================================
            // SALONS DE LA CATÉGORIE
            // ==================================================

            const channels =
                interaction.guild.channels.cache.filter(
                    channel =>
                        channel.parentId ===
                        category.id
                );

            if (
                channels.size ===
                0
            ) {
                return interaction.editReply({
                    content:
                        "❌ Aucun salon trouvé dans cette catégorie."
                });
            }

            const role =
                interaction.options.getRole(
                    "role"
                );

            let success =
                0;

            let failed =
                0;

            const errors =
                [];

            // ==================================================
            // MODE 1
            // TOUTES LES PERMISSIONS
            // ==================================================

            if (!role) {
                for (
                    const channel
                    of channels.values()
                ) {
                    try {
                        // ======================================
                        // SYNCHRONISATION NATIVE DISCORD
                        // ======================================

                        await channel.lockPermissions();

                        success++;

                        console.log(
                            `🔄 SYNC : ${channel.name} synchronisé avec ${category.name}`
                        );

                    } catch (error) {
                        failed++;

                        console.error(
                            `❌ SYNC ${channel.name} :`,
                            error
                        );

                        errors.push(
                            channel.name
                        );
                    }
                }

                // ==================================================
                // RÉPONSE
                // ==================================================

                const response = [
                    "🔄 **SYNCHRONISATION TERMINÉE**",
                    "",
                    `📁 **Catégorie :** ${category.name}`,
                    `✅ **${success} salon(s) synchronisé(s)**`,
                    failed
                        ? `❌ **${failed} échec(s)**`
                        : null,
                    "",
                    "Tous les salons utilisent maintenant les **permissions de leur catégorie**."
                ]
                    .filter(Boolean)
                    .join("\n");

                return interaction.editReply({
                    content:
                        response
                });
            }

            // ==================================================
            // MODE 2
            // UNIQUEMENT UN RÔLE
            // ==================================================

            const categoryOverwrite =
                category.permissionOverwrites.cache.get(
                    role.id
                );

            for (
                const channel
                of channels.values()
            ) {
                try {
                    // ======================================
                    // LE RÔLE A UN OVERWRITE SUR CATÉGORIE
                    // ======================================

                    if (
                        categoryOverwrite
                    ) {
                        await channel.permissionOverwrites.edit(
                            role.id,
                            {
                                // ==================================
                                // GENERAL
                                // ==================================

                                ViewChannel:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ViewChannel
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ViewChannel
                                        )
                                            ? false
                                            : null,

                                ManageChannels:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ManageChannels
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ManageChannels
                                        )
                                            ? false
                                            : null,

                                ManageRoles:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ManageRoles
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ManageRoles
                                        )
                                            ? false
                                            : null,

                                ManageWebhooks:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ManageWebhooks
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ManageWebhooks
                                        )
                                            ? false
                                            : null,

                                CreateInstantInvite:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.CreateInstantInvite
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.CreateInstantInvite
                                        )
                                            ? false
                                            : null,

                                // ==================================
                                // TEXTE
                                // ==================================

                                SendMessages:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.SendMessages
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.SendMessages
                                        )
                                            ? false
                                            : null,

                                SendMessagesInThreads:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.SendMessagesInThreads
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.SendMessagesInThreads
                                        )
                                            ? false
                                            : null,

                                CreatePublicThreads:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.CreatePublicThreads
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.CreatePublicThreads
                                        )
                                            ? false
                                            : null,

                                CreatePrivateThreads:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.CreatePrivateThreads
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.CreatePrivateThreads
                                        )
                                            ? false
                                            : null,

                                EmbedLinks:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.EmbedLinks
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.EmbedLinks
                                        )
                                            ? false
                                            : null,

                                AttachFiles:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.AttachFiles
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.AttachFiles
                                        )
                                            ? false
                                            : null,

                                AddReactions:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.AddReactions
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.AddReactions
                                        )
                                            ? false
                                            : null,

                                UseExternalEmojis:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.UseExternalEmojis
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.UseExternalEmojis
                                        )
                                            ? false
                                            : null,

                                UseExternalStickers:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.UseExternalStickers
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.UseExternalStickers
                                        )
                                            ? false
                                            : null,

                                MentionEveryone:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.MentionEveryone
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.MentionEveryone
                                        )
                                            ? false
                                            : null,

                                ManageMessages:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ManageMessages
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ManageMessages
                                        )
                                            ? false
                                            : null,

                                ManageThreads:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ManageThreads
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ManageThreads
                                        )
                                            ? false
                                            : null,

                                ReadMessageHistory:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.ReadMessageHistory
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.ReadMessageHistory
                                        )
                                            ? false
                                            : null,

                                // ==================================
                                // VOCAL
                                // ==================================

                                Connect:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.Connect
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.Connect
                                        )
                                            ? false
                                            : null,

                                Speak:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.Speak
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.Speak
                                        )
                                            ? false
                                            : null,

                                Stream:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.Stream
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.Stream
                                        )
                                            ? false
                                            : null,

                                MuteMembers:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.MuteMembers
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.MuteMembers
                                        )
                                            ? false
                                            : null,

                                DeafenMembers:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.DeafenMembers
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.DeafenMembers
                                        )
                                            ? false
                                            : null,

                                MoveMembers:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.MoveMembers
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.MoveMembers
                                        )
                                            ? false
                                            : null,

                                UseVAD:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.UseVAD
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.UseVAD
                                        )
                                            ? false
                                            : null,

                                PrioritySpeaker:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.PrioritySpeaker
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.PrioritySpeaker
                                        )
                                            ? false
                                            : null,

                                RequestToSpeak:
                                    categoryOverwrite.allow.has(
                                        PermissionFlagsBits.RequestToSpeak
                                    )
                                        ? true
                                        : categoryOverwrite.deny.has(
                                            PermissionFlagsBits.RequestToSpeak
                                        )
                                            ? false
                                            : null
                            },
                            {
                                reason:
                                    `/sync rôle par ${interaction.user.tag}`
                            }
                        );
                    }

                    // ======================================
                    // PAS DE PERMISSION RÔLE DANS CATÉGORIE
                    // ======================================

                    else {
                        const existing =
                            channel.permissionOverwrites.cache.get(
                                role.id
                            );

                        if (
                            existing
                        ) {
                            await existing.delete(
                                `/sync rôle par ${interaction.user.tag}`
                            );
                        }
                    }

                    success++;

                    console.log(
                        `🔄 SYNC ROLE : ${role.name} → ${channel.name}`
                    );

                } catch (error) {
                    failed++;

                    console.error(
                        `❌ SYNC ROLE ${channel.name} :`,
                        error
                    );

                    errors.push(
                        channel.name
                    );
                }
            }

            // ==================================================
            // RÉPONSE ROLE
            // ==================================================

            return interaction.editReply({
                content:
                    [
                        "🔄 **SYNCHRONISATION DU RÔLE TERMINÉE**",
                        "",
                        `📁 **Catégorie :** ${category.name}`,
                        `🎭 **Rôle :** <@&${role.id}>`,
                        "",
                        `✅ **${success} salon(s) synchronisé(s)**`,
                        failed
                            ? `❌ **${failed} échec(s)**`
                            : null,
                        "",
                        categoryOverwrite
                            ? "Seules les permissions de ce rôle ont été copiées depuis la catégorie."
                            : "Le rôle n'a aucune permission spécifique sur la catégorie : ses permissions spécifiques ont donc été retirées des salons."
                    ]
                        .filter(Boolean)
                        .join("\n")
            });

        } catch (error) {
            console.error(
                "❌ /sync :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Erreur pendant la synchronisation.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};