const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

// Local panel art stays in its original format (including animated GIFs).
function localImage(filePath, attachmentName) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) throw new Error(`Image de panel introuvable : ${path.basename(absolute)}`);
  const stat = fs.statSync(absolute);
  // Discord's regular bot upload limit is 25 MiB. Keep headroom and fail clearly.
  if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error(`Image de panel invalide ou trop volumineuse : ${path.basename(absolute)}`);
  const name = path.basename(attachmentName || absolute);
  return { url: `attachment://${name}`, file: new AttachmentBuilder(absolute, { name }) };
}

function directImage(url) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('L’image distante doit être une URL HTTPS directe.');
  const pathname = new URL(url).pathname;
  if (!/\.(?:gif|png|jpe?g|webp)$/i.test(pathname)) throw new Error('Utilise l’URL directe du fichier image, pas la page qui le contient.');
  return url;
}

module.exports = { localImage, directImage };
