const fs = require("fs");
const path = require("path");

const {
    Events,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG GÉNÉRALE
// ======================================================

const FOUNDATION_ROLE_ID =
    "1467924663337222196";

const MANAGER_PING_ROLE_ID =
    "1540417548204638279";

const MANAGER_REQUEST_CHANNEL_ID =
    "1540155393693450291";

const MANAGER_REQUEST_COOLDOWN =
    15 * 60 * 1000;

// ======================================================
// EMOJIS
// ======================================================

const EMOJIS = {
    settings:
        "<a:settings:1540428302848888862>",

    owner:
        "<:Propritaire:1540428007032758342>",

    unlock:
        "<:unlock:1540428055569371156>",

    manager:
        "<a:dmd_gerant:1540428204098195616>",

    clock:
        "<:clock:1540428249081847998>",

    lock:
        "<:Lock:1540427843786244187>",

    activity:
        "<a:Activity:1540427928200937482>",

    people:
        "<:People:1540427883770552381>",

    arrow:
        "<:fleche2:1538543191534338089>"
};

// ======================================================
// GRADES LEGACY
// ======================================================

const GRADES = [
    {
        roleId:
            "1531760661271543969",

        name:
            "Héritier Sénior"
    },

    {
        roleId:
            "1531760794822508800",

        name:
            "Héritier Expert"
    },

    {
        roleId:
            "1531761056744083648",

        name:
            "Héritier Confirmé"
    },

    {
        roleId:
            "1531761113933414542",

        name:
            "Novice (Test)"
    }
];

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const CONFIG_FILE =
    path.join(
        DATA_DIR,
        "tempVoiceConfig.json"
    );

const ROOMS_FILE =
    path.join(
        DATA_DIR,
        "tempVoiceRooms.json"
    );

// ======================================================
// MÉMOIRE
// ======================================================

const configMap =
    new Map();

const rooms =
    new Map();

const creationLocks =
    new Set();

// Empêche le double panel
const panelUpdateQueues =
    new Map();

// ======================================================
// FICHIERS
// ======================================================

function ensureFiles() {
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
            CONFIG_FILE
        )
    ) {
        fs.writeFileSync(
            CONFIG_FILE,
            "{}",
            "utf8"
        );
    }

    if (
        !fs.existsSync(
            ROOMS_FILE
        )
    ) {
        fs.writeFileSync(
            ROOMS_FILE,
            "{}",
            "utf8"
        );
    }
}

function readJSON(file) {
    ensureFiles();

    try {
        const raw =
            fs.readFileSync(
                file,
                "utf8"
            );

        return raw.trim()
            ? JSON.parse(raw)
            : {};

    } catch (error) {
        console.error(
            `❌ Lecture ${path.basename(file)} :`,
            error
        );

        return {};
    }
}

function writeJSON(
    file,
    data
) {
    ensureFiles();

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );
}

// ======================================================
// CONFIG
// ======================================================

function loadConfigs() {
    configMap.clear();

    const data =
        readJSON(
            CONFIG_FILE
        );

    for (
        const [
            guildId,
            config
        ]
        of Object.entries(
            data
        )
    ) {
        configMap.set(
            guildId,
            config
        );
    }
}

async function saveConfig(
    guildId,
    config
) {
    configMap.set(
        guildId,
        config
    );

    writeJSON(
        CONFIG_FILE,
        Object.fromEntries(
            configMap.entries()
        )
    );
}

// ======================================================
// ROOMS
// ======================================================

function loadRooms() {
    rooms.clear();

    const data =
        readJSON(
            ROOMS_FILE
        );

    for (
        const [
            channelId,
            room
        ]
        of Object.entries(
            data
        )
    ) {
        rooms.set(
            channelId,
            room
        );
    }
}

function saveRooms() {
    writeJSON(
        ROOMS_FILE,
        Object.fromEntries(
            rooms.entries()
        )
    );
}

// ======================================================
// TEMPS
// ======================================================

function formatDuration(
    milliseconds
) {
    milliseconds =
        Math.max(
            0,
            milliseconds
        );

    const seconds =
        Math.floor(
            milliseconds /
            1000
        );

    if (
        seconds <
        60
    ) {
        return `${seconds}s`;
    }

    const totalMinutes =
        Math.floor(
            seconds /
            60
        );

    if (
        totalMinutes <
        60
    ) {
        return `${totalMinutes} min`;
    }

    const hours =
        Math.floor(
            totalMinutes /
            60
        );

    const minutes =
        totalMinutes %
        60;

    if (
        minutes ===
        0
    ) {
        return `${hours}h`;
    }

    return (
        `${hours}h${String(minutes)
            .padStart(
                2,
                "0"
            )}`
    );
}

// ======================================================
// NOM DU VOCAL
// ======================================================

function createRoomName(
    initialName,
    member
) {
    const displayName =
        member.displayName ||
        member.user.username;

    const username =
        member.user.username;

    let name =
        String(
            initialName ||
            "Bureau"
        );

    // ==================================================
    // PLACEHOLDERS
    // ==================================================

    if (
        name.includes(
            "{user}"
        ) ||
        name.includes(
            "{username}"
        )
    ) {
        name =
            name
                .replaceAll(
                    "{user}",
                    displayName
                )
                .replaceAll(
                    "{username}",
                    username
                );
    }

    // ==================================================
    // AUCUN PLACEHOLDER
    // ==================================================

    else {
        name =
            `${name}・${displayName}`;
    }

    return name
        .trim()
        .slice(
            0,
            100
        );
}

// ======================================================
// GRADE
// ======================================================

function getLegacyGrade(
    member
) {
    for (
        const grade
        of GRADES
    ) {
        if (
            member.roles.cache.has(
                grade.roleId
            )
        ) {
            return grade.name;
        }
    }

    return "Aucun grade Legacy";
}

// ======================================================
// ACTIVITÉ
// ======================================================

function getActivity(
    member
) {
    const activities =
        member.presence
            ?.activities ||
        [];

    if (
        activities.length ===
        0
    ) {
        return "Aucune activité";
    }

    const spotify =
        activities.find(
            activity =>
                activity.name ===
                "Spotify"
        );

    if (
        spotify
    ) {
        if (
            spotify.details
        ) {
            return (
                `Spotify • ${spotify.details}`
            );
        }

        return "Spotify";
    }

    const activity =
        activities.find(
            activity =>
                activity.name !==
                "Custom Status"
        ) ||
        activities[0];

    if (
        !activity
    ) {
        return "Aucune activité";
    }

    if (
        activity.name ===
        "Custom Status"
    ) {
        return activity.state
            ? activity.state
            : "Statut personnalisé";
    }

    return activity.name;
}

// ======================================================
// MEMBRES
// ======================================================

function getHumanMembers(
    channel
) {
    if (
        !channel?.members
    ) {
        return [];
    }

    return [
        ...channel.members.values()
    ].filter(
        member =>
            !member.user.bot
    );
}

// ======================================================
// HISTORIQUE
// ======================================================

function addHistory(
    room,
    text
) {
    if (
        !Array.isArray(
            room.history
        )
    ) {
        room.history =
            [];
    }

    room.history.push({
        at:
            Date.now(),

        text
    });

    if (
        room.history.length >
        100
    ) {
        room.history =
            room.history.slice(
                -100
            );
    }
}

// ======================================================
// ARRIVÉES
// ======================================================

