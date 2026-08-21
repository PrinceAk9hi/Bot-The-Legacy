const {
    SlashCommandBuilder,
    ActivityType
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("presence")
        .setDescription("Modifier l'activité du bot")
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Type d'activité")
                .setRequired(true)
                .addChoices(
                    { name: "Joue à", value: "playing" },
                    { name: "Regarde", value: "watching" },
                    { name: "Écoute", value: "listening" },
                    { name: "Participe à", value: "competing" },
                    { name: "Supprimer", value: "clear" }
                )
        )
        .addStringOption(option =>
            option
                .setName("texte")
                .setDescription("Texte à afficher")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const type = interaction.options.getString("type");
        const texte = interaction.options.getString("texte");

        if (type === "clear") {
            client.user.setActivity(null);

            return interaction.reply({
                content: "✅ Activité supprimée.",
                ephemeral: true
            });
        }

        if (!texte) {
            return interaction.reply({
                content: "❌ Tu dois mettre un texte.",
                ephemeral: true
            });
        }

        const types = {
            playing: ActivityType.Playing,
            watching: ActivityType.Watching,
            listening: ActivityType.Listening,
            competing: ActivityType.Competing
        };

        client.user.setActivity(texte, {
            type: types[type]
        });

        await interaction.reply({
            content: "✅ Activité du bot modifiée.",
            ephemeral: true
        });
    }
};