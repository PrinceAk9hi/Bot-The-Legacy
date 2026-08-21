const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const {
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

// ======================================================
// PERMISSION
// ======================================================

function hasPermission(member) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(roleId)
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("umn")
            .setDescription(
                "Retirer une ou plusieurs menottes vocales"
            )

            // ==========================================
            // /UMN MEMBRE
            // ==========================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("membre")
                        .setDescription(
                            "Démenotter un membre"
                        )
                        .addUserOption(
                            option =>
                                option
                                    .setName("membre")
                                    .setDescription(
                                        "Membre à démenotter"
                                    )
                                    .setRequired(true)
                        )
            )

            // ==========================================
            // /UMN ALL
            // ==========================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("all")
                        .setDescription(
                            "Démenotter tous les membres"
                        )
            ),

    // ======================================================
    // EXECUTION
    // ======================================================

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
                !hasPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/umn`."
                });
            }

            const client =
                interaction.client;

            const guild =
                interaction.guild;

            const subcommand =
                interaction.options.getSubcommand();

            // ==================================================
            // /UMN MEMBRE
            // ==================================================

            if (
                subcommand === "membre"
            ) {
                const user =
                    interaction.options.getUser(
                        "membre"
                    );

                const target =
                    await guild.members
                        .fetch(user.id)
                        .catch(() => null);

                if (!target) {
                    return interaction.editReply({
                        content:
                            "❌ Ce membre est introuvable."
                    });
                }

                // ==========================================
                // COMPTE PROTÉGÉ
                // ==========================================

                if (
                    typeof client.isProtectedUser ===
                        "function" &&
                    client.isProtectedUser(
                        target.id
                    )
                ) {
                    return interaction.editReply({
                        content:
                            "🛡️ Ce membre est protégé et ne peut pas être ciblé."
                    });
                }

                const menotte =
                    client.menottes.get(
                        target.id
                    );

                if (
                    !menotte ||
                    menotte.guildId !==
                        guild.id
                ) {
                    return interaction.editReply({
                        content:
                            `⚠️ <@${target.id}> n'est actuellement pas menotté.`
                    });
                }

                client.menottes.delete(
                    target.id
                );

                return interaction.editReply({
                    content:
                        `🔓 <@${target.id}> a été **démenotté**.`
                });
            }

            // ==================================================
            // /UMN ALL
            // ==================================================

            if (
                subcommand === "all"
            ) {
                const removed =
                    [];

                // On copie la Map avant suppression
                // pour éviter tout problème pendant la boucle.
                const entries =
                    [
                        ...client.menottes.entries()
                    ];

                for (
                    const [
                        memberId,
                        data
                    ]
                    of entries
                ) {
                    // Seulement les menottes
                    // du serveur actuel.
                    if (
                        data.guildId !==
                            guild.id
                    ) {
                        continue;
                    }

                    // Par sécurité :
                    // on ne touche jamais aux comptes protégés.
                    if (
                        typeof client.isProtectedUser ===
                            "function" &&
                        client.isProtectedUser(
                            memberId
                        )
                    ) {
                        client.menottes.delete(
                            memberId
                        );

                        continue;
                    }

                    client.menottes.delete(
                        memberId
                    );

                    removed.push(
                        memberId
                    );
                }

                if (
                    removed.length === 0
                ) {
                    return interaction.editReply({
                        content:
                            "⚠️ Aucun membre n'est actuellement menotté sur ce serveur."
                    });
                }

                const mentions =
                    removed
                        .slice(0, 20)
                        .map(
                            memberId =>
                                `<@${memberId}>`
                        )
                        .join(", ");

                let content =
                    `🔓 **${removed.length} membre(s)** ont été démenottés.\n\n${mentions}`;

                if (
                    removed.length > 20
                ) {
                    content +=
                        `\n+ ${removed.length - 20} autre(s)`;
                }

                return interaction.editReply({
                    content
                });
            }

            return interaction.editReply({
                content:
                    "❌ Sous-commande inconnue."
            });

        } catch (error) {
            console.error(
                "❌ Erreur /umn :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            }).catch(() => {});
        }
    }
};