function registerJoin(
    room,
    memberId
) {
    if (
        !room.joinTimes
    ) {
        room.joinTimes =
            {};
    }

    if (
        !Array.isArray(
            room.joinOrder
        )
    ) {
        room.joinOrder =
            [];
    }

    room.joinTimes[
        memberId
    ] =
        Date.now();

    if (
        !room.joinOrder.includes(
            memberId
        )
    ) {
        room.joinOrder.push(
            memberId
        );
    }
}

// ======================================================
// COOLDOWN GÉRANT
// ======================================================

function getManagerCooldown(
    room
) {
    if (
        !room.lastManagerRequestAt
    ) {
        return 0;
    }

    const elapsed =
        Date.now() -
        room.lastManagerRequestAt;

    return Math.max(
        0,
        MANAGER_REQUEST_COOLDOWN -
        elapsed
    );
}

// ======================================================
// SECTION DEMANDE GÉRANT
// ======================================================

function buildRequestText(
    room
) {
    const request =
        room.request;

    if (
        request &&
        !request.closed
    ) {
        const unavailable =
            request.unavailableIds ||
            [];

        return [
            `${EMOJIS.manager} **Appel d'un gérant**`,
            "",
            `${EMOJIS.arrow} **État :** 🕒 En attente`,
            `${EMOJIS.arrow} **Urgent :** ${request.urgent ? "🔴 Oui" : "🟢 Non"}`,
            `${EMOJIS.arrow} **Raison :** ${request.reason}`,
            "",
            `${EMOJIS.arrow} **Indisponibles : ${unavailable.length}/${request.foundationTotal || 4}**`,
            unavailable.length
                ? unavailable
                    .map(
                        id =>
                            `<@${id}>`
                    )
                    .join(", ")
                : "Aucun membre indisponible."
        ].join(
            "\n"
        );
    }

    if (
        room.lastRequestResult
    ) {
        return [
            `${EMOJIS.manager} **Appel d'un gérant**`,
            "",
            room.lastRequestResult
        ].join(
            "\n"
        );
    }

    return [
        `${EMOJIS.manager} **Appel d'un gérant**`,
        "",
        `${EMOJIS.arrow} Aucune demande en cours.`
    ].join(
        "\n"
    );
}

// ======================================================
// EMBED PANEL
// ======================================================

function buildPanelEmbed(
    channel,
    room
) {
    const humans =
        getHumanMembers(
            channel
        );

    const membersText =
        humans.length
            ? humans
                .map(
                    member => {
                        const joinedAt =
                            room.joinTimes?.[
                                member.id
                            ] ||
                            Date.now();

                        const owner =
                            member.id ===
                            room.ownerId;

                        return [
                            `${owner ? `${EMOJIS.owner} ` : ""}**<@${member.id}>**`,
                            `${EMOJIS.arrow} ${getLegacyGrade(member)}`,
                            `${EMOJIS.arrow} ${EMOJIS.clock} ${formatDuration(Date.now() - joinedAt)}`,
                            `${EMOJIS.arrow} ${EMOJIS.activity} ${getActivity(member)}`
                        ].join(
                            "\n"
                        );
                    }
                )
                .join(
                    "\n\n"
                )
            : "*Aucun joueur présent.*";

    const noteSection =
        room.note
            ? [
                "",
                `${EMOJIS.settings} **Note du bureau**`,
                room.note
            ].join(
                "\n"
            )
            : "";

    const description = [
        `## ${EMOJIS.settings} Panel de gestion - Vocal de ${channel.name}`,
        "",
        `${EMOJIS.owner} **Propriétaire**`,
        `<@${room.ownerId}>`,
        "",
        `${EMOJIS.settings} **Nom du vocal**`,
        `\`${channel.name}\``,
        "",
        `${room.closed ? EMOJIS.lock : EMOJIS.unlock} **Ouvert aux joueurs**`,
        room.closed
            ? "🔴 Non"
            : "🟢 Oui",
        "",
        `${EMOJIS.clock} **Ouvert depuis**`,
        formatDuration(
            Date.now() -
            room.createdAt
        ),
        "",
        `${EMOJIS.people} **Présents • ${humans.length}**`,
        "",
        membersText,
        noteSection,
        "",
        "────────────────────",
        "",
        buildRequestText(
            room
        )
    ]
        .filter(
            value =>
                value !==
                null
        )
        .join(
            "\n"
        );

    return new EmbedBuilder()
        .setColor(
            0x5F6368
        )
        .setDescription(
            description
        )
        .setFooter({
            text:
                "The Legacy • Bureau vocal temporaire"
        });
}

// ======================================================
// COMPOSANTS PANEL
// ======================================================

function createPanelComponents(
    room
) {
    // ==================================================
    // LIGNE 1
    // ==================================================

    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `tpv_rename_${room.channelId}`
                    )
                    .setLabel(
                        "Renommer"
                    )
                    .setEmoji(
                        "✏️"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tpv_note_${room.channelId}`
                    )
                    .setLabel(
                        "Note"
                    )
                    .setEmoji(
                        "📝"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tpv_toggle_${room.channelId}`
                    )
                    .setLabel(
                        room.closed
                            ? "Ouvrir"
                            : "Fermer"
                    )
                    .setEmoji(
                        room.closed
                            ? "🔓"
                            : "🔒"
                    )
                    .setStyle(
                        room.closed
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `tpv_call_${room.channelId}`
                    )
                    .setLabel(
                        room.request &&
                        !room.request.closed
                            ? "Appel en cours"
                            : "Appeler un gérant"
                    )
                    .setEmoji(
                        "📞"
                    )
                    .setStyle(
                        room.request &&
                        !room.request.closed
                            ? ButtonStyle.Danger
                            : ButtonStyle.Primary
                    ),

                // ======================================
                // LEGACY GAMES
                // ======================================

                new ButtonBuilder()
                    .setCustomId(
                        `tpv_games_${room.channelId}`
                    )
                    .setLabel(
                        "Jeux"
                    )
                    .setEmoji(
                        "🎮"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    // ==================================================
    // INVITER JOUEUR
    // ==================================================

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(
                        `tpv_inviteuser_${room.channelId}`
                    )
                    .setPlaceholder(
                        "👤 Inviter un joueur"
                    )
                    .setMinValues(
                        1
                    )
                    .setMaxValues(
                        1
                    )
            );

    // ==================================================
    // INVITER RÔLE
    // ==================================================

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(
                        `tpv_inviterole_${room.channelId}`
                    )
                    .setPlaceholder(
                        "🧩 Inviter une gestion complète / un rôle"
                    )
                    .setMinValues(
                        1
                    )
                    .setMaxValues(
                        1
                    )
            );

    // ==================================================
    // GESTION PROPRIÉTAIRE
    // ==================================================

    const row4 =
        new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `tpv_owneractions_${room.channelId}`
                    )
                    .setPlaceholder(
                        "⚙️ Gestion du bureau"
                    )
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(
                                "Exclure un joueur"
                            )
                            .setEmoji(
                                "❌"
                            )
                            .setValue(
                                "exclude"
                            ),

                        new StringSelectMenuOptionBuilder()
                            .setLabel(
                                "Permissions à un membre"
                            )
                            .setEmoji(
                                "🛡️"
                            )
                            .setValue(
                                "permissions"
                            ),

                        new StringSelectMenuOptionBuilder()
                            .setLabel(
                                "Transférer la propriété"
                            )
                            .setEmoji(
                                "👑"
                            )
                            .setValue(
                                "transfer"
                            )
                    )
            );

    // ==================================================
    // FONDATION
    // ==================================================

    const row5 =
        new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `tpv_foundation_${room.channelId}`
                    )
                    .setPlaceholder(
                        "👑 Actions Fondation"
                    )
                    .addOptions(
                        {
                            label:
                                "Déplacer tout un vocal ici",

                            emoji:
                                "👥",

                            value:
                                "move_all_here"
                        },

                        {
                            label:
                                "Déplacer ce vocal ailleurs",

                            emoji:
                                "↪️",

                            value:
                                "move_room"
                        },

                        {
                            label:
                                "Ramener quelqu'un ici",

                            emoji:
                                "🛡️",

                            value:
                                "bring"
                        },

                        {
                            label:
                                "Menotter quelqu'un ici",

                            emoji:
                                "🔒",

                            value:
                                "menotte"
                        },

                        {
                            label:
                                "Prendre la propriété",

                            emoji:
                                "👑",

                            value:
                                "take_owner"
                        },

                        {
                            label:
                                "Voir l'historique",

                            emoji:
                                "🔎",

                            value:
                                "history"
                        }
                    )
            );

    return [
        row1,
        row2,
        row3,
        row4,
        row5
    ];
}

