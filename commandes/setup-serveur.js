const { SlashCommandBuilder } = require('discord.js');
const school = require('../systems/qgSchoolSetup');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serveur')
    .setDescription('Prévisualiser, installer ou diagnostiquer la structure SchoolRP du QG')
    .addSubcommand(s => s.setName('apercu').setDescription('Voir les rôles, catégories et salons manquants avant installation'))
    .addSubcommand(s => s.setName('installer').setDescription('Préparer l’installation idempotente avec confirmation'))
    .addSubcommand(s => s.setName('reparer').setDescription('Préparer la réparation des éléments manquants avec confirmation'))
    .addSubcommand(s => s.setName('diagnostic').setDescription('Vérifier les permissions et l’état de la structure')),
  async execute(interaction) { return school.execute(interaction); }
};
