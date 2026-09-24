const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { hasBypass } = require("../utils/security");
const { getRobloxLink } = require("../utils/robloxLinks");
const { addBadge } = require("../utils/robloxBadge");
module.exports = {
    data: new SlashCommandBuilder().setName("badge").setDescription("Ajouter le rôle badge dans la communauté Roblox")
        .addUserOption(option => option.setName("membre").setDescription("Membre Discord dont le compte Roblox est lié").setRequired(true)),
    async execute(interaction) {
        if (!interaction.guildId || !hasBypass(interaction)) return interaction.reply({ content: "❌ Commande réservée à Aven, aux bypass et à la fondation.", flags: MessageFlags.Ephemeral });
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const user = interaction.options.getUser("membre", true);
        if (user.bot) return interaction.editReply("❌ Choisis un membre humain.");
        const link = getRobloxLink(user.id);
        if (!link?.robloxUserId) return interaction.editReply("❌ Ce membre n’a pas de compte Roblox lié. Utilise =link ou demande-lui de compléter son profil.");
        const result = await addBadge(link.robloxUserId);
        if (result.success) return interaction.editReply({
            content: result.alreadyHasBadge
                ? `ℹ️ <@${user.id}> possède déjà le rôle **badge** dans la communauté de la Soul Society.`
                : `✅ Le rôle **badge** a été ajouté au compte Roblox lié à <@${user.id}> dans la communauté de la Soul Society.`,
            allowedMentions: { parse: [] }
        });
        const errors = {
            KEY_MISSING: "La clé Roblox Open Cloud n’est pas configurée sur le bot (ROBLOX_OPEN_CLOUD_API_KEY).",
            GROUP_MISMATCH: "ROBLOX_GROUP_ID doit correspondre à la communauté de la Soul Society : 925445053.",
            INVALID_USER: "La liaison Roblox contient un identifiant invalide.",
            NOT_MEMBER: "Ce compte Roblox n’est pas membre de la communauté de la Soul Society.",
            BUSY: "Une attribution de badge est déjà en cours pour ce membre.",
            NOT_CONFIRMED: "La demande a été envoyée, mais le badge n’est pas encore confirmé. Réessaie dans quelques instants.",
            HTTP_401: "Roblox refuse l’authentification Open Cloud du bot.",
            HTTP_403: "Roblox refuse l’accès. Vérifie les droits de la clé Open Cloud et du compte qui gère les rôles.",
            HTTP_429: "Roblox limite temporairement les requêtes. Réessaie plus tard.",
            ROLES_UNAVAILABLE: "Roblox ne retourne pas tous les rôles du membre. Impossible de vérifier son badge."
        };
        return interaction.editReply("❌ " + (errors[result.error] || "Impossible de vérifier ou d’ajouter le badge pour le moment. Vérifie la configuration Roblox et réessaie."));
    }
};
