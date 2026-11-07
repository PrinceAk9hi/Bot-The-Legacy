// Recrutement de la famille, en deux temps comme sur QG :
// 1. candidature écrite en MP → dossier dans 📋・cd-en-attente (Accepter / Refuser / DDS / Ticket)
// 2. entretien oral dans un bureau → panel recruteur (Déplacer, Attente, Accepter, Refuser, Compte rendu).
const { randomUUID } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    AttachmentBuilder, ChannelType: C, PermissionFlagsBits: P } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');

const DAY = 86400000;
const ACTIVE = ['in_progress', 'submitted', 'waiting_interview'];
const statusLabel = {
    in_progress: '✏️ En cours de rédaction', submitted: '📨 Écrit à corriger', waiting_interview: '⏳ Attente entretien',
    accept: '✅ Admis (membre test)', refuse: '🚫 Refusé', cancelled: '↩️ Annulée'
};

const ids = () => store.read('server', { roles: {}, channels: {}, categories: {}, messages: {} });
const state = () => ({ open: true, apps: {}, dds: {}, ...store.read('recruitment', {}) });
const update = fn => { const s = state(); fn(s); store.write('recruitment', s); return s; };
const appByCase = caseId => Object.values(state().apps).find(a => a.caseId === caseId);

const has = (member, keys) => keys.some(k => member.roles.cache.has(ids().roles[k]));
const isAdmin = member => member.permissions.has(P.Administrator);
const isRecruiter = member => isAdmin(member) || has(member, cfg.recruiterKeys);
const isCouncil = member => isAdmin(member) || has(member, cfg.councilKeys);
const inFamily = member => has(member, cfg.ladder);
const officeIds = () => cfg.officeKeys.map(k => ids().channels[k]).filter(Boolean);

const row = (...items) => new ActionRowBuilder().addComponents(...items);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const fail = message => Object.assign(new Error(message), { userFacing: true });

// ── Candidature écrite ────────────────────────────────────────────────────────

async function start(interaction) {
    const s = state();
    if (!s.open) throw fail('Les candidatures sont fermées pour le moment.');
    const member = interaction.member;
    if (inFamily(member)) throw fail('Tu fais déjà partie de la famille 🪪');
    if (!member.roles.cache.has(ids().roles.visitor)) throw fail('Signe d’abord le règlement dans 📜・règlement.');
    const current = s.apps[member.id];
    if (current && ACTIVE.includes(current.status)) throw fail('Tu as déjà une candidature en cours : regarde tes messages privés.');

    const dm = await interaction.user.createDM().catch(() => null);
    const sent = dm && await dm.send({ embeds: [question(0, true)] }).catch(() => null);
    if (!sent) throw fail('Je ne peux pas t’écrire en privé. Active « Messages privés » pour ce serveur et réessaie.');

    update(x => {
        if (current) { x.archive ||= {}; x.archive[member.id + ':' + current.createdAt] = current; }
        x.apps[member.id] = { userId: member.id, status: 'in_progress', step: 0, answers: [], createdAt: Date.now() };
    });
    return interaction.reply({ content: '📩 Je t’ai envoyé la première question en message privé.', ephemeral: true });
}

function question(step, first) {
    const total = cfg.applicationQuestions.length;
    return ui.card(cfg.colors.gold)
        .setTitle(`📝 Candidature • ${step + 1}/${total}`)
        .setDescription((first ? `**Conditions**\n${cfg.family.conditions.map(c => '▸ ' + c).join('\n')}\n\n` : '') +
            `**${cfg.applicationQuestions[step]}**\n\nRéponds directement à ce message. Écris \`annuler\` pour arrêter.`);
}

