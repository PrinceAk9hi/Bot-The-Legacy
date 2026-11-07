// Suivi des invitations : on compare les compteurs d'utilisation avant/après chaque arrivée.
const store = require('./store');

const uses = new Map(); // code → { uses, inviterId }

async function load(guild) {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    uses.clear();
    invites.forEach(i => uses.set(i.code, { uses: i.uses, inviterId: i.inviterId }));
}

function remember(invite) {
    uses.set(invite.code, { uses: invite.uses || 0, inviterId: invite.inviterId });
}

function drop(invite) {
    uses.delete(invite.code);
}

// Retourne { inviterId, uses } / { vanity: true } / null.
async function resolve(member) {
    const before = new Map(uses);
    await load(member.guild);
    let used = null;
    for (const [code, now] of uses) {
        if (now.uses > (before.get(code)?.uses ?? 0)) used = now;
    }
    if (!used) return member.guild.vanityURLCode ? { vanity: true } : null;
    if (!used.inviterId) return null;

    const counts = store.read('invites', {});
    counts[used.inviterId] = (counts[used.inviterId] || 0) + 1;
    store.write('invites', counts);
    const joins = store.read('inviteJoins', {});
    joins[member.id] = used.inviterId;
    store.write('inviteJoins', joins);
    return { inviterId: used.inviterId, uses: counts[used.inviterId] };
}

module.exports = { load, remember, drop, resolve };
