const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIG
// ======================================================

const DATA_DIR = path.join(
    __dirname,
    "..",
    "data"
);

const DATA_FILE = path.join(
    DATA_DIR,
    "unions.json"
);

// ======================================================
// DEFAULT
// ======================================================

function defaultData() {
    return {
        version: 2,
        unions: []
    };
}

// ======================================================
// FILE SYSTEM
// ======================================================

function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                defaultData(),
                null,
                2
            ),
            "utf8"
        );
    }
}

function loadData() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return defaultData();
        }

        const parsed =
            JSON.parse(
                raw
            );

        if (
            !Array.isArray(
                parsed.unions
            )
        ) {
            parsed.unions = [];
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ Lecture unions.json :",
            error
        );

        return defaultData();
    }
}

function saveData(
    data
) {
    ensureFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}

// ======================================================
// UNION ACTIVE D'UN MEMBRE
// ======================================================

function getActiveUnionForMember(
    guildId,
    userId
) {
    const data =
        loadData();

    return (
        data.unions.find(
            union =>
                union.guildId === guildId &&
                union.active === true &&
                (
                    union.member1Id === userId ||
                    union.member2Id === userId
                )
        ) ||
        null
    );
}

// ======================================================
// UNION ENTRE DEUX MEMBRES
// ======================================================

function getActiveUnionBetween(
    guildId,
    member1Id,
    member2Id
) {
    const data =
        loadData();

    return (
        data.unions.find(
            union =>
                union.guildId === guildId &&
                union.active === true &&
                (
                    (
                        union.member1Id === member1Id &&
                        union.member2Id === member2Id
                    ) ||
                    (
                        union.member1Id === member2Id &&
                        union.member2Id === member1Id
                    )
                )
        ) ||
        null
    );
}

// ======================================================
// TOUTES LES UNIONS ACTIVES
// ======================================================

function getAllActiveUnions(
    guildId
) {
    const data =
        loadData();

    return data.unions
        .filter(
            union =>
                union.guildId === guildId &&
                union.active === true
        )
        .sort(
            (a, b) =>
                Number(b.createdAt || 0) -
                Number(a.createdAt || 0)
        );
}

// ======================================================
// HISTORIQUE COMPLET D'UN MEMBRE
// ======================================================

function getUnionHistoryForMember(
    guildId,
    userId
) {
    const data =
        loadData();

    return data.unions
        .filter(
            union =>
                union.guildId === guildId &&
                (
                    union.member1Id === userId ||
                    union.member2Id === userId
                )
        )
        .sort(
            (a, b) =>
                Number(b.createdAt || 0) -
                Number(a.createdAt || 0)
        );
}

// ======================================================
// BOOL
// ======================================================

function isMemberUnited(
    guildId,
    userId
) {
    return Boolean(
        getActiveUnionForMember(
            guildId,
            userId
        )
    );
}

// ======================================================
// CREATE
// ======================================================

function createUnion({
    guildId,

    member1Id,
    member1Tag,

    member2Id,
    member2Tag,

    createdBy,

    source = "union",

    compatibility = null
}) {
    const data =
        loadData();

    const member1Union =
        data.unions.find(
            union =>
                union.guildId === guildId &&
                union.active &&
                (
                    union.member1Id === member1Id ||
                    union.member2Id === member1Id
                )
        );

    if (member1Union) {
        return {
            ok: false,
            reason:
                "member1_already_united",
            union:
                member1Union
        };
    }

    const member2Union =
        data.unions.find(
            union =>
                union.guildId === guildId &&
                union.active &&
                (
                    union.member1Id === member2Id ||
                    union.member2Id === member2Id
                )
        );

    if (member2Union) {
        return {
            ok: false,
            reason:
                "member2_already_united",
            union:
                member2Union
        };
    }

    const union = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        guildId,

        member1Id,

        member1Tag:
            member1Tag ||
            null,

        member2Id,

        member2Tag:
            member2Tag ||
            null,

        source,

        compatibility:
            Number.isFinite(
                compatibility
            )
                ? compatibility
                : null,

        createdBy:
            createdBy ||
            member1Id,

        createdAt:
            Date.now(),

        active:
            true,

        deletedAt:
            null,

        deletedBy:
            null,

        deleteReason:
            null
    };

    data.unions.push(
        union
    );

    saveData(
        data
    );

    return {
        ok: true,
        union
    };
}

// ======================================================
// ROLLBACK
// ======================================================

function rollbackUnion(
    unionId
) {
    const data =
        loadData();

    const index =
        data.unions.findIndex(
            union =>
                union.id === unionId
        );

    if (
        index ===
        -1
    ) {
        return false;
    }

    data.unions.splice(
        index,
        1
    );

    saveData(
        data
    );

    return true;
}

// ======================================================
// DELETE UNION
// ======================================================

function deleteUnion({
    guildId,
    member1Id,
    member2Id,
    deletedBy,
    deletedByTag,
    reason
}) {
    const data =
        loadData();

    const union =
        data.unions.find(
            entry =>
                entry.guildId === guildId &&
                entry.active === true &&
                (
                    (
                        entry.member1Id === member1Id &&
                        entry.member2Id === member2Id
                    ) ||
                    (
                        entry.member1Id === member2Id &&
                        entry.member2Id === member1Id
                    )
                )
        );

    if (!union) {
        return {
            ok: false,
            reason:
                "not_found"
        };
    }

    union.active =
        false;

    union.deletedAt =
        Date.now();

    union.deletedBy =
        deletedBy ||
        null;

    union.deletedByTag =
        deletedByTag ||
        null;

    union.deleteReason =
        reason ||
        "Aucune raison précisée";

    saveData(
        data
    );

    return {
        ok: true,
        union
    };
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    loadData,

    getActiveUnionForMember,
    getActiveUnionBetween,
    getAllActiveUnions,
    getUnionHistoryForMember,

    isMemberUnited,

    createUnion,
    rollbackUnion,
    deleteUnion
};