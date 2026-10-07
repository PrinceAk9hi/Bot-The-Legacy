const {EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder}=require('discord.js');
const {COLORS,IDENTITY}=require('../config/soulSociety');
const config=require('../config/tickets');
const {ensurePanel}=require('./recruitmentData');
let running=null;
function payload(){return {embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('✉️ Assistance — La Soul Society')
 .setDescription('Besoin d’aide ou envie de nous contacter ? Choisis le sujet de ta demande dans le menu ci-dessous.\n\n'+Object.values(config.types).map(t=>`${t.emoji} **${t.label}**\n${t.description}`).join('\n\n')+'\n\nExplique clairement ta demande et joins les preuves utiles. Un seul ticket ouvert par type et par membre. Les échanges sont archivés à la fermeture.')
 .setFooter({text:'La Soul Society • Gestion Ticket & Gestion Requête'})],components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('soul_ticket_select').setPlaceholder('Choisir le type de ticket').addOptions(Object.entries(config.types).map(([value,t])=>({value,label:t.label,description:t.description,emoji:{name:t.emoji}}))))],allowedMentions:{parse:[]}};}
async function install(client){if(running)return running;running=(async()=>{
 const guild=client.guilds.cache.get(IDENTITY.guildId);if(!guild)throw Error('Serveur de la famille introuvable.');
 return ensurePanel(client,config.panelChannel,'soul_ticket_select',payload());
})();try{return await running;}finally{running=null;}}
module.exports={payload,install};
