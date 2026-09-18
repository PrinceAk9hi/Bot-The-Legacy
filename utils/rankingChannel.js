const { PermissionFlagsBits, OverwriteType } = require('discord.js');
const { IDENTITY } = require('../config/soulSociety');
const { read, update } = require('./recruitmentData');
const CHANNEL = '1544424543664349264';
const DENY = { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendVoiceMessages: false };
async function prepare(client, panel) {
    const channel = await client.channels.fetch(CHANNEL);
    if (channel?.guildId !== IDENTITY.guildId || panel.channelId !== CHANNEL || panel.author.id !== client.user.id) throw new Error('Salon ou panel classement incorrect');
    const me = await channel.guild.members.fetchMe();
    const permissions = channel.permissionsFor(me);
    if (!permissions?.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ViewChannel])) throw new Error('Permissions insuffisantes pour préparer le classement');
    // Explicit bot access wins over role denies. Preserve all unrelated overwrites.
    await channel.permissionOverwrites.edit(client.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true }, { type: OverwriteType.Member, reason: 'Maintenir le panel de classement' });
    await channel.permissionOverwrites.edit(channel.guild.id, DENY, { reason: 'Salon classement en lecture seule' });
    for (const overwrite of [...channel.permissionOverwrites.cache.values()]) {
        if (overwrite.id === client.user.id || overwrite.id === channel.guild.id) continue;
        await channel.permissionOverwrites.edit(overwrite.id, DENY, { type: overwrite.type, reason: 'Salon classement en lecture seule' });
    }
    // One-time, resumable cleanup. Messages newer than the initial cutoff are never swept.
    let state = read('rankingCleanup')[CHANNEL];
    if (state?.complete) return;
    if (!state) {
        const newest = (await channel.messages.fetch({ limit: 1 })).first();
        state = { cutoff: newest?.id || panel.id, before: null, complete: false };
        update('rankingCleanup', all => { all[CHANNEL] = state; });
    }
    let before = state.before || String(BigInt(state.cutoff) + 1n);
    while (true) {
        const batch = await channel.messages.fetch({ limit: 100, before });
        if (!batch.size) break;
        for (const message of batch.values()) {
            if (message.id === panel.id || BigInt(message.id) > BigInt(state.cutoff)) continue;
            try { await message.delete(); } catch (error) { if (error.code !== 10008) throw error; }
        }
        before = batch.last().id;
        state.before = before;
        update('rankingCleanup', all => { all[CHANNEL] = state; });
    }
    state.complete = true; state.completedAt = Date.now();
    update('rankingCleanup', all => { all[CHANNEL] = state; });
}
module.exports = { prepare, DENY };
