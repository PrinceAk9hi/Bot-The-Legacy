const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("uch")
        .setDescription("Commande interne")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Membre")
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const membre = interaction.options.getUser("membre");

        if (!client.chiens.has(membre.id)) {
            return interaction.reply({
                content: "❌ Aucun suivi actif pour ce membre.",
                ephemeral: true
            });
        }

        client.chiens.delete(membre.id);

        await interaction.reply({
            content: `✅ Suivi désactivé pour ${membre.username}.`,
            ephemeral: true
        });
    }
};