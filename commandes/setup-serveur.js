const { SlashCommandBuilder } = require('discord.js');
const school = require('../systems/qgSchoolSetup');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serveur')
    .setDescription('Prévisualiser, installer ou diagnostiquer la structure SchoolRP du QG')
    .addSubcommand(s => s.setName('noms-categories').setDescription('Format emoji〃NOM, en conservant les emojis existants'))
    .addSubcommand(s => s.setName('apercu').setDescription('Voir les rôles, catégories et salons manquants avant installation'))
    .addSubcommand(s => s.setName('installer').setDescription('Préparer l’installation idempotente avec confirmation'))
    .addSubcommand(s => s.setName('reparer').setDescription('Préparer la réparation des éléments manquants avec confirmation'))
    .addSubcommand(s => s.setName('mise-a-jour').setDescription('Actualiser les panneaux et compléter les vocaux sans modifier les rôles'))
    .addSubcommand(s => s.setName('synchroniser-separateurs').setDescription('Recalculer les rôles séparateurs des membres existants'))
    .addSubcommand(s => s.setName('diagnostic').setDescription('Vérifier les permissions et l’état de la structure')),
  async execute(interaction) {
    if(interaction.options.getSubcommand()==='noms-categories')return require('../systems/qgCategoryNames').execute(interaction);
    return school.execute(interaction);
  }
};
