const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

// ======================================================
// UTILISATEURS AUTORISÉS EN PLUS DES ADMINS
// ======================================================

const ALLOWED_USER_IDS = new Set([
    "547192186547077130",
    "883087428016046150"
]);

// ======================================================
// COMMANDE
// ======================================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setuptpv")
        .setDescription(
            "Configurer le système de salons vocaux temporaires"
        )

        .addStringOption(option =>
            option
                .setName("nom_initial")
                .setDescription(
                    "Nom initial donné aux nouveaux vocaux"
                )
                .setRequired(true)
                .setMaxLength(80)
        )

        .addChannelOption(option =>
            option
                .setName("categorie")
                .setDescription(
                    "Catégorie où les vocaux temporaires seront créés"
                )
                .addChannelTypes(
                    ChannelType.GuildCategory
                )
                .setRequired(true)
        )

        .addBooleanOption(option =>
            option
                .setName("creer_hub")
                .setDescription(
                    "Créer automatiquement le vocal hub"
                )
                .setRequired(true)
        )

        .addChannelOption(option =>
            option
                .setName("hub")
                .setDescription(
                    "Hub existant à utiliser si creer_hub = Non"
                )
                .addChannelTypes(
                    ChannelType.GuildVoice
                )
                .setRequired(false)
        )

        .addStringOption(option =>
            option
                .setName("nom_hub")
                .setDescription(
                    "Nom du hub si le bot doit le créer"
                )
                .setRequired(false)
                .setMaxLength(80)
        ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            const isAllowedUser =
                ALLOWED_USER_IDS.has(
                    interaction.user.id
                );

            const isAdmin =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (
                !isAllowedUser &&
                !isAdmin
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/setuptpv`."
                });
            }

            // ==================================================
            // SYSTEME TPV
            // ==================================================

            const tempVoiceSystem =
                interaction.client.tempVoiceSystem;

            if (
                !tempVoiceSystem ||
                typeof tempVoiceSystem.saveConfig !==
                    "function"
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le système TPV n'est pas correctement chargé."
                });
            }

            // ==================================================
            // OPTIONS
            // ==================================================

            const initialName =
                interaction.options.getString(
                    "nom_initial",
                    true
                );

            const category =
                interaction.options.getChannel(
                    "categorie",
                    true
                );

            const createHub =
                interaction.options.getBoolean(
                    "creer_hub",
                    true
                );

            let hub =
                interaction.options.getChannel(
                    "hub"
                );

            const hubName =
                interaction.options.getString(
                    "nom_hub"
                ) ||
                "➕・Créer un bureau";

            // ==================================================
            // VERIFICATIONS
            // ==================================================

            if (
                category.type !==
                    ChannelType.GuildCategory
            ) {
                return interaction.editReply({
                    content:
                        "❌ La catégorie sélectionnée est invalide."
                });
            }

            // ==================================================
            // CREER LE HUB
            // ==================================================

            if (createHub) {
                hub =
                    await interaction.guild.channels.create({
                        name: hubName,

                        type:
                            ChannelType.GuildVoice,

                        parent:
                            category.id,

                        reason:
                            `Setup TPV par ${interaction.user.tag}`
                    });
            }

            // ==================================================
            // HUB EXISTANT OBLIGATOIRE SI PAS DE CREATION
            // ==================================================

            if (
                !createHub &&
                !hub
            ) {
                return interaction.editReply({
                    content:
                        "❌ Comme `creer_hub` est sur **Non**, tu dois sélectionner un vocal dans l'option `hub`."
                });
            }

            if (
                !hub ||
                hub.type !==
                    ChannelType.GuildVoice
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le hub sélectionné est invalide."
                });
            }

            // ==================================================
            // SAUVEGARDE
            // ==================================================

            await tempVoiceSystem.saveConfig(
                interaction.guild.id,
                {
                    guildId:
                        interaction.guild.id,

                    categoryId:
                        category.id,

                    hubId:
                        hub.id,

                    initialName,

                    createdAt:
                        Date.now(),

                    createdBy:
                        interaction.user.id
                }
            );

            console.log(
                `🏢 TPV configuré sur ${interaction.guild.name}`
            );

            console.log(
                `   ↳ Hub : ${hub.id}`
            );

            console.log(
                `   ↳ Catégorie : ${category.id}`
            );

            console.log(
                `   ↳ Nom initial : ${initialName}`
            );

            // ==================================================
            // REPONSE
            // ==================================================

            return interaction.editReply({
                content: [
                    "✅ **Système TPV configuré !**",
                    "",
                    `➕ **Hub :** <#${hub.id}>`,
                    `📁 **Catégorie :** <#${category.id}>`,
                    `🎙️ **Nom initial :** ${initialName}`,
                    "",
                    "Dès qu'un joueur rejoint le hub, son bureau sera créé automatiquement."
                ].join("\n")
            });

        } catch (error) {
            console.error(
                "❌ /setuptpv :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Erreur pendant le setup TPV.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};