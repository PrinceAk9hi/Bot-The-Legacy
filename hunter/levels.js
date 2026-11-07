// Niveaux : 15 à 25 XP par message, au plus une fois par minute.
const cfg = require('./config');
const store = require('./store');
const ui = require('./ui');

const COOLDOWN = 60000;
const need = level => 5 * level * level + 50 * level + 100; // XP pour passer au niveau suivant

let cache = null;
const data = () => (cache ||= store.read('levels', {}));
let saveTimer = null;
const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.write('levels', data()), 5000);
};

function stats(userId) {
    return data()[userId] || { xp: 0, level: 0, total: 0, last: 0 };
}

async function onMessage(message) {
    const entry = stats(message.author.id);
    if (Date.now() - entry.last < COOLDOWN) return;
    const gain = 15 + Math.floor(Math.random() * 11);
    entry.xp += gain;
    entry.total += gain;
    entry.last = Date.now();
    let up = false;
    while (entry.xp >= need(entry.level)) {
        entry.xp -= need(entry.level);
        entry.level++;
        up = true;
    }
    data()[message.author.id] = entry;
    save();
    if (!up) return;
    const channel = message.guild.channels.cache.get(store.read('server', { channels: {} }).channels.levels);
    channel?.send({
        content: `${message.author}`,
        embeds: [ui.card(cfg.colors.gold).setDescription(`🌟 ${message.author} passe **niveau ${entry.level}** ! Son Nen se renforce.`)],
        allowedMentions: { users: [message.author.id] }
    });
}

function rankOf(userId) {
    const sorted = Object.entries(data()).sort(([, a], [, b]) => b.total - a.total);
    return sorted.findIndex(([id]) => id === userId) + 1;
}

function bar(xp, max) {
    const filled = Math.round((xp / max) * 12);
    return '▰'.repeat(filled) + '▱'.repeat(12 - filled);
}

function card(member) {
    const entry = stats(member.id);
    const max = need(entry.level);
    return {
        embeds: [ui.card(cfg.colors.gold).setTitle('🌟 Niveau').setThumbnail(member.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'Membre', value: `${member}`, inline: true },
                { name: 'Niveau', value: String(entry.level), inline: true },
                { name: 'Rang', value: entry.total ? `#${rankOf(member.id)}` : '—', inline: true },
                { name: 'Progression', value: `${bar(entry.xp, max)}  ${entry.xp}/${max} XP` }
            )],
        allowedMentions: { parse: [] }
    };
}

function leaderboard() {
    const top = Object.entries(data()).sort(([, a], [, b]) => b.total - a.total).slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    return {
        embeds: [ui.card(cfg.colors.gold).setTitle('🏆 Classement des Hunters')
            .setDescription(top.length ? top.map(([id, e], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> — niveau ${e.level} (${e.total} XP)`).join('\n') : 'Personne n’a encore d’XP.')],
        allowedMentions: { parse: [] }
    };
}

function flush() {
    if (cache) store.write('levels', cache);
}

module.exports = { onMessage, card, leaderboard, flush };
