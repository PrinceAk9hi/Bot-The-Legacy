const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// ======================================================
// THE LEGACY — PANEL CANDIDATURE
// ======================================================

const PANEL_CHANNEL_ID =
    "1533186481412116631";

const MEMBER_ROLE_ID =
    "1458391977073574012";

const JOIN_BUTTON_EMOJI =
    "1534556651351310387";

const CLOSED_EMOJI =
    "<a:dmd_gerant:1540428204098195616>";

const OPEN_COLOR =
    0x3B6475;

const CLOSED_COLOR =
    0xED4245;

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
        "candidaturePanel.json"
    );

// ======================================================
// DEFAULT
// ======================================================

function defaultState() {
    return {
        version: 2,

        enabled:
            true,

        limit:
            null,

        reopeningDate:
            null,

        guildId:
            null,

        channelId:
            PANEL_CHANNEL_ID,

        messageId:
            null,

        updatedAt:
            null,

        updatedBy:
            null
    };
}

// ======================================================
// FILE
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
                defaultState(),
                null,
                4
            ),
            "utf8"
        );
    }
}

function loadState() {
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
            return defaultState();
        }

        const parsed =
            JSON.parse(
                raw
            );

        return {
            ...defaultState(),
            ...parsed
        };

    } catch (error) {
        console.error(
            "❌ Lecture candidaturePanel.json :",
            error
        );

        return defaultState();
    }
}

function saveState(
    state
) {
    ensureFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            state,
            null,
            4
        ),
        "utf8"
    );

    return state;
}

// ======================================================
// COUNT MEMBERS
// ======================================================

async function countLegacyMembers(
    guild
) {
    try {
        await guild.members.fetch();
    } catch {
        // Cache utilisé si Discord refuse le fetch.
    }

    return guild.members.cache.filter(
        member =>
            !member.user.bot &&
            member.roles.cache.has(
                MEMBER_ROLE_ID
            )
    ).size;
}

// ======================================================
// MAIN EMBED
// ======================================================

function createMainEmbed(
    enabled
) {
    return new EmbedBuilder()
        .setColor(
            enabled
                ? OPEN_COLOR
                : CLOSED_COLOR
        )
        .setTitle(
            "Le Chemin Des Héritiers <:emoji_26:1532806562761150544>"
        )
        .setDescription(
`The Legacy évolue dans une palette de **bleus profonds**, **inspirée des cieux** et **du silence**. Notre héritage repose sur **la discrétion**, **la loyauté** et **le respect**, des valeurs qui **façonnent chacun de nos membres**.

**Période de test**

> - 2 semaines de mise à l'épreuve.
> - Accès à la bannière officielle dès l'obtention du grade <@&1531761056744083648>.

**Conditions de recrutement**

- 5 000 minutes de jeu minimum.
- Casier RP vierge ou irréprochable.
- Faire preuve de maturité, de cohérence et d'une grande discrétion.
- 16 ans minimum.
- Maîtriser le règlement du serveur.
- Être investi en WL / S-WL.
- Faire preuve d'une activité soutenue sur Discord comme en jeu.

> *En rejoignant The Legacy, vous reconnaissez avoir pris connaissance de l'ensemble des conditions énoncées ci-dessus. Vous vous engagez également à respecter nos valeurs, à faire preuve de patience durant le traitement de votre candidature et à accepter que chaque décision soit prise dans l'intérêt de l'héritage que nous préservons.*`
        );
}

// ======================================================
// STATUS EMBED
// ======================================================

function createStatusEmbed(
    state,
    memberCount
) {
    // ==================================================
    // ON
    // ==================================================

    if (
        state.enabled
    ) {
        let countText =
            `${memberCount}`;

        if (
            Number.isInteger(
                state.limit
            ) &&
            state.limit > 0
        ) {
            countText =
                `${memberCount}/${state.limit}`;
        }

        return new EmbedBuilder()
            .setColor(
                OPEN_COLOR
            )
            .setDescription(
`### <:coeurpnllgcy:1533222807423418479> Effectif The Legacy

> **Membres : ${countText}**`
            );
    }

    // ==================================================
    // OFF
    // ==================================================

    const reopening =
        state.reopeningDate &&
        state.reopeningDate.trim()
            ? state.reopeningDate.trim()
            : "Indéfinie";

    return new EmbedBuilder()
        .setColor(
            CLOSED_COLOR
        )
        .setDescription(
`### ${CLOSED_EMOJI} Candidatures Close

> **Ouverture des recrutements :** ${reopening}`
        );
}

// ======================================================
// JOIN BUTTON
// ======================================================

function createJoinRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "legacy_join"
                )
                .setLabel(
                    "Rejoindre The Legacy"
                )
                .setEmoji(
                    JOIN_BUTTON_EMOJI
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
}

// ======================================================
// BUILD PANEL
// ======================================================

async function buildPanelPayload(
    guild,
    state = loadState()
) {
    const memberCount =
        await countLegacyMembers(
            guild
        );

    return {
        embeds: [
            createMainEmbed(
                state.enabled
            ),

            createStatusEmbed(
                state,
                memberCount
            )
        ],

        components:
            state.enabled
                ? [
                    createJoinRow()
                ]
                : []
    };
}

// ======================================================
// CHANNEL
// ======================================================

async function getPanelChannel(
    guild,
    state = loadState()
) {
    const channelId =
        state.channelId ||
        PANEL_CHANNEL_ID;

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
// MESSAGE
// ======================================================

async function getPanelMessage(
    guild,
    state = loadState()
) {
    if (
        !state.messageId
    ) {
        return null;
    }

    const channel =
        await getPanelChannel(
            guild,
            state
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return null;
    }

    return channel.messages
        .fetch(
            state.messageId
        )
        .catch(
            () => null
        );
}

// ======================================================
// CREATE
// ======================================================

async function createPanel(
    guild,
    userId = null
) {
    let state =
        loadState();

    const channel =
        await getPanelChannel(
            guild,
            state
        );

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        return {
            ok:
                false,

            reason:
                "channel_not_found"
        };
    }

    const payload =
        await buildPanelPayload(
            guild,
            state
        );

    const message =
        await channel.send(
            payload
        );

    state = {
        ...state,

        guildId:
            guild.id,

        channelId:
            channel.id,

        messageId:
            message.id,

        updatedAt:
            Date.now(),

        updatedBy:
            userId
    };

    saveState(
        state
    );

    return {
        ok:
            true,

        state,
        message
    };
}

// ======================================================
// UPDATE
// ======================================================

async function updatePanel(
    guild
) {
    const state =
        loadState();

    const message =
        await getPanelMessage(
            guild,
            state
        );

    if (
        !message
    ) {
        return {
            ok:
                false,

            reason:
                "message_not_found"
        };
    }

    const payload =
        await buildPanelPayload(
            guild,
            state
        );

    await message.edit(
        payload
    );

    return {
        ok:
            true,

        message,
        state
    };
}

// ======================================================
// CHECK OPEN
// ======================================================

function areCandidaturesOpen() {
    return loadState().enabled ===
        true;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    PANEL_CHANNEL_ID,
    MEMBER_ROLE_ID,

    loadState,
    saveState,

    countLegacyMembers,

    createPanel,
    updatePanel,

    getPanelChannel,
    getPanelMessage,

    buildPanelPayload,

    areCandidaturesOpen
};