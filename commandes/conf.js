const {SlashCommandBuilder}=require('discord.js');
const {hasBypass}=require('../utils/security');
const {IDENTITY}=require('../config/soulSociety');
module.exports={data:new SlashCommandBuilder().setName('conf').setDescription('Configurer une conférence, ses notes et ses changements de grades'),
 async execute(i){if(i.guildId!==IDENTITY.guildId||!hasBypass(i))return i.reply('❌ Accès réservé à la fondation et aux bypass.');return i.reply(require('../systems/conferences').home(i));}};
