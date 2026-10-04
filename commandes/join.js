const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasBypass } = require("../utils/security");
const { getRobloxLink } = require("../utils/robloxLinks");
const { verify } = require("../utils/onboardingMembership");
const { addBadge } = require("../utils/robloxBadge");
const active = new Set();

module.exports = {
    // Le routeur existant utilise ces métadonnées pour =join, sans publier de slash.
    data: new SlashCommandBuilder().setName("join")
        .setDescription("Accepter un membre dans la communauté Roblox et ajouter son badge")
        .addUserOption(option => option.setName("membre")
            .setDescription("Membre Discord dont le compte Roblox est lié").setRequired(true)),
    async execute(interaction) {
        if (!interaction.guildId || !hasBypass(interaction)) {
            return interaction.reply({ content: "❌ Commande réservée à Aven, aux bypass et à la fondation.", flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const reply = content => interaction.editReply({ content, embeds: [], components: [], allowedMentions: { parse: [] } });
        const user = interaction.options.getUser("membre", true);
        if (user.bot) return reply("❌ Choisis un membre humain.");
        const link = getRobloxLink(user.id);
        if (!/^\d+$/.test(String(link?.robloxUserId || ""))) {
            return reply("❌ Ce membre n’a pas de compte Roblox lié valide. Utilise =link ou demande-lui de compléter =bienvenue.");
        }
        const key = String(link.robloxUserId);
        if (active.has(key)) return reply("⏳ Une acceptation avec badge est déjà en cours pour ce compte.");
        active.add(key);
        let membership;
        try {
            // Réutilise la vérification sans cache et l’acceptation du parcours bienvenue.
            membership = await verify({ editReply: () => reply(`⏳ Vérification et acceptation du compte Roblox lié à <@${user.id}>…`) }, key);
            if (!membership.success) return reply(membership.message);
            const status = membership.alreadyMember
                ? `ℹ️ <@${user.id}> est déjà dans la communauté de la Soul Society.`
                : `✅ La demande de <@${user.id}> a été acceptée dans la communauté de la Soul Society.`;
            await reply(status + "\n⏳ Vérification et attribution du badge…");
            const badge = await addBadge(key);
            if (badge.success) {
                return reply(status + (badge.alreadyHasBadge ? "\n✅ Le rôle **badge** est déjà présent." : "\n✅ Le rôle **badge** a été ajouté et vérifié."));
            }
            const errors = {
                KEY_MISSING: "La clé ROBLOX_OPEN_CLOUD_API_KEY nécessaire au système de badge existant n’est pas configurée.",
                HTTP_401: "L’authentification du système de badge a été refusée par Roblox.",
                HTTP_403: "Roblox refuse l’attribution du badge : vérifie les droits du compte et de la clé Open Cloud.",
                HTTP_429: "Roblox limite temporairement les requêtes.",
                BUSY: "Une autre attribution de badge est déjà en cours.",
                NOT_CONFIRMED: "L’ajout a été demandé, mais Roblox ne confirme pas encore le badge.",
                NOT_MEMBER: "L’adhésion n’est pas encore visible par le système de badge.",
                GROUP_MISMATCH: "Le groupe Roblox configuré ne correspond pas à la Soul Society."
            };
            return reply(status + "\n⚠️ **Badge non confirmé.** " + (errors[badge.error] || "Le système de badge est indisponible pour le moment.") + "\nRéessaie =join ou =badge pour terminer l’attribution.");
        } catch {
            return reply(membership?.success
                ? "⚠️ L’adhésion est confirmée, mais le badge n’a pas pu être confirmé. Réessaie =badge."
                : "❌ Impossible de confirmer l’acceptation pour le moment. Réessaie dans quelques instants.");
        } finally {
            active.delete(key);
        }
    }
};