// Réponses envoyées en MP au bot.
async function onDirectMessage(message) {
    const app = state().apps[message.author.id];
    if (!app || app.status !== 'in_progress') return;
    const text = message.content.trim();
    if (!text) return message.reply('Réponds avec du texte, s’il te plaît.');
    if (text.toLowerCase() === 'annuler') {
        update(x => { x.apps[app.userId].status = 'cancelled'; });
        return message.reply('Candidature annulée. Tu pourras recommencer quand tu veux depuis 📝・candidature.');
    }
    app.answers.push(text.slice(0, 1000));
    app.step++;
    if (app.step < cfg.applicationQuestions.length) {
        update(x => { x.apps[app.userId] = app; });
        return message.channel.send({ embeds: [question(app.step, false)] });
    }

    const guild = await message.client.guilds.fetch(cfg.guildId);
    app.status = 'submitted';
    app.caseId = randomUUID().slice(0, 8);
    app.submittedAt = Date.now();
    update(x => { x.apps[app.userId] = app; });
    const channel = await guild.channels.fetch(ids().channels.applications);
    const posted = await channel.send(dossier(app, true));
    update(x => { x.apps[app.userId].messageId = posted.id; });
    return message.channel.send({ embeds: [ui.card(cfg.colors.hunter).setTitle('📨 Candidature envoyée')
        .setDescription('Ton dossier est entre les mains des Examinateurs. Tu recevras la décision de l’écrit ici même.')] });
}

function summary(app) {
    const embed = ui.card(app.status === 'refuse' ? cfg.colors.alert : app.status === 'accept' ? cfg.colors.hunter : cfg.colors.gold)
        .setTitle('📋 Candidature • Association des Hunters')
        .setDescription(`Candidat : <@${app.userId}>\nStatut : **${statusLabel[app.status]}**\nDossier : \`${app.caseId}\`\nDéposée <t:${Math.floor(app.submittedAt / 1000)}:f>` +
            (app.updatedBy ? `\nDernier traitement : <@${app.updatedBy}>` : '') + '\n\nLes réponses complètes sont dans le fichier joint.');
    for (let n = 0; n < 3; n++) embed.addFields({ name: cfg.applicationQuestions[n], value: (app.answers[n] || '—').slice(0, 800) });
    return embed;
}

function answersFile(app) {
    const body = cfg.applicationQuestions.map((q, n) => `${n + 1}. ${q}\n${app.answers[n] || 'Sans réponse'}`).join('\n\n');
    return new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `candidature-${app.caseId}.txt` });
}

function dossier(app, withFile) {
    const open = app.status === 'submitted';
    return {
        embeds: [summary(app)],
        ...(withFile ? { files: [answersFile(app)] } : {}),
        components: [row(
            button(`hunter:rec:written:${app.caseId}:accept`, 'Accepter', ButtonStyle.Success).setDisabled(!open),
            button(`hunter:rec:written:${app.caseId}:refuse`, 'Refuser', ButtonStyle.Danger).setDisabled(!open),
            button(`hunter:rec:dds:${app.caseId}`, 'DDS'),
            button(`hunter:rec:ticket:${app.caseId}`, 'Ouvrir un ticket')
        )],
        allowedMentions: { parse: [] }
    };
}

async function refresh(guild, app) {
    const channel = await guild.channels.fetch(ids().channels.applications).catch(() => null);
    const message = channel && await channel.messages.fetch(app.messageId).catch(() => null);
    await message?.edit(dossier(app, false));
}

// ── Décisions ─────────────────────────────────────────────────────────────────

