const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setupcandidature")
        .setDescription("Installer le panel de candidature The Legacy")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const salonId =
            "1533186481412116631";

        const salon =
            interaction.guild.channels.cache.get(
                salonId
            );

        if (!salon) {
            return interaction.editReply({
                content:
                    "❌ Le salon de candidature est introuvable."
            });
        }

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "Le Chemin Des Héritiers <:emoji_26:1532806562761150544>"
                )
                .setDescription(
`The Legacy évolue dans une palette de **bleus profonds**, **inspirée des cieux** et **du silence**. Notre héritage repose sur **la discrétion**, **la loyauté** et **le respect**, des valeurs qui **façonnent chacun de nos membres**.

**Période de test**

> - 2 semaines de mise à l'épreuve.
> - Accès à la bannière officielle dès l'obtention du grade <@&1531761056744083648>.

**Conditions de recrutement**

- 5 000 minutes de jeu minimum.
- Casier RP vierge ou irréprochable.
- Faire preuve de maturité, de cohérence et d'une grande discrétion.
- 16 ans minimum.
- Maîtriser le règlement du serveur.
- Être investi en WL / S-WL.
- Faire preuve d'une activité soutenue sur Discord comme en jeu.

> *En rejoignant The Legacy, vous reconnaissez avoir pris connaissance de l'ensemble des conditions énoncées ci-dessus. Vous vous engagez également à respecter nos valeurs, à faire preuve de patience durant le traitement de votre candidature et à accepter que chaque décision soit prise dans l'intérêt de l'héritage que nous préservons.*`
                );

        const ligne =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "legacy_join"
                        )
                        .setLabel(
                            "Rejoindre The Legacy"
                        )
                        .setEmoji(
                            "1534556651351310387"
                        )
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

        await salon.send({
            embeds: [embed],
            components: [ligne]
        });

        return interaction.editReply({
            content:
                `✅ Panel de candidature envoyé dans ${salon}.`
        });
    }
};