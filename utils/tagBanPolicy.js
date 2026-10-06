const { read, update } = require('./recruitmentData');
const { exempt } = require('./automaticDerank');
const { IDENTITY } = require('../config/soulSociety');
const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const SOURCE_GUILD = '1477314986463199385';
const DURATION = 14 * 24 * 3600000;
const active = new Set();
function save(key, value) { update('temporaryTagBans', data => { data[key] = value; }); }
async function logBan(guild, key, state) {
    if (state.loggedAt) return state;
    try {
        const channel = await guild.channels.fetch('1550248050226892810');
        if (!channel?.isTextBased() || channel.guildId !== guild.id) return state;
        const message = await channel.send({ content: `<@${state.userId}>`,
            allowedMentions: { parse: [], users: [state.userId] },
            embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('⛔ Exclusion temporaire • Tag ORDR')
                .addFields(
                    { name: 'Membre', value: `<@${state.userId}>` },
                    { name: 'Nom Discord', value: escapeMarkdown(state.username || 'Non enregistré').slice(0, 1000) },
                    { name: 'ID Discord', value: state.userId },
                    { name: 'Motif', value: 'Tag du serveur ORDR (1477314986463199385).' },
                    { name: 'Fin du bannissement', value: `<t:${Math.floor(state.until / 1000)}:F> • 14 jours` })
                .setFooter({ text: 'La Soul Society • Aucun message privé envoyé' }).setTimestamp()]
        });
        state = { ...state, loggedAt: Date.now(), logMessageId: message.id };
        save(key, state);
    } catch { console.warn('Tag ORDR : log d’exclusion différé', state.userId); }
    return state;
}
async function getBan(guild, id) {
    try { return await guild.bans.fetch(id); }
    catch (error) { if (error.code === 10026) return null; throw error; }
}
async function inspect(guild, member, user) {
    if (guild.id !== IDENTITY.guildId || exempt(member) || require('./lineState').isOff()) return false;
    const tag = user?.primaryGuild;
    if (tag?.identityEnabled !== true || String(tag.identityGuildId) !== SOURCE_GUILD) return false;
    const key = `${guild.id}:${member.id}`;
    if (active.has(key)) return true;
    active.add(key);
    try {
        const old = read('temporaryTagBans')[key];
        if (old?.status === 'pending' || old?.status === 'banned' || old?.retryAt > Date.now()) return true;
        if (!member.bannable) {
            save(key, { status: 'failed', retryAt: Date.now() + 10 * 60000, userId: member.id, guildId: guild.id });
            console.warn('Tag ORDR : bannissement impossible (permissions/hiérarchie)', member.id);
            return true;
        }
        // Ne jamais récupérer à notre compte un bannissement préexistant.
        if (await getBan(guild, member.id)) return true;
        const until = Date.now() + DURATION;
        const reason = `Tag ORDR : exclusion 14 jours [tag-ban:${member.id}:${until}]`;
        const state = { status: 'pending', guildId: guild.id, userId: member.id, username: member.user.username, until, reason, createdAt: Date.now() };
        save(key, state); // Journal écrit avant l'action Discord pour résister aux redémarrages.
        try {
            await guild.bans.create(member.id, { reason, deleteMessageSeconds: 0 });
            save(key, { ...state, status: 'banned' });
            await logBan(guild, key, { ...state, status: 'banned' });
        } catch {
            // Le résultat peut être ambigu : sweep le vérifiera sans répéter le ban.
            console.warn('Tag ORDR : résultat du bannissement à vérifier', member.id);
        }
        return true;
    } finally { active.delete(key); }
}
async function sweep(client) {
    if (require('./lineState').isOff()) return;
    const guild = client.guilds.cache.get(IDENTITY.guildId);
    if (!guild) return;
    for (const [key, entry] of Object.entries(read('temporaryTagBans'))) {
        let state = entry;
        if (state.guildId !== guild.id || !['pending', 'banned'].includes(state.status) || active.has(key)) continue;
        if (state.status === 'banned' && !state.loggedAt) state = await logBan(guild, key, state);
        if (state.status === 'banned' && Date.now() < state.until) continue;
        active.add(key);
        try {
            const ban = await getBan(guild, state.userId);
            if (!ban) {
                save(key, { ...state, status: 'released', finishedAt: Date.now() });
                continue;
            }
            // Une décision manuelle ultérieure ne doit pas être annulée par ce minuteur.
            if (ban.reason !== state.reason) {
                save(key, { ...state, status: 'manual', finishedAt: Date.now() });
                continue;
            }
            if (Date.now() >= state.until) {
                await guild.bans.remove(state.userId, 'Fin de l’exclusion temporaire de 14 jours pour tag ORDR');
                save(key, { ...state, status: 'released', finishedAt: Date.now() });
            } else {
                save(key, { ...state, status: 'banned' });
                await logBan(guild, key, { ...state, status: 'banned' });
            }
        } catch { console.warn('Tag ORDR : vérification/débannissement différé', state.userId); }
        finally { active.delete(key); }
    }
}
module.exports = { inspect, sweep, SOURCE_GUILD, DURATION };
