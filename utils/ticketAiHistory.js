const MAX_HISTORY_MESSAGES = 24;
const MAX_SUMMARY_CHARS = 1800;

function contentFor(message) {
    const content = String(message?.content || '').trim();
    const files = [...(message?.attachments?.values?.() || [])];
    if (!content && !files.length) return '';
    const attachmentInfo = files.map(file => `[pièce jointe${file.name ? ` : ${file.name}` : ''}]`).join(' ');
    return [content, attachmentInfo].filter(Boolean).join(' ').slice(0, 1800);
}

function discordTurns(messages, { ownerId, botId }) {
    return [...messages].sort((a, b) => a.createdTimestamp - b.createdTimestamp).flatMap(message => {
        const content = contentFor(message);
        if (!content) return [];
        if (message.author?.bot) {
            if (message.author.id !== botId) return [];
            const prefix = `<@${ownerId}>`;
            if (!content.startsWith(prefix)) return [];
            const answer = content.slice(prefix.length).trim();
            return answer ? [{ role: 'assistant', content: answer }] : [];
        }
        const speaker = message.author?.id === ownerId ? 'Membre' : 'Intervenant';
        return [{ role: 'user', content: `${speaker} : ${content}` }];
    });
}

function summarizeTurns(turns) {
    return turns.map(turn => `${turn.role === 'assistant' ? 'IA' : 'Ticket'} : ${String(turn.content || '').replace(/\s+/g, ' ').trim()}`)
        .filter(line => line.length > 8).join('\n').slice(-MAX_SUMMARY_CHARS);
}

function compactHistory(messages, summary = '', limit = MAX_HISTORY_MESSAGES) {
    const valid = (Array.isArray(messages) ? messages : []).filter(turn =>
        ['user', 'assistant'].includes(turn?.role) && typeof turn.content === 'string' && turn.content.trim()
    ).map(turn => ({ role: turn.role, content: turn.content.slice(0, 1800) }));
    if (valid.length <= limit) return { summary: String(summary || '').slice(-MAX_SUMMARY_CHARS), messages: valid };
    const overflow = valid.slice(0, valid.length - limit);
    const combinedSummary = [summary, summarizeTurns(overflow)].filter(Boolean).join('\n').slice(-MAX_SUMMARY_CHARS);
    return { summary: combinedSummary, messages: valid.slice(-limit) };
}

module.exports = { MAX_HISTORY_MESSAGES, MAX_SUMMARY_CHARS, contentFor, discordTurns, summarizeTurns, compactHistory };
