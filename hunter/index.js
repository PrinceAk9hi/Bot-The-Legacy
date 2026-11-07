// Bot Hunter — serveur « Association des Hunters ».
// Lancement : node hunter/index.js  (token dans hunter/.env → TOKEN=...)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client, GatewayIntentBits, Partials, Events, SlashCommandBuilder, ChannelType, PermissionFlagsBits: P } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');
const setup = require('./setup');
const tickets = require('./tickets');
const presence = require('./presence');
const recruitment = require('./recruitment');
const levels = require('./levels');
const invites = require('./invites');

// GuildMembers et MessageContent sont privilégiés : à activer dans le portail développeur
// (Server Members Intent + Message Content Intent). MessageContent sert aux tickets et aux candidatures en MP.
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildInvites],
    partials: [Partials.Channel] // nécessaire pour recevoir les MP
});

const ids = () => store.read('server', { roles: {}, categories: {}, channels: {}, messages: {} });
const gradeChoices = cfg.ladder.map(k => ({ name: ui.roleDef(k).name, value: k }));

const commands = [
    new SlashCommandBuilder().setName('setup').setDescription('Installe ou répare le serveur (rôles, salons, panels).')
        .setDefaultMemberPermissions(P.Administrator),
    new SlashCommandBuilder().setName('recrutement').setDescription('Ouvre ou ferme les candidatures de la famille.')
        .addStringOption(o => o.setName('etat').setDescription('État des candidatures').setRequired(true)
            .addChoices({ name: '🟢 Ouvert', value: 'ouvert' }, { name: '🔴 Fermé', value: 'ferme' })),
    new SlashCommandBuilder().setName('niveau').setDescription('Affiche le niveau d’un membre.')
        .addUserOption(o => o.setName('membre').setDescription('Membre (toi par défaut)')),
    new SlashCommandBuilder().setName('classement').setDescription('Top 10 des niveaux du serveur.'),
    new SlashCommandBuilder().setName('bot').setDescription('Gère le statut du bot et ce qu’il affiche.'),
    new SlashCommandBuilder().setName('licence').setDescription('Affiche la licence Hunter d’un membre.')
        .addUserOption(o => o.setName('membre').setDescription('Membre (toi par défaut)')),
    new SlashCommandBuilder().setName('promouvoir').setDescription('Fait monter un membre d’un grade.')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
    new SlashCommandBuilder().setName('retrograder').setDescription('Fait descendre un membre d’un grade.')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
    new SlashCommandBuilder().setName('grade').setDescription('Donne directement un grade à un membre.')
        .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
        .addStringOption(o => o.setName('grade').setDescription('Grade').setRequired(true).addChoices(...gradeChoices))
];

// Chasseur Fantôme : jusqu’à Apprenti Hunter. Zodiaques et Président : tous les grades.
function maxGradeFor(member) {
    const server = ids();
    const has = key => member.roles.cache.has(server.roles[key]);
    if (member.permissions.has(P.Administrator) || cfg.councilKeys.some(has)) return cfg.ladder.length - 1;
    if (has('phantom')) return cfg.ladder.indexOf('apprentice');
    return -1;
}

const currentGrade = member => {
    const server = ids();
    for (let i = cfg.ladder.length - 1; i >= 0; i--) if (member.roles.cache.has(server.roles[cfg.ladder[i]])) return i;
    return -1;
};

