const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const logsPath = path.join(
    __dirname,
    "..",
    "data",
    "logs.json"
);

function getConfig() {
    try {
        return JSON.parse(
            fs.readFileSync(
                logsPath,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

async function sendLog(
    guild,
    {
        title,
        description,
        executant,
        cible,
        fields = []
    }
) {
    const config = getConfig();

    const channelId =
        config[guild.id];

    if (!channelId) return;

    const channel =
        guild.channels.cache.get(
            channelId
        );

    if (!channel) return;

    const embed =
        new EmbedBuilder()
            .setTitle(title)
            .setTimestamp();

    if (description) {
        embed.setDescription(
            description
        );
    }

    if (executant) {
        embed.addFields({
            name: "👤 Exécutant",
            value:
                `<@${executant.id}>\n\`${executant.id}\``,
            inline: true
        });
    }

    if (cible) {
        embed.addFields({
            name: "🎯 Cible",
            value:
                `<@${cible.id}>\n\`${cible.id}\``,
            inline: true
        });
    }

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    try {
        await channel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error(
            "❌ Impossible d'envoyer le log :",
            error
        );
    }
}

module.exports = {
    sendLog
};