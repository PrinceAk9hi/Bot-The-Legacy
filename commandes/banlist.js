const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "banlist"
            )
            .setDescription(
                "Afficher la liste des utilisateurs bannis"
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const bans =
            await interaction.guild.bans
                .fetch()
                .catch(
                    () => null
                );

        if (!bans) {
            return interaction.editReply({
                content:
                    "❌ Impossible de récupérer la liste des bans."
            });
        }

        if (!bans.size) {
            return interaction.editReply({
                content:
                    "✅ Aucun utilisateur n'est actuellement banni."
            });
        }

        const entries =
            [...bans.values()];

        const chunks =
            [];

        for (
            let i = 0;
            i < entries.length;
            i += 10
        ) {
            chunks.push(
                entries.slice(
                    i,
                    i + 10
                )
            );
        }

        const embeds =
            chunks
                .slice(
                    0,
                    10
                )
                .map(
                    (chunk, index) =>
                        new EmbedBuilder()
                            .setColor(
                                0xED4245
                            )
                            .setTitle(
                                index === 0
                                    ? `🔨 Liste des bannis — ${bans.size}`
                                    : `🔨 Liste des bannis — page ${index + 1}`
                            )
                            .setDescription(
                                chunk
                                    .map(
                                        ban =>
`**${ban.user.tag}**
ID : \`${ban.user.id}\`
Raison : ${ban.reason || "Aucune raison"}

`
                                    )
                                    .join(
                                        ""
                                    )
                                    .slice(
                                        0,
                                        4000
                                    )
                            )
                );

        return interaction.editReply({
            embeds
        });
    }
};