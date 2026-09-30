const {SlashCommandBuilder,PermissionFlagsBits,MessageFlags}=require('discord.js');
const {canUseCommand}=require('../utils/security');
const {IDENTITY}=require('../config/soulSociety');
const busy=new Set();
module.exports={
 data:new SlashCommandBuilder().setName('clear').setDescription('Supprimer les derniers messages du salon.').addIntegerOption(o=>o.setName('nombre').setDescription('Nombre de messages à supprimer (1 à 100)').setMinValue(1).setMaxValue(100).setRequired(true)),
 async execute(i){
  if(i.guildId!==IDENTITY.guildId||!canUseCommand(i,'clear'))return i.reply({content:'❌ Tu n’as pas accès à cette commande.',flags:MessageFlags.Ephemeral});
  const count=i.options.getInteger('nombre');
  if(!Number.isInteger(count)||count<1||count>100)return i.reply({content:'Utilise =clear avec un nombre de 1 à 100.'});
  const channel=i.channel;
  if(!channel?.bulkDelete)return i.reply({content:'Ce salon ne permet pas ce nettoyage.'});
  const me=i.guild.members.me||await i.guild.members.fetchMe();
  if(!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages]))return i.reply({content:'Il me faut les permissions Voir le salon, Voir les anciens messages et Gérer les messages.'});
  if(busy.has(channel.id))return i.reply({content:'Un nettoyage est déjà en cours dans ce salon.'});
  busy.add(channel.id);
  try{
   await i.deferReply();
   // Only messages before the command: never delete the command response or newer messages.
   const messages=await channel.messages.fetch({limit:count,before:i.id});
   const cutoff=Date.now()-14*86400000+60000;
   const recent=messages.filter(m=>m.createdTimestamp>cutoff);
   if(!recent.size)return i.editReply({content:'Aucun message récent à supprimer. Les messages de plus de 14 jours sont conservés.'});
   const deleted=await channel.bulkDelete(recent,true);
   const skipped=messages.size-recent.size;
   return i.editReply({content:`✅ ${deleted.size} message(s) supprimé(s).${skipped?' '+skipped+' message(s) ancien(s) conservé(s).':''}`});
  }catch(e){console.error('Nettoyage =clear :',e.code||e.message);return i.editReply({content:'❌ Le nettoyage n’a pas pu être terminé. Vérifie les permissions du bot.'});}
  finally{busy.delete(channel.id);}
 }
};
