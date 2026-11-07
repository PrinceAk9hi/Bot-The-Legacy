// Installation (et réparation) du serveur : rôles, catégories, salons, messages fixes.
// Relançable sans risque : on retrouve ce qui existe déjà par id puis par nom.
const { PermissionFlagsBits: P, ChannelType: T } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');

const rolePerms = {
    admin: [P.Administrator],
    council: [P.ManageGuild, P.ManageRoles, P.ManageChannels, P.ManageMessages, P.ManageNicknames, P.KickMembers, P.BanMembers,
        P.ModerateMembers, P.MoveMembers, P.MuteMembers, P.DeafenMembers, P.ViewAuditLog, P.MentionEveryone],
    staff: [P.ManageMessages, P.ManageNicknames, P.KickMembers, P.ModerateMembers, P.MoveMembers, P.MuteMembers, P.ViewAuditLog]
};

const READ = [P.ViewChannel, P.ReadMessageHistory, P.Connect];
const WRITE = [...READ, P.SendMessages, P.SendMessagesInThreads, P.AddReactions, P.AttachFiles, P.EmbedLinks, P.UseExternalEmojis, P.Speak, P.Stream, P.UseVAD];
const BOT = [...WRITE, P.ManageChannels, P.ManageRoles, P.ManageMessages, P.MoveMembers];

function audience(access) {
    switch (access) {
        case 'public':
        case 'visitor': return ['visitor', 'examiner', ...cfg.ladder];
        case 'candidate': return cfg.ladder;
        case 'member': return cfg.ladder.filter(k => k !== 'candidate');
        default: return [];
    }
}

function staffFor(access) {
    if (access === 'council') return cfg.councilKeys;
    if (access === 'recruiter') return cfg.recruiterKeys;
    return cfg.staffKeys;
}

// `waiting` : accès du rôle Attente entretien ('write' = participe, 'see' = voit sans pouvoir entrer).
function overwrites(guild, botId, ids, access, writable, waiting) {
    // @everyone ne voit que le règlement ; tout le reste s'ouvre avec I Non-chasseur (ou un rôle de la famille).
    const list = [{ id: guild.id, ...(access === 'gate' ? { allow: READ, deny: [P.SendMessages, P.Speak] } : { deny: [P.ViewChannel] }) }];
    if (access === 'public') writable = false;
    list.push({ id: botId, allow: BOT });
    for (const key of audience(access) || []) list.push({ id: ids.roles[key], allow: writable ? WRITE : READ, deny: writable ? [] : [P.SendMessages] });
    for (const key of staffFor(access)) list.push({ id: ids.roles[key], allow: access === 'recruiter' ? [...WRITE, P.MoveMembers] : WRITE });
    if (waiting === 'write') list.push({ id: ids.roles.interviewWaiting, allow: WRITE });
    if (waiting === 'see') list.push({ id: ids.roles.interviewWaiting, allow: [P.ViewChannel], deny: [P.Connect] });
    return list;
}

async function ensureRoles(guild, ids, report) {
    // @everyone perd « Voir les salons » ; I Non-chasseur le reçoit.
    const everyone = guild.roles.everyone;
    if (everyone.permissions.has(P.ViewChannel)) await everyone.setPermissions(everyone.permissions.remove(P.ViewChannel), 'Accès après acceptation du règlement');

    for (const def of cfg.roles) {
        if (def.external) {
            const role = guild.roles.cache.get(def.id);
            if (!role) throw new Error(`Rôle ${def.name} (${def.id}) introuvable sur le serveur.`);
            if (!role.permissions.has(P.ViewChannel)) await role.setPermissions(role.permissions.add(P.ViewChannel), 'Accès après acceptation du règlement');
            ids.roles[def.key] = role.id;
            continue;
        }
        const name = cfg.rolePrefix + def.name;
        let role = guild.roles.cache.get(ids.roles[def.key]) || guild.roles.cache.find(r => r.name === name || r.name === def.name);
        const data = { name, colors: { primaryColor: def.color }, hoist: def.hoist, permissions: def.perms ? rolePerms[def.perms] : [], mentionable: def.group === 'association' };
        if (role) {
            await role.edit(data);
        } else {
            role = await guild.roles.create({ ...data, reason: 'Installation Association des Hunters' });
            report.push('Rôle créé : ' + def.name);
        }
        ids.roles[def.key] = role.id;
    }

    // Ordre : Président tout en haut… Candidat tout en bas. Les rôles créés d’affilée sont déjà
    // dans cet ordre ; on ne réordonne que si quelqu’un les a déplacés.
    const ordered = async () => {
        await guild.roles.fetch();
        const current = cfg.roles.map(def => guild.roles.cache.get(ids.roles[def.key]).position);
        return current.every((pos, i) => i === 0 || pos < current[i - 1]);
    };
    if (!await ordered()) {
        const top = guild.members.me.roles.highest.position;
        const positions = cfg.roles.map((def, i) => ({ role: ids.roles[def.key], position: top - 1 - i }));
        // Positions éventuellement négatives : Discord renumérote ensuite tous les rôles.
        await guild.roles.setPositions(positions).catch(() => null);
        if (!await ordered()) {
            const top2 = guild.members.me.roles.highest.position;
            await guild.roles.setPositions(cfg.roles.map((def, i) => ({ role: ids.roles[def.key], position: top2 - 1 - i }))).catch(() => null);
        }
        if (!await ordered()) report.push('⚠️ Grades pas encore hiérarchisés : dans Paramètres → Rôles, glisse le rôle du bot tout en haut puis relance /setup.');
    }
}

