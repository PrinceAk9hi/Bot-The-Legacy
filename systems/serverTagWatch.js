// ======================================================
// THE LEGACY — SURVEILLANCE DU TAG SERVEUR
// ======================================================

const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

// Membres concernés par l'obligation du tag
const REQUIRED_ROLE_ID =
    "1458391977073574012";

// Rôle donné automatiquement si le tag est présent
const TAG_ROLE_ID =
    "1508174227566760076";

// Rôle donné après 24h sans tag
const SANCTION_ROLE_ID =
    "1533805396274315314";

// Salon d'avertissement
const WARNING_CHANNEL_ID =
    "1533168252513943777";

// Salon des sanctions
const SANCTION_CHANNEL_ID =
    "1531375423424823407";

// Couleur principale
const COLOR =
    0x3B6475;

// ======================================================
// TEMPS
// ======================================================

// Rappel au bout de 12h
const HALF_TIME =
    12 * 60 * 60 * 1000;

// Sanction au bout de 24h
const FULL_TIME =
    24 * 60 * 60 * 1000;

// Vérification toutes les 60 secondes
const CHECK_INTERVAL =
    60 * 1000;

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
// DATA PAR DÉFAUT
// ======================================================

function defaultData() {
    return {
        version: 2,

        warnings: {}
    };
}

// ======================================================
// CRÉATION FICHIER
// ======================================================

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

// ======================================================
// CHARGEMENT DATA
// ======================================================

function loadData() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        if (
            !raw.trim()
        ) {
            return defaultData();
        }

        const parsed =
            JSON.parse(
                raw
            );

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
            "❌ Lecture serverTagWatch.json :",
            error
        );

        return defaultData();
    }
}

// ======================================================
// SAUVEGARDE DATA
// ======================================================

function saveData(
    data
) {
    ensureFile();

    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                data,
                null,
                2
            ),
            "utf8"
        );

    } catch (error) {
        console.error(
            "❌ Sauvegarde serverTagWatch.json :",
            error
        );
    }
}

// ======================================================
// RÉCUPÉRATION USER À JOUR
// ======================================================

async function fetchFreshUser(
    member
) {
    try {
        return await member.user.fetch({
            force: true
        });

    } catch (error) {
        console.error(
            `❌ Refresh user ${member.id} :`,
            error.message
        );

        return member.user ||
            null;
    }
}

// ======================================================
// DÉTECTION DU TAG SERVEUR
// ======================================================

async function hasServerTag(
    member
) {
    if (
        !member ||
        member.user?.bot
    ) {
        return false;
    }

    const user =
        await fetchFreshUser(
            member
        );

    if (
        !user
    ) {
        return false;
    }

    const primaryGuild =
        user.primaryGuild;

    console.log(
        `🏷️ TAG CHECK ${user.tag} (${user.id}) :`,
        primaryGuild
            ? {
                identityGuildId:
                    primaryGuild.identityGuildId,

                identityEnabled:
                    primaryGuild.identityEnabled,

                tag:
                    primaryGuild.tag
            }
            : "aucun primaryGuild"
    );

    if (
        !primaryGuild
    ) {
        return false;
    }

    return (
        primaryGuild.identityEnabled ===
            true &&
        String(
            primaryGuild.identityGuildId
        ) ===
            String(
                member.guild.id
            )
    );
}

// ======================================================
// FETCH CHANNEL
// ======================================================

async function getChannel(
    guild,
    channelId
) {
    return (
        guild.channels.cache.get(
            channelId
        ) ||
        await guild.channels
            .fetch(
                channelId
            )
            .catch(
                () => null
            )
    );
}

