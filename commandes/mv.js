const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("mv")
            .setDescription(
                "Déplacer un membre dans ton salon vocal"
            )

            .addUserOption(option =>
                option
                    .setName("membre")
                    .setDescription(
                        "Membre à déplacer dans ton vocal"
                    )
                    .setRequired(true)
            ),

    async execute(interaction) {

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSION UTILISATEUR
            // ==================================================

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.MoveMembers
                ) &&
                !interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission de déplacer des membres."
                });
            }

            // ==================================================
            // TON VOCAL
            // ==================================================

            const destination =
                interaction.member.voice.channel;

            if (!destination) {
                return interaction.editReply({
                    content:
                        "❌ Tu dois être dans un salon vocal pour utiliser `/mv`."
                });
            }

            // ==================================================
            // MEMBRE
            // ==================================================

            const user =
                interaction.options.getUser(
                    "membre"
                );

            const member =
                interaction.guild.members.cache.get(
                    user.id
                ) ||
                await interaction.guild.members.fetch(
                    user.id
                ).catch(
                    () => null
                );

            if (!member) {
                return interaction.editReply({
                    content:
                        "❌ Membre introuvable."
                });
            }

            // ==================================================
            // VOCAL ACTUEL DE LA CIBLE
            // ==================================================

            const currentChannel =
                member.voice.channel;

            if (!currentChannel) {
                return interaction.editReply({
                    content:
                        `❌ <@${member.id}> n'est actuellement dans aucun vocal.`
                });
            }

            if (
                currentChannel.id ===
                destination.id
            ) {
                return interaction.editReply({
                    content:
                        `⚠️ <@${member.id}> est déjà dans ton vocal.`
                });
            }

            // ==================================================
            // PERMISSION BOT
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.MoveMembers
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Je n'ai pas la permission **Déplacer des membres**."
                });
            }

            // ==================================================
            // MÉMORISER L'ANCIEN VOCAL
            // ==================================================

            if (
                !interaction.client.previousVoice
            ) {
                interaction.client.previousVoice =
                    new Map();
            }

            interaction.client.previousVoice.set(
                member.id,
                currentChannel.id
            );

            // ==================================================
            // DÉPLACEMENT
            // ==================================================

            await member.voice.setChannel(
                destination,
                `/mv par ${interaction.user.tag}`
            );

            // ==================================================
            // LOG
            // ==================================================

            if (
                interaction.client.logs
                    ?.logSpecial
            ) {
                await interaction.client.logs
                    .logSpecial(
                        interaction.guild,
                        "voice",
                        {
                            title:
                                "🔊 Déplacement vocal",

                            description:
                                `<@${interaction.user.id}> a déplacé <@${member.id}> dans son vocal.`,

                            fields: [
                                {
                                    name:
                                        "Ancien vocal",

                                    value:
                                        `<#${currentChannel.id}>`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Nouveau vocal",

                                    value:
                                        `<#${destination.id}>`,

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
                content:
                    `✅ <@${member.id}> a été déplacé dans ton vocal.`
            });

        } catch (error) {
            console.error(
                "❌ /mv :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Impossible de déplacer ce membre.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};