const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    getActiveUnionBetween,
    deleteUnion
} = require("../utils/unionStore");

// ======================================================
// CONFIG
// ======================================================

const UNION_ROLE_ID =
    "1541599328756432947";

// ======================================================
// REMOVE ROLE
// ======================================================

async function removeUnionRole(
    guild,
    userId
) {
    const member =
        guild.members.cache.get(
            userId
        ) ||
        await guild.members
            .fetch(
                userId
            )
            .catch(
                () => null
            );

    if (!member) {
        return;
    }

    if (
        !member.roles.cache.has(
            UNION_ROLE_ID
        )
    ) {
        return;
    }

    await member.roles.remove(
        UNION_ROLE_ID,
        "Suppression d'une Union The Legacy"
    ).catch(
        error => {
            console.error(
                `❌ Retrait rôle Union ${userId} :`,
                error
            );
        }
    );
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "delunion"
            )
            .setDescription(
                "Supprimer une Union existante"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre1"
                    )
                    .setDescription(
                        "Premier membre de l'Union"
                    )
                    .setRequired(
                        true
                    )
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre2"
                    )
                    .setDescription(
                        "Deuxième membre de l'Union"
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
                        "Raison de la suppression"
                    )
                    .setRequired(
                        true
                    )
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageRoles
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const member1 =
            interaction.options
                .getUser(
                    "membre1"
                );

        const member2 =
            interaction.options
                .getUser(
                    "membre2"
                );

        const reason =
            interaction.options
                .getString(
                    "raison"
                );

        if (
            member1.id ===
            member2.id
        ) {
            return interaction.editReply({
                content:
                    "❌ Tu dois sélectionner deux membres différents."
            });
        }

        const activeUnion =
            getActiveUnionBetween(
                interaction.guild.id,
                member1.id,
                member2.id
            );

        if (!activeUnion) {
            return interaction.editReply({
                content:
                    "❌ Ces deux membres ne possèdent aucune Union active ensemble."
            });
        }

        // ==================================================
        // SUPPRESSION PERSISTANTE
        // ==================================================

        const result =
            deleteUnion({
                guildId:
                    interaction.guild.id,

                member1Id:
                    member1.id,

                member2Id:
                    member2.id,

                deletedBy:
                    interaction.user.id,

                reason
            });

        if (!result.ok) {
            return interaction.editReply({
                content:
                    "❌ Impossible de supprimer cette Union."
            });
        }

        // ==================================================
        // RÔLES
        // ==================================================

        await Promise.all([
            removeUnionRole(
                interaction.guild,
                member1.id
            ),

            removeUnionRole(
                interaction.guild,
                member2.id
            )
        ]);

        // ==================================================
        // DM
        // ==================================================

        await member1.send(
            `💔 Ton Union avec <@${member2.id}> a été supprimée.\nRaison : **${reason}**`
        ).catch(
            () => {}
        );

        await member2.send(
            `💔 Ton Union avec <@${member1.id}> a été supprimée.\nRaison : **${reason}**`
        ).catch(
            () => {}
        );

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xED4245
                )
                .setTitle(
                    "💔 Union supprimée"
                )
                .setDescription(
`L'Union entre <@${member1.id}> et <@${member2.id}> a été supprimée.

### 📝 Raison
${reason}

### 👤 Supprimée par
<@${interaction.user.id}>`
                )
                .setFooter({
                    text:
                        "The Legacy • Union"
                })
                .setTimestamp();

        return interaction.editReply({
            embeds: [
                embed
            ]
        });
    }
};