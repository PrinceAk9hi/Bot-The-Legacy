// ======================================================
// JOURNAL INTERACTIF — commande /journal installable sur un compte
// (« User Install ») : fonctionne aussi sur les serveurs où le bot n'est pas.
//
// /journal publier           → poste la couverture ; chacun clique « Lire »
//                              et feuillette sa propre copie (visible que par lui)
// /journal lire [page]       → ouvre le journal pour soi
// /journal ajouter|modifier|supprimer|titre → gestion (propriétaire uniquement)
// ======================================================
const fs = require("node:fs");
const path = require("node:path");
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
    ApplicationIntegrationType, InteractionContextType
} = require("discord.js");
const { ownerId } = require("../config/qg");

const FILE = path.join(__dirname, "..", "data", "journal.json");
const PREFIX = "journal:";
const COLOR = 0xc8a96a;
const allowedMentions = { parse: [] };

// ---------------- Stockage ----------------
function read() {
    try {
        const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
        return { titre: d.titre || "📰 Le Journal", sousTitre: d.sousTitre || "", couverture: d.couverture || "", pages: Array.isArray(d.pages) ? d.pages : [] };
    } catch {
        return { titre: "📰 Le Journal", sousTitre: "", couverture: "", pages: [] };
    }
}
function write(d) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
    fs.renameSync(tmp, FILE);
}

// ---------------- Commande ----------------
const data = new SlashCommandBuilder()
    .setName("journal")
    .setDescription("Journal interactif : tourne les pages avec les boutons")
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(s => s.setName("publier").setDescription("Poster la couverture du journal dans ce salon"))
    .addSubcommand(s => s.setName("lire").setDescription("Lire le journal (visible que par toi)")
        .addIntegerOption(o => o.setName("page").setDescription("Page à ouvrir").setMinValue(1)))
    .addSubcommand(s => s.setName("ajouter").setDescription("Ajouter une page (propriétaire)")
        .addIntegerOption(o => o.setName("position").setDescription("Insérer à cette position (par défaut : à la fin)").setMinValue(1)))
    .addSubcommand(s => s.setName("modifier").setDescription("Modifier une page (propriétaire)")
        .addIntegerOption(o => o.setName("page").setDescription("Numéro de la page").setMinValue(1).setRequired(true)))
    .addSubcommand(s => s.setName("supprimer").setDescription("Supprimer une page (propriétaire)")
        .addIntegerOption(o => o.setName("page").setDescription("Numéro de la page").setMinValue(1).setRequired(true)))
    .addSubcommand(s => s.setName("titre").setDescription("Changer le titre et la couverture (propriétaire)"));

// ---------------- Rendu ----------------
function coverPayload(d) {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(d.titre)
        .setDescription([d.sousTitre, "", `📄 **${d.pages.length}** page(s)`, "", "Clique sur **📖 Lire** pour feuilleter le journal."].join("\n").trim());
    if (d.couverture) embed.setImage(d.couverture);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(PREFIX + "open").setLabel("Lire").setEmoji("📖").setStyle(ButtonStyle.Primary)
            .setDisabled(!d.pages.length)
    );
    return { embeds: [embed], components: [row], allowedMentions };
}

function pagePayload(d, index) {
    const total = d.pages.length;
    if (!total) return { content: "📭 Le journal est encore vide.", embeds: [], components: [] };
    const i = Math.min(Math.max(0, index), total - 1);
    const p = d.pages[i];
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setAuthor({ name: d.titre })
        .setTitle(p.titre || `Page ${i + 1}`)
        .setDescription(p.texte || "​")
        .setFooter({ text: `Page ${i + 1} / ${total}` });
    if (p.image) embed.setImage(p.image);
    const btn = (id, emoji, disabled) => new ButtonBuilder().setCustomId(PREFIX + id).setEmoji(emoji).setStyle(ButtonStyle.Secondary).setDisabled(disabled);
    const row = new ActionRowBuilder().addComponents(
        // L'ID contient la page cible + un repère unique (Discord refuse deux IDs identiques).
        btn("go:0:first", "⏮️", i === 0),
        btn(`go:${i - 1}:prev`, "◀️", i === 0),
        new ButtonBuilder().setCustomId(PREFIX + "jump").setLabel(`${i + 1} / ${total}`).setStyle(ButtonStyle.Primary),
        btn(`go:${i + 1}:next`, "▶️", i === total - 1),
        btn(`go:${total - 1}:last`, "⏭️", i === total - 1)
    );
    return { content: "", embeds: [embed], components: [row], allowedMentions };
}

function pageModal(id, title, page = {}) {
    const input = (cid, label, style, value, max, required) => {
        const t = new TextInputBuilder().setCustomId(cid).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
        if (value) t.setValue(String(value).slice(0, max));
        return new ActionRowBuilder().addComponents(t);
    };
    return new ModalBuilder().setCustomId(PREFIX + id).setTitle(title).addComponents(
        input("titre", "Titre de la page", TextInputStyle.Short, page.titre, 256, true),
        input("texte", "Contenu (markdown accepté)", TextInputStyle.Paragraph, page.texte, 4000, true),
        input("image", "Lien d'image (optionnel)", TextInputStyle.Short, page.image, 500, false)
    );
}

const isUrl = s => !s || /^https?:\/\/\S+$/i.test(s);
const ephemeral = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions });

