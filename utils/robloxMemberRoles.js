const { ROBLOX } = require("../config/soulSociety");

// L’API assignRole ajoute un rôle sans remplacer les autres rôles du membre.
async function assignMemberRoles(robloxUserId, request = fetch) {
    const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    if (!apiKey) return { success: false, error: "ROBLOX_OPEN_CLOUD_API_KEY_MISSING" };
    if (!/^\d+$/.test(String(robloxUserId))) return { success: false, error: "INVALID_ROBLOX_USER_ID" };
    if (Number(process.env.ROBLOX_GROUP_ID || ROBLOX.groupId) !== ROBLOX.groupId) {
        return { success: false, error: "ROBLOX_GROUP_MISMATCH" };
    }
    const assigned = [];
    for (const roleId of ROBLOX.memberRoleIds) {
        try {
            const response = await request(
                "https://apis.roblox.com/cloud/v2/groups/" + ROBLOX.groupId + "/memberships/" + robloxUserId + ":assignRole",
                { method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ role: "groups/" + ROBLOX.groupId + "/roles/" + roleId }),
                  signal: AbortSignal.timeout(15000) }
            );
            if (!response.ok) return { success: false, error: "ROBLOX_ASSIGN_ROLE_HTTP_" + response.status, assigned };
            assigned.push(roleId);
        } catch {
            return { success: false, error: "ROBLOX_ASSIGN_ROLE_NETWORK_ERROR", assigned };
        }
    }
    return { success: true, rank: 6, assigned };
}
module.exports = { assignMemberRoles };
