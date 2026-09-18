const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { IDENTITY, ROLES, COLORS } = require("../config/soulSociety");
const { ensurePanel } = require("../utils/recruitmentData");
const CHANNEL = "1550347115790602361";
const KEY = "office_candidates";
function payload() {
    return { embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🎓 Entretiens Soul Society")
        .setDescription("Rejoins le vocal d’un candidat ayant le rôle Attente entretien, puis clique ci-dessous. Si plusieurs candidats sont présents, choisis celui dont tu souhaites consulter la candidature. Les actions de recrutement sont réservées aux recruteurs.")],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(KEY).setLabel("Candidats dans mon vocal").setStyle(ButtonStyle.Primary).setEmoji("📋"))], allowedMentions: { parse: [] } };
}
function candidates(member) {
    return member.voice.channel?.members.filter(m => !m.user.bot && m.roles.cache.has(ROLES.interviewWaiting));
}
async function handle(interaction) {
    if (interaction.guildId !== IDENTITY.guildId || interaction.channelId !== CHANNEL) return;
    if (!(interaction.isButton() && interaction.customId === KEY) && !(interaction.isStringSelectMenu() && interaction.customId === "office_choose")) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const found = candidates(member);
    if (!found?.size) return interaction.editReply("Aucun membre avec le rôle Attente entretien dans ton vocal. Rejoins d’abord son vocal.");
    let target;
    if (interaction.isStringSelectMenu()) {
        target = found.get(interaction.values[0]);
        if (!target) return interaction.editReply("Ce candidat n’est plus en attente dans ton vocal. Relance le panel.");
    } else if (found.size === 1) target = found.first();
    else {
        // Discord accepts 25 choices per menu; provide every candidate across up to 5 rows.
        const all = [...found.values()];
        const rows = [];
        for (let offset = 0; offset < Math.min(all.length, 125); offset += 25) rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(offset ? "office_choose_" + offset : "office_choose").setPlaceholder("Choisir un candidat")
                .addOptions(all.slice(offset, offset + 25).map(m => ({ label: m.displayName.slice(0,100), value: m.id })))));
        return interaction.editReply({ content: "Choisis le candidat à examiner.", components: rows });
    }
    return require("../commandes/entretien").openPanel(interaction, target.id, true);
}
function register(client) {
    client.once(Events.ClientReady, () => ensurePanel(client, CHANNEL, KEY, payload()).catch(error => console.error("❌ Panel entretien :", error.message)));
    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.customId?.startsWith("office_choose_")) interaction.customId = "office_choose";
        try { await handle(interaction); }
        catch (error) {
            console.error("❌ Panel entretien :", error.message);
            if (interaction.deferred) await interaction.editReply("❌ Impossible d’ouvrir cet entretien. Vérifie l’accès du bot au salon.").catch(() => {});
        }
    });
}
module.exports = register;
module.exports.payload = payload;
module.exports.handle = handle;
module.exports.candidates = candidates;
module.exports.CHANNEL = CHANNEL;
module.exports.KEY = KEY;
