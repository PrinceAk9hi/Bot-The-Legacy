const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    Events,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { IDENTITY, COLORS, ROLES } = require('../config/soulSociety');
const { ensurePanel } = require('../utils/recruitmentData');
const { hasBypass } = require('../utils/security');

const PANEL_CHANNEL = '1560753675591225405';
const CATEGORY_ID = '1497885818663075901';
const REFERENT_ROLE_ID = ROLES.referent;
const PANEL_KEY = 'management_applications';
const SELECT_ID = PANEL_KEY;
const CLOSE_ID = 'management_application_close';
const pending = new Set();

const DEPARTMENTS = [
    ['recrutement', 'Gestion Recrutement'],
    ['musical', 'Gestion Musical'],
    ['bot', 'Gestion Bot'],
    ['animation', 'Gestion Animation'],
    ['roleplay', 'Gestion Roleplay'],
    ['ticket', 'Gestion Ticket']
];

function row(...components) {
    return new ActionRowBuilder().addComponents(...components);
}

function panelPayload() {
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECT_ID)
        .setPlaceholder('Choisis la gestion que tu souhaites rejoindre')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(DEPARTMENTS.map(([value, label]) => ({ label: `Gestion ${label.replace(/^Gestion /, '')}`, value })));
    return {
        embeds: [new EmbedBuilder()
            .setColor(0xE8B5CF)
            .setTitle('🏯 Rejoindre une gestion')
            .setDescription('Tu souhaites t’investir davantage dans la Soul Society ? Choisis une gestion dans le menu ci-dessous pour ouvrir une candidature privée.\n\nPrépare tes motivations, tes qualités **et** tes défauts, ton ancienneté dans la famille, ainsi que ce qui ferait de toi le bon choix.\n\nUn membre référent pourra lire ta demande et échanger avec toi dans ton ticket.')
            .setFooter({ text: 'La Soul Society • Candidatures aux gestions' })],
        components: [row(select)],
        allowedMentions: { parse: [] }
    };
}

function safeName(value) {
    return String(value || 'membre').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'membre';
}

function applicationModal(department) {
    const title = `Candidature • ${department}`.slice(0, 45);
    const questions = [
        ['motivation', 'Tes motivations', 'Pourquoi souhaites-tu rejoindre cette gestion ?', 1000],
        ['qualities', 'Tes qualités et tes défauts', 'Présente tes qualités et un ou plusieurs défauts.', 1000],
        ['seniority', 'Ancienneté dans la famille', 'Depuis combien de temps fais-tu partie de la famille ?', 300],
        ['whyYou', 'Pourquoi toi plutôt qu’un autre ?', 'Qu’apporterais-tu à cette gestion ?', 1000]
    ];
    return new ModalBuilder()
        .setCustomId(`management_application_submit:${department}`)
        .setTitle(title)
        .addComponents(questions.map(([id, label, placeholder, max]) => row(
            new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder)
                .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(2).setMaxLength(max)
        )));
}

function readTopic(topic) {
    if (!String(topic || '').startsWith('soul-management-application|')) return null;
    return Object.fromEntries(topic.split('|').slice(1).map(part => {
        const index = part.indexOf(':');
        return index < 0 ? ['', ''] : [part.slice(0, index), part.slice(index + 1)];
    }));
}

function activeApplication(guild, userId) {
    return guild.channels.cache.find(channel => {
        const data = readTopic(channel.topic);
        return channel.parentId === CATEGORY_ID && data?.owner === userId && data.status === 'open';
    }) || null;
}

async function createApplication(interaction, department) {
    if (!DEPARTMENTS.some(([id]) => id === department)) throw new Error('Cette gestion n’existe pas dans le panel.');
    const guild = interaction.guild;
    if (!guild || guild.id !== IDENTITY.guildId) throw new Error('Utilise ce panel dans le serveur de la Soul Society.');
    const category = guild.channels.cache.get(CATEGORY_ID) || await guild.channels.fetch(CATEGORY_ID).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error('La catégorie réservée aux candidatures aux gestions est introuvable.');
    const referentRole = guild.roles.cache.get(REFERENT_ROLE_ID) || await guild.roles.fetch(REFERENT_ROLE_ID).catch(() => null);
    if (!referentRole) throw new Error('Le rôle Membre référent est introuvable. Préviens la direction.');

    await guild.channels.fetch();
    const existing = activeApplication(guild, interaction.user.id);
    if (existing) return interaction.editReply({ content: `Tu as déjà une candidature ouverte : <#${existing.id}>.`, allowedMentions: { parse: [] } });

    const [departmentId, departmentName] = DEPARTMENTS.find(([id]) => id === department);
    const memberName = safeName(interaction.member?.displayName || interaction.user.username);
    const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
        { id: referentRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] }
    ];
    const channel = await guild.channels.create({
        name: `candidature-${departmentId}-${memberName}`.slice(0, 100),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `soul-management-application|owner:${interaction.user.id}|department:${departmentId}|status:open`,
        permissionOverwrites,
        reason: `Candidature à la ${departmentName} par ${interaction.user.tag}`
    });

    const answers = [
        ['Motivations', interaction.fields.getTextInputValue('motivation')],
        ['Qualités et défauts', interaction.fields.getTextInputValue('qualities')],
        ['Ancienneté dans la famille', interaction.fields.getTextInputValue('seniority')],
        ['Pourquoi toi plutôt qu’un autre ?', interaction.fields.getTextInputValue('whyYou')]
    ];
    await channel.send({
        content: `<@&${referentRole.id}>`,
        embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle(`📨 Candidature • ${departmentName}`)
            .setDescription(`Candidature de <@${interaction.user.id}>. Le candidat et les membres référents peuvent échanger ici.`)
            .addFields(answers.map(([name, value]) => ({ name, value: value.slice(0, 1024), inline: false })))
            .setFooter({ text: 'La Soul Society • Rejoindre une gestion' })
            .setTimestamp()],
        components: [row(new ButtonBuilder().setCustomId(CLOSE_ID).setLabel('Fermer la candidature').setStyle(ButtonStyle.Secondary))],
        allowedMentions: { roles: [referentRole.id], users: [] }
    });
    return interaction.editReply({ content: `✅ Ta candidature pour la **${departmentName}** a été créée : <#${channel.id}>. Un membre référent a été prévenu.`, allowedMentions: { parse: [] } });
}

module.exports = function registerManagementApplications(client) {
    client.once(Events.ClientReady, async () => {
        try {
            await ensurePanel(client, PANEL_CHANNEL, PANEL_KEY, panelPayload());
            console.log('🏯 Panel candidatures aux gestions : ✅ actualisé');
        } catch (error) {
            console.error('❌ Panel candidatures aux gestions :', error.code || error.message);
        }
    });

    client.on(Events.InteractionCreate, async interaction => {
        const id = interaction.customId || '';
        if (interaction.isStringSelectMenu() && id === SELECT_ID) {
            if (interaction.guildId !== IDENTITY.guildId) return;
            const department = DEPARTMENTS.find(([value]) => value === interaction.values[0]);
            if (!department) return interaction.reply({ content: 'Cette gestion n’est pas disponible.', flags: MessageFlags.Ephemeral });
            return interaction.showModal(applicationModal(department[1]));
        }

        if (interaction.isModalSubmit() && id.startsWith('management_application_submit:')) {
            if (interaction.guildId !== IDENTITY.guildId) return;
            if (pending.has(interaction.user.id)) return interaction.reply({ content: '⏳ Ta candidature est déjà en cours de création.', flags: MessageFlags.Ephemeral });
            pending.add(interaction.user.id);
            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                await createApplication(interaction, id.slice('management_application_submit:'.length));
            } catch (error) {
                const message = error.code === 50013
                    ? 'Le bot n’a pas les permissions nécessaires pour créer ce ticket dans la catégorie prévue.'
                    : `Impossible de créer le ticket : ${error.message || 'erreur inconnue'}`;
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message, allowedMentions: { parse: [] } }).catch(() => {});
                else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
            } finally {
                pending.delete(interaction.user.id);
            }
            return;
        }

        if (!interaction.isButton() || id !== CLOSE_ID || !interaction.inGuild()) return;
        const topic = readTopic(interaction.channel?.topic);
        if (!topic || interaction.channel.parentId !== CATEGORY_ID) return;
        const canClose = interaction.user.id === topic.owner || interaction.member?.roles?.cache?.has(REFERENT_ROLE_ID) || hasBypass(interaction);
        if (!canClose) return interaction.reply({ content: 'Seul le candidat, un membre référent ou la direction peut fermer cette candidature.', flags: MessageFlags.Ephemeral });
        if (topic.status !== 'open') return interaction.reply({ content: 'Cette candidature est déjà fermée.', flags: MessageFlags.Ephemeral });

        await interaction.deferUpdate();
        const channel = interaction.channel;
        try {
            await channel.send({ content: `🔒 Candidature fermée par <@${interaction.user.id}>.`, allowedMentions: { parse: [], users: [] } });
            await channel.setTopic(`soul-management-application|owner:${topic.owner}|department:${topic.department}|status:closed`);
            await channel.permissionOverwrites.edit(topic.owner, { ViewChannel: false, SendMessages: false }, 'Candidature aux gestions fermée');
            await channel.setName(`ferme-${channel.name}`.slice(0, 100), 'Candidature aux gestions fermée');
            await interaction.message.edit({ components: [] }).catch(() => {});
        } catch (error) {
            console.error('Fermeture candidature gestion :', error.code || error.message);
            await interaction.followUp({ content: 'La fermeture n’a pas pu être terminée. Vérifie les permissions du bot et réessaie.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    });
};
