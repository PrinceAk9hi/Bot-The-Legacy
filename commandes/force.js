const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { hasBypass } = require('../utils/security');
const { IDENTITY } = require('../config/soulSociety');
const { release } = require('../utils/forceRelease');

module.exports = {
    data: new SlashCommandBuilder().setName('force').setDescription('Libérer de force les contrôles vocaux du bot')
        .addStringOption(o => o.setName('action').setDescription('Contrôle à enlever pour tous, ou pour un membre')
            .setRequired(true).addChoices(
                { name: 'Enlever les laisses', value: 'uch' },
                { name: 'Enlever les menottes (y compris test)', value: 'unmenotte' },
                { name: 'Enlever tous les contrôles vocaux', value: 'all' }))
        .addUserOption(o => o.setName('membre').setDescription('Facultatif : limiter la libération à ce membre')),
    async execute(i) {
        if (i.guildId !== IDENTITY.guildId || !hasBypass(i)) {
            return i.reply({ content: '❌ Commande réservée à Aven, aux bypass et à la fondation.', flags: MessageFlags.Ephemeral });
        }
        const action = i.options.getString('action', true);
        if (!['uch', 'unmenotte', 'all'].includes(action)) return i.reply({ content: 'Choisis uch, unmenotte ou all.' });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const user = i.options.getUser('membre');
        const result = release(i.client, i.guildId, action, user?.id);
        return i.editReply({
            content: `🔓 Libération forcée ${user ? `de <@${user.id}>` : 'de tous les membres de ce serveur'}.\n` +
                `Laisses supprimées : **${result.leashes}**\nMenottes supprimées : **${result.cuffs}**\nVerrous de test supprimés : **${result.tests}**\n` +
                (result.saved ? '✅ États enregistrés. Les membres peuvent changer de vocal, selon les permissions de leurs rôles.' : '⚠️ Libération effectuée en mémoire, mais sauvegarde échouée : les contrôles peuvent revenir au redémarrage.'),
            allowedMentions: { parse: [] }
        });
    }
};
