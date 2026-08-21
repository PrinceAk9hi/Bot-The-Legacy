const fs = require("fs");
const path = require("path");

// ======================================================
// CHEMINS
// ======================================================

const dataDir = path.join(
    __dirname,
    "..",
    "data"
);

const ranksFile = path.join(
    dataDir,
    "ranks.json"
);

// ======================================================
// INITIALISATION
// ======================================================

function ensureFile() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(
            dataDir,
            {
                recursive: true
            }
        );
    }

    if (!fs.existsSync(ranksFile)) {
        fs.writeFileSync(
            ranksFile,
            "[]",
            "utf8"
        );
    }
}

// ======================================================
// LECTURE
// ======================================================

function getRankHistory() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                ranksFile,
                "utf8"
            );

        if (!raw.trim()) {
            return [];
        }

        const data =
            JSON.parse(raw);

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {
        console.error(
            "❌ Erreur lecture ranks.json :",
            error.message
        );

        return [];
    }
}

// ======================================================
// SAUVEGARDE
// ======================================================

function saveRankHistory(history) {
    ensureFile();

    try {
        fs.writeFileSync(
            ranksFile,
            JSON.stringify(
                history,
                null,
                4
            ),
            "utf8"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Erreur sauvegarde ranks.json :",
            error.message
        );

        return false;
    }
}

// ======================================================
// AJOUT HISTORIQUE
// ======================================================

function addRankHistory(entry) {
    const history =
        getRankHistory();

    const finalEntry = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        userId:
            entry.userId || null,

        moderatorId:
            entry.moderatorId || null,

        category:
            entry.category || null,

        action:
            entry.action || null,

        roleKey:
            entry.roleKey || null,

        roleName:
            entry.roleName || null,

        oldRank:
            entry.oldRank || null,

        newRank:
            entry.newRank || null,

        note:
            entry.note || null,

        autoManagement:
            entry.autoManagement || null,

        timestamp:
            Date.now(),

        robloxSync: {
            status:
                "not_required",

            timestamp:
                null,

            error:
                null
        }
    };

    history.push(
        finalEntry
    );

    const saved =
        saveRankHistory(
            history
        );

    if (!saved) {
        throw new Error(
            "Impossible de sauvegarder l'historique des ranks."
        );
    }

    console.log(
        `📝 Historique /rank enregistré : ${finalEntry.roleName} → ${finalEntry.userId}`
    );

    return finalEntry;
}

// ======================================================
// HISTORIQUE MEMBRE
// ======================================================

function getMemberRankHistory(userId) {
    return getRankHistory()
        .filter(
            entry =>
                entry.userId ===
                userId
        )
        .sort(
            (a, b) =>
                b.timestamp -
                a.timestamp
        );
}

// ======================================================
// DERNIER RANKUP
// ======================================================

function getLastRankup(userId) {
    return (
        getMemberRankHistory(
            userId
        ).find(
            entry =>
                entry.category ===
                    "grade" &&
                entry.action ===
                    "add" &&
                entry.newRank
        ) ||
        null
    );
}

// ======================================================
// DERNIÈRE ACTION
// ======================================================

function getLastRankAction(userId) {
    return (
        getMemberRankHistory(
            userId
        )[0] ||
        null
    );
}

// ======================================================
// HISTORIQUE PAR CATÉGORIE
// ======================================================

function getMemberHistoryByCategory(
    userId,
    category
) {
    return getMemberRankHistory(
        userId
    ).filter(
        entry =>
            entry.category ===
            category
    );
}

// ======================================================
// DERNIÈRE ACTION GESTION
// ======================================================

function getLastManagementAction(userId) {
    return (
        getMemberRankHistory(
            userId
        ).find(
            entry =>
                entry.category ===
                "gestion"
        ) ||
        null
    );
}

// ======================================================
// DERNIÈRE ACTION RESPONSABLE
// ======================================================

function getLastResponsibleAction(userId) {
    return (
        getMemberRankHistory(
            userId
        ).find(
            entry =>
                entry.category ===
                "responsable"
        ) ||
        null
    );
}

// ======================================================
// ROBLOX SYNC
// ======================================================

function updateRobloxSync(
    historyId,
    robloxSync
) {
    const history =
        getRankHistory();

    const entry =
        history.find(
            item =>
                item.id ===
                historyId
        );

    if (!entry) {
        return false;
    }

    entry.robloxSync = {
        ...entry.robloxSync,
        ...robloxSync,

        timestamp:
            Date.now()
    };

    return saveRankHistory(
        history
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    getRankHistory,
    saveRankHistory,
    addRankHistory,
    getMemberRankHistory,
    getLastRankup,
    getLastRankAction,
    getMemberHistoryByCategory,
    getLastManagementAction,
    getLastResponsibleAction,
    updateRobloxSync
};