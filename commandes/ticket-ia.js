const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { IDENTITY, COLORS } = require('../config/soulSociety');
const { PrefixError } = require('../utils/prefixOptions');
const knowledge = require('../utils/ticketAiKnowledge');

const data = new SlashCommandBuilder().setName('ticket-ia').setDescription('Gérer les connaissances et réponses de l’assistant tickets')
    .addSubcommand(s => s.setName('ajouter').setDescription('Ajouter une information à la base de connaissances')
        .addStringOption(o => o.setName('titre').setDescription('Sujet de l’information').setRequired(true).setMaxLength(100))
        .addStringOption(o => o.setName('contenu').setDescription('Information fiable à retenir').setRequired(true).setMaxLength(1800))
        .addStringOption(o => o.setName('mots_cles').setDescription('Mots-clés facultatifs, séparés par des virgules').setMaxLength(200)))
    .addSubcommand(s => s.setName('corriger').setDescription('Corriger une réponse signalée et enrichir la base')
        .addStringOption(o => o.setName('reference').setDescription('Référence affichée après le signalement').setRequired(true).setMaxLength(20))
        .addStringOption(o => o.setName('correction').setDescription('Réponse/fait fiable à utiliser à l’avenir').setRequired(true).setMaxLength(1800)))
    .addSubcommand(s => s.setName('signaler').setDescription('Signaler une réponse incorrecte ou une lacune')
        .addStringOption(o => o.setName('question').setDescription('Question concernée ou référence de réponse').setRequired(true).setMaxLength(500))
        .addStringOption(o => o.setName('details').setDescription('Pourquoi la réponse est incorrecte ou ce qui manque').setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s.setName('stats').setDescription('Afficher les retours et lacunes de l’assistant'));

module.exports = {
    data,
    async execute(interaction) {
        if (interaction.guildId !== IDENTITY.guildId) throw new PrefixError('Cette commande est réservée au serveur Soul Society.');
        const action = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (action === 'ajouter') {
            const tags = (interaction.options.getString('mots_cles') || '').split(',').map(item => item.trim()).filter(Boolean);
            const entry = knowledge.add(interaction.options.getString('titre'), interaction.options.getString('contenu'), { tags, createdBy: interaction.user.id });
            return interaction.editReply(`✅ Information ajoutée à la base. Référence : \`${entry.id}\`.`);
        }
        if (action === 'corriger') {
            const id = interaction.options.getString('reference').trim();
            const issue = require('../utils/recruitmentData').read('ticketAiIssues')[id];
            if (!issue) return interaction.editReply('❌ Référence de signalement introuvable.');
            const correction = interaction.options.getString('correction').trim();
            const entry = knowledge.add(`Correction : ${issue.question.slice(0, 80)}`, correction, { tags: issue.tags || [], createdBy: interaction.user.id, source: `correction:${id}` });
            knowledge.updateIssue(id, item => { item.resolvedAt = Date.now(); item.resolvedBy = interaction.user.id; item.correctionId = entry.id; });
            if (issue.answerId) knowledge.updateAnswer(issue.answerId, item => { item.feedback = 'corrected'; item.correctionId = entry.id; });
            return interaction.editReply(`✅ Réponse corrigée et ajoutée à la base (\`${entry.id}\`).`);
        }
        if (action === 'signaler') {
            const refOrQuestion = interaction.options.getString('question').trim();
            const existingIssue = require('../utils/recruitmentData').read('ticketAiIssues')[refOrQuestion];
            if (existingIssue) {
                knowledge.updateIssue(refOrQuestion, item => { item.staffNote = interaction.options.getString('details').trim(); item.staffReporter = interaction.user.id; item.staffReportedAt = Date.now(); });
                return interaction.editReply(`✅ Note du staff ajoutée au signalement \`${refOrQuestion}\`.`);
            }
            const answer = knowledge.getAnswer(refOrQuestion);
            const issue = { id: `gap-${require('node:crypto').randomUUID().slice(0, 8)}`, question: answer?.question || refOrQuestion, answerId: answer?.id || null, answer: answer?.answer || null, channelId: answer?.channelId || interaction.channelId, details: interaction.options.getString('details').trim(), createdAt: Date.now(), reportedBy: interaction.user.id, resolvedAt: null };
            knowledge.recordIssue(issue);
            return interaction.editReply(`✅ Signalement enregistré. Référence : \`${issue.id}\`.`);
        }
        const counts = knowledge.stats();
        const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('📊 Qualité de l’assistant tickets').addFields(
            { name: 'Base de connaissances', value: String(counts.knowledge), inline: true },
            { name: 'Réponses suivies', value: String(counts.answers), inline: true },
            { name: '👍 / 👎', value: `${counts.helpful} / ${counts.negative}`, inline: true },
            { name: 'Lacunes ouvertes', value: String(counts.gaps), inline: true },
            { name: 'Lacunes corrigées', value: String(counts.resolved), inline: true }
        ).setFooter({ text: 'Commande réservée à la gestion des tickets' });
        return interaction.editReply({ embeds: [embed] });
    }
};