// ======================================================
// ADD ROLE
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

    const role =
        member.guild.roles.cache.get(
            roleId
        ) ||
        await member.guild.roles
            .fetch(
                roleId
            )
            .catch(
                () => null
            );

    if (
        !role
    ) {
        console.error(
            `❌ Rôle introuvable : ${roleId}`
        );

        return false;
    }

    if (
        !role.editable
    ) {
        console.error(
            `❌ Rôle non modifiable par le bot : ${roleId}`
        );

        return false;
    }

    try {
        await member.roles.add(
            roleId,
            reason
        );

        console.log(
            `✅ Rôle ${roleId} ajouté à ${member.user.tag}`
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Ajout rôle ${roleId} à ${member.user.tag} :`,
            error
        );

        return false;
    }
}

// ======================================================
// REMOVE ROLE
// ======================================================

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

    const role =
        member.guild.roles.cache.get(
            roleId
        ) ||
        await member.guild.roles
            .fetch(
                roleId
            )
            .catch(
                () => null
            );

    if (
        !role
    ) {
        return false;
    }

    if (
        !role.editable
    ) {
        console.error(
            `❌ Rôle non modifiable par le bot : ${roleId}`
        );

        return false;
    }

    try {
        await member.roles.remove(
            roleId,
            reason
        );

        console.log(
            `🗑️ Rôle ${roleId} retiré à ${member.user.tag}`
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Retrait rôle ${roleId} à ${member.user.tag} :`,
            error
        );

        return false;
    }
}

// ======================================================
// CLÉ WARNING
// ======================================================

function getWarningKey(
    guildId,
    userId
) {
    return `${guildId}:${userId}`;
}

// ======================================================
// SUPPRESSION WARNING
// ======================================================

function clearWarning(
    data,
    guildId,
    userId
) {
    const key =
        getWarningKey(
            guildId,
            userId
        );

    if (
        !data.warnings[
            key
        ]
    ) {
        return false;
    }

    delete data.warnings[
        key
    ];

    return true;
}

// ======================================================
// PREMIER AVERTISSEMENT
// ======================================================

async function sendFirstWarning(
    guild,
    member
) {
    const channel =
        await getChannel(
            guild,
            WARNING_CHANNEL_ID
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        console.error(
            `❌ Salon avertissement tag introuvable : ${WARNING_CHANNEL_ID}`
        );

        return false;
    }

    const deadline =
        Date.now() +
        FULL_TIME;

    const embed =
        new EmbedBuilder()
            .setColor(
                COLOR
            )
            .setTitle(
                "⚠️ Tag de famille manquant"
            )
            .setDescription(
`<@${member.id}>, ton **tag de famille The Legacy** n'est actuellement plus affiché sur ton profil Discord.

Tu disposes de **24 heures** pour le remettre.

> ⏳ **Temps restant : 24 heures**
> 📅 Fin du délai : <t:${Math.floor(deadline / 1000)}:R>

Si ton tag n'est toujours pas présent à la fin du délai, tu passeras automatiquement dans le rôle prévu pour cette situation.

Dès que ton tag est remis, le compteur est automatiquement annulé.`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Tag de famille"
            })
            .setTimestamp();

    try {
        await channel.send({
            content:
                `<@${member.id}>`,

            embeds: [
                embed
            ],

            allowedMentions: {
                users: [
                    member.id
                ]
            }
        });

        console.log(
            `⚠️ Avertissement tag envoyé à ${member.user.tag}`
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Envoi avertissement tag ${member.user.tag} :`,
            error
        );

        return false;
    }
}

// ======================================================
// RAPPEL 12H
// ======================================================

async function sendHalfWarning(
    guild,
    member,
    warning
) {
    const channel =
        await getChannel(
            guild,
            WARNING_CHANNEL_ID
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return false;
    }

    const deadline =
        warning.startedAt +
        FULL_TIME;

    const embed =
        new EmbedBuilder()
            .setColor(
                0xF1C40F
            )
            .setTitle(
                "⏳ Il te reste 12 heures"
            )
            .setDescription(
`<@${member.id}>, ton **tag de famille The Legacy** n'est toujours pas présent.

Il te reste désormais **12 heures** pour le remettre.

> ⚠️ Si ton tag n'est toujours pas présent à la fin du délai, la sanction sera appliquée automatiquement.
> 📅 Fin du délai : <t:${Math.floor(deadline / 1000)}:R>`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Tag de famille"
            })
            .setTimestamp();

    try {
        await channel.send({
            content:
                `<@${member.id}>`,

            embeds: [
                embed
            ],

            allowedMentions: {
                users: [
                    member.id
                ]
            }
        });

        console.log(
            `⏳ Rappel 12h envoyé à ${member.user.tag}`
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Rappel tag ${member.user.tag} :`,
            error
        );

        return false;
    }
}

