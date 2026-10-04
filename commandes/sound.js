const {SlashCommandBuilder,MessageFlags,escapeMarkdown}=require('discord.js');
const catalog=require('../utils/soundCatalog');
module.exports={data:new SlashCommandBuilder().setName('sound').setDescription('Jouer un son complet dans ton salon vocal.').addStringOption(o=>o.setName('son').setDescription('Rechercher un son disponible').setRequired(true).setAutocomplete(true)),
 async autocomplete(i){try{await i.respond(await catalog.choices(i.options.getFocused()));}catch{await i.respond([]).catch(()=>{});}},
 async execute(i){await i.deferReply({flags:MessageFlags.Ephemeral});try{const board=require('../systems/soundboard')(i.client);const result=await board.enqueue(i,i.options.getString('son'));let panelWarning='';try{await board.showPanel(i);}catch{panelWarning='\n⚠️ Impossible de publier le panneau : vérifie mes permissions dans ce salon.';}return i.editReply({content:(result.queued?`📃 **Ajouté à la file**\n${escapeMarkdown(result.name)} sera joué prochainement.`:`✅ **Son lancé**\n🔊 Lecture de : ${escapeMarkdown(result.name)}`)+panelWarning,allowedMentions:{parse:[]}});}catch(e){return i.editReply({content:'❌ '+e.message,allowedMentions:{parse:[]}});}}
};
