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

const UNION_ROLE_ID =
    "1541599328756432947";

const COLOR =
    0x3B6475;

// ======================================================
// HELPERS
// ======================================================

function randomPercent() {
    return Math.floor(
        Math.random() * 101
    );
}

function progressBar(
    percent
) {
    const filled =
        Math.round(
            percent / 10
        );

    return (
        "█".repeat(
            filled
        ) +
        "░".repeat(
            10 - filled
        )
    );
}

function getResultText(
    percent
) {
    if (
        percent <= 20
    ) {
        return "💀 Catastrophe sentimentale annoncée.";
    }

    if (
        percent <= 40
    ) {
        return "😬 Ça risque d'être compliqué...";
    }

    if (
        percent <= 60
    ) {
        return "🤔 Il y a peut-être quelque chose à tenter.";
    }

    if (
        percent <= 80
    ) {
        return "💗 Un duo plutôt prometteur...";
    }

    if (
        percent <= 99
    ) {
        return "💞 Très grosse compatibilité détectée !";
    }

    return "💍 Âmes sœurs officiellement validées par The Legacy.";
}

// ======================================================
// RÔLE UNION
// ======================================================

async function giveUnionRole(
    guild,
    inviterId,
    targetId
) {
    const role =
        guild.roles.cache.get(
            UNION_ROLE_ID
        ) ||
        await guild.roles
            .fetch(
                UNION_ROLE_ID
            )
            .catch(
                () => null
            );

    if (!role) {
        return {
            ok: false,
            reason:
                "Le rôle d'Union est introuvable."
        };
    }

    if (!role.editable) {
        return {
            ok: false,
            reason:
                "Place le rôle du bot au-dessus du rôle d'Union."
        };
    }

    const inviter =
        guild.members.cache.get(
            inviterId
        ) ||
        await guild.members
            .fetch(
                inviterId
            )
            .catch(
                () => null
            );

    const target =
        guild.members.cache.get(
            targetId
        ) ||
        await guild.members
            .fetch(
                targetId
            )
            .catch(
                () => null
            );

    if (
        !inviter ||
        !target
    ) {
        return {
            ok: false,
            reason:
                "Un des membres est introuvable."
        };
    }

    try {
        if (
            !inviter.roles.cache.has(
                UNION_ROLE_ID
            )
        ) {
            await inviter.roles.add(
                role,
                "Union The Legacy"
            );
        }

        if (
            !target.roles.cache.has(
                UNION_ROLE_ID
            )
        ) {
            await target.roles.add(
                role,
                "Union The Legacy"
            );
        }

        return {
            ok: true
        };

    } catch (error) {
        return {
            ok: false,
            reason:
                error.message
        };
    }
}

// ======================================================
// ENVOYER INVITATION UNION
// ======================================================

async function sendUnionInvitation({
    guild,
    inviter,
    target,
    percent
}) {
    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `ship_union_accept_${guild.id}_${inviter.id}_${target.id}_${percent}`
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
                        `ship_union_refuse_${guild.id}_${inviter.id}_${target.id}_${percent}`
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

    const embed =
        new EmbedBuilder()
            .setColor(
                COLOR
            )
            .setTitle(
                "💌 Proposition d'Union"
            )
            .setDescription(
`<@${inviter.id}> vient d'obtenir une compatibilité de **${percent}%** avec toi sur **The Legacy** !

Cette compatibilité étant particulièrement élevée, tu peux choisir de créer officiellement une **Union** avec cette personne.

> 💞 **Compatibilité : ${percent}%**

Souhaites-tu accepter cette Union ?`
            )
            .setThumbnail(
                inviter.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Union"
            })
            .setTimestamp();

    await target.send({
        embeds: [
            embed
        ],

        components: [
            row
        ]
    });

    return true;
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "ship"
            )
            .setDescription(
                "Calculer ta compatibilité avec un membre"
            )
            .addUserOption(option =>
                option
                    .setName(
                        "membre"
                    )
                    .setDescription(
                        "Membre avec qui calculer ta compatibilité"
                    )
                    .setRequired(
                        true
                    )
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply();

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
                        "😭 Même The Legacy ne peut pas calculer une relation avec un bot."
                });
            }

            if (
                target.id ===
                interaction.user.id
            ) {
                return interaction.editReply({
                    content:
                        "😭 Tu ne peux pas te ship avec toi-même."
                });
            }

            const percent =
                randomPercent();

            const bar =
                progressBar(
                    percent
                );

            const resultText =
                getResultText(
                    percent
                );

            const embed =
                new EmbedBuilder()
                    .setColor(
                        COLOR
                    )
                    .setTitle(
                        "💘 Compatibilité Legacy"
                    )
                    .setDescription(
`## <@${interaction.user.id}> × <@${target.id}>

### ❤️ ${percent}%

\`${bar}\`

> ${resultText}`
                    )
                    .setThumbnail(
                        target.displayAvatarURL({
                            size:
                                512
                        })
                    )
                    .setFooter({
                        text:
                            "The Legacy • Compatibilité"
                    })
                    .setTimestamp();

            if (
                percent >= 81
            ) {
                let dmSent =
                    false;

                try {
                    await sendUnionInvitation({
                        guild:
                            interaction.guild,

                        inviter:
                            interaction.user,

                        target,

                        percent
                    });

                    dmSent =
                        true;

                } catch {
                    console.log(
                        `⚠️ Impossible d'envoyer l'invitation Union à ${target.tag}`
                    );
                }

                embed.addFields({
                    name:
                        "💍 Union disponible",

                    value:
                        dmSent
                            ? `<@${target.id}> a reçu une **proposition d'Union en MP**.`
                            : `La compatibilité permettait une Union, mais <@${target.id}> n'accepte pas les MP.`,

                    inline:
                        false
                });
            }

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });

        } catch (error) {
            console.error(
                "❌ /ship :",
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
                "ship_union_"
            )
        ) {
            return false;
        }

        const parts =
            interaction.customId.split(
                "_"
            );

        const action =
            parts[2];

        const guildId =
            parts[3];

        const inviterId =
            parts[4];

        const targetId =
            parts[5];

        const percent =
            Number(
                parts[6]
            );

        if (
            interaction.user.id !==
            targetId
        ) {
            await interaction.reply({
                content:
                    "❌ Cette proposition ne t'est pas destinée.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

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
                            "Tu as refusé cette proposition d'Union."
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

            const roleResult =
                await giveUnionRole(
                    guild,
                    inviterId,
                    targetId
                );

            if (!roleResult.ok) {
                return interaction.reply({
                    content:
                        `❌ Impossible de finaliser l'Union.\n${roleResult.reason}`,

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
                        "❌ Le salon des Unions est introuvable.",

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const unionEmbed =
                new EmbedBuilder()
                    .setColor(
                        0xF1C40F
                    )
                    .setTitle(
                        "💍 Nouvelle Union"
                    )
                    .setDescription(
`Une nouvelle Union vient officiellement d'être créée au sein de **The Legacy** !

> 💞 <@${inviterId}> est désormais lié à <@${targetId}>.

### Compatibilité
❤️ **${percent}%**

Que cette Union soit longue, glorieuse et surtout pas trop chaotique. 🪽`
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
                    unionEmbed
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
                            `Ton Union avec <@${inviterId}> a été officiellement créée.`
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