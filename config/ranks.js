const { COLORS: SOUL_COLORS, CHANNELS } = require("./soulSociety");

// ======================================================
// GRADES PRINCIPAUX
// ======================================================

const MAIN_RANKS = {
    novice: {
        name: "Membre Test",
        roleId: "1468701337243090954",
        robloxRank: null,
        promotionMinimumDays: 14,
        promotionIdealDays: 14
    },

    confirme: {
        name: "Membre Aspirant",
        roleId: "1468701415475118282",
        robloxRank: null,
        promotionMinimumDays: 75,
        promotionIdealDays: 75
    },

    expert: {
        name: "Membre avancé",
        roleId: "1495439502637006949",
        robloxRank: null,
        promotionMinimumDays: 105,
        promotionIdealDays: 150
    },

    senior: {
        name: "Membre Sénior",
        roleId: "1495439710619963512",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    veteran: {
        name: "Membre Vétéran",
        roleId: "1495439941621121280",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    distingue: {
        name: "Membre distingué",
        roleId: "1540851347459412108",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    elite: {
        name: "Membre d'Elite",
        roleId: "1540851378447196231",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    prestigieux: {
        name: "Membre Prestigieux",
        roleId: "1540851419618218064",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    ambassadeur: {
        name: "Membre ambassadeur",
        roleId: "1540851401968721980",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    legendaire: {
        name: "Membre Légendaire",
        roleId: "1540851580243546263",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    },

    referent: {
        name: "Membre référent",
        roleId: "1497669939882885182",
        robloxRank: null,
        promotionMinimumDays: null,
        promotionIdealDays: null
    }
};

// ======================================================
// GESTIONS / RESPONSABLES
// ======================================================

const MANAGEMENT_ROLES = {
    "recrutement": {
        "gestion": {
            "name": "Gestion Recrutement",
            "roleId": "1473356789453029376"
        }
    },
    "animations": {
        "gestion": {
            "name": "Gestion Animation",
            "roleId": "1477056805103206450"
        }
    },
    "rp": {
        "gestion": {
            "name": "Gestion Roleplay",
            "roleId": "1505974229118750851"
        }
    },
    "tickets": {
        "gestion": {
            "name": "Gestion Ticket",
            "roleId": "1471557970079912047"
        }
    }
};

// ======================================================
// CONFIGURATION GÉNÉRALE /RANK
// ======================================================

const RANK_CONFIG = {
    // Salon des logs /rank
    logChannelId: CHANNELS.rankLogs,

    // Salon public pour rankups / nouvelles responsabilités
    publicChannelId: CHANNELS.rankups,

    // Les retraits ne sont pas annoncés publiquement
    publishRemovals: false,

    // Responsable => ajoute aussi la Gestion correspondante
    responsibleIncludesManagement: false,

    // Si on retire Responsable, on conserve la Gestion
    removeManagementWithResponsible: false,

    // Couleurs embeds
    embedColor: SOUL_COLORS.primary,
    rankupColor: SOUL_COLORS.success,
    managementColor: SOUL_COLORS.primary,
    responsibleColor: SOUL_COLORS.secondary,
    removalColor: SOUL_COLORS.sanction
};

// ======================================================
// RÔLES AUTORISÉS À UTILISER /RANK
// ======================================================

const RANK_ALLOWED_ROLES = [
    "1473356789453029376",
    "1469803353964810250",
    "1522357970778718249",
    "1471546243653304392",
    "1504782476319526932",
    "1527996778727870496"
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

// Compatibilité des anciens imports ; aucun niveau responsable actif.
function getAllResponsibleRoles() {
    return [];
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

    if (category === "responsable") {
        return null; // Niveau retiré ; historiques conservés.
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
//     name: "Membre avancé",
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