const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

// Railway injects RAILWAY_VOLUME_MOUNT_PATH when a persistent volume is
// attached. CARD_STORAGE_DIR can override that location when needed.
const defaultRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "cards")
    : path.join(__dirname, "..", "data", "cards");
const ROOT = path.resolve(process.env.CARD_STORAGE_DIR || defaultRoot);
let serialQueue = Promise.resolve();

function safeId(value) {
    const id = String(value || "");
    if (!/^\d{17,20}$/.test(id)) throw new Error("Identifiant Discord invalide.");
    return id;
}

function readMetadata(file) {
    if (!fs.existsSync(file)) return null;
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Métadonnées de carte invalides ; conservation des données existantes.");
    }
    return value;
}

function atomicWrite(file, buffer) {
    const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(temporary, buffer, { flag: "wx", mode: 0o600 });
    try {
        fs.renameSync(temporary, file);
    } catch (error) {
        try { fs.rmSync(temporary, { force: true }); } catch {}
        throw error;
    }
}

async function saveCard({ userId, image, card }) {
    const id = safeId(userId);
    const previous = serialQueue;
    let release;
    const current = new Promise(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    serialQueue = queued;
    await previous;

    try {
        fs.mkdirSync(ROOT, { recursive: true });
        const memberDir = path.join(ROOT, id);
        fs.mkdirSync(memberDir, { recursive: true });
        const sequenceFile = path.join(ROOT, "collection-sequence.json");
        const sequence = readMetadata(sequenceFile);
        const number = Number(sequence?.lastNumber || 0) + 1;
        if (!Number.isSafeInteger(number) || number < 1) throw new Error("Compteur de collection invalide.");
        atomicWrite(sequenceFile, Buffer.from(JSON.stringify({ schemaVersion: 1, lastNumber: number }, null, 2), "utf8"));
        const serial = `SS-${String(number).padStart(6, "0")}`;
        const nonce = randomBytes(6).toString("hex");
        const basename = `${String(number).padStart(6, "0")}-${nonce}`;
        const imagePath = path.join(memberDir, `${basename}.png`);
        const metadataPath = path.join(memberDir, `${basename}.json`);
        const metadata = {
            schemaVersion: 1,
            serial,
            memberId: id,
            createdAt: new Date().toISOString(),
            rarity: card.rarity,
            style: card.style,
            stats: card.stats,
            effect: card.effect,
            image: `${id}/${basename}.png`
        };

        atomicWrite(imagePath, image);
        try {
            atomicWrite(metadataPath, Buffer.from(JSON.stringify(metadata, null, 2), "utf8"));
        } catch (error) {
            try { fs.rmSync(imagePath, { force: true }); } catch {}
            throw error;
        }
        return { ...metadata, imagePath };
    } finally {
        release();
        if (serialQueue === queued) serialQueue = Promise.resolve();
    }
}

module.exports = { saveCard, ROOT };
