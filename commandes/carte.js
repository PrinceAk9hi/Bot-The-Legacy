const {
    AttachmentBuilder,
    MessageFlags,
    SlashCommandBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { MAIN_RANKS } = require("../config/ranks");
const { ROLES } = require("../config/soulSociety");
const { getRobloxLink } = require("../utils/robloxLinks");
const { saveCard } = require("../utils/cardCollection");

const WIDTH = 780;
const HEIGHT = 1080;
const avatarCache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const CARD_THEMES = [
    { name: "Or impérial", genre: "Luxe", foil: "#e6bd69", glow: "#815c36", edge: "#e0c37d", motif: "sun" },
    { name: "Diamant noir", genre: "Collector", foil: "#d5e5ff", glow: "#424b66", edge: "#b9c8e5", motif: "diamond" },
    { name: "Sakura nocturne", genre: "Anime", foil: "#e78cae", glow: "#853c75", edge: "#d995b5", motif: "petal" },
    { name: "Améthyste arcanique", genre: "Mystique", foil: "#b79aff", glow: "#5e4b9c", edge: "#aaa0e8", motif: "rune" },
    { name: "Jade royal", genre: "Fantasy", foil: "#8bd0ac", glow: "#326f66", edge: "#a5d2b6", motif: "leaf" },
    { name: "Azur astral", genre: "Divinité", foil: "#86c7ee", glow: "#35698f", edge: "#9bcbe6", motif: "star" },
    { name: "Néon Tokyo", genre: "Cyberpunk", foil: "#50f2ee", glow: "#4d1f83", edge: "#d54eff", motif: "circuit" },
    { name: "Glitch rouge", genre: "Cyberpunk", foil: "#ff5d70", glow: "#5e1839", edge: "#ffb548", motif: "glitch" },
    { name: "Dragon abyssal", genre: "Dark Fantasy", foil: "#e26f48", glow: "#501b28", edge: "#f2ad5c", motif: "flame" },
    { name: "Ange astral", genre: "Fantasy", foil: "#ffe4a1", glow: "#806e9e", edge: "#fff0cf", motif: "halo" },
    { name: "Grimoire interdit", genre: "Yu-Gi-Oh! mystique", foil: "#a78bfa", glow: "#321947", edge: "#e1b8ff", motif: "rune" },
    { name: "Esprit de Soul", genre: "Dark Fantasy", foil: "#83f0da", glow: "#174c56", edge: "#b9fff2", motif: "soul" },
    { name: "MVP céleste", genre: "Superstar", foil: "#ffcf5c", glow: "#875224", edge: "#fff0a6", motif: "star" },
    { name: "Édition arc-en-ciel", genre: "TCG holographique", foil: "#f4a8ff", glow: "#5249bd", edge: "#9bf3ff", motif: "rainbow" },
    { name: "Masque spectral", genre: "Anime", foil: "#b6d5ff", glow: "#242a53", edge: "#edb4ff", motif: "mask" },
    { name: "Carte inconnue", genre: "Mystère", foil: "#a7b0c4", glow: "#262633", edge: "#f8e2a0", motif: "mystery" }
];
const lastThemeByUser = new Map();
const RARITIES = [
    { name: "Commune", weight: 500, color: "#b8bdc8", multiplier: 1 },
    { name: "Rare", weight: 270, color: "#68c7ff", multiplier: 1.25 },
    { name: "Épique", weight: 140, color: "#c18aff", multiplier: 1.55 },
    { name: "Légendaire", weight: 70, color: "#ffd36b", multiplier: 1.9 },
    { name: "Mythique", weight: 18, color: "#ff7dba", multiplier: 2.35 },
    { name: "Secrète", weight: 2, color: "#9dfff0", multiplier: 3 }
];

function randomTheme(userId, previousIndex = lastThemeByUser.get(userId)) {
    let index = Math.floor(Math.random() * CARD_THEMES.length);
    if (CARD_THEMES.length > 1 && previousIndex === index) index = (index + 1 + Math.floor(Math.random() * (CARD_THEMES.length - 1))) % CARD_THEMES.length;
    lastThemeByUser.set(userId, index);
    if (lastThemeByUser.size > 500) lastThemeByUser.delete(lastThemeByUser.keys().next().value);
    return CARD_THEMES[index];
}

function randomRarity() {
    let roll = Math.random() * RARITIES.reduce((sum, rarity) => sum + rarity.weight, 0);
    return RARITIES.find(rarity => (roll -= rarity.weight) < 0) || RARITIES[0];
}

function randomStats(rarity) {
    const point = () => Math.min(9999, Math.floor((18 + Math.random() * 73) * rarity.multiplier));
    return { puissance: point(), aura: point(), esprit: point(), destin: point() };
}

function canUseCard(member) {
    return Boolean(member?.roles?.cache?.has(ROLES.member));
}

function currentRank(member) {
    const rank = Object.values(MAIN_RANKS).reverse().find(item => member.roles.cache.has(item.roleId));
    if (rank) return rank.name;
    if (member.roles.cache.has(ROLES.member)) return "Membre";
    return "Membre de la communauté";
}

async function robloxProfile(robloxId) {
    const cached = avatarCache.get(robloxId);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.profile;

    const signal = AbortSignal.timeout(12000);
    const [userResponse, thumbnailResponse] = await Promise.all([
        fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(robloxId)}`, { signal }),
        fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${encodeURIComponent(robloxId)}&size=420x420&format=Png&isCircular=false`, { signal })
    ]);
    if (!userResponse.ok || !thumbnailResponse.ok) throw new Error("Roblox ne répond pas correctement.");

    const [user, thumbnailData] = await Promise.all([userResponse.json(), thumbnailResponse.json()]);
    const avatarUrl = thumbnailData?.data?.[0]?.imageUrl;
    if (!user?.name || !avatarUrl) throw new Error("Profil Roblox indisponible.");
    const imageResponse = await fetch(avatarUrl, { signal });
    if (!imageResponse.ok) throw new Error("Image Roblox indisponible.");

    const profile = {
        displayName: String(user.displayName || user.name).slice(0, 40),
        username: String(user.name).slice(0, 40),
        avatar: await loadImage(Buffer.from(await imageResponse.arrayBuffer()))
    };
    avatarCache.set(robloxId, { at: Date.now(), profile });
    if (avatarCache.size > 100) avatarCache.delete(avatarCache.keys().next().value);
    return profile;
}

