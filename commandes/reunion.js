const {SlashCommandBuilder,MessageFlags}=require('discord.js');
const {hasBypass}=require('../utils/security');const {IDENTITY}=require('../config/soulSociety');const {parseParis}=require('../utils/convocationTime');const meeting=require('../utils/familyMeetings');
module.exports={data:new SlashCommandBuilder().setName('reunion').setDescription('Organiser une réunion de la famille')
 .addSubcommand(s=>s.setName('creer').setDescription('Créer l’événement et annoncer la réunion')
 .addStringOption(o=>o.setName('titre').setDescription('Titre de la réunion').setRequired(true).setMaxLength(100))
 .addStringOption(o=>o.setName('date').setDescription('JJ/MM/AAAA HH:MM — heure de Paris').setRequired(true).setMaxLength(16))
 .addIntegerOption(o=>o.setName('duree').setDescription('Durée prévue en minutes (60 par défaut)').setMinValue(15).setMaxValue(1440))
 .addStringOption(o=>o.setName('description').setDescription('Ordre du jour').setMaxLength(1000)))
 .addSubcommand(s=>s.setName('annuler').setDescription('Annuler une réunion et ses rappels').addStringOption(o=>o.setName('evenement').setDescription('ID de l’événement Discord').setRequired(true))),
 async execute(i){if(i.guildId!==IDENTITY.guildId||!hasBypass(i))return i.reply({content:'❌ Accès réservé à la fondation et aux bypass.',flags:MessageFlags.Ephemeral});await i.deferReply({flags:MessageFlags.Ephemeral});
 try{if(i.options.getSubcommand()==='annuler'){await meeting.cancel(i.guild,i.options.getString('evenement'));return i.editReply('✅ Réunion annulée.');}
 const start=parseParis(i.options.getString('date'));if(!start||start<=Date.now()+1800000)return i.editReply('❌ Indique une date valide, heure de Paris, à plus de 30 minutes pour permettre le rappel.');
 const result=await meeting.create(i.guild,{start,name:i.options.getString('titre'),description:i.options.getString('description'),duration:i.options.getInteger('duree')||60,authorId:i.user.id});
 return i.editReply(`✅ Événement créé : https://discord.com/events/${i.guildId}/${result.id}\n${result.announcement?'Annonce publiée dans <#1479760394300948531>.':'⚠️ Annonce non publiée : vérifie les permissions de ce salon. L’événement existe déjà, ne le recrée pas.'}`);
 }catch(e){return i.editReply('❌ '+e.message);}}
};
