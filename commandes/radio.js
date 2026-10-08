const {SlashCommandBuilder}=require('discord.js');
module.exports={data:new SlashCommandBuilder().setName('radio').setDescription('Diffuser une annonce vocale de la fondation'),execute:i=>require('../systems/radioPanel').show(i)};
