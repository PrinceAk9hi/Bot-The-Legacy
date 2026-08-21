const fs = require("fs");
const path = require("path");

const {
    linkDiscordToRoblox
} = require("./robloxAccount");

const {
    getRobloxLink
} = require("./robloxLinks");

// ======================================================
// CHEMIN CANDIDATURES
// ======================================================

const candidaturesFile = path.join(
    __dirname,
    "..",
    "data",
    "candidatures.json"
);

// ======================================================
// LIRE LES CANDIDATURES
// ======================================================

function getCandidatures() {
    try {
        if (!fs.existsSync(candidaturesFile)) {
            return {};
        }

        const raw =
            fs.readFileSync(
                candidaturesFile,
                "utf8"
            );

        if (!raw.trim()) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            return {};
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ Erreur lecture candidatures.json :",
            error.message
        );

        return {};
    }
}

// ======================================================
// NETTOYER LA RÉPONSE ROBLOX
// ======================================================

function extractRobloxUsername(value) {
    if (!value) {
        return null;
    }

    let username =
        String(value)
            .trim();

    // Enlève un éventuel @
    username =
        username.replace(
            /^@/,
            ""
        );

    // Si le candidat a écrit quelque chose comme :
    // "@Pseudo Roblox"
    // on prend le premier bloc exploitable
    username =
        username
            .split(/\s+/)[0]
            .trim();

    if (!username) {
        return null;
    }

    return username;
}

// ======================================================
// TROUVER LE @ ROBLOX DANS LA CANDIDATURE
// ======================================================

function getRobloxUsernameFromCandidature(
    discordUserId
) {
    const candidatures =
        getCandidatures();

    const candidature =
        candidatures[
            discordUserId
        ];

    if (!candidature) {
        return {
            success: false,
            error: "CANDIDATURE_NOT_FOUND"
        };
    }

    const rawUsername =
        candidature
            ?.answers
            ?.question1;

    if (!rawUsername) {
        return {
            success: false,
            error: "ROBLOX_USERNAME_NOT_FOUND"
        };
    }

    const username =
        extractRobloxUsername(
            rawUsername
        );

    if (!username) {
        return {
            success: false,
            error: "INVALID_ROBLOX_USERNAME"
        };
    }

    return {
        success: true,
        username,
        rawUsername
    };
}

// ======================================================
// LIER DEPUIS LA CANDIDATURE
// ======================================================

async function linkRobloxFromCandidature(
    discordUserId,
    {
        force = false
    } = {}
) {
    try {
        // ==============================================
        // DÉJÀ RELIÉ ?
        // ==============================================

        const existing =
            getRobloxLink(
                discordUserId
            );

        if (
            existing &&
            !force
        ) {
            return {
                success: true,
                alreadyLinked: true,
                link: existing
            };
        }

        // ==============================================
        // RÉCUPÉRER @ ROBLOX DE LA CANDIDATURE
        // ==============================================

        const candidatureResult =
            getRobloxUsernameFromCandidature(
                discordUserId
            );

        if (
            !candidatureResult.success
        ) {
            return candidatureResult;
        }

        console.log(
            `🔎 Liaison Roblox depuis candidature : Discord ${discordUserId} → ${candidatureResult.username}`
        );

        // ==============================================
        // RÉSOLUTION ROBLOX + SAUVEGARDE
        // ==============================================

        const result =
            await linkDiscordToRoblox({
                discordUserId,

                robloxUsername:
                    candidatureResult.username,

                source:
                    "candidature"
            });

        if (!result.success) {
            return result;
        }

        console.log(
            `✅ Liaison créée depuis candidature : ${discordUserId} → ${result.user.username} (${result.user.id})`
        );

        return {
            success: true,
            alreadyLinked: false,
            user: result.user,
            link: result.link
        };

    } catch (error) {
        console.error(
            "❌ Liaison Roblox depuis candidature :",
            error.message
        );

        return {
            success: false,
            error: "UNKNOWN_ERROR"
        };
    }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    getCandidatures,
    extractRobloxUsername,
    getRobloxUsernameFromCandidature,
    linkRobloxFromCandidature
};