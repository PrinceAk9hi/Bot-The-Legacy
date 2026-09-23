const {SlashCommandBuilder,MessageFlags}=require('discord.js');const {hasBypass}=require('../utils/security');const {IDENTITY}=require('../config/soulSociety');const weekly=require('../utils/familyWeekly');
module.exports={data:new SlashCommandBuilder().setName('bilan-semaine').setDescription('Publier le bilan des sept derniers jours dans le salon fondation'),
 async execute(i){if(i.guildId!==IDENTITY.guildId||!hasBypass(i))return i.reply({content:'❌ Accès réservé à la fondation et aux bypass.',flags:MessageFlags.Ephemeral});await i.deferReply({flags:MessageFlags.Ephemeral});
 try{await weekly.publish(i.guild);return i.editReply('✅ Bilan publié dans <#'+weekly.CHANNEL+'>.');}catch{return i.editReply('❌ Publication impossible. Vérifie le salon du bilan et les permissions du bot.');}}
};
