const {
    setRobloxLink
} = require("./robloxLinks");

// ======================================================
// NETTOYER UN @ ROBLOX
// ======================================================

function cleanRobloxUsername(username) {
    if (!username) {
        return null;
    }

    return String(username)
        .trim()
        .replace(/^@/, "")
        .trim();
}

// ======================================================
// TROUVER UN COMPTE ROBLOX PAR PSEUDO
// ======================================================

async function findRobloxUserByUsername(username) {
    const cleanUsername =
        cleanRobloxUsername(
            username
        );

    if (!cleanUsername) {
        return {
            success: false,
            error: "INVALID_USERNAME"
        };
    }

    try {
        const response =
            await fetch(
                "https://users.roblox.com/v1/usernames/users",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            usernames: [
                                cleanUsername
                            ],

                            excludeBannedUsers:
                                false
                        })
                }
            );

        if (!response.ok) {
            console.error(
                "❌ Roblox username lookup :",
                response.status
            );

            return {
                success: false,
                error: "ROBLOX_API_ERROR"
            };
        }

        const data =
            await response.json();

        const user =
            data?.data?.[0];

        if (!user) {
            return {
                success: false,
                error: "USER_NOT_FOUND"
            };
        }

        return {
            success: true,

            user: {
                id:
                    String(user.id),

                username:
                    user.name,

                displayName:
                    user.displayName
            }
        };

    } catch (error) {
        console.error(
            "❌ Recherche compte Roblox :",
            error.message
        );

        return {
            success: false,
            error: "ROBLOX_UNAVAILABLE"
        };
    }
}

// ======================================================
// LIER DISCORD → ROBLOX
// ======================================================

async function linkDiscordToRoblox({
    discordUserId,
    robloxUsername,
    source = "manual"
}) {
    const result =
        await findRobloxUserByUsername(
            robloxUsername
        );

    if (!result.success) {
        return result;
    }

    try {
        const link =
            setRobloxLink({
                discordUserId,

                robloxUserId:
                    result.user.id,

                robloxUsername:
                    result.user.username,

                source
            });

        return {
            success: true,

            user:
                result.user,

            link
        };

    } catch (error) {
        console.error(
            "❌ Liaison Discord/Roblox :",
            error.message
        );

        return {
            success: false,
            error: "SAVE_FAILED"
        };
    }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    cleanRobloxUsername,
    findRobloxUserByUsername,
    linkDiscordToRoblox
};