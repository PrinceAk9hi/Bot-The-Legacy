const {SlashCommandBuilder,MessageFlags}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {hasBypass}=require('../utils/security');
module.exports={data:new SlashCommandBuilder().setName('setuptickets').setDescription('Installer ou actualiser le panel de tickets de La Soul Society'),
 async execute(i){
  if(i.guildId!==IDENTITY.guildId||!hasBypass(i))return i.reply({content:'❌ Installation réservée à la fondation et aux bypass.',flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  try{const m=await require('../utils/ticketPanel').install(i.client);return i.editReply({content:`✅ Panel de tickets actualisé : ${m.url}`});}
  catch(e){return i.editReply({content:'❌ Impossible d’installer le panel : '+e.message});}
 }};
