const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const {
    createPanel,
    loadState,
    getPanelMessage
} = require("../utils/candidaturePanel");

// ======================================================
// /SETUPCANDIDATURE
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "setupcandidature"
            )
            .setDescription(
                "Installer le panel de candidature The Legacy"
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const state =
            loadState();

        // ==================================================
        // PANEL EXISTANT
        // ==================================================

        if (
            state.messageId
        ) {
            const existing =
                await getPanelMessage(
                    interaction.guild,
                    state
                );

            if (
                existing
            ) {
                return interaction.editReply({
                    content:
                        `❌ Le panel de candidature est déjà installé : ${existing.url}\n\nUtilise \`/candidature on\` ou \`/candidature off\` pour le gérer.`
                });
            }
        }

        // ==================================================
        // CREATE
        // ==================================================

        const result =
            await createPanel(
                interaction.guild,
                interaction.user.id
            );

        if (
            !result.ok
        ) {
            if (
                result.reason ===
                "channel_not_found"
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le salon de candidature est introuvable."
                });
            }

            return interaction.editReply({
                content:
                    "❌ Impossible de créer le panel de candidature."
            });
        }

        return interaction.editReply({
            content:
                `✅ Panel de candidature installé dans ${result.message.channel}.`
        });
    }
};