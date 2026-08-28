const {
    Events
} = require("discord.js");

const {
    getRules,
    getRule
} = require("../utils/manageRoleStore");

// ======================================================
// ANTI DOUBLE REGISTER
// ======================================================

let registered =
    false;

// ======================================================
// PETITE PROTECTION CONTRE LES ACTIONS RÉPÉTÉES
// ======================================================

const recentActions =
    new Map();

const RECENT_ACTION_TTL =
    5000;

// ======================================================
// CONDITION
// ======================================================

function memberMatchesRule(
    member,
    rule
) {
    if (
        !member ||
        !rule ||
        !Array.isArray(
            rule.triggerRoleIds
        ) ||
        !rule.triggerRoleIds.length
    ) {
        return false;
    }

    if (
        rule.condition ===
        "all"
    ) {
        return rule.triggerRoleIds.every(
            roleId =>
                member.roles.cache.has(
                    roleId
                )
        );
    }

    return rule.triggerRoleIds.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

// ======================================================
// ACTION KEY
// ======================================================

function actionKey(
    guildId,
    memberId,
    roleId,
    action
) {
    return [
        guildId,
        memberId,
        roleId,
        action
    ].join(
        ":"
    );
}

function wasRecentlyExecuted(
    guildId,
    memberId,
    roleId,
    action
) {
    const key =
        actionKey(
            guildId,
            memberId,
            roleId,
            action
        );

    const last =
        recentActions.get(
            key
        );

    if (
        !last
    ) {
        return false;
    }

    if (
        Date.now() -
        last >
        RECENT_ACTION_TTL
    ) {
        recentActions.delete(
            key
        );

        return false;
    }

    return true;
}

function markExecuted(
    guildId,
    memberId,
    roleId,
    action
) {
    recentActions.set(
        actionKey(
            guildId,
            memberId,
            roleId,
            action
        ),
        Date.now()
    );
}

// ======================================================
// ROLE MANAGEABLE
// ======================================================

function canBotManageRole(
    guild,
    roleId
) {
    const role =
        guild.roles.cache.get(
            roleId
        );

    const botMember =
        guild.members.me;

    if (
        !role ||
        !botMember
    ) {
        return false;
    }

    if (
        role.id ===
        guild.id
    ) {
        return false;
    }

    if (
        role.managed
    ) {
        return false;
    }

    return (
        botMember.roles.highest.position >
        role.position
    );
}

// ======================================================
// ADD ROLES
// ======================================================

async function addRoles(
    member,
    roleIds,
    reason
) {
    for (
        const roleId
        of roleIds ||
        []
    ) {
        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            continue;
        }

        if (
            !canBotManageRole(
                member.guild,
                roleId
            )
        ) {
            console.log(
                `⚠️ ManageRole : rôle ${roleId} impossible à ajouter.`
            );

            continue;
        }

        if (
            wasRecentlyExecuted(
                member.guild.id,
                member.id,
                roleId,
                "add"
            )
        ) {
            continue;
        }

        markExecuted(
            member.guild.id,
            member.id,
            roleId,
            "add"
        );

        await member.roles
            .add(
                roleId,
                reason
            )
            .catch(
                error => {
                    console.error(
                        `❌ ManageRole ADD ${roleId} :`,
                        error
                    );
                }
            );
    }
}

// ======================================================
// REMOVE ROLES
// ======================================================

async function removeRoles(
    member,
    roleIds,
    reason
) {
    for (
        const roleId
        of roleIds ||
        []
    ) {
        if (
            !member.roles.cache.has(
                roleId
            )
        ) {
            continue;
        }

        if (
            !canBotManageRole(
                member.guild,
                roleId
            )
        ) {
            console.log(
                `⚠️ ManageRole : rôle ${roleId} impossible à retirer.`
            );

            continue;
        }

        if (
            wasRecentlyExecuted(
                member.guild.id,
                member.id,
                roleId,
                "remove"
            )
        ) {
            continue;
        }

        markExecuted(
            member.guild.id,
            member.id,
            roleId,
            "remove"
        );

        await member.roles
            .remove(
                roleId,
                reason
            )
            .catch(
                error => {
                    console.error(
                        `❌ ManageRole REMOVE ${roleId} :`,
                        error
                    );
                }
            );
    }
}

