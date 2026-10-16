const HUMAN_REASONS = new Set([
    'personal_decision',
    'staff_action',
    'security_incident',
    'serious_conflict',
    'unresolved_technical_issue'
]);

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function immediateHumanReason(text) {
    const value = normalize(text);
    if (/(?:contester|contestation|faire appel|annuler|retirer).{0,70}(?:sanction|avertissement|timeout|ban|bannissement|kick)|(?:sanction|avertissement|timeout|ban|bannissement|kick).{0,70}(?:contester|contestation|faire appel|annuler|retirer)/i.test(value)) return 'personal_decision';
    if (/(?:ma|mon)\s+(?:sanction|avertissement|candidature|dossier|recrutement)\b.{0,100}\b(?:statut|accepte|refuse|pourquoi|resultat|decision|recours|appel)\b|\b(?:statut|resultat|decision)\b.{0,70}\b(?:ma|mon)\s+(?:candidature|dossier|recrutement)\b/i.test(value)) return 'personal_decision';
    if (/(?:mon compte|mon discord|mon roblox|mon compte roblox).{0,70}\b(?:pirate|hacke|vole|compromis|doxx)|\b(?:danger immediat|menace de mort|adresse publiee|doxx|compte pirate|compte vole)\b/i.test(value)) return 'security_incident';
    if (/(?:il|elle|ils|elles|quelqu'un|un membre|un joueur).{0,45}\b(?:me harcele|me menace|me doxx|publie mon adresse|m'agresse)|\b(?:je subis|je suis victime de)\b.{0,50}\b(?:harcelement|menace|doxx|agression)\b/i.test(value)) return 'serious_conflict';
    return null;
}

function decide(result = {}, { text = '', type = 'questions' } = {}) {
    if (type === 'questions') {
        const immediateReason = immediateHumanReason(text);
        if (immediateReason) return { action: 'escalate', reason: immediateReason };
    }

    const reason = HUMAN_REASONS.has(result.escalationReason) ? result.escalationReason : null;
    const requestedDecision = result.decision;
    const modelRequestedEscalation = result.escalate === true || requestedDecision === 'escalate';
    if (modelRequestedEscalation && reason) return { action: 'escalate', reason };

    const answer = typeof result.answer === 'string' ? result.answer.trim() : '';
    if (requestedDecision === 'clarify' || result.needsClarification === true) {
        return { action: 'clarify', answer: answer || null };
    }
    if (answer) return { action: 'answer', answer };
    return { action: 'clarify', answer: null };
}

function hasRecentNotice(previous, now, ttl) {
    return Boolean(previous?.at && now - previous.at < ttl);
}

module.exports = { HUMAN_REASONS, normalize, immediateHumanReason, decide, hasRecentNotice };