async function decide(interaction, app, action) {
    const oral = action.startsWith('oral');
    if (oral ? app.status !== 'waiting_interview' : app.status !== 'submitted') throw fail('Cette étape a déjà été traitée.');
    const target = await interaction.guild.members.fetch(app.userId).catch(() => null);
    if (!target) throw fail('Le candidat a quitté le serveur.');
    if (oral && (!officeIds().includes(interaction.member.voice.channelId) || target.voice.channelId !== interaction.member.voice.channelId)) {
        throw fail('Le candidat et toi devez être dans le même bureau.');
    }

    const r = ids().roles;
    const accepted = action.endsWith('accept');
    const add = accepted ? (oral ? r.candidate : r.interviewWaiting) : r.refused;
    const remove = [r.interviewWaiting, r.refused, ...(oral && accepted ? [r.visitor] : [])].filter(id => id !== add);
    await target.roles.add(add, `Recrutement : décision de ${interaction.user.tag}`);
    await target.roles.remove(remove.filter(id => target.roles.cache.has(id)), `Recrutement : décision de ${interaction.user.tag}`);

    app.status = accepted ? (oral ? 'accept' : 'waiting_interview') : 'refuse';
    app.updatedBy = interaction.user.id;
    app.updatedAt = Date.now();
    if (oral) {
        app.finishedAt = Date.now();
        app.interviewMs = app.interviewStart ? Date.now() - app.interviewStart : null;
    }
    update(x => { x.apps[app.userId] = app; });
    await refresh(interaction.guild, app);

    const ch = ids().channels;
    const text = accepted
        ? (oral
            ? `Ton entretien est réussi 🎉 Tu rejoins ${cfg.family.name} en tant que **🎟️ Candidat** (membre test). Présente-toi dans <#${ch.introductions}> !`
            : `Ta candidature écrite est acceptée ✅ Indique tes disponibilités dans <#${ch.availability}>, puis rejoins <#${ch.interviewWaiting}> : un Examinateur viendra te chercher pour l’entretien.`)
        : 'Ta candidature n’a pas été retenue cette fois. Merci pour ton intérêt et bonne continuation sur School RP.';
    const delivered = await target.send({ embeds: [ui.card(accepted ? cfg.colors.hunter : cfg.colors.alert).setTitle('📋 Ta candidature').setDescription(text)] })
        .then(() => true, () => false);

    if (oral && accepted) {
        interaction.guild.channels.cache.get(ch.examChat)?.send({
            content: `${target}`,
            embeds: [ui.card(cfg.colors.gold).setDescription(`🎟️ ${target} a réussi son entretien ! Bienvenue dans ta période de test.`)],
            allowedMentions: { users: [target.id] }
        });
    }
    return interaction.update({ content: `Décision enregistrée : **${statusLabel[app.status]}**.${delivered ? '' : '\n⚠️ MP fermés : préviens le candidat toi-même.'}`, embeds: [], components: [] });
}

