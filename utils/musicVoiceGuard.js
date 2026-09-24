const { getGroups, VoiceConnectionStatus } = require('@discordjs/voice');
function assertFree(guild, ownConnection = null) {
    for (const connections of getGroups().values()) {
        const connection = connections.get(guild.id);
        if (connection && connection !== ownConnection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
            throw new Error('Le bot utilise déjà le vocal pour une autre activité. Termine cette activité avant de lancer la musique.');
        }
    }
    if (!ownConnection && guild.members.me?.voice.channelId) throw new Error('Le bot est déjà connecté à un vocal. Termine son activité avant de lancer la musique.');
}
function assertNotMusic(guild) {
    if (guild.client.soulMusic?.active(guild.id)) throw new Error('Une session musicale est en cours. Arrête-la depuis =musique avant de démarrer cette activité vocale.');
}
module.exports = { assertFree, assertNotMusic };
