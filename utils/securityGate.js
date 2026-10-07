const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const { IDENTITY, CHANNELS } = require('../config/soulSociety');
const { isProtectedUser } = require('./security');
const { read, update } = require('./recruitmentData');
const VERIFY_LOG = '1468702405263757395';
const ORDR = '1477314986463199385';
const exempt = m => m.id === '547192186547077130' || m.id === m.guild.ownerId || isProtectedUser(m.id);
async function log(guild, title, member, detail, channelId = VERIFY_LOG) {
    try {
        const channel = await guild.channels.fetch(channelId);
        if (!channel?.isTextBased() || channel.guildId !== guild.id) return;
        await channel.send({ allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(0xf8bbd0)
            .setTitle(title).setDescription(`<@${member.id}> • ${escapeMarkdown(member.user.username)}\nID : ${member.id}\n\n${detail}`.slice(0, 4096)).setTimestamp()] });
    } catch { console.warn('Log sécurité non envoyé :', channelId, member.id); }
}
async function check(member, checkTag = true) {
    if (exempt(member)) return true;
    // Une donnée indisponible ne doit jamais déclencher une exclusion.
    const user = await member.user.fetch({ force: true });
    if (!Number.isFinite(user.createdTimestamp)) throw Error('Date de création Discord indisponible. Réessaie plus tard.');
    const young = Date.now() - user.createdTimestamp < 45 * 86400000;
    const ordr = checkTag && user.primaryGuild?.identityEnabled === true && String(user.primaryGuild.identityGuildId) === ORDR;
    if (!young && !ordr) return true;
    if (!member.kickable) {
        await log(member.guild, '⚠️ Vérification refusée — exclusion impossible', member, 'Vérifier la hiérarchie et la permission Expulser des membres.');
        return false;
    }
    await member.kick(young ? 'Vérification : compte Discord de moins de 45 jours' : 'Vérification : tag ORDR');
    await user.send({ content: 'Ta demande d’accès à la Soul Society n’a pas pu être validée. Tu as été retiré du serveur.', allowedMentions: { parse: [] } }).catch(() => {});
    await log(member.guild, '⛔ Exclusion lors de la vérification', member, young ? 'Compte Discord de moins de 45 jours.' : 'Tag ORDR détecté.');
    return false;
}
async function temporaryBan(member) {
    const key = `${member.guild.id}:${member.id}`, previous = read('restrictedChannelBans')[key];
    if (previous && ['pending', 'banned'].includes(previous.status)) return;
    const until = Date.now() + 3600000;
    const reason = `Écriture répétée en salon interdit [channel-ban:${member.id}:${until}]`;
    update('restrictedChannelBans', data => { data[key] = { guildId: member.guild.id, userId: member.id, until, reason, status: 'pending' }; });
    await member.guild.bans.create(member.id, { reason, deleteMessageSeconds: 0 });
    update('restrictedChannelBans', data => { data[key].status = 'banned'; });
}
async function sweep(client) {
    const guild = client.guilds.cache.get(IDENTITY.guildId);
    if (!guild) return;
    for (const [key, state] of Object.entries(read('restrictedChannelBans'))) {
        if (state.guildId !== guild.id || !['pending', 'banned'].includes(state.status)) continue;
        if (state.status === 'banned' && state.until > Date.now()) continue;
        try {
            const ban = await guild.bans.fetch(state.userId).catch(e => { if (e.code === 10026) return null; throw e; });
            let status = state.status;
            if (!ban) status = 'released';
            else if (ban.reason !== state.reason) status = 'manual';
            else if (Date.now() >= state.until) {
                await guild.bans.remove(state.userId, 'Fin du bannissement temporaire d’une heure');
                status = 'released';
            } else status = 'banned';
            update('restrictedChannelBans', data => { data[key].status = status; });
        } catch { console.warn('Débannissement salon différé :', state.userId); }
    }
}
module.exports = { check, log, exempt, temporaryBan, sweep, VERIFY_LOG };
