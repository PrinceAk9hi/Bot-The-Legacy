const {SlashCommandBuilder}=require('discord.js');
module.exports=function(name){const data=new SlashCommandBuilder().setName(name).setDescription('Casino de La Soul Society • Yens virtuels');
 if(['slots','roulette','blackjack','mines'].includes(name)){data.addIntegerOption(o=>o.setName('mise').setDescription('Mise en Yens fictifs').setMinValue(10).setMaxValue(10000));if(name==='roulette')data.addStringOption(o=>o.setName('pari').setDescription('rouge, noir, pair, impair ou numéro 0 à 36'));}
 return {data,async execute(i){return require('../systems/casino').launch(i,name);}};
};
