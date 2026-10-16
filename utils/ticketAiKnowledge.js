const { randomUUID } = require('node:crypto');
const { read, update } = require('./recruitmentData');
const { MAIN_RANKS } = require('../config/ranks');

const DEFAULTS = [
    { id: 'rules', title: 'Règlement du serveur', tags: ['règles', 'respect', 'publicité', 'vocal', 'membre'], content: 'Respecte chacun et sa vie privée. Insultes, discrimination, menaces, intimidation et harcèlement sont interdits. Pas de spam, flood, arnaque, lien dangereux, contenu sexuel explicite ni violence graphique. Pas de publicité ou démarchage sans accord, y compris en MP. En vocal : pas de cris, saturation du micro ou diffusion gênante. Pour un problème ou un signalement, ouvre un ticket, donne des éléments précis et évite les accusations publiques. Les mesures dépendent de la gravité et des récidives. Les règles officielles de Discord s’appliquent. Pour recevoir le rôle Membre, réagis ✅ sous le règlement ; cette réaction ne détecte pas les doubles comptes.' },
    { id: 'admission', title: 'Admission et recrutement', tags: ['recrutement', 'candidature', 'entretien', 'bienvenue'], content: 'La candidature écrite se fait en messages privés depuis le panel et comprend 12 questions. Après une acceptation écrite, le candidat reçoit le rôle Âme en attente et l’équipe lui demande ses disponibilités pour un entretien oral d’au moins 30 minutes. Après acceptation orale, le rôle Membre test est attribué et le candidat suit =bienvenue pour le profil Discord, la liaison Roblox, ses disponibilités, l’adhésion et la découverte des salons. Le bot ne peut pas connaître le résultat ou le statut individuel d’un dossier : toute demande de décision ou de suivi personnel va à l’équipe.' },
    { id: 'sanctions', title: 'Sanctions et contestations', tags: ['sanction', 'avertissement', 'recours', 'plainte'], content: 'Les mesures dépendent de la gravité des faits et des récidives. L’assistant ne connaît pas les faits personnels, l’historique complet ni les décisions de la gestion. Ne juge pas un signalement et ne promets jamais une issue. Transmets les signalements, litiges, recours et questions sur une sanction à l’équipe.' },
    { id: 'tickets', title: 'Fonctionnement des tickets', tags: ['ticket', 'fermer', 'transcript', 'aide'], content: 'Les tickets sont privés, un ticket ouvert par membre et par type. Décris clairement la demande et joins les éléments utiles. Les échanges sont archivés dans un salon réservé à l’équipe à la fermeture. Ne communique jamais de mot de passe, cookie, token ou code de connexion.' },
    { id: 'reports', title: 'Signalement d’un membre', tags: ['report', 'joueur', 'preuve', 'capture', 'vidéo'], content: 'Un report doit contenir le contexte des faits, la date et l’heure approximatives, le pseudo Roblox et le pseudo RP du joueur, plus une capture d’écran ou une vidéo jointe. L’équipe traite les reports ; l’assistant collecte les informations sans prendre parti.' },
    { id: 'events', title: 'Demande d’animation', tags: ['animation', 'évènement', 'famille', 'récompense'], content: 'Une demande d’animation doit préciser les familles concernées, la date, la description, le lieu, l’heure, la récompense (ou aucune), et si l’animation est publique ou privée. Une demande complète est soumise à la gestion des animations pour validation ou refus ; l’assistant ne décide pas.' },
    { id: 'partnerships', title: 'Demande de partenariat', tags: ['partenariat', 'serveur', 'school rp', '+18'], content: 'Une demande de partenariat doit indiquer le nom et le lien du serveur, son objectif, s’il promeut du contenu +18 et son éventuel lien avec School RP. Une demande complète est transmise à la Gestion Requête ; seul le staff décide.' }
];

const STOP = new Set('avec dans pour une des les est aux qui que quoi comment quand quel quelle quels quelles mais par sur cette sont plus pas nous vous mon ma mes ton ta tes cela alors donc'.split(' '));
function normalize(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function tokens(text) { return normalize(text).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !STOP.has(word)); }
function entries() {
    const ranks = { id: 'current-ranks', title: 'Grades Discord reconnus', tags: ['grade', 'rang', 'membre', 'promotion'], content: `Grades principaux configurés dans le bot : ${Object.values(MAIN_RANKS).map(rank => rank.name).join(', ')}. Le rôle présent dans le profil indique uniquement le rôle actuel ; toute promotion, sanction ou décision future relève de l’équipe.` };
    return [...DEFAULTS, ranks, ...Object.values(read('ticketKnowledgeEntries'))];
}
function search(query, limit = 5) {
    const queryTokens = new Set(tokens(query));
    return entries().map(entry => {
        const text = `${entry.title} ${(entry.tags || []).join(' ')} ${entry.content}`;
        const matched = tokens(text).filter(word => queryTokens.has(word));
        return { ...entry, score: matched.length + matched.filter(word => (entry.tags || []).some(tag => tokens(tag).includes(word))).length };
    }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
function add(title, content, metadata = {}) {
    const entry = { id: metadata.id || `kb-${randomUUID().slice(0, 8)}`, title: String(title).trim(), content: String(content).trim(), tags: (metadata.tags || []).slice(0, 12), createdAt: Date.now(), createdBy: metadata.createdBy || null, source: metadata.source || 'staff' };
    update('ticketKnowledgeEntries', all => { all[entry.id] = entry; });
    return entry;
}
function getAnswer(id) { return read('ticketAiAnswers')[id] || null; }
function recordAnswer(entry) { update('ticketAiAnswers', all => { all[entry.id] = entry; }); }
function updateAnswer(id, callback) { update('ticketAiAnswers', all => { if (all[id]) callback(all[id]); }); }
function recordIssue(entry) { update('ticketAiIssues', all => { all[entry.id] = entry; }); }
function updateIssue(id, callback) { update('ticketAiIssues', all => { if (all[id]) callback(all[id]); }); }
function stats() {
    const answers = Object.values(read('ticketAiAnswers'));
    const issues = Object.values(read('ticketAiIssues'));
    return { knowledge: entries().length, answers: answers.length, helpful: answers.filter(item => item.feedback === 'good').length, negative: answers.filter(item => item.feedback === 'bad').length, gaps: issues.filter(item => !item.resolvedAt).length, resolved: issues.filter(item => item.resolvedAt).length };
}

module.exports = { DEFAULTS, search, add, getAnswer, recordAnswer, updateAnswer, recordIssue, updateIssue, stats };
