const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "setuplogs"
            )
            .setDescription(
                "Créer et configurer tout le système de logs The Legacy"
            )

            .addRoleOption(
                option =>
                    option
                        .setName(
                            "acces"
                        )
                        .setDescription(
                            "Rôle qui pourra voir les salons de logs"
                        )
                        .setRequired(
                            false
                        )
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            if (
                !interaction.client.logs
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le système de logs n'est pas chargé."
                });
            }

            const accessRole =
                interaction.options.getRole(
                    "acces"
                );

            const result =
                await interaction.client.logs
                    .setupGuild(
                        interaction.guild,
                        interaction.user.id,
                        accessRole?.id ||
                        null
                    );

            const channelMentions =
                Object.values(
                    result.channels
                )
                    .map(
                        channelId =>
                            `<#${channelId}>`
                    )
                    .join(
                        "\n"
                    );

            return interaction.editReply({
                content:
                    [
                        "✅ **SYSTÈME DE LOGS INSTALLÉ**",
                        "",
                        `📁 **Catégorie :** ${result.category}`,
                        "",
                        channelMentions,
                        "",
                        accessRole
                            ? `🔐 **Accès supplémentaire :** ${accessRole}`
                            : "🔐 Les salons sont privés et accessibles à toi ainsi qu'au bot.",
                        "",
                        "📜 Toutes les commandes slash seront maintenant enregistrées automatiquement."
                    ].join("\n")
            });

        } catch (error) {
            console.error(
                "❌ /setuplogs :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Impossible de créer les logs.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};