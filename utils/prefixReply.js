const { Events, MessageFlags } = require('discord.js');
const { ownerLineReply } = require('./prefixContext');
const { OWNER_ID } = require('./lineState');
const { read, update } = require('./recruitmentData');

// Public prefix replies replace ephemeral responses. Personal controls still
// belong to the command author, including after a restart on Railway.
function protectPanels(client) {
    const owners = read('prefixPanelOwners');
    const emit = client.emit;
    client.emit = function(event, ...args) {
        const i = args[0];
        if (event === Events.InteractionCreate && i?.message?.id) {
            const owner = owners[i.message.id];
            if (owner && owner !== i.user.id) {
                Promise.resolve(i.reply({ content: 'Ce panneau appartient à un autre membre.', flags: MessageFlags.Ephemeral })).catch(() => {});
                return true;
            }
        }
        return emit.call(this, event, ...args);
    };
    return (message, owner) => {
        if (owners[message.id] === owner) return;
        update('prefixPanelOwners', all => { all[message.id] = owner; });
        owners[message.id] = owner;
    };
}

function createReply(client, message, name, protect) {
    let response, personal = false;
    const i = {
        id: message.id, client, guild: message.guild, guildId: message.guildId,
        channel: message.channel, channelId: message.channelId,
        user: message.author, member: message.member,
        memberPermissions: message.member?.permissions,
        appPermissions: message.channel.permissionsFor?.(client.user),
        createdTimestamp: message.createdTimestamp, createdAt: message.createdAt,
        deferred: false, replied: false,
        isChatInputCommand: () => true, isAutocomplete: () => false,
        inGuild: () => true, inCachedGuild: () => true, isRepliable: () => true
    };
    const run = fn => name === 'line' && message.author.id === OWNER_ID
        ? ownerLineReply(message.channelId, fn) : fn();
    function body(payload = {}) {
        const value = typeof payload === 'string' ? { content: payload } : { ...payload };
        const flags = Number(value.flags?.bitfield ?? value.flags ?? 0);
        personal ||= Boolean(flags & MessageFlags.Ephemeral) || value.ephemeral === true;
        // Keep Components V2 and other message flags; only Ephemeral is invalid.
        if (value.flags !== undefined) value.flags = flags & ~MessageFlags.Ephemeral;
        delete value.ephemeral;
        delete value.fetchReply;
        delete value.withResponse;
        value.allowedMentions = { parse: [], repliedUser: false };
        return value;
    }
    async function send(payload, followUp = false) {
        const value = body(payload);
        const sent = await run(() => response && !followUp
            ? response.edit(value) : message.reply(value));
        if (!followUp) response = sent;
        if (personal && value.components?.length) protect(sent, message.author.id);
        i.replied = true;
        return sent;
    }
    i.reply = payload => send(payload);
    i.editReply = payload => send(payload);
    i.followUp = payload => send(payload, true);
    i.deferReply = async payload => {
        body(payload);
        i.deferred = true;
        // No extra loading message: the first result is the command's panel.
    };
    i.fetchReply = async () => response;
    i.deleteReply = async () => { if (response) await response.delete(); response = undefined; };
    return i;
}
module.exports = { createReply, protectPanels };
