const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Faire quitter le salon vocal au bot"),

    async execute(interaction, client) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        if (!client.voiceConnection) {
            return interaction.editReply({
                content: "❌ Je ne suis actuellement dans aucun vocal."
            });
        }

        try {
            client.voiceConnection.destroy();

            client.voiceConnection = null;
            client.voiceChannelId = null;

            console.log(
                "🔇 Le bot a quitté le salon vocal."
            );

            return interaction.editReply({
                content: "✅ J'ai quitté le salon vocal."
            });

        } catch (error) {
            console.error(
                "❌ Erreur /leave :",
                error
            );

            client.voiceConnection = null;
            client.voiceChannelId = null;

            return interaction.editReply({
                content:
                    `❌ Erreur en quittant le vocal.\n\`${error.message}\``
            });
        }
    }
};