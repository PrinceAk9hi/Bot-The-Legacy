const { inOffice, OFFICE_MESSAGE } = require("../utils/soulActivityHelpers");
const { payload: questionsPayload, QUESTION_BUTTON_ID } = require("../utils/interviewQuestions");
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { IDENTITY, ROLES, COLORS, CHANNELS } = require("../config/soulSociety");
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
    buttons.push(new ButtonBuilder().setCustomId(QUESTION_BUTTON_ID).setLabel("Questions").setEmoji("📋").setStyle(ButtonStyle.Secondary));
    return {
        embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🎓 Panel d’entretien • Soul Society")
            .setDescription("<:Soul_Society:1548783936010977380> **LE PARCOURS DE RECRUTEMENT**\n\n**① Ouverture du ticket et candidature écrite**\nLe candidat ouvre son ticket et répond au formulaire. Une fois terminé, sa candidature est envoyée dans <#1550247801437290607>, où l’équipe dispose de trois boutons :\n\n✅ **Accepter** — Le rôle **Âme en attente** (<@&1468703799995666636>) lui est attribué. Un message le mentionne dans <#1540836643433615360> pour lui demander ses disponibilités pour l’entretien oral. Prévoir au moins **30 minutes** d’échange.\n❌ **Refuser** — Le candidat est prévenu. Son ticket est programmé pour une fermeture automatique **12 h après le refus** (dans la plage de 6 à 24 h).\n📨 **DDS** — Une demande concernant les sanctions du candidat est adressée à la fondation / gestion des requêtes. Une réponse entraîne un ping du demandeur ; le résultat est publié en réponse à la candidature.\n\n**② Préparation de l’entretien oral**\nConvenez d’un créneau avec le candidat, puis rejoignez l’un des cinq bureaux d’entretien. Les boutons sont utilisables uniquement depuis ces bureaux. Ce panel repère les membres portant le rôle **Âme en attente**. S’ils sont plusieurs, sélectionnez celui dont vous souhaitez traiter l’entretien.\n\n📋 **Questions** — Affiche en privé le guide : présentation, phase de test, sanctions et obligations. Consultable depuis un bureau d’entretien, même sans candidat.\n📋 **Voir candidature** — Affiche le récapitulatif de la candidature du membre sélectionné.\n🔊 **Déplacer vers soi** — Cherche les candidats dans <#1468699345443356885> et déplace le membre choisi vers votre bureau. S’ils sont plusieurs, un sélecteur permet de choisir le candidat.\n⏳ **Attente** — Renvoie le candidat dans le vocal d’attente d’entretien.\n📑 **CR** — Ouvre le formulaire de compte-rendu de l’entretien, à transmettre dans <#1550241655255203921>.\n\n**③ Décision après l’oral**\n✅ **Accepter** — Attribue les rôles de nouvelle recrue, dont **Membre test**, et retire le rôle d’attente. Le bot publie le message de bienvenue dans le chat et invite le membre à utiliser **/bienvenue**. Un MP présente également la communauté Roblox si ses messages privés sont ouverts.\n❌ **Refuser** — Enregistre le refus de l’entretien dans les logs, sans attribuer de rôle de refus. Ce bouton oral est distinct du refus de candidature écrite décrit plus haut.\n\n**④ Accueil et suivi du nouveau membre**\n<a:speaker:1548785378276810844> **/bienvenue** guide le membre dans son profil Discord, sa liaison Roblox, ses disponibilités, son adhésion à la communauté et la découverte des salons. Le parcours se déroule dans un seul message privé à l’utilisateur sur Discord.\n📅 Les disponibilités du profil sont publiées dans <#1540833767759814747>.\n<:certification:1550573424080977930> Une fois le parcours terminé, **/bienvenue** n’est plus utilisable : le membre passe par **/mon-profil** pour modifier ses informations et ses disponibilités, avec les boutons **Sauvegarder** et **Retour**.\n\n**Ce panel reste disponible en permanence.** Les décisions, déplacements et comptes-rendus sont réservés à l’équipe de recrutement.")],
        components: [new ActionRowBuilder().addComponents(buttons.slice(0, 3)), new ActionRowBuilder().addComponents(buttons.slice(3))],
        allowedMentions: { parse: [] }
    };
}
function candidates(member, action) {
    const channel = action === "move"
        ? member?.guild?.channels.cache.get(CHANNELS.recruitmentWaiting)
        : member?.voice?.channel;
    return channel?.members?.filter(m => !m.user.bot && (action === "move" || m.roles.cache.has(ROLES.interviewWaiting)));
}
function authorized(interaction) {
    return hasBypass(interaction) || interaction.member?.roles?.cache?.has(ROLES.recruitmentManagement);
}
function privateReply(interaction, content) {
    return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}
async function handle(interaction) {
    if (interaction.guildId !== IDENTITY.guildId) return;
    if (interaction.isButton() && interaction.customId === QUESTION_BUTTON_ID) return inOffice(interaction) ? interaction.reply(questionsPayload()) : privateReply(interaction, OFFICE_MESSAGE);
    if (interaction.channelId !== CHANNEL) return;
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
    if (!inOffice(interaction)) return privateReply(interaction, OFFICE_MESSAGE);
    if (action !== "candidature" && !authorized(interaction)) return privateReply(interaction, "❌ Action réservée à l’équipe de recrutement.");
    // Voice state is cached: no bulk member fetch or recurring collector.
    const member = interaction.guild.members.cache.get(interaction.user.id) || interaction.member;
    const found = candidates(member, action);
    if (!found?.size) return privateReply(interaction, action === "move" ? "Aucun candidat dans le vocal d’attente d’entretien." : "Aucun membre avec le rôle Attente entretien dans ton bureau.");
    let target;
    if (selection) {
        target = found.get(interaction.values[0]);
        if (!target) return privateReply(interaction, "Ce candidat n’est plus dans le vocal attendu. Utilise à nouveau le panel.");
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
