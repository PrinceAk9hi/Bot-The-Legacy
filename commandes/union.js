const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const UNION_CHANNEL_ID =
    "1541081792302293153";

const COLOR =
    0x3B6475;

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "union"
            )
            .setDescription(
                "Proposer directement une Union à un membre"
            )

            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre à qui proposer une Union"
                    )
                    .setRequired(
                        true
                    )
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            const target =
                interaction.options
                    .getUser(
                        "membre"
                    );

            if (
                target.bot
            ) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de créer une Union avec un bot."
                });
            }

            if (
                target.id ===
                interaction.user.id
            ) {
                return interaction.editReply({
                    content:
                        "😭 Tu ne peux pas créer une Union avec toi-même."
                });
            }

            // ==================================================
            // BOUTONS
            // ==================================================

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `union_accept_${interaction.guild.id}_${interaction.user.id}_${target.id}`
                            )
                            .setLabel(
                                "Accepter l'Union"
                            )
                            .setEmoji(
                                "💍"
                            )
                            .setStyle(
                                ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `union_refuse_${interaction.guild.id}_${interaction.user.id}_${target.id}`
                            )
                            .setLabel(
                                "Refuser"
                            )
                            .setEmoji(
                                "❌"
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            // ==================================================
            // MP
            // ==================================================

            const embed =
                new EmbedBuilder()
                    .setColor(
                        COLOR
                    )
                    .setTitle(
                        "💌 Proposition d'Union"
                    )
                    .setDescription(
`<@${interaction.user.id}> souhaite créer une **Union officielle** avec toi au sein de **The Legacy**.

Il ne s'agit pas d'un tirage au sort ou d'un calcul de compatibilité : cette invitation t'a été envoyée directement par cette personne.

Souhaites-tu accepter ?`
                    )
                    .setThumbnail(
                        interaction.user
                            .displayAvatarURL({
                                size:
                                    512
                            })
                    )
                    .setFooter({
                        text:
                            "The Legacy • Union"
                    })
                    .setTimestamp();

            try {
                await target.send({
                    embeds: [
                        embed
                    ],

                    components: [
                        row
                    ]
                });

            } catch {
                return interaction.editReply({
                    content:
                        `❌ Impossible d'envoyer un MP à <@${target.id}>. Cette personne a probablement désactivé ses messages privés.`
                });
            }

            return interaction.editReply({
                content:
                    `💌 Ta proposition d'Union a été envoyée à <@${target.id}>.`
            });

        } catch (error) {
            console.error(
                "❌ /union :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    },

    // ==================================================
    // BOUTONS
    // ==================================================

    async handleButton(
        interaction
    ) {
        if (
            !interaction.customId.startsWith(
                "union_"
            )
        ) {
            return false;
        }

        const parts =
            interaction.customId.split(
                "_"
            );

        const action =
            parts[1];

        const guildId =
            parts[2];

        const inviterId =
            parts[3];

        const targetId =
            parts[4];

        if (
            interaction.user.id !==
            targetId
        ) {
            await interaction.reply({
                content:
                    "❌ Cette invitation ne t'est pas destinée.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        // ==================================================
        // REFUSER
        // ==================================================

        if (
            action ===
            "refuse"
        ) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0xED4245
                        )
                        .setTitle(
                            "💔 Union refusée"
                        )
                        .setDescription(
                            "Tu as refusé cette proposition."
                        )
                        .setTimestamp()
                ],

                components:
                    []
            });

            const inviter =
                await interaction.client.users
                    .fetch(
                        inviterId
                    )
                    .catch(
                        () => null
                    );

            if (inviter) {
                await inviter.send({
                    content:
                        `💔 <@${targetId}> a refusé ta proposition d'Union.`
                }).catch(
                    () => {}
                );
            }

            return true;
        }

        // ==================================================
        // ACCEPTER
        // ==================================================

        if (
            action ===
            "accept"
        ) {
            const guild =
                interaction.client.guilds.cache.get(
                    guildId
                );

            if (!guild) {
                return interaction.reply({
                    content:
                        "❌ Serveur introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const channel =
                guild.channels.cache.get(
                    UNION_CHANNEL_ID
                ) ||
                await guild.channels
                    .fetch(
                        UNION_CHANNEL_ID
                    )
                    .catch(
                        () => null
                    );

            if (
                !channel?.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        "❌ Salon des Unions introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ==================================================
            // ANNONCE
            // ==================================================

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xF1C40F
                    )
                    .setTitle(
                        "💍 Nouvelle Union"
                    )
                    .setDescription(
`Une nouvelle Union vient officiellement d'être créée au sein de **The Legacy** !

> 🪽 <@${inviterId}> est désormais lié à <@${targetId}>.

Cette Union a été créée à la suite d'une **invitation directe** acceptée par les deux membres.

Que cette nouvelle alliance écrive sa propre partie de l'héritage.`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Union"
                    })
                    .setTimestamp();

            await channel.send({
                content:
                    `<@${inviterId}> <@${targetId}>`,

                embeds: [
                    embed
                ]
            });

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(
                            0x57F287
                        )
                        .setTitle(
                            "💍 Union acceptée !"
                        )
                        .setDescription(
                            `Tu es désormais officiellement lié à <@${inviterId}>.`
                        )
                        .setTimestamp()
                ],

                components:
                    []
            });

            return true;
        }

        return false;
    }
};