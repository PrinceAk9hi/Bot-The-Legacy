const {SlashCommandBuilder,EmbedBuilder,MessageFlags,escapeMarkdown}=require('discord.js');
const {allowed,date}=require('../utils/memberCare');const {COLORS}=require('../config/soulSociety');const {update}=require('../utils/recruitmentData');
module.exports={data:new SlashCommandBuilder().setName('absence').setDescription('Déclarer une absence à la famille')
.addStringOption(o=>o.setName('debut').setDescription('Premier jour absent : JJ/MM/AAAA').setRequired(true))
.addStringOption(o=>o.setName('fin').setDescription('Dernier jour absent inclus : JJ/MM/AAAA').setRequired(true))
.addStringOption(o=>o.setName('raison').setDescription('Motif visible dans le salon des absences').setMaxLength(900).setRequired(true)),
async execute(i){if(!allowed(i))return i.reply({content:'❌ Commande réservée aux membres de la famille.',flags:MessageFlags.Ephemeral});await i.deferReply({flags:MessageFlags.Ephemeral});
const start=date(i.options.getString('debut')),end=date(i.options.getString('fin')),reason=i.options.getString('raison').trim();
if(start===null||end===null||end<start||end+86400000<=Date.now()||!reason)return i.editReply('❌ Vérifie les dates JJ/MM/AAAA : la fin doit être après le début et ne pas être passée.');
const record={userId:i.user.id,start,end,reason,createdAt:Date.now(),guildId:i.guildId};
try{const c=await i.guild.channels.fetch('1479835698793156833');if(!c?.isTextBased()||c.guildId!==i.guildId)throw Error('channel');
const m=await c.send({allowedMentions:{parse:[]},embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📅 Absence déclarée • La Soul Society').setDescription(`<@${i.user.id}>`)
.addFields({name:'Du',value:i.options.getString('debut'),inline:true},{name:'Au (inclus)',value:i.options.getString('fin'),inline:true},{name:'Motif',value:escapeMarkdown(reason)}).setFooter({text:'Déclaration d’absence — ne vaut pas validation de la gestion'}).setTimestamp()]});
update('memberAbsences',all=>{all[m.id]={...record,messageId:m.id,channelId:c.id};});return i.editReply(`✅ Absence enregistrée dans <#${c.id}>.`);
}catch{return i.editReply('❌ La publication ou la sauvegarde a échoué. Vérifie le salon des absences avant de réessayer.');}}
};