function confirm(interaction, app, action) {
    const verb = { writtenaccept: 'Placer en attente d’entretien', writtenrefuse: 'Refuser', oralaccept: 'Accepter l’entretien de', oralrefuse: 'Refuser l’entretien de' }[action];
    const payload = {
        content: `${verb} <@${app.userId}> ?`,
        components: [row(button(`hunter:rec:confirm:${app.caseId}:${action}`, 'Confirmer', ButtonStyle.Primary))],
        allowedMentions: { parse: [] }
    };
    return interaction.isStringSelectMenu() ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

// ── Entretien oral (panel) ────────────────────────────────────────────────────

const recentlyMine = (app, member) => app.finishedAt && app.updatedBy === member.id && Date.now() - app.finishedAt < DAY;

async function choose(interaction, op) {
    const office = interaction.member.voice.channelId;
    if (!officeIds().includes(office)) throw fail('Rejoins d’abord un 🔐 Bureau Entretien.');
    const source = interaction.guild.channels.cache.get(op === 'bring' ? ids().channels.interviewWaiting : office);
    const options = Object.values(state().apps).filter(app => app.caseId && (
        (app.status === 'waiting_interview' && source?.members.has(app.userId)) ||
        (['cr', 'view'].includes(op) && recentlyMine(app, interaction.member))
    ));
    if (!options.length) throw fail(op === 'bring' ? 'Personne n’attend dans 🀄・Attente entretien.' : 'Aucun candidat avec dossier dans ton bureau.');
    return interaction.reply({
        content: 'Choisis le candidat concerné :',
        components: [row(new StringSelectMenuBuilder().setCustomId('hunter:rec:select:' + op).setPlaceholder('Candidat')
            .addOptions(options.slice(0, 25).map(app => ({
                label: (interaction.guild.members.cache.get(app.userId)?.displayName || app.userId).slice(0, 100),
                description: statusLabel[app.status], value: app.caseId
            }))))],
        ephemeral: true
    });
}

async function onSelect(interaction, op) {
    const app = appByCase(interaction.values[0]);
    if (!app) throw fail('Dossier introuvable.');
    const target = await interaction.guild.members.fetch(app.userId).catch(() => null);
    const office = interaction.member.voice.channelId;

    if (op === 'view') return interaction.update({ content: '', embeds: [summary(app)], files: [answersFile(app)], components: [] });
    if (op === 'cr') {
        return interaction.showModal(new ModalBuilder().setCustomId('hunter:rec:crsave:' + app.caseId).setTitle('Compte rendu d’entretien').addComponents(
            row(new TextInputBuilder().setCustomId('presentation').setLabel('Présentation + communication').setStyle(TextInputStyle.Paragraph).setMaxLength(900)),
            row(new TextInputBuilder().setCustomId('decision').setLabel('Décision et justification').setStyle(TextInputStyle.Paragraph).setMaxLength(900)),
            row(new TextInputBuilder().setCustomId('trial').setLabel('Durée de la période de test').setStyle(TextInputStyle.Short).setMaxLength(100))
        ));
    }
    if (!target) throw fail('Le candidat a quitté le serveur.');
    if (op === 'bring' || op === 'wait') {
        const expected = op === 'bring' ? ids().channels.interviewWaiting : office;
        if (app.status !== 'waiting_interview' || target.voice.channelId !== expected) throw fail('Le candidat a changé de vocal ou de statut.');
        await target.voice.setChannel(op === 'bring' ? office : ids().channels.interviewWaiting, 'Entretien de recrutement');
        if (op === 'bring') update(x => { x.apps[app.userId].interviewStart ||= Date.now(); });
        return interaction.update({ content: op === 'bring' ? `${target} est dans ton bureau. Bon entretien !` : `${target} est retourné en salle d’attente.`, components: [], allowedMentions: { parse: [] } });
    }
    if (op === 'oralaccept' || op === 'oralrefuse') return confirm(interaction, app, op);
}

async function saveReport(interaction, app) {
    const fields = Object.fromEntries(['presentation', 'decision', 'trial'].map(k => [k, interaction.fields.getTextInputValue(k)]));
    const channel = interaction.guild.channels.cache.get(ids().channels.reports);
    const minutes = app.interviewMs != null ? `${Math.floor(app.interviewMs / 60000)} min ${Math.floor(app.interviewMs / 1000) % 60} s` : 'non mesurée';
    await channel.send({
        embeds: [ui.card(cfg.colors.nen).setTitle('📄 Compte rendu d’entretien').setTimestamp()
            .setDescription(`Candidat : <@${app.userId}>\nRecruteur : ${interaction.user}\nStatut : **${statusLabel[app.status]}**\nDurée de l’entretien : ${minutes}`)
            .addFields(
                { name: 'Présentation + communication', value: fields.presentation },
                { name: 'Décision', value: fields.decision },
                { name: 'Période de test', value: fields.trial }
            )],
        files: [answersFile(app)],
        allowedMentions: { parse: [] }
    });
    return interaction.reply({ content: 'Compte rendu transmis dans 📄・comptes-rendus.', ephemeral: true });
}

// ── DDS et ticket candidat ────────────────────────────────────────────────────

async function requestDds(interaction, app) {
    if (Object.values(state().dds).some(d => d.caseId === app.caseId && !d.answer)) throw fail('Une demande est déjà en attente auprès du Conseil.');
    const id = randomUUID().slice(0, 8);
    const channel = interaction.guild.channels.cache.get(ids().channels.foundationRequests);
    await channel.send({
        embeds: [ui.card(cfg.colors.nen).setTitle('📥 DDS • Recrutement')
            .setDescription(`Demandeur : ${interaction.user}\nCandidat : <@${app.userId}>\n\nMerci d’indiquer au recruteur les sanctions ou éléments utiles sur ce candidat. Cette demande n’applique aucune sanction.`)],
        components: [row(button('hunter:rec:ddsanswer:' + id, 'Répondre au recruteur', ButtonStyle.Primary))],
        allowedMentions: { parse: [] }
    });
    update(x => { x.dds[id] = { caseId: app.caseId, candidateId: app.userId, recruiterId: interaction.user.id, at: Date.now() }; });
    return interaction.reply({ content: 'Demande transmise au Conseil des Zodiaques.', ephemeral: true });
}

async function answerDds(interaction, id) {
    const request = state().dds[id];
    if (!request || request.answer) throw fail('Demande absente ou déjà traitée.');
    const answer = interaction.fields.getTextInputValue('answer');
    update(x => Object.assign(x.dds[id], { answer, answeredBy: interaction.user.id, answeredAt: Date.now() }));
    const recruiter = await interaction.client.users.fetch(request.recruiterId);
    const sent = await recruiter.send({ embeds: [ui.card(cfg.colors.nen).setTitle('📥 Réponse du Conseil • DDS').setDescription(`Candidat : <@${request.candidateId}>\n\n${answer}`)] })
        .then(() => true, () => false);
    await interaction.message.edit({ components: [row(button('hunter:rec:ddsanswer:' + id, `Répondu par ${interaction.user.username}`).setDisabled(true))] });
    return interaction.reply({ content: `Réponse enregistrée.${sent ? ' Le recruteur l’a reçue en MP.' : ' MP fermés : préviens le recruteur autrement.'}`, ephemeral: true });
}

async function openTicket(interaction, app) {
    const existing = app.ticketId && interaction.guild.channels.cache.get(app.ticketId);
    if (existing) return interaction.reply({ content: `Ticket existant : ${existing}`, ephemeral: true });
    const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles];
    const channel = await interaction.guild.channels.create({
        name: `candidat-${(interaction.guild.members.cache.get(app.userId)?.user.username || app.userId)}`.slice(0, 90),
        type: C.GuildText,
        parent: ids().categories.recruiter,
        topic: `Échange de recrutement • dossier ${app.caseId}`,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [P.ViewChannel] },
            { id: interaction.client.user.id, allow: [...allow, P.ManageChannels] },
            { id: app.userId, allow },
            { id: interaction.user.id, allow }
        ]
    });
    update(x => { x.apps[app.userId].ticketId = channel.id; });
    await channel.send({ content: `<@${app.userId}> ${interaction.user}`, embeds: [ui.card().setDescription('Échange privé entre le candidat et son recruteur.')] });
    return interaction.reply({ content: `Échange privé créé : ${channel}`, ephemeral: true });
}

