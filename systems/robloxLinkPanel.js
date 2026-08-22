const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const {
    getRobloxLink
} = require("../utils/robloxLinks");

// ======================================================
// CONFIG
// ======================================================

const CHANGE_BUTTON_ID =
    "legacy_change_roblox";

const CHANGE_MODAL_ID =
    "legacy_change_roblox_modal";

const LINK_ALL_BUTTON_ID =
    "legacy_link_all";

// Rôle des membres Legacy à vérifier
const MEMBER_ROLE_ID =
    "1458391977073574012";

// Salon où se trouve le bouton pour changer/lier Roblox
const ROBLOX_HELP_CHANNEL_ID =
    "1506762774397845534";

// Salon des nouvelles liaisons
const LINK_LOG_CHANNEL_ID =
    "1540535302701981816";

// Rôles autorisés à utiliser Link All
const ALLOWED_ROLES = [
    "1458414705717805189", // Fondateur
    "1467277541696868412", // Souverain
    "1531760308761133229"  // Responsable Sanctions
];

// ======================================================
// PERMISSIONS
// ======================================================

function hasLinkAllPermission(
    member
) {
    return ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// LOG NOUVELLE LIAISON
// ======================================================

async function sendLinkAnnouncement({
    guild,
    member,
    robloxUsername,
    existing
}) {
    const channel =
        await guild.channels
            .fetch(
                LINK_LOG_CHANNEL_ID
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        console.log(
            "⚠️ Salon annonces liaison Roblox introuvable."
        );

        return;
    }

    let content;

    // Nouvelle liaison
    if (!existing) {
        content =
`## 🔗 Nouvelle liaison Roblox

<@${member.id}> a relié son compte Discord à son Roblox !

> **Discord :** <@${member.id}>
> **Roblox :** \`${robloxUsername}\``;
    }

    // Modification d'une liaison existante
    else {
        content =
`## 🔄 Compte Roblox modifié

<@${member.id}> a modifié le compte Roblox relié à son Discord !

> **Discord :** <@${member.id}>
> **Ancien Roblox :** \`${existing.robloxUsername || "Inconnu"}\`
> **Nouveau Roblox :** \`${robloxUsername}\``;
    }

    await channel.send({
        content,

        allowedMentions: {
            users: [
                member.id
            ]
        }
    }).catch(
        error =>
            console.error(
                "❌ Annonce liaison Roblox :",
                error
            )
    );
}

// ======================================================
// LINK ALL
// ======================================================

async function handleLinkAll(
    interaction
) {
    if (
        !hasLinkAllPermission(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                "❌ Tu n'as pas la permission d'utiliser **Link All**.",

            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    // ==================================================
    // RÉCUPÉRER TOUS LES MEMBRES
    // ==================================================

    await interaction.guild.members.fetch();

    const members =
        interaction.guild.members.cache.filter(
            member =>
                !member.user.bot &&
                member.roles.cache.has(
                    MEMBER_ROLE_ID
                )
        );

    const unlinked =
        [];

    const linked =
        [];

    for (
        const member
        of members.values()
    ) {
        const link =
            getRobloxLink(
                member.id
            );

        if (link) {
            linked.push(
                member
            );

        } else {
            unlinked.push(
                member
            );
        }
    }

    // ==================================================
    // TOUT LE MONDE EST RELIÉ
    // ==================================================

    if (
        unlinked.length ===
        0
    ) {
        return interaction.editReply({
            content:
                "✅ Tous les membres concernés ont déjà relié leur compte Roblox."
        });
    }

    // ==================================================
    // LIEN VERS LE SALON
    // ==================================================

    const channelUrl =
        `https://discord.com/channels/${interaction.guild.id}/${ROBLOX_HELP_CHANNEL_ID}`;

    let sent =
        0;

    let failed =
        0;

    const failedMembers =
        [];

    // ==================================================
    // ENVOI DES MP
    // ==================================================

    for (
        const member
        of unlinked
    ) {
        try {
            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel(
                                "Relier mon compte Roblox"
                            )
                            .setEmoji(
                                "🔗"
                            )
                            .setStyle(
                                ButtonStyle.Link
                            )
                            .setURL(
                                channelUrl
                            )
                    );

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        "🔗 Ton compte Roblox n'est pas relié"
                    )
                    .setDescription(
`Bonjour <@${member.id}>,

Nous avons remarqué que ton compte Discord n'est actuellement relié à **aucun compte Roblox** sur **The Legacy**.

Merci de relier ton compte Roblox afin que tes informations et tes futurs grades puissent être synchronisés correctement.

Clique simplement sur le bouton ci-dessous pour accéder directement au salon prévu à cet effet.`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Roblox"
                    })
                    .setTimestamp();

            await member.send({
                embeds: [
                    embed
                ],

                components: [
                    row
                ]
            });

            sent++;

        } catch (error) {
            failed++;

            failedMembers.push(
                member.id
            );

            console.log(
                `⚠️ Impossible d'envoyer le MP Roblox à ${member.user.tag}`
            );
        }
    }

    // ==================================================
    // RÉCAPITULATIF
    // ==================================================

    let content =
`## 🔗 Link All terminé

👥 **Membres vérifiés :** ${members.size}
✅ **Déjà reliés :** ${linked.length}
📩 **MP envoyés :** ${sent}
❌ **MP impossibles :** ${failed}`;

    if (
        failedMembers.length
    ) {
        content +=
`\n\n### Membres n'acceptant pas les MP
${failedMembers
    .map(
        id =>
            `> <@${id}>`
    )
    .join(
        "\n"
    )
    .substring(
        0,
        800
    )}`;
    }

    await interaction.editReply({
        content
    });

    // ==================================================
    // LOGS COMPLETS
    // ==================================================

    if (
        interaction.client.logs
            ?.logSpecial
    ) {
        await interaction.client.logs
            .logSpecial(
                interaction.guild,
                "roblox",
                {
                    title:
                        "🔗 Link All",

                    description:
                        `<@${interaction.user.id}> a lancé une vérification globale des comptes Roblox.`,

                    fields: [
                        {
                            name:
                                "Membres",

                            value:
                                String(
                                    members.size
                                ),

                            inline:
                                true
                        },

                        {
                            name:
                                "Déjà reliés",

                            value:
                                String(
                                    linked.length
                                ),

                            inline:
                                true
                        },

                        {
                            name:
                                "MP envoyés",

                            value:
                                String(
                                    sent
                                ),

                            inline:
                                true
                        },

                        {
                            name:
                                "MP impossibles",

                            value:
                                String(
                                    failed
                                ),

                            inline:
                                true
                        }
                    ]
                }
            )
            .catch(
                () => {}
            );
    }
}

