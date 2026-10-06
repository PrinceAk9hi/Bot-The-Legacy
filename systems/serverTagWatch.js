const { isProtectedUser } = require("../utils/security");
const isTagExempt = member => member?.id === "547192186547077130" || isProtectedUser(member?.id);

const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

// ======================================================
// La Soul Society — SURVEILLANCE DU TAG SERVEUR
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
    "1513698444588482650";

// Rôle donné automatiquement si le tag est présent
const TAG_ROLE_ID =
    "1549107713277956148";

// Rôle donné après 72h sans tag
const SANCTION_ROLE_ID =
    "1468698882002387044";

// Salon d'avertissement
const WARNING_CHANNEL_ID =
    "1471562633802023115";

// Salon des sanctions
const SANCTION_CHANNEL_ID =
    "1478798666470002929";

// Couleur principale
const COLOR =
    SOUL_COLORS.primary;

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

        return null;
    }
}

// ======================================================
// DÉTECTION DU TAG SERVEUR
// ======================================================

async function hasServerTag(
    member, suppliedUser
) {
    if (
        !member ||
        member.user?.bot
    ) {
        return false;
    }

    const user =
        suppliedUser || await fetchFreshUser(
            member
        );

    if (
        !user
    ) {
        return null;
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
    member,
    warning
) {
    if (isTagExempt(member) || require("../utils/lineState").isOff()) return false;
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
        Number(warning.startedAt) + FULL_TIME;

    const embed =
        new EmbedBuilder()
            .setColor(
                COLOR
            )
            .setTitle(
                "⚠️ Tag de famille manquant"
            )
            .setDescription(
`<@${member.id}>, ton **tag de famille de la Soul Society** n'est actuellement plus affiché sur ton profil Discord.

Remets ton tag pour éviter les sanctions automatiques.

> ⏳ **Rappel immédiat, puis à 12 heures**
> ⚠️ **Avertissement 1 à 24 h • Avertissement 2 à 48 h • Derank à 72 h**
> 📅 Fin du délai : <t:${Math.floor(deadline / 1000)}:R>

Le premier avertissement sera appliqué à la fin du délai indiqué. Le compteur repart de zéro si tu remets ton tag ; les sanctions déjà reçues restent enregistrées.

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
                    "La Soul Society • Tag de famille"
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
    if (isTagExempt(member) || require("../utils/lineState").isOff()) return false;
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
        Number(warning.startedAt) +
        FULL_TIME;

    const embed =
        new EmbedBuilder()
            .setColor(
                SOUL_COLORS.secondary
            )
            .setTitle(
                "⏳ Deuxième rappel : tag manquant"
            )
            .setDescription(
`<@${member.id}>, ton **tag de famille de la Soul Society** n'est toujours pas présent.

Remets ton tag avant la fin du délai ci-dessous.

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
                    "La Soul Society • Tag de famille"
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
    return; // Aucun message lors du rétablissement du tag.
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
                SOUL_COLORS.success
            )
            .setTitle(
                "✅ Tag de famille rétabli"
            )
            .setDescription(
`<@${member.id}> a remis son **tag de famille de la Soul Society** avant la fin du délai.

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
                    "La Soul Society • Tag de famille"
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

async function sanctionMember(guild, member, level = 1) {
    if (require('../utils/lineState').isOff() || isTagExempt(member)) return false;
    const roleId = level === 2 ? '1468698901077823653' : SANCTION_ROLE_ID;
    if (member.roles.cache.has(roleId)) return true;
    if (!await addRole(member, roleId, 'Tag absent depuis ' + (level === 2 ? 48 : 24) + ' heures')) return false;
    // Le rôle confirme la sanction, même si une notification échoue : aucun renvoi en boucle.
    for (const id of [SANCTION_CHANNEL_ID, '1540832394217529447']) {
        try {
            const channel = await getChannel(guild, id);
            await channel?.send({content: '## ⚠️ Sanction automatique\n> **Membre :** <@' + member.id + '>\n> **Rôle :** <@&' + roleId + '>\n> **Raison :** Tag de la Soul Society absent depuis ' + (level === 2 ? 48 : 24) + ' heures.\n> Sans rétablissement du tag : derank à 72 heures.', allowedMentions: { parse: [], users: [member.id] }});
        } catch { console.warn('Notification sanction tag impossible :', id); }
    }
    return true;
}

// ======================================================
// HANDLE MEMBER
// ======================================================

async function handleMember(guild, member, data) {
    if (require('../utils/lineState').isOff() || !member || member.user.bot) return;
    const key = getWarningKey(guild.id, member.id);
    if (isTagExempt(member)) { if (clearWarning(data, guild.id, member.id)) saveData(data); return; }
    const user = await fetchFreshUser(member);
    if (!user) return;
    if (await require('../utils/tagBanPolicy').inspect(guild, member, user)) return;
    const tagged = await hasServerTag(member, user);
    if (tagged === null) return; // Donnée inconnue : ne jamais la traiter comme un tag absent.
    if (tagged) {
        await addRole(member, TAG_ROLE_ID, 'Tag de la Soul Society détecté');
        if (clearWarning(data, guild.id, member.id)) saveData(data);
        return;
    }
    await removeRole(member, TAG_ROLE_ID, 'Tag de la Soul Society absent');
    if (!member.roles.cache.has(REQUIRED_ROLE_ID)) {
        if (clearWarning(data, guild.id, member.id)) saveData(data);
        return;
    }
    const now = Date.now();
    let warning = data.warnings[key];
    // Nouveau calendrier : pas de sanctions rétroactives issues des anciens compteurs.
    if (!warning || warning.policyVersion !== 3) {
        warning = data.warnings[key] = { policyVersion: 3, guildId: guild.id, userId: member.id,
            startedAt: now, firstWarningSent: false, halfReminderSent: false,
            sanctionApplied: false, secondSanctionApplied: false, derankRecorded: false };
        saveData(data);
    }
    const action = require('../utils/tagSchedule').nextAction(warning, now);
    if (!action) return;
    if (action === 'first') {
        warning.startedAt = now;
        if (await sendFirstWarning(guild, member, warning)) warning.firstWarningSent = true;
    } else if (action === 'half') {
        if (await sendHalfWarning(guild, member, warning)) warning.halfReminderSent = true;
    } else {
        const fresh = await guild.members.fetch({ user: member.id, force: true }).catch(() => null);
        if (!fresh || isTagExempt(fresh) || !fresh.roles.cache.has(REQUIRED_ROLE_ID)) return;
        const stillTagged = await hasServerTag(fresh);
        if (stillTagged !== false) return;
        if (action === 'derank') {
            const result = await require('../utils/automaticDerank').automaticDerank(fresh,
                'Tag de la Soul Society absent pendant 72 heures malgré les rappels.',
                'tag:' + key + ':' + warning.startedAt,
                async m => await hasServerTag(m) === false);
            if (result.status || result.recorded) warning.derankRecorded = true;
        } else {
            const level = action === 'warn2' ? 2 : 1;
            if (await sanctionMember(guild, fresh, level)) warning[level === 2 ? 'secondSanctionApplied' : 'sanctionApplied'] = true;
        }
    }
    saveData(data);
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
            await (async () => {
                const members = new Map();
                let after;
                do {
                    const page = await guild.members.list({ limit: 1000, ...(after ? { after } : {}) });
                    for (const member of page.values()) members.set(member.id, member);
                    if (page.size < 1000) break;
                    after = page.last().id;
                } while (true);
                return members;
            })();

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

    if (require("../utils/lineState").isOff()) return;
    running =
        true;

    const data =
        loadData();

    try {
        await require('../utils/tagBanPolicy').sweep(client);
        for (
            const guild
            of client.guilds.cache.values()
        ) {
            if (guild.id !== "1080943923691782154") continue;
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
    hasServerTag, handleMember
};