// Bot Hunter : configuration du serveur « Association des Hunters ».
const { ChannelType: T } = require('discord.js');

const guildId = '1567255511408181341';
const botId = '1567256903485104228';

const colors = {
    hunter: 0x2E8B57, // vert licence
    gold: 0xC9A227,
    nen: 0x6C5CE7,
    alert: 0xD64545
};

// Du plus haut au plus bas. `perms` : 'admin' | 'council' | 'staff' | null.
const roles = [
    { key: 'president', name: '👑 Président de l’Association', color: 0xF1C40F, hoist: true, perms: 'admin', group: 'association' },
    { key: 'zodiac', name: '🎩 Les Douze Zodiaques', color: 0x9B59B6, hoist: true, perms: 'council', group: 'association' },
    { key: 'phantom', name: '🛡️ Chasseur Fantôme', color: 0x34495E, hoist: true, perms: 'staff', group: 'association' },
    // Recruteurs : corrigent les candidatures et font passer les entretiens.
    { key: 'examiner', name: '📋 Examinateur Hunter', color: 0x48C9B0, hoist: false, group: 'association' },
    { key: 'master', name: '🏆 Maître Hunter', color: 0xE67E22, hoist: true, group: 'grade' },
    { key: 'triple', name: '⭐⭐⭐ Hunter Triple Étoile', color: 0xF39C12, hoist: true, group: 'grade' },
    { key: 'double', name: '⭐⭐ Hunter Double Étoile', color: 0xF7DC6F, hoist: true, group: 'grade' },
    { key: 'simple', name: '⭐ Hunter Simple Étoile', color: 0xFAD7A0, hoist: true, group: 'grade' },
    { key: 'apprentice', name: '🗡️ Apprenti Hunter', color: 0x1ABC9C, hoist: true, group: 'grade' },
    { key: 'novice', name: '🌱 Novice', color: 0x58D68D, hoist: true, group: 'grade' },
    { key: 'candidate', name: '🎟️ Candidat à l’examen', color: 0x95A5A6, hoist: true, group: 'grade' },
    // Étapes du recrutement (sans permission).
    { key: 'interviewWaiting', name: '⏳ Attente entretien', color: 0xB2BABB, hoist: false, group: 'recruitment' },
    { key: 'refused', name: '🚫 Membre refusé', color: 0x6E2C00, hoist: false, group: 'recruitment' },
    // Hors famille : a accepté le règlement, voit le serveur et peut postuler.
    // Rôle créé à la main sur le serveur : le bot ne le renomme pas, il lui donne seulement « Voir les salons ».
    { key: 'visitor', id: '1567270812543750325', name: 'I Non-chasseur', external: true, group: 'community' }
];

// Tous les rôles du bot portent ce préfixe sur Discord (les messages affichent le nom sans préfixe).
const rolePrefix = 'I ';

const family = {
    name: 'l’Association des Hunters',
    pitch: 'Une famille **School RP** soudée, active en jeu comme sur Discord, où chacun gagne ses étoiles.',
    conditions: [
        'Avoir **16 ans minimum**.',
        '**4 lourdes sanctions maximum** sur School RP.',
        'Faire preuve de **maturité**.',
        'Être **actif**, en jeu comme sur le Discord.',
        'Être **respectueux** envers tout le monde.'
    ]
};

// Questionnaire écrit envoyé en MP, une question à la fois.
const applicationQuestions = [
    'Quel est ton pseudo Roblox ?',
    'Quel âge as-tu ?',
    'Combien de lourdes sanctions as-tu sur School RP ?',
    'Présente-toi en quelques lignes.',
    'Pourquoi veux-tu rejoindre l’Association des Hunters ?',
    'Quelle expérience as-tu en roleplay sur School RP ?',
    'As-tu déjà fait partie d’une famille ? Laquelle, et pourquoi l’avoir quittée ?',
    'Quelles sont tes disponibilités habituelles (jours et heures) ?',
    'Comment réagirais-tu à un désaccord avec un autre membre ?',
    'Quel engagement prends-tu envers la famille ?'
];

// Guide de l'entretien oral (bouton « Questions » du panel recruteur).
const interviewGuide = [
    'Accueil : présente-toi, explique le déroulé et la durée (10–15 min).',
    'Fais-le se présenter à l’oral : âge, pseudo Roblox, depuis quand il joue à School RP.',
    'Vérifie les conditions : 16 ans minimum, 4 lourdes sanctions maximum.',
    'Mise en situation : un membre d’une autre famille le provoque en jeu, que fait-il ?',
    'Mise en situation : il n’est pas d’accord avec une décision du staff, comment réagit-il ?',
    'Activité : combien de temps par semaine peut-il donner à la famille ?',
    'Explique la période de test (Candidat → Novice) et les attentes.',
    'Laisse-le poser ses questions, puis annonce que la décision suit.'
];