// ======================================================
// SYSTEME
// ======================================================

function registerRobloxLinkPanel(
    client
) {
    client.on(
        Events.InteractionCreate,
        async interaction => {
            try {
                // ==================================================
                // LINK ALL
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        LINK_ALL_BUTTON_ID
                ) {
                    return handleLinkAll(
                        interaction
                    );
                }

                // ==================================================
                // BOUTON CHANGER ROBLOX
                // ==================================================

                if (
                    interaction.isButton() &&
                    interaction.customId ===
                        CHANGE_BUTTON_ID
                ) {
                    const existing =
                        getRobloxLink(
                            interaction.user.id
                        );

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                CHANGE_MODAL_ID
                            )
                            .setTitle(
                                "Changer son compte Roblox"
                            );

                    const username =
                        new TextInputBuilder()
                            .setCustomId(
                                "roblox_username"
                            )
                            .setLabel(
                                "Nouveau @ Roblox"
                            )
                            .setPlaceholder(
                                "Ex : PrinceAk9hi"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(
                                true
                            )
                            .setMaxLength(
                                50
                            );

                    if (
                        existing?.robloxUsername
                    ) {
                        username.setValue(
                            existing.robloxUsername
                        );
                    }

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                username
                            )
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ==================================================
                // MODAL
                // ==================================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId ===
                        CHANGE_MODAL_ID
                ) {
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const robloxUsername =
                        interaction.fields
                            .getTextInputValue(
                                "roblox_username"
                            )
                            .trim();

                    if (
                        !robloxUsername
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Tu dois entrer un pseudo Roblox."
                        });
                    }

                    // ==================================================
                    // MEMBRE DISCORD
                    // ==================================================

                    const member =
                        await interaction.guild.members
                            .fetch(
                                interaction.user.id
                            )
                            .catch(
                                () => null
                            );

                    if (!member) {
                        return interaction.editReply({
                            content:
                                "❌ Impossible de récupérer ton compte Discord."
                        });
                    }

                    // ==================================================
                    // ANCIENNE LIAISON AVANT MODIFICATION
                    // ==================================================

                    const oldLink =
                        getRobloxLink(
                            interaction.user.id
                        );

                    const existing =
                        oldLink
                            ? {
                                ...oldLink
                            }
                            : null;

                    // ==================================================
                    // REUTILISER /LINK
                    // ==================================================

                    const linkCommand =
                        client.commands.get(
                            "link"
                        );

                    if (
                        !linkCommand ||
                        typeof linkCommand.performRobloxLink !==
                            "function" ||
                        typeof linkCommand.createLinkConfirmationEmbed !==
                            "function"
                    ) {
                        return interaction.editReply({
                            content:
                                "❌ Le système de liaison Roblox n'est pas chargé."
                        });
                    }

                    const {
                        result
                    } =
                        await linkCommand.performRobloxLink({
                            member,

                            robloxUsername,

                            source:
                                "panel_change_roblox"
                        });

                    // ==================================================
                    // ERREURS ROBLOX
                    // ==================================================

                    if (!result.success) {
                        if (
                            result.error ===
                                "USER_NOT_FOUND"
                        ) {
                            return interaction.editReply({
                                content:
                                    `❌ Aucun compte Roblox trouvé avec le pseudo **${robloxUsername}**.`
                            });
                        }

                        if (
                            result.error ===
                                "ROBLOX_API_ERROR"
                        ) {
                            return interaction.editReply({
                                content:
                                    "❌ Roblox n'a pas répondu correctement. Réessaie dans quelques instants."
                            });
                        }

                        return interaction.editReply({
                            content:
                                `❌ Impossible de modifier ton compte Roblox.\n\`${result.error}\``
                        });
                    }

                    // ==================================================
                    // CONFIRMATION
                    // ==================================================

                    const embed =
                        linkCommand
                            .createLinkConfirmationEmbed({
                                member,

                                result,

                                existing,

                                selfChange:
                                    true
                            });

                    // ==================================================
                    // ANNONCE PUBLIQUE DE LA LIAISON
                    // ==================================================

                    await sendLinkAnnouncement({
                        guild:
                            interaction.guild,

                        member,

                        robloxUsername:
                            result.user.username,

                        existing
                    });

                    // ==================================================
                    // LOG CENTRAL
                    // ==================================================

                    if (
                        client.logs
                            ?.logSpecial
                    ) {
                        await client.logs
                            .logSpecial(
                                interaction.guild,
                                "roblox",
                                {
                                    title:
                                        existing
                                            ? "🔄 Compte Roblox modifié"
                                            : "🔗 Compte Roblox relié",

                                    description:
                                        existing
                                            ? `<@${member.id}> a modifié son compte Roblox.`
                                            : `<@${member.id}> a relié son compte Roblox.`,

                                    fields: [
                                        {
                                            name:
                                                "Discord",

                                            value:
                                                `<@${member.id}>\n\`${member.id}\``,

                                            inline:
                                                true
                                        },

                                        {
                                            name:
                                                "Roblox",

                                            value:
                                                `\`${result.user.username}\`\n\`${result.user.id}\``,

                                            inline:
                                                true
                                        }
                                    ]
                                }
                            )
                            .catch(
                                () => {}
                            );
                    }

                    return interaction.editReply({
                        embeds: [
                            embed
                        ]
                    });
                }

            } catch (error) {
                console.error(
                    "❌ Roblox Link Panel :",
                    error
                );

                if (
                    interaction.isRepliable() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            `❌ Une erreur est survenue.\n\`${error.message}\``,

                        flags:
                            MessageFlags.Ephemeral
                    }).catch(
                        () => {}
                    );

                } else if (
                    interaction.deferred
                ) {
                    await interaction.editReply({
                        content:
                            `❌ Une erreur est survenue.\n\`${error.message}\``
                    }).catch(
                        () => {}
                    );
                }
            }
        }
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    registerRobloxLinkPanel;