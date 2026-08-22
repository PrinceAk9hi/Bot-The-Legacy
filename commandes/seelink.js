const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    getRobloxLink
} = require("../utils/robloxLinks");

// ======================================================
// CONFIG
// ======================================================

const MEMBER_ROLE_ID =
    "1458391977073574012";

const ALLOWED_ROLES = [
    "1458414705717805189", // Fondateur
    "1467277541696868412", // Souverain
    "1531760308761133229"  // Responsable Sanctions
];

// ======================================================
// PERMISSIONS
// ======================================================

function hasPermission(member) {
    return ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// SCAN
// ======================================================

async function scanMembers(guild) {
    await guild.members.fetch();

    const members =
        guild.members.cache.filter(
            member =>
                !member.user.bot &&
                member.roles.cache.has(
                    MEMBER_ROLE_ID
                )
        );

    const linked = [];
    const unlinked = [];

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
            unlinked.push({
                member
            });
        }
    }

    return {
        total:
            members.size,

        linked,

        unlinked
    };
}

// ======================================================
// TEXTE LISTE
// ======================================================

function buildLinkedText(linked) {
    if (!linked.length) {
        return "Aucun membre relié.";
    }

    const text =
        linked
            .map(
                ({ member, link }) =>
                    `✅ <@${member.id}> → \`${link.robloxUsername}\``
            )
            .join("\n");

    return text.substring(
        0,
        1024
    );
}

function buildUnlinkedText(unlinked) {
    if (!unlinked.length) {
        return "✅ Tous les membres sont reliés.";
    }

    const text =
        unlinked
            .map(
                ({ member }) =>
                    `❌ <@${member.id}>`
            )
            .join("\n");

    return text.substring(
        0,
        1024
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "seelink"
            )
            .setDescription(
                "Vérifier les comptes Roblox reliés des membres Legacy"
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
            if (
                !hasPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser cette commande."
                });
            }

            const result =
                await scanMembers(
                    interaction.guild
                );

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x3B6475
                    )
                    .setTitle(
                        "🔗 Vérification des comptes Roblox"
                    )
                    .setDescription(
`Vérification des membres possédant le rôle <@&${MEMBER_ROLE_ID}>.

**Total :** ${result.total}
✅ **Reliés :** ${result.linked.length}
❌ **Non reliés :** ${result.unlinked.length}`
                    )
                    .addFields(
                        {
                            name:
                                `✅ Reliés • ${result.linked.length}`,

                            value:
                                buildLinkedText(
                                    result.linked
                                )
                        },

                        {
                            name:
                                `❌ Non reliés • ${result.unlinked.length}`,

                            value:
                                buildUnlinkedText(
                                    result.unlinked
                                )
                        }
                    )
                    .setFooter({
                        text:
                            "The Legacy • Liaison Roblox"
                    })
                    .setTimestamp();

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                "legacy_link_all"
                            )
                            .setLabel(
                                "Link All"
                            )
                            .setEmoji(
                                "🔗"
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            )
                            .setDisabled(
                                result.unlinked.length ===
                                0
                            )
                    );

            return interaction.editReply({
                embeds: [
                    embed
                ],

                components: [
                    row
                ]
            });

        } catch (error) {
            console.error(
                "❌ /seelink :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            });
        }
    }
};