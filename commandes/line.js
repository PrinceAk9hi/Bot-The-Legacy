const {SlashCommandBuilder,MessageFlags}=require('discord.js');
const {OWNER_ID,setOff}=require('../utils/lineState');
const {IDENTITY}=require('../config/soulSociety');
module.exports={data:new SlashCommandBuilder().setName('line').setDescription('Activer ou mettre le bot en pause (Aven uniquement).').addStringOption(o=>o.setName('etat').setDescription('État du bot').setRequired(true).addChoices({name:'on',value:'on'},{name:'off',value:'off'})),
async execute(i){
 if(i.user.id!==OWNER_ID||i.guildId!==IDENTITY.guildId)return i.reply({content:'❌ Commande réservée à Aven.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 const off=i.options.getString('etat',true)==='off';setOff(off);
 i.client.user.setPresence({status:off?'idle':'online',activities:[{name:off?'En pause • /line on':'La Soul Society',type:0}]});
 try{await require('./maintenance').maintenanceSystem.refreshMaintenancePanel(i.guild);}
 catch(e){return i.editReply({content:'État enregistré : '+(off?'OFF':'ON')+'. Le panel n’a pas pu être actualisé ; vérifier les permissions du salon.'});}
 return i.editReply({content:off?'🔴 Bot en pause. /line on reste disponible uniquement pour toi.':'🟢 Bot réactivé.'});
}};
