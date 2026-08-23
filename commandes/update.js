const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COMMANDS_DIR =
    path.join(
        __dirname
    );

// ======================================================
// COMMANDE
// ======================================================

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("update")
            .setDescription(
                "Recharger les commandes du bot sans redémarrage"
            ),

    // ==================================================
    // EXECUTION
    // ==================================================

    async execute(interaction) {
        try {
            // ==================================================
            // RÉPONSE DISCORD
            // ==================================================
            // Évite l'erreur 40060 si l'interaction a déjà été
            // reconnue ailleurs par le bot.
            // ==================================================

            if (
                !interaction.deferred &&
                !interaction.replied
            ) {
                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ==================================================
            // FONCTION RÉPONSE
            // ==================================================

            async function respond(payload) {
                try {
                    if (
                        interaction.deferred ||
                        interaction.replied
                    ) {
                        return await interaction.editReply(
                            payload
                        );
                    }

                    return await interaction.reply({
                        ...payload,

                        flags:
                            MessageFlags.Ephemeral
                    });

                } catch (error) {
                    console.error(
                        "❌ /update réponse :",
                        error
                    );

                    return null;
                }
            }

            // ==================================================
            // MESSAGE TEMPORAIRE
            // ==================================================

            await respond({
                content:
                    "🔄 **Rechargement des commandes en cours...**"
            });

            console.log("");
            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log(
                `🔄 /update lancé par ${interaction.user.username}`
            );

            // ==================================================
            // RÉCUPÉRATION DES FICHIERS
            // ==================================================

            const commandFiles =
                fs.readdirSync(
                    COMMANDS_DIR
                )
                    .filter(
                        file =>
                            file.endsWith(
                                ".js"
                            )
                    );

            if (
                commandFiles.length ===
                0
            ) {
                return respond({
                    content:
                        "❌ Aucun fichier de commande trouvé."
                });
            }

            // ==================================================
            // SAUVEGARDE DES ANCIENNES COMMANDES
            // ==================================================

            const previousCommands =
                new Map(
                    interaction.client.commands
                );

            // ==================================================
            // NOUVELLE COLLECTION TEMPORAIRE
            // ==================================================

            const newCommands =
                new Map();

            const results = [];

            let loaded =
                0;

            let failed =
                0;

            // ==================================================
            // RECHARGEMENT
            // ==================================================

            for (
                const file
                of commandFiles
            ) {
                const filePath =
                    path.join(
                        COMMANDS_DIR,
                        file
                    );

                try {
                    // ==========================================
                    // SUPPRESSION DU CACHE NODE
                    // ==========================================

                    const resolvedPath =
                        require.resolve(
                            filePath
                        );

                    delete require.cache[
                        resolvedPath
                    ];

                    // ==========================================
                    // IMPORT
                    // ==========================================

                    const command =
                        require(
                            filePath
                        );

                    // ==========================================
                    // VALIDATION
                    // ==========================================

                    if (
                        !command ||
                        !command.data ||
                        typeof command.execute !==
                            "function"
                    ) {
                        failed++;

                        results.push(
                            `❌ ${file}`
                        );

                        console.warn(
                            `⚠️ ${file} ignoré : data ou execute manquant.`
                        );

                        continue;
                    }

                    const commandName =
                        command.data.name;

                    if (
                        !commandName
                    ) {
                        failed++;

                        results.push(
                            `❌ ${file}`
                        );

                        console.warn(
                            `⚠️ ${file} ignoré : nom de commande manquant.`
                        );

                        continue;
                    }

                    // ==========================================
                    // ENREGISTREMENT TEMPORAIRE
                    // ==========================================

                    newCommands.set(
                        commandName,
                        command
                    );

                    loaded++;

                    results.push(
                        `✅ /${commandName}`
                    );

                    console.log(
                        `✅ Reload : ${file} → /${commandName}`
                    );

                    // ==========================================
                    // AUTOCOMPLETE
                    // ==========================================

                    if (
                        typeof command.autocomplete ===
                            "function"
                    ) {
                        console.log(
                            `↳ 🔎 Autocomplete : /${commandName}`
                        );
                    }

                } catch (error) {
                    failed++;

                    results.push(
                        `❌ ${file}`
                    );

                    console.error(
                        `❌ Reload ${file} :`,
                        error
                    );
                }
            }

            // ==================================================
            // SÉCURITÉ
            // ==================================================

            // Si absolument aucune commande n'a pu être chargée,
            // on garde l'ancienne collection.
            if (
                loaded ===
                0
            ) {
                interaction.client.commands =
                    previousCommands;

                console.error(
                    "❌ /update annulé : aucune commande valide."
                );

                console.log(
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                );

                console.log("");

                return respond({
                    content:
                        [
                            "❌ **Mise à jour annulée**",
                            "",
                            "Aucune commande valide n'a pu être chargée.",
                            "Les anciennes commandes ont été conservées."
                        ].join("\n")
                });
            }

            // ==================================================
            // APPLICATION
            // ==================================================

            interaction.client.commands.clear();

            for (
                const [
                    commandName,
                    command
                ]
                of newCommands
            ) {
                interaction.client.commands.set(
                    commandName,
                    command
                );
            }

            // ==================================================
            // RÉENREGISTREMENT DISCORD
            // ==================================================
            // Si ton index expose une fonction permettant de
            // réenregistrer les slash commands, on l'utilise.
            // Sinon elles restent chargées côté bot.
            // ==================================================

            let discordRegistration =
                "non nécessaire";

            if (
                typeof interaction.client
                    .registerCommands ===
                    "function"
            ) {
                try {
                    await interaction.client
                        .registerCommands();

                    discordRegistration =
                        "effectué";

                    console.log(
                        "✅ Slash commands réenregistrées auprès de Discord."
                    );

                } catch (error) {
                    discordRegistration =
                        "échec";

                    console.error(
                        "❌ Réenregistrement Discord :",
                        error
                    );
                }
            }

            // ==================================================
            // TERMINÉ
            // ==================================================

            console.log(
                `📦 ${loaded} commande(s) rechargée(s)`
            );

            if (
                failed >
                0
            ) {
                console.log(
                    `❌ ${failed} commande(s) en erreur`
                );
            }

            console.log(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            console.log("");

            // ==================================================
            // AFFICHAGE
            // ==================================================

            const displayResults =
                results
                    .slice(
                        0,
                        20
                    )
                    .join(
                        "\n"
                    );

            let content = [
                "✅ **MISE À JOUR TERMINÉE**",
                "",
                `📦 **${loaded} commande(s) rechargée(s)**`,
                failed
                    ? `⚠️ **${failed} erreur(s)**`
                    : "🟢 **Aucune erreur**",
                "",
                displayResults
            ]
                .filter(Boolean)
                .join("\n");

            if (
                results.length >
                20
            ) {
                content +=
                    `\n\n+ ${results.length - 20} autre(s) commande(s)`;
            }

            if (
                discordRegistration ===
                    "échec"
            ) {
                content +=
                    "\n\n⚠️ Les fichiers sont rechargés mais le réenregistrement Discord a échoué.";
            }

            return respond({
                content
            });

        } catch (error) {
            console.error(
                "❌ /update :",
                error
            );

            // ==================================================
            // ERREUR
            // ==================================================

            const content =
                `❌ Une erreur est survenue pendant le rechargement.\n\`${error.message}\``;

            try {
                if (
                    interaction.deferred ||
                    interaction.replied
                ) {
                    return await interaction.editReply({
                        content
                    });
                }

                return await interaction.reply({
                    content,

                    flags:
                        MessageFlags.Ephemeral
                });

            } catch (replyError) {
                console.error(
                    "❌ Impossible d'envoyer l'erreur /update :",
                    replyError
                );
            }
        }
    }
};