// ======================================================
// PANEL - INTERNE
// ======================================================

async function updatePanelInternal(
    guild,
    room
) {
    const channel =
        guild.channels.cache.get(
            room.channelId
        );

    if (
        !channel
    ) {
        return;
    }

    const payload = {
        embeds: [
            buildPanelEmbed(
                channel,
                room
            )
        ],

        components:
            createPanelComponents(
                room
            )
    };

    // ==================================================
    // PANEL EXISTANT
    // ==================================================

    if (
        room.panelMessageId
    ) {
        const existing =
            await channel.messages
                .fetch(
                    room.panelMessageId
                )
                .catch(
                    () => null
                );

        if (
            existing
        ) {
            await existing.edit(
                payload
            );

            return;
        }

        room.panelMessageId =
            null;

        saveRooms();
    }

    // ==================================================
    // RECHERCHE ANCIEN PANEL
    // ==================================================

    const messages =
        await channel.messages
            .fetch({
                limit:
                    20
            })
            .catch(
                () => null
            );

    if (
        messages
    ) {
        const oldPanel =
            messages.find(
                message =>
                    message.author.id ===
                        guild.members.me?.id &&
                    message.embeds?.some(
                        embed =>
                            embed.description
                                ?.includes(
                                    "Panel de gestion"
                                )
                    )
            );

        if (
            oldPanel
        ) {
            room.panelMessageId =
                oldPanel.id;

            saveRooms();

            await oldPanel.edit(
                payload
            );

            return;
        }
    }

    // ==================================================
    // CRÉATION UNIQUE
    // ==================================================

    const message =
        await channel.send(
            payload
        );

    room.panelMessageId =
        message.id;

    saveRooms();

    console.log(
        `📋 Panel TPV créé : ${channel.name}`
    );
}

// ======================================================
// PANEL - QUEUE ANTI DOUBLON
// ======================================================

async function updatePanel(
    guild,
    room
) {
    const channelId =
        room.channelId;

    const previous =
        panelUpdateQueues.get(
            channelId
        ) ||
        Promise.resolve();

    const current =
        previous
            .catch(
                () => {}
            )
            .then(
                async () => {
                    await updatePanelInternal(
                        guild,
                        room
                    );
                }
            );

    panelUpdateQueues.set(
        channelId,
        current
    );

    try {
        await current;

    } finally {
        if (
            panelUpdateQueues.get(
                channelId
            ) ===
            current
        ) {
            panelUpdateQueues.delete(
                channelId
            );
        }
    }
}

// ======================================================
// PROPRIÉTÉ
// ======================================================

async function assignOwner(
    guild,
    channel,
    room,
    newOwnerId,
    reason = null
) {
    const oldOwnerId =
        room.ownerId;

    room.ownerId =
        newOwnerId;

    addHistory(
        room,
        `Propriété : ${oldOwnerId || "aucun"} → ${newOwnerId}`
    );

    saveRooms();

    await updatePanel(
        guild,
        room
    );

    if (
        reason
    ) {
        await channel.send({
            content:
                reason,

            allowedMentions: {
                users: [
                    oldOwnerId,
                    newOwnerId
                ].filter(
                    Boolean
                )
            }
        }).catch(
            () => {}
        );
    }
}

// ======================================================
// SUCCESSION
// ======================================================

function findSuccessor(
    channel,
    room,
    leavingId
) {
    const humans =
        getHumanMembers(
            channel
        ).filter(
            member =>
                member.id !==
                leavingId
        );

    if (
        humans.length ===
        0
    ) {
        return null;
    }

    for (
        const userId
        of room.joinOrder ||
        []
    ) {
        if (
            userId ===
            leavingId
        ) {
            continue;
        }

        const member =
            humans.find(
                candidate =>
                    candidate.id ===
                    userId
            );

        if (
            member
        ) {
            return member;
        }
    }

    return humans[0];
}

// ======================================================
// PERMISSIONS SALON
// ======================================================

async function setupRoomPermissions(
    guild,
    channel,
    ownerId
) {
    await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        {
            ViewChannel:
                true,

            Connect:
                true,

            Speak:
                true,

            SendMessages:
                false,

            AddReactions:
                false,

            CreatePublicThreads:
                false,

            CreatePrivateThreads:
                false,

            SendMessagesInThreads:
                false
        }
    );

    await channel.permissionOverwrites.edit(
        ownerId,
        {
            ViewChannel:
                true,

            Connect:
                true,

            Speak:
                true,

            SendMessages:
                false,

            AddReactions:
                false
        }
    );

    if (
        guild.members.me
    ) {
        await channel.permissionOverwrites.edit(
            guild.members.me.id,
            {
                ViewChannel:
                    true,

                Connect:
                    true,

                Speak:
                    true,

                SendMessages:
                    true,

                EmbedLinks:
                    true,

                ReadMessageHistory:
                    true,

                ManageChannels:
                    true,

                MoveMembers:
                    true
            }
        );
    }
}

// ======================================================
// CRÉATION SALON
// ======================================================

async function createRoom(
    member,
    config
) {
    const guild =
        member.guild;

    const lockId =
        `${guild.id}_${member.id}`;

    if (
        creationLocks.has(
            lockId
        )
    ) {
        return;
    }

    creationLocks.add(
        lockId
    );

    try {
        const category =
            guild.channels.cache.get(
                config.categoryId
            );

        if (
            !category
        ) {
            console.error(
                "❌ Catégorie TPV introuvable."
            );

            return;
        }

        const roomName =
            createRoomName(
                config.initialName,
                member
            );

        const channel =
            await guild.channels.create({
                name:
                    roomName,

                type:
                    ChannelType.GuildVoice,

                parent:
                    config.categoryId,

                reason:
                    `Bureau TPV de ${member.user.tag}`
            });

        await setupRoomPermissions(
            guild,
            channel,
            member.id
        );

        const now =
            Date.now();

        const room = {
            guildId:
                guild.id,

            channelId:
                channel.id,

            originalOwnerId:
                member.id,

            ownerId:
                member.id,

            createdAt:
                now,

            panelMessageId:
                null,

            joinOrder: [
                member.id
            ],

            joinTimes: {
                [member.id]:
                    now
            },

            note:
                null,

            closed:
                false,

            history:
                [],

            request:
                null,

            lastRequestResult:
                null,

            lastManagerRequestAt:
                null
        };

        addHistory(
            room,
            `${member.id} a créé le bureau`
        );

        rooms.set(
            channel.id,
            room
        );

        saveRooms();

        await member.voice
            .setChannel(
                channel.id
            )
            .catch(
                error => {
                    console.error(
                        "❌ Déplacement dans TPV :",
                        error
                    );
                }
            );

        await updatePanel(
            guild,
            room
        );

        console.log(
            `🏢 Bureau TPV créé : ${roomName}`
        );

    } catch (error) {
        console.error(
            "❌ Création TPV :",
            error
        );

    } finally {
        setTimeout(
            () => {
                creationLocks.delete(
                    lockId
                );
            },
            2000
        );
    }
}

