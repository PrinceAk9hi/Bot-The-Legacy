const { CHANNELS } = require("../config/soulSociety");
const { hasAccessPermission } = require("../utils/security");

const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "setupstats"
            )
            .setDescription(
                "Installer le panel interactif des statistiques"
            )

            .addChannelOption(
                option =>
                    option
                        .setName(
                            "salon"
                        )
                        .setDescription(
                            "Salon où installer le panel statistiques"
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(false)
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
            // ADMIN
            // ==================================================

            if (
                !hasAccessPermission(interaction.member, 
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Cette commande est réservée aux administrateurs."
                });
            }

            // ==================================================
            // SYSTEM
            // ==================================================

            if (
                !interaction.client.activityStats ||
                typeof interaction.client.activityStats.installPanel !==
                    "function"
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le système de statistiques n'est pas chargé."
                });
            }

            const channel =
                interaction.options.getChannel("salon") ||
                interaction.guild.channels.cache.get(CHANNELS.ranking) ||
                await interaction.guild.channels.fetch(CHANNELS.ranking);

            const message =
                await interaction.client.activityStats
                    .installPanel(
                        interaction,
                        channel
                    );

            return interaction.editReply({
                content:
                    [
                        "✅ **Panel statistiques installé !**",
                        "",
                        `📊 Salon : <#${channel.id}>`,
                        `📝 Message : \`${message.id}\``,
                        "",
                        "Les compteurs Discord sont maintenant autonomes."
                    ].join(
                        "\n"
                    )
            });

        } catch (error) {
            console.error(
                "❌ /setupstats :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Impossible d'installer le panel.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};