// ── Routage ───────────────────────────────────────────────────────────────────

async function toggle(interaction) {
    if (!isCouncil(interaction.member)) throw fail('Seuls le Président et les Zodiaques ouvrent ou ferment les candidatures.');
    const open = interaction.options.getString('etat') === 'ouvert';
    update(x => { x.open = open; });
    const server = ids();
    const channel = interaction.guild.channels.cache.get(server.channels.recruitPanel);
    const message = channel && await channel.messages.fetch(server.messages.recruitPanel).catch(() => null);
    await message?.edit(ui.recruitPanel(open));
    return interaction.reply({ content: open ? '🟢 Candidatures ouvertes.' : '🔴 Candidatures fermées.', ephemeral: true });
}

async function route(interaction) {
    if (interaction.isChatInputCommand()) return toggle(interaction);
    if (interaction.customId === 'hunter:apply') return start(interaction);

    const [, , op, id, extra] = interaction.customId.split(':');
    if (op === 'ddsanswer' || op === 'ddssave') {
        if (!isCouncil(interaction.member)) throw fail('Seul le Conseil répond aux DDS.');
        if (op === 'ddssave') return answerDds(interaction, id);
        return interaction.showModal(new ModalBuilder().setCustomId('hunter:rec:ddssave:' + id).setTitle('Réponse du Conseil').addComponents(
            row(new TextInputBuilder().setCustomId('answer').setLabel('Sanctions / éléments à transmettre').setStyle(TextInputStyle.Paragraph).setMaxLength(900))
        ));
    }

    if (!isRecruiter(interaction.member)) throw fail('Réservé aux Examinateurs et au staff.');
    if (op === 'questions') {
        return interaction.reply({ embeds: [ui.card(cfg.colors.nen).setTitle('🎙️ Guide d’entretien')
            .setDescription(cfg.interviewGuide.map((q, n) => `**${n + 1}.** ${q}`).join('\n'))], ephemeral: true });
    }
    if (['oralaccept', 'oralrefuse', 'wait', 'bring', 'cr', 'view'].includes(op)) return choose(interaction, op);
    if (op === 'select') return onSelect(interaction, id);

    const app = appByCase(id);
    if (!app) throw fail('Dossier introuvable ou remplacé.');
    switch (op) {
        case 'written': return confirm(interaction, app, 'written' + extra);
        case 'confirm': return decide(interaction, app, extra);
        case 'crsave': return saveReport(interaction, app);
        case 'dds': return requestDds(interaction, app);
        case 'ticket': return openTicket(interaction, app);
    }
}

async function handle(interaction) {
    try {
        return await route(interaction);
    } catch (error) {
        if (!error.userFacing) throw error;
        const reply = { content: error.message, ephemeral: true };
        return interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply);
    }
}

// Un candidat qui quitte le serveur pendant l'écrit libère sa place.
function forget(userId) {
    const app = state().apps[userId];
    if (app?.status === 'in_progress') update(x => { x.apps[userId].status = 'cancelled'; });
}

module.exports = { handle, onDirectMessage, forget };
