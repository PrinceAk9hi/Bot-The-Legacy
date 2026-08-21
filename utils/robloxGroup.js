const noblox = require("noblox.js");

const {
    getRobloxLink,
    updateLastRobloxSync
} = require("./robloxLinks");

// ======================================================
// CONFIG
// ======================================================

const GROUP_ID =
    Number(
        process.env.ROBLOX_GROUP_ID ||
        "194530241"
    );

let loggedIn = false;

// ======================================================
// WAIT
// ======================================================

function wait(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

// ======================================================
// AUTH ROBLOX
// ======================================================

async function ensureRobloxLogin() {
    if (loggedIn) {
        return true;
    }

    const cookie =
        process.env.ROBLOX_COOKIE;

    if (!cookie) {
        throw new Error(
            "ROBLOX_COOKIE_MISSING"
        );
    }

    try {
        await noblox.setCookie(
            cookie
        );

        loggedIn = true;

        console.log(
            "✅ Roblox connecté avec succès"
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Connexion Roblox impossible :",
            error.message
        );

        throw new Error(
            "ROBLOX_AUTH_FAILED"
        );
    }
}

// ======================================================
// LOGIQUE RANK DISCORD → ROBLOX
// ======================================================

function getTargetRobloxRank({
    discordRank,
    hasManagement
}) {
    // Novice : pas dans la communauté
    if (
        discordRank ===
        "novice"
    ) {
        return null;
    }

    // Confirmé
    if (
        discordRank ===
        "confirme"
    ) {
        return hasManagement
            ? 6
            : 5;
    }

    // Expert
    if (
        discordRank ===
        "expert"
    ) {
        return hasManagement
            ? 7
            : 8;
    }

    // Sénior : pas encore configuré
    if (
        discordRank ===
        "senior"
    ) {
        return null;
    }

    return null;
}

// ======================================================
// RANG ACTUEL ROBLOX
// ======================================================

async function getCurrentRobloxRank(
    robloxUserId
) {
    try {
        await ensureRobloxLogin();

        const rank =
            await noblox.getRankInGroup(
                GROUP_ID,
                Number(
                    robloxUserId
                )
            );

        return {
            success: true,
            rank:
                Number(rank)
        };

    } catch (error) {
        const safeError =
            String(
                error?.message ||
                error
            );

        return {
            success: false,
            error:
                safeError
        };
    }
}

// ======================================================
// RÉCUPÉRER UNE DEMANDE D'ENTRÉE
// ======================================================

async function getJoinRequest(
    robloxUserId
) {
    try {
        await ensureRobloxLogin();

        const request =
            await noblox.getJoinRequest(
                GROUP_ID,
                Number(
                    robloxUserId
                )
            );

        if (!request) {
            return {
                success: true,
                pending: false,
                request: null
            };
        }

        return {
            success: true,
            pending: true,
            request
        };

    } catch (error) {
        const message =
            String(
                error?.message ||
                error
            );

        if (
            message.includes("404") ||
            message
                .toLowerCase()
                .includes("not found")
        ) {
            return {
                success: true,
                pending: false,
                request: null
            };
        }

        return {
            success: false,
            pending: false,
            error:
                message
        };
    }
}

// ======================================================
// ACCEPTER LA DEMANDE D'ENTRÉE
// ======================================================

async function acceptJoinRequest(
    robloxUserId
) {
    try {
        await ensureRobloxLogin();

        const current =
            await getCurrentRobloxRank(
                robloxUserId
            );

        // Déjà membre
        if (
            current.success &&
            current.rank > 0
        ) {
            return {
                success: true,
                alreadyMember: true,
                accepted: false,
                rank:
                    current.rank
            };
        }

        const joinRequest =
            await getJoinRequest(
                robloxUserId
            );

        if (!joinRequest.success) {
            return {
                success: false,
                error:
                    joinRequest.error
            };
        }

        if (!joinRequest.pending) {
            return {
                success: false,
                error:
                    "NO_PENDING_JOIN_REQUEST"
            };
        }

        await noblox.handleJoinRequest(
            GROUP_ID,
            Number(
                robloxUserId
            ),
            true
        );

        console.log(
            `✅ Demande Roblox acceptée : ${robloxUserId}`
        );

        return {
            success: true,
            alreadyMember: false,
            accepted: true
        };

    } catch (error) {
        const message =
            String(
                error?.message ||
                error
            );

        console.error(
            "❌ Acceptation Roblox :",
            message
        );

        return {
            success: false,
            error:
                message
        };
    }
}

// ======================================================
// ATTENDRE L'ADHÉSION
// ======================================================

async function waitForGroupMembership(
    robloxUserId,
    {
        attempts = 6,
        delay = 1500
    } = {}
) {
    for (
        let i = 0;
        i < attempts;
        i++
    ) {
        const current =
            await getCurrentRobloxRank(
                robloxUserId
            );

        if (
            current.success &&
            current.rank > 0
        ) {
            return {
                success: true,
                rank:
                    current.rank
            };
        }

        await wait(
            delay
        );
    }

    return {
        success: false,
        error:
            "MEMBERSHIP_CONFIRMATION_TIMEOUT"
    };
}

// ======================================================
// S'ASSURER QUE LE MEMBRE EST DANS LA COMMUNAUTÉ
// ======================================================

async function ensureGroupMembership(
    robloxUserId
) {
    const current =
        await getCurrentRobloxRank(
            robloxUserId
        );

    if (
        current.success &&
        current.rank > 0
    ) {
        return {
            success: true,
            alreadyMember: true,
            accepted: false,
            rank:
                current.rank
        };
    }

    const accepted =
        await acceptJoinRequest(
            robloxUserId
        );

    if (!accepted.success) {
        return accepted;
    }

    const membership =
        await waitForGroupMembership(
            robloxUserId
        );

    if (!membership.success) {
        return membership;
    }

    return {
        success: true,

        alreadyMember:
            accepted.alreadyMember ||
            false,

        accepted:
            accepted.accepted ||
            false,

        rank:
            membership.rank
    };
}

// ======================================================
// CHANGER LE RANG ROBLOX
// ======================================================

async function setRobloxRank({
    discordUserId,
    robloxUserId,
    rankNumber
}) {
    try {
        await ensureRobloxLogin();

        if (!robloxUserId) {
            throw new Error(
                "ROBLOX_USER_ID_MISSING"
            );
        }

        if (
            rankNumber === null ||
            rankNumber === undefined
        ) {
            throw new Error(
                "ROBLOX_RANK_NOT_CONFIGURED"
            );
        }

        // ==================================================
        // VÉRIFIER LE RANG ACTUEL
        // ==================================================

        const currentRank =
            await noblox.getRankInGroup(
                GROUP_ID,
                Number(
                    robloxUserId
                )
            );

        // Déjà au bon rang = succès
        if (
            Number(currentRank) ===
            Number(rankNumber)
        ) {
            updateLastRobloxSync(
                discordUserId,
                {
                    status:
                        "success",

                    rank:
                        rankNumber,

                    error:
                        null
                }
            );

            console.log(
                `✅ Roblox déjà au bon rang : ${robloxUserId} → ${rankNumber}`
            );

            return {
                success: true,
                rank:
                    rankNumber,
                alreadyCorrect:
                    true
            };
        }

        // ==================================================
        // CHANGEMENT DU RANG
        // ==================================================

        const result =
            await noblox.setRank(
                GROUP_ID,
                Number(
                    robloxUserId
                ),
                rankNumber
            );

        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "success",

                rank:
                    rankNumber,

                error:
                    null
            }
        );

        console.log(
            `✅ Roblox sync : ${robloxUserId} → rang ${rankNumber}`
        );

        return {
            success: true,

            rank:
                rankNumber,

            alreadyCorrect:
                false,

            result
        };

    } catch (error) {
        const safeError =
            String(
                error?.message ||
                error
            );

        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "failed",

                rank:
                    rankNumber,

                error:
                    safeError
            }
        );

        console.error(
            "❌ Sync rang Roblox :",
            safeError
        );

        return {
            success: false,
            error:
                safeError
        };
    }
}

