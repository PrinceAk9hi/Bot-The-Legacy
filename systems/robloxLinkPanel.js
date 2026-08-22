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

const MEMBER_ROLE_ID =
    "1458391977073574012";

const ROBLOX_HELP_CHANNEL_ID =
    "1506762774397845534";

const LINK_LOG_CHANNEL_ID =
    "1540535302701981816";

const ALLOWED_ROLES = [
    "1458414705717805189", // Fondateur
    "1467277541696868412", // Souverain
    "1531760308761133229"  // Responsable Sanctions
];

// Temps maximum accordé à l'envoi d'un MP
const DM_TIMEOUT =
    7000;

// ======================================================
// PERMISSIONS
// ======================================================

function hasLinkAllPermission(member) {
    if (!member?.roles) {
        return false;
    }

    return ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache?.has(
                roleId
            ) ||
            member.roles.includes?.(
                roleId
            )
    );
}

// ======================================================
// ATTENTE
// ======================================================

function wait(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

// ======================================================
// ENVOI MP AVEC TIMEOUT
// ======================================================

async function sendDMWithTimeout(
    member,
    payload
) {
    return Promise.race([
        member.send(
            payload
        ),

        new Promise(
            (
                _resolve,
                reject
            ) => {
                setTimeout(
                    () => {
                        reject(
                            new Error(
                                "DM_TIMEOUT"
                            )
                        );
                    },
                    DM_TIMEOUT
                );
            }
        )
    ]);
}

// ======================================================
// ANNONCE LIAISON ROBLOX
// ======================================================

async function sendLinkAnnouncement({
    guild,
    member,
    robloxUsername,
    existing
}) {
    const channel =
        guild.channels.cache.get(
            LINK_LOG_CHANNEL_ID
        ) ||
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

    // ==================================================
    // PREMIÈRE LIAISON
    // ==================================================

    if (!existing) {
        content =
`## 🔗 Nouvelle liaison Roblox

<@${member.id}> a relié son compte Discord à son Roblox !

> **Discord :** <@${member.id}>
> **Roblox :** \`${robloxUsername}\``;
    }

    // ==================================================
    // CHANGEMENT DE COMPTE
    // ==================================================

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
        error => {
            console.error(
                "❌ Annonce liaison Roblox :",
                error
            );
        }
    );
}

// ======================================================
// LINK ALL
// ======================================================

async function handleLinkAll(
    interaction
) {
    // ==================================================
    // PERMISSION
    // ==================================================

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

    // ==================================================
    // ACK IMMÉDIAT
    // ==================================================

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    try {
        // On répond immédiatement pour supprimer
        // le "réfléchit..." de Discord.
        await interaction.editReply({
            content:
                "🔄 **Link All en cours...**\n\nAnalyse des membres et préparation des messages privés."
        });

        // ==================================================
        // MEMBRES DU RÔLE LEGACY
        // ==================================================

        const members =
            interaction.guild
                .members
                .cache
                .filter(
                    member =>
                        !member.user.bot &&
                        member.roles.cache.has(
                            MEMBER_ROLE_ID
                        )
                );

        const linked =
            [];

        const unlinked =
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
                linked.push({
                    member,
                    link
                });

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
`## ✅ Vérification terminée

Tous les membres concernés ont déjà relié leur compte Roblox.

**Membres vérifiés :** ${members.size}
**Reliés :** ${linked.length}`
            });
        }

        // ==================================================
        // URL SALON ROBLOX
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
            let index = 0;
            index <
            unlinked.length;
            index++
        ) {
            const member =
                unlinked[
                    index
                ];

            // Affiche la progression
            await interaction.editReply({
                content:
`## 🔄 Link All en cours...

📨 Traitement de **${index + 1}/${unlinked.length}**

✅ Déjà reliés : **${linked.length}**
📩 MP envoyés : **${sent}**
❌ Échecs : **${failed}**`
            }).catch(
                () => {}
            );

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

Ton compte Discord n'est actuellement relié à **aucun compte Roblox** sur **The Legacy**.

Merci de relier ton compte Roblox afin que tes informations et tes grades puissent être correctement synchronisés.

Clique sur le bouton ci-dessous pour accéder directement au salon prévu à cet effet.`
                        )
                        .setFooter({
                            text:
                                "The Legacy • Roblox"
                        })
                        .setTimestamp();

                await sendDMWithTimeout(
                    member,
                    {
                        embeds: [
                            embed
                        ],

                        components: [
                            row
                        ]
                    }
                );

                sent++;

            } catch (error) {
                failed++;

                failedMembers.push(
                    member.id
                );

                console.log(
                    `⚠️ MP Roblox impossible pour ${member.user.tag} : ${error.message}`
                );
            }

            // Petite pause pour éviter le spam API
            await wait(
                500
            );
        }

        // ==================================================
        // RÉCAP FINAL
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
`\n\n### ⚠️ MP impossibles
${failedMembers
    .map(
        id =>
            `> <@${id}>`
    )
    .join("\n")
    .substring(
        0,
        700
    )}`;
        }

        await interaction.editReply({
            content
        });

        // ==================================================
        // LOG CENTRAL
        // ==================================================

        if (
            interaction.client
                .logs
                ?.logSpecial
        ) {
            interaction.client.logs
                .logSpecial(
                    interaction.guild,
                    "roblox",
                    {
                        title:
                            "🔗 Link All",

                        description:
                            `<@${interaction.user.id}> a lancé un rappel global de liaison Roblox.`,

                        fields: [
                            {
                                name:
                                    "Membres vérifiés",

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
                                    "Échecs",

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

    } catch (error) {
        console.error(
            "❌ Link All :",
            error
        );

        return interaction.editReply({
            content:
                `❌ Une erreur est survenue pendant Link All.\n\`${error.message}\``
        }).catch(
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
                // MODAL CHANGER ROBLOX
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
                        interaction.guild
                            .members
                            .cache
                            .get(
                                interaction.user.id
                            );

                    if (!member) {
                        return interaction.editReply({
                            content:
                                "❌ Impossible de récupérer ton compte Discord."
                        });
                    }

                    // ==================================================
                    // ANCIEN COMPTE
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
                    // RÉUTILISER /LINK
                    // ==================================================

                    const linkCommand =
                        client.commands.get(
                            "link"
                        );

                    if (
                        !linkCommand ||
                        typeof linkCommand
                            .performRobloxLink !==
                            "function" ||
                        typeof linkCommand
                            .createLinkConfirmationEmbed !==
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
                        await linkCommand
                            .performRobloxLink({
                                member,

                                robloxUsername,

                                source:
                                    "panel_change_roblox"
                            });

                    // ==================================================
                    // ERREURS
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
                    // ANNONCE
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
                        client.logs
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