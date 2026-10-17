const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const pending = new Map();
const CONFIRMATION_MS = 60_000;
const MAX_LISTED_CHANNELS = 18;

function canManageChannels(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

function confirmationRow(token) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delc:confirm:${token}`)
      .setLabel('Supprimer la catégorie et ses salons')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`delc:cancel:${token}`)
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delc')
    .setDescription('Supprimer une catégorie et tous les salons qu’elle contient')
    .addChannelOption(option => option
      .setName('categorie')
      .setDescription('Catégorie à supprimer')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Cette commande est disponible uniquement sur un serveur.', flags: MessageFlags.Ephemeral });
    }
    if (!canManageChannels(interaction)) {
      return interaction.reply({ content: '❌ Il te faut la permission **Gérer les salons** pour utiliser cette commande.', flags: MessageFlags.Ephemeral });
    }

    const category = interaction.options.getChannel('categorie', true);
    if (category.type !== ChannelType.GuildCategory || category.guildId !== interaction.guildId) {
      return interaction.reply({ content: '❌ Choisis une catégorie de ce serveur.', flags: MessageFlags.Ephemeral });
    }

    await interaction.guild.channels.fetch();
    const children = [...category.children.cache.values()];
    const token = interaction.id;
    pending.set(token, {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      categoryId: category.id,
      expiresAt: Date.now() + CONFIRMATION_MS,
      busy: false,
    });
    setTimeout(() => pending.delete(token), CONFIRMATION_MS).unref?.();

    const names = children.slice(0, MAX_LISTED_CHANNELS).map(channel => `• #${channel.name}`).join('\n');
    const omitted = children.length > MAX_LISTED_CHANNELS ? `\n… et ${children.length - MAX_LISTED_CHANNELS} autre(s).` : '';
    const childSummary = children.length ? `${names}${omitted}` : 'Aucun salon enfant.';

    return interaction.reply({
      content: `⚠️ **Suppression définitive**\nLa catégorie **${category.name}** contient **${children.length} salon(s)** :\n${childSummary}\n\nConfirme dans les 60 secondes. Seuls ces salons et cette catégorie seront supprimés.`,
      components: [confirmationRow(token)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },

  async handleComponent(interaction) {
    const [, action, token] = String(interaction.customId || '').split(':');
    const request = pending.get(token);
    if (!request || request.expiresAt < Date.now()) {
      pending.delete(token);
      return interaction.reply({ content: 'Cette confirmation a expiré. Relance `/delc` pour recommencer.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.user.id !== request.userId || interaction.guildId !== request.guildId) {
      return interaction.reply({ content: '❌ Seule la personne ayant lancé `/delc` peut confirmer cette suppression.', flags: MessageFlags.Ephemeral });
    }
    if (!canManageChannels(interaction)) {
      pending.delete(token);
      return interaction.update({ content: '❌ La permission **Gérer les salons** est nécessaire pour continuer.', components: [] });
    }
    if (action === 'cancel') {
      pending.delete(token);
      return interaction.update({ content: 'Suppression annulée. Aucun salon n’a été supprimé.', components: [] });
    }
    if (action !== 'confirm' || request.busy) {
      return interaction.reply({ content: 'Cette action est déjà en cours ou n’est plus disponible.', flags: MessageFlags.Ephemeral });
    }

    request.busy = true;
    pending.delete(token);
    await interaction.deferUpdate();

    await interaction.guild.channels.fetch().catch(() => null);
    const category = await interaction.guild.channels.fetch(request.categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: 'La catégorie n’existe plus. Aucune suppression supplémentaire n’a été effectuée.', components: [] });
    }

    const failures = [];
    // Re-read children at confirmation time so any channel added meanwhile is included.
    const children = [...category.children.cache.values()];
    for (const channel of children) {
      try {
        await channel.delete(`Suppression de la catégorie ${category.name} via /delc par ${interaction.user.id}`);
      } catch (error) {
        failures.push(`#${channel.name} (${error.code || 'erreur'})`);
      }
    }

    if (failures.length) {
      return interaction.editReply({
        content: `⚠️ Suppression partielle : ${failures.length} salon(s) n’ont pas pu être supprimés : ${failures.join(', ')}. La catégorie **${category.name}** est conservée afin de ne pas laisser croire que tout a réussi.`,
        components: [],
        allowedMentions: { parse: [] },
      });
    }

    try {
      await category.delete(`Suppression via /delc par ${interaction.user.id}`);
      return interaction.editReply({ content: `✅ La catégorie **${category.name}** et ses ${children.length} salon(s) ont été supprimés.`, components: [] });
    } catch (error) {
      return interaction.editReply({ content: `⚠️ Les salons ont été supprimés, mais la catégorie **${category.name}** n’a pas pu l’être (${error.code || 'erreur'}).`, components: [] });
    }
  },
};
