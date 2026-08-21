const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require("discord.js");

const logsPath = path.join(
    __dirname,
    "..",
    "data",
    "logs.json"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlogs")
        .setDescription(
            "Définir le salon des logs du bot"
        )
        .addChannelOption(option =>
            option
                .setName("salon")
                .setDescription(
                    "Salon où envoyer les logs"
                )
                .addChannelTypes(
                    ChannelType.GuildText
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const salon =
            interaction.options.getChannel(
                "salon"
            );

        let config = {};

        try {
            config = JSON.parse(
                fs.readFileSync(
                    logsPath,
                    "utf8"
                )
            );
        } catch {
            config = {};
        }

        config[
            interaction.guild.id
        ] = salon.id;

        fs.writeFileSync(
            logsPath,
            JSON.stringify(
                config,
                null,
                4
            )
        );

        await interaction.editReply({
            content:
                `✅ Les logs seront maintenant envoyés dans ${salon}.`
        });
    }
};