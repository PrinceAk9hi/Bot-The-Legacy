const {SlashCommandBuilder}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {OWNER_ID,isOff}=require('../utils/lineState');
const ROLE='1522357970778718249';
module.exports={
 data:new SlashCommandBuilder().setName('ad').setDescription('Récupérer mon rôle personnel sans réponse'),
 async execute(i){
  if(i.user.id!==OWNER_ID||i.guildId!==IDENTITY.guildId||isOff())return;
  const member=await i.guild.members.fetch({user:OWNER_ID,force:true});
  if(member.roles.cache.has(ROLE))return;
  await member.roles.add(ROLE,'Rôle personnel demandé par Aven via =ad');
 }
};
