const { normalize } = require('./ticketAiPolicy');

const COMMAND_SYNONYMS = {
    'mon-profil': ['modifier mon profil', 'changer mes informations', 'changer mes infos', 'disponibilites vocales', 'mes informations personnelles', 'date anniversaire', 'pseudo discord'],
    bienvenue: ['accueil', 'verifier mon compte', 'verifier adhesion roblox', 'lier mon compte roblox', 'profil de nouveau membre'],
    candidature: ['postuler', 'candidater', 'rejoindre la famille', 'questionnaire recrutement'],
    entretien: ['entretien oral', 'panel entretien', 'bureau entretien'],
    carte: ['carte membre', 'grade membre', 'profil public'],
    'ticket-ia': ['base de connaissances ia', 'corriger reponse ia', 'lacune assistant tickets'],
    update: ['recharger commande', 'actualiser commande bot']
};

const STOP = new Set('avec dans pour une des les est aux qui que quoi comment quand quel quelle quels quelles mais par sur cette sont plus pas nous vous mon ma mes ton ta tes cela alors donc c est ce se du de la le un en au et ou si faire peux peut'.split(' '));
function tokens(value) {
    return normalize(value).split(/[^a-z0-9]+/).filter(token => token.length > 2 && !STOP.has(token));
}

function flattenOptions(options = [], path = []) {
    const lines = [];
    for (const option of options) {
        if (Array.isArray(option.options) && option.options.length) {
            lines.push(...flattenOptions(option.options, [...path, option.name]));
        } else {
            const choices = (option.choices || []).map(choice => choice.name || choice.value).join(', ');
            lines.push(`${[...path, option.name].join(' ')}: ${option.description || ''}${choices ? ` (choix: ${choices})` : ''}`.trim());
        }
    }
    return lines;
}

function describeCommand(name, command) {
    let data;
    try { data = command?.data?.toJSON?.() || command?.data; } catch { return null; }
    if (!data?.name || typeof command?.execute !== 'function') return null;
    const options = flattenOptions(data.options || []);
    const synonyms = COMMAND_SYNONYMS[data.name] || [];
    return {
        name: data.name,
        description: String(data.description || ''),
        details: options,
        synonyms,
        searchable: `${data.name} ${data.description || ''} ${options.join(' ')} ${synonyms.join(' ')}`
    };
}

function scoreCommand(command, query) {
    const queryTokens = new Set(tokens(query));
    if (!queryTokens.size) return 0;
    const nameTokens = new Set(tokens(command.name));
    const descriptionTokens = new Set(tokens(command.description));
    const detailTokens = new Set(tokens(command.details.join(' ')));
    const synonymTokens = new Set(tokens(command.synonyms.join(' ')));
    let score = 0;
    for (const token of queryTokens) {
        if (nameTokens.has(token)) score += 6;
        if (synonymTokens.has(token)) score += 4;
        if (descriptionTokens.has(token)) score += 2;
        if (detailTokens.has(token)) score += 1;
    }
    return score;
}

function accessibleCommands(commands, subject, canUseCommand) {
    const entries = commands instanceof Map || typeof commands?.values === 'function'
        ? [...commands.entries()]
        : Object.entries(commands || {});
    return entries.map(([name, command]) => {
        try {
            if (!canUseCommand(subject, name)) return null;
            return describeCommand(name, command);
        } catch { return null; }
    }).filter(Boolean);
}

function findRelevantCommands(commands, query, limit = 6) {
    return commands.map(command => ({ ...command, score: scoreCommand(command, query) }))
        .filter(command => command.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, limit);
}

function formatCommandContext(commands) {
    if (!commands.length) return '';
    const slashCommands = new Set(['rank', 'mrankup', 'sound', 'stopsound']);
    return commands.map(command => `${slashCommands.has(command.name) ? '/' : '='}${command.name} — ${command.description}${command.details.length ? `; paramètres réels : ${command.details.join(' ; ')}` : ''}`).join('\n').slice(0, 5000);
}

module.exports = { COMMAND_SYNONYMS, flattenOptions, describeCommand, accessibleCommands, scoreCommand, findRelevantCommands, formatCommandContext };
