const { MAIN_RANKS } = require("../config/ranks");
const { IDENTITY, CHANNELS } = require("../config/soulSociety");
const { isProtectedUser } = require("./security");
const { getRobloxLink } = require("./robloxLinks");
const { linkRobloxFromCandidature } = require("./robloxCandidatureLink");
const { syncRobloxRank } = require("./robloxGroup");

async function syncSoulMember(member, { discordRank = null } = {}) {
    if (member.guild.id !== IDENTITY.guildId || member.user.bot) return { success: false, skipped: true };
    const rank = discordRank && MAIN_RANKS[discordRank]
        ? [discordRank, MAIN_RANKS[discordRank]]
        : Object.entries(MAIN_RANKS).find(([, value]) => member.roles.cache.has(value.roleId));
    if (!rank) return { success: false, skipped: true };
    let link = getRobloxLink(member.id);
    if (!link) {
        const linked = await linkRobloxFromCandidature(member.id);
        if (!linked.success) return linked;
        link = getRobloxLink(member.id);
    }
    if (link?.robloxUsername && member.manageable && !isProtectedUser(member.id)) {
        const nickname = String(link.robloxUsername).slice(0, 32);
        if (member.nickname !== nickname) await member.setNickname(nickname, "Synchronisation du pseudo Roblox");
    }
    const result = await syncRobloxRank({ discordUserId: member.id, discordRank: rank[0], hasManagement: false });
    if (!result.success) {
        const channel = member.guild.channels.cache.get(CHANNELS.logs) ||
            await member.guild.channels.fetch(CHANNELS.logs).catch(() => null);
        if (channel?.isTextBased()) await channel.send({ content: "⚠️ Synchronisation Roblox de <@" + member.id + "> à terminer : " + (result.error || "échec") + ".", allowedMentions: { parse: [] } }).catch(() => {});
    }
    return result;
}
module.exports = { syncSoulMember };
