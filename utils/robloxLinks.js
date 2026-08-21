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

const linksFile = path.join(
    dataDir,
    "robloxLinks.json"
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

    if (!fs.existsSync(linksFile)) {
        fs.writeFileSync(
            linksFile,
            "{}",
            "utf8"
        );
    }
}

// ======================================================
// LECTURE
// ======================================================

function getRobloxLinks() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                linksFile,
                "utf8"
            );

        if (!raw.trim()) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        if (
            typeof parsed !== "object" ||
            Array.isArray(parsed) ||
            parsed === null
        ) {
            return {};
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ Erreur lecture robloxLinks.json :",
            error.message
        );

        return {};
    }
}

// ======================================================
// SAUVEGARDE
// ======================================================

function saveRobloxLinks(data) {
    ensureFile();

    try {
        fs.writeFileSync(
            linksFile,
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
            "❌ Erreur sauvegarde robloxLinks.json :",
            error.message
        );

        return false;
    }
}

// ======================================================
// RÉCUPÉRER UNE LIAISON
// ======================================================

function getRobloxLink(discordUserId) {
    const links =
        getRobloxLinks();

    return (
        links[discordUserId] ||
        null
    );
}

// ======================================================
// SAVOIR SI UN MEMBRE EST RELIÉ
// ======================================================

function hasRobloxLink(discordUserId) {
    return Boolean(
        getRobloxLink(
            discordUserId
        )
    );
}

// ======================================================
// CRÉER / MODIFIER UNE LIAISON
// ======================================================

function setRobloxLink({
    discordUserId,
    robloxUserId,
    robloxUsername,
    source = "manual"
}) {
    if (
        !discordUserId ||
        !robloxUserId ||
        !robloxUsername
    ) {
        throw new Error(
            "Données de liaison Roblox incomplètes."
        );
    }

    const links =
        getRobloxLinks();

    const ancienneLiaison =
        links[
            discordUserId
        ];

    links[
        discordUserId
    ] = {
        discordUserId:
            String(
                discordUserId
            ),

        robloxUserId:
            String(
                robloxUserId
            ),

        robloxUsername:
            String(
                robloxUsername
            ),

        source,

        linkedAt:
            ancienneLiaison
                ?.linkedAt ||
            Date.now(),

        updatedAt:
            Date.now(),

        lastSync: {
            status:
                ancienneLiaison
                    ?.lastSync
                    ?.status ||
                "never",

            rank:
                ancienneLiaison
                    ?.lastSync
                    ?.rank ||
                null,

            timestamp:
                ancienneLiaison
                    ?.lastSync
                    ?.timestamp ||
                null,

            error:
                ancienneLiaison
                    ?.lastSync
                    ?.error ||
                null
        }
    };

    const saved =
        saveRobloxLinks(
            links
        );

    if (!saved) {
        throw new Error(
            "Impossible de sauvegarder la liaison Roblox."
        );
    }

    console.log(
        `🔗 Compte Roblox lié : Discord ${discordUserId} → Roblox ${robloxUsername}`
    );

    return links[
        discordUserId
    ];
}

// ======================================================
// SUPPRIMER UNE LIAISON
// ======================================================

function removeRobloxLink(
    discordUserId
) {
    const links =
        getRobloxLinks();

    if (
        !links[
            discordUserId
        ]
    ) {
        return false;
    }

    delete links[
        discordUserId
    ];

    return saveRobloxLinks(
        links
    );
}

// ======================================================
// METTRE À JOUR LE DERNIER SYNC
// ======================================================

function updateLastRobloxSync(
    discordUserId,
    {
        status,
        rank = null,
        error = null
    }
) {
    const links =
        getRobloxLinks();

    const link =
        links[
            discordUserId
        ];

    if (!link) {
        return false;
    }

    link.lastSync = {
        status:
            status ||
            "unknown",

        rank,

        timestamp:
            Date.now(),

        error
    };

    return saveRobloxLinks(
        links
    );
}

// ======================================================
// TROUVER VIA ROBLOX USER ID
// ======================================================

function getDiscordLinkByRobloxId(
    robloxUserId
) {
    const links =
        getRobloxLinks();

    return (
        Object.values(
            links
        ).find(
            link =>
                String(
                    link.robloxUserId
                ) ===
                String(
                    robloxUserId
                )
        ) ||
        null
    );
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    getRobloxLinks,
    saveRobloxLinks,
    getRobloxLink,
    hasRobloxLink,
    setRobloxLink,
    removeRobloxLink,
    updateLastRobloxSync,
    getDiscordLinkByRobloxId
};