// Échelle des grades, du plus bas au plus haut.
const ladder = ['candidate', 'novice', 'apprentice', 'simple', 'double', 'triple', 'master'];
const staffKeys = ['president', 'zodiac', 'phantom'];
const councilKeys = ['president', 'zodiac'];
const recruiterKeys = [...staffKeys, 'examiner'];

// `access` : qui voit la catégorie (un salon peut avoir le sien).
// @everyone ne voit rien tant que le règlement n'est pas accepté, sauf le règlement lui-même.
//  gate      → @everyone lit (le règlement)
//  public    → I Non-chasseur et la famille lisent, personne n’écrit (hors staff)
//  visitor   → I Non-chasseur et la famille
//  candidate → à partir de Candidat (membre test de la famille)
//  member    → à partir de Novice (membre de la famille)
//  recruiter → staff + Examinateurs
//  staff     → Chasseur Fantôme et au-dessus
//  council   → Zodiaques et Président
// `waiting` sur un salon : ce que voit le rôle Attente entretien ('write' | 'see').
const categories = [
    { key: 'hall', name: '🔔 ➜ Espace Informations', access: 'public' },
    { key: 'square', name: '🌍 ➜ Place Publique', access: 'visitor' },
    { key: 'board', name: '🧑‍💼 ➜ Attente Convocation', access: 'visitor' },
    { key: 'exam', name: '🌿 ➜ Zone d’Examen', access: 'candidate' },
    { key: 'guild', name: '🃏 ➜ La Guilde', access: 'member' },
    { key: 'vocals', name: '🔊 ➜ Vocaux', access: 'visitor' },
    { key: 'voice', name: '🏹 ➜ Lieux de Chasse', access: 'member' },
    { key: 'afk', name: '💤 ➜ AFK Zone', access: 'visitor' },
    { key: 'help', name: '🎫 ➜ Assistance', access: 'public' },
    { key: 'tickets', name: '📨 ➜ Tickets Ouverts', access: 'private' },
    { key: 'recruiter', name: '📋 ➜ Espace Recruteur', access: 'recruiter' },
    { key: 'hq', name: '🛡️ ➜ Quartier Général', access: 'staff' },
    { key: 'council', name: '👑 ➜ Conseil des Zodiaques', access: 'council' }
];

