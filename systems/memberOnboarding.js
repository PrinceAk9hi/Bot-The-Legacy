const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { IDENTITY, COLORS, ROBLOX, EMOJIS } = require("../config/soulSociety");
const { hasBypass } = require("../utils/security");
const { read, update } = require("../utils/recruitmentData");
const { findRobloxUserByUsername } = require("../utils/robloxAccount");
const { getDiscordLinkByRobloxId, setRobloxLink } = require("../utils/robloxLinks");
const CHANNEL = "1540833767759814747";
const KEY = "welcome_start";
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const AVAILABILITY = {
    week: { none: "Pas disponible", short: "1h à 3h", always: "Tout le temps disponible", alternating: "Horaire de travail alternante" },
    weekend: { all: "Disponible tout le weekend", medium: "Uniquement 3 à 4h", short: "1h maximum" }
};
function availabilityRow(period) {
    return row(...Object.entries(AVAILABILITY[period]).map(([value, label]) => button('welcome_avail_' + period + '_' + value, label)));
}
function availabilityFields(p) {
    // Keep old daily entries readable without overwriting existing profiles.
    const old = days => days.map(day => day + ' : ' + (p.availability?.[day] || 'Non renseigné')).join('\n').slice(0, 1024);
    return [
        { name: "Semaine", value: AVAILABILITY.week[p.availabilityChoices?.week] || old(DAYS.slice(0, 5)) },
        { name: "Week-end", value: AVAILABILITY.weekend[p.availabilityChoices?.weekend] || old(DAYS.slice(5)) }
    ];
}
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
function welcomeEmbed() {
    return new EmbedBuilder().setColor(COLORS.primary)
        .setAuthor({ name: "La Soul Society • Ton parcours d’accueil", iconURL: "https://cdn.discordapp.com/emojis/1548783936010977380.png" })
        .setThumbnail("https://cdn.discordapp.com/emojis/1548783936010977380.png")
        .setFooter({ text: "La Soul Society • Un pas de plus dans la famille 🌸" });
}
const INTRO = "🌸 **Bienvenue dans la famille !**\nComplète ces cinq étapes pour préparer ton arrivée et profiter des fonctions de la Soul Society :\n\n**1. Ton profil Discord** : nom, ID et date de naissance. Ta date de naissance sert au rôle **Joyeux anniversaire**, pour le jour de ton anniversaire.\n<:roblox:1550573304258236426> **2. Ton profil Roblox** : nom et @ pour relier ton compte.\n**3. Tes disponibilités vocales** : un choix pour la semaine, puis un choix pour le week-end.\n<:certification:1550573424080977930> **4. La communauté Roblox** : le lien pour la rejoindre et la suite de ton admission.\n<a:speaker:1548785378276810844> **5. Les salons** : les informations essentielles pour bien commencer.\n\nTon parcours personnel se met à jour dans un seul message. Tes étapes sont sauvegardées ; tu peux reprendre plus tard avec /bienvenue. Ta date de naissance reste privée.";
function introPayload() {
    return { content: null, embeds: [welcomeEmbed().setTitle("🌸 Ton accueil La Soul Society").setDescription(INTRO)], components: [row(button("welcome_begin", "Commencer / continuer"))], allowedMentions: { parse: [] } };
}
function panelPayload() {
    return { embeds: [welcomeEmbed().setTitle("🌸 Bienvenue dans la Soul Society")
        .setDescription(INTRO)],
        components: [row(button(KEY, "Commencer / reprendre mon accueil"))], allowedMentions: { parse: [] } };
}
function stepPayload(p) {
    const embed = welcomeEmbed();
    let components;
    switch (p.step) {
        case "profile": embed.setTitle("👤 1/5 • Faisons connaissance").setDescription("Indique ton nom Discord, ton ID et ta date de naissance (JJ/MM/AAAA), utilisée pour le rôle Joyeux anniversaire le jour de ton anniversaire. L’ID est prérempli. Seule la direction peut renseigner le profil d’un autre membre."); components = [row(button("welcome_profile", "Renseigner mon profil"))]; break;
        case "roblox": embed.setTitle("🎮 2/5 • Ton identité Roblox").setDescription("Indique ton nom et ton @ Roblox. Le bot recherchera le compte et enregistrera sa liaison avec ton profil Discord. Utilise le @ exact, pas uniquement le nom d’affichage."); components = [row(button("welcome_roblox", "Renseigner mon Roblox"))]; break;
        case "week": embed.setTitle("📅 3/5 • Ta semaine").setDescription("Choisis la proposition qui correspond à tes disponibilités habituelles en semaine."); components = [availabilityRow("week")]; break;
        case "weekend": embed.setTitle("📅 3/5 • Ton week-end").setDescription("Choisis maintenant tes disponibilités habituelles le week-end."); components = [availabilityRow("weekend")]; break;
        case "community": embed.setTitle("🏯 4/5 • Rejoins notre communauté").setDescription(`${EMOJIS.roblox} Rejoins la communauté de la **Soul Society** : [ouvrir la communauté](${ROBLOX.groupUrl}).\nEnvoie ta demande d’adhésion sur Roblox, puis clique sur **Vérifier et accepter** : le bot la traitera et vérifiera ton adhésion.\n\nÀ la fin de ton nom en jeu, ajoute **T Soul Society** ou **T Soul**.`); components = [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Communauté Roblox").setURL(ROBLOX.groupUrl), button("welcome_community", "Vérifier et accepter"))]; break;
        case "guide": embed.setTitle("🧭 5/5 • Tes repères dans la famille").setDescription((p.membershipVerifiedAt && p.membershipRobloxId === p.robloxId ? `${EMOJIS.certification} **Ton adhésion Roblox est confirmée !**\n\n` : "") + "Ajoute **T Soul Society** ou **T Soul** à la fin de ton nom en jeu.").addFields(GUIDE.map(([name,value]) => ({name,value}))); components = [row(button("welcome_finish", "Terminer mon accueil", ButtonStyle.Success))]; break;
        default: embed.setTitle("✅ Accueil terminé").setDescription(`${EMOJIS.logo} **Ton profil est prêt, bienvenue dans la famille !**\n\n📅 Tes disponibilités ont été enregistrées.\n👤 Utilise désormais **/mon-profil** pour modifier tes informations et tes disponibilités.`); components = [];
    }
    return { content: null, embeds: [embed], components, allowedMentions: { parse: [] } };
}
function welcomeCompleted(p) { return Boolean(p?.completedAt) || p?.step === "done"; }
function completedPayload() {
    return { content: "✅ Tu as déjà terminé ton accueil. Utilise désormais **/mon-profil** pour modifier tes informations et tes disponibilités.", embeds: [], components: [], allowedMentions: { parse: [] } };
}
async function start(interaction) {
    if (interaction.guildId !== IDENTITY.guildId) return interaction.reply({ content: "Ce parcours est réservé au serveur de la Soul Society.", flags: MessageFlags.Ephemeral });
    if (welcomeCompleted(profile(interaction.user.id))) return interaction.reply({ ...completedPayload(), flags: MessageFlags.Ephemeral });
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
    const payload = { embeds: [welcomeEmbed().setTitle("📅 Disponibilités vocales")
        .setDescription(`<@${p.discordId}> • @${p.robloxUsername}`)
        .addFields(availabilityFields(p))], allowedMentions: { parse: [] } };
    let message;
    if (p.availabilityMessageId && p.availabilityChannelId === CHANNEL) {
        try { message = await channel.messages.fetch(p.availabilityMessageId); }
        catch (error) { if (error.code !== 10008) throw error; }
    }
    if (message) await message.edit(payload); else message = await channel.send(payload);
    patch(actorId, { availabilityMessageId: message.id, availabilityChannelId: CHANNEL });
}
async function handle(interaction) {
    const id = interaction.customId || "";
    if (!id.startsWith("welcome_") || interaction.guildId !== IDENTITY.guildId) return;
    if (id === KEY && interaction.isButton()) return start(interaction);
    const actor = interaction.user.id;
    if (busy.has(actor)) return interaction.reply({ content: "⏳ Enregistrement en cours, réessaie dans un instant.", flags: MessageFlags.Ephemeral });
    const p = profile(actor);
    if (!p) return start(interaction);
    if (welcomeCompleted(p)) return interaction.update(completedPayload());
    if (interaction.isButton()) {
        if (id.startsWith("welcome_avail_")) {
            const [, , period, value] = id.split("_");
            if (period !== p.step || !Object.hasOwn(AVAILABILITY[period] || {}, value)) return interaction.update(stepPayload(p));
            patch(actor, { availabilityChoices: { ...p.availabilityChoices, [period]: value }, step: period === "week" ? "weekend" : "community" });
            return interaction.update(stepPayload(profile(actor)));
        }
        // A button from a page opened before deployment now displays the new choices.
        if (["welcome_week", "welcome_weekend"].includes(id)) return interaction.update(stepPayload(p));
        if (id === "welcome_begin") return interaction.update(stepPayload(p));
        if (id === "welcome_restart") {
            patch(actor, { step: "profile" });
            return interaction.update(stepPayload(profile(actor)));
        }
        if (id === "welcome_community" && p.step === "community") {
            busy.add(actor);
            try {
                await interaction.deferUpdate();
                const result = await require("../utils/onboardingMembership").verify(interaction, p.robloxId);
                if (!result.success) return interaction.editReply({ ...stepPayload(p), content: result.message });
                patch(actor, { step: "guide", membershipVerifiedAt: Date.now(), membershipRobloxId: p.robloxId });
                return interaction.editReply(stepPayload(profile(actor)));
            } finally { busy.delete(actor); }
        }
        if (id === "welcome_finish" && p.step === "guide") {
            await interaction.deferUpdate(); busy.add(actor);
            try {
                if (!p.membershipVerifiedAt || p.membershipRobloxId !== p.robloxId) {
                    const result = await require("../utils/onboardingMembership").verify(interaction, p.robloxId);
                    if (!result.success) {
                        patch(actor, { step: "community" });
                        return interaction.editReply({ ...stepPayload(profile(actor)), content: result.message });
                    }
                    patch(actor, { membershipVerifiedAt: Date.now(), membershipRobloxId: p.robloxId });
                }
                await publishAvailability(interaction.client, actor);
                patch(actor, { step: "done", completedAt: Date.now() });
                clientFollowup(interaction.client);
                return await interaction.editReply(stepPayload(profile(actor)));
            } finally { busy.delete(actor); }
        }
        if (id !== "welcome_" + p.step) return interaction.update(stepPayload(p));
        const modal = new ModalBuilder().setCustomId("welcome_submit_" + p.step).setTitle("La Soul Society • " + (p.step === "profile" ? "Profil" : p.step === "roblox" ? "Roblox" : "Disponibilités"));
        if (p.step === "profile") modal.addComponents(input("name", "Nom Discord", p.discordName), input("discord", "ID Discord", p.discordId, false, 20), input("birth", "Date de naissance (JJ/MM/AAAA)", p.birthDate, false, 10));
        else if (p.step === "roblox") modal.addComponents(input("name", "Nom Roblox", p.robloxDisplayName), input("username", "@ Roblox exact", p.robloxUsername, false, 50));
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
                ...(discordId !== p.discordId ? { robloxUsername: null, robloxDisplayName: null, robloxId: null, availability: {}, availabilityChoices: {}, availabilityMessageId: null } : {}) });
        } else if (p.step === "roblox") {
            // An API lookup validates the account's existence; this is a declared association, not proof of ownership.
            const result = await findRobloxUserByUsername(field("username"));
            if (!result.success) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Compte Roblox introuvable ou API indisponible. Vérifie le @ et réessaie depuis le bouton." });
            const other = getDiscordLinkByRobloxId(result.user.id);
            if (other && other.discordUserId !== p.discordId && !hasBypass(interaction)) return interaction.editReply({ ...stepPayload(profile(actor)), content: "❌ Ce compte Roblox est déjà lié à un autre Discord. Contacte l’équipe." });
            setRobloxLink({ discordUserId: p.discordId, robloxUserId: result.user.id, robloxUsername: result.user.username, source: "bienvenue-declaration" });
            patch(actor, { robloxDisplayName: field("name"), robloxUsername: result.user.username, robloxId: result.user.id, step: "week" });
        } else if (["week", "weekend"].includes(p.step)) {
            return interaction.editReply({ ...stepPayload(p), content: "Les disponibilités se choisissent maintenant avec les boutons ci-dessous." });
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
            await member.send(`🌸 Bienvenue dans la Soul Society ! Rejoins notre communauté Roblox : ${ROBLOX.groupUrl}\nUtilise /bienvenue sur le serveur : le bot vérifiera et acceptera ta demande d’adhésion. Ajoute T Soul Society ou T Soul à la fin de ton nom en jeu.`);
            update("welcomeNotifications", state => { state[member.id] = { ...state[member.id], recruitDmSent: true }; });
        } catch { console.warn("⚠️ MP de bienvenue indisponible ; lien accessible dans le parcours d’accueil."); }
    }
}
function clientFollowup(client) {
    client.welcomeFollowup?.tick().catch(() => console.warn("⚠️ Log accueil en attente de reprise."));
}
function register(client) {
    require("./welcomeFollowup")(client);
    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (interaction.customId?.startsWith("profile_")) {
                await require("./memberProfile").handle(interaction);
                return;
            }
            await handle(interaction);
        }
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

Object.assign(module.exports, { profile, patch, input, availabilityFields, AVAILABILITY, publishAvailability });
