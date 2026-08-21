const {
    SlashCommandBuilder,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

const {
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

const {
    linkDiscordToRoblox
} = require("../utils/robloxAccount");

const {
    getRobloxLink
} = require("../utils/robloxLinks");

// ======================================================
// PERMISSION
// ======================================================

function hasLinkPermission(member) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(roleId)
    );
}

// ======================================================
// EMBED DE CONFIRMATION
// ======================================================

function createLinkConfirmationEmbed({
    member,
    result,
    existing,
    selfChange = false
}) {
    const embed =
        new EmbedBuilder()
            .setColor(
                0x3B6475
            )
            .setTitle(
                existing
                    ? "🔗 Liaison Roblox modifiée"
                    : "🔗 Compte Roblox relié"
            )
            .addFields(
                {
                    name:
                        "Discord",

                    value:
                        `<@${member.id}>\n\`${member.id}\``,

                    inline:
                        false
                },

                {
                    name:
                        "Roblox",

                    value:
                        `**${result.user.username}**`,

                    inline:
                        true
                },

                {
                    name:
                        "Roblox User ID",

                    value:
                        `\`${result.user.id}\``,

                    inline:
                        true
                }
            )
            .setFooter({
                text:
                    selfChange
                        ? "The Legacy • Modification du compte Roblox"
                        : "The Legacy • Liaison Discord ↔ Roblox"
            })
            .setTimestamp();

    if (
        result.user.displayName &&
        result.user.displayName !==
            result.user.username
    ) {
        embed.addFields({
            name:
                "Nom d'affichage",

            value:
                result.user.displayName,

            inline:
                true
        });
    }

    if (existing) {
        embed.addFields({
            name:
                "Ancienne liaison",

            value:
                `**${existing.robloxUsername}** • \`${existing.robloxUserId}\``,

            inline:
                false
        });
    }

    return embed;
}

// ======================================================
// LIAISON
// ======================================================

async function performRobloxLink({
    member,
    robloxUsername,
    source
}) {
    const existing =
        getRobloxLink(
            member.id
        );

    const result =
        await linkDiscordToRoblox({
            discordUserId:
                member.id,

            robloxUsername,

            source
        });

    return {
        existing,
        result
    };
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("link")
            .setDescription(
                "Relier un membre Discord à son compte Roblox"
            )

            .addUserOption(option =>
                option
                    .setName("membre")
                    .setDescription(
                        "Membre Discord à relier"
                    )
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("roblox")
                    .setDescription(
                        "Pseudo Roblox du membre"
                    )
                    .setRequired(true)
                    .setMaxLength(50)
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==========================================
            // PERMISSIONS
            // ==========================================

            if (
                !hasLinkPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/link`."
                });
            }

            // ==========================================
            // OPTIONS
            // ==========================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const robloxUsername =
                interaction.options.getString(
                    "roblox"
                );

            // ==========================================
            // MEMBRE
            // ==========================================

            const member =
                await interaction.guild.members
                    .fetch(
                        user.id
                    )
                    .catch(
                        () => null
                    );

            if (!member) {
                return interaction.editReply({
                    content:
                        "❌ Ce membre Discord est introuvable."
                });
            }

            // ==========================================
            // LIAISON
            // ==========================================

            const {
                existing,
                result
            } =
                await performRobloxLink({
                    member,

                    robloxUsername,

                    source:
                        "command_link"
                });

            // ==========================================
            // ERREURS
            // ==========================================

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
                        `❌ Impossible de créer la liaison Roblox.\n\`${result.error}\``
                });
            }

            // ==========================================
            // CONFIRMATION
            // ==========================================

            const embed =
                createLinkConfirmationEmbed({
                    member,
                    result,
                    existing
                });

            return interaction.editReply({
                embeds: [
                    embed
                ]
            });

        } catch (error) {
            console.error(
                "❌ Erreur /link :",
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
    // OUTILS UTILISÉS PAR LE PANEL
    // ==================================================

    performRobloxLink,
    createLinkConfirmationEmbed
};