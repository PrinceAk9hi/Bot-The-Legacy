const { Events } = require('discord.js');
const { IDENTITY, CHANNELS } = require('../config/soulSociety');
const { read, update } = require('../utils/recruitmentData');
const { isOff } = require('../utils/lineState');
const gate = require('../utils/securityGate');
const VOICE = '1545907730332786788', ROLE = '1557497846943584326';
const RESTRICTED = new Set(['1506015762333307132', '1506015725104402542']);
const ALLOWED = new Set(['1497659584415006780', '1550234646711631884']);
function register(client) {
    if (client.accessControls) return;
    const locks = new Map();
    function serial(key, fn) {
        const next = (locks.get(key) || Promise.resolve()).catch(() => {}).then(fn);
        locks.set(key, next);
        next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
        return next;
    }
    async function voice(member) {
        if (member.guild.id !== IDENTITY.guildId || member.user.bot || isOff()) return;
        if (member.voice.channelId === VOICE) {
            if (!member.roles.cache.has(ROLE)) await member.roles.add(ROLE, 'Présence dans le vocal dédié');
        } else if (member.roles.cache.has(ROLE)) await member.roles.remove(ROLE, 'Sortie du vocal dédié');
    }
    async function message(m) {
        if (m.guildId !== IDENTITY.guildId || !RESTRICTED.has(m.channelId) || ALLOWED.has(m.author.id) || isOff()) return;
        // Même les commandes ne constituent pas une autorisation d'écrire dans ces salons.
        await m.delete().catch(() => {});
        if (m.author.bot || m.webhookId) return;
        await serial('message:' + m.author.id, async () => {
            const member = await m.guild.members.fetch({ user: m.author.id, force: true });
            if (gate.exempt(member)) return;
            const key = `${m.guildId}:${m.author.id}`;
            let count;
            update('restrictedChannelStrikes', data => {
                const old = data[key] || {};
                count = Math.min(4, (old.count || 0) + 1);
                data[key] = { count, lastAt: Date.now(), channelId: m.channelId };
            });
            if (count === 1) {
                const notice = await m.channel.send({ content: `<@${member.id}>, merci de ne plus écrire dans ce salon. Une récidive entraînera un timeout d’une minute, puis de cinq minutes, puis une exclusion temporaire d’une heure.`, allowedMentions: { parse: [], users: [member.id] } });
                setTimeout(() => notice.delete().catch(() => {}), 8000).unref();
            } else if (count < 4) {
                if (!member.moderatable) throw Error('Hiérarchie ou permissions insuffisantes pour le timeout');
                await member.timeout((count === 2 ? 1 : 5) * 60000, 'Écriture répétée dans un salon interdit');
            } else {
                if (!member.bannable) throw Error('Hiérarchie ou permissions insuffisantes pour le bannissement');
                await gate.temporaryBan(member);
            }
            await gate.log(m.guild, '🔒 Salon réservé', member, `Salon : <#${m.channelId}>\nInfraction ${count} : ${['', 'avertissement', 'timeout 1 minute', 'timeout 5 minutes', 'bannissement 1 heure'][count]}.`, CHANNELS.logs);
        });
    }
    let running = false;
    async function reconcile() {
        if (running || isOff()) return;
        running = true;
        try {
            await gate.sweep(client);
            const guild = client.guilds.cache.get(IDENTITY.guildId);
            if (!guild) return;
            const role = await guild.roles.fetch(ROLE);
            const channel = guild.channels.cache.get(VOICE);
            const ids = new Set([...(role?.members.keys() || []), ...(channel?.members?.keys() || [])]);
            for (const id of ids) {
                const member = guild.members.cache.get(id);
                if (member) await serial('voice:' + id, () => voice(member));
            }
        } finally { running = false; }
    }
    client.on(Events.VoiceStateUpdate, (before, after) => {
        if (before.channelId !== VOICE && after.channelId !== VOICE) return;
        serial('voice:' + after.id, () => voice(after.member)).catch(e => console.warn('Rôle vocal :', e.code || e.message));
    });
    client.on(Events.MessageCreate, m => message(m).catch(async e => {
        console.warn('Salon réservé :', e.code || e.message);
        if (m.member) await gate.log(m.guild, '⚠️ Sanction de salon non confirmée', m.member, 'Vérifier les permissions et la hiérarchie du bot.', CHANNELS.logs);
    }));
    client.accessControls = { reconcile, syncVoice: member => serial('voice:' + member.id, () => voice(member)) };
    const start = () => { reconcile().catch(console.warn); setInterval(() => reconcile().catch(console.warn), 60000).unref(); };
    if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}
module.exports = register;