async function setGrade(interaction, target, index) {
    const limit = maxGradeFor(interaction.member);
    if (limit < 0) return interaction.reply({ content: 'Seule l’équipe peut gérer les grades.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: 'Tu ne peux pas modifier ton propre grade.', ephemeral: true });
    const before = currentGrade(target);
    if (index < 0 || index >= cfg.ladder.length) return interaction.reply({ content: 'Il n’y a pas de grade plus loin dans cette direction.', ephemeral: true });
    if (index > limit || before > limit) return interaction.reply({ content: `Ton rôle te permet de gérer les grades jusqu’à **${ui.roleDef(cfg.ladder[limit]).name}**.`, ephemeral: true });
    if (index === before) return interaction.reply({ content: 'Ce membre a déjà ce grade.', ephemeral: true });

    const server = ids();
    const remove = [...cfg.ladder, 'visitor'].map(k => server.roles[k]).filter(id => id && target.roles.cache.has(id));
    await target.roles.remove(remove, `Grade modifié par ${interaction.user.tag}`);
    await target.roles.add(server.roles[cfg.ladder[index]], `Grade modifié par ${interaction.user.tag}`);

    const up = index > before;
    const from = before >= 0 ? ui.roleDef(cfg.ladder[before]).name : 'Aucun';
    const to = ui.roleDef(cfg.ladder[index]).name;
    await interaction.reply({ content: `${up ? '📈' : '📉'} ${target} : ${from} → **${to}**`, allowedMentions: { parse: [] } });

    const log = interaction.guild.channels.cache.get(server.channels.hqGrades);
    log?.send({ embeds: [ui.card(up ? cfg.colors.hunter : cfg.colors.alert).setTitle(up ? '📈 Promotion' : '📉 Rétrogradation')
        .setDescription(`${target}\n${from} → **${to}**\nPar ${interaction.user}`)], allowedMentions: { parse: [] } });
    if (up) {
        const tavern = interaction.guild.channels.cache.get(server.channels.tavern);
        tavern?.send({ embeds: [ui.card(cfg.colors.gold).setTitle('🪪 Licence mise à jour !')
            .setDescription(`Félicitations ${target}, tu passes **${to}** !`).setThumbnail(target.displayAvatarURL())], allowedMentions: { parse: [] } });
    }
}

async function onCommand(interaction) {
    const target = interaction.options.getMember('membre');
    switch (interaction.commandName) {
        case 'setup': {
            await interaction.deferReply({ ephemeral: true });
            const report = await setup.run(interaction.guild);
            return interaction.editReply('✅ Serveur prêt.\n' + (report.length ? report.join('\n') : 'Rien à créer, tout a été remis à jour.').slice(0, 1900));
        }
        case 'bot':
            return presence.handle(interaction);
        case 'recrutement':
            return recruitment.handle(interaction);
        case 'niveau':
            return interaction.reply(levels.card(target || interaction.member));
        case 'classement':
            return interaction.reply(levels.leaderboard());
        case 'licence':
            return interaction.reply(ui.licence(target || interaction.member, ids()));
        case 'promouvoir':
            return setGrade(interaction, target, currentGrade(target) + 1);
        case 'retrograder':
            return setGrade(interaction, target, currentGrade(target) - 1);
        case 'grade':
            return setGrade(interaction, target, cfg.ladder.indexOf(interaction.options.getString('grade')));
    }
}

async function onAccept(interaction) {
    const server = ids();
    if (currentGrade(interaction.member) >= 0 || interaction.member.roles.cache.has(server.roles.visitor)) {
        return interaction.reply({ content: 'Tu as déjà signé la charte 🪪', ephemeral: true });
    }
    await interaction.member.roles.add(server.roles.visitor, 'Charte signée');
    await interaction.reply({ content: `✍️ Charte signée ! Te voilà **I Non-chasseur** : le serveur s’ouvre à toi. Pour rejoindre la famille, tout est expliqué dans <#${server.channels.recruitInfo}>.`, ephemeral: true });
}

client.once(Events.ClientReady, async () => {
    console.log(`Bot Hunter connecté : ${client.user.tag}`);
    presence.apply(client);
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return console.error('Le bot n’est pas sur le serveur ' + cfg.guildId);
    await guild.commands.set(commands.map(c => c.toJSON()));
    await guild.members.fetch();
    await invites.load(guild);
    if (process.argv.includes('--setup')) {
        try {
            const report = await setup.run(guild);
            console.log(report.join('\n') || 'Rien à créer.');
            console.log('Installation terminée.');
        } catch (error) {
            console.error('Installation échouée :', error);
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.guildId !== cfg.guildId) return;
    try {
        if (interaction.isChatInputCommand()) return await onCommand(interaction);
        if (interaction.customId === 'hunter:accept') return await onAccept(interaction);
        if (interaction.customId?.startsWith('hunter:ticket')) return await tickets.handle(interaction);
        if (interaction.customId?.startsWith('hunter:bot:')) return await presence.handle(interaction);
        if (interaction.customId === 'hunter:apply' || interaction.customId?.startsWith('hunter:rec:')) return await recruitment.handle(interaction);
        if (interaction.customId?.startsWith('hunter:exam')) {
            return await interaction.reply({ content: 'Ce bouton n’est plus utilisé : passe par 📝・candidature.', ephemeral: true });
        }
    } catch (error) {
        console.error(error);
        const reply = { content: 'Une erreur est survenue, réessaie ou préviens l’équipe.', ephemeral: true };
        if (interaction.deferred || interaction.replied) interaction.followUp(reply).catch(() => null);
        else interaction.reply?.(reply).catch(() => null);
    }
});

client.on(Events.GuildMemberAdd, async member => {
    if (member.guild.id !== cfg.guildId) return;
    const server = ids();
    const invite = await invites.resolve(member).catch(() => null);
    member.guild.channels.cache.get(server.channels.arrivals)?.send(ui.welcome(member, member.guild.memberCount, invite)).catch(() => null);
    member.guild.channels.cache.get(server.channels.serverLogs)?.send({ embeds: [ui.card().setDescription(`📥 ${member} (${member.user.tag}) a rejoint le serveur.`)], allowedMentions: { parse: [] } }).catch(() => null);
});

client.on(Events.GuildMemberRemove, async member => {
    if (member.guild.id !== cfg.guildId) return;
    recruitment.forget(member.id);
    member.guild.channels.cache.get(ids().channels.serverLogs)?.send({ embeds: [ui.card(cfg.colors.alert).setDescription(`📤 ${member.user.tag} a quitté le serveur.`)], allowedMentions: { parse: [] } }).catch(() => null);
});

client.on(Events.ChannelDelete, channel => tickets.forget(channel.id));

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    try {
        if (message.channel.type === ChannelType.DM) return await recruitment.onDirectMessage(message);
        if (message.guildId === cfg.guildId) await levels.onMessage(message);
    } catch (error) {
        console.error(error);
    }
});

client.on(Events.InviteCreate, invite => invite.guild?.id === cfg.guildId && invites.remember(invite));
client.on(Events.InviteDelete, invite => invite.guild?.id === cfg.guildId && invites.drop(invite));

// Nouveau boost : remerciement dans 🔮・boosts.
client.on(Events.GuildMemberUpdate, (before, after) => {
    if (after.guild.id !== cfg.guildId || before.premiumSince || !after.premiumSince) return;
    after.guild.channels.cache.get(ids().channels.boosts)?.send({
        content: `${after}`,
        embeds: [ui.card(0xF47FFF).setDescription(`🔮 Merci ${after} pour le boost ! Le serveur compte maintenant **${after.guild.premiumSubscriptionCount}** boost(s).`)],
        allowedMentions: { users: [after.id] }
    }).catch(() => null);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { levels.flush(); process.exit(0); });

if (!process.env.TOKEN) {
    console.error('Token manquant : ajoute TOKEN=... dans hunter/.env');
    process.exit(1);
}
client.login(process.env.TOKEN);
