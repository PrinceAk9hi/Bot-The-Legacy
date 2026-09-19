const {SlashCommandBuilder,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,escapeMarkdown}=require('discord.js');const {allowed}=require('../utils/memberCare');const {COLORS}=require('../config/soulSociety');const {update}=require('../utils/recruitmentData');
module.exports={data:new SlashCommandBuilder().setName('convocation').setDescription('Convoquer un membre de la famille')
.addUserOption(o=>o.setName('membre').setDescription('Membre à convoquer').setRequired(true))
.addStringOption(o=>o.setName('motif').setDescription('Motif visible dans le salon de convocation').setRequired(true).setMaxLength(900))
.addStringOption(o=>o.setName('creneau').setDescription('Date et heure proposées, ou disponibilités à demander').setMaxLength(200)),
async execute(i){if(!allowed(i,true))return i.reply({content:'❌ Accès réservé au recrutement et à la direction.',flags:MessageFlags.Ephemeral});await i.deferReply({flags:MessageFlags.Ephemeral});const user=i.options.getUser('membre',true);const member=await i.guild.members.fetch(user.id).catch(()=>null);if(!member||user.bot)return i.editReply('❌ Choisis un membre humain présent sur le serveur.');
const record={userId:user.id,authorId:i.user.id,guildId:i.guildId,reason:i.options.getString('motif').trim(),slot:i.options.getString('creneau')?.trim()||'Merci de proposer tes disponibilités dans ce salon.',createdAt:Date.now(),confirmedAt:null};if(!record.reason)return i.editReply('❌ Renseigne un motif.');
try{const c=await i.guild.channels.fetch('1540832578964164648');if(!c?.isTextBased()||c.guildId!==i.guildId)throw Error('channel');
const m=await c.send({content:`<@${user.id}>`,allowedMentions:{parse:[],users:[user.id]},embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📨 Convocation • La Soul Society').setDescription(`Demandée par <@${i.user.id}>`)
.addFields({name:'Motif',value:escapeMarkdown(record.reason)},{name:'Créneau / disponibilités',value:escapeMarkdown(record.slot)},{name:'Réponse',value:'En attente de confirmation du membre.'}).setTimestamp()]});
update('memberConvocations',all=>{all[m.id]={...record,messageId:m.id,channelId:c.id};});await m.edit({components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('membercare_confirm:'+m.id).setLabel('Confirmer ma présence').setEmoji('✅').setStyle(ButtonStyle.Success))]});return i.editReply(`✅ Convocation publiée dans <#${c.id}>.`);
}catch{return i.editReply('❌ Publication ou sauvegarde incomplète. Vérifie le salon des convocations avant de réessayer.');}}
};
