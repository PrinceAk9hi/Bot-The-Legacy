const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { IDENTITY, COLORS, ROBLOX } = require("../config/soulSociety");
const { hasBypass } = require("../utils/security");
const { read, update, ensurePanel } = require("../utils/recruitmentData");
const { findRobloxUserByUsername } = require("../utils/robloxAccount");
const { getDiscordLinkByRobloxId, setRobloxLink } = require("../utils/robloxLinks");
const CHANNEL = "1540836643433615360";
const KEY = "welcome_start";
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const GUIDE = [
    ["Report sanction", "Déclare toute nouvelle sanction reçue en jeu. Une sanction non déclarée peut entraîner une sanction plus lourde."],
    ["Convocation", "Ce salon sert à convoquer un membre de la famille en cas de problème ou de question."],
    ["Hiérarchisation", "Consulte le prochain rang à atteindre et la place de chacun dans la hiérarchie."],
    ["Test activité", "Chaque dimanche soir, un ping d’activité est publié. Tu as 24 heures pour réagir au message ; sans réaction, tu seras convoqué dans les plus brefs délais."],
    ["Notes", "Ce salon permet de recevoir une note globale sur chaque membre."],
    ["Fiche RP", "Retrouve le lexique RP/HRP et les notions importantes à connaître pour le roleplay."]
];
const busy = new Set();
function button(id, label, style = ButtonStyle.Primary) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style); }
function row(...buttons) { return new ActionRowBuilder().addComponents(...buttons); }
function profile(actorId) { return read("welcomeProfiles")[actorId]; }
function patch(actorId, changes) { update("welcomeProfiles", state => { state[actorId] = { ...state[actorId], ...changes, updatedAt: Date.now() }; }); }
const INTRO = "Bienvenue ! Ce parcours te guide en cinq étapes :\n\n**1. Ton profil Discord** : nom, ID et date de naissance. Ta date de naissance sert au rôle **Joyeux anniversaire**, pour le jour de ton anniversaire.\n**2. Ton profil Roblox** : nom et @ pour relier ton compte.\n**3. Tes disponibilités vocales** : tes horaires pour chaque jour de la semaine.\n**4. La communauté Roblox** : le lien pour la rejoindre et la suite de ton admission.\n**5. Les salons** : les informations essentielles pour bien commencer.\n\nTon parcours personnel se met à jour dans un seul message. Tes étapes sont sauvegardées ; tu peux reprendre plus tard avec /bienvenue. Ta date de naissance reste privée.";
function introPayload() {
    return { content: null, embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🌸 Ton accueil Soul Society").setDescription(INTRO)], components: [row(button("welcome_begin", "Commencer / continuer"))], allowedMentions: { parse: [] } };
}
function panelPayload() {
    return { embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("🌸 Bienvenue dans Soul Society")
        .setDescription(INTRO)],
        components: [row(button(KEY, "Commencer / reprendre mon accueil"))], allowedMentions: { parse: [] } };
}
function stepPayload(p) {
    const embed = new EmbedBuilder().setColor(COLORS.primary);
    let components;
    switch (p.step) {
        case "profile": embed.setTitle("1/5 • Profil Discord").setDescription("Indique ton nom Discord, ton ID et ta date de naissance (JJ/MM/AAAA), utilisée pour le rôle Joyeux anniversaire le jour de ton anniversaire. L’ID est prérempli. Seule la direction peut renseigner le profil d’un autre membre."); components = [row(button("welcome_profile", "Renseigner mon profil"))]; break;
        case "roblox": embed.setTitle("2/5 • Profil Roblox").setDescription("Indique ton nom et ton @ Roblox. Le bot recherchera le compte et enregistrera sa liaison avec ton profil Discord. Utilise le @ exact, pas uniquement le nom d’affichage."); components = [row(button("welcome_roblox", "Renseigner mon Roblox"))]; break;
        case "week": embed.setTitle("3/5 • Disponibilités vocales").setDescription("Renseigne tes horaires habituels du lundi au vendredi, avec ton fuseau horaire si nécessaire. Écris « indisponible » les jours où tu ne peux pas venir."); components = [row(button("welcome_week", "Lundi à vendredi"))]; break;
        case "weekend": embed.setTitle("3/5 • Disponibilités du week-end").setDescription("Il reste les disponibilités du samedi et du dimanche."); components = [row(button("welcome_weekend", "Samedi et dimanche"))]; break;
        case "community": embed.setTitle("4/5 • Communauté Roblox").setDescription(`Rejoins la communauté **Soul Society** : [ouvrir la communauté](${ROBLOX.groupUrl}).\nTa demande sera acceptée en temps voulu par l’équipe. Le bot ne valide pas automatiquement ton admission.`); components = [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Communauté Roblox").setURL(ROBLOX.groupUrl), button("welcome_community", "J’ai lu, continuer"))]; break;
        case "guide": embed.setTitle("5/5 • Les salons à connaître").addFields(GUIDE.map(([name,value]) => ({name,value}))); components = [row(button("welcome_finish", "Terminer mon accueil", ButtonStyle.Success))]; break;
        default: embed.setTitle("✅ Accueil terminé").setDescription("Ton profil est enregistré. Tu peux mettre tes informations et tes disponibilités à jour à tout moment."); components = [row(button("welcome_restart", "Mettre à jour mon profil"))];
    }
    return { content: null, embeds: [embed], components, allowedMentions: { parse: [] } };
}
async function start(interaction) {
    if (interaction.guildId !== IDENTITY.guildId) return interaction.reply({ content: "Ce parcours est réservé au serveur Soul Society.", flags: MessageFlags.Ephemeral });
    if (!profile(interaction.user.id)) patch(interaction.user.id, { step: "profile", discordId: interaction.user.id, discordName: interaction.user.username });
    return interaction.reply({ ...introPayload(), flags: MessageFlags.Ephemeral });
}
function input(id, label, value = "", long = false, max = 100) {
    const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(true).setMaxLength(max);
    if (value) field.setValue(String(value).slice(0, max));
    return row(field);
}
function birthday(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return false;
    const [,d,m,y] = match.map(Number);
    const date = new Date(Date.UTC(y,m-1,d));
    return y >= 1900 && date <= new Date() && date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d;
}
async function publishAvailability(client, actorId) {
    const p = profile(actorId);
    const channel = await client.channels.fetch(CHANNEL);
    const payload = { embeds: [new EmbedBuilder().setColor(COLORS.primary).setTitle("📅 Disponibilités vocales")
        .setDescription(`<@${p.discordId}> • @${p.robloxUsername}`)
        .addFields(DAYS.map(day => ({ name: day, value: p.availability[day] || "Non renseigné" })))], allowedMentions: { parse: [] } };
    let message;
    if (p.availabilityMessageId) {
        try { message = await channel.messages.fetch(p.availabilityMessageId); }
        catch (error) { if (error.code !== 10008) throw error; }
    }
    if (message) await message.edit(payload); else message = await channel.send(payload);
    patch(actorId, { availabilityMessageId: message.id });
}
async function handle(interaction) {
    const id = interaction.customId || "";
    if (!id.startsWith("welcome_") || interaction.guildId !== IDENTITY.guildId) return;
    if (id === KEY && interaction.isButton()) return start(interaction);
    const actor = interaction.user.id;
    if (busy.has(actor)) return interaction.reply({ content: "⏳ Enregistrement en cours, réessaie dans un instant.", flags: MessageFlags.Ephemeral });
    const p = profile(actor);
    if (!p) return start(interaction);
    if (interaction.isButton()) {
        if (id === "welcome_begin") return interaction.update(stepPayload(p));
        if (id === "welcome_restart") {
            patch(actor, { step: "profile" });
            return interaction.update(stepPayload(profile(actor)));
        }
        if (id === "welcome_community" && p.step === "community") {
            patch(actor, { step: "guide" });
            return interaction.update(stepPayload(profile(actor)));
        }
        if (id === "welcome_finish" && p.step === "guide") {
            await interaction.deferUpdate(); busy.add(actor);
            try {
                await publishAvailability(interaction.client, actor);
                patch(actor, { step: "done", completedAt: Date.now() });
                return await interaction.editReply(stepPayload(profile(actor)));
            } finally { busy.delete(actor); }
        }
        if (id !== "welcome_" + p.step) return interaction.update(stepPayload(p));
        const modal = new ModalBuilder().setCustomId("welcome_submit_" + p.step).setTitle("Soul Society • " + (p.step === "profile" ? "Profil" : p.step === "roblox" ? "Roblox" : "Disponibilités"));
        if (p.step === "profile") modal.addComponents(input("name", "Nom Discord", p.discordName), input("discord", "ID Discord", p.discordId, false, 20), input("birth", "Date de naissance (JJ/MM/AAAA)", p.birthDate, false, 10));
        else if (p.step === "roblox") modal.addComponents(input("name", "Nom Roblox", p.robloxDisplayName), input("username", "@ Roblox exact", p.robloxUsername, false, 50));
        else if (["week", "weekend"].includes(p.step)) for (const day of (p.step === "week" ? DAYS.slice(0,5) : DAYS.slice(5))) modal.addComponents(input(day.toLowerCase(), day, p.availability?.[day], true, 300));
        else return;
        return interaction.showModal(modal);
    }
    if (!interaction.isModalSubmit() || !id.startsWith("welcome_submit_")) return;
    // Modal opened from this personal page: acknowledge and edit that same message.
    if (interaction.isFromMessage()) await interaction.deferUpdate();
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (id !== "welcome_submit_" + p.step) return interaction.editReply({ ...stepPayload(p), content: "Ce formulaire a déjà été traité. Reprends ci-dessous." });
    busy.add(actor);
    try {
        const field = name => interaction.fields.getTextInputValue(name).trim();
        if (p.step === "profile") {
            const discordId = field("discord");
            if (!/^\d{17,20}$/.test(discordId)) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ ID Discord invalide. Rouvre le formulaire." });
            if (discordId !== actor && !hasBypass(interaction)) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Tu peux uniquement modifier ton propre profil. Demande à la direction pour corriger un autre compte." });
            if (!birthday(field("birth"))) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Date de naissance invalide. Utilise JJ/MM/AAAA." });
            if (!await interaction.guild.members.fetch(discordId).catch(() => null)) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Ce membre n’est pas présent sur le serveur." });
            patch(actor, { discordId, discordName: field("name"), birthDate: field("birth"), step: "roblox",
                ...(discordId !== p.discordId ? { robloxUsername: null, robloxDisplayName: null, robloxId: null, availability: {}, availabilityMessageId: null } : {}) });
        } else if (p.step === "roblox") {
            // An API lookup validates the account's existence; this is a declared association, not proof of ownership.
            const result = await findRobloxUserByUsername(field("username"));
            if (!result.success) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Compte Roblox introuvable ou API indisponible. Vérifie le @ et réessaie depuis le bouton." });
            const other = getDiscordLinkByRobloxId(result.user.id);
            if (other && other.discordUserId !== p.discordId && !hasBypass(interaction)) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Ce compte Roblox est déjà lié à un autre Discord. Contacte l’équipe." });
            setRobloxLink({ discordUserId: p.discordId, robloxUserId: result.user.id, robloxUsername: result.user.username, source: "bienvenue-declaration" });
            patch(actor, { robloxDisplayName: field("name"), robloxUsername: result.user.username, robloxId: result.user.id, step: "week" });
        } else if (["week", "weekend"].includes(p.step)) {
            const availability = { ...p.availability };
            for (const day of (p.step === "week" ? DAYS.slice(0,5) : DAYS.slice(5))) availability[day] = field(day.toLowerCase());
            patch(actor, { availability, step: p.step === "week" ? "weekend" : "community" });
        }
        return await interaction.editReply(stepPayload(profile(actor)));
    } finally { busy.delete(actor); }
}
async function notifyArrival(member) {
    if (member.guild.id !== IDENTITY.guildId || member.user.bot) return;
    const saved = read("welcomeNotifications")[member.id];
    if (saved?.joinedTimestamp === member.joinedTimestamp) return;
    const channel = await member.guild.channels.fetch(CHANNEL);
    await channel.send({ content: `Bienvenue <@${member.id}> ! Présente ton profil et indique tes disponibilités vocales avec le bouton ci-dessous.`, components: [row(button(KEY, "Compléter mon accueil"))], allowedMentions: { parse: [], users: [member.id] } });
    update("welcomeNotifications", state => { state[member.id] = { ...state[member.id], joinedTimestamp: member.joinedTimestamp }; });
}
async function notifyRecruit(member) {
    if (member.guild.id !== IDENTITY.guildId) return;
    if (!read("welcomeNotifications")[member.id]?.recruitDmSent) {
        try {
            await member.send(`🌸 Bienvenue dans Soul Society ! Rejoins notre communauté Roblox : ${ROBLOX.groupUrl}\nTa demande sera acceptée en temps voulu. Complète ton accueil et tes disponibilités vocales dans <#${CHANNEL}> avec /bienvenue ou le bouton du panel.`);
            update("welcomeNotifications", state => { state[member.id] = { ...state[member.id], recruitDmSent: true }; });
        } catch { console.warn("⚠️ MP de bienvenue indisponible ; lien accessible dans le parcours d’accueil."); }
    }
    await notifyArrival(member).catch(error => console.error("❌ Message accueil :", error.message));
}
function register(client) {
    client.once(Events.ClientReady, () => ensurePanel(client, CHANNEL, KEY, panelPayload()).catch(error => console.error("❌ Panel accueil :", error.message)));
    client.on(Events.GuildMemberAdd, member => notifyArrival(member).catch(error => console.error("❌ Accueil membre :", error.message)));
    client.on(Events.InteractionCreate, async interaction => {
        try { await handle(interaction); }
        catch (error) {
            console.error("❌ Parcours accueil :", error.message);
            const payload = { ...(profile(interaction.user.id) ? stepPayload(profile(interaction.user.id)) : introPayload()), content: "❌ L’enregistrement n’a pas abouti. Réessaie depuis cette page ; les étapes enregistrées sont conservées." };
            if (interaction.deferred) await interaction.editReply(payload).catch(() => {});
            else if (!interaction.replied) await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    });
}
module.exports = register;
Object.assign(module.exports, { start, handle, notifyRecruit, notifyArrival, panelPayload, stepPayload, birthday, CHANNEL, KEY });
