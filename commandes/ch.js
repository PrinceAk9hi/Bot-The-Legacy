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
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("ch")
            .setDescription(
                "Gérer le système CH"
            )

            // ==========================================
            // /CH MEMBRE
            // ==========================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("membre")
                        .setDescription(
                            "Mettre un membre en CH avec toi"
                        )
                        .addUserOption(
                            option =>
                                option
                                    .setName("membre")
                                    .setDescription(
                                        "Membre à mettre en CH"
                                    )
                                    .setRequired(true)
                        )
            )

            // ==========================================
            // /CH VC
            // ==========================================

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName("vc")
                        .setDescription(
                            "Mettre toute ta voc en CH avec toi"
                        )
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
            // PERMISSION
            // ==========================================

            if (
                !hasPermission(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/ch`."
                });
            }

            const client =
                interaction.client;

            const guild =
                interaction.guild;

            const master =
                await guild.members
                    .fetch(
                        interaction.user.id
                    )
                    .catch(
                        () => null
                    );

            if (!master) {
                return interaction.editReply({
                    content:
                        "❌ Impossible de récupérer ton compte sur le serveur."
                });
            }

            const subcommand =
                interaction.options
                    .getSubcommand();

            // ==================================================
            // /CH MEMBRE
            // ==================================================

            if (
                subcommand ===
                "membre"
            ) {
                const user =
                    interaction.options
                        .getUser(
                            "membre"
                        );

                const target =
                    await guild.members
                        .fetch(
                            user.id
                        )
                        .catch(
                            () => null
                        );

                if (!target) {
                    return interaction.editReply({
                        content:
                            "❌ Ce membre est introuvable."
                    });
                }

                if (
                    target.id ===
                    master.id
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Tu ne peux pas te mettre toi-même en CH."
                    });
                }

                if (
                    target.user.bot
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Tu ne peux pas mettre un bot en CH."
                    });
                }

                // ==========================================
                // ENREGISTRER LE CH
                // ==========================================

                client.chiens.set(
                    target.id,
                    {
                        guildId:
                            guild.id,

                        maitreId:
                            master.id
                    }
                );

                // ==========================================
                // DÉPLACEMENT IMMÉDIAT SI POSSIBLE
                // ==========================================

                if (
                    master.voice.channelId &&
                    target.voice.channelId &&
                    target.voice.channelId !==
                        master.voice.channelId
                ) {
                    try {
                        await target.voice.setChannel(
                            master.voice.channelId
                        );

                    } catch (error) {
                        console.error(
                            "❌ /ch membre déplacement :",
                            error
                        );
                    }
                }

                return interaction.editReply({
                    content:
                        `🐕 <@${target.id}> est maintenant en **CH** avec toi.`
                });
            }

            // ==================================================
            // /CH VC
            // ==================================================

            if (
                subcommand ===
                "vc"
            ) {
                const voiceChannel =
                    master.voice.channel;

                if (!voiceChannel) {
                    return interaction.editReply({
                        content:
                            "❌ Tu dois être connecté dans un vocal."
                    });
                }

                const targets =
                    [
                        ...voiceChannel.members.values()
                    ].filter(
                        member =>
                            member.id !==
                                master.id &&
                            !member.user.bot
                    );

                if (
                    targets.length === 0
                ) {
                    return interaction.editReply({
                        content:
                            "⚠️ Il n'y a aucun autre membre humain dans ton vocal."
                    });
                }

                // ==========================================
                // METTRE TOUTE LA VOC EN CH
                // ==========================================

                for (
                    const target
                    of targets
                ) {
                    client.chiens.set(
                        target.id,
                        {
                            guildId:
                                guild.id,

                            maitreId:
                                master.id
                        }
                    );
                }

                const mentions =
                    targets
                        .slice(
                            0,
                            15
                        )
                        .map(
                            member =>
                                `<@${member.id}>`
                        )
                        .join(
                            ", "
                        );

                let response =
                    `🐕 **${targets.length} membre(s)** de ton vocal sont maintenant en **CH** avec toi.\n\n${mentions}`;

                if (
                    targets.length > 15
                ) {
                    response +=
                        `\n+ ${targets.length - 15} autre(s)`;
                }

                return interaction.editReply({
                    content:
                        response
                });
            }

            return interaction.editReply({
                content:
                    "❌ Sous-commande inconnue."
            });

        } catch (error) {
            console.error(
                "❌ Erreur /ch :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Une erreur est survenue.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};