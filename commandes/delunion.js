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

const UNION_CHANNEL_ID =
    "1541081792302293153";

const COLOR =
    0x3B6475;

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
        return false;
    }

    if (
        !member.roles.cache.has(
            UNION_ROLE_ID
        )
    ) {
        return true;
    }

    try {
        await member.roles.remove(
            UNION_ROLE_ID,
            "Suppression d'une Union The Legacy"
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Retrait rôle Union ${userId} :`,
            error
        );

        return false;
    }
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
            interaction.options.getUser(
                "membre1"
            );

        const member2 =
            interaction.options.getUser(
                "membre2"
            );

        const reason =
            interaction.options.getString(
                "raison"
            );

        // ==================================================
        // SÉCURITÉ
        // ==================================================

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
                    "❌ Ces deux membres n'ont aucune Union active ensemble."
            });
        }

        // ==================================================
        // ARCHIVAGE
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

                deletedByTag:
                    interaction.user.tag,

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
        // MP
        // ==================================================

        await member1.send({
            content:
`💔 Ton Union avec <@${member2.id}> a été supprimée.

**Raison :** ${reason}`
        }).catch(
            () => {}
        );

        await member2.send({
            content:
`💔 Ton Union avec <@${member1.id}> a été supprimée.

**Raison :** ${reason}`
        }).catch(
            () => {}
        );

        // ==================================================
        // ANNONCE SALON UNION
        // ==================================================

        const channel =
            interaction.guild.channels.cache.get(
                UNION_CHANNEL_ID
            ) ||
            await interaction.guild.channels
                .fetch(
                    UNION_CHANNEL_ID
                )
                .catch(
                    () => null
                );

        if (
            channel?.isTextBased()
        ) {
            const publicEmbed =
                new EmbedBuilder()
                    .setColor(
                        0xED4245
                    )
                    .setTitle(
                        "💔 Fin d'une Union"
                    )
                    .setDescription(
`L'Union entre <@${member1.id}> et <@${member2.id}> prend officiellement fin.

> **Raison :** ${reason}

Les deux membres ne sont désormais plus liés par une Union au sein de **The Legacy**.`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Unions"
                    })
                    .setTimestamp();

            await channel.send({
                embeds: [
                    publicEmbed
                ]
            }).catch(
                () => {}
            );
        }

        // ==================================================
        // LOG CONSOLE
        // ==================================================

        console.log(
            `💔 Union supprimée : ${member1.tag} × ${member2.tag} | Par ${interaction.user.tag} | ${reason}`
        );

        // Le système global dans index.js enregistrera
        // également automatiquement /delunion dans les logs.

        const confirmation =
            new EmbedBuilder()
                .setColor(
                    COLOR
                )
                .setTitle(
                    "✅ Union supprimée"
                )
                .setDescription(
`L'Union entre <@${member1.id}> et <@${member2.id}> a été supprimée et archivée.

**Raison :**
${reason}`
                )
                .setFooter({
                    text:
                        `Action effectuée par ${interaction.user.tag}`
                })
                .setTimestamp();

        return interaction.editReply({
            embeds: [
                confirmation
            ]
        });
    }
};