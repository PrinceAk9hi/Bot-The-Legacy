const { ROBLOX } = require("../config/soulSociety");
const BADGE_ROLE_ID = "714651144";
const active = new Set();
async function addBadge(userId, request = fetch) {
    const key = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    if (!key) return { success: false, error: "KEY_MISSING" };
    if (!/^\d+$/.test(String(userId || ""))) return { success: false, error: "INVALID_USER" };
    if (Number(process.env.ROBLOX_GROUP_ID || ROBLOX.groupId) !== ROBLOX.groupId) return { success: false, error: "GROUP_MISMATCH" };
    if (active.has(String(userId))) return { success: false, error: "BUSY" };
    active.add(String(userId));
    const role = `groups/${ROBLOX.groupId}/roles/${BADGE_ROLE_ID}`;
    const base = `https://apis.roblox.com/cloud/v2/groups/${ROBLOX.groupId}/memberships`;
    const headers = { "x-api-key": key, "Content-Type": "application/json" };
    async function getMembership() {
        const query = new URLSearchParams({ filter: `user == 'users/${userId}'`, maxPageSize: "100" });
        for (let page = 0; page < 5; page++) {
            const response = await request(base + "?" + query, { headers, signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error("HTTP_" + response.status);
            const data = await response.json();
            if (!Array.isArray(data.groupMemberships)) throw new Error("INVALID_RESPONSE");
            const member = data.groupMemberships.find(m => m.user === `users/${userId}`);
            if (member) {
                if (!Array.isArray(member.roles)) throw new Error("ROLES_UNAVAILABLE");
                return member;
            }
            if (!data.nextPageToken) return null;
            query.set("pageToken", data.nextPageToken);
        }
        throw new Error("PAGINATION_LIMIT");
    }
    try {
        const member = await getMembership();
        if (!member) return { success: false, error: "NOT_MEMBER" };
        if (member.roles.includes(role)) return { success: true, alreadyHasBadge: true };
        const response = await request(base + "/" + userId + ":assignRole", {
            method: "POST", headers, body: JSON.stringify({ role }), signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error("HTTP_" + response.status);
        const updated = await getMembership();
        if (!updated?.roles.includes(role)) return { success: false, error: "NOT_CONFIRMED" };
        return { success: true, alreadyHasBadge: false };
    } catch (error) {
        // Only return controlled codes, never raw request details or credentials.
        return { success: false, error: /^(HTTP_\d{3}|INVALID_RESPONSE|ROLES_UNAVAILABLE|PAGINATION_LIMIT)$/.test(error.message) ? error.message : "NETWORK_ERROR" };
    } finally { active.delete(String(userId)); }
}
module.exports = { addBadge, BADGE_ROLE_ID };
