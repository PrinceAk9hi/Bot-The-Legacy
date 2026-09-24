const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const BINARY = path.join(__dirname, '..', '.music-bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const MAX_SECONDS = 7200;
const BASE = ['--ignore-config', '--no-plugin-dirs', '--no-cache-dir', '--no-warnings', '--no-playlist', '--socket-timeout', '12', '--retries', '1', '--extractor-retries', '1', '--no-js-runtimes', '--js-runtimes', 'node:' + process.execPath];
class MusicError extends Error {}
function input(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 300) throw new MusicError('Indique un titre ou un lien YouTube (300 caractères maximum).');
    if (!/^(?:https?:\/\/|www\.|(?:music\.|m\.)?youtube\.com|youtu\.be)/i.test(text)) {
        if (/^[\w+.-]+:/.test(text)) throw new MusicError('Seuls les liens YouTube et les recherches par titre sont acceptés.');
        return { query: 'ytsearch5:' + text, search: true };
    }
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text); } catch { throw new MusicError('Lien YouTube invalide.'); }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'].includes(url.hostname) || url.username || url.password || url.port) throw new MusicError('Ce lien ne correspond pas à une vidéo YouTube.');
    const id = url.hostname.endsWith('youtu.be') ? url.pathname.split('/')[1] : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw new MusicError('Colle le lien d’une vidéo YouTube ; les playlists seules ne sont pas prises en charge.');
    return { query: 'https://www.youtube.com/watch?v=' + id, search: false };
}
function available() {
    if (!fs.existsSync(BINARY)) throw new MusicError('Le lecteur YouTube n’est pas installé. Relance le déploiement avec npm install.');
}
function track(data) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(data.id || '') || data.is_live || ['is_live', 'is_upcoming'].includes(data.live_status)) return null;
    const duration = Number(data.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) return null;
    return { id: data.id, title: String(data.title || 'Vidéo YouTube').slice(0,180), duration, url: 'https://www.youtube.com/watch?v=' + data.id };
}
function friendly(stderr) {
    if (/sign in|confirm you|not a bot|po token|HTTP Error (403|429)/i.test(stderr)) return 'YouTube bloque actuellement cette lecture depuis l’hébergeur. Réessaie plus tard ou avec une autre vidéo.';
    if (/private|unavailable|age.restricted|copyright|not available/i.test(stderr)) return 'Cette vidéo est privée, restreinte ou indisponible.';
    return 'YouTube n’a pas fourni de piste lisible. Réessaie avec une autre vidéo.';
}
async function lookup(value) {
    available(); const parsed = input(value);
    return new Promise((resolve, reject) => execFile(BINARY, [...BASE, '--flat-playlist', '--dump-single-json', '--skip-download', '--', parsed.query], { windowsHide: true, timeout: 45000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return reject(new MusicError(error.killed ? 'La recherche YouTube a expiré. Réessaie dans un instant.' : friendly(stderr)));
        try {
            const data = JSON.parse(stdout), tracks = (parsed.search ? data.entries || [] : [data]).map(track).filter(Boolean).slice(0,5);
            if (!tracks.length) throw new MusicError('Aucun résultat lisible : choisis une vidéo non diffusée en direct et de moins de 2 heures.');
            resolve({ tracks, search: parsed.search });
        } catch (e) { reject(e instanceof MusicError ? e : new MusicError('La réponse YouTube est illisible. Réessaie.')); }
    }));
}
function open(track, onError) {
    available();
    const ffmpeg = require('ffmpeg-static');
    if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new MusicError('Le décodeur audio est absent. Réinstalle les dépendances du bot.');
    const yt = spawn(BINARY, [...BASE, '-f', 'bestaudio/best', '--no-progress', '--no-part', '-o', '-', '--', input(track.url).query], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    const ff = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-i','pipe:0','-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'], { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let stopped = false, failed = false, diagnostic = '';
    const fail = message => { if (!stopped && !failed) { failed = true; onError(new MusicError(message)); } };
    yt.stderr.on('data', b => { diagnostic = (diagnostic + b.toString()).slice(-4000); });
    ff.stderr.resume();
    yt.on('error', () => fail('Le lecteur YouTube n’a pas pu démarrer.'));
    ff.on('error', () => fail('Le décodeur audio n’a pas pu démarrer.'));
    yt.on('close', code => { if (code) fail(friendly(diagnostic)); });
    ff.on('close', code => { if (code) fail(friendly(diagnostic)); });
    yt.stdout.on('error', () => fail('La connexion audio a été interrompue.'));
    ff.stdin.on('error', () => fail(friendly(diagnostic)));
    ff.stdout.on('error', () => fail('Le flux audio a été interrompu.'));
    yt.stdout.pipe(ff.stdin);
    return { stream: ff.stdout, close() { if (stopped) return; stopped = true; yt.stdout.unpipe(ff.stdin); yt.kill('SIGKILL'); ff.kill('SIGKILL'); yt.stdout.destroy(); ff.stdin.destroy(); ff.stdout.destroy(); } };
}
module.exports = { MusicError, input, track, lookup, open, friendly, BINARY, MAX_SECONDS };
