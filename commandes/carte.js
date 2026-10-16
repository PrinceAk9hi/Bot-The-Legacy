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

function makeCard({ member, profile, rank }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Warm, welcoming colors give the card the feel of a family keepsake.
    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, "#fff3e6");
    background.addColorStop(0.52, "#ffe5df");
    background.addColorStop(1, "#f4e5f4");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(250, 325, 10, 250, 325, 480);
    glow.addColorStop(0, "rgba(255, 255, 255, .72)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Soft paper-like medallion and sakura accents.
    ctx.fillStyle = "rgba(255, 255, 255, .42)";
    ctx.beginPath();
    ctx.arc(1040, 100, 160, 0, Math.PI * 2);
    ctx.fill();
    drawSakura(ctx, 1080, 110, 28);
    drawSakura(ctx, 1135, 490, 18);
    drawSakura(ctx, 625, 570, 14);
    drawSakura(ctx, 48, 106, 16);

    // Rounded cream frame, with a subtle rosy edge.
    ctx.fillStyle = "rgba(255, 251, 246, .82)";
    roundedRect(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 126, 133, .46)";
    ctx.lineWidth = 2;
    roundedRect(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 28);
    ctx.stroke();
    ctx.fillStyle = "#d88e9a";
    roundedRect(ctx, 66, 76, 7, 46, 4);
    ctx.fill();
    ctx.fillStyle = "#704b59";
    ctx.font = "700 20px sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("SOUL SOCIETY", 88, 98);
    ctx.fillStyle = "#a47b82";
    ctx.font = "400 14px sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText("UNE FAMILLE, UNE HISTOIRE", 88, 119);
    ctx.letterSpacing = "0px";

    // Character portrait panel.
    const panelX = 66, panelY = 150, panelW = 435, panelH = 445;
    ctx.fillStyle = "#f1d4d0";
    roundedRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.fill();
    ctx.save();
    roundedRect(ctx, panelX + 12, panelY + 12, panelW - 24, panelH - 24, 18);
    ctx.clip();
    const art = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    art.addColorStop(0, "#f8d9cf");
    art.addColorStop(1, "#e9d8ec");
    ctx.fillStyle = art;
    ctx.fillRect(panelX + 12, panelY + 12, panelW - 24, panelH - 24);
    ctx.fillStyle = "rgba(255, 255, 255, .36)";
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
    ctx.fillStyle = "#a56e7a";
    ctx.font = "700 16px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("NOTRE FAMILLE", infoX, 198);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#493944";
    ctx.font = "700 54px sans-serif";
    const displayName = profile.displayName;
    ctx.fillText(displayName, infoX, 282, 570);
    ctx.fillStyle = "#8b737f";
    ctx.font = "400 26px sans-serif";
    ctx.fillText(`@${profile.username}`, infoX, 328, 570);

    ctx.strokeStyle = "rgba(196, 126, 133, .38)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(infoX, 368);
    ctx.lineTo(1085, 368);
    ctx.stroke();

    ctx.fillStyle = "#a56e7a";
    ctx.font = "700 15px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("GRADE", infoX, 416);
    ctx.letterSpacing = "0px";

    const badgeWidth = Math.min(520, Math.max(250, ctx.measureText(rank).width + 58));
    ctx.fillStyle = "#f8e8df";
    roundedRect(ctx, infoX, 438, badgeWidth, 62, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 126, 133, .55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#704b59";
    ctx.font = "700 25px sans-serif";
    ctx.fillText(rank, infoX + 24, 477, badgeWidth - 44);

    ctx.fillStyle = "#8b737f";
    ctx.font = "400 16px sans-serif";
    ctx.fillText(`Membre Discord • ${member.guild.name}`, infoX, 562, 570);
    ctx.fillStyle = "#d88e9a";
    roundedRect(ctx, infoX, 590, 78, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#a47b82";
    ctx.font = "400 14px sans-serif";
    ctx.fillText("HEUREUX DE T’AVOIR PARMI NOUS", infoX + 94, 596);

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
