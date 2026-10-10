const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasBypass, isProtectedUser } = require('../utils/security');
const { IDENTITY } = require('../config/soulSociety');
module.exports = {
 data: new SlashCommandBuilder().setName('recuperer').setDescription('Transférer un ancien compte vers un nouveau Membre Test')
  .addStringOption(o=>o.setName('ancien').setDescription('ID de l’ancien compte Discord').setRequired(true))
  .addStringOption(o=>o.setName('nouveau').setDescription('ID du nouveau compte, même avant son arrivée').setRequired(true)),
 async execute(i) {
  if(i.guildId!==IDENTITY.guildId || !hasBypass(i)) return i.reply({content:'❌ Commande réservée à la direction et aux bypass.'});
  const oldId=i.options.getString('ancien').replace(/^<@!?|>$/g,''), user={id:i.options.getString('nouveau').replace(/^<@!?|>$/g,'')};
  if(!/^\d{17,20}$/.test(oldId)||!/^\d{17,20}$/.test(user.id)||oldId===user.id) return i.reply({content:'❌ Indique deux comptes distincts : ancien ID, puis nouveau membre humain.'});
  if(i.user.id!=='547192186547077130' && [oldId,user.id].some(id=>isProtectedUser(id))) return i.reply({content:'❌ Un des comptes est protégé.'});
  await i.deferReply();
  try {
   const result=await require('../utils/accountRecovery').recover(i.guild,oldId,user.id,i.user.id);
   if(result.pending) return i.editReply({content:`✅ Récupération préparée pour ${user.id}. Ce compte peut rejoindre pendant 7 jours malgré son âge Discord. Une fois arrivé, relance **=recuperer ${oldId} ${user.id}** pour transférer le profil et demander la nouvelle vérification.`,allowedMentions:{parse:[]}});
   return i.editReply({embeds:[new EmbedBuilder().setColor(0xffffff).setTitle('🔄 Compte rétabli')
    .setDescription(`<@${user.id}> reprend en **Membre Test**.\nAncien compte : ${oldId}.\n\n**Nouvelle vérification obligatoire : tape =bienvenue pour renseigner à nouveau ton compte Roblox et vérifier ton adhésion.**\nAucun message de bienvenue n’a été envoyé.${result.already?'\nCe transfert avait déjà été effectué.':''}`)],allowedMentions:{parse:[],users:[user.id]}});
  } catch(e) { return i.editReply({content:'❌ '+e.message+'\nSi une étape a échoué, relance la même commande pour reprendre le transfert.',allowedMentions:{parse:[]}}); }
 }
};
