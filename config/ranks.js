// ======================================================
// GRADES PRINCIPAUX
// ======================================================

const MAIN_RANKS = {
    novice: {
        name: "Novice (Test)",
        roleId: "1531761113933414542",
        robloxRank: null
    },

    confirme: {
        name: "Héritier Confirmé",
        roleId: "1531761056744083648",
        robloxRank: null
    },

    expert: {
        name: "Héritier Expert",
        roleId: "1531760794822508800",
        robloxRank: null
    },

    senior: {
        name: "Héritier Sénior",
        roleId: "1531760661271543969",
        robloxRank: null
    }
};

// ======================================================
// GESTIONS / RESPONSABLES
// ======================================================

const MANAGEMENT_ROLES = {
    recrutement: {
        gestion: {
            name: "Gestion Recrutement",
            roleId: "1458394180651843635"
        },

        responsable: {
            name: "Responsable Recrutements",
            roleId: "1532085431947100281"
        }
    },

    tickets: {
        gestion: {
            name: "Gestion Tickets",
            roleId: "1495888679535644753"
        },

        responsable: {
            name: "Responsable Tickets",
            roleId: "1532085331656970400"
        }
    },

    rp: {
        gestion: {
            name: "Gestion RP",
            roleId: "1490131448424956024"
        },

        responsable: {
            name: "Responsable RP",
            roleId: "1532085176656597265"
        }
    },

    sanctions: {
        gestion: {
            name: "Gestion Sanctions/Rankups",
            roleId: "1516451475415367822"
        },

        responsable: {
            name: "Responsable Sanctions",
            roleId: "1531760308761133229"
        }
    },

    design: {
        gestion: {
            name: "Gestion Design",
            roleId: "1514336673540997341"
        },

        responsable: {
            name: "Responsable Designs",
            roleId: "1532085056472879135"
        }
    },

    communication: {
        gestion: {
            name: "Gestion Communication",
            roleId: "1490086893482672290"
        },

        responsable: {
            name: "Responsable Communication",
            roleId: "1532085057806925876"
        }
    },

    recrutementsIG: {
        gestion: {
            name: "Gestion Recrutements IG",
            roleId: "1464381489407066286"
        },

        responsable: {
            name: "Responsable Recrutements IG",
            roleId: "1532085573601460254"
        }
    },

    animations: {
        gestion: {
            name: "Gestion Animations",
            roleId: "1458394404568957052"
        },

        responsable: {
            name: "Responsable Animations",
            roleId: "1532084983748100237"
        }
    }
};

// ======================================================
// CONFIGURATION GÉNÉRALE /RANK
// ======================================================

const RANK_CONFIG = {
    // Salon des logs /rank
    logChannelId: "1459682952601407641",

    // Salon public pour rankups / nouvelles responsabilités
    publicChannelId: "1531375423424823407",

    // Les retraits ne sont pas annoncés publiquement
    publishRemovals: false,

    // Responsable => ajoute aussi la Gestion correspondante
    responsibleIncludesManagement: true,

    // Si on retire Responsable, on conserve la Gestion
    removeManagementWithResponsible: false,

    // Couleurs embeds
    embedColor: 0x3B6475,
    rankupColor: 0x57F287,
    managementColor: 0x3B6475,
    responsibleColor: 0xF1C40F,
    removalColor: 0xED4245
};

// ======================================================
// RÔLES AUTORISÉS À UTILISER /RANK
// ======================================================

const RANK_ALLOWED_ROLES = [
    "1458414705717805189", // Fondateur
    "1467277541696868412", // Souverain
    "1531760308761133229"  // Responsable Sanctions
];

// ======================================================
// HELPERS : GRADES
// ======================================================

function getMainRankByKey(key) {
    return MAIN_RANKS[key] || null;
}

function getMainRankByRoleId(roleId) {
    const found =
        Object.entries(
            MAIN_RANKS
        ).find(
            ([, rank]) =>
                rank.roleId === roleId
        );

    if (!found) {
        return null;
    }

    return {
        key: found[0],
        ...found[1]
    };
}

// ======================================================
// HELPERS : GESTIONS
// ======================================================

function getAllManagementRoles() {
    return Object.entries(
        MANAGEMENT_ROLES
    ).map(
        ([key, value]) => ({
            key,
            name:
                value.gestion.name,
            roleId:
                value.gestion.roleId
        })
    );
}

function getAllResponsibleRoles() {
    return Object.entries(
        MANAGEMENT_ROLES
    ).map(
        ([key, value]) => ({
            key,
            name:
                value.responsable.name,
            roleId:
                value.responsable.roleId
        })
    );
}

function getManagementByKey(key) {
    return (
        MANAGEMENT_ROLES[key] ||
        null
    );
}

// ======================================================
// HELPER CENTRAL : CATÉGORIE + CLÉ
// ======================================================

function getRoleConfigByCategory(
    category,
    roleKey
) {
    // ==============================================
    // GRADE
    // ==============================================

    if (category === "grade") {
        const rank =
            MAIN_RANKS[
                roleKey
            ];

        if (!rank) {
            return null;
        }

        return {
            key:
                roleKey,

            category:
                "grade",

            name:
                rank.name,

            roleId:
                rank.roleId,

            robloxRank:
                rank.robloxRank
        };
    }

    // ==============================================
    // GESTION
    // ==============================================

    if (category === "gestion") {
        const management =
            MANAGEMENT_ROLES[
                roleKey
            ];

        if (!management) {
            return null;
        }

        return {
            key:
                roleKey,

            category:
                "gestion",

            name:
                management
                    .gestion
                    .name,

            roleId:
                management
                    .gestion
                    .roleId
        };
    }

    // ==============================================
    // RESPONSABLE
    // ==============================================

    if (
        category ===
        "responsable"
    ) {
        const management =
            MANAGEMENT_ROLES[
                roleKey
            ];

        if (!management) {
            return null;
        }

        return {
            key:
                roleKey,

            category:
                "responsable",

            name:
                management
                    .responsable
                    .name,

            roleId:
                management
                    .responsable
                    .roleId
        };
    }

    return null;
}

// ======================================================
// ROBLOX
// ======================================================

// Prévu pour plus tard.
//
// Dans .env :
//
// ROBLOX_GROUP_ID=
// ROBLOX_OPEN_CLOUD_API_KEY=
// ROBLOX_COOKIE=
//
// Aucun secret Roblox ne doit être écrit ici.
//
// Les futurs ranks Roblox pourront être renseignés
// directement dans MAIN_RANKS :
//
// expert: {
//     name: "Héritier Expert",
//     roleId: "...",
//     robloxRank: 150
// }

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    MAIN_RANKS,
    MANAGEMENT_ROLES,
    RANK_CONFIG,
    RANK_ALLOWED_ROLES,

    getMainRankByKey,
    getMainRankByRoleId,
    getAllManagementRoles,
    getAllResponsibleRoles,
    getManagementByKey,
    getRoleConfigByCategory
};