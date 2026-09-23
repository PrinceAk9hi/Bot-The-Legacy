const {SlashCommandBuilder,MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const {allowed}=require('../utils/memberCare');
const {read,update}=require('../utils/recruitmentData');
const {birthDate}=require('../utils/familyCalendar');
const {profiles}=require('../utils/familyBirthdays');
module.exports={data:new SlashCommandBuilder().setName('anniversaire').setDescription('Consulter ou modifier mon anniversaire et son rôle')
 .addBooleanOption(o=>o.setName('activer').setDescription('Recevoir le rôle le jour de mon anniversaire')),
 async execute(i){if(!allowed(i))return i.reply({content:'❌ Commande réservée aux membres de la famille.',flags:MessageFlags.Ephemeral});
 const enabled=i.options.getBoolean('activer');
 const found=profiles()[i.user.id];if(!found)return i.reply({content:'Commence par /bienvenue pour créer ton profil.',flags:MessageFlags.Ephemeral});
 if(enabled!==null)update('birthdayPreferences',all=>{all[i.user.id]={...all[i.user.id],enabled,updatedAt:Date.now()};});
 return i.reply({...require('../utils/birthdayConsent').payload(i.user.id,found.profile.birthDate,read('birthdayPreferences')[i.user.id],true),flags:MessageFlags.Ephemeral});
 }};
