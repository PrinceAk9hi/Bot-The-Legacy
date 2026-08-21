const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "controlStates.json");

function ensureStateFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(
                {
                    chiens: {},
                    menottes: {},
                    lockedNames: {}
                },
                null,
                4
            ),
            "utf8"
        );
    }
}

function mapToObject(map) {
    if (!(map instanceof Map)) {
        return {};
    }

    return Object.fromEntries(map.entries());
}

function objectToMap(object) {
    if (
        !object ||
        typeof object !== "object" ||
        Array.isArray(object)
    ) {
        return new Map();
    }

    return new Map(Object.entries(object));
}

function loadControlStates(client) {
    ensureStateFile();

    try {
        const raw = fs.readFileSync(
            STATE_FILE,
            "utf8"
        );

        const data = raw.trim()
            ? JSON.parse(raw)
            : {};

        client.chiens = objectToMap(
            data.chiens
        );

        client.menottes = objectToMap(
            data.menottes
        );

        client.lockedNames = objectToMap(
            data.lockedNames
        );

        console.log("♻️ États persistants restaurés :");
        console.log(`🐕 ${client.chiens.size} CH`);
        console.log(`🔒 ${client.menottes.size} menotte(s)`);
        console.log(`🔐 ${client.lockedNames.size} pseudo(s) verrouillé(s)`);

        return true;

    } catch (error) {
        console.error(
            "❌ Chargement controlStates.json :",
            error
        );

        client.chiens = new Map();
        client.menottes = new Map();
        client.lockedNames = new Map();

        return false;
    }
}

function saveControlStates(client) {
    ensureStateFile();

    try {
        const data = {
            chiens: mapToObject(
                client.chiens
            ),

            menottes: mapToObject(
                client.menottes
            ),

            lockedNames: mapToObject(
                client.lockedNames
            )
        };

        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(
                data,
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Sauvegarde controlStates.json :",
            error
        );

        return false;
    }
}

module.exports = {
    loadControlStates,
    saveControlStates
};
