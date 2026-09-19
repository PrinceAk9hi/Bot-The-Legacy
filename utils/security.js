const { SECURITY, ROLES } = require("../config/soulSociety");
const { MessageFlags, ApplicationCommandOptionType } = require("discord.js");

const FOUNDATION_ROLE_IDS = [ROLES.founderMalach, ROLES.founderMrLarbi, ROLES.rightHand];

function hasBypass(subject) {
    const member = subject?.member || subject;
    const userId = subject?.user?.id || member?.user?.id || member?.id;
    if (userId && SECURITY.bypassUserIds.includes(String(userId))) return true;
    const roles = member?.roles;
    return [...SECURITY.bypassRoleIds, ...FOUNDATION_ROLE_IDS].some(id =>
        roles?.cache?.has?.(id) || (Array.isArray(roles) && roles.includes(id))
    );
}

function hasAccessPermission(member, permission) {
    return hasBypass(member) || Boolean(member?.permissions?.has?.(permission));
}

function isProtectedUser(userId, action = "") {
    if (!SECURITY.enabled || !userId) return false;
    const id = String(userId);
    return SECURITY.protectedUserIds.includes(id) ||
        (action === "derank" && SECURITY.derankProtectedUserIds.includes(id));
}

function findProtectedTarget(options, action = "") {
    if (!Array.isArray(options)) return null;
    for (const option of options) {
        const nested = findProtectedTarget(option.options, action);
        if (nested) return nested;
        if ((option.type === ApplicationCommandOptionType.User ||
             option.type === ApplicationCommandOptionType.Mentionable) &&
            isProtectedUser(option.value, action)) return String(option.value);
    }
    return null;
}

async function blockProtectedInteraction(interaction, action = interaction.commandName) {
    const target = findProtectedTarget(interaction.options?.data, action);
    if (!target) return false;
    const payload = { content: "🛡️ Ce compte est protégé contre cette action." };
    if (interaction.deferred) await interaction.editReply(payload);
    else if (interaction.replied) await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    return true;
}

module.exports = { hasBypass, hasAccessPermission, isProtectedUser, findProtectedTarget, blockProtectedInteraction };

// Restriction commune à toutes les commandes slash ; ne bloque pas les panels publics.
async function blockUnauthorizedSlash(interaction) {
    const autocomplete = interaction.isAutocomplete?.();
    if (!autocomplete && !interaction.isChatInputCommand?.()) return false;
    if (interaction.guildId) {
        if (hasBypass(interaction)) return false;
        const { personal, recruiter } = require("./memberCare");
        if (["bienvenue", "mon-profil", "absence"].includes(interaction.commandName) && personal(interaction.member)) return false;
        if (["suivi-test", "convocation"].includes(interaction.commandName) && recruiter(interaction.member)) return false;
    }
    if (autocomplete) await interaction.respond([]);
    else await interaction.reply({ content: "❌ Les commandes sont réservées à Aven, aux rôles bypass et à la fondation.", flags: MessageFlags.Ephemeral });
    return true;
}
module.exports.blockUnauthorizedSlash = blockUnauthorizedSlash;
