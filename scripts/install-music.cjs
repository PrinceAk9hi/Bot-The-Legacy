// Binaire officiel autonome : aucune installation Python nécessaire sur Railway.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const VERSION = '2026.08.19';
const RELEASES = {
    'win32:x64': ['yt-dlp.exe', '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a'],
    'linux:x64': ['yt-dlp_linux', '58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'],
    'linux:arm64': ['yt-dlp_linux_aarch64', 'b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc'],
    'darwin:x64': ['yt-dlp_macos', '0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202'],
    'darwin:arm64': ['yt-dlp_macos', '0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202']
};
async function install() {
    const release = RELEASES[process.platform + ':' + process.arch];
    if (!release) throw new Error('Plateforme audio non prise en charge');
    const [asset, sha] = release;
    const file = path.join(__dirname, '..', '.music-bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    const valid = bytes => createHash('sha256').update(bytes).digest('hex') === sha;
    try { if (valid(await fs.readFile(file))) return; } catch {}
    const response = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/${asset}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error('Téléchargement audio HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes)) throw new Error('Signature SHA256 du binaire audio incorrecte');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + '.tmp', bytes, { mode: 0o755 });
    await fs.rename(file + '.tmp', file);
    if (process.platform !== 'win32') await fs.chmod(file, 0o755);
    console.log('Musique : yt-dlp ' + VERSION + ' installé et SHA256 vérifié.');
}
if (require.main === module) install().catch(error => {
    // Un incident YouTube ne doit pas empêcher les autres systèmes de démarrer.
    console.error('Musique indisponible : ' + error.message + '. Relancer npm run postinstall.');
});
module.exports = { install, VERSION, RELEASES };