// ======================================================
// SYNCHRO COMPLÈTE DISCORD → ROBLOX
// ======================================================

async function syncRobloxRank({
    discordUserId,
    discordRank,
    hasManagement
}) {
    const link =
        getRobloxLink(
            discordUserId
        );

    if (!link) {
        return {
            success: false,
            error:
                "USER_NOT_LINKED"
        };
    }

    const targetRank =
        getTargetRobloxRank({
            discordRank,
            hasManagement
        });

    if (
        targetRank === null
    ) {
        return {
            success: false,
            error:
                "RANK_NOT_CONFIGURED"
        };
    }

    // ==================================================
    // CONFIRMÉ / EXPERT → DOIT ÊTRE MEMBRE
    // ==================================================

    const membership =
        await ensureGroupMembership(
            link.robloxUserId
        );

    if (!membership.success) {
        updateLastRobloxSync(
            discordUserId,
            {
                status:
                    "failed",

                rank:
                    targetRank,

                error:
                    membership.error
            }
        );

        return {
            success: false,
            error:
                membership.error
        };
    }

    // ==================================================
    // ATTRIBUER LE BON RANG
    // ==================================================

    const rankResult =
        await setRobloxRank({
            discordUserId,

            robloxUserId:
                link.robloxUserId,

            rankNumber:
                targetRank
        });

    return {
        ...rankResult,

        joinRequestAccepted:
            membership.accepted ||
            false,

        alreadyMember:
            membership.alreadyMember ||
            false
    };
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    ensureRobloxLogin,
    getTargetRobloxRank,
    getCurrentRobloxRank,
    getJoinRequest,
    acceptJoinRequest,
    waitForGroupMembership,
    ensureGroupMembership,
    setRobloxRank,
    syncRobloxRank
};