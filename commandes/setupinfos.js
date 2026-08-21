const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const TARGET_CHANNEL_ID =
    "1506762774397845534";

const ALLOWED_USER_IDS =
    new Set([
        "547192186547077130",
        "883087428016046150"
    ]);

// ======================================================
// LIENS
// ======================================================

const SCHOOL_RP_URL =
    "https://discord.com/channels/1396247403149000724/1424115690545217598";

const ROBLOX_URL =
    "https://www.roblox.com/share/g/194530241";

// ======================================================
// SALONS
// ======================================================

const GESTIONS_CHANNEL_ID =
    "1490135761197072485";

const PSEUDO_CHANNEL_ID =
    "1458407383133851813";

const ABSENCE_CHANNEL_ID =
    "1458407503929806914";

const QR_CHANNEL_ID =
    "1532126057660940528";

const SESSION_CHANNEL_ID =
    "1532128617247539201";

// ======================================================
// EMBED
// ======================================================

function createInfoEmbed() {
    return new EmbedBuilder()

        .setColor(
            0x3B6475
        )

        .setTitle(
            "Découvre The Legacy via ce salon ! <:emoji_26:1532806562761150544>"
        )

        .setDescription(
            [
                "Pour avoir **accès à la bannière**, ainsi qu'**au badge initial**, il faut :",
                "",
                "- Avoir au minimum passé une période de test de 1 semaine (initialement, elle durera 2 semaines quand même),",
                "",
                "- Ou être passé <@&1531761056744083648>",
                "",
                "> -# Si vous ne remplissiez pas les conditions de recrutement, la bannière ne vous sera pas mis en place avant le rankup. (Sauf en cas d'exception..)",
                "",
                "### **Explication des salons :**",
                "",
                `> **<#${GESTIONS_CHANNEL_ID}>**`,
                "> Dès votre passage <@&1531761056744083648> (1 semaine au préalable pour rejoindre une gestion), **vous aurez la possibilité de rejoindre 2 gestions aux choix via un système de candidature**.",
                "",
                `> **<#${PSEUDO_CHANNEL_ID}>**`,
                "> Dès votre passage <@&1531761056744083648> (à faire au moment de votre rankup), **vous devrez remplir le formulaire de votre pseudo dans ce salon**.",
                "",
                `> **<#${ABSENCE_CHANNEL_ID}>**`,
                "> Dès votre arrivée, **en cas d'absence durant plus de 1j**, **vous devrez remplir ce formulaire d'absence, pour éviter de vous prendre des sanctions/rappels**.",
                "",
                `> **<#${QR_CHANNEL_ID}>**`,
                "> Dès votre arrivée, suivant votre tranche d'âge, **vous aurez la possibilité partager/recevoir le QR Code dans ce salon précisément, uniquement pour les personnes de confiance**.",
                "",
                `> **<#${SESSION_CHANNEL_ID}>**`,
                "> Dès votre arrivée, **vous aurez la possibilité de partager vos sessions school RP pour faire rejoindre les autres membres disponibles**.",
                "",
                "Nous souhaitons que **la gestion des membres soit opérationnel**, il est donc impératif que **l'ensemble des joueurs fassent leurs demandes de rôle sur le serveur School RP Famille**.",
                "",
                `Voici le lien du serveur : <:People:1540427883770552381> [School RP Famille](${SCHOOL_RP_URL})`,
                "",
                "Après validation du <@&1531760308761133229> *ou* <@&1516451475415367822> pour le rankup / accès à la bannière, **il faudra demander à rejoindre la communauté ci-dessous**.",
                "",
                `**Voici le lien du groupe roblox :** <:126013friends:1532080555317788782> [The Legacy Community](${ROBLOX_URL})`
            ].join("\n")
        )

        .setFooter({
            text:
                "The Legacy • Informations"
        });
}

// ======================================================
// BOUTONS
// ======================================================

