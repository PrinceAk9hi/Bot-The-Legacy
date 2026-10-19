const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { guildId } = require('../config/qg');

// Separate namespace: never reads the legacy, unscoped IA stores.
function createStore(directory = process.env.QG_AI_DATA_DIR || path.join(__dirname, '..', 'data', 'qg-ai')) {
  const file = path.join(directory, 'state.json');
  let health = 'ok';
  const defaults = () => ({ schemaVersion: 1, guildId, config: { enabled: true, channels: [], retentionDays: 30 }, knowledge: {}, corrections: {}, conversations: {}, events: [], audit: [] });
  function valid(s) {
    if (!s || s.schemaVersion !== 1 || s.guildId !== guildId || !s.config || typeof s.config.enabled !== 'boolean' || !Array.isArray(s.config.channels) || !Array.isArray(s.events) || !Array.isArray(s.audit)) throw Error('Stockage IA QG invalide.');
    for (const key of ['knowledge','corrections','conversations']) if (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key])) throw Error('Stockage IA QG invalide.');
    return s;
  }
  function read() {
    if (!fs.existsSync(file)) return defaults();
    try { return valid(JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch {
      try { const value = valid(JSON.parse(fs.readFileSync(file + '.bak', 'utf8'))); health = 'Sauvegarde utilisée : fichier principal invalide.'; return value; }
      catch { health = 'Stockage corrompu : réponses suspendues, restauration nécessaire.'; throw Error(health); }
    }
  }
  function transact(fn) {
    const s = read(); fn(s); valid(s);
    const cutoff = Date.now() - Math.max(1, Math.min(365, s.config.retentionDays || 30)) * 86400000;
    s.events = s.events.filter(e => e.at >= cutoff).slice(-5000);
    s.audit = s.audit.filter(e => e.at >= cutoff).slice(-1000);
    for (const [key, c] of Object.entries(s.conversations)) if (c.updatedAt < cutoff) delete s.conversations[key];
    for (const c of Object.values(s.corrections)) if (c.updatedAt < cutoff) { delete c.question; delete c.answer; delete c.problem; if(c.status!=='validated'){delete c.correction;c.status='expired';} }
    fs.mkdirSync(directory, { recursive: true });
    if (fs.existsSync(file)) { try { valid(JSON.parse(fs.readFileSync(file, 'utf8'))); fs.copyFileSync(file, file + '.bak'); } catch {} }
    const tmp = file + '.' + randomUUID() + '.tmp';
    // Synchronous transaction without await: serialized within a single Node process.
    fs.writeFileSync(tmp, JSON.stringify(s), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
    return s;
  }
  function event(e) { return transact(s => { if (!s.events.some(x => x.id === e.id)) s.events.push({ ...e, at: Date.now() }); }); }
  function audit(s, type, actor, ref) { s.audit.push({ id: randomUUID(), at: Date.now(), type, actor, ref }); }
  return { read, transact, event, audit, diagnostics: () => ({ health, directory, exists: fs.existsSync(file), persistence: 'Volume persistant requis ; un seul processus écrivain.' }) };
}
module.exports = createStore();
module.exports.createStore = createStore;