function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
}

function drawPetal(ctx, x, y, scale, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = "rgba(238, 153, 174, .72)";
    ctx.beginPath();
    ctx.ellipse(0, -scale * 0.55, scale * 0.28, scale * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSakura(ctx, x, y, size) {
    for (let i = 0; i < 5; i++) drawPetal(ctx, x, y, size, (Math.PI * 2 * i) / 5);
    ctx.fillStyle = "#ffe6a4";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
}

function makeCard({ member, profile, rank, theme = CARD_THEMES[0], rarity = RARITIES[0], serial = "SS-000001", stats = randomStats(rarity) }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    const rounded = (x, y, w, h, r) => { roundedRect(ctx, x, y, w, h, r); };

    // A vertical collectible keepsake with a dark metallic frame and a bright foil portrait.
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, "#101218"); bg.addColorStop(.48, "#252630"); bg.addColorStop(1, "#090a0e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const sheen = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    sheen.addColorStop(0, "rgba(255,255,255,.19)"); sheen.addColorStop(.18, "rgba(255,255,255,0)"); sheen.addColorStop(.72, `${theme.foil}18`); sheen.addColorStop(1, "rgba(255,255,255,.12)");
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Metallic double border, rarity-colored foil and a different motif for each edition.
    ctx.strokeStyle = rarity.color; ctx.lineWidth = 5; rounded(12, 12, WIDTH - 24, HEIGHT - 24, 28); ctx.stroke();
    ctx.strokeStyle = theme.edge; ctx.lineWidth = 2; rounded(23, 23, WIDTH - 46, HEIGHT - 46, 22); ctx.stroke();
    for (let i = 0; i < 210; i++) {
        ctx.fillStyle = `${theme.foil}${i % 3 === 0 ? "48" : "20"}`;
        ctx.beginPath(); ctx.arc(35 + Math.random() * (WIDTH - 70), 35 + Math.random() * (HEIGHT - 70), .5 + Math.random() * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // Distinct graphic language per theme: arcane sigils, petals, circuitry, stars or diamonds.
    ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = theme.edge; ctx.fillStyle = theme.foil; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
        const px = 55 + ((i * 137 + 37) % (WIDTH - 110));
        const py = 235 + ((i * 181 + 79) % 455);
        if (theme.motif === "circuit" || theme.motif === "glitch") {
            ctx.beginPath(); ctx.moveTo(px - 25, py); ctx.lineTo(px, py); ctx.lineTo(px, py + 22); ctx.lineTo(px + 24, py + 22); ctx.stroke();
            ctx.beginPath(); ctx.arc(px + 24, py + 22, 3, 0, Math.PI * 2); ctx.fill();
        } else if (["diamond", "mystery", "mask"].includes(theme.motif)) {
            ctx.beginPath(); ctx.moveTo(px, py - 17); ctx.lineTo(px + 14, py); ctx.lineTo(px, py + 17); ctx.lineTo(px - 14, py); ctx.closePath(); ctx.stroke();
        } else if (["petal", "leaf", "soul"].includes(theme.motif)) {
            ctx.beginPath(); ctx.ellipse(px, py, 6, 18, i, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(px, py, 10 + (i % 3) * 4, 0, Math.PI * 2); ctx.stroke();
            if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(px - 17, py); ctx.lineTo(px + 17, py); ctx.moveTo(px, py - 17); ctx.lineTo(px, py + 17); ctx.stroke(); }
        }
    }
    ctx.restore();

    // Header: title, Soul Society seal, and rank stars.
    ctx.fillStyle = rarity.color; ctx.font = "700 16px sans-serif"; ctx.letterSpacing = "2px";
    ctx.fillText(`SOUL SOCIETY • ${theme.genre.toUpperCase()}`, 50, 66);
    ctx.fillStyle = "#f1e6ce"; ctx.letterSpacing = "0px";
    ctx.font = "700 39px sans-serif";
    const title = String(profile.displayName || profile.username).slice(0, 26);
    ctx.fillText(title, 49, 119, 590);
    ctx.fillStyle = "#aaa8b4"; ctx.font = "500 18px sans-serif";
    ctx.fillText(`@${profile.username}  •  ${String(rank).toUpperCase()}`, 51, 151, 670);

    const rankIndex = Math.max(0, Object.values(MAIN_RANKS).findIndex(item => item.name === rank));
    const starCount = Math.max(1, Math.min(10, rankIndex + 1));
    for (let i = 0; i < 10; i++) {
        const x = 55 + i * 35;
        ctx.fillStyle = i < starCount ? theme.foil : "#565762";
        ctx.font = "700 27px sans-serif"; ctx.fillText("★", x, 190);
    }
    ctx.textAlign = "right"; ctx.fillStyle = rarity.color; ctx.font = "700 13px sans-serif";
    ctx.fillText(`${rarity.name.toUpperCase()} • ${theme.name.toUpperCase()}`, WIDTH - 48, 188); ctx.textAlign = "left";

    // Main portrait area with luminous foil color behind the Roblox avatar.
    const x = 48, y = 216, w = WIDTH - 96, h = 500;
    const frame = ctx.createLinearGradient(x, y, x + w, y + h);
    frame.addColorStop(0, theme.glow); frame.addColorStop(.45, "#14151d"); frame.addColorStop(1, theme.foil);
    ctx.fillStyle = frame; rounded(x, y, w, h, 22); ctx.fill();
    ctx.save(); rounded(x + 10, y + 10, w - 20, h - 20, 16); ctx.clip();
    const art = ctx.createLinearGradient(x, y, x + w, y + h);
    art.addColorStop(0, `${theme.glow}`); art.addColorStop(.55, "#171923"); art.addColorStop(1, `${theme.foil}`);
    ctx.fillStyle = art; ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
    const aura = ctx.createRadialGradient(WIDTH / 2, y + h * .48, 20, WIDTH / 2, y + h * .48, 330);
    aura.addColorStop(0, `${theme.foil}88`); aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura; ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
    // Fine diagonal holographic lines.
    ctx.globalAlpha = .19; ctx.strokeStyle = theme.edge; ctx.lineWidth = 2;
    for (let line = -h; line < w + h; line += 28) { ctx.beginPath(); ctx.moveTo(x + line, y + 10); ctx.lineTo(x + line - h, y + h - 10); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const image = profile.avatar;
    const scale = Math.min((w - 36) / image.width, (h - 30) / image.height);
    const iw = image.width * scale, ih = image.height * scale;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.restore();
    ctx.strokeStyle = `${theme.edge}cc`; ctx.lineWidth = 2; rounded(x + 10, y + 10, w - 20, h - 20, 16); ctx.stroke();

    // Lower identity panel with clearly fictional, collectible-only attributes.
    const py = 744, ph = 265;
    const panel = ctx.createLinearGradient(0, py, 0, py + ph);
    panel.addColorStop(0, "#e8e3d4"); panel.addColorStop(1, "#c9c4b8");
    ctx.fillStyle = panel; rounded(48, py, WIDTH - 96, ph, 10); ctx.fill();
    ctx.strokeStyle = `${theme.edge}dd`; ctx.lineWidth = 3; rounded(48, py, WIDTH - 96, ph, 10); ctx.stroke();
    ctx.fillStyle = "#25242a"; ctx.font = "700 16px sans-serif"; ctx.letterSpacing = "1px";
    ctx.fillText("DOSSIER DE LA FAMILLE", 70, py + 39); ctx.letterSpacing = "0px";
    ctx.strokeStyle = "#827d72"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(70, py + 54); ctx.lineTo(WIDTH - 70, py + 54); ctx.stroke();
    ctx.fillStyle = "#39363a"; ctx.font = "700 22px sans-serif";
    ctx.fillText(`Grade : ${rank}`, 70, py + 88, WIDTH - 140);
    ctx.font = "600 16px sans-serif"; ctx.fillStyle = "#625d66";
    ctx.fillText(`Roblox : @${profile.username}`, 70, py + 119, WIDTH - 140);
    const statsText = `PUISSANCE ${stats.puissance}   AURA ${stats.aura}   ESPRIT ${stats.esprit}   DESTIN ${stats.destin}`;
    ctx.font = "700 14px monospace"; ctx.fillStyle = "#302b37";
    ctx.fillText(statsText, 70, py + 162, WIDTH - 140);
    ctx.font = "400 15px sans-serif"; ctx.fillStyle = "#55515a";
    const effect = `Effet : ${theme.name} • ${rarity.name}`;
    ctx.fillText(effect, 70, py + 195, WIDTH - 140);
    ctx.font = "400 13px sans-serif"; ctx.fillStyle = "#69636b";
    ctx.fillText(`Discord : ${String(member.displayName || member.user?.globalName || member.user?.username || "Membre").slice(0, 32)} • Stats de collection, sans effet en jeu.`, 70, py + 226, WIDTH - 140);

    // Collector footer and serial accent.
    ctx.fillStyle = rarity.color; rounded(48, 1030, 74, 5, 2); ctx.fill();
    ctx.fillStyle = "#c7c4ca"; ctx.font = "600 14px sans-serif";
    ctx.fillText(`SOUL SOCIETY • ${serial}`, 136, 1040);
    ctx.textAlign = "right"; ctx.fillStyle = theme.edge; ctx.font = "700 14px monospace";
    ctx.fillText(`${rarity.name.toUpperCase()} / ${theme.genre.toUpperCase()}`, WIDTH - 48, 1040, 240); ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("carte")
        .setDescription("Tirer ta carte de collection Soul Society"),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: "❌ Cette commande s’utilise dans le serveur.", flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply();
        let archiveFailed = false;

        try {
            const caller = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!canUseCard(caller)) {
                return interaction.editReply("❌ La commande carte est réservée aux membres de la Soul Society.");
            }
            const member = caller;
            const user = interaction.user;

            const link = getRobloxLink(user.id);
            if (!link?.robloxUserId) {
                return interaction.editReply(`❌ Aucun compte Roblox n’est lié à <@${user.id}>. Le membre doit d’abord lier son compte avec =link.`);
            }

            const profile = await robloxProfile(link.robloxUserId);
            const rank = currentRank(member);
            const theme = randomTheme(interaction.user.id);
            const rarity = randomRarity();
            const stats = randomStats(rarity);
            let saved;
            try {
                saved = await saveCard({
                    userId: interaction.user.id,
                    image: makeCard({ member, profile, rank, theme, rarity, stats }),
                    card: { rarity: rarity.name, style: theme.name, stats, effect: `${theme.name} • ${rarity.name}` }
                });
            } catch (error) {
                archiveFailed = true;
                throw error;
            }
            const file = new AttachmentBuilder(saved.imagePath, { name: `carte-${saved.serial}.png` });
            return interaction.editReply({
                content: `🪪 **${saved.serial}** • **${rarity.name}** — ${theme.genre} · ${theme.name}\nCarte de **${profile.displayName}** • **${rank}**`,
                files: [file],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error("Erreur commande /carte :", error.status || error.code || error.message);
            if (archiveFailed) return interaction.editReply("❌ Ta carte a été générée, mais je n’ai pas pu l’archiver. Vérifie le stockage persistant du bot avant de réessayer.");
            return interaction.editReply("❌ Je n’ai pas pu récupérer l’avatar Roblox pour créer la carte. Réessaie un peu plus tard.");
        }
    },
    canUseCard,
    randomTheme,
    makeCard,
    randomRarity,
    randomStats
};
