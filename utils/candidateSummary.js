const { EmbedBuilder } = require("discord.js");
const { read } = require("./recruitmentData");
const { COLORS, IDENTITY } = require("../config/soulSociety");
const questions = ["Âge IRL", "Temps de jeu et intérêt pour School RP", "Pourquoi rejoindre la famille", "Expérience RP", "Activité lors des événements", "Conflits et anti-famille", "Anciennes familles", "Pseudo Roblox et nom RP", "Disponibilités", "Respect des règles", "Personnalité", "Motivations et objectifs"];
function buildSummary(candidateId) {
    const application = read("candidatures")[candidateId];
    if (!application?.answers) return { content: "❌ Aucune candidature enregistrée pour ce membre.", allowedMentions: { parse: [] } };
    const entries = Object.entries(application.answers);
    const title = key => application.formVersion === 3 ? questions[Number(key.replace("question", "")) - 1] || key : key;
    const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle("📋 Récapitulatif de candidature")
        .setDescription(`<@${candidateId}> • ${candidateId}\nDDS : ${application.ddsStatus || "non demandée"}`)
        .addFields(entries.slice(0, 12).map(([key, value]) => ({ name: title(key), value: String(value || "Non renseigné").slice(0, 350) })));
    if (application.reviewChannelId && application.reviewMessageId) embed.addFields({ name: "Candidature d’origine", value: `https://discord.com/channels/${IDENTITY.guildId}/${application.reviewChannelId}/${application.reviewMessageId}` });
    return {
        embeds: [embed], allowedMentions: { parse: [] },
        files: [{ attachment: Buffer.from(entries.map(([key,value]) => title(key) + "\n" + value).join("\n\n"), "utf8"), name: "candidature-complete.txt" }]
    };
}
module.exports = { buildSummary };
