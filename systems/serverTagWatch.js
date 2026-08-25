const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const REQUIRED_ROLE_ID =
    "1458391977073574012";

const TAG_ROLE_ID =
    "1508174227566760076";

const SANCTION_ROLE_ID =
    "1533805396274315314";

const WARNING_CHANNEL_ID =
    "1533168252513943777";

const SANCTION_CHANNEL_ID =
    "1531375423424823407";

const COLOR =
    0x3B6475;

// 12 heures
const HALF_TIME =
    12 * 60 * 60 * 1000;

// 24 heures
const FULL_TIME =
    24 * 60 * 60 * 1000;

// On vérifie toutes les 2 minutes
const CHECK_INTERVAL =
    2 * 60 * 1000;

// ======================================================
// DATA
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const DATA_FILE =
    path.join(
        DATA_DIR,
        "serverTagWatch.json"
    );

// ======================================================
// RUNTIME
// ======================================================

let interval =
    null;

let running =
    false;

// ======================================================
// DATA HELPERS
// ======================================================

function defaultData() {
    return {
        version: 1,
        warnings: {}
    };
}

function ensureFile() {
    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (
        !fs.existsSync(
            DATA_FILE
        )
    ) {
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

        const parsed =
            raw.trim()
                ? JSON.parse(raw)
                : defaultData();

        if (
            !parsed.warnings ||
            typeof parsed.warnings !==
                "object"
        ) {
            parsed.warnings =
                {};
        }

        return parsed;

    } catch (error) {
        console.error(
            "❌ serverTagWatch.json :",
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
// USER FETCH
// ======================================================

async function refreshUser(
    client,
    userId
) {
    try {
        return await client.users.fetch(
            userId,
            {
                force: true
            }
        );

    } catch {
        return null;
    }
}

// ======================================================
// TAG CHECK
// ======================================================

async function hasServerTag(
    client,
    guildId,
    userId
) {
    const user =
        await refreshUser(
            client,
            userId
        );

    if (!user) {
        return false;
    }

    const primaryGuild =
        user.primaryGuild;

    if (!primaryGuild) {
        return false;
    }

    return (
        primaryGuild.identityEnabled ===
            true &&
        primaryGuild.identityGuildId ===
            guildId
    );
}

// ======================================================
// ROLE HELPERS
// ======================================================

async function addRole(
    member,
    roleId,
    reason
) {
    if (
        member.roles.cache.has(
            roleId
        )
    ) {
        return true;
    }

    try {
        await member.roles.add(
            roleId,
            reason
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Ajout rôle ${roleId} à ${member.user.tag} :`,
            error.message
        );

        return false;
    }
}

async function removeRole(
    member,
    roleId,
    reason
) {
    if (
        !member.roles.cache.has(
            roleId
        )
    ) {
        return true;
    }

    try {
        await member.roles.remove(
            roleId,
            reason
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Retrait rôle ${roleId} à ${member.user.tag} :`,
            error.message
        );

        return false;
    }
}

// ======================================================
// WARNING EMBED
// ======================================================

async function sendFirstWarning(
    guild,
    member
) {
    const channel =
        guild.channels.cache.get(
            WARNING_CHANNEL_ID
        ) ||
        await guild.channels
            .fetch(
                WARNING_CHANNEL_ID
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                COLOR
            )
            .setTitle(
                "⚠️ Tag de famille manquant"
            )
            .setDescription(
`<@${member.id}>, ton **tag de serveur / famille The Legacy** n'est plus présent sur ton profil.

Tu disposes de **24 heures** pour le remettre.

Si ton tag n'est toujours pas actif à la fin du délai, tu passeras automatiquement dans le rôle prévu pour cette situation.

> ⏳ **Temps restant : 24 heures**

Dès que ton tag est remis, l'avertissement sera automatiquement annulé.`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Surveillance du tag"
            })
            .setTimestamp();

    await channel.send({
        content:
            `<@${member.id}>`,

        embeds: [
            embed
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// 12H REMINDER
// ======================================================

async function sendHalfWarning(
    guild,
    member
) {
    const channel =
        guild.channels.cache.get(
            WARNING_CHANNEL_ID
        ) ||
        await guild.channels
            .fetch(
                WARNING_CHANNEL_ID
            )
            .catch(
                () => null
            );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                0xF1C40F
            )
            .setTitle(
                "⏳ Plus que 12 heures"
            )
            .setDescription(
`<@${member.id}>, ton tag de famille **The Legacy** n'est toujours pas présent.

Il te reste maintenant **12 heures** pour le remettre.

> ⚠️ Après ce délai, la sanction sera appliquée automatiquement.`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Surveillance du tag"
            })
            .setTimestamp();

    await channel.send({
        content:
            `<@${member.id}>`,

        embeds: [
            embed
        ]
    }).catch(
        () => {}
    );
}

// ======================================================
// SANCTION
// ======================================================

async function sanctionMember(
    guild,
    member
) {
    const channel =
        guild.channels.cache.get(
            SANCTION_CHANNEL_ID
        ) ||
        await guild.channels
            .fetch(
                SANCTION_CHANNEL_ID
            )
            .catch(
                () => null
            );

    await addRole(
        member,
        SANCTION_ROLE_ID,
        "Tag de famille absent après 24h"
    );

    if (
        !channel?.isTextBased()
    ) {
        return;
    }

    // PAS D'EMBED volontairement.
    // Format sanction simple.
    await channel.send({
        content:
`## ⚠️ SANCTION

> **Membre :** <@${member.id}>
> **ID :** \`${member.id}\`
> **Sanction :** Passage de rôle automatique
> **Raison :** Tag de famille absent après le délai de 24 heures
> **Rôle attribué :** <@&${SANCTION_ROLE_ID}>

*Sanction appliquée automatiquement par The Legacy.*`
    }).catch(
        () => {}
    );
}

// ======================================================
// CLEAR WARNING
// ======================================================

function clearWarning(
    data,
    guildId,
    userId
) {
    const key =
        `${guildId}:${userId}`;

    if (
        data.warnings[
            key
        ]
    ) {
        delete data.warnings[
            key
        ];

        return true;
    }

    return false;
}

// ======================================================
// HANDLE MEMBER
// ======================================================

async function handleMember(
    client,
    guild,
    member,
    data
) {
    if (
        !member ||
        member.user.bot
    ) {
        return;
    }

    const key =
        `${guild.id}:${member.id}`;

    const tagged =
        await hasServerTag(
            client,
            guild.id,
            member.id
        );

    // ==================================================
    // TAG PRÉSENT
    // ==================================================

    if (tagged) {
        await addRole(
            member,
            TAG_ROLE_ID,
            "Tag serveur The Legacy détecté"
        );

        const cleared =
            clearWarning(
                data,
                guild.id,
                member.id
            );

        if (cleared) {
            console.log(
                `✅ Tag remis par ${member.user.tag}, compteur annulé.`
            );
        }

        return;
    }

    // ==================================================
    // TAG ABSENT
    // ==================================================

    await removeRole(
        member,
        TAG_ROLE_ID,
        "Tag serveur The Legacy retiré"
    );

    // Seulement ceux qui ont le rôle surveillé.
    if (
        !member.roles.cache.has(
            REQUIRED_ROLE_ID
        )
    ) {
        clearWarning(
            data,
            guild.id,
            member.id
        );

        return;
    }

    const now =
        Date.now();

    let warning =
        data.warnings[
            key
        ];

    // ==================================================
    // PREMIER AVERTISSEMENT
    // ==================================================

    if (!warning) {
        warning = {
            guildId:
                guild.id,

            userId:
                member.id,

            startedAt:
                now,

            halfReminderSent:
                false,

            sanctionApplied:
                false
        };

        data.warnings[
            key
        ] =
            warning;

        await sendFirstWarning(
            guild,
            member
        );

        console.log(
            `⚠️ Compteur tag lancé pour ${member.user.tag}`
        );

        return;
    }

    const elapsed =
        now -
        warning.startedAt;

    // ==================================================
    // 12H
    // ==================================================

    if (
        elapsed >=
            HALF_TIME &&
        elapsed <
            FULL_TIME &&
        !warning.halfReminderSent
    ) {
        await sendHalfWarning(
            guild,
            member
        );

        warning.halfReminderSent =
            true;

        return;
    }

    // ==================================================
    // 24H
    // ==================================================

    if (
        elapsed >=
            FULL_TIME &&
        !warning.sanctionApplied
    ) {
        // Dernière vérification juste avant sanction.
        const stillMissing =
            !await hasServerTag(
                client,
                guild.id,
                member.id
            );

        if (!stillMissing) {
            await addRole(
                member,
                TAG_ROLE_ID,
                "Tag serveur remis avant sanction"
            );

            clearWarning(
                data,
                guild.id,
                member.id
            );

            return;
        }

        await sanctionMember(
            guild,
            member
        );

        warning.sanctionApplied =
            true;

        warning.sanctionAppliedAt =
            Date.now();

        console.log(
            `🚨 Sanction tag appliquée à ${member.user.tag}`
        );
    }
}

// ======================================================
// SCAN
// ======================================================

async function scanGuild(
    client,
    guild,
    data
) {
    let members;

    try {
        members =
            await guild.members.fetch();

    } catch (error) {
        console.error(
            `❌ Impossible de récupérer les membres de ${guild.name} :`,
            error.message
        );

        return;
    }

    for (
        const member
        of members.values()
    ) {
        try {
            await handleMember(
                client,
                guild,
                member,
                data
            );

        } catch (error) {
            console.error(
                `❌ ServerTagWatch ${member.user.tag} :`,
                error
            );
        }
    }
}

// ======================================================
// GLOBAL CHECK
// ======================================================

async function checkAll(
    client
) {
    if (running) {
        return;
    }

    running =
        true;

    const data =
        loadData();

    try {
        for (
            const guild
            of client.guilds.cache.values()
        ) {
            await scanGuild(
                client,
                guild,
                data
            );
        }

        saveData(
            data
        );

    } finally {
        running =
            false;
    }
}

// ======================================================
// START
// ======================================================

function startServerTagWatch(
    client
) {
    if (interval) {
        clearInterval(
            interval
        );
    }

    console.log(
        "🏷️ Système de surveillance du tag serveur activé."
    );

    // Scan quelques secondes après le démarrage.
    setTimeout(
        () => {
            checkAll(
                client
            ).catch(
                error => {
                    console.error(
                        "❌ Premier scan ServerTagWatch :",
                        error
                    );
                }
            );
        },
        10_000
    );

    interval =
        setInterval(
            () => {
                checkAll(
                    client
                ).catch(
                    error => {
                        console.error(
                            "❌ Scan ServerTagWatch :",
                            error
                        );
                    }
                );
            },
            CHECK_INTERVAL
        );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    startServerTagWatch,
    checkAll,
    hasServerTag
};