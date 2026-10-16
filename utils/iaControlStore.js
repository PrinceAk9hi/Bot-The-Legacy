const fs = require('node:fs');
const path = require('node:path');
let DATA = path.join(__dirname, '..', 'data');
const FILES = Object.freeze({ config: 'iaControlConfig', metrics: 'iaControlMetrics', audit: 'iaControlAudit', escalations: 'iaControlEscalations', issues: 'iaControlIssues', errors: 'iaControlErrors', knowledge:'iaControlKnowledge' });
const defaults = { config:{schemaVersion:1,config:{autoRepliesEnabled:true,maintenance:false}}, metrics:{schemaVersion:1,events:[]}, audit:{schemaVersion:1,events:[]}, escalations:{schemaVersion:1,items:{}}, issues:{schemaVersion:1,items:{}}, errors:{schemaVersion:1,events:[]}, knowledge:{schemaVersion:1,items:{}} };
let chain = Promise.resolve();
const recoveryState = Object.create(null);
function normalize(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredClone(defaults[key]);
  return { ...structuredClone(defaults[key]), ...value };
}
function read(key) {
  if (!FILES[key]) throw new Error('Unknown IA store key');
  const file = path.join(DATA, FILES[key] + '.json');
  try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8')), key); }
  catch (error) {
    if (error.code === 'ENOENT') return structuredClone(defaults[key]);
    const backup = file + '.bak';
    try { const valid = normalize(JSON.parse(fs.readFileSync(backup, 'utf8')), key); recoveryState[key] = 'corrupt primary; backup loaded'; return valid; } catch {}
    recoveryState[key] = 'corrupt primary and no valid backup; safe defaults loaded';
    return structuredClone(defaults[key]);
  }
}
function write(key, value) {
  if (!FILES[key]) throw new Error('Unknown IA store key');
  fs.mkdirSync(DATA, { recursive: true });
  const file = path.join(DATA, FILES[key] + '.json');
  const temp = file + '.' + process.pid + '.tmp';
  const content = JSON.stringify(normalize(value, key), null, 2);
  if (fs.existsSync(file)) { try { JSON.parse(fs.readFileSync(file, 'utf8')); fs.copyFileSync(file, file + '.bak'); } catch {} }
  fs.writeFileSync(temp, content, { encoding: 'utf8', flag: 'w' });
  try { fs.renameSync(temp, file); }
  catch (error) {
    if (!['EPERM','EEXIST'].includes(error.code) || !fs.existsSync(file)) throw error;
    const displaced = file + '.previous';
    try { if (fs.existsSync(displaced)) fs.unlinkSync(displaced); fs.renameSync(file, displaced); fs.renameSync(temp, file); fs.unlinkSync(displaced); }
    catch (replaceError) { if (!fs.existsSync(file) && fs.existsSync(displaced)) fs.renameSync(displaced, file); throw replaceError; }
  }
}
function transact(key, callback) {
  // Synchronous atomic rename; serialized in this Node process. One Railway replica is required for JSON mode.
  const value = read(key); callback(value); value.schemaVersion = 1; write(key, value); return value;
}
function push(key, event, max = 2000) { return transact(key, data => { data.events = Array.isArray(data.events) ? data.events : []; if (event.id && data.events.some(existing=>existing.id===event.id)) return; data.events.push(event); if (data.events.length > max) data.events.splice(0, data.events.length - max); }); }
function audit(type, actorId, detail = {}, ref = null) { return push('audit', { id: require('node:crypto').randomUUID(), at: Date.now(), type, actorId: actorId || null, ref, detail: String(detail.message || type).slice(0, 400) }); }
function setDataDirectory(directory) { DATA = directory; }
function diagnostics() { return Object.entries(recoveryState).map(([file,status])=>`${FILES[file]}.json: ${status}`); }
module.exports = { FILES, read, write, transact, push, audit, setDataDirectory, diagnostics };
