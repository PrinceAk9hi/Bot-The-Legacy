const { EmbedBuilder } = require("discord.js");
const pending = new Set();
async function sendResult(interaction, candidateId, result, store) {
    if (pending.has(candidateId)) return interaction.editReply("⏳ Une réponse est déjà en cours.");
    pending.add(candidateId);
    try {
        const application = store.read()[candidateId];
        if (!application?.reviewMessageId || !application.reviewChannelId) return interaction.editReply("❌ Message de candidature introuvable.");
        if (application.ddsStatus === "received") return interaction.editReply("✅ Cette DDS a déjà reçu une réponse.");
        if (application.ddsStatus !== "pending") return interaction.editReply("❌ Aucune DDS en cours.");
        const channel = await interaction.guild.channels.fetch(application.reviewChannelId);
        const original = await channel.messages.fetch(application.reviewMessageId);
        const payload = {
            embeds: [new EmbedBuilder().setTitle("📋 Résultat DDS").setDescription(result.slice(0, 4000)).addFields({ name: "Membre", value: `<@${candidateId}>` }).setTimestamp()],
            allowedMentions: { parse: [], repliedUser: false }
        };
        if (result.length > 4000) payload.files = [{ attachment: Buffer.from(result), name: "dds-complete.txt" }];
        const message = await original.reply(payload);
        const latest = store.read();
        if (latest[candidateId]) {
            Object.assign(latest[candidateId], { ddsStatus: "received", ddsResult: result, ddsResponseMessageId: message.id });
            store.save(latest);
        }
        // A failed status refresh must not discard the saved result or skip the notification.
        await store.refresh().catch(error => console.error("❌ Actualisation DDS :", error.message));
        const requester = application.ddsRequesterId;
        let ghostFailed = false;
        if (requester) {
            try {
                const ping = await channel.send({ content: `<@${requester}>`, allowedMentions: { parse: [], users: [requester] } });
                await ping.delete();
            } catch { ghostFailed = true; }
        }
        return interaction.editReply("✅ Résultat envoyé en réponse à la candidature." + (ghostFailed ? " Le ghost ping n’a pas pu être terminé." : ""));
    } finally { pending.delete(candidateId); }
}
module.exports = { sendResult };
