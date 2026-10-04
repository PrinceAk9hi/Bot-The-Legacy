const { randomUUID } = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Events, MessageFlags, escapeMarkdown } = require('discord.js');
const catalog = require('../utils/soundCatalog');

module.exports = function registerPanel(client, api) {
    const panels = new Map();
    const row = (...components) => new ActionRowBuilder().addComponents(...components);
    async function payload(p) {
        const s = api.state(p.guildId);
        const live = Boolean(s && s === p.session && !s.closed);
        const sounds = live ? await catalog.list() : [];
        const pages = Math.max(1, Math.ceil(sounds.length / 25));
        p.page = Math.max(0, Math.min(p.page, pages - 1));
        const embed = new EmbedBuilder().setColor(live ? 0xf6b9d4 : 0x777777)
            .setTitle('🔊 Soundboard • La Soul Society')
            .setDescription(live
                ? `${s.paused ? '⏸️ En pause' : '▶️ Lecture'} : **${escapeMarkdown(s.current?.name || 'En attente du prochain son')}**\nVocal : <#${s.channel.id}>\nVolume : **${Math.round(s.volume * 100)} %**\nFile : **${s.queue.length} son(s)**`
                : '⏹️ Lecture terminée. Le bot a quitté le vocal. Relance /sound pour écouter un autre son.')
            .setFooter({ text: 'Même vocal requis • Le menu ajoute un son à la file • Volume maximum : 100 %' });
        if (!live) return { embeds: [embed], components: [], allowedMentions: { parse: [] } };
        const button = (action, label, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder()
            .setCustomId(`soundpanel:${p.id}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);
        const components = [row(
            button('pause', s.paused ? '▶ Reprendre' : '⏸ Pause', ButtonStyle.Primary, !s.current),
            button('next', '⏭ Suivant', ButtonStyle.Secondary, !s.current),
            button('down', '🔉 Volume −', ButtonStyle.Secondary, s.volume <= 0),
            button('up', '🔊 Volume +', ButtonStyle.Secondary, s.volume >= 1),
            button('stop', '⏹ Arrêter', ButtonStyle.Danger)
        )];
        if (sounds.length) components.push(row(new StringSelectMenuBuilder().setCustomId(`soundpanel:${p.id}:choose`)
            .setPlaceholder(`Choisir un son • Page ${p.page + 1}/${pages}`)
            .addOptions(sounds.slice(p.page * 25, (p.page + 1) * 25).map(sound => ({
                label: sound.name.slice(0, 100), value: sound.id, description: sound.file.slice(0, 100)
            })))));
        if (pages > 1) components.push(row(button('prevpage', '◀ Sons précédents', ButtonStyle.Secondary, p.page === 0),
            button('nextpage', 'Sons suivants ▶', ButtonStyle.Secondary, p.page === pages - 1)));
        return { embeds: [embed], components, allowedMentions: { parse: [] } };
    }
    function refresh(guildId) {
        const p = panels.get(guildId);
        if (!p) return Promise.resolve();
        p.edits = (p.edits || Promise.resolve()).catch(() => {}).then(async () => {
            if (p.message) await p.message.edit(await payload(p));
        }).catch(() => {});
        return p.edits;
    }
    async function show(i) {
        const session = api.state(i.guildId);
        if (!session) return;
        const previous = panels.get(i.guildId);
        if (previous?.session === session && previous.message) {
            await refresh(i.guildId);
            return previous.message;
        }
        // Publish once per voice session, even when several commands complete together.
        if (previous?.session === session && previous.sending) return previous.sending;
        const p = { id: randomUUID(), guildId: i.guildId, session, page: 0 };
        panels.set(i.guildId, p);
        p.sending = (async () => {
            p.message = await i.channel.send(await payload(p));
            await refresh(i.guildId);
            return p.message;
        })();
        try { return await p.sending; }
        catch (error) { if (panels.get(i.guildId) === p) panels.delete(i.guildId); throw error; }
        finally { p.sending = null; }
    }
    client.on(Events.InteractionCreate, async i => {
        if (!(i.isButton() || i.isStringSelectMenu()) || !i.customId.startsWith('soundpanel:')) return;
        const [, id, action] = i.customId.split(':');
        try {
            const p = panels.get(i.guildId);
            if (!p || p.id !== id || p.message?.id !== i.message.id || api.state(i.guildId) !== p.session) {
                return await i.reply({ content: 'Ce panneau a expiré. Relance /sound.', flags: MessageFlags.Ephemeral });
            }
            api.check(i);
            await i.deferUpdate();
            if (action === 'choose') {
                const result = await api.enqueue(i, i.values[0]);
                await i.followUp({ content: `📃 ${escapeMarkdown(result.name)} ${result.queued ? 'ajouté à la file.' : 'lancé.'}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
            } else if (action === 'prevpage') p.page--;
            else if (action === 'nextpage') p.page++;
            else api.control(i, action);
            await refresh(i.guildId);
        } catch (error) {
            const data = { content: '❌ ' + error.message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
            if (i.deferred || i.replied) await i.followUp(data).catch(() => {});
            else await i.reply(data).catch(() => {});
        }
    });
    return { show, refresh };
};
