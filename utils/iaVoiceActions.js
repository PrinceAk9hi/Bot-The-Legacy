const { ChannelType } = require('discord.js');

const VOICE_CHANNEL_TYPES = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function isVoiceChannel(channel) { return Boolean(channel && VOICE_CHANNEL_TYPES.has(channel.type)); }
function memberIds(text) {
    const source = String(text || '');
    const mentions = [...source.matchAll(/<@!?(\d{17,20})>/g)].map(match => match[1]);
    const bare = source.replace(/<#[0-9]+>/g, ' ').replace(/<@!?[0-9]+>/g, ' ');
    return [...new Set([...mentions, ...[...bare.matchAll(/\b(\d{17,20})\b/g)].map(match => match[1])])];
}
function channelMentions(text) { return [...String(text || '').matchAll(/<#(\d{17,20})>/g)].map(match => match[1]); }
function resolveChannel(text, guild, requesterVoice) {
    const mentions = channelMentions(text);
    for (const id of mentions) {
        const channel = guild.channels.cache.get(id);
        if (isVoiceChannel(channel)) return channel;
    }
    const normalized = normalize(text);
    if (/\b(?:cette voc|ce vocal|mon vocal|ma voc|ici|mon salon vocal)\b/.test(normalized)) return requesterVoice || null;
    if (/\b(?:voc|vocal|salon vocal)\b/.test(normalized) && requesterVoice) return requesterVoice;
    const candidates = [...guild.channels.cache.values()].filter(isVoiceChannel)
        .filter(channel => new RegExp(`(?:^|[^a-z0-9])${normalize(channel.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`).test(normalized));
    return candidates.length === 1 ? candidates[0] : null;
}
function isAllTarget(text) {
    return /\b(?:tout le monde|tous les membres|toutes les personnes|tout le vocal|tous les joueurs|tous ceux)\b/.test(normalize(text));
}

// Analyse volontairement limitée aux verbes explicites et aux IDs/mentions réels.
// Cela évite de laisser le modèle inventer une cible ou transformer une question en action.
function parseVoiceAction(text, guild, requester) {
    const sourceText = String(text || '');
    const normalized = normalize(sourceText);
    if (/\b(?:pourquoi|comment|devrais|faut-il|est-ce que|est-il possible|explique-moi|m'expliquer)\b/.test(normalized)) return null;
    if (/\b(?:ne|n)\b[\s\S]{0,60}\b(?:mute|muter|deco|deconnecte|deconnecter|move|mouve|deplace|deplacer|bouge|transfere|transferer)\b[\s\S]{0,60}\bpas\b/.test(normalized)) return null;
    const ids = memberIds(sourceText);
    const all = isAllTarget(sourceText);
    const verb = /\b(?:mute|muter|rendre muet|deco|deconnecte|deconnecter|sortir|move|mouve|deplace|deplacer|bouge|transfere|transferer)\b/.test(normalized);
    if (!verb || (!all && !ids.length)) return null;

    let type;
    if (/\b(?:mute|muter|rendre muet)\b/.test(normalized)) type = 'mute';
    else if (/\b(?:deco|deconnecte|deconnecter|sortir)\b/.test(normalized)) type = 'disconnect';
    else type = 'move';

    const requesterVoice = requester?.voice?.channel || null;
    const destinationPhrase = /\b(?:vers|dans|au salon|au vocal|dans le salon|dans le vocal)\b([\s\S]*)$/i.exec(sourceText)?.[1] || '';
    const destination = type === 'move' ? resolveChannel(destinationPhrase || sourceText, guild, requesterVoice) : null;
    const mentionedChannels = channelMentions(sourceText).map(id => guild.channels.cache.get(id)).filter(isVoiceChannel);
    const sourcePhrase = /\bde\s+([\s\S]+?)\s+(?:vers|dans)\b/i.exec(sourceText)?.[1] || '';
    const explicitSource = sourcePhrase ? resolveChannel(sourcePhrase, guild, requesterVoice) : null;
    const source = all
        ? (explicitSource || (type === 'move' ? mentionedChannels.find(channel => channel.id !== destination?.id) || requesterVoice : resolveChannel(sourceText, guild, requesterVoice)))
        : null;

    if (type === 'move' && !destination) return { error: 'destination', type };
    if (type === 'move' && all && !source) return { error: 'source', type };
    if ((type === 'mute' || type === 'disconnect') && all && !source) return { error: 'source', type };
    if (type === 'move' && all && source?.id === destination.id) return { error: 'same-channel', type, source, destination };
    if (!all && ids.length !== 1) return { error: 'one-member-at-a-time', type };
    return { type, all, targetIds: all ? [] : ids, source, destination };
}

module.exports = { VOICE_CHANNEL_TYPES, normalize, isVoiceChannel, memberIds, isAllTarget, parseVoiceAction };
