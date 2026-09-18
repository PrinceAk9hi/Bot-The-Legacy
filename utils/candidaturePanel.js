const memberRefresh = new WeakMap();
const { COLORS: SOUL_COLORS } = require("../config/soulSociety");

const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// ======================================================
// Soul Society — PANEL CANDIDATURE
// ======================================================

const PANEL_CHANNEL_ID =
    "1468699202027655179";

const MEMBER_ROLE_ID =
    "1513698444588482650";

const JOIN_BUTTON_EMOJI =
    "1548783936010977380";

const CLOSED_EMOJI =
    "🔒";

const OPEN_COLOR =
    SOUL_COLORS.primary;

const CLOSED_COLOR =
    SOUL_COLORS.error;

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

async function countSoulMembers(
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
            "Rejoindre Soul Society <:Soul_Society:1548783936010977380>"
        )
        .setDescription(
`Soul Society évolue dans une palette de **roses pâles et vifs**. Notre héritage repose sur **la discrétion**, **la loyauté** et **le respect**, des valeurs qui **façonnent chacun de nos membres**.

**Période de test**

> - 1 à 2 semaines de mise à l'épreuve.
> - Accès à la bannière officielle dès l'obtention du grade <@&1468701415475118282>.

**Conditions de recrutement**

- 3 500 minutes de jeu minimum.
- Microphone obligatoire.
- Faire preuve de maturité, de cohérence et d'une grande discrétion.
- 16 ans minimum.
- Maîtriser le règlement du serveur.
- Whitelist non obligatoire ; casier RP vierge non obligatoire.
- Faire preuve d'une activité soutenue sur Discord comme en jeu.

> *En rejoignant Soul Society, vous reconnaissez avoir pris connaissance de l'ensemble des conditions énoncées ci-dessus. Vous vous engagez également à respecter nos valeurs, à faire preuve de patience durant le traitement de votre candidature et à accepter que chaque décision soit prise dans l'intérêt de l'héritage que nous préservons.*`
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
`### <:Soul_Society:1548783936010977380> Effectif Soul Society

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

> Les candidatures sont actuellement fermées.`
        );
}

// ======================================================
// JOIN BUTTON
// ======================================================

function createJoinRow(guild) {
    const logo = guild?.emojis?.cache?.get(JOIN_BUTTON_EMOJI);
    const emoji = logo && logo.available !== false && !logo.roles?.cache?.size
        ? { id: logo.id, name: logo.name, animated: Boolean(logo.animated) }
        : "🌸";
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    "soul_join"
                )
                .setLabel(
                    "Rejoindre Soul Society"
                )
                .setEmoji(emoji)
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
        await countSoulMembers(
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
                    createJoinRow(guild)
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
    const channelId = guild.id === "1080943923691782154" ? PANEL_CHANNEL_ID : (state.channelId || PANEL_CHANNEL_ID);

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

    countSoulMembers,

    createPanel,
    updatePanel,

    getPanelChannel,
    getPanelMessage,

    buildPanelPayload,

    areCandidaturesOpen
};