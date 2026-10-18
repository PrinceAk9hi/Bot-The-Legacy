
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} = require('discord.js');

const GUILD_ID = '1558167237200973967';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Gérer la synchronisation des permissions des catégories du QG.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Choisir le sens de synchronisation')
        .setRequired(true)
        .addChoices(
          {
            name: 'Catégorie → Tous les salons',
            value: 'category_to_channels',
          },
          {
            name: 'Salon → Catégorie et tous les salons',
            value: 'channel_to_category',
          }
        )
    )

    .addChannelOption(option =>
      option
        .setName('categorie')
        .setDescription('Sélectionner la catégorie à synchroniser')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )

    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon source (pour le mode Salon → Catégorie)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild || interaction.guild.id !== GUILD_ID) {
      return interaction.reply({
        content: '❌ Cette commande est exclusivement réservée au serveur Le QG.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Seuls les administrateurs peuvent utiliser cette commande.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const mode = interaction.options.getString('mode');
    const category = interaction.options.getChannel('categorie');
    const source = interaction.options.getChannel('salon');

    if (mode === 'channel_to_category') {
      if (!source || source.parentId !== category.id) {
        return interaction.reply({
          content: '❌ Tu dois sélectionner un salon appartenant à la catégorie choisie.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      await interaction.guild.channels.fetch();

      const channels = [...interaction.guild.channels.cache.values()]
        .filter(channel => channel.parentId === category.id);

      const modeLabel =
        mode === 'category_to_channels'
          ? 'Catégorie → Tous les salons'
          : 'Salon → Catégorie → Tous les salons';

      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('QG • Synchronisation des permissions')
        .setDescription(
          'Tu es sur le point de modifier les permissions des salons.\n\n' +
          '⚠️ **Cette opération remplacera les permissions personnalisées des salons concernés.**'
        )
        .addFields(
          {
            name: '📁 Catégorie',
            value: category.name,
            inline: true,
          },
          {
            name: '🔄 Mode',
            value: modeLabel,
            inline: false,
          },
          {
            name: '📋 Salons concernés',
            value: String(channels.length),
            inline: true,
          },
          {
            name: '👤 Exécuté par',
            value: `<@${interaction.user.id}>`,
            inline: true,
          }
        )
        .setFooter({
          text: 'Le QG • Gestion administrative',
        })
        .setTimestamp();

      if (source && mode === 'channel_to_category') {
        embed.addFields({
          name: '📌 Salon source',
          value: `<#${source.id}>`,
          inline: false,
        });
      }

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('qg_cat_confirm')
          .setLabel('Confirmer la synchronisation')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),

        new ButtonBuilder()
          .setCustomId('qg_cat_cancel')
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️')
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });

      let confirmation;

      try {
        confirmation = await message.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: i => i.user.id === interaction.user.id,
          time: 30000,
        });
      } catch {
        return interaction.editReply({
          content: '⌛ Le délai de confirmation est dépassé. Opération annulée.',
          embeds: [],
          components: [],
        });
      }

      if (confirmation.customId === 'qg_cat_cancel') {
        return confirmation.update({
          content: '❌ La synchronisation a été annulée.',
          embeds: [],
          components: [],
        });
      }

      await confirmation.update({
        content: '⏳ **Synchronisation en cours...**',
        embeds: [],
        components: [],
      });

      if (mode === 'channel_to_category') {
        try {
          const permissions = source.permissionOverwrites.cache.map(
            overwrite => ({
              id: overwrite.id,
              type: overwrite.type,
              allow: overwrite.allow,
              deny: overwrite.deny,
            })
          );

          await category.permissionOverwrites.set(
            permissions,
            `QG /cat • Synchronisation par ${interaction.user.tag}`
          );
        } catch (error) {
          console.error('[QG CAT] Erreur catégorie :', error);

          return interaction.editReply({
            content: '❌ Impossible de synchroniser les permissions de la catégorie.',
            embeds: [],
            components: [],
          });
        }
      }

      let success = 0;
      const failed = [];

      for (const channel of channels) {
        try {
          await channel.lockPermissions();
          success++;
        } catch (error) {
          console.error(`[QG CAT] Erreur ${channel.name} :`, error);
          failed.push(channel.name);
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(failed.length === 0 ? 0x57F287 : 0xFEE75C)
        .setTitle(
          failed.length === 0
            ? '✅ Synchronisation terminée'
            : '⚠️ Synchronisation partielle'
        )
        .addFields(
          {
            name: '📁 Catégorie',
            value: category.name,
            inline: true,
          },
          {
            name: '🔄 Mode',
            value: modeLabel,
            inline: false,
          },
          {
            name: '✅ Salons synchronisés',
            value: `${success}/${channels.length}`,
            inline: true,
          },
          {
            name: '❌ Échecs',
            value: String(failed.length),
            inline: true,
          }
        )
        .setFooter({
          text: 'Le QG • Administration',
        })
        .setTimestamp();

      if (failed.length > 0) {
        resultEmbed.addFields({
          name: 'Salons non synchronisés',
          value: failed.map(name => `• ${name}`).join('\n').slice(0, 1000),
        });
      }

      return interaction.editReply({
        content: '',
        embeds: [resultEmbed],
        components: [],
      });

    } catch (error) {
      console.error('[QG CAT] Erreur générale :', error);

      return interaction.editReply({
        content: '❌ Une erreur inattendue est survenue pendant la synchronisation.',
        embeds: [],
        components: [],
      });
    }
  },
};
