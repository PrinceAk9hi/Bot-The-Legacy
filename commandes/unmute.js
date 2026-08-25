const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "unmute"
            )
            .setDescription(
                "Retirer le timeout d'un membre"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre à unmute"
                    )
                    .setRequired(
                        true
                    )
            )
            .addStringOption(option =>
                option
                    .setName(
                        "raison"
                    )
                    .setDescription(
                        "Raison du unmute"
                    )
                    .setRequired(
                        false
                    )
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ModerateMembers
            ),

    async execute(
        interaction
    ) {
        const membre =
            interaction.options.getMember(
                "membre"
            );

        const raison =
            interaction.options.getString(
                "raison"
            ) ||
            "Aucune raison précisée";

        if (!membre) {
            return interaction.reply({
                content:
                    "❌ Membre introuvable.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (
            !membre.moderatable
        ) {
            return interaction.reply({
                content:
                    "❌ Je ne peux pas modifier le timeout de ce membre.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        if (
            !membre.communicationDisabledUntilTimestamp ||
            membre.communicationDisabledUntilTimestamp <=
                Date.now()
        ) {
            return interaction.reply({
                content:
                    "❌ Ce membre n'est actuellement pas mute.",

                flags:
                    MessageFlags.Ephemeral
            });
        }

        await membre.timeout(
            null,
            `${raison} | Par ${interaction.user.tag}`
        );

        return interaction.reply({
            content:
                `🔊 **${membre.user.tag}** a été unmute.\nRaison : **${raison}**`
        });
    }
};