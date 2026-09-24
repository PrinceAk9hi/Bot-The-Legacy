const {SlashCommandBuilder,MessageFlags}=require('discord.js');
const {allowed,date}=require('../utils/memberCare');
const absence=require('../utils/memberAbsence');
module.exports={data:new SlashCommandBuilder().setName('absence').setDescription('Afficher le panel des absences ou déclarer une période')
 .addStringOption(o=>o.setName('debut').setDescription('Ancien format : premier jour JJ/MM/AAAA'))
 .addStringOption(o=>o.setName('fin').setDescription('Ancien format : dernier jour inclus JJ/MM/AAAA'))
 .addStringOption(o=>o.setName('raison').setDescription('Motif facultatif').setMaxLength(900)),
 async execute(i){
  if(!allowed(i))return i.reply({content:'❌ Commande réservée aux membres de la famille.',flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  try{
   const first=i.options.getString('debut'),last=i.options.getString('fin');
   if(first||last){const start=date(first),finish=date(last);if(start===null||finish===null)throw Error('Indique les deux dates au format JJ/MM/AAAA, ou utilise =absence sans paramètre.');
    return i.editReply(await absence.declare(i.guild,i.user.id,Math.max(Date.now(),start),finish+absence.DAY,i.options.getString('raison')||''));}
   const panel=await absence.publish(i.client);
   return i.editReply(`📅 Choisis **Moins de 24h**, **3 jours**, **1 semaine** ou **Personnalisé** dans le panel : https://discord.com/channels/${i.guildId}/${absence.CHANNEL}/${panel.id}`);
  }catch(e){return i.editReply('❌ '+e.message);}
 }};