// ======================================================
// MODAL APPEL GÉRANT
// ======================================================

function createCallModal(
    room
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `tpv_callmodal_${room.channelId}`
            )
            .setTitle(
                "Appeler un gérant"
            );

    const reason =
        new TextInputBuilder()
            .setCustomId(
                "reason"
            )
            .setLabel(
                "Raison de la demande"
            )
            .setPlaceholder(
                "Explique pourquoi tu as besoin d'un gérant..."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(
                true
            )
            .setMaxLength(
                700
            );

    const urgent =
        new TextInputBuilder()
            .setCustomId(
                "urgent"
            )
            .setLabel(
                "Urgent ? Oui ou Non"
            )
            .setPlaceholder(
                "Oui / Non"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                3
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                reason
            ),

        new ActionRowBuilder()
            .addComponents(
                urgent
            )
    );

    return modal;
}

// ======================================================
// EMBED DEMANDE GÉRANT
// ======================================================

function buildManagerRequestEmbed(
    guild,
    room
) {
    const request =
        room.request;

    let status =
        "🕒 En attente";

    if (
        request.status ===
        "taken"
    ) {
        status =
            `✅ Pris en charge par <@${request.handlerId}>`;
    }

    if (
        request.status ===
        "later"
    ) {
        status =
            `🟠 <@${request.handlerId}> arrive dans 15 à 30 minutes`;
    }

    const unavailable =
        request.unavailableIds ||
        [];

    return new EmbedBuilder()
        .setColor(
            request.urgent
                ? 0xCC3333
                : 0x666666
        )
        .setTitle(
            "📞 Demande de gérant"
        )
        .setDescription(
            [
                `${EMOJIS.owner} **Propriétaire**`,
                `<@${room.ownerId}>`,
                "",
                `${EMOJIS.settings} **Bureau**`,
                `<#${room.channelId}>`,
                "",
                `${EMOJIS.arrow} **État :** ${status}`,
                `${EMOJIS.arrow} **Urgent :** ${request.urgent ? "🔴 Oui" : "🟢 Non"}`,
                "",
                "**Raison**",
                request.reason,
                "",
                `❌ **Indisponibles • ${unavailable.length}/${request.foundationTotal || 4}**`,
                unavailable.length
                    ? unavailable
                        .map(
                            id =>
                                `<@${id}>`
                        )
                        .join(", ")
                    : "Aucun."
            ].join(
                "\n"
            )
        )
        .setFooter({
            text:
                `The Legacy • ${room.channelId}`
        })
        .setTimestamp(
            new Date(
                request.createdAt
            )
        );
}

// ======================================================
// BOUTONS REQUÊTE
// ======================================================

function requestButtons(
    disabled = false
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "tpv_request_unavailable"
                    )
                    .setLabel(
                        "Indisponible"
                    )
                    .setEmoji(
                        "❌"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "tpv_request_take"
                    )
                    .setLabel(
                        "Prendre en charge"
                    )
                    .setEmoji(
                        "✅"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "tpv_request_later"
                    )
                    .setLabel(
                        "J'arrive dans 15 à 30 min"
                    )
                    .setEmoji(
                        "🕒"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setDisabled(
                        disabled
                    )
            )
    ];
}

// ======================================================
// FIND ROOM REQUEST
// ======================================================

function findRoomByRequestMessage(
    messageId
) {
    for (
        const room
        of rooms.values()
    ) {
        if (
            room.request
                ?.messageId ===
            messageId
        ) {
            return room;
        }
    }

    return null;
}

// ======================================================
// FONDATION
// ======================================================

function isFoundation(
    member
) {
    return member.roles.cache.has(
        FOUNDATION_ROLE_ID
    );
}

// ======================================================
// OWNER
// ======================================================

function isOwner(
    interaction,
    room
) {
    return (
        interaction.user.id ===
        room.ownerId
    );
}

// ======================================================
// SYSTEM
// ======================================================

