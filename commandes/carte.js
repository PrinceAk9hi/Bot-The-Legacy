const {
    AttachmentBuilder,
    MessageFlags,
    SlashCommandBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { MAIN_RANKS } = require("../config/ranks");
const { ROLES } = require("../config/soulSociety");
const { getRobloxLink } = require("../utils/robloxLinks");

const WIDTH = 1200;
const HEIGHT = 675;
const avatarCache = new Map();
const CACHE_MS = 5 * 60 * 1000;

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
    ctx.fillStyle = "rgba(255, 184, 208, .78)";
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

function makeCard({ member, profile, rank }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, "#0b1026");
    background.addColorStop(0.55, "#18203d");
    background.addColorStop(1, "#28162c");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(250, 325, 10, 250, 325, 480);
    glow.addColorStop(0, "rgba(90, 115, 180, .3)");
    glow.addColorStop(1, "rgba(10, 14, 32, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Japanese-inspired moon and understated sakura decoration.
    ctx.fillStyle = "rgba(255, 230, 205, .09)";
    ctx.beginPath();
    ctx.arc(1040, 100, 160, 0, Math.PI * 2);
    ctx.fill();
    drawSakura(ctx, 1080, 110, 28);
    drawSakura(ctx, 1135, 490, 18);
    drawSakura(ctx, 625, 570, 14);
    drawSakura(ctx, 48, 106, 16);

    // Gold frame and title band.
    ctx.strokeStyle = "rgba(232, 199, 132, .72)";
    ctx.lineWidth = 2;
    roundedRect(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 28);
    ctx.stroke();
    ctx.fillStyle = "#e8c784";
    ctx.fillRect(66, 76, 6, 46);
    ctx.font = "600 20px sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText("SOUL SOCIETY", 88, 106);
    ctx.letterSpacing = "0px";

    // Character portrait panel.
    const panelX = 66, panelY = 150, panelW = 435, panelH = 445;
    ctx.fillStyle = "rgba(8, 12, 28, .58)";
    roundedRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, panelX + 12, panelY + 12, panelW - 24, panelH - 24, 18);
    ctx.clip();
    const art = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    art.addColorStop(0, "#36456d");
    art.addColorStop(1, "#70415f");
    ctx.fillStyle = art;
    ctx.fillRect(panelX + 12, panelY + 12, panelW - 24, panelH - 24);
    ctx.fillStyle = "rgba(255, 230, 205, .11)";
    ctx.beginPath();
    ctx.arc(panelX + panelW / 2, panelY + 190, 154, 0, Math.PI * 2);
    ctx.fill();
    const image = profile.avatar;
    const scale = Math.min((panelW - 42) / image.width, (panelH - 28) / image.height);
    const imageW = image.width * scale, imageH = image.height * scale;
    ctx.drawImage(image, panelX + (panelW - imageW) / 2, panelY + (panelH - imageH) / 2 - 2, imageW, imageH);
    ctx.restore();

    // Character information.
    const infoX = 560;
    ctx.fillStyle = "#b9c3df";
    ctx.font = "500 18px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("CARTE DE MEMBRE", infoX, 202);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#fff8ef";
    ctx.font = "700 54px sans-serif";
    const displayName = profile.displayName;
    ctx.fillText(displayName, infoX, 282, 570);
    ctx.fillStyle = "#c9cce0";
    ctx.font = "400 26px sans-serif";
    ctx.fillText(`@${profile.username}`, infoX, 328, 570);

    ctx.strokeStyle = "rgba(232, 199, 132, .55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(infoX, 368);
    ctx.lineTo(1085, 368);
    ctx.stroke();

    ctx.fillStyle = "#b9c3df";
    ctx.font = "500 16px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("GRADE", infoX, 416);
    ctx.letterSpacing = "0px";

    const badgeWidth = Math.min(520, Math.max(250, ctx.measureText(rank).width + 58));
    ctx.fillStyle = "rgba(232, 199, 132, .13)";
    roundedRect(ctx, infoX, 438, badgeWidth, 62, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 199, 132, .8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#f1d89f";
    ctx.font = "600 25px sans-serif";
    ctx.fillText(rank, infoX + 24, 477, badgeWidth - 44);

    ctx.fillStyle = "rgba(232, 236, 250, .62)";
    ctx.font = "400 16px sans-serif";
    ctx.fillText(`Membre Discord • ${member.guild.name}`, infoX, 562, 570);
    ctx.fillStyle = "#e8c784";
    ctx.fillRect(infoX, 590, 78, 3);
    ctx.fillStyle = "rgba(232, 236, 250, .56)";
    ctx.font = "400 14px sans-serif";
    ctx.fillText("LA SOUL SOCIETY  •  PROFIL ROBLOX", infoX + 94, 596);

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
            const user = interaction.options.getUser("membre") || interaction.user;
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member || user.bot) return interaction.editReply("❌ Je ne trouve pas ce membre sur le serveur.");

            const link = getRobloxLink(user.id);
            if (!link?.robloxUserId) {
                return interaction.editReply(`❌ Aucun compte Roblox n’est lié à <@${user.id}>. Le membre doit d’abord lier son compte avec =link.`);
            }

            const profile = await robloxProfile(link.robloxUserId);
            const rank = currentRank(member);
            const image = makeCard({ member, profile, rank });
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
    }
};
