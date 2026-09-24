const { randomUUID } = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, ChannelType, PermissionFlagsBits, Events, escapeMarkdown } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior, StreamType, entersState } = require('@discordjs/voice');
const youtube = require('../utils/youtubeMusic');
const { IDENTITY, COLORS } = require('../config/soulSociety');
const { hasBypass } = require('../utils/security');
const { personal } = require('../utils/memberCare');
const { isOff } = require('../utils/lineState');
const { assertFree } = require('../utils/musicVoiceGuard');
const MAX_QUEUE = 50;
const duration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const label = value => escapeMarkdown(String(value)).slice(0, 220);

function register(client) {
    if (client.soulMusic) return client.soulMusic;
    const sessions = new Map(), searches = new Map(), locks = new Map(), searching = new Set(), cooldown = new Map();
    function serial(guildId, action) {
        const previous = locks.get(guildId) || Promise.resolve();
        const next = previous.catch(() => {}).then(action);
        locks.set(guildId, next);
        next.finally(() => { if (locks.get(guildId) === next) locks.delete(guildId); }).catch(() => {});
        return next;
    }
    function permission(i) {
        if (i.guildId !== IDENTITY.guildId || !personal(i.member)) throw new youtube.MusicError('La musique est réservée aux membres de La Soul Society.');
        if (isOff()) throw new youtube.MusicError('Le bot est en pause.');
        if (client.maintenanceSystem?.checkCommandMaintenance?.('play')?.blocked) throw new youtube.MusicError('La musique est indisponible pendant la maintenance du bot.');
    }
    function voice(i, session) {
        permission(i);
        const channel = i.guild.members.cache.get(i.user.id)?.voice.channel;
        if (!channel || channel.type !== ChannelType.GuildVoice) throw new youtube.MusicError('Rejoins un salon vocal classique pour utiliser la musique.');
        if (session && channel.id !== session.channel.id) throw new youtube.MusicError('Rejoins le même vocal que le bot pour contrôler cette session.');
        const permissions = channel.permissionsFor(i.guild.members.me);
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) throw new youtube.MusicError('Le bot doit pouvoir voir ce vocal, s’y connecter et parler.');
        return channel;
    }
    function listeners(session) { return session.channel.members.filter(m => !m.user.bot); }
    function threshold(session) { return Math.max(1, Math.ceil(listeners(session).size / 2)); }
    function panel(session) {
        const current = session.current;
        const state = session.closed ? '⏹️ Session terminée' : session.status === 'paused' ? '⏸️ En pause' : session.status === 'loading' ? '⏳ Préparation de la musique' : current ? '▶️ Lecture en cours' : '🎶 En attente d’un titre';
        const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('🎵 Musique • La Soul Society')
            .setDescription(`**${state}**\n${current ? `[${label(current.title)}](${current.url})\n⏱️ ${duration(current.duration)} • Ajouté par <@${current.requester}>` : 'Utilise =play avec un titre ou un lien YouTube.'}`)
            .addFields({ name: '🔊 Volume', value: `${session.volume} %`, inline: true }, { name: '🎙️ Vocal', value: `<#${session.channel.id}>`, inline: true }, { name: '📜 File d’attente', value: `${session.tracks.length} titre(s)`, inline: true });
        if (session.notice) embed.addFields({ name: 'Information', value: session.notice.slice(0,1000) });
        if (session.votes.size) embed.addFields({ name: '⏭️ Votes pour passer', value: `${session.votes.size}/${threshold(session)}` });
        embed.setFooter({ text: 'Même vocal requis • Aven, les bypass et la fondation : passage immédiat • File : =queue' });
        const button = (action, text, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder().setCustomId(`music:${session.id}:${action}`).setLabel(text).setStyle(style).setDisabled(session.closed || disabled);
        return { embeds: [embed], components: [new ActionRowBuilder().addComponents(
            button('pause', session.status === 'paused' ? '▶ Reprendre' : '⏸ Pause', ButtonStyle.Primary, !current || session.status === 'loading'),
            button('skip', '⏭ Suivant', ButtonStyle.Secondary, !current),
            button('down', '🔉 Volume −'), button('up', '🔊 Volume +'), button('stop', '⏹ Arrêter', ButtonStyle.Danger)
        )], allowedMentions: { parse: [] } };
    }
    function refresh(session) {
        session.edits = (session.edits || Promise.resolve()).catch(() => {}).then(async () => {
            if (session.message) await session.message.edit(panel(session));
        }).catch(() => {});
        return session.edits;
    }
    function cancelTrack(session) {
        session.generation++;
        clearTimeout(session.startTimer);
        session.stream?.close(); session.stream = null;
        session.current = null; session.votes.clear(); session.player.stop(true);
    }
    function stop(session, notice = 'Session arrêtée.') {
        if (session.closed) return;
        session.closed = true;
        cancelTrack(session); session.tracks = []; session.notice = notice;
        if (sessions.get(session.guild.id) === session) sessions.delete(session.guild.id);
        if (session.connection && session.connection.state.status !== VoiceConnectionStatus.Destroyed) session.connection.destroy();
        refresh(session);
    }
    function finish(session, token, error) {
        if (session.closed || token !== session.generation || !session.current) return;
        if (error) session.notice = error instanceof youtube.MusicError ? error.message : 'La lecture a été interrompue. Le titre suivant sera essayé.';
        cancelTrack(session);
        session.status = 'idle'; session.idleSince = Date.now();
        setImmediate(() => pump(session));
    }
    function pump(session) {
        if (session.closed || session.current) return;
        if (isOff()) return stop(session, 'Bot mis en pause.');
        const track = session.tracks.shift();
        if (!track) { session.status = 'idle'; session.idleSince = Date.now(); refresh(session); return; }
        session.current = track; session.status = 'loading'; session.votes.clear();
        const token = ++session.generation;
        try {
            session.stream = youtube.open(track, error => finish(session, token, error));
            const resource = createAudioResource(session.stream.stream, { inputType: StreamType.Raw, inlineVolume: true, metadata: { token } });
            resource.volume.setVolume(session.volume / 100);
            session.player.play(resource);
            session.startTimer = setTimeout(() => finish(session, token, new youtube.MusicError('La lecture YouTube a expiré. Essaie une autre vidéo.')), 45000);
            session.startTimer.unref();
        } catch (error) { finish(session, token, error); }
        refresh(session);
    }
    async function connect(i) {
        const channel = voice(i);
        try { assertFree(i.guild); } catch (error) { throw new youtube.MusicError(error.message); }
        const session = { id: randomUUID(), guild: i.guild, channel, controller: i.user.id, tracks: [], current: null, volume: 50, votes: new Set(), generation: 0, status: 'idle', idleSince: Date.now(), closed: false, notice: '', player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }) };
        // Réserver avant le premier await pour protéger les jeux concurrents.
        sessions.set(i.guildId, session);
        try {
            session.connection = joinVoiceChannel({ channelId: channel.id, guildId: i.guildId, adapterCreator: i.guild.voiceAdapterCreator, group: 'soul-music', selfDeaf: true, selfMute: false });
            session.connection.on('error', () => stop(session, 'Connexion vocale interrompue. Relance =play.'));
            session.connection.on(VoiceConnectionStatus.Destroyed, () => stop(session, 'Le bot a quitté le vocal.'));
            session.connection.on(VoiceConnectionStatus.Disconnected, () => {
                Promise.race([entersState(session.connection, VoiceConnectionStatus.Signalling, 5000), entersState(session.connection, VoiceConnectionStatus.Connecting, 5000)]).catch(() => stop(session, 'Connexion vocale perdue.'));
            });
            session.player.on('stateChange', (before, after) => {
                if (after.status === AudioPlayerStatus.Playing && session.current) { clearTimeout(session.startTimer); session.status = 'playing'; session.pausedSince = null; refresh(session); }
                if (after.status === AudioPlayerStatus.Idle && before.resource) finish(session, before.resource.metadata.token);
            });
            session.player.on('error', error => finish(session, error.resource?.metadata?.token ?? session.generation, error));
            await entersState(session.connection, VoiceConnectionStatus.Ready, 20000);
            if (session.closed) throw new youtube.MusicError('La connexion vocale a été fermée. Réessaie.');
            voice(i, session); session.connection.subscribe(session.player);
            return session;
        } catch (error) { stop(session, 'Connexion impossible.'); throw new youtube.MusicError(error instanceof youtube.MusicError ? error.message : 'Connexion au vocal impossible. Vérifie les permissions du bot puis réessaie.'); }
    }
    async function enqueue(i, track) {
        return serial(i.guildId, async () => {
            let session = sessions.get(i.guildId);
            voice(i, session);
            if (!session?.message) canPost(i);
            if (!session) session = await connect(i);
            if (session.closed) throw new youtube.MusicError('La session vient de se terminer. Relance =play.');
            voice(i, session);
            if (session.tracks.length >= MAX_QUEUE) throw new youtube.MusicError('La file contient déjà 50 titres. Attends qu’une place se libère.');
            session.tracks.push({ ...track, requester: i.user.id });
            session.notice = ''; pump(session); refresh(session);
            return session;
        });
    }
    function canPost(i) {
        const permissions = i.channel?.permissionsFor?.(i.guild.members.me);
        const send = i.channel?.isThread?.() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, send, PermissionFlagsBits.EmbedLinks])) throw new youtube.MusicError('Le bot doit pouvoir envoyer des messages et intégrer des liens dans ce salon pour afficher le panel musical.');
    }
    async function publish(i, session) {
        // Un seul panel public suivi par session ; les anciens sont désactivés.
        return serial(i.guildId, async () => {
            if (session.closed) throw new youtube.MusicError('La session est terminée.');
            canPost(i);
            const old = session.message;
            const posted = await i.channel.send(panel(session));
            if (session.closed) { await posted.edit({ components: [] }).catch(() => {}); return; }
            session.message = posted;
            if (old && old.id !== posted.id) await old.edit({ components: [] }).catch(() => {});
            await refresh(session);
        });
    }
    async function respondError(i, error) {
        const message = error instanceof youtube.MusicError ? error.message : 'La musique n’a pas pu effectuer cette action. Vérifie les permissions du bot puis réessaie.';
        console.error('Musique :', error instanceof youtube.MusicError ? message : (error.code || error.name));
        const body = { content: '❌ ' + message, embeds: [], components: [] };
        if (i.deferred || i.replied) await i.editReply(body).catch(() => {});
        else await i.reply({ ...body, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    async function play(i) {
        permission(i); voice(i, sessions.get(i.guildId));
        if (searching.has(i.user.id) || Date.now() - (cooldown.get(i.user.id) || 0) < 5000) throw new youtube.MusicError('Patiente quelques secondes avant une nouvelle recherche.');
        if (searching.size >= 3) throw new youtube.MusicError('Plusieurs recherches sont en cours. Réessaie dans quelques secondes.');
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        searching.add(i.user.id); cooldown.set(i.user.id, Date.now());
        try {
            const result = await youtube.lookup(i.options.getString('recherche', true));
            permission(i); voice(i, sessions.get(i.guildId));
            if (result.search) {
                const key = randomUUID(); searches.set(key, { owner: i.user.id, guild: i.guildId, tracks: result.tracks, expires: Date.now() + 300000 });
                return i.editReply({ content: '🎵 Choisis le titre à ajouter (choix valable 5 minutes).', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('music-search:' + key).setPlaceholder('Choisir une musique YouTube').addOptions(result.tracks.map((t,n) => ({ label: t.title.slice(0,100), description: duration(t.duration), value: String(n) }))))] });
            }
            const session = await enqueue(i, result.tracks[0]);
            await i.editReply({ content: `✅ **${label(result.tracks[0].title)}** ajouté à la session musicale.` });
            if (!session.message) await publish(i, session);
        } finally { searching.delete(i.user.id); }
    }
    function skip(i, session) {
        voice(i, session);
        if (!session.current) throw new youtube.MusicError('Aucun titre en cours.');
        if (hasBypass(i)) { finish(session, session.generation); return '⏭️ Titre passé.'; }
        const currentListeners = listeners(session);
        for (const id of session.votes) if (!currentListeners.has(id)) session.votes.delete(id);
        session.votes.add(i.user.id);
        const needed = threshold(session);
        if (session.votes.size >= needed) { finish(session, session.generation); return '⏭️ Vote validé : titre passé.'; }
        refresh(session); return `🗳️ Vote enregistré : ${session.votes.size}/${needed}.`;
    }
    async function command(i, action) {
        try {
            permission(i);
            if (action === 'play') return await play(i);
            const session = sessions.get(i.guildId);
            if (!session) throw new youtube.MusicError('Aucune session musicale. Lance =play depuis un vocal.');
            await i.deferReply({ flags: MessageFlags.Ephemeral });
            if (action === 'queue') {
                const lines = session.tracks.slice(0,20).map((t,n) => `${n+1}. [${label(t.title).slice(0,80)}](${t.url}) • ${duration(t.duration)}`);
                return i.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle('📜 File musicale • La Soul Society').setDescription((session.current ? `**En cours : ${label(session.current.title)}**\n\n` : '') + (lines.join('\n') || 'Aucun titre en attente.')).setFooter({ text: `${session.tracks.length} titre(s) en attente • 20 premiers affichés` })] });
            }
            voice(i, session);
            if (action === 'skip') return i.editReply({ content: skip(i, session) });
            await publish(i, session);
            return i.editReply({ content: '🎵 Panel musical publié dans ce salon.' });
        } catch (error) { await respondError(i, error); }
    }
    async function handle(i) {
        try {
            permission(i);
            await i.deferReply({ flags: MessageFlags.Ephemeral });
            if (i.isStringSelectMenu() && i.customId.startsWith('music-search:')) {
                const key = i.customId.slice('music-search:'.length), selection = searches.get(key);
                if (!selection || selection.expires < Date.now()) throw new youtube.MusicError('Cette recherche a expiré. Relance =play.');
                if (selection.owner !== i.user.id || selection.guild !== i.guildId) throw new youtube.MusicError('Cette recherche appartient à un autre membre.');
                const track = selection.tracks[Number(i.values[0])];
                if (!track) throw new youtube.MusicError('Choix invalide.');
                searches.delete(key);
                const session = await enqueue(i, track);
                await i.message.edit({ components: [] }).catch(() => {});
                await i.editReply({ content: `✅ **${label(track.title)}** ajouté à la session musicale.` });
                if (!session.message) await publish(i, session);
                return;
            }
            const [,id,action] = i.customId.split(':'), session = sessions.get(i.guildId);
            if (!session || session.id !== id || session.closed) throw new youtube.MusicError('Cette session est terminée. Lance =play.');
            voice(i, session);
            let response;
            if (action === 'skip') response = skip(i, session);
            else {
                if (!hasBypass(i) && session.controller !== i.user.id) throw new youtube.MusicError('Seuls le membre ayant lancé la session, les bypass et la fondation peuvent changer le volume, mettre en pause ou arrêter.');
                if (action === 'stop') { stop(session); response = '⏹️ Musique arrêtée et vocal quitté.'; }
                else if (action === 'pause') {
                    if (!session.current || session.status === 'loading') throw new youtube.MusicError('Attends que la musique commence.');
                    if (session.status === 'paused') { session.player.unpause(); session.status = 'playing'; session.pausedSince = null; response = '▶️ Lecture reprise.'; }
                    else { session.player.pause(); session.status = 'paused'; session.pausedSince = Date.now(); response = '⏸️ Lecture en pause.'; }
                } else if (['up','down'].includes(action)) {
                    session.volume = Math.min(100, Math.max(0, session.volume + (action === 'up' ? 10 : -10)));
                    session.player.state.resource?.volume?.setVolume(session.volume / 100);
                    response = `🔊 Volume : ${session.volume} %.`;
                } else throw new youtube.MusicError('Action inconnue.');
            }
            await refresh(session); await i.editReply({ content: response });
        } catch (error) { await respondError(i, error); }
    }
    function tick() {
        const now = Date.now();
        for (const [key, search] of searches) if (search.expires <= now) searches.delete(key);
        for (const [id, time] of cooldown) if (now - time > 60000) cooldown.delete(id);
        for (const session of sessions.values()) {
            if (isOff() || client.maintenanceSystem?.checkCommandMaintenance?.('play')?.blocked) { stop(session, 'Bot en pause ou en maintenance.'); continue; }
            if (session.guild.members.me?.voice.channelId && session.guild.members.me.voice.channelId !== session.channel.id) { stop(session, 'Le bot a été déplacé. Relance =play dans le nouveau vocal.'); continue; }
            if (!listeners(session).size) session.emptySince ||= now; else session.emptySince = null;
            if (session.emptySince && now - session.emptySince >= 60000) { stop(session, 'Vocal vide depuis une minute.'); continue; }
            if (!session.current && now - session.idleSince >= 120000) { stop(session, 'File terminée depuis deux minutes.'); continue; }
            if (session.pausedSince && now - session.pausedSince >= 1800000) stop(session, 'Session en pause depuis 30 minutes.');
        }
    }
    const timer = setInterval(tick, 5000); timer.unref();
    client.on(Events.VoiceStateUpdate, (before, after) => {
        const session = sessions.get(after.guild.id);
        if (!session) return;
        if (after.id === client.user.id && before.channelId === session.channel.id && after.channelId !== session.channel.id) stop(session, 'Le bot a quitté le vocal musical.');
        if (!after.channelId || after.channelId !== session.channel.id) session.votes.delete(after.id);
    });
    const api = { command, handle, active: guildId => sessions.has(guildId), stopAll: () => { for (const session of sessions.values()) stop(session); }, sessions, searches, tick };
    client.soulMusic = api;
    return api;
}
module.exports = register;
module.exports.duration = duration;
