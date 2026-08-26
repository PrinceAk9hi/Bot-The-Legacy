const {
    Events
} = require("discord.js");

const {
    MEMBER_ROLE_ID,
    loadState,
    updatePanel
} = require("../utils/candidaturePanel");

// ======================================================
// THE LEGACY — AUTO UPDATE CANDIDATURE PANEL
// ======================================================

module.exports =
function registerCandidaturePanelWatch(
    client
) {
    // ==================================================
    // READY
    // ==================================================

    client.once(
        Events.ClientReady,
        async () => {
            const state =
                loadState();

            if (
                !state.guildId ||
                !state.messageId
            ) {
                return;
            }

            const guild =
                client.guilds.cache.get(
                    state.guildId
                ) ||
                await client.guilds
                    .fetch(
                        state.guildId
                    )
                    .catch(
                        () => null
                    );

            if (
                !guild
            ) {
                return;
            }

            await updatePanel(
                guild
            ).catch(
                error => {
                    console.error(
                        "❌ Actualisation panel candidature au démarrage :",
                        error
                    );
                }
            );

            console.log(
                "📨 Panel candidature : ✅ actualisé"
            );
        }
    );

    // ==================================================
    // ROLE UPDATE
    // ==================================================

    client.on(
        Events.GuildMemberUpdate,
        async (
            oldMember,
            newMember
        ) => {
            const hadRole =
                oldMember.roles.cache.has(
                    MEMBER_ROLE_ID
                );

            const hasRole =
                newMember.roles.cache.has(
                    MEMBER_ROLE_ID
                );

            // Aucun changement concernant le rôle suivi.
            if (
                hadRole ===
                hasRole
            ) {
                return;
            }

            const state =
                loadState();

            if (
                state.guildId &&
                state.guildId !==
                    newMember.guild.id
            ) {
                return;
            }

            console.log(
                hasRole
                    ? `👤 ${newMember.user.tag} ajouté au compteur candidature`
                    : `👤 ${newMember.user.tag} retiré du compteur candidature`
            );

            await updatePanel(
                newMember.guild
            ).catch(
                error => {
                    console.error(
                        "❌ Actualisation compteur candidature :",
                        error
                    );
                }
            );
        }
    );
};