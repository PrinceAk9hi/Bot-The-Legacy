const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    getActiveUnionForMember,
    createUnion,
    rollbackUnion
} = require("../utils/unionStore");

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
// UNION DISPLAY
// ======================================================

function getAlreadyUnitedMessage(
    union,
    userId
) {
    if (!union) {
        return "Cette personne possède déjà une Union.";
    }

    const partnerId =
        union.member1Id === userId
            ? union.member2Id
            : union.member1Id;

    return `Cette personne est déjà liée à <@${partnerId}>.`;
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
                "Le rôle du bot doit être placé au-dessus du rôle d'Union."
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
                "Un des deux membres est introuvable."
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
        console.error(
            "❌ Attribution rôle Union :",
            error
        );

        return {
            ok: false,
            reason:
                error.message
        };
    }
}

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
            // INVITEUR DÉJÀ UNI
            // ==================================================

            const inviterUnion =
                getActiveUnionForMember(
                    interaction.guild.id,
                    interaction.user.id
                );

            if (inviterUnion) {
                const partnerId =
                    inviterUnion.member1Id ===
                    interaction.user.id
                        ? inviterUnion.member2Id
                        : inviterUnion.member1Id;

                return interaction.editReply({
                    content:
                        `❌ Tu possèdes déjà une Union avec <@${partnerId}>.`
                });
            }

            // ==================================================
            // CIBLE DÉJÀ UNIE
            // ==================================================

            const targetUnion =
                getActiveUnionForMember(
                    interaction.guild.id,
                    target.id
                );

            if (targetUnion) {
                return interaction.editReply({
                    content:
                        `❌ ${getAlreadyUnitedMessage(
                            targetUnion,
                            target.id
                        )}`
                });
            }

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
                        `❌ Impossible d'envoyer un MP à <@${target.id}>.`
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
            });
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
        // REFUS
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

            await inviter?.send(
                `💔 <@${targetId}> a refusé ta proposition d'Union.`
            ).catch(
                () => {}
            );

            return true;
        }

        // ==================================================
        // ACCEPTATION
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

            // IMPORTANT :
            // on revérifie au moment exact de l'acceptation.

            const inviterUnion =
                getActiveUnionForMember(
                    guildId,
                    inviterId
                );

            if (inviterUnion) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xED4245
                            )
                            .setTitle(
                                "❌ Union impossible"
                            )
                            .setDescription(
                                `<@${inviterId}> possède désormais déjà une Union.`
                            )
                    ],

                    components:
                        []
                });
            }

            const targetUnion =
                getActiveUnionForMember(
                    guildId,
                    targetId
                );

            if (targetUnion) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xED4245
                            )
                            .setTitle(
                                "❌ Union impossible"
                            )
                            .setDescription(
                                "Tu possèdes désormais déjà une Union."
                            )
                    ],

                    components:
                        []
                });
            }

            const inviterUser =
                await interaction.client.users
                    .fetch(
                        inviterId
                    )
                    .catch(
                        () => null
                    );

            // ==================================================
            // ENREGISTREMENT
            // ==================================================

            const creation =
                createUnion({
                    guildId,

                    member1Id:
                        inviterId,

                    member1Tag:
                        inviterUser?.tag ||
                        null,

                    member2Id:
                        targetId,

                    member2Tag:
                        interaction.user.tag,

                    createdBy:
                        inviterId,

                    source:
                        "union"
                });

            if (!creation.ok) {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xED4245
                            )
                            .setTitle(
                                "❌ Union impossible"
                            )
                            .setDescription(
                                "L'un des deux membres possède déjà une Union."
                            )
                    ],

                    components:
                        []
                });
            }

            // ==================================================
            // RÔLES
            // ==================================================

            const roleResult =
                await giveUnionRole(
                    guild,
                    inviterId,
                    targetId
                );

            if (!roleResult.ok) {
                rollbackUnion(
                    creation.union.id
                );

                return interaction.reply({
                    content:
                        `❌ Impossible de finaliser l'Union.\n${roleResult.reason}`,

                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ==================================================
            // SALON
            // ==================================================

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
                channel?.isTextBased()
            ) {
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
            }

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