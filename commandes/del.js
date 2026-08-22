const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

// ======================================================
// LOG
// ======================================================

async function sendDeleteLog(
    client,
    guild,
    {
        executor,
        mode,
        channelName = null,
        channelId = null,
        categoryName = null,
        categoryId = null,
        deletedChannels = []
    }
) {
    if (
        !client.logs ||
        typeof client.logs.logSpecial !==
            "function"
    ) {
        return;
    }

    const fields = [
        {
            name:
                "👤 Exécutant",

            value:
                `<@${executor.id}>\n\`${executor.id}\``,

            inline:
                true
        },

        {
            name:
                "🗑️ Action",

            value:
                mode === "category"
                    ? "Suppression d'une catégorie complète"
                    : "Suppression d'un salon",

            inline:
                true
        }
    ];

    if (
        mode === "channel"
    ) {
        fields.push({
            name:
                "📍 Salon supprimé",

            value:
                `**${channelName || "Inconnu"}**\n\`${channelId || "Inconnu"}\``,

            inline:
                false
        });
    }

    if (
        mode === "category"
    ) {
        fields.push({
            name:
                "📁 Catégorie supprimée",

            value:
                `**${categoryName || "Inconnue"}**\n\`${categoryId || "Inconnu"}\``,

            inline:
                false
        });

        fields.push({
            name:
                `🧹 Salons supprimés • ${deletedChannels.length}`,

            value:
                deletedChannels.length
                    ? deletedChannels
                        .map(
                            channel =>
                                `• ${channel.name} • \`${channel.id}\``
                        )
                        .join("\n")
                        .slice(
                            0,
                            1024
                        )
                    : "Aucun salon.",

            inline:
                false
        });
    }

    await client.logs
        .logSpecial(
            guild,
            "system",
            {
                title:
                    mode === "category"
                        ? "🗑️ Catégorie supprimée"
                        : "🗑️ Salon supprimé",

                fields,

                color:
                    0xED4245
            }
        )
        .catch(
            () => {}
        );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("del")
            .setDescription(
                "Supprimer un salon ou toute sa catégorie"
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("salon")
                        .setDescription(
                            "Supprimer le salon actuel"
                        )
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("categorie")
                        .setDescription(
                            "Supprimer tous les salons de la catégorie puis la catégorie"
                        )
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageChannels
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(
        interaction
    ) {
        try {
            const subcommand =
                interaction.options
                    .getSubcommand();

            const channel =
                interaction.channel;

            const guild =
                interaction.guild;

            // ==================================================
            // /DEL SALON
            // ==================================================

            if (
                subcommand ===
                "salon"
            ) {
                const channelName =
                    channel.name;

                const channelId =
                    channel.id;

                await interaction.reply({
                    content:
                        `🗑️ Suppression de **#${channelName}**...`,

                    flags:
                        MessageFlags.Ephemeral
                });

                // ==============================================
                // LOG AVANT SUPPRESSION
                // ==============================================

                await sendDeleteLog(
                    interaction.client,
                    guild,
                    {
                        executor:
                            interaction.user,

                        mode:
                            "channel",

                        channelName,

                        channelId
                    }
                );

                console.log(
                    `🗑️ /del salon : ${interaction.user.tag} → ${channelName} (${channelId})`
                );

                // Petite attente pour laisser Discord valider la réponse
                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            800
                        )
                );

                await channel.delete(
                    `/del salon par ${interaction.user.tag}`
                );

                return;
            }

            // ==================================================
            // /DEL CATEGORIE
            // ==================================================

            if (
                subcommand ===
                "categorie"
            ) {
                const category =
                    channel.parent;

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Ce salon n'est dans aucune catégorie.",

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const categoryId =
                    category.id;

                const categoryName =
                    category.name;

                const channels =
                    [
                        ...guild.channels
                            .cache
                            .values()
                    ]
                        .filter(
                            candidate =>
                                candidate.parentId ===
                                categoryId
                        );

                const deletedChannels =
                    channels.map(
                        candidate => ({
                            id:
                                candidate.id,

                            name:
                                candidate.name
                        })
                    );

                await interaction.reply({
                    content:
                        `🗑️ Suppression de la catégorie **${categoryName}** et de **${channels.length} salon(s)**...`,

                    flags:
                        MessageFlags.Ephemeral
                });

                // ==============================================
                // LOG AVANT SUPPRESSION
                // ==============================================

                await sendDeleteLog(
                    interaction.client,
                    guild,
                    {
                        executor:
                            interaction.user,

                        mode:
                            "category",

                        categoryName,

                        categoryId,

                        deletedChannels
                    }
                );

                console.log(
                    `🗑️ /del categorie : ${interaction.user.tag} → ${categoryName} + ${channels.length} salon(s)`
                );

                // ==============================================
                // SUPPRIMER TOUS LES SALONS
                // ==============================================

                for (
                    const targetChannel
                    of channels
                ) {
                    try {
                        await targetChannel.delete(
                            `/del categorie par ${interaction.user.tag}`
                        );

                    } catch (error) {
                        console.error(
                            `❌ Suppression ${targetChannel.name} :`,
                            error
                        );
                    }
                }

                // ==============================================
                // SUPPRIMER LA CATÉGORIE
                // ==============================================

                await category.delete(
                    `/del categorie par ${interaction.user.tag}`
                );

                return;
            }

        } catch (error) {
            console.error(
                "❌ /del :",
                error
            );

            try {
                if (
                    interaction.deferred
                ) {
                    await interaction.editReply({
                        content:
                            `❌ Erreur : \`${error.message}\``
                    });

                } else if (
                    interaction.replied
                ) {
                    await interaction.followUp({
                        content:
                            `❌ Erreur : \`${error.message}\``,

                        flags:
                            MessageFlags.Ephemeral
                    });

                } else {
                    await interaction.reply({
                        content:
                            `❌ Erreur : \`${error.message}\``,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

            } catch {}
        }
    }
};