const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
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

// ======================================================
// SYSTEME
// ======================================================

function registerRobloxLinkPanel(client) {

    client.on(
        Events.InteractionCreate,
        async interaction => {
            try {
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
                        existing,
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