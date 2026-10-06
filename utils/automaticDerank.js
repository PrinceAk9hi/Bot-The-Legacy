const { read, update } = require('./recruitmentData');
const { isProtectedUser } = require('./security');
const { IDENTITY } = require('../config/soulSociety');
const locks = new Set();
const exempt = member => !member || member.user.bot || member.id === '547192186547077130' ||
    member.id === member.guild.ownerId || isProtectedUser(member.id, 'derank');

async function automaticDerank(member, reason, key, stillEligible = async () => true) {
    if (member.guild.id !== IDENTITY.guildId || exempt(member) || require('./lineState').isOff()) return { skipped: true };
    const lock = `${member.guild.id}:${member.id}`;
    if (locks.has(lock)) return { busy: true };
    locks.add(lock);
    try {
        const saved = read('automaticDeranks')[key];
        // Une opération interrompue ou partielle doit être vérifiée manuellement, jamais rejouée en boucle.
        if (saved) return { recorded: true, ...saved };
        const fresh = await member.guild.members.fetch({ user: member.id, force: true });
        if (exempt(fresh) || require('./lineState').isOff() || !await stillEligible(fresh)) return { skipped: true };
        if (!fresh.roles.cache.has('1513698444588482650')) return { skipped: true };
        update('automaticDeranks', data => { data[key] = { status: 'pending', at: Date.now(), userId: member.id, reason }; });
        let result;
        try { result = await require('../commandes/derank').automatic(fresh, reason); }
        catch { result = { success: false }; }
        const status = result.success ? 'done' : 'review';
        update('automaticDeranks', data => { data[key] = { ...data[key], status, finishedAt: Date.now() }; });
        if (!result.success) {
            console.warn('Derank automatique à vérifier manuellement :', member.id, key);
            try {
                const c = await member.guild.channels.fetch('1550814768586301510');
                await c?.send({ content: `⚠️ Derank automatique de <@${member.id}> incomplet ou non confirmé. Vérification manuelle nécessaire ; aucune nouvelle tentative automatique.`, allowedMentions: { parse: [] } });
            } catch {}
        }
        return { status };
    } finally { locks.delete(lock); }
}
module.exports = { automaticDerank, exempt };