// ======================================================
// APPLY MATCH
// ======================================================

async function applyMatchActions(
    member,
    rule
) {
    await addRoles(
        member,
        rule.onMatchAddRoleIds,
        `ManageRole • règle ${rule.id} • condition remplie`
    );

    await removeRoles(
        member,
        rule.onMatchRemoveRoleIds,
        `ManageRole • règle ${rule.id} • condition remplie`
    );
}

// ======================================================
// APPLY UNMATCH
// ======================================================

async function applyUnmatchActions(
    member,
    rule
) {
    await addRoles(
        member,
        rule.onUnmatchAddRoleIds,
        `ManageRole • règle ${rule.id} • condition perdue`
    );

    await removeRoles(
        member,
        rule.onUnmatchRemoveRoleIds,
        `ManageRole • règle ${rule.id} • condition perdue`
    );
}

// ======================================================
// SYNC MEMBER WITH RULE
// ======================================================

async function syncMemberWithRule(
    member,
    rule
) {
    if (
        member.user.bot ||
        !rule.enabled
    ) {
        return;
    }

    if (
        memberMatchesRule(
            member,
            rule
        )
    ) {
        await applyMatchActions(
            member,
            rule
        );

    } else {
        await applyUnmatchActions(
            member,
            rule
        );
    }
}

// ======================================================
// SYNC RULE
// ======================================================

async function syncRule(
    guild,
    ruleId
) {
    const rule =
        getRule(
            ruleId
        );

    if (
        !rule ||
        !rule.enabled ||
        rule.guildId !==
            guild.id
    ) {
        return {
            success:
                false,

            count:
                0
        };
    }

    try {
        await guild.members.fetch();
    } catch {}

    let count =
        0;

    for (
        const member
        of guild.members.cache.values()
    ) {
        if (
            member.user.bot
        ) {
            continue;
        }

        await syncMemberWithRule(
            member,
            rule
        );

        count++;
    }

    return {
        success:
            true,

        count
    };
}

// ======================================================
// REGISTER
// ======================================================

function registerManageRoleSystem(
    client
) {
    if (
        registered
    ) {
        return;
    }

    registered =
        true;

    client.on(
        Events.GuildMemberUpdate,
        async (
            oldMember,
            newMember
        ) => {
            try {
                if (
                    newMember.user.bot
                ) {
                    return;
                }

                const rules =
                    getRules(
                        newMember.guild.id
                    )
                        .filter(
                            rule =>
                                rule.enabled
                        );

                for (
                    const rule
                    of rules
                ) {
                    if (
                        !Array.isArray(
                            rule.triggerRoleIds
                        ) ||
                        !rule.triggerRoleIds.length
                    ) {
                        continue;
                    }

                    const oldMatch =
                        memberMatchesRule(
                            oldMember,
                            rule
                        );

                    const newMatch =
                        memberMatchesRule(
                            newMember,
                            rule
                        );

                    // Rien n'a changé concernant la condition.
                    if (
                        oldMatch ===
                        newMatch
                    ) {
                        continue;
                    }

                    // FALSE -> TRUE
                    if (
                        !oldMatch &&
                        newMatch
                    ) {
                        await applyMatchActions(
                            newMember,
                            rule
                        );

                        console.log(
                            `🧩 ManageRole ${rule.id} : condition remplie pour ${newMember.user.tag}`
                        );

                        continue;
                    }

                    // TRUE -> FALSE
                    if (
                        oldMatch &&
                        !newMatch
                    ) {
                        await applyUnmatchActions(
                            newMember,
                            rule
                        );

                        console.log(
                            `🧩 ManageRole ${rule.id} : condition perdue pour ${newMember.user.tag}`
                        );
                    }
                }

            } catch (error) {
                console.error(
                    "❌ ManageRole GuildMemberUpdate :",
                    error
                );
            }
        }
    );

    client.manageRoleSystem = {
        syncRule,

        syncMemberWithRule,

        memberMatchesRule
    };

    console.log(
        "🧩 Gestion automatique des rôles : ✅ active"
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    registerManageRoleSystem,
    syncRule,
    syncMemberWithRule,
    memberMatchesRule
};