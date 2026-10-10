const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasBypass, isProtectedUser } = require('../utils/security');
const { IDENTITY } = require('../config/soulSociety');
module.exports = {
 data: new SlashCommandBuilder().setName('recuperer').setDescription('Transférer un ancien compte vers un nouveau Membre Test')
  .addStringOption(o=>o.setName('ancien').setDescription('ID de l’ancien compte Discord').setRequired(true))
  .addUserOption(o=>o.setName('nouveau').setDescription('Nouveau compte présent sur le serveur').setRequired(true)),
 async execute(i) {
  if(i.guildId!==IDENTITY.guildId || !hasBypass(i)) return i.reply({content:'❌ Commande réservée à la direction et aux bypass.'});
  const oldId=i.options.getString('ancien').replace(/^<@!?|>$/g,''), user=i.options.getUser('nouveau');
  if(!/^\d{17,20}$/.test(oldId)||oldId===user.id||user.bot) return i.reply({content:'❌ Indique deux comptes distincts : ancien ID, puis nouveau membre humain.'});
  if(i.user.id!=='547192186547077130' && [oldId,user.id].some(id=>isProtectedUser(id))) return i.reply({content:'❌ Un des comptes est protégé.'});
  await i.deferReply();
  try {
   const result=await require('../utils/accountRecovery').recover(i.guild,oldId,user.id,i.user.id);
   return i.editReply({embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('🔄 Compte rétabli')
    .setDescription(`<@${user.id}> reprend en **Membre Test**.\nAncien compte : ${oldId}.\n\n**Nouvelle vérification obligatoire : tape =bienvenue pour renseigner à nouveau ton compte Roblox et vérifier ton adhésion.**\nAucun message de bienvenue n’a été envoyé.${result.already?'\nCe transfert avait déjà été effectué.':''}`)],allowedMentions:{parse:[],users:[user.id]}});
  } catch(e) { return i.editReply({content:'❌ '+e.message+'\nSi une étape a échoué, relance la même commande pour reprendre le transfert.',allowedMentions:{parse:[]}}); }
 }
};