async function ensureChannel(guild, ids, def, parentId, permissionOverwrites, report, bucket) {
    // Par nom, on ignore les salons déjà rattachés à une autre clé (ex. les trois « 💤・AFK »).
    const claimed = new Set(Object.entries(ids[bucket]).filter(([key]) => key !== def.key).map(([, id]) => id));
    let channel = guild.channels.cache.get(ids[bucket][def.key])
        || guild.channels.cache.find(c => !claimed.has(c.id) && c.name === def.name && c.type === def.type && (c.parentId || null) === (parentId || null));
    if (channel) {
        // Le nom n'est pas réimposé : un salon renommé à la main garde son nom.
        await channel.edit({ parent: parentId, permissionOverwrites });
    } else {
        channel = await guild.channels.create({ name: def.name, type: def.type, parent: parentId, permissionOverwrites, reason: 'Installation Association des Hunters' });
        report.push((def.type === T.GuildCategory ? 'Catégorie' : 'Salon') + ' créé : ' + def.name);
    }
    ids[bucket][def.key] = channel.id;
    return channel;
}

async function ensureMessage(channel, ids, key, payload) {
    const old = ids.messages[key] && await channel.messages.fetch(ids.messages[key]).catch(() => null);
    const message = old ? await old.edit(payload) : await channel.send(payload);
    ids.messages[key] = message.id;
}

async function run(guild) {
    const ids = store.read('server', { roles: {}, categories: {}, channels: {}, messages: {} });
    const report = [];
    // Salons retirés de la config (supprimés à la main) : on oublie leur id pour ne pas les recréer.
    for (const key of Object.keys(ids.channels)) if (!cfg.channels.some(c => c.key === key)) delete ids.channels[key];
    for (const key of Object.keys(ids.categories)) if (!cfg.categories.some(c => c.key === key)) delete ids.categories[key];
    await guild.roles.fetch();
    await guild.channels.fetch();

    await ensureRoles(guild, ids, report);

    const botId = guild.members.me.id;
    for (const [i, cat] of cfg.categories.entries()) {
        const def = { key: cat.key, name: cat.name, type: T.GuildCategory };
        const channel = await ensureChannel(guild, ids, def, null, overwrites(guild, botId, ids, cat.access, false), report, 'categories');
        await channel.setPosition(i).catch(() => null);
    }

    for (const def of cfg.channels) {
        const cat = cfg.categories.find(c => c.key === def.parent);
        await ensureChannel(guild, ids, def, ids.categories[def.parent], overwrites(guild, botId, ids, def.access || cat.access, def.writable, def.waiting), report, 'channels');
    }
    await guild.setAFKChannel(ids.channels.vAfk).catch(() => null);

    // Salons créés à la main (ex. médias, suggestions) : alignés sur leur catégorie, donc cachés à @everyone eux aussi.
    const managed = new Set([...Object.values(ids.channels), ...Object.values(ids.categories)]);
    for (const channel of guild.channels.cache.values()) {
        if (managed.has(channel.id) || channel.type === T.GuildCategory || /^(candidat-|.*・(help|events|report|foundation)-)/.test(channel.name)) continue;
        if (channel.parentId && managed.has(channel.parentId)) await channel.lockPermissions().catch(() => null);
        else await channel.permissionOverwrites.edit(guild.id, { ViewChannel: false }).catch(() => null);
    }

    // Ancien rôle Voyageur, remplacé par I Non-chasseur.
    const oldVisitor = guild.roles.cache.find(r => r.name === '🧭 Voyageur' && r.id !== ids.roles.visitor);
    if (oldVisitor && oldVisitor.members.size === 0) await oldVisitor.delete('Remplacé par I Non-chasseur').then(() => report.push('Rôle supprimé : 🧭 Voyageur (remplacé par I Non-chasseur)'));

    // Remet les salons dans l'ordre de la config (utile quand un salon change de catégorie).
    await guild.channels.setPositions(cfg.channels.map((def, i) => ({ channel: ids.channels[def.key], position: i }))).catch(() => null);

    const get = key => guild.channels.cache.get(ids.channels[key]);
    await ensureMessage(get('charter'), ids, 'charter', ui.charter());
    await ensureMessage(get('grades'), ids, 'grades', ui.gradesInfo(ids));
    await ensureMessage(get('ticketPanel'), ids, 'ticketPanel', ui.ticketPanel());
    await ensureMessage(get('recruitPanel'), ids, 'recruitPanel', ui.recruitPanel(store.read('recruitment', { open: true }).open));
    await ensureMessage(get('recruitInfo'), ids, 'recruitInfo', ui.recruitInfo(ids));
    await ensureMessage(get('interviewPanel'), ids, 'interviewPanel', ui.interviewPanel());
    await ensureMessage(get('boosts'), ids, 'boosts', ui.boostsInfo());
    await ensureMessage(get('levels'), ids, 'levels', ui.levelsInfo());
    await ensureMessage(get('guide'), ids, 'guide', ui.guide(ids));

    store.write('server', ids);
    return report;
}

module.exports = { run };
