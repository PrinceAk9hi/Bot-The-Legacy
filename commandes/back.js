const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("back")
            .setDescription(
                "Renvoyer un membre dans son vocal précédent"
            )
            .addUserOption(option =>
                option
                    .setName("membre")
                    .setDescription(
                        "Membre à renvoyer dans son ancien vocal"
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
            // PERMISSION
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
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            if (!member) {
                return interaction.editReply({
                    content:
                        "❌ Membre introuvable."
                });
            }

            // ==================================================
            // HISTORIQUE VOCAL
            // ==================================================

            if (
                !interaction.client.previousVoice
            ) {
                interaction.client.previousVoice =
                    new Map();
            }

            const previous =
                interaction.client.previousVoice.get(
                    member.id
                );

            if (!previous) {
                return interaction.editReply({
                    content:
                        `❌ Aucun ancien vocal n'est enregistré pour <@${member.id}>.`
                });
            }

            // Compatible avec :
            // "123456..."
            // ET
            // { guildId: "...", channelId: "..." }

            let previousChannelId =
                null;

            let previousGuildId =
                interaction.guild.id;

            if (
                typeof previous ===
                "string"
            ) {
                previousChannelId =
                    previous;
            }

            else if (
                typeof previous ===
                "object" &&
                previous !== null
            ) {
                previousChannelId =
                    previous.channelId;

                previousGuildId =
                    previous.guildId ||
                    interaction.guild.id;
            }

            if (
                !previousChannelId ||
                previousGuildId !==
                    interaction.guild.id
            ) {
                interaction.client.previousVoice.delete(
                    member.id
                );

                return interaction.editReply({
                    content:
                        "❌ L'ancien vocal enregistré est invalide."
                });
            }

            // ==================================================
            // ANCIEN SALON
            // ==================================================

            const previousChannel =
                interaction.guild.channels.cache.get(
                    previousChannelId
                );

            if (
                !previousChannel ||
                !previousChannel.isVoiceBased()
            ) {
                interaction.client.previousVoice.delete(
                    member.id
                );

                return interaction.editReply({
                    content:
                        "❌ L'ancien salon vocal n'existe plus."
                });
            }

            // ==================================================
            // VOCAL ACTUEL
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
                previousChannel.id
            ) {
                return interaction.editReply({
                    content:
                        `⚠️ <@${member.id}> est déjà dans son ancien vocal.`
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
            // DÉPLACEMENT
            // ==================================================

            await member.voice.setChannel(
                previousChannel,
                `/back par ${interaction.user.tag}`
            );

            // ==================================================
            // MÉMORISER LE VOCAL QU'IL VIENT DE QUITTER
            // ==================================================

            interaction.client.previousVoice.set(
                member.id,
                {
                    guildId:
                        interaction.guild.id,

                    channelId:
                        currentChannel.id
                }
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
                                "↩️ Retour vocal",

                            description:
                                `<@${interaction.user.id}> a utilisé **/back** sur <@${member.id}>.`,

                            fields: [
                                {
                                    name:
                                        "Vocal quitté",

                                    value:
                                        `<#${currentChannel.id}>`,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Retour vers",

                                    value:
                                        `<#${previousChannel.id}>`,

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

            // ==================================================
            // CONFIRMATION
            // ==================================================

            return interaction.editReply({
                content:
                    `↩️ <@${member.id}> a été renvoyé dans <#${previousChannel.id}>.`
            });

        } catch (error) {

            console.error(
                "❌ /back :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Impossible d'utiliser /back.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};