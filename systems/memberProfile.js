const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, MessageFlags } = require("discord.js");
const { IDENTITY, COLORS, ROBLOX } = require("../config/soulSociety");
const { read, update } = require("../utils/recruitmentData");
const { findRobloxUserByUsername } = require("../utils/robloxAccount");
const { setRobloxLink, getDiscordLinkByRobloxId } = require("../utils/robloxLinks");
const welcome = require("./memberOnboarding");
const busy = new Set();
const PAGES = { discord: "Profil Discord", roblox: "Profil Roblox", availability: "Disponibilités", community: "Communauté Roblox" };
function button(id, label, style = ButtonStyle.Primary) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style); }
function row(...items) { return new ActionRowBuilder().addComponents(...items); }
function draft(userId) { return read("profileDrafts")[userId]; }
function setDraft(userId, value) { update("profileDrafts", all => { if (value) all[userId] = value; else delete all[userId]; }); }
function ownProfile(userId) {
    const p = welcome.profile(userId);
    return p?.discordId === userId ? p : {};
}
function render(userId, notice = null) {
    const d = draft(userId);
    const p = d?.values || ownProfile(userId);
    const embed = new EmbedBuilder().setColor(COLORS.primary);
    let components;
    if (!d) {
        embed.setTitle("👤 Mon profil La Soul Society").setDescription("Que souhaites-tu modifier ? Choisis une rubrique. Sur chaque page, **Sauvegarder** enregistre tes changements ; **Retour** abandonne le brouillon de cette page.");
        components = [row(...Object.entries(PAGES).map(([key, label]) => button("profile_page_" + key, label)))];
    } else {
        embed.setTitle("👤 " + PAGES[d.page]);
        const controls = row(button("profile_save", "Sauvegarder", ButtonStyle.Success), button("profile_back", "Retour", ButtonStyle.Secondary));
        if (d.page === "discord") {
            embed.setDescription(`**Nom Discord :** ${p.discordName || "Non renseigné"}\n**ID Discord :** ${userId}\n**Date de naissance :** ${p.birthDate || "Non renseignée"}\n\nLa date sert au rôle **Joyeux anniversaire**. Cette page est privée. L’ID correspond à ton compte connecté.`);
            components = [row(button("profile_edit_discord", "Modifier les informations")), controls];
        } else if (d.page === "roblox") {
            embed.setDescription(`**Nom Roblox :** ${p.robloxDisplayName || "Non renseigné"}\n**@ Roblox :** ${p.robloxUsername || "Non renseigné"}\n\nAjoute **T Soul Society** ou **T Soul** à la fin de ton nom en jeu. La liaison est modifiée uniquement à la sauvegarde.`);
            components = [row(button("profile_edit_roblox", "Modifier les informations")), controls];
        } else if (d.page === "availability") {
            embed.setDescription("Choisis tes disponibilités, puis sauvegarde.").addFields(welcome.availabilityFields(p));
            components = ["week", "weekend"].map(period => row(new StringSelectMenuBuilder().setCustomId("profile_avail_" + period)
                .setPlaceholder(period === "week" ? "Disponibilités en semaine" : "Disponibilités le week-end")
                .addOptions(Object.entries(welcome.AVAILABILITY[period]).map(([value, label]) => ({ label, value, default: p.availabilityChoices?.[period] === value })))));
            components.push(controls);
        } else {
            embed.setDescription(`[rejoindre la Soul Society](${ROBLOX.groupUrl})\nEnvoie ta demande sur Roblox. **Sauvegarder** lance la vérification et l’acceptation automatique, puis confirme ton adhésion.\n\nÀ la fin de ton nom en jeu, ajoute **T Soul Society** ou **T Soul**.`);
            components = [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Communauté Roblox").setURL(ROBLOX.groupUrl)), controls];
        }
    }
    return { content: notice, embeds: [embed], components, allowedMentions: { parse: [] } };
}
async function start(i) {
    if (i.guildId !== IDENTITY.guildId) return i.reply({ content: "Cette commande est réservée au serveur de la Soul Society.", flags: MessageFlags.Ephemeral });
    setDraft(i.user.id, null);
    return i.reply({ ...render(i.user.id), flags: MessageFlags.Ephemeral });
}
async function save(i, d) {
    const actor = i.user.id, p = d.values;
    let changes = {};
    if (d.page === "discord") {
        if (!p.discordName?.trim() || !welcome.birthday(p.birthDate || "")) return "❌ Indique un nom et une date de naissance valide (JJ/MM/AAAA).";
        changes = { discordName: p.discordName, birthDate: p.birthDate };
    } else if (d.page === "roblox") {
        const result = await findRobloxUserByUsername(p.robloxUsername);
        if (!result.success) return "❌ Compte Roblox introuvable ou service indisponible. Vérifie le @.";
        const other = getDiscordLinkByRobloxId(result.user.id);
        if (other && other.discordUserId !== actor) return "❌ Ce Roblox est déjà lié à un autre Discord. Contacte la direction.";
        setRobloxLink({ discordUserId: actor, robloxUserId: result.user.id, robloxUsername: result.user.username, source: "mon-profil-declaration" });
        changes = { robloxUsername: result.user.username, robloxId: result.user.id, robloxDisplayName: p.robloxDisplayName, membershipVerifiedAt: null, membershipRobloxId: null };
    } else if (d.page === "availability") {
        if (!["week", "weekend"].every(period => Object.hasOwn(welcome.AVAILABILITY[period], p.availabilityChoices?.[period]))) return "❌ Choisis une disponibilité pour la semaine et pour le week-end.";
        changes = { availabilityChoices: p.availabilityChoices };
    } else if (d.page === "community") {
        // Always use the saved link, never a pending username edit.
        const current = ownProfile(actor);
        const result = await require("../utils/onboardingMembership").verify(i, current.robloxId);
        if (!result.success) return result.message;
        changes = { membershipVerifiedAt: Date.now(), membershipRobloxId: current.robloxId };
    }
    const existing = ownProfile(actor);
    if (!existing.discordId) update("welcomeProfiles", profiles => {
        profiles[actor] = { discordId: actor, discordName: i.user.username, step: "profile", ...changes, updatedAt: Date.now() };
    });
    else welcome.patch(actor, changes);
    if (d.page === "availability") {
        try { await welcome.publishAvailability(i.client, actor); }
        catch { return "Tes disponibilités sont sauvegardées, mais leur publication a échoué. Réessaie Sauvegarder ; le bot doit accéder au salon des disponibilités."; }
    }
    setDraft(actor, { page: d.page, values: { ...ownProfile(actor) } });
    return d.page === "community" ? "✅ Roblox confirme que tu es bien dans la communauté de la Soul Society !" : "✅ Modifications sauvegardées.";
}
async function handle(i) {
    if (!i.customId?.startsWith("profile_") || i.guildId !== IDENTITY.guildId) return;
    const actor = i.user.id, id = i.customId;
    if (busy.has(actor)) return i.reply({ content: "⏳ Sauvegarde en cours.", flags: MessageFlags.Ephemeral });
    try {
        if (i.isButton() && id.startsWith("profile_page_")) {
            const page = id.slice("profile_page_".length);
            if (!PAGES[page]) return;
            setDraft(actor, { page, values: { ...ownProfile(actor), discordId: actor, discordName: ownProfile(actor).discordName || i.user.username } });
            return i.update(render(actor));
        }
        if (i.isButton() && id === "profile_back") { setDraft(actor, null); return i.update(render(actor)); }
        const d = draft(actor);
        if (!d) return i.update(render(actor, "Choisis d’abord une rubrique."));
        if (i.isStringSelectMenu() && id.startsWith("profile_avail_") && d.page === "availability") {
            const period = id.slice("profile_avail_".length), value = i.values[0];
            if (!Object.hasOwn(welcome.AVAILABILITY[period] || {}, value)) return i.update(render(actor));
            d.values.availabilityChoices = { ...d.values.availabilityChoices, [period]: value };setDraft(actor, d);
            return i.update(render(actor, "Choix modifié. Clique sur Sauvegarder pour l’enregistrer."));
        }
        if (i.isButton() && id === "profile_save") {
            busy.add(actor);
            await i.deferUpdate();
            try { return await i.editReply(render(actor, await save(i, d))); }
            finally { busy.delete(actor); }
        }
        if (i.isButton() && id === "profile_edit_" + d.page && ["discord", "roblox"].includes(d.page)) {
            const modal = new ModalBuilder().setCustomId("profile_submit_" + d.page).setTitle(PAGES[d.page]);
            if (d.page === "discord") modal.addComponents(welcome.input("name", "Nom Discord", d.values.discordName), welcome.input("birth", "Date de naissance (JJ/MM/AAAA)", d.values.birthDate, false, 10));
            else modal.addComponents(welcome.input("name", "Nom Roblox", d.values.robloxDisplayName), welcome.input("username", "@ Roblox", d.values.robloxUsername, false, 50));
            return i.showModal(modal);
        }
        if (i.isModalSubmit() && id.startsWith("profile_submit_")) {
            await i.deferUpdate();
            if (id !== "profile_submit_" + d.page) return i.editReply(render(actor, "Cette page a changé. Rouvre le formulaire."));
            const get = n => i.fields.getTextInputValue(n).trim();
            if (d.page === "discord") Object.assign(d.values, { discordName: get("name"), birthDate: get("birth") });
            else Object.assign(d.values, { robloxDisplayName: get("name"), robloxUsername: get("username") });
            setDraft(actor, d);
            return i.editReply(render(actor, "Brouillon prêt. Clique sur Sauvegarder pour appliquer les modifications."));
        }
    } catch {
        const message = render(actor, "❌ Impossible de terminer cette opération. Ton brouillon est conservé ; réessaie.");
        if (i.deferred) return i.editReply(message);
        if (!i.replied) return i.update(message);
    }
}
module.exports = { start, handle, render };
