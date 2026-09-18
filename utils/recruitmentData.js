const fs = require("fs");
const path = require("path");

// Same data directory as the existing bot: /app/data on Railway.
const directory = path.join(__dirname, "..", "data");
function read(name) {
    const file = path.join(directory, name + ".json");
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
}
function update(name, callback) {
    const data = read(name);
    callback(data);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, name + ".json");
    const temporary = file + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(temporary, file);
    return data;
}
async function ensurePanel(client, channelId, key, payload) {
    const channel = await client.channels.fetch(channelId);
    const { IDENTITY } = require("../config/soulSociety");
    if (!channel?.isTextBased() || channel.guildId !== IDENTITY.guildId) throw new Error("Salon de panel incorrect : " + channelId);
    const saved = read("recruitmentPanels")[key];
    let message;
    if (saved?.channelId === channelId) {
        try { message = await channel.messages.fetch(saved.messageId); }
        catch (error) { if (error.code !== 10008) throw error; }
    } else {
        const recent = await channel.messages.fetch({ limit: 100 });
        message = recent.find(m => m.author.id === client.user.id && m.components.some(row =>
            row.components.some(c => c.customId === key)));
    }
    if (message && message.author.id !== client.user.id) throw new Error("Le panel enregistré appartient à un autre compte.");
    if (message) await message.edit(payload);
    else message = await channel.send(payload);
    update("recruitmentPanels", state => { state[key] = { channelId, messageId: message.id }; });
    return message;
}
module.exports = { read, update, ensurePanel };
