const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { IDENTITY, ROLES, COLORS } = require("../config/soulSociety");
const { hasBypass } = require("../utils/security");
const { ensurePanel } = require("../utils/recruitmentData");
const CHANNEL = "1550347115790602361";
// Keep the existing saved message ID; update the previous panel instead of duplicating it.
const KEY = "office_candidates";
const ACTIONS = {
    accept: ["Accepter", "✅", ButtonStyle.Success],
    refuse: ["Refuser", "❌", ButtonStyle.Danger],
    attente: ["Attente", "⏳", ButtonStyle.Secondary],
    move: ["Déplacer vers soi", "🔊", ButtonStyle.Primary],
    cr: ["CR", "📑", ButtonStyle.Secondary],
    candidature: ["Voir candidature", "📋", ButtonStyle.Secondary]
};
const active = new Set();
function payload() {
    const buttons = Object.entries(ACTIONS).map(([action, [label, emoji, style]]) =>
        new ButtonBuilder().setCustomId("office_action_" + action).setLabel(label).setEmoji(emoji).setStyle(style));
    return {
        embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🎓 Panel d’entretien • Soul Society")
            .setDescription("Rejoins le vocal du candidat et utilise directement les boutons ci-dessous. Le bot repère automatiquement les membres en attente d’entretien. Si plusieurs candidats sont présents, il te demande lequel traiter.\n\nCe panel reste disponible en permanence. Les décisions, déplacements et comptes-rendus sont réservés à l’équipe de recrutement.")],
        components: [new ActionRowBuilder().addComponents(buttons.slice(0, 3)), new ActionRowBuilder().addComponents(buttons.slice(3))],
        allowedMentions: { parse: [] }
    };
}
function candidates(member) {
    return member?.voice?.channel?.members.filter(m => !m.user.bot && m.roles.cache.has(ROLES.interviewWaiting));
}
function authorized(interaction) {
    return hasBypass(interaction) || interaction.member?.roles?.cache?.has(ROLES.recruitmentManagement);
}
function privateReply(interaction, content) {
    return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}
async function handle(interaction) {
    if (interaction.guildId !== IDENTITY.guildId || interaction.channelId !== CHANNEL) return;
    const id = interaction.customId || "";
    let action, selection = false;
    if (interaction.isButton() && id.startsWith("office_action_")) action = id.slice("office_action_".length);
    else if (interaction.isButton() && id === KEY) action = "candidature";
    else if (interaction.isStringSelectMenu() && id.startsWith("office_select_")) {
        const parts = id.split("_");
        if (parts[3] !== interaction.user.id) return privateReply(interaction, "Ce choix de candidat ne t’appartient pas.");
        action = parts[2]; selection = true;
    } else if (interaction.isStringSelectMenu() && id.startsWith("office_choose")) {
        action = "candidature"; selection = true;
    } else return;
    if (!ACTIONS[action]) return;
    if (action !== "candidature" && !authorized(interaction)) return privateReply(interaction, "❌ Action réservée à l’équipe de recrutement.");
    // Voice state is cached: no bulk member fetch or recurring collector.
    const member = interaction.guild.members.cache.get(interaction.user.id) || interaction.member;
    const found = candidates(member);
    if (!found?.size) return privateReply(interaction, "Aucun membre avec le rôle Attente entretien dans ton vocal. Rejoins son vocal avant de cliquer.");
    let target;
    if (selection) {
        target = found.get(interaction.values[0]);
        if (!target) return privateReply(interaction, "Ce candidat n’est plus en attente dans ton vocal. Utilise à nouveau le panel.");
    } else if (found.size === 1) target = found.first();
    else {
        const all = [...found.values()];
        const rows = [];
        for (let offset = 0; offset < Math.min(all.length, 125); offset += 25) rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`office_select_${action}_${interaction.user.id}_${offset}`)
                .setPlaceholder("Quel candidat ?")
                .addOptions(all.slice(offset, offset + 25).map(m => ({ label: m.displayName.slice(0, 100), value: m.id })))));
        return interaction.reply({ content: `**${ACTIONS[action][0]}** — choisis le candidat concerné.`, components: rows, flags: MessageFlags.Ephemeral });
    }
    const handler = interaction.client.handleRecruitmentInteraction;
    if (typeof handler !== "function") return privateReply(interaction, "Le système de recrutement n’est pas encore prêt.");
    const lock = action + ":" + target.id;
    if (active.has(lock)) return privateReply(interaction, "⏳ Cette action est déjà en cours pour ce candidat.");
    active.add(lock);
    try {
        // Reuse /entretien, without changing the ID seen by other event listeners.
        const delegated = new Proxy(interaction, {
            get(object, property) {
                if (property === "customId") return `entretien_${action}_${interaction.user.id}_${target.id}`;
                if (property === "isButton") return () => true;
                if (property === "isStringSelectMenu") return () => false;
                const value = Reflect.get(object, property, object);
                return typeof value === "function" ? value.bind(object) : value;
            }
        });
        return await handler(delegated);
    } finally { active.delete(lock); }
}
function register(client) {
    client.once(Events.ClientReady, () => ensurePanel(client, CHANNEL, KEY, payload()).catch(error => console.error("❌ Panel entretien :", error.message)));
    client.on(Events.InteractionCreate, async interaction => {
        try { await handle(interaction); }
        catch (error) {
            console.error("❌ Panel entretien :", error.message);
            if (interaction.deferred) await interaction.editReply("❌ Impossible de terminer cette action. Vérifie l’accès du bot et réessaie.").catch(() => {});
            else if (!interaction.replied) await privateReply(interaction, "❌ Impossible d’exécuter cette action.").catch(() => {});
        }
    });
}
module.exports = register;
Object.assign(module.exports, { payload, handle, candidates, CHANNEL, KEY });
