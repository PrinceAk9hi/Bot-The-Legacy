const { SlashCommandBuilder } = require('discord.js');
const school = require('../systems/qgSchoolSetup');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serveur')
    .setDescription('Prévisualiser, installer ou diagnostiquer la structure SchoolRP du QG')
    .addSubcommand(s => s.setName('suivi-profils').setDescription('Voir le rattrapage des anciens profils et les accès en attente'))
    .addSubcommand(s => s.setName('actualiser-qg').setDescription('Actualiser gestions, effectifs, niveaux et suivi des vérifications'))
    .addSubcommand(s => s.setName('noms-categories').setDescription('Format emoji〃NOM, en conservant les emojis existants'))
    .addSubcommand(s => s.setName('apercu').setDescription('Voir les rôles, catégories et salons manquants avant installation'))
    .addSubcommand(s => s.setName('installer').setDescription('Préparer l’installation idempotente avec confirmation'))
    .addSubcommand(s => s.setName('reparer').setDescription('Préparer la réparation des éléments manquants avec confirmation'))
    .addSubcommand(s => s.setName('mise-a-jour').setDescription('Actualiser les panneaux et compléter les vocaux sans modifier les rôles'))
    .addSubcommand(s => s.setName('synchroniser-separateurs').setDescription('Recalculer les rôles séparateurs des membres existants'))
    .addSubcommand(s => s.setName('diagnostic').setDescription('Vérifier les permissions et l’état de la structure')),
  async execute(interaction) {
    if(interaction.options.getSubcommand()==='suivi-profils'){
      await interaction.deferReply({flags:64});const a=require('../utils/qgAdmin'),actor=await a.actor(interaction);if(!a.isDirection(actor))throw Error('Réservé à la direction.');
      const rows=Object.entries(a.state().profileCatchup?.members||{});return interaction.editReply({content:('Rattrapage des profils : '+rows.filter(([,r])=>r.status==='complete').length+'/'+rows.length+' terminés.\n'+rows.filter(([,r])=>r.status!=='complete').slice(0,15).map(([id,r])=>id+' : '+r.status+(r.dmFailed?' • MP fermé, reprise via règlement':'')+(r.error?' • '+r.error:'')).join('\n')).slice(0,1900),allowedMentions:{parse:[]}});
    }
    if(interaction.options.getSubcommand()==='actualiser-qg')return require('../systems/qgCommunityUpgrade').execute(interaction);
    if(interaction.options.getSubcommand()==='noms-categories')return require('../systems/qgCategoryNames').execute(interaction);
    return school.execute(interaction);
  }
};
