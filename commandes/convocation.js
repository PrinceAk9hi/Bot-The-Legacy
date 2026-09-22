const {SlashCommandBuilder,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,escapeMarkdown}=require('discord.js');
const {allowed}=require('../utils/memberCare');const {COLORS}=require('../config/soulSociety');const {update}=require('../utils/recruitmentData');const {parseParis}=require('../utils/convocationTime');
module.exports={data:new SlashCommandBuilder().setName('convocation').setDescription('Convoquer un membre de la famille')
.addUserOption(o=>o.setName('membre').setDescription('Membre à convoquer').setRequired(true))
.addStringOption(o=>o.setName('date').setDescription('JJ/MM/AAAA HH:MM — heure de Paris').setRequired(true).setMaxLength(16))
.addStringOption(o=>o.setName('raison').setDescription('Raison visible, facultative').setMaxLength(900)),
async execute(i){
 if(!allowed(i,true))return i.reply({content:'❌ Accès réservé au recrutement et à la direction.',flags:MessageFlags.Ephemeral});
 const scheduledAt=parseParis(i.options.getString('date',true));if(!scheduledAt||scheduledAt<=Date.now())return i.reply({content:'❌ Indique une date future au format JJ/MM/AAAA HH:MM, heure de Paris. Une heure inexistante ou ambiguë lors du changement d’heure doit être remplacée.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});const user=i.options.getUser('membre',true);const member=await i.guild.members.fetch(user.id).catch(()=>null);if(!member||user.bot)return i.editReply('❌ Choisis un membre humain présent sur le serveur.');
 const record={userId:user.id,authorId:i.user.id,guildId:i.guildId,reason:i.options.getString('raison')?.trim()||'Révélé lors de la convocation.',slot:i.options.getString('date'),scheduledAt,createdAt:Date.now(),confirmedAt:null};
 try{const c=await i.guild.channels.fetch('1540832578964164648');if(!c?.isTextBased()||c.guildId!==i.guildId)throw Error('channel');
 const m=await c.send({content:'<@'+user.id+'>',allowedMentions:{parse:[],users:[user.id]},embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📨 Convocation • La Soul Society').setDescription('Demandée par <@'+i.user.id+'>')
 .addFields({name:'Raison',value:escapeMarkdown(record.reason)},{name:'Rendez-vous',value:'<t:'+Math.floor(scheduledAt/1000)+':F> (heure de Paris)'},{name:'Réponse',value:'En attente de confirmation du membre.'}).setTimestamp()]});
 update('memberConvocations',all=>{all[m.id]={...record,messageId:m.id,channelId:c.id};});await m.edit({components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('membercare_confirm:'+m.id).setLabel('Confirmer ma présence').setEmoji('✅').setStyle(ButtonStyle.Success))]});
 return i.editReply('✅ Convocation publiée dans <#'+c.id+'>.');
 }catch{return i.editReply('❌ Publication ou sauvegarde incomplète. Vérifie le salon des convocations avant de réessayer.');}
}};
