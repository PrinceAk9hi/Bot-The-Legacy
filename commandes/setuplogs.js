const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
module.exports={
 data:new SlashCommandBuilder().setName('setuplogs').setDescription('Afficher l’état du journal central sans créer de salons').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 async execute(i){
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const logs=i.client.logs;if(!logs)return i.editReply('Le module de logs central n’est pas chargé.');
  const cfg=logs.getConfig(i.guildId);
  const lines=logs.categoryList.map(({key,label})=>{const c=cfg.categories[key];return `${c.enabled===false?'⏸️':'✅'} **${label}** : ${c.channelId?`<#${c.channelId}>`:'non configuré'}`;});
  return i.editReply(`Ce module ne crée plus de catégorie ni de salon et ne supprime aucun historique. Configure les destinations avec **/logs salon**.\n\n${lines.join('\n')}`);
 }
};
