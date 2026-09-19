const fs = require("fs");
const path = require("path");

// Adaptateur des données et composants historiques. Les nouveaux producteurs
// n’utilisent que les noms Soul ; ces anciens noms ne servent qu’à leur lecture.
function normalizeComponentId(value) {
    return typeof value === "string" ? value.replace(/^legacy_/, "soul_") : value;
}
function normalizeTicketTopic(value) {
    return typeof value === "string" ? value.replace(/^legacy-ticket\|/, "soul-ticket|") : value;
}
function migrateKeys(value) {
    if (Array.isArray(value)) return value.map(migrateKeys);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        const next = key.replace(/Legacy/g, "Soul").replace(/legacy/g, "soul");
        const migrated = migrateKeys(child);
        if (Object.hasOwn(result, next) && JSON.stringify(result[next]) !== JSON.stringify(migrated)) {
            throw new Error("Collision de champs pendant la migration La Soul Society : " + next);
        }
        Object.defineProperty(result, next, { value: migrated, enumerable: true, writable: true, configurable: true });
    }
    return result;
}
function migrateDataDirectory(directory) {
    if (!fs.existsSync(directory)) return;
    const source = path.join(directory, "legacyGames.json");
    const destination = path.join(directory, "soulGames.json");
    const operations = [];
    for (const name of ["activityStats.json", "legacyGames.json"]) {
        const file = path.join(directory, name);
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        const migrated = migrateKeys(parsed);
        const target = file === source ? destination : file;
        const content = JSON.stringify(migrated, null, 4);
        if (file !== target && fs.existsSync(target)) {
            const existing = JSON.parse(fs.readFileSync(target, "utf8"));
            if (JSON.stringify(existing) !== JSON.stringify(migrated)) throw new Error("Deux sauvegardes de jeux différentes : migration interrompue pour préserver les données.");
        }
        if (file !== target || JSON.stringify(parsed) !== JSON.stringify(migrated)) operations.push({file,target,raw,content});
    }
    // Valider toutes les sources avant la première écriture. Conserver une copie exacte.
    for (const operation of operations) {
        const backup = path.join(directory, ".soul-migration-backups", path.basename(operation.file));
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        if (!fs.existsSync(backup)) fs.writeFileSync(backup, operation.raw, { flag: "wx" });
        if (operation.target === operation.file || !fs.existsSync(operation.target)) {
            const temporary = operation.target + ".soul-migration.tmp";
            fs.writeFileSync(temporary, operation.content, { flag: "wx" });
            fs.renameSync(temporary, operation.target);
        }
        if (operation.file !== operation.target) fs.unlinkSync(operation.file);
    }
}
module.exports = { normalizeComponentId, normalizeTicketTopic, migrateKeys, migrateDataDirectory };
