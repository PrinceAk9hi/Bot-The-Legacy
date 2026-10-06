// Libère uniquement les contrôles du serveur courant, y compris les verrous de =test.
function release(client, guildId, action, targetId = null) {
    const result = { leashes: 0, cuffs: 0, tests: 0 };
    const matches = (id, state) => state?.guildId === guildId && (!targetId || id === targetId);
    if (action === 'uch' || action === 'all') {
        for (const [id, state] of client.chiens || []) {
            if (matches(id, state)) { client.chiens.delete(id); result.leashes++; }
        }
    }
    if (action === 'unmenotte' || action === 'all') {
        for (const [id, state] of client.menottes || []) {
            if (matches(id, state)) { client.menottes.delete(id); result.cuffs++; }
        }
        const session = client.testVoiceSessions?.get(guildId);
        if (session && (!targetId || session.targetId === targetId)) {
            if (session.testMenotteCreated || session.lockedChannelId) result.tests++;
            session.testMenotteCreated = false;
            session.lockedChannelId = null;
        }
    }
    const { saveControlStates } = require('./controlStates');
    result.saved = saveControlStates(client);
    return result;
}
module.exports = { release };
