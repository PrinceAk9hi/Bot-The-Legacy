const fs = require("fs");
const path = require("path");

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
        "manageRoles.json"
    );

// ======================================================
// DEFAULT
// ======================================================

function defaultData() {
    return {
        version: 1,
        rules: []
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
                defaultData(),
                null,
                4
            ),
            "utf8"
        );
    }
}

// ======================================================
// LOAD
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
            !Array.isArray(
                parsed.rules
            )
        ) {
            parsed.rules =
                [];
        }

        return {
            ...defaultData(),
            ...parsed
        };

    } catch (error) {
        console.error(
            "❌ Lecture manageRoles.json :",
            error
        );

        return defaultData();
    }
}

// ======================================================
// SAVE
// ======================================================

function saveData(
    data
) {
    ensureFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );

    return data;
}

// ======================================================
// GET ALL
// ======================================================

function getRules(
    guildId = null
) {
    const data =
        loadData();

    if (
        !guildId
    ) {
        return data.rules;
    }

    return data.rules.filter(
        rule =>
            rule.guildId ===
            guildId
    );
}

// ======================================================
// GET ONE
// ======================================================

function getRule(
    ruleId
) {
    return loadData()
        .rules
        .find(
            rule =>
                rule.id ===
                ruleId
        ) ||
        null;
}

// ======================================================
// CREATE ID
// ======================================================

function createRuleId() {
    return (
        Date.now()
            .toString(
                36
            ) +
        Math.random()
            .toString(
                36
            )
            .substring(
                2,
                8
            )
    );
}

// ======================================================
// SAVE RULE
// ======================================================

function saveRule(
    rule
) {
    const data =
        loadData();

    const index =
        data.rules.findIndex(
            existing =>
                existing.id ===
                rule.id
        );

    if (
        index ===
        -1
    ) {
        data.rules.push(
            rule
        );

    } else {
        data.rules[
            index
        ] =
            rule;
    }

    saveData(
        data
    );

    return rule;
}

// ======================================================
// DELETE RULE
// ======================================================

function deleteRule(
    ruleId
) {
    const data =
        loadData();

    const before =
        data.rules.length;

    data.rules =
        data.rules.filter(
            rule =>
                rule.id !==
                ruleId
        );

    saveData(
        data
    );

    return (
        data.rules.length <
        before
    );
}

// ======================================================
// TOGGLE
// ======================================================

function toggleRule(
    ruleId,
    enabled
) {
    const data =
        loadData();

    const rule =
        data.rules.find(
            item =>
                item.id ===
                ruleId
        );

    if (
        !rule
    ) {
        return null;
    }

    rule.enabled =
        Boolean(
            enabled
        );

    rule.updatedAt =
        Date.now();

    saveData(
        data
    );

    return rule;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    loadData,
    saveData,

    getRules,
    getRule,

    saveRule,
    deleteRule,
    toggleRule,

    createRuleId
};