// ---------------- Gestion des interactions ----------------
function owns(interaction) {
    return (interaction.isChatInputCommand() && interaction.commandName === "journal") ||
        (typeof interaction.customId === "string" && interaction.customId.startsWith(PREFIX));
}

async function handle(i) {
    const d = read();

    // ----- Commande -----
    if (i.isChatInputCommand()) {
        const sub = i.options.getSubcommand();
        const admin = ["ajouter", "modifier", "supprimer", "titre"].includes(sub);
        if (admin && i.user.id !== ownerId) return ephemeral(i, "🔒 Seul le propriétaire du journal peut le modifier.");

        if (sub === "publier") return i.reply(coverPayload(d));
        if (sub === "lire") return i.reply({ ...pagePayload(d, (i.options.getInteger("page") || 1) - 1), flags: MessageFlags.Ephemeral });
        if (sub === "ajouter") {
            const pos = i.options.getInteger("position") || d.pages.length + 1;
            return i.showModal(pageModal(`add:${pos}`, "Nouvelle page"));
        }
        const n = i.options.getInteger("page");
        if (sub === "modifier" || sub === "supprimer") {
            if (!d.pages[n - 1]) return ephemeral(i, `❌ La page ${n} n'existe pas (le journal a ${d.pages.length} page(s)).`);
            if (sub === "modifier") return i.showModal(pageModal(`edit:${n}`, `Modifier la page ${n}`, d.pages[n - 1]));
            const [removed] = d.pages.splice(n - 1, 1);
            write(d);
            return ephemeral(i, `🗑️ Page ${n} supprimée : **${removed.titre}**. Il reste ${d.pages.length} page(s).`);
        }
        if (sub === "titre") {
            const row = (cid, label, style, value, max) => {
                const t = new TextInputBuilder().setCustomId(cid).setLabel(label).setStyle(style).setRequired(cid === "titre").setMaxLength(max);
                if (value) t.setValue(String(value).slice(0, max));
                return new ActionRowBuilder().addComponents(t);
            };
            return i.showModal(new ModalBuilder().setCustomId(PREFIX + "meta").setTitle("Couverture du journal").addComponents(
                row("titre", "Titre du journal", TextInputStyle.Short, d.titre, 200),
                row("sousTitre", "Sous-titre / texte de couverture", TextInputStyle.Paragraph, d.sousTitre, 1500),
                row("couverture", "Image de couverture (lien, optionnel)", TextInputStyle.Short, d.couverture, 500)
            ));
        }
        return;
    }

    const [, action, arg] = i.customId.split(":");

    // ----- Boutons -----
    if (i.isButton()) {
        // Depuis la couverture publique : chacun ouvre sa propre copie.
        if (action === "open") return i.reply({ ...pagePayload(d, 0), flags: MessageFlags.Ephemeral });
        // Navigation : on met à jour la copie (éphémère) de la personne.
        if (action === "go") return i.update(pagePayload(d, Number(arg) || 0));
        if (action === "jump") {
            return i.showModal(new ModalBuilder().setCustomId(PREFIX + "jumpto").setTitle("Aller à la page").addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("page").setLabel(`Numéro de page (1 à ${d.pages.length})`)
                    .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(4))));
        }
        return;
    }

    // ----- Formulaires -----
    if (i.isModalSubmit()) {
        if (action === "jumpto") {
            const n = parseInt(i.fields.getTextInputValue("page"), 10);
            if (!n || n < 1 || n > d.pages.length) return ephemeral(i, `❌ Choisis une page entre 1 et ${d.pages.length}.`);
            return i.isFromMessage() ? i.update(pagePayload(d, n - 1)) : i.reply({ ...pagePayload(d, n - 1), flags: MessageFlags.Ephemeral });
        }
        if (i.user.id !== ownerId) return ephemeral(i, "🔒 Seul le propriétaire du journal peut le modifier.");

        if (action === "meta") {
            const couverture = i.fields.getTextInputValue("couverture").trim();
            if (!isUrl(couverture)) return ephemeral(i, "❌ Le lien de couverture doit commencer par http:// ou https://");
            d.titre = i.fields.getTextInputValue("titre").trim();
            d.sousTitre = i.fields.getTextInputValue("sousTitre").trim();
            d.couverture = couverture;
            write(d);
            return i.reply({ content: "✅ Couverture mise à jour. Aperçu :", ...coverPayload(d), flags: MessageFlags.Ephemeral });
        }

        const page = {
            titre: i.fields.getTextInputValue("titre").trim(),
            texte: i.fields.getTextInputValue("texte").trim(),
            image: i.fields.getTextInputValue("image").trim()
        };
        if (!isUrl(page.image)) return ephemeral(i, "❌ Le lien d'image doit commencer par http:// ou https://");

        let index;
        if (action === "add") {
            index = Math.min(Math.max(1, Number(arg) || d.pages.length + 1), d.pages.length + 1) - 1;
            d.pages.splice(index, 0, page);
        } else if (action === "edit") {
            index = Number(arg) - 1;
            if (!d.pages[index]) return ephemeral(i, "❌ Cette page n'existe plus.");
            d.pages[index] = page;
        } else return;
        write(d);
        return i.reply({ ...pagePayload(d, index), content: `✅ Page ${index + 1} ${action === "add" ? "ajoutée" : "modifiée"}.`, flags: MessageFlags.Ephemeral });
    }
}

module.exports = { data, owns, handle, read, write, pagePayload, coverPayload };
