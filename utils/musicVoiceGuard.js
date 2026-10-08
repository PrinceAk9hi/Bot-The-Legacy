const { getGroups, VoiceConnectionStatus } = require('@discordjs/voice');
function assertFree(guild, ownConnection = null) {
    if (guild.client.soulRadio?.active(guild.id)) throw new Error('Une annonce radio est en cours. Patiente avant de démarrer une activité vocale.');
    for (const connections of getGroups().values()) {
        const connection = connections.get(guild.id);
        if (connection && connection !== ownConnection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
            throw new Error('Le bot utilise déjà le vocal pour une autre activité. Termine cette activité avant de lancer une nouvelle lecture.');
        }
    }
    if (!ownConnection && guild.members.me?.voice.channelId) throw new Error('Le bot est déjà connecté à un vocal. Termine son activité avant de lancer une nouvelle lecture.');
}
function assertNotMusic(guild) {
    if (guild.client.soulRadio?.active(guild.id)) throw new Error('Une annonce radio est en cours.');
    if (guild.client.soulSoundboard?.active(guild.id)) throw new Error("La soundboard est en cours. Utilise /stopsound dans le même vocal avant cette activité.");
    if (guild.client.soulMusic?.active(guild.id)) throw new Error('Une session musicale est en cours. Arrête-la depuis =musique avant de démarrer cette activité vocale.');
}
module.exports = { assertFree, assertNotMusic };
