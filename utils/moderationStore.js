const fs = require("fs");
const path = require("path");

// ======================================================
// PATHS
// ======================================================

const DATA_DIR = path.join(
    __dirname,
    "..",
    "data"
);

const BANS_FILE = path.join(
    DATA_DIR,
    "bans.json"
);

const BLACKLIST_FILE = path.join(
    DATA_DIR,
    "blacklist.json"
);

// ======================================================
// DEFAULTS
// ======================================================

function defaultBans() {
    return {
        version: 1,
        records: []
    };
}

function defaultBlacklist() {
    return {
        version: 1,
        records: []
    };
}

// ======================================================
// FILE SYSTEM
// ======================================================

function ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }
}

function ensureFile(
    filePath,
    defaultValue
) {
    ensureDirectory();

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(
            filePath,
            JSON.stringify(
                defaultValue(),
                null,
                2
            ),
            "utf8"
        );
    }
}

function readJson(
    filePath,
    defaultValue
) {
    ensureFile(
        filePath,
        defaultValue
    );

    try {
        const raw =
            fs.readFileSync(
                filePath,
                "utf8"
            );

        if (!raw.trim()) {
            return defaultValue();
        }

        return JSON.parse(
            raw
        );

    } catch (error) {
        console.error(
            `❌ Lecture ${path.basename(filePath)} :`,
            error
        );

        return defaultValue();
    }
}

function writeJson(
    filePath,
    value
) {
    ensureDirectory();

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            value,
            null,
            2
        ),
        "utf8"
    );
}

// ======================================================
// BANS
// ======================================================

function getBanData() {
    const data =
        readJson(
            BANS_FILE,
            defaultBans
        );

    if (!Array.isArray(data.records)) {
        data.records = [];
    }

    return data;
}

function saveBanData(
    data
) {
    writeJson(
        BANS_FILE,
        data
    );
}

function addBanRecord(
    record
) {
    const data =
        getBanData();

    // Les anciens bans du même utilisateur
    // ne sont plus considérés comme actifs.
    for (const entry of data.records) {
        if (
            entry.guildId === record.guildId &&
            entry.userId === record.userId &&
            entry.active
        ) {
            entry.active = false;
            entry.closedAt = Date.now();
            entry.closedReason =
                "Remplacé par un nouveau bannissement";
        }
    }

    data.records.push({
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        active:
            true,

        ...record
    });

    // Évite un fichier infini.
    if (data.records.length > 5000) {
        data.records =
            data.records.slice(
                -5000
            );
    }

    saveBanData(
        data
    );

    return data.records[
        data.records.length - 1
    ];
}

function getBanRecords(
    guildId,
    userId
) {
    const data =
        getBanData();

    return data.records
        .filter(
            record =>
                record.guildId === guildId &&
                record.userId === userId
        )
        .sort(
            (a, b) =>
                Number(b.bannedAt || 0) -
                Number(a.bannedAt || 0)
        );
}

function getLatestBanRecord(
    guildId,
    userId
) {
    return (
        getBanRecords(
            guildId,
            userId
        )[0] ||
        null
    );
}

function markBanUnbanned(
    guildId,
    userId,
    {
        moderatorId,
        moderatorTag,
        reason
    } = {}
) {
    const data =
        getBanData();

    const record =
        [...data.records]
            .reverse()
            .find(
                entry =>
                    entry.guildId === guildId &&
                    entry.userId === userId &&
                    entry.active
            );

    if (!record) {
        return null;
    }

    record.active =
        false;

    record.unbannedAt =
        Date.now();

    record.unbannedById =
        moderatorId ||
        null;

    record.unbannedByTag =
        moderatorTag ||
        null;

    record.unbanReason =
        reason ||
        "Aucune raison précisée";

    saveBanData(
        data
    );

    return record;
}

// ======================================================
// BLACKLIST
// ======================================================

function getBlacklistData() {
    const data =
        readJson(
            BLACKLIST_FILE,
            defaultBlacklist
        );

    if (!Array.isArray(data.records)) {
        data.records = [];
    }

    return data;
}

function saveBlacklistData(
    data
) {
    writeJson(
        BLACKLIST_FILE,
        data
    );
}

function addBlacklistRecord(
    record
) {
    const data =
        getBlacklistData();

    const alreadyActive =
        [...data.records]
            .reverse()
            .find(
                entry =>
                    entry.guildId === record.guildId &&
                    entry.userId === record.userId &&
                    entry.active
            );

    if (alreadyActive) {
        return {
            ok: false,
            record:
                alreadyActive
        };
    }

    const newRecord = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        active:
            true,

        ...record
    };

    data.records.push(
        newRecord
    );

    if (data.records.length > 5000) {
        data.records =
            data.records.slice(
                -5000
            );
    }

    saveBlacklistData(
        data
    );

    return {
        ok: true,
        record:
            newRecord
    };
}

function getBlacklistRecords(
    guildId,
    userId
) {
    const data =
        getBlacklistData();

    return data.records
        .filter(
            record =>
                record.guildId === guildId &&
                record.userId === userId
        )
        .sort(
            (a, b) =>
                Number(b.blacklistedAt || 0) -
                Number(a.blacklistedAt || 0)
        );
}

function getLatestBlacklistRecord(
    guildId,
    userId
) {
    return (
        getBlacklistRecords(
            guildId,
            userId
        )[0] ||
        null
    );
}

function removeBlacklist(
    guildId,
    userId,
    {
        moderatorId,
        moderatorTag,
        reason
    } = {}
) {
    const data =
        getBlacklistData();

    const record =
        [...data.records]
            .reverse()
            .find(
                entry =>
                    entry.guildId === guildId &&
                    entry.userId === userId &&
                    entry.active
            );

    if (!record) {
        return null;
    }

    record.active =
        false;

    record.unblacklistedAt =
        Date.now();

    record.unblacklistedById =
        moderatorId ||
        null;

    record.unblacklistedByTag =
        moderatorTag ||
        null;

    record.unblacklistReason =
        reason ||
        "Aucune raison précisée";

    saveBlacklistData(
        data
    );

    return record;
}

function isBlacklisted(
    guildId,
    userId
) {
    return Boolean(
        getBlacklistRecords(
            guildId,
            userId
        ).find(
            record =>
                record.active
        )
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    addBanRecord,
    getBanRecords,
    getLatestBanRecord,
    markBanUnbanned,

    addBlacklistRecord,
    getBlacklistRecords,
    getLatestBlacklistRecord,
    removeBlacklist,
    isBlacklisted
};