// ======================================================
// TAG REMIS AVANT SANCTION
// ======================================================

async function sendTagRestoredMessage(
    guild,
    member
) {
    const channel =
        await getChannel(
            guild,
            WARNING_CHANNEL_ID
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return false;
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                0x57F287
            )
            .setTitle(
                "✅ Tag de famille rétabli"
            )
            .setDescription(
`<@${member.id}> a remis son **tag de famille The Legacy** avant la fin du délai.

> ✅ L'avertissement est annulé.
> ⏳ Le compteur de 24 heures est supprimé.
> 🪽 Aucune sanction ne sera appliquée.`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size:
                        512
                })
            )
            .setFooter({
                text:
                    "The Legacy • Tag de famille"
            })
            .setTimestamp();

    try {
        await channel.send({
            content:
                `<@${member.id}>`,

            embeds: [
                embed
            ],

            allowedMentions: {
                users: [
                    member.id
                ]
            }
        });

        console.log(
            `✅ Message tag rétabli envoyé pour ${member.user.tag}`
        );

        return true;

    } catch (error) {
        console.error(
            `❌ Message tag rétabli ${member.user.tag} :`,
            error
        );

        return false;
    }
}

// ======================================================
// SANCTION
// ======================================================

async function sanctionMember(
    guild,
    member
) {
    const roleAdded =
        await addRole(
            member,
            SANCTION_ROLE_ID,
            "Tag de famille absent après 24 heures"
        );

    if (
        !roleAdded
    ) {
        console.error(
            `❌ Impossible d'appliquer le rôle sanction à ${member.user.tag}`
        );
    }

    const channel =
        await getChannel(
            guild,
            SANCTION_CHANNEL_ID
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        console.error(
            `❌ Salon sanctions introuvable : ${SANCTION_CHANNEL_ID}`
        );

        return;
    }

    await channel.send({
        content:
`## ⚠️ Sanction

> **Membre :** <@${member.id}>
> **ID :** \`${member.id}\`
> **Sanction :** Passage automatique
> **Raison :** Tag de famille absent après le délai de 24 heures.
> **Rôle attribué :** <@&${SANCTION_ROLE_ID}>

-# Sanction appliquée automatiquement par The Legacy.`,

        allowedMentions: {
            users: [
                member.id
            ],

            roles:
                []
        }
    }).catch(
        error => {
            console.error(
                `❌ Message sanction tag ${member.user.tag} :`,
                error
            );
        }
    );
}

// ======================================================
// HANDLE MEMBER
// ======================================================

