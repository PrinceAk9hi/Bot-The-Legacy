const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("update")
        .setDescription(
            "Recharger les commandes du bot"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(
        interaction,
        client
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            if (
                typeof client.reloadCommands !==
                "function"
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le système d'update n'est pas chargé dans index.js."
                });
            }

            const result =
                await client.reloadCommands();

            return interaction.editReply({
                content:
                    `✅ **Mise à jour terminée !**\n\n` +
                    `📦 ${result.commands} commande(s) chargée(s)\n` +
                    `🌐 ${result.guilds} serveur(s) actualisé(s)`
            });

        } catch (error) {
            console.error(
                "❌ /update :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ La mise à jour a échoué.\n\`${error.message}\``
            });
        }
    }
};