const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Afficher le panel complet d'un membre")
        .addUserOption(option =>
            option
                .setName("membre")
                .setDescription("Membre à afficher")
                .setRequired(false)
        ),

    async execute(interaction) {

        // =====================================================
        // RÉPONSE IMMÉDIATE À DISCORD
        // =====================================================

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            // =====================================================
            // RÉCUPÉRATION DU MEMBRE
            // =====================================================

            const utilisateur =
                interaction.options.getUser("membre") ||
                interaction.user;

            const membre =
                await interaction.guild.members
                    .fetch(utilisateur.id)
                    .catch(() => null);

            if (!membre) {
                return interaction.editReply({
                    content: "❌ Impossible de récupérer ce membre."
                });
            }

            const user = membre.user;

            // =====================================================
            // INFORMATIONS VOCALES
            // =====================================================

            const vocal = membre.voice.channel
                ? `<#${membre.voice.channel.id}>`
                : "❌ Aucun vocal";

            let etatVocal = "Non connecté";

            if (membre.voice.channel) {
                etatVocal = "Connecté";

                if (membre.voice.serverMute) {
                    etatVocal += " • 🔇 Mute serveur";
                }

                if (membre.voice.serverDeaf) {
                    etatVocal += " • 🔕 Sourdine serveur";
                }
            }

            // =====================================================
            // RÔLES
            // =====================================================

            const rolesArray = membre.roles.cache
                .filter(role =>
                    role.id !== interaction.guild.id
                )
                .sort((a, b) =>
                    b.position - a.position
                )
                .map(role =>
                    `<@&${role.id}>`
                );

            let roles = "Aucun rôle";

            if (rolesArray.length > 0) {
                roles = rolesArray
                    .slice(0, 15)
                    .join(", ");

                if (rolesArray.length > 15) {
                    roles +=
                        `\n*+ ${rolesArray.length - 15} autre(s) rôle(s)*`;
                }
            }

            // =====================================================
            // TIMEOUT
            // =====================================================

            let timeout = "Aucun";

            if (
                membre.communicationDisabledUntilTimestamp &&
                membre.communicationDisabledUntilTimestamp > Date.now()
            ) {
                timeout =
                    `<t:${Math.floor(
                        membre.communicationDisabledUntilTimestamp / 1000
                    )}:R>`;
            }

            // =====================================================
            // PERMISSIONS / MODÉRATION
            // =====================================================

            const bannissable =
                membre.bannable
                    ? "✅ Oui"
                    : "❌ Non";

            const expulsable =
                membre.kickable
                    ? "✅ Oui"
                    : "❌ Non";

            const moderable =
                membre.moderatable
                    ? "✅ Oui"
                    : "❌ Non";

            // =====================================================
            // STATUTS DU PANEL
            // =====================================================

            const client = interaction.client;

            const menotte =
                client.menottes?.has(membre.id)
                    ? "🔒 Active"
                    : "🔓 Inactive";

            const ch =
                client.chiens?.has(membre.id)
                    ? "🐕 Actif"
                    : "❌ Inactif";

            const lockPseudo =
                client.lockedNames?.has(membre.id)
                    ? "🔐 Verrouillé"
                    : "🔓 Libre";

            // =====================================================
            // EMBED
            // =====================================================

            const embed = new EmbedBuilder()
                .setTitle(
                    `👤 Panel membre • ${user.username}`
                )
                .setThumbnail(
                    user.displayAvatarURL({
                        size: 512
                    })
                )
                .setDescription(
                    `Panel de gestion rapide de <@${membre.id}>`
                )
                .addFields(
                    {
                        name: "👤 Utilisateur",
                        value:
                            `**Nom Discord :** ${user.username}\n` +
                            `**Nom serveur :** ${membre.displayName}\n` +
                            `**ID :** \`${user.id}\`\n` +
                            `**Bot :** ${user.bot ? "Oui" : "Non"}`
                    },
                    {
                        name: "📅 Compte",
                        value:
                            `**Créé :** <t:${Math.floor(
                                user.createdTimestamp / 1000
                            )}:F>\n` +
                            `**Arrivé sur le serveur :** ${
                                membre.joinedTimestamp
                                    ? `<t:${Math.floor(
                                          membre.joinedTimestamp / 1000
                                      )}:F>`
                                    : "Inconnu"
                            }`
                    },
                    {
                        name: "🔊 Vocal",
                        value:
                            `**Salon :** ${vocal}\n` +
                            `**État :** ${etatVocal}`
                    },
                    {
                        name: "🛡️ Modération",
                        value:
                            `**Timeout :** ${timeout}\n` +
                            `**Bannissable :** ${bannissable}\n` +
                            `**Expulsable :** ${expulsable}\n` +
                            `**Modérable :** ${moderable}`
                    },
                    {
                        name: "⚙️ Systèmes internes",
                        value:
                            `**Menotte :** ${menotte}\n` +
                            `**CH :** ${ch}\n` +
                            `**Pseudo :** ${lockPseudo}`
                    },
                    {
                        name: "🎭 Rôles",
                        value: roles
                    }
                )
                .setFooter({
                    text:
                        `Panel demandé par ${interaction.user.username}`
                })
                .setTimestamp();

            // =====================================================
            // IDs
            // =====================================================

            const owner =
                interaction.user.id;

            const target =
                membre.id;

            // =====================================================
            // LIGNE 1
            // =====================================================

            const ligne1 =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId(
                                `user_bring_${owner}_${target}`
                            )
                            .setLabel("Bring")
                            .setEmoji("📥")
                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_back_${owner}_${target}`
                            )
                            .setLabel("Back")
                            .setEmoji("↩️")
                            .setStyle(
                                ButtonStyle.Secondary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_disconnect_${owner}_${target}`
                            )
                            .setLabel("Déconnecter")
                            .setEmoji("☎️")
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            // =====================================================
            // LIGNE 2
            // =====================================================

            const ligne2 =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId(
                                `user_mn_${owner}_${target}`
                            )
                            .setLabel("Menotter")
                            .setEmoji("🔒")
                            .setStyle(
                                ButtonStyle.Danger
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_dmn_${owner}_${target}`
                            )
                            .setLabel("Déménotter")
                            .setEmoji("🔓")
                            .setStyle(
                                ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_ch_${owner}_${target}`
                            )
                            .setLabel("CH")
                            .setEmoji("🐕")
                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_uch_${owner}_${target}`
                            )
                            .setLabel("UNCH")
                            .setEmoji("🦴")
                            .setStyle(
                                ButtonStyle.Secondary
                            )
                    );

            // =====================================================
            // LIGNE 3
            // =====================================================

            const ligne3 =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId(
                                `user_lockname_${owner}_${target}`
                            )
                            .setLabel("Lock pseudo")
                            .setEmoji("🔐")
                            .setStyle(
                                ButtonStyle.Danger
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `user_unlockname_${owner}_${target}`
                            )
                            .setLabel("Unlock pseudo")
                            .setEmoji("🔑")
                            .setStyle(
                                ButtonStyle.Success
                            )
                    );

            // =====================================================
            // MENU VOCAL
            // =====================================================

            const selectVoc =
                new ActionRowBuilder()
                    .addComponents(

                        new ChannelSelectMenuBuilder()
                            .setCustomId(
                                `user_move_${owner}_${target}`
                            )
                            .setPlaceholder(
                                "🔊 Déplacer dans une voc..."
                            )
                            .addChannelTypes(
                                ChannelType.GuildVoice
                            )
                    );

            // =====================================================
            // AFFICHAGE FINAL
            // =====================================================

            return interaction.editReply({
                embeds: [
                    embed
                ],

                components: [
                    ligne1,
                    ligne2,
                    ligne3,
                    selectVoc
                ]
            });

        } catch (error) {

            console.error(
                "❌ Erreur dans /user :",
                error
            );

            try {
                return interaction.editReply({
                    content:
                        `❌ Impossible d'afficher le panel.\n\`${error.message}\``
                });

            } catch (replyError) {

                console.error(
                    "❌ Impossible même de modifier la réponse /user :",
                    replyError
                );
            }
        }
    }
};