const channels = [
    { key: 'charter', name: '📜・règlement', parent: 'hall', type: T.GuildText, access: 'gate' },
    { key: 'schoolNews', name: '🔔・actualité', parent: 'hall', type: T.GuildText },
    { key: 'grades', name: '⏳・informations', parent: 'hall', type: T.GuildText },
    { key: 'recruitInfo', name: '🗃️・recrutement', parent: 'hall', type: T.GuildText },
    { key: 'recruitPanel', name: '📝・candidature', parent: 'hall', type: T.GuildText },
    { key: 'boosts', name: '🔮・boosts', parent: 'hall', type: T.GuildText },
    { key: 'levels', name: '🌟・level', parent: 'hall', type: T.GuildText },
    { key: 'arrivals', name: '👥・invitations', parent: 'hall', type: T.GuildText },

    { key: 'square', name: '💬・place-publique', parent: 'square', type: T.GuildText, writable: true },
    { key: 'commands', name: '🤖・commandes', parent: 'square', type: T.GuildText, writable: true },

    { key: 'vSquare', name: '🪑・Attente convocation', parent: 'board', type: T.GuildVoice, writable: true },
    { key: 'interviewWaiting', name: '🀄・Attente entretien', parent: 'board', type: T.GuildVoice, access: 'recruiter', waiting: 'write' },

    { key: 'introductions', name: '🗺️・présentations', parent: 'exam', type: T.GuildText, writable: true },
    { key: 'examChat', name: '💬・salle-d-attente', parent: 'exam', type: T.GuildText, writable: true },

    { key: 'guide', name: '📖・guide-du-hunter', parent: 'guild', type: T.GuildText },
    { key: 'missions', name: '📣・ordres-de-mission', parent: 'guild', type: T.GuildText },
    { key: 'rpSessions', name: '🎭・sessions-rp', parent: 'guild', type: T.GuildText },
    { key: 'absences', name: '📆・absences', parent: 'guild', type: T.GuildText, writable: true },
    { key: 'tavern', name: '🍺・la-taverne', parent: 'guild', type: T.GuildText, writable: true },
    { key: 'gallery', name: '📸・galerie', parent: 'guild', type: T.GuildText, writable: true },
    { key: 'hunt', name: '🎯・recherche-de-partenaires', parent: 'guild', type: T.GuildText, writable: true },

    ...['¹', '²', '³', '⁴', '⁵'].map((n, i) => ({ key: 'vocal' + (i + 1), name: '▸ Vocal ' + n, parent: 'vocals', type: T.GuildVoice, writable: true })),

    { key: 'vArena', name: '🥊・Arène Céleste', parent: 'voice', type: T.GuildVoice, writable: true },
    { key: 'vAirship', name: '🎈・Le Dirigeable', parent: 'voice', type: T.GuildVoice, writable: true },
    { key: 'vIsland', name: '🐋・Île de la Baleine', parent: 'voice', type: T.GuildVoice, writable: true },
    { key: 'vForest', name: '🌲・Forêt de Numere', parent: 'voice', type: T.GuildVoice, writable: true },

    { key: 'vAfk', name: '💤・AFK', parent: 'afk', type: T.GuildVoice, writable: true },
    { key: 'vAfk2', name: '💤・AFK', parent: 'afk', type: T.GuildVoice, writable: true },
    { key: 'vAfk3', name: '💤・AFK', parent: 'afk', type: T.GuildVoice, writable: true },

    { key: 'ticketPanel', name: '🎫・ouvrir-un-ticket', parent: 'help', type: T.GuildText },

    { key: 'interviewPanel', name: '🖥️・panel-entretien', parent: 'recruiter', type: T.GuildText },
    { key: 'applications', name: '📋・cd-en-attente', parent: 'recruiter', type: T.GuildText },
    { key: 'recruitChat', name: '🖋️・discu-recrutement', parent: 'recruiter', type: T.GuildText, writable: true },
    { key: 'reports', name: '📄・comptes-rendus', parent: 'recruiter', type: T.GuildText },
    { key: 'availability', name: '🔎・disponibilités', parent: 'recruiter', type: T.GuildText, writable: true, waiting: 'write' },
    ...[1, 2, 3, 4, 5].map(n => ({ key: 'office' + n, name: `🔐・Bureau Entretien 0${n}`, parent: 'recruiter', type: T.GuildVoice, writable: true, waiting: 'see' })),

    { key: 'hqChat', name: '💬・quartier-général', parent: 'hq', type: T.GuildText, writable: true },
    { key: 'hqGrades', name: '📈・suivi-des-grades', parent: 'hq', type: T.GuildText, writable: true },
    { key: 'ticketLogs', name: '🗃️・archives-tickets', parent: 'hq', type: T.GuildText },
    { key: 'serverLogs', name: '📋・journal-du-serveur', parent: 'hq', type: T.GuildText },
    { key: 'hqVoice', name: '🔊・Salle de briefing', parent: 'hq', type: T.GuildVoice, writable: true },

    { key: 'councilChat', name: '💬・conseil', parent: 'council', type: T.GuildText, writable: true },
    { key: 'foundationRequests', name: '📥・requêtes-dds', parent: 'council', type: T.GuildText },
    { key: 'councilVoice', name: '🔊・Table des Zodiaques', parent: 'council', type: T.GuildVoice, writable: true }
];

const officeKeys = [1, 2, 3, 4, 5].map(n => 'office' + n);

// Types de tickets. `staff: 'council'` → seuls Président et Zodiaques voient le ticket.
const ticketTypes = [
    { key: 'help', label: 'Questions & aide', emoji: '❓', description: 'Une question, un souci, besoin d’un coup de main.', staff: 'staff', color: colors.hunter },
    { key: 'events', label: 'Animations', emoji: '🎉', description: 'Proposer ou organiser une animation, un event.', staff: 'staff', color: colors.gold },
    { key: 'report', label: 'Report', emoji: '🚨', description: 'Signaler un membre ou un comportement.', staff: 'staff', color: colors.alert },
    { key: 'foundation', label: 'Contacter la Fondation', emoji: '👑', description: 'Parler directement au Président et aux Zodiaques.', staff: 'council', color: colors.nen }
];

module.exports = {
    guildId, botId, colors, roles, rolePrefix, family, applicationQuestions, interviewGuide, ladder, staffKeys, councilKeys, recruiterKeys,
    categories, channels, officeKeys, ticketTypes
};
