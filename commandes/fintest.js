const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const {
    getVoiceConnection
} = require("@discordjs/voice");

const {
    RANK_ALLOWED_ROLES
} = require("../config/ranks");

const TEST_GROUP =
    "legacy-test-follow";

function hasPermission(
    member
) {
    return RANK_ALLOWED_ROLES.some(
        roleId =>
            member.roles.cache.has(
                roleId
            )
    );
}

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName("fintest")
            .setDescription(
                "Arrêter le test vocal en cours"
            ),

    async execute(
        interaction
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        if (
            !hasPermission(
                interaction.member
            )
        ) {
            return interaction.editReply({
                content:
                    "❌ Tu n'as pas la permission d'utiliser `/fintest`."
            });
        }

        const client =
            interaction.client;

        const guild =
            interaction.guild;

        const session =
            client.testVoiceSessions
                ?.get(
                    guild.id
                );

        if (!session) {
            return interaction.editReply({
                content:
                    "⚠️ Aucun test n'est en cours."
            });
        }

        session.ended =
            true;

        session.waitingForTarget =
            false;

        if (
            session.player
        ) {
            try {
                session.player.stop(
                    true
                );
            } catch {}
        }

        if (
            session.connection
        ) {
            try {
                session.connection.destroy();
            } catch {}
        }

        const connection =
            getVoiceConnection(
                guild.id,
                TEST_GROUP
            );

        if (connection) {
            try {
                connection.destroy();
            } catch {}
        }

        client.testVoiceSessions.delete(
            guild.id
        );

        return interaction.editReply({
            content:
                [
                    "🛑 **Test terminé.**",
                    "",
                    "🔊 Speech arrêté.",
                    "👋 Bot déconnecté.",
                    "👣 Suivi arrêté.",
                    session.testMenotte
                        ? "🔓 Menotte spéciale du test retirée."
                        : "🔓 Aucune menotte test active."
                ].join(
                    "\n"
                )
        });
    }
};