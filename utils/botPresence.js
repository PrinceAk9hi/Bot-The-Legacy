const { read, update } = require('./recruitmentData');
const TYPES = { joue: 0, ecoute: 2, regarde: 3, participe: 5 };
const STATUS = { online: 'online', idle: 'idle', dnd: 'dnd', off: 'invisible', invisible: 'invisible' };
function configure(action, text = '') {
    if (!(action in STATUS) && !(action in TYPES) && !['effacer', 'auto'].includes(action)) throw Error('Action inconnue. Utilise =bot pour afficher l’aide.');
    if (action in TYPES && (!text.trim() || text.trim().length > 128)) throw Error('Indique un texte de 1 à 128 caractères. Exemple : =bot joue avec la Soul Society');
    if (!(action in TYPES) && text.trim()) throw Error('Cette action ne prend pas de texte. Utilise =bot pour afficher l’aide.');
    return update('botPresence', state => {
        if (action === 'auto') { for (const key of Object.keys(state)) delete state[key]; return; }
        state.enabled = true;
        state.status ||= 'online';
        state.activities ||= [{ name: 'La Soul Society', type: 0 }];
        if (action in STATUS) state.status = STATUS[action];
        if (action in TYPES) state.activities = [{ name: text.trim(), type: TYPES[action] }];
        if (action === 'effacer') state.activities = [];
        state.updatedAt = Date.now();
    });
}
function apply(client) {
    const state = read('botPresence');
    if (!state.enabled || !client.user) return false;
    if (!['online', 'idle', 'dnd', 'invisible'].includes(state.status) || !Array.isArray(state.activities)) throw Error('Configuration de présence invalide.');
    client.user.setPresence({ status: state.status, activities: state.activities.map(a => ({ name: String(a.name).slice(0, 128), type: a.type })) });
    return true;
}
module.exports = { configure, apply };