function registerTempVoiceSystem(
    client
) {
    ensureFiles();

    loadConfigs();
    loadRooms();

    client.tempVoiceSystem = {
        saveConfig,

        getConfig:
            guildId =>
                configMap.get(
                    guildId
                ),

        rooms,

        updatePanel
    };

    // ==================================================
    // READY
    // ==================================================

    client.once(
        Events.ClientReady,
        async () => {
            console.log(
                `🎙️ TPV : ${configMap.size} configuration(s)`
            );

            console.log(
                `🏢 TPV : ${rooms.size} bureau(x) restauré(s)`
            );

            for (
                const [
                    channelId,
                    room
                ]
                of [
                    ...rooms.entries()
                ]
            ) {
                const guild =
                    client.guilds.cache.get(
                        room.guildId
                    );

                const channel =
                    guild
                        ?.channels
                        .cache
                        .get(
                            channelId
                        );

                if (
                    !channel
                ) {
                    rooms.delete(
                        channelId
                    );

                    continue;
                }

                await updatePanel(
                    guild,
                    room
                ).catch(
                    () => {}
                );
            }

            saveRooms();
        }
    );

    // ==================================================
    // VOICE STATE
    // ==================================================

    client.on(
        Events.VoiceStateUpdate,
        async (
            oldState,
            newState
        ) => {
            try {
                if (
                    newState.member
                        ?.user
                        ?.bot
                ) {
                    return;
                }

                const guild =
                    newState.guild;

                const config =
                    configMap.get(
                        guild.id
                    );

                // ==========================================
                // HUB
                // ==========================================

                if (
                    config &&
                    newState.channelId ===
                        config.hubId &&
                    oldState.channelId !==
                        config.hubId
                ) {
                    await createRoom(
                        newState.member,
                        config
                    );

                    return;
                }

                // ==========================================
                // QUITTE UN BUREAU
                // ==========================================

                if (
                    oldState.channelId &&
                    rooms.has(
                        oldState.channelId
                    ) &&
                    oldState.channelId !==
                        newState.channelId
                ) {
                    const room =
                        rooms.get(
                            oldState.channelId
                        );

                    const channel =
                        guild.channels.cache.get(
                            oldState.channelId
                        );

                    if (
                        channel
                    ) {
                        addHistory(
                            room,
                            `${oldState.id} a quitté le bureau`
                        );

                        // ======================================
                        // VIDE → SUPPRESSION DIRECTE
                        // ======================================

                        const humansAfterLeave =
                            getHumanMembers(
                                channel
                            ).filter(
                                member =>
                                    member.id !==
                                    oldState.id
                            );

                        if (
                            humansAfterLeave.length ===
                            0
                        ) {
                            console.log(
                                `🗑️ TPV vide → suppression immédiate : ${channel.name}`
                            );

                            if (
                                room.request
                                    ?.messageId
                            ) {
                                const requestChannel =
                                    guild.channels.cache.get(
                                        MANAGER_REQUEST_CHANNEL_ID
                                    );

                                const requestMessage =
                                    await requestChannel
                                        ?.messages
                                        .fetch(
                                            room.request.messageId
                                        )
                                        .catch(
                                            () => null
                                        );

                                if (
                                    requestMessage
                                ) {
                                    await requestMessage
                                        .edit({
                                            components:
                                                requestButtons(
                                                    true
                                                )
                                        })
                                        .catch(
                                            () => {}
                                        );
                                }
                            }

                            rooms.delete(
                                channel.id
                            );

                            panelUpdateQueues.delete(
                                channel.id
                            );

                            saveRooms();

                            await channel
                                .delete(
                                    "Bureau TPV vide"
                                )
                                .catch(
                                    error =>
                                        console.error(
                                            "❌ Suppression TPV vide :",
                                            error
                                        )
                                );

                            return;
                        }

                        // ======================================
                        // PROPRIO QUITTE
                        // ======================================

                        if (
                            oldState.id ===
                            room.ownerId
                        ) {
                            const successor =
                                findSuccessor(
                                    channel,
                                    room,
                                    oldState.id
                                );

                            if (
                                successor
                            ) {
                                const previousOwner =
                                    room.ownerId;

                                await assignOwner(
                                    guild,
                                    channel,
                                    room,
                                    successor.id,
                                    `👑 <@${previousOwner}> a quitté le vocal. <@${successor.id}> devient donc propriétaire du bureau.`
                                );
                            }
                        }

                        saveRooms();

                        await updatePanel(
                            guild,
                            room
                        );
                    }
                }

                // ==========================================
                // ENTRE DANS UN BUREAU
                // ==========================================

                if (
                    newState.channelId &&
                    rooms.has(
                        newState.channelId
                    ) &&
                    oldState.channelId !==
                        newState.channelId
                ) {
                    const room =
                        rooms.get(
                            newState.channelId
                        );

                    const channel =
                        guild.channels.cache.get(
                            newState.channelId
                        );

                    if (
                        !channel
                    ) {
                        return;
                    }

                    registerJoin(
                        room,
                        newState.id
                    );

                    addHistory(
                        room,
                        `${newState.id} a rejoint le bureau`
                    );

                    // ======================================
                    // RETOUR DU PROPRIO INITIAL
                    // ======================================

                    if (
                        newState.id ===
                            room.originalOwnerId &&
                        room.ownerId !==
                            room.originalOwnerId
                    ) {
                        const temporaryOwner =
                            room.ownerId;

                        await assignOwner(
                            guild,
                            channel,
                            room,
                            room.originalOwnerId,
                            `👑 <@${room.originalOwnerId}> est de retour, <@${temporaryOwner}> lui redonne donc la propriété du vocal !`
                        );

                        return;
                    }

                    saveRooms();

                    await updatePanel(
                        guild,
                        room
                    );
                }

            } catch (error) {
                console.error(
                    "❌ TPV VoiceState :",
                    error
                );
            }
        }
    );

    // ==================================================
    // INTERACTIONS
    // ==================================================

    client.on(
        Events.InteractionCreate,
        async interaction => {
            try {
                // ==========================================
                // REQUÊTES GÉRANT
                // ==========================================

                if (
                    interaction.isButton() &&
                    interaction.customId
                        .startsWith(
                            "tpv_request_"
                        )
                ) {
                    const room =
                        findRoomByRequestMessage(
                            interaction.message.id
                        );

                    if (
                        !room ||
                        !room.request
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Cette demande n'existe plus.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !isFoundation(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Cette action est réservée à la Fondation.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        room.request.closed ||
                        [
                            "taken",
                            "later"
                        ].includes(
                            room.request.status
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "⚠️ Cette demande est déjà prise en charge.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const guild =
                        interaction.guild;

                    // ======================================
                    // INDISPONIBLE
                    // ======================================

                    if (
                        interaction.customId ===
                        "tpv_request_unavailable"
                    ) {
                        if (
                            !Array.isArray(
                                room.request
                                    .unavailableIds
                            )
                        ) {
                            room.request.unavailableIds =
                                [];
                        }

                        if (
                            room.request
                                .unavailableIds
                                .includes(
                                    interaction.user.id
                                )
                        ) {
                            return interaction.reply({
                                content:
                                    "⚠️ Tu es déjà indiqué comme indisponible.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        room.request
                            .unavailableIds
                            .push(
                                interaction.user.id
                            );

                        addHistory(
                            room,
                            `${interaction.user.id} est indisponible pour la demande`
                        );

                        saveRooms();

                        await interaction.update({
                            embeds: [
                                buildManagerRequestEmbed(
                                    guild,
                                    room
                                )
                            ],

                            components:
                                requestButtons(
                                    false
                                )
                        });

                        await updatePanel(
                            guild,
                            room
                        );

                        return;
                    }

                    // ======================================
                    // PRENDRE EN CHARGE
                    // ======================================

                    if (
                        interaction.customId ===
                        "tpv_request_take"
                    ) {
                        room.request.status =
                            "taken";

                        room.request.handlerId =
                            interaction.user.id;

                        room.request.closed =
                            true;

                        room.lastRequestResult =
                            `${EMOJIS.arrow} ✅ Dernière demande prise en charge par <@${interaction.user.id}>.`;

                        addHistory(
                            room,
                            `${interaction.user.id} a pris en charge la demande`
                        );

                        saveRooms();

                        await interaction.update({
                            embeds: [
                                buildManagerRequestEmbed(
                                    guild,
                                    room
                                )
                            ],

                            components:
                                requestButtons(
                                    true
                                )
                        });

                        await updatePanel(
                            guild,
                            room
                        );

                        if (
                            interaction.member
                                .voice
                                .channelId
                        ) {
                            await interaction.member
                                .voice
                                .setChannel(
                                    room.channelId
                                )
                                .catch(
                                    () => {}
                                );

                            await interaction.followUp({
                                content:
                                    "✅ Tu as été déplacé directement dans le bureau.",

                                flags:
                                    MessageFlags.Ephemeral
                            });

                        } else {
                            await interaction.followUp({
                                content:
                                    `✅ Demande prise en charge.\n🔊 [Rejoindre directement le bureau](https://discord.com/channels/${guild.id}/${room.channelId})`,

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        return;
                    }

                    // ======================================
                    // 15 - 30 MIN
                    // ======================================

                    if (
                        interaction.customId ===
                        "tpv_request_later"
                    ) {
                        room.request.status =
                            "later";

                        room.request.handlerId =
                            interaction.user.id;

                        room.request.closed =
                            true;

                        room.lastRequestResult =
                            `${EMOJIS.arrow} 🟠 <@${interaction.user.id}> arrivera dans **15 à 30 minutes**.`;

                        addHistory(
                            room,
                            `${interaction.user.id} arrivera dans 15 à 30 minutes`
                        );

                        saveRooms();

                        await interaction.update({
                            embeds: [
                                buildManagerRequestEmbed(
                                    guild,
                                    room
                                )
                            ],

                            components:
                                requestButtons(
                                    true
                                )
                        });

                        await updatePanel(
                            guild,
                            room
                        );

                        return;
                    }
                }

                // ==========================================
                // MODAL APPEL GÉRANT
                // ==========================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId
                        .startsWith(
                            "tpv_callmodal_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_callmodal_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room
                    ) {
                        return;
                    }

                    if (
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Seul le propriétaire peut appeler un gérant.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        room.request &&
                        !room.request.closed
                    ) {
                        return interaction.reply({
                            content:
                                "⚠️ Une demande de gérant est déjà en cours.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const cooldown =
                        getManagerCooldown(
                            room
                        );

                    if (
                        cooldown >
                        0
                    ) {
                        return interaction.reply({
                            content:
                                `⏳ Tu dois attendre encore **${formatDuration(cooldown)}** avant de pouvoir appeler de nouveau un gérant.`,

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const reason =
                        interaction.fields
                            .getTextInputValue(
                                "reason"
                            )
                            .trim();

                    const urgentRaw =
                        interaction.fields
                            .getTextInputValue(
                                "urgent"
                            )
                            .trim()
                            .toLowerCase();

                    const urgent =
                        [
                            "oui",
                            "yes",
                            "o",
                            "y"
                        ].includes(
                            urgentRaw
                        );

                    const foundationRole =
                        interaction.guild
                            .roles
                            .cache
                            .get(
                                FOUNDATION_ROLE_ID
                            );

                    room.request = {
                        reason,

                        urgent,

                        status:
                            "waiting",

                        handlerId:
                            null,

                        unavailableIds:
                            [],

                        foundationTotal:
                            foundationRole
                                ?.members
                                ?.size ||
                            4,

                        createdAt:
                            Date.now(),

                        closed:
                            false,

                        messageId:
                            null
                    };

                    room.lastManagerRequestAt =
                        Date.now();

                    room.lastRequestResult =
                        null;

                    addHistory(
                        room,
                        `${interaction.user.id} a appelé un gérant : ${reason}`
                    );

                    const requestChannel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                MANAGER_REQUEST_CHANNEL_ID
                            );

                    if (
                        !requestChannel
                    ) {
                        room.request =
                            null;

                        room.lastManagerRequestAt =
                            null;

                        saveRooms();

                        return interaction.reply({
                            content:
                                "❌ Le salon des demandes de gérant est introuvable.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const message =
                        await requestChannel.send({
                            content:
                                `<@&${MANAGER_PING_ROLE_ID}>`,

                            allowedMentions: {
                                roles: [
                                    MANAGER_PING_ROLE_ID
                                ]
                            },

                            embeds: [
                                buildManagerRequestEmbed(
                                    interaction.guild,
                                    room
                                )
                            ],

                            components:
                                requestButtons(
                                    false
                                )
                        });

                    room.request.messageId =
                        message.id;

                    saveRooms();

                    await updatePanel(
                        interaction.guild,
                        room
                    );

                    return interaction.reply({
                        content:
                            "📞 Ta demande a été envoyée aux gérants.",

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==========================================
                // BOUTONS PANEL
                // ==========================================

                if (
                    interaction.isButton() &&
                    interaction.customId
                        .startsWith(
                            "tpv_"
                        )
                ) {
                    const parts =
                        interaction.customId
                            .split(
                                "_"
                            );

                    const action =
                        parts[1];

                    const channelId =
                        parts[2];

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Ce bureau vocal n'existe plus.",

                            flags:
                                MessageFlags.Ephemeral
                        }).catch(
                            () => {}
                        );
                    }

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !channel
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Le salon vocal est introuvable.",

                            flags:
                                MessageFlags.Ephemeral
                        }).catch(
                            () => {}
                        );
                    }

                    // ======================================
                    // LEGACY GAMES
                    //
                    // Accessible à tous les membres
                    // actuellement présents dans le TPV.
                    // ======================================

                    if (
                        action ===
                        "games"
                    ) {
                        if (
                            interaction.member
                                .voice
                                .channelId !==
                            channelId
                        ) {
                            return interaction.reply({
                                content:
                                    "❌ Tu dois être présent dans ce vocal pour ouvrir les **Legacy Games**.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        const legacyGames =
                            interaction.client
                                .commands
                                ?.get(
                                    "legacygames"
                                );

                        if (
                            !legacyGames
                                ?.legacyGamesSystem
                                ?.openHub
                        ) {
                            return interaction.reply({
                                content:
                                    "❌ Le système **Legacy Games** n'est pas disponible pour le moment.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        addHistory(
                            room,
                            `${interaction.user.id} a ouvert Legacy Games`
                        );

                        saveRooms();

                        return legacyGames
                            .legacyGamesSystem
                            .openHub(
                                interaction,
                                channelId
                            );
                    }

                    // ======================================
                    // APPELER GÉRANT
                    // ======================================

                    if (
                        action ===
                        "call"
                    ) {
                        if (
                            !isOwner(
                                interaction,
                                room
                            )
                        ) {
                            return interaction.reply({
                                content:
                                    "❌ Seul le propriétaire du vocal peut appeler un gérant.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        if (
                            room.request &&
                            !room.request.closed
                        ) {
                            return interaction.reply({
                                content:
                                    "⚠️ Une demande de gérant est déjà en cours.",

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        const cooldown =
                            getManagerCooldown(
                                room
                            );

                        if (
                            cooldown >
                            0
                        ) {
                            return interaction.reply({
                                content:
                                    `⏳ Une demande a déjà été envoyée récemment.\nNouvelle demande possible dans **${formatDuration(cooldown)}**.`,

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        return interaction.showModal(
                            createCallModal(
                                room
                            )
                        );
                    }

                    // ======================================
                    // OWNER ONLY
                    //
                    // Rename / Note / Toggle restent
                    // réservés au propriétaire.
                    // ======================================

                    if (
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Cette action est réservée au propriétaire du bureau.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ======================================
                    // OUVRIR / FERMER
                    // ======================================

                    if (
                        action ===
                        "toggle"
                    ) {
                        room.closed =
                            !room.closed;

                        await channel
                            .permissionOverwrites
                            .edit(
                                interaction.guild
                                    .roles
                                    .everyone,
                                {
                                    Connect:
                                        !room.closed
                                }
                            );

                        await channel
                            .permissionOverwrites
                            .edit(
                                room.ownerId,
                                {
                                    Connect:
                                        true
                                }
                            );

                        addHistory(
                            room,
                            room.closed
                                ? `${interaction.user.id} a fermé le bureau`
                                : `${interaction.user.id} a ouvert le bureau`
                        );

                        saveRooms();

                        await interaction
                            .deferUpdate();

                        await updatePanel(
                            interaction.guild,
                            room
                        );

                        return;
                    }

                    // ======================================
                    // RENAME
                    // ======================================

                    if (
                        action ===
                        "rename"
                    ) {
                        const modal =
                            new ModalBuilder()
                                .setCustomId(
                                    `tpv_renamemodal_${channelId}`
                                )
                                .setTitle(
                                    "Renommer le bureau"
                                );

                        const input =
                            new TextInputBuilder()
                                .setCustomId(
                                    "name"
                                )
                                .setLabel(
                                    "Nouveau nom du vocal"
                                )
                                .setPlaceholder(
                                    "Ex : Réunion recrutement"
                                )
                                .setStyle(
                                    TextInputStyle.Short
                                )
                                .setRequired(
                                    true
                                )
                                .setMaxLength(
                                    100
                                );

                        modal.addComponents(
                            new ActionRowBuilder()
                                .addComponents(
                                    input
                                )
                        );

                        return interaction.showModal(
                            modal
                        );
                    }

                    // ======================================
                    // NOTE
                    // ======================================

                    if (
                        action ===
                        "note"
                    ) {
                        const modal =
                            new ModalBuilder()
                                .setCustomId(
                                    `tpv_notemodal_${channelId}`
                                )
                                .setTitle(
                                    "Note du bureau"
                                );

                        const input =
                            new TextInputBuilder()
                                .setCustomId(
                                    "note"
                                )
                                .setLabel(
                                    "Note visible dans le panel"
                                )
                                .setStyle(
                                    TextInputStyle.Paragraph
                                )
                                .setRequired(
                                    false
                                )
                                .setMaxLength(
                                    500
                                );

                        if (
                            room.note
                        ) {
                            input.setValue(
                                room.note
                            );
                        }

                        modal.addComponents(
                            new ActionRowBuilder()
                                .addComponents(
                                    input
                                )
                        );

                        return interaction.showModal(
                            modal
                        );
                    }
                }

                // ==========================================
                // RENAME MODAL
                // ==========================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId
                        .startsWith(
                            "tpv_renamemodal_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_renamemodal_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return;
                    }

                    const name =
                        interaction.fields
                            .getTextInputValue(
                                "name"
                            )
                            .trim()
                            .slice(
                                0,
                                100
                            );

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !channel
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Vocal introuvable.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await channel.setName(
                        name
                    );

                    addHistory(
                        room,
                        `${interaction.user.id} a renommé le bureau en ${name}`
                    );

                    saveRooms();

                    await interaction.reply({
                        content:
                            `✏️ Vocal renommé en **${name}**.`,

                        flags:
                            MessageFlags.Ephemeral
                    });

                    await updatePanel(
                        interaction.guild,
                        room
                    );

                    return;
                }

                // ==========================================
                // NOTE MODAL
                // ==========================================

                if (
                    interaction.isModalSubmit() &&
                    interaction.customId
                        .startsWith(
                            "tpv_notemodal_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_notemodal_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return;
                    }

                    room.note =
                        interaction.fields
                            .getTextInputValue(
                                "note"
                            )
                            .trim() ||
                        null;

                    addHistory(
                        room,
                        `${interaction.user.id} a modifié la note`
                    );

                    saveRooms();

                    await interaction.reply({
                        content:
                            "📝 Note mise à jour.",

                        flags:
                            MessageFlags.Ephemeral
                    });

                    await updatePanel(
                        interaction.guild,
                        room
                    );

                    return;
                }

                // ==========================================
                // INVITER JOUEUR
                // ==========================================

                if (
                    interaction.isUserSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_inviteuser_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_inviteuser_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Réservé au propriétaire.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const memberId =
                        interaction.values[
                            0
                        ];

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !channel
                    ) {
                        return;
                    }

                    await channel
                        .permissionOverwrites
                        .edit(
                            memberId,
                            {
                                ViewChannel:
                                    true,

                                Connect:
                                    true,

                                Speak:
                                    true,

                                SendMessages:
                                    false,

                                AddReactions:
                                    false
                            }
                        );

                    addHistory(
                        room,
                        `${interaction.user.id} a invité ${memberId}`
                    );

                    saveRooms();

                    return interaction.reply({
                        content:
                            `👤 <@${memberId}> peut maintenant rejoindre ce bureau.`,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==========================================
                // INVITER GESTION / RÔLE
                // ==========================================

                if (
                    interaction.isRoleSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_inviterole_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_inviterole_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Réservé au propriétaire.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        interaction.values[
                            0
                        ];

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !channel
                    ) {
                        return;
                    }

                    await channel
                        .permissionOverwrites
                        .edit(
                            roleId,
                            {
                                ViewChannel:
                                    true,

                                Connect:
                                    true,

                                Speak:
                                    true,

                                SendMessages:
                                    false,

                                AddReactions:
                                    false
                            }
                        );

                    addHistory(
                        room,
                        `${interaction.user.id} a invité le rôle ${roleId}`
                    );

                    saveRooms();

                    return interaction.reply({
                        content:
                            `🧩 <@&${roleId}> a maintenant accès à ce bureau.`,

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==========================================
                // OWNER ACTIONS
                // ==========================================

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_owneractions_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_owneractions_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Réservé au propriétaire.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const action =
                        interaction.values[
                            0
                        ];

                    const labels = {
                        exclude:
                            "❌ Choisis le joueur à exclure.",

                        permissions:
                            "🛡️ Choisis le membre à qui donner des permissions.",

                        transfer:
                            "👑 Choisis le nouveau propriétaire."
                    };

                    return interaction.reply({
                        content:
                            labels[
                                action
                            ],

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new UserSelectMenuBuilder()
                                        .setCustomId(
                                            `tpv_useraction_${action}_${channelId}`
                                        )
                                        .setPlaceholder(
                                            "Sélectionner un membre"
                                        )
                                        .setMinValues(
                                            1
                                        )
                                        .setMaxValues(
                                            1
                                        )
                                )
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ==========================================
                // OWNER USER ACTION
                // ==========================================

                if (
                    interaction.isUserSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_useraction_"
                        )
                ) {
                    const parts =
                        interaction.customId
                            .split(
                                "_"
                            );

                    const action =
                        parts[
                            2
                        ];

                    const channelId =
                        parts[
                            3
                        ];

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room ||
                        !isOwner(
                            interaction,
                            room
                        )
                    ) {
                        return;
                    }

                    const memberId =
                        interaction.values[
                            0
                        ];

                    const member =
                        await interaction.guild
                            .members
                            .fetch(
                                memberId
                            )
                            .catch(
                                () => null
                            );

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !member ||
                        !channel
                    ) {
                        return;
                    }

                    // ======================================
                    // EXCLURE
                    // ======================================

                    if (
                        action ===
                        "exclude"
                    ) {
                        if (
                            member.voice
                                .channelId ===
                            channelId
                        ) {
                            await member.voice
                                .disconnect()
                                .catch(
                                    () => {}
                                );
                        }

                        await channel
                            .permissionOverwrites
                            .edit(
                                memberId,
                                {
                                    Connect:
                                        false
                                }
                            );

                        addHistory(
                            room,
                            `${interaction.user.id} a exclu ${memberId}`
                        );

                        saveRooms();

                        return interaction.update({
                            content:
                                `❌ <@${memberId}> a été exclu.`,

                            components:
                                []
                        });
                    }

                    // ======================================
                    // PERMISSIONS
                    // ======================================

                    if (
                        action ===
                        "permissions"
                    ) {
                        await channel
                            .permissionOverwrites
                            .edit(
                                memberId,
                                {
                                    ViewChannel:
                                        true,

                                    Connect:
                                        true,

                                    Speak:
                                        true,

                                    MoveMembers:
                                        true,

                                    SendMessages:
                                        false,

                                    AddReactions:
                                        false
                                }
                            );

                        addHistory(
                            room,
                            `${interaction.user.id} a donné des permissions à ${memberId}`
                        );

                        saveRooms();

                        return interaction.update({
                            content:
                                `🛡️ <@${memberId}> possède maintenant des permissions supplémentaires.`,

                            components:
                                []
                        });
                    }

                    // ======================================
                    // TRANSFERT
                    // ======================================

                    if (
                        action ===
                        "transfer"
                    ) {
                        await assignOwner(
                            interaction.guild,
                            channel,
                            room,
                            memberId,
                            `👑 <@${interaction.user.id}> transfère la propriété du vocal à <@${memberId}>.`
                        );

                        return interaction.update({
                            content:
                                `👑 Propriété transférée à <@${memberId}>.`,

                            components:
                                []
                        });
                    }
                }

                // ==========================================
                // ACTIONS FONDATION
                // ==========================================

                if (
                    interaction.isStringSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_foundation_"
                        )
                ) {
                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_foundation_",
                                ""
                            );

                    const room =
                        rooms.get(
                            channelId
                        );

                    if (
                        !room
                    ) {
                        return;
                    }

                    if (
                        !isFoundation(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Ces actions sont réservées à la Fondation.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const action =
                        interaction.values[
                            0
                        ];

                    const channel =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !channel
                    ) {
                        return;
                    }

                    // ======================================
                    // PRENDRE PROPRIÉTÉ
                    // ======================================

                    if (
                        action ===
                        "take_owner"
                    ) {
                        const oldOwner =
                            room.ownerId;

                        await assignOwner(
                            interaction.guild,
                            channel,
                            room,
                            interaction.user.id,
                            `👑 <@${interaction.user.id}> prend la propriété du bureau à <@${oldOwner}>.`
                        );

                        return interaction.reply({
                            content:
                                "👑 Tu es maintenant propriétaire du bureau.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ======================================
                    // HISTORIQUE
                    // ======================================

                    if (
                        action ===
                        "history"
                    ) {
                        const history =
                            (
                                room.history ||
                                []
                            )
                                .slice(
                                    -15
                                )
                                .map(
                                    entry =>
                                        `<t:${Math.floor(entry.at / 1000)}:t> • ${entry.text}`
                                )
                                .join(
                                    "\n"
                                );

                        return interaction.reply({
                            content:
                                history ||
                                "Aucun historique.",

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ======================================
                    // BRING / MENOTTE
                    // ======================================

                    if (
                        [
                            "bring",
                            "menotte"
                        ].includes(
                            action
                        )
                    ) {
                        return interaction.reply({
                            content:
                                action ===
                                "bring"
                                    ? "🛡️ Choisis le joueur à ramener."
                                    : "🔒 Choisis le joueur à menotter dans ce bureau.",

                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new UserSelectMenuBuilder()
                                            .setCustomId(
                                                `tpv_foundationuser_${action}_${channelId}`
                                            )
                                            .setPlaceholder(
                                                "Sélectionner un joueur"
                                            )
                                            .setMinValues(
                                                1
                                            )
                                            .setMaxValues(
                                                1
                                            )
                                    )
                            ],

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ======================================
                    // DÉPLACER LE BUREAU
                    // ======================================

                    if (
                        action ===
                        "move_room"
                    ) {
                        return interaction.reply({
                            content:
                                "↪️ Choisis le vocal dans lequel déplacer les membres.",

                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ChannelSelectMenuBuilder()
                                            .setCustomId(
                                                `tpv_move_room_${channelId}`
                                            )
                                            .setPlaceholder(
                                                "Choisir un vocal"
                                            )
                                            .addChannelTypes(
                                                ChannelType.GuildVoice
                                            )
                                    )
                            ],

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // ======================================
                    // DÉPLACER UN AUTRE VOCAL ICI
                    // ======================================

                    if (
                        action ===
                        "move_all_here"
                    ) {
                        return interaction.reply({
                            content:
                                "👥 Choisis le vocal à déplacer entièrement ici.",

                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ChannelSelectMenuBuilder()
                                            .setCustomId(
                                                `tpv_move_here_${channelId}`
                                            )
                                            .setPlaceholder(
                                                "Choisir le vocal source"
                                            )
                                            .addChannelTypes(
                                                ChannelType.GuildVoice
                                            )
                                    )
                            ],

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }
                }

                // ==========================================
                // FONDATION USER
                // ==========================================

                if (
                    interaction.isUserSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_foundationuser_"
                        )
                ) {
                    if (
                        !isFoundation(
                            interaction.member
                        )
                    ) {
                        return;
                    }

                    const parts =
                        interaction.customId
                            .split(
                                "_"
                            );

                    const action =
                        parts[
                            2
                        ];

                    const channelId =
                        parts[
                            3
                        ];

                    const memberId =
                        interaction.values[
                            0
                        ];

                    const member =
                        await interaction.guild
                            .members
                            .fetch(
                                memberId
                            )
                            .catch(
                                () => null
                            );

                    if (
                        !member
                    ) {
                        return;
                    }

                    if (
                        action ===
                        "bring"
                    ) {
                        await member.voice
                            .setChannel(
                                channelId
                            );

                        return interaction.update({
                            content:
                                `🛡️ <@${memberId}> a été ramené dans le bureau.`,

                            components:
                                []
                        });
                    }

                    if (
                        action ===
                        "menotte"
                    ) {
                        interaction.client
                            .menottes
                            .set(
                                memberId,
                                {
                                    guildId:
                                        interaction.guild.id,

                                    channelId,

                                    moderatorId:
                                        interaction.user.id
                                }
                            );

                        interaction.client
                            .saveControlStates
                            ?.();

                        if (
                            member.voice
                                .channelId !==
                            channelId
                        ) {
                            await member.voice
                                .setChannel(
                                    channelId
                                )
                                .catch(
                                    () => {}
                                );
                        }

                        return interaction.update({
                            content:
                                `🔒 <@${memberId}> est maintenant menotté dans ce bureau.`,

                            components:
                                []
                        });
                    }
                }

                // ==========================================
                // MOVE ROOM
                // ==========================================

                if (
                    interaction.isChannelSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_move_room_"
                        )
                ) {
                    if (
                        !isFoundation(
                            interaction.member
                        )
                    ) {
                        return;
                    }

                    const channelId =
                        interaction.customId
                            .replace(
                                "tpv_move_room_",
                                ""
                            );

                    const destinationId =
                        interaction.values[
                            0
                        ];

                    const source =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                channelId
                            );

                    if (
                        !source
                    ) {
                        return;
                    }

                    for (
                        const member
                        of source.members.values()
                    ) {
                        if (
                            member.user.bot
                        ) {
                            continue;
                        }

                        await member.voice
                            .setChannel(
                                destinationId
                            )
                            .catch(
                                () => {}
                            );
                    }

                    return interaction.update({
                        content:
                            `↪️ Les membres ont été déplacés dans <#${destinationId}>.`,

                        components:
                            []
                    });
                }

                // ==========================================
                // MOVE HERE
                // ==========================================

                if (
                    interaction.isChannelSelectMenu() &&
                    interaction.customId
                        .startsWith(
                            "tpv_move_here_"
                        )
                ) {
                    if (
                        !isFoundation(
                            interaction.member
                        )
                    ) {
                        return;
                    }

                    const destinationId =
                        interaction.customId
                            .replace(
                                "tpv_move_here_",
                                ""
                            );

                    const sourceId =
                        interaction.values[
                            0
                        ];

                    const source =
                        interaction.guild
                            .channels
                            .cache
                            .get(
                                sourceId
                            );

                    if (
                        !source
                    ) {
                        return;
                    }

                    for (
                        const member
                        of source.members.values()
                    ) {
                        if (
                            member.user.bot
                        ) {
                            continue;
                        }

                        await member.voice
                            .setChannel(
                                destinationId
                            )
                            .catch(
                                () => {}
                            );
                    }

                    return interaction.update({
                        content:
                            `👥 Tout <#${sourceId}> a été déplacé ici.`,

                        components:
                            []
                    });
                }

            } catch (error) {
                console.error(
                    "❌ TPV interaction :",
                    error
                );

                if (
                    interaction.isRepliable() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content:
                            `❌ Erreur TPV : \`${error.message}\``,

                        flags:
                            MessageFlags.Ephemeral
                    }).catch(
                        () => {}
                    );
                }
            }
        }
    );

    // ==================================================
    // ACTUALISATION PANEL CHAQUE MINUTE
    // ==================================================

    setInterval(
        async () => {
            for (
                const room
                of rooms.values()
            ) {
                const guild =
                    client.guilds.cache.get(
                        room.guildId
                    );

                if (
                    !guild
                ) {
                    continue;
                }

                await updatePanel(
                    guild,
                    room
                ).catch(
                    () => {}
                );
            }
        },
        60_000
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    registerTempVoiceSystem;