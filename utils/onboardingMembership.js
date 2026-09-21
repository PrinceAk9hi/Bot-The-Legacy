const { EmbedBuilder } = require("discord.js");
const { ROBLOX, COLORS, EMOJIS } = require("../config/soulSociety");
const { acceptJoinRequest } = require("./robloxGroup");
const pending = new Set();
const acceptances = new Map();
// Une requête lente reste partagée : un second clic ne lance pas une seconde acceptation.
async function boundedAcceptance(key) {
    if (!acceptances.has(key)) {
        const request = Promise.resolve().then(() => acceptJoinRequest(key)).finally(() => acceptances.delete(key));
        acceptances.set(key, request);
    }
    let timer;
    try {
        return await Promise.race([acceptances.get(key), new Promise(resolve => {
            timer = setTimeout(() => resolve({ success: false, error: "ACCEPTANCE_TIMEOUT" }), 20000);
        })]);
    } finally { clearTimeout(timer); }
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function membership(userId) {
    // Bypass noblox's rank cache: confirmation must reflect the actual membership.
    const response = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("ROBLOX_UNAVAILABLE");
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error("ROBLOX_INVALID_RESPONSE");
    return body.data.some(entry => String(entry.group?.id) === String(ROBLOX.groupId));
}
async function verify(interaction, userId) {
    if (!/^\d+$/.test(String(userId || ""))) return { success: false, message: "Renseigne et sauvegarde d’abord ton compte Roblox." };
    const key = String(userId);
    if (pending.has(key)) return { success: false, message: "⏳ Une vérification est déjà en cours pour ce compte. Réessaie dans un instant." };
    pending.add(key);
    const progress = text => interaction.editReply({ content: null, embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🔎 Communauté La Soul Society").setFooter({ text: "La Soul Society • Vérification de ton adhésion" }).setDescription(text)], components: [] });
    try {
        await progress(`${EMOJIS.loading} **Vérification de ton adhésion…**\nConsultation de la communauté Roblox.`);
        if (await membership(key)) return { success: true, alreadyMember: true };
        await progress(`${EMOJIS.loading} **Recherche et acceptation de ta demande…**\nLe bot contacte la communauté de la Soul Society.`);
        const result = await boundedAcceptance(key);
        if (result.success && result.alreadyMember) return { success: true, alreadyMember: true };
        // Une acceptation manuelle peut avoir eu lieu pendant la vérification.
        if (!result.success && await membership(key)) return { success: true, alreadyMember: true };
        if (!result.success) return {
            success: false,
            message: result.error === "ACCEPTANCE_TIMEOUT"
                ? "⏳ Roblox met trop de temps à répondre. La demande peut encore être en cours : clique à nouveau pour vérifier ton adhésion, sans renvoyer de demande."
                : result.error === "NO_PENDING_JOIN_REQUEST"
                ? "📨 Aucune demande en attente. Ouvre la communauté Roblox, envoie ta demande, puis réessaie."
                : "❌ Roblox n’a pas permis d’accepter la demande. L’équipe doit vérifier la connexion Roblox du bot, le groupe configuré et ses droits d’acceptation."
        };
        for (let attempt = 0; attempt < 4; attempt++) {
            await progress(`${EMOJIS.loading} **Confirmation de ton adhésion${".".repeat(attempt % 3 + 1)}**\nVérification ${attempt + 1}/4 auprès de Roblox.`);
            if (await membership(key)) return { success: true, accepted: true };
            if (attempt < 3) await delay(1500);
        }
        return { success: false, message: "⏳ La demande a été traitée, mais Roblox ne confirme pas encore ton adhésion. Réessaie dans quelques instants." };
    } catch {
        return { success: false, message: "❌ Vérification Roblox indisponible pour le moment. Réessaie plus tard ; ton adhésion n’a pas été confirmée." };
    } finally { pending.delete(key); }
}
module.exports = { verify, membership };