function createInfoButtons() {
    return [
        new ActionRowBuilder()
            .addComponents(

                // ==================================================
                // CHANGER SON ROBLOX
                // ==================================================

                new ButtonBuilder()
                    .setCustomId(
                        "legacy_change_roblox"
                    )
                    .setLabel(
                        "Changer son Roblox"
                    )
                    .setEmoji({
                        id:
                            "1532080555317788782",

                        name:
                            "126013friends"
                    })
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                // ==================================================
                // SCHOOL RP FAMILLE
                // ==================================================

                new ButtonBuilder()
                    .setLabel(
                        "School RP Famille"
                    )
                    .setEmoji({
                        id:
                            "1540427883770552381",

                        name:
                            "People"
                    })
                    .setStyle(
                        ButtonStyle.Link
                    )
                    .setURL(
                        SCHOOL_RP_URL
                    ),

                // ==================================================
                // ROBLOX
                // ==================================================

                new ButtonBuilder()
                    .setLabel(
                        "The Legacy Community"
                    )
                    .setEmoji({
                        id:
                            "1533222807423418479",

                        name:
                            "coeurpnllgcy"
                    })
                    .setStyle(
                        ButtonStyle.Link
                    )
                    .setURL(
                        ROBLOX_URL
                    )
            )
    ];
}

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName(
                "setupinfos"
            )
            .setDescription(
                "Installer ou mettre à jour le panneau d'informations The Legacy"
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(
        interaction
    ) {
        console.log(
            "ℹ️ /setupinfos exécuté"
        );

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        try {
            // ==================================================
            // PERMISSIONS
            // ==================================================

            const isAllowed =
                ALLOWED_USER_IDS.has(
                    interaction.user.id
                );

            const isAdmin =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (
                !isAllowed &&
                !isAdmin
            ) {
                return interaction.editReply({
                    content:
                        "❌ Tu n'as pas la permission d'utiliser `/setupinfos`."
                });
            }

            // ==================================================
            // SALON
            // ==================================================

            const channel =
                await interaction.guild.channels
                    .fetch(
                        TARGET_CHANNEL_ID
                    )
                    .catch(
                        () => null
                    );

            if (!channel) {
                return interaction.editReply({
                    content:
                        `❌ Le salon <#${TARGET_CHANNEL_ID}> est introuvable.`
                });
            }

            if (
                !channel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        "❌ Le salon configuré ne permet pas d'envoyer de messages."
                });
            }

            // ==================================================
            // PAYLOAD
            // ==================================================

            const payload = {
                content:
                    null,

                embeds: [
                    createInfoEmbed()
                ],

                components:
                    createInfoButtons()
            };

            // ==================================================
            // RECHERCHER LE PANEL EXISTANT
            // ==================================================

            const messages =
                await channel.messages
                    .fetch({
                        limit:
                            100
                    })
                    .catch(
                        () => null
                    );

            let existingMessage =
                null;

            if (messages) {
                existingMessage =
                    messages.find(
                        message =>
                            message.author.id ===
                                interaction.client.user.id &&
                            message.embeds.some(
                                embed =>
                                    embed.title
                                        ?.includes(
                                            "Découvre The Legacy via ce salon"
                                        )
                            )
                    );

                // ==============================================
                // ANCIENNES VERSIONS
                // ==============================================

                if (!existingMessage) {
                    existingMessage =
                        messages.find(
                            message =>
                                message.author.id ===
                                    interaction.client.user.id &&
                                message.embeds.some(
                                    embed =>
                                        embed.description
                                            ?.includes(
                                                "Découvre The Legacy via ce salon"
                                            )
                                )
                        );
                }
            }

            // ==================================================
            // MODIFIER
            // ==================================================

            if (existingMessage) {
                await existingMessage.edit(
                    payload
                );

                console.log(
                    `✅ Panel setupinfos mis à jour : ${existingMessage.id}`
                );

                return interaction.editReply({
                    content:
                        [
                            "✅ **Panel informations mis à jour.**",
                            "",
                            "🔄 Emojis échangés.",
                            "🔘 Bouton **Changer son Roblox** actif.",
                            `📍 <#${TARGET_CHANNEL_ID}>`
                        ].join("\n")
                });
            }

            // ==================================================
            // CRÉER
            // ==================================================

            const sent =
                await channel.send(
                    payload
                );

            console.log(
                `✅ Panel setupinfos créé : ${sent.id}`
            );

            return interaction.editReply({
                content:
                    [
                        "✅ **Panel informations créé.**",
                        "",
                        "🔄 Emojis échangés.",
                        "🔘 Bouton **Changer son Roblox** actif.",
                        `📍 <#${TARGET_CHANNEL_ID}>`
                    ].join("\n")
            });

        } catch (error) {
            console.error(
                "❌ /setupinfos :",
                error
            );

            return interaction.editReply({
                content:
                    `❌ Impossible d'installer le panel.\n\`${error.message}\``
            }).catch(
                () => {}
            );
        }
    }
};