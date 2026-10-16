const {
    AttachmentBuilder,
    MessageFlags,
    SlashCommandBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { MAIN_RANKS } = require("../config/ranks");
const { ROLES } = require("../config/soulSociety");
const { getRobloxLink } = require("../utils/robloxLinks");
const { hasBypass } = require("../utils/security");

const WIDTH = 780;
const HEIGHT = 1080;
const avatarCache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const CARD_THEMES = [
    { name: "Or impérial", foil: "#e6bd69", glow: "#815c36", edge: "#e0c37d" },
    { name: "Sakura nocturne", foil: "#e78cae", glow: "#853c75", edge: "#d995b5" },
    { name: "Améthyste", foil: "#b79aff", glow: "#5e4b9c", edge: "#aaa0e8" },
    { name: "Jade royal", foil: "#8bd0ac", glow: "#326f66", edge: "#a5d2b6" },
    { name: "Azur astral", foil: "#86c7ee", glow: "#35698f", edge: "#9bcbe6" }
];
const lastThemeByUser = new Map();

function randomTheme(userId) {
    let index = Math.floor(Math.random() * CARD_THEMES.length);
    if (CARD_THEMES.length > 1 && lastThemeByUser.get(userId) === index) index = (index + 1 + Math.floor(Math.random() * (CARD_THEMES.length - 1))) % CARD_THEMES.length;
    lastThemeByUser.set(userId, index);
    if (lastThemeByUser.size > 500) lastThemeByUser.delete(lastThemeByUser.keys().next().value);
    return CARD_THEMES[index];
}

function canUseCard(member) {
    return Boolean(member?.roles?.cache?.has(ROLES.member) || hasBypass(member));
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

function makeCard({ member, profile, rank, theme = CARD_THEMES[0] }) {
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

    // Metallic double border and subtle foil flecks.
    ctx.strokeStyle = "#737783"; ctx.lineWidth = 3; rounded(12, 12, WIDTH - 24, HEIGHT - 24, 28); ctx.stroke();
    ctx.strokeStyle = theme.edge; ctx.lineWidth = 2; rounded(23, 23, WIDTH - 46, HEIGHT - 46, 22); ctx.stroke();
    for (let i = 0; i < 115; i++) {
        ctx.fillStyle = `${theme.foil}${i % 3 === 0 ? "48" : "20"}`;
        ctx.beginPath(); ctx.arc(35 + Math.random() * (WIDTH - 70), 35 + Math.random() * (HEIGHT - 70), .5 + Math.random() * 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // Header: title, Soul Society seal, and rank stars.
    ctx.fillStyle = theme.foil; ctx.font = "700 16px sans-serif"; ctx.letterSpacing = "2px";
    ctx.fillText("SOUL SOCIETY • CARTE DE MEMBRE", 50, 66);
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
    ctx.textAlign = "right"; ctx.fillStyle = theme.foil; ctx.font = "700 13px sans-serif";
    ctx.fillText(theme.name.toUpperCase(), WIDTH - 48, 188); ctx.textAlign = "left";

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

    // Lower identity panel, styled like a collectible card without fabricated stats.
    const py = 744, ph = 265;
    const panel = ctx.createLinearGradient(0, py, 0, py + ph);
    panel.addColorStop(0, "#e8e3d4"); panel.addColorStop(1, "#c9c4b8");
    ctx.fillStyle = panel; rounded(48, py, WIDTH - 96, ph, 10); ctx.fill();
    ctx.strokeStyle = `${theme.edge}dd`; ctx.lineWidth = 3; rounded(48, py, WIDTH - 96, ph, 10); ctx.stroke();
    ctx.fillStyle = "#25242a"; ctx.font = "700 16px sans-serif"; ctx.letterSpacing = "1px";
    ctx.fillText("DOSSIER DE LA FAMILLE", 70, py + 39); ctx.letterSpacing = "0px";
    ctx.strokeStyle = "#827d72"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(70, py + 54); ctx.lineTo(WIDTH - 70, py + 54); ctx.stroke();
    ctx.fillStyle = "#39363a"; ctx.font = "700 24px sans-serif";
    ctx.fillText(`Grade : ${rank}`, 70, py + 99, WIDTH - 140);
    ctx.font = "400 19px sans-serif"; ctx.fillStyle = "#55515a";
    ctx.fillText(`Roblox : @${profile.username}`, 70, py + 139, WIDTH - 140);
    ctx.fillText(`Discord : ${String(member.displayName || member.user?.globalName || member.user?.username || "Membre").slice(0, 32)}`, 70, py + 174, WIDTH - 140);
    ctx.font = "400 15px sans-serif"; ctx.fillStyle = "#69636b";
    ctx.fillText("Une famille, une histoire — heureux de t’avoir parmi nous.", 70, py + 222, WIDTH - 140);

    // Collector footer and serial accent.
    ctx.fillStyle = theme.foil; rounded(48, 1030, 74, 5, 2); ctx.fill();
    ctx.fillStyle = "#c7c4ca"; ctx.font = "600 14px sans-serif";
    ctx.fillText("SOUL SOCIETY  •  ÉDITION FAMILLE", 136, 1040);
    ctx.textAlign = "right"; ctx.fillStyle = theme.edge; ctx.font = "700 14px monospace";
    ctx.fillText(`SS-${String(member.id || member.user?.id || "0000").slice(-4)}`, WIDTH - 48, 1040); ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("carte")
        .setDescription("Créer la carte de membre Roblox d’un membre")
        .addUserOption(option => option
            .setName("membre")
            .setDescription("Membre dont tu veux afficher la carte (par défaut : toi)")),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: "❌ Cette commande s’utilise dans le serveur.", flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply();

        try {
            const caller = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!canUseCard(caller)) {
                return interaction.editReply("❌ La commande carte est réservée aux membres de la Soul Society.");
            }
            const user = interaction.options.getUser("membre") || interaction.user;
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member || user.bot) return interaction.editReply("❌ Je ne trouve pas ce membre sur le serveur.");

            const link = getRobloxLink(user.id);
            if (!link?.robloxUserId) {
                return interaction.editReply(`❌ Aucun compte Roblox n’est lié à <@${user.id}>. Le membre doit d’abord lier son compte avec =link.`);
            }

            const profile = await robloxProfile(link.robloxUserId);
            const rank = currentRank(member);
            const theme = randomTheme(interaction.user.id);
            const image = makeCard({ member, profile, rank, theme });
            const file = new AttachmentBuilder(image, { name: `carte-${link.robloxUserId}.png` });
            return interaction.editReply({
                content: `🪪 Carte de **${profile.displayName}** • **${rank}**`,
                files: [file],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error("Erreur commande /carte :", error.status || error.code || error.message);
            return interaction.editReply("❌ Je n’ai pas pu récupérer l’avatar Roblox pour créer la carte. Réessaie un peu plus tard.");
        }
    },
    canUseCard,
    randomTheme,
    makeCard
};