async function handleMember(
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
        getWarningKey(
            guild.id,
            member.id
        );

    const tagged =
        await hasServerTag(
            member
        );

    // ==================================================
    // TAG PRÉSENT
    // ==================================================

    if (
        tagged
    ) {
        await addRole(
            member,
            TAG_ROLE_ID,
            "Tag serveur The Legacy détecté"
        );

        const hadWarning =
            Boolean(
                data.warnings[
                    key
                ]
            );

        if (
            clearWarning(
                data,
                guild.id,
                member.id
            )
        ) {
            saveData(
                data
            );

            console.log(
                `✅ ${member.user.tag} a remis son tag : compteur annulé.`
            );
        }

        // Le message vert ne part QUE si la personne
        // avait réellement un compteur / avertissement actif.
        if (
            hadWarning
        ) {
            await sendTagRestoredMessage(
                guild,
                member
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
        "Tag serveur The Legacy absent"
    );

    // ==================================================
    // PAS DANS LE RÔLE SURVEILLÉ
    // ==================================================

    if (
        !member.roles.cache.has(
            REQUIRED_ROLE_ID
        )
    ) {
        if (
            clearWarning(
                data,
                guild.id,
                member.id
            )
        ) {
            saveData(
                data
            );
        }

        return;
    }

    const now =
        Date.now();

    let warning =
        data.warnings[
            key
        ];

    // ==================================================
    // PREMIÈRE DÉTECTION
    // ==================================================

    if (
        !warning
    ) {
        const sent =
            await sendFirstWarning(
                guild,
                member
            );

        warning = {
            guildId:
                guild.id,

            userId:
                member.id,

            username:
                member.user.tag,

            startedAt:
                now,

            firstWarningSent:
                sent,

            halfReminderSent:
                false,

            sanctionApplied:
                false,

            createdAt:
                now
        };

        data.warnings[
            key
        ] =
            warning;

        saveData(
            data
        );

        console.log(
            `⏳ Compteur 24h lancé pour ${member.user.tag}`
        );

        return;
    }

    // ==================================================
    // PREMIER MESSAGE ÉCHOUÉ
    // ==================================================

    if (
        warning.firstWarningSent ===
            false
    ) {
        const sent =
            await sendFirstWarning(
                guild,
                member
            );

        if (
            sent
        ) {
            warning.firstWarningSent =
                true;

            saveData(
                data
            );
        }
    }

    const elapsed =
        now -
        Number(
            warning.startedAt
        );

    // ==================================================
    // RAPPEL 12H
    // ==================================================

    if (
        elapsed >=
            HALF_TIME &&
        elapsed <
            FULL_TIME &&
        !warning.halfReminderSent
    ) {
        const sent =
            await sendHalfWarning(
                guild,
                member,
                warning
            );

        if (
            sent
        ) {
            warning.halfReminderSent =
                true;

            warning.halfReminderSentAt =
                Date.now();

            saveData(
                data
            );
        }

        return;
    }

    // ==================================================
    // SANCTION 24H
    // ==================================================

    if (
        elapsed >=
            FULL_TIME &&
        !warning.sanctionApplied
    ) {
        // Vérification finale juste avant sanction
        const stillMissing =
            !await hasServerTag(
                member
            );

        if (
            !stillMissing
        ) {
            await addRole(
                member,
                TAG_ROLE_ID,
                "Tag remis avant la sanction"
            );

            clearWarning(
                data,
                guild.id,
                member.id
            );

            saveData(
                data
            );

            await sendTagRestoredMessage(
                guild,
                member
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

        saveData(
            data
        );

        console.log(
            `🚨 Sanction tag appliquée à ${member.user.tag}`
        );
    }
}

// ======================================================
// SCAN GUILD
// ======================================================

async function scanGuild(
    guild,
    data
) {
    let members;

    try {
        members =
            await guild.members.fetch();

    } catch (error) {
        console.error(
            `❌ Récupération membres ${guild.name} :`,
            error
        );

        return;
    }

    console.log(
        `🏷️ Scan tags ${guild.name} : ${members.size} membre(s)`
    );

    for (
        const member
        of members.values()
    ) {
        try {
            await handleMember(
                guild,
                member,
                data
            );

        } catch (error) {
            console.error(
                `❌ TagWatch ${member.user.tag} :`,
                error
            );
        }
    }
}

// ======================================================
// CHECK ALL
// ======================================================

async function checkAll(
    client
) {
    if (
        running
    ) {
        console.log(
            "🏷️ Scan tag ignoré : scan précédent encore actif."
        );

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
                guild,
                data
            );
        }

        saveData(
            data
        );

    } catch (error) {
        console.error(
            "❌ CheckAll ServerTagWatch :",
            error
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
    if (
        interval
    ) {
        clearInterval(
            interval
        );

        interval =
            null;
    }

    console.log(
        "🏷️ Surveillance du tag serveur activée."
    );

    // Premier scan 5 secondes après le démarrage
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
        5_000
    );

    // Puis scan toutes les 60 secondes
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

    return true;
}

// ======================================================
// STOP
// ======================================================

function stopServerTagWatch() {
    if (
        interval
    ) {
        clearInterval(
            interval
        );

        interval =
            null;
    }

    console.log(
        "🏷️ Surveillance du tag serveur arrêtée."
    );
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    startServerTagWatch,
    stopServerTagWatch,

    checkAll,
    hasServerTag
};