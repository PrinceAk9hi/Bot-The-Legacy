// Tickets : guichet choisi → formulaire → salon privé → prise en charge → fermeture archivée.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    PermissionFlagsBits: P, ChannelType: T, AttachmentBuilder } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');

const typeOf = key => cfg.ticketTypes.find(t => t.key === key);
const tickets = () => store.read('tickets', {});
const ids = () => store.read('server', { roles: {}, categories: {}, channels: {}, messages: {} });

function staffRoleIds(type) {
    const server = ids();
    return (type.staff === 'council' ? cfg.councilKeys : cfg.staffKeys).map(k => server.roles[k]).filter(Boolean);
}

const isStaffFor = (member, type) => staffRoleIds(type).some(id => member.roles.cache.has(id)) || member.permissions.has(P.Administrator);

const prompts = {
    help: 'Explique ta question ou ton problème',
    events: 'Décris l’animation (idée, date, besoins)',
    report: 'Qui, quoi, quand ? Ajoute les preuves ensuite',
    foundation: 'Pourquoi veux-tu parler à la Fondation ?'
};

async function onSelect(interaction) {
    const type = typeOf(interaction.values[0]);
    const existing = Object.entries(tickets()).find(([, t]) => t.owner === interaction.user.id && t.type === type.key);
    if (existing && interaction.guild.channels.cache.has(existing[0])) {
        return interaction.reply({ content: `Tu as déjà un ticket **${type.label}** ouvert : <#${existing[0]}>`, ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId('hunter:ticketForm:' + type.key).setTitle(`${type.emoji} ${type.label}`).addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subject').setLabel(prompts[type.key])
            .setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(1000).setRequired(true))
    );
    await interaction.showModal(modal);
    // Remet le menu à zéro pour pouvoir rechoisir le même guichet.
    await interaction.message.edit(ui.ticketPanel()).catch(() => null);
}

async function onForm(interaction, typeKey) {
    const type = typeOf(typeKey);
    const subject = interaction.fields.getTextInputValue('subject');
    await interaction.deferReply({ ephemeral: true });

    const staff = staffRoleIds(type);
    const user = interaction.user;
    const name = `${type.emoji}・${type.key}-${user.username}`.toLowerCase().slice(0, 90);
    const channel = await interaction.guild.channels.create({
        name,
        type: T.GuildText,
        parent: ids().categories.tickets,
        topic: `Ticket ${type.label} de ${user.tag} (${user.id})`,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [P.ViewChannel] },
            { id: interaction.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.ManageMessages, P.AttachFiles, P.EmbedLinks] },
            { id: user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
            ...staff.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.ManageMessages] }))
        ]
    });

    const all = tickets();
    all[channel.id] = { owner: user.id, type: type.key, subject, openedAt: Date.now(), claimedBy: null };
    store.write('tickets', all);

    await channel.send({
        content: `${user} ${staff.map(id => `<@&${id}>`).join(' ')}`,
        embeds: [ui.card(type.color)
            .setTitle(`${type.emoji} ${type.label}`)
            .setDescription(`Merci ${user}, ton dossier est arrivé au bureau. Un membre de l’équipe va le prendre en charge.`)
            .addFields({ name: 'Demande', value: subject }, { name: 'Pris en charge par', value: 'Personne pour l’instant' })],
        components: [controls(false)],
        allowedMentions: { users: [user.id], roles: staff }
    });
    await interaction.editReply(`Ton ticket est ouvert : ${channel}`);
}

function controls(claimed) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hunter:ticketClaim').setLabel(claimed ? 'Pris en charge' : 'Prendre en charge').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(claimed),
        new ButtonBuilder().setCustomId('hunter:ticketClose').setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
}

async function onClaim(interaction) {
    const all = tickets();
    const ticket = all[interaction.channelId];
    if (!ticket) return interaction.reply({ content: 'Ce ticket est introuvable.', ephemeral: true });
    if (!isStaffFor(interaction.member, typeOf(ticket.type))) return interaction.reply({ content: 'Seule l’équipe peut prendre ce ticket.', ephemeral: true });
    ticket.claimedBy = interaction.user.id;
    store.write('tickets', all);
    const embed = ui.card(typeOf(ticket.type).color).setTitle(interaction.message.embeds[0].title)
        .setDescription(interaction.message.embeds[0].description)
        .addFields({ name: 'Demande', value: ticket.subject }, { name: 'Pris en charge par', value: `${interaction.user}` });
    await interaction.update({ embeds: [embed], components: [controls(true)] });
}

async function onClose(interaction) {
    const ticket = tickets()[interaction.channelId];
    if (!ticket) return interaction.reply({ content: 'Ce ticket est introuvable.', ephemeral: true });
    if (ticket.owner !== interaction.user.id && !isStaffFor(interaction.member, typeOf(ticket.type))) {
        return interaction.reply({ content: 'Tu ne peux pas fermer ce ticket.', ephemeral: true });
    }
    await interaction.reply({
        content: 'Fermer définitivement ce ticket ? Il sera archivé pour l’équipe.',
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hunter:ticketCloseYes').setLabel('Oui, fermer').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('hunter:ticketCloseNo').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
        )],
        ephemeral: true
    });
}

async function transcript(channel) {
    const lines = [];
    let before;
    for (let i = 0; i < 10; i++) {
        const batch = await channel.messages.fetch({ limit: 100, before });
        if (!batch.size) break;
        batch.forEach(m => lines.push(`[${new Date(m.createdTimestamp).toLocaleString('fr-FR')}] ${m.author.tag} : ${m.content || ''}${m.embeds.length ? ' [embed]' : ''}${m.attachments.size ? ' ' + m.attachments.map(a => a.url).join(' ') : ''}`));
        before = batch.last().id;
    }
    return lines.reverse().join('\n');
}

async function onCloseConfirm(interaction) {
    const all = tickets();
    const ticket = all[interaction.channelId];
    if (!ticket) return interaction.update({ content: 'Ce ticket est déjà fermé.', components: [] });
    await interaction.update({ content: 'Fermeture en cours…', components: [] });
    const channel = interaction.channel;
    const type = typeOf(ticket.type);

    const logs = interaction.guild.channels.cache.get(ids().channels.ticketLogs);
    if (logs) {
        const file = new AttachmentBuilder(Buffer.from(await transcript(channel), 'utf8'), { name: `${channel.name}.txt` });
        await logs.send({
            embeds: [ui.card(type.color).setTitle(`🗃️ Ticket fermé — ${type.emoji} ${type.label}`).addFields(
                { name: 'Ouvert par', value: `<@${ticket.owner}>`, inline: true },
                { name: 'Pris par', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : '—', inline: true },
                { name: 'Fermé par', value: `${interaction.user}`, inline: true },
                { name: 'Ouvert le', value: `<t:${Math.floor(ticket.openedAt / 1000)}:f>`, inline: true },
                { name: 'Demande', value: ticket.subject.slice(0, 1024) }
            )],
            files: [file],
            allowedMentions: { parse: [] }
        });
    }

    delete all[channel.id];
    store.write('tickets', all);
    await channel.send('🔒 Ticket fermé, suppression dans 5 secondes.');
    setTimeout(() => channel.delete('Ticket fermé').catch(() => null), 5000);
}

// Nettoie les tickets dont le salon a été supprimé à la main.
function forget(channelId) {
    const all = tickets();
    if (all[channelId]) {
        delete all[channelId];
        store.write('tickets', all);
    }
}

async function handle(interaction) {
    const id = interaction.customId;
    if (interaction.isStringSelectMenu() && id === 'hunter:ticket') return onSelect(interaction);
    if (interaction.isModalSubmit() && id.startsWith('hunter:ticketForm:')) return onForm(interaction, id.split(':')[2]);
    if (!interaction.isButton()) return false;
    if (id === 'hunter:ticketClaim') return onClaim(interaction);
    if (id === 'hunter:ticketClose') return onClose(interaction);
    if (id === 'hunter:ticketCloseYes') return onCloseConfirm(interaction);
    if (id === 'hunter:ticketCloseNo') return interaction.update({ content: 'Fermeture annulée.', components: [] });
    return false;
}

module.exports = { handle, forget };
