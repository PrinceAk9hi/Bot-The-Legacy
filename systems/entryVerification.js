const { randomUUID } = require('node:crypto');
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, escapeMarkdown } = require('discord.js');
const { IDENTITY, COLORS, EMOJIS } = require('../config/soulSociety');
const { read, update, ensurePanel } = require('../utils/recruitmentData');
const { isOff } = require('../utils/lineState');
const gate = require('../utils/securityGate');
const CHANNEL = '1471905200997663011';
const ROLES = ['1502983003616575519', '1468701262102134891'];
const KEY = 'entry_verify';
const row = (...c) => new ActionRowBuilder().addComponents(...c);
function existing(id) {
    const verified = read('entryVerification')[id];
    if (verified?.confirmedAt) return verified;
    const link = read('robloxLinks')[id];
    if (/^\d+$/.test(String(link?.robloxUserId || ''))) return { robloxId: String(link.robloxUserId), robloxName: link.robloxUsername, source: 'liaison existante' };
    const profiles = read('welcomeProfiles');
    const p = profiles[id];
    if (p?.membershipVerifiedAt && p.membershipRobloxId === p.robloxId && (!p.discordId || p.discordId === id)) return { robloxId: p.robloxId, robloxName: p.robloxUsername, source: 'bienvenue existant' };
    return null;
}
async function grant(member, profile) {
    for (const id of ROLES) {
        const role = member.guild.roles.cache.get(id) || await member.guild.roles.fetch(id);
        if (!role?.editable) throw Error('Les rôles d’accès ne sont pas modifiables par le bot. Contacte la gestion.');
    }
    for (const id of ROLES) if (!member.roles.cache.has(id)) await member.roles.add(id, 'Vérification d’accès validée');
    const confirmed = { ...profile, confirmedAt: profile.confirmedAt || Date.now(), discordId: member.id };
    update('entryVerification', data => { data[member.id] = confirmed; });
    return confirmed;
}
function modal(profile = {}) {
    const input = (id, title, value, max, paragraph = false) => {
        const f = new TextInputBuilder().setCustomId(id).setLabel(title).setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(true).setMaxLength(max);
        if (value) f.setValue(String(value).slice(0, max));
        return row(f);
    };
    return new ModalBuilder().setCustomId('entry_submit').setTitle('Vérification • La Soul Society').addComponents(
        input('roblox', 'Pseudo Roblox, sans @', profile.robloxName, 20),
        input('discord', 'Nom Discord, sans @', profile.discordName, 32),
        input('reason', 'Pourquoi souhaites-tu rejoindre le serveur ?', profile.reason, 1000, true));
}
function panel() {
    return { allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(COLORS.primary)
        .setTitle('🌸 Bienvenue dans la Soul Society')
        .setDescription(`${EMOJIS.logo} **Bienvenue dans notre communauté !**\n\nPour accéder au serveur, commence par la vérification ci-dessous. Tes réponses seront transmises à l’équipe de sécurité.\n\n**1. Clique sur Vérifier**\nIndique ton pseudo Roblox et ton nom Discord **sans @**, puis la raison de ta venue.\n\n**2. Confirme ton profil Roblox**\nLe bot retrouve le profil correspondant. Vérifie le nom et ouvre le lien avant de confirmer. Si ce n’est pas toi, corrige ton pseudo.\n\n**3. Accède au serveur**\nUne fois la vérification validée, tes rôles d’accès sont attribués automatiquement.\n\n✅ Une liaison Roblox déjà enregistrée est réutilisée : inutile de remplir à nouveau le formulaire.\n🔒 Ne communique jamais ton mot de passe ni ton cookie Roblox.`)
        .setFooter({ text: 'La Soul Society • Vérification d’accès • Profil Roblox déclaré par le membre' })],
        components: [row(new ButtonBuilder().setCustomId(KEY).setLabel('Vérifier').setEmoji('✅').setStyle(ButtonStyle.Success))] };
}
async function findRoblox(name) {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Roblox est indisponible. Réessaie dans quelques instants.');
    const user = (await response.json()).data?.[0];
    if (!user?.id || !user.name) throw Error('Aucun profil trouvé. Vérifie le pseudo Roblox, sans @.');
    return { robloxId: String(user.id), robloxName: user.name, displayName: user.displayName || user.name };
}
function register(client) {
    if (client.entryVerification) return;
    const sessions = new Map(), busy = new Set();
    async function handle(i) {
        if (!i.customId?.startsWith('entry_') || i.guildId !== IDENTITY.guildId) return;
        if (isOff()) return i.reply({ content: 'Le bot est temporairement en pause.', flags: MessageFlags.Ephemeral });
        if (busy.has(i.user.id)) return i.reply({ content: '⏳ Ta vérification est déjà en cours.', flags: MessageFlags.Ephemeral });
        busy.add(i.user.id);
        try {
            if (i.customId === KEY) {
                const profile = existing(i.user.id);
                if (!profile && Date.now() - i.user.createdTimestamp >= 45 * 86400000) return await i.showModal(modal({ discordName: i.user.username }));
                await i.deferReply({ flags: MessageFlags.Ephemeral });
                const member = await i.guild.members.fetch({ user: i.user.id, force: true });
                if (!await gate.check(member)) return await i.editReply('Ta demande d’accès n’a pas pu être validée.');
                if (!profile) return await i.editReply('Utilise à nouveau le bouton Vérifier pour ouvrir le formulaire.');
                await grant(member, profile);
                return await i.editReply('✅ Ta liaison Roblox est déjà enregistrée. Tes rôles d’accès ont été appliqués.');
            }
            if (i.customId.startsWith('entry_retry:')) {
                const draft = sessions.get(i.user.id);
                if (!draft || draft.token !== i.customId.split(':')[1] || draft.expires < Date.now()) throw Error('Cette vérification a expiré. Clique sur Vérifier.');
                return await i.showModal(modal(draft));
            }
            if (i.customId === 'entry_submit') {
                await i.deferReply({ flags: MessageFlags.Ephemeral });
                const member = await i.guild.members.fetch({ user: i.user.id, force: true });
                if (!await gate.check(member)) return await i.editReply('Ta demande d’accès n’a pas pu être validée.');
                const name = i.fields.getTextInputValue('roblox').trim(), discordName = i.fields.getTextInputValue('discord').trim(), reason = i.fields.getTextInputValue('reason').trim();
                if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw Error('Indique ton pseudo Roblox sans @ (3 à 20 caractères : lettres, chiffres ou _).');
                if (!discordName || discordName.includes('@') || !reason) throw Error('Indique ton nom Discord sans @ et la raison de ta venue.');
                const profile = await findRoblox(name);
                const draft = { ...profile, discordName, reason, token: randomUUID(), expires: Date.now() + 30 * 60000 };
                sessions.set(i.user.id, draft);
                return await i.editReply({ content: null, embeds: [new EmbedBuilder().setColor(COLORS.primary)
                    .setTitle('Est-ce bien ton profil Roblox ?').setDescription(`**${escapeMarkdown(profile.displayName)}**\nPseudo : **${escapeMarkdown(profile.robloxName)}**\nID : ${profile.robloxId}\n\n[Ouvrir le profil Roblox](https://www.roblox.com/users/${profile.robloxId}/profile)\n\nConfirme uniquement s’il s’agit de ton compte.`)],
                    components: [row(new ButtonBuilder().setCustomId('entry_confirm:' + draft.token).setLabel('Oui, c’est mon profil').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('entry_retry:' + draft.token).setLabel('Non, changer le pseudo').setStyle(ButtonStyle.Danger))], allowedMentions: { parse: [] } });
            }
            if (i.customId.startsWith('entry_confirm:')) {
                await i.deferUpdate();
                const draft = sessions.get(i.user.id);
                if (!draft || draft.token !== i.customId.split(':')[1] || draft.expires < Date.now()) throw Error('Cette vérification a expiré. Clique sur Vérifier.');
                const member = await i.guild.members.fetch({ user: i.user.id, force: true });
                if (!await gate.check(member)) return await i.editReply({ content: 'Ta demande d’accès n’a pas pu être validée.', embeds: [], components: [] });
                await grant(member, { robloxId: draft.robloxId, robloxName: draft.robloxName, discordName: draft.discordName, reason: draft.reason, source: 'formulaire confirmé' });
                sessions.delete(i.user.id);
                await gate.log(i.guild, '✅ Vérification d’accès validée', member, `Nom saisi : ${escapeMarkdown(draft.discordName)}\nRoblox : ${escapeMarkdown(draft.robloxName)} (${draft.robloxId})\nhttps://www.roblox.com/users/${draft.robloxId}/profile\nRaison : ${escapeMarkdown(draft.reason)}`);
                return await i.editReply({ content: '✅ Vérification validée ! Tes rôles ont été ajoutés. Bienvenue dans la Soul Society.', embeds: [], components: [] });
            }
        } catch (e) {
            const payload = { content: '❌ ' + (e.code ? 'Opération impossible. Contacte la gestion pour vérifier les permissions.' : e.message), allowedMentions: { parse: [] } };
            if (i.deferred || i.replied) await i.editReply(payload).catch(() => {});
            else await i.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
        } finally { busy.delete(i.user.id); }
    }
    let running = false, migrated = false;
    async function migrate() {
        // Lire les fichiers avant toute opération Discord : une erreur interrompt la migration.
        for (const name of ['entryVerification', 'robloxLinks', 'welcomeProfiles']) {
            const data = read(name);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Données de vérification invalides : ' + name);
        }
        const guild = client.guilds.cache.get(IDENTITY.guildId);
        if (!guild) return;
        let after, failures = 0;
        do {
            const batch = await guild.members.list({ limit: 1000, ...(after ? { after } : {}) });
            for (const member of batch.values()) {
                if (isOff()) return;
                if (member.user.bot || busy.has(member.id)) continue;
                busy.add(member.id);
                try {
                    const profile = existing(member.id);
                    if (profile && (!profile.confirmedAt || ROLES.some(id => !member.roles.cache.has(id)))) {
                        if (await gate.check(member)) {
                            await grant(member, profile);
                            await gate.log(guild, '✅ Accès rétabli — liaison Roblox existante', member, `Roblox : ${escapeMarkdown(profile.robloxName || 'Nom non enregistré')} (${profile.robloxId})\nLes deux rôles d’accès ont été appliqués sans nouveau formulaire.`);
                        }
                    }
                    await client.accessControls?.syncVoice(member);
                } catch { failures++; }
                finally { busy.delete(member.id); }
            }
            if (batch.size < 1000) break;
            after = batch.last().id;
        } while (true);
        migrated = failures === 0;
        if (failures) console.warn('Vérification : membres à resynchroniser', failures);
    }
    async function reconcile() {
        if (running || isOff()) return;
        running = true;
        try {
            await ensurePanel(client, CHANNEL, KEY, panel());
            if (!migrated) await migrate();
            for (const [id, s] of sessions) if (s.expires < Date.now()) sessions.delete(id);
        } finally { running = false; }
    }
    client.entryVerification = { reconcile };
    client.on(Events.GuildMemberAdd, member => {
        if (member.guild.id !== IDENTITY.guildId || member.user.bot || isOff() || busy.has(member.id)) return;
        busy.add(member.id);
        (async () => {
            const profile = existing(member.id);
            if (!await gate.check(member, Boolean(profile))) return;
            if (profile) {
                await grant(member, profile);
                await gate.log(member.guild, '✅ Accès rétabli à l’arrivée', member, 'Liaison Roblox existante : aucun nouveau formulaire demandé.');
            }
        })().catch(e => console.warn('Accès arrivée :', e.code || e.message)).finally(() => busy.delete(member.id));
    });
    client.on(Events.InteractionCreate, i => handle(i).catch(e => console.warn('Vérification :', e.code || e.name)));
    const start = () => { reconcile().catch(console.warn); setInterval(() => reconcile().catch(console.warn), 5 * 60000).unref(); };
    if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}
module.exports = register;
Object.assign(module.exports, { existing, grant, panel, findRoblox, ROLES });
