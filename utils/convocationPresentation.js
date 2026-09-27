const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,escapeMarkdown}=require('discord.js');
const WAIT='1479868892569669773';
const RED=0xED4245;
function embed(r){
 const time=Math.floor(r.scheduledAt/1000);
 return new EmbedBuilder().setColor(RED)
  .setAuthor({name:'La Soul Society • Convocation',iconURL:'https://cdn.discordapp.com/emojis/1548783936010977380.png'})
  .setTitle('📨 Tu es convoqué à un entretien')
  .setDescription(`<@${r.userId}>, un échange avec l’équipe est prévu. Merci de **confirmer ta présence** et de rejoindre le salon d’attente à l’heure indiquée.\n\nSi tu es indisponible, contacte <@${r.authorId}> pour convenir d’un autre créneau.`)
  .addFields(
   {name:'👤 Membre convoqué',value:`<@${r.userId}>`,inline:true},
   {name:'🛡️ Auteur de la convocation',value:`<@${r.authorId}>`,inline:true},
   {name:'📅 Rendez-vous',value:`<t:${time}:F>\n<t:${time}:R> • Horaire saisi en heure de Paris`},
   {name:'📝 Motif',value:escapeMarkdown(r.reason||'Révélé lors de la convocation.')},
   {name:'🔊 Salon d’attente',value:`<#${WAIT}>\n[Rejoindre l’attente convocation](https://discord.com/channels/${r.guildId}/${WAIT})`},
   {name:'✅ Confirmation',value:r.confirmedAt?`Présence confirmée le <t:${Math.floor(r.confirmedAt/1000)}:f>.`:'En attente de ta réponse. Utilise le bouton ci-dessous.'}
  ).setFooter({text:'La Soul Society • Merci de respecter le rendez-vous.'}).setTimestamp(r.createdAt||Date.now());
}
function components(id,confirmed){return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('membercare_confirm:'+id).setLabel(confirmed?'Présence confirmée':'Confirmer ma présence').setEmoji('✅').setStyle(confirmed?ButtonStyle.Secondary:ButtonStyle.Success).setDisabled(Boolean(confirmed)))];}
function payload(r,id=r.messageId){return {embeds:[embed(r)],...(id?{components:components(id,r.confirmedAt)}:{}),allowedMentions:{parse:[]}};}
function arrival(r){return {content:`<@${r.authorId}>`,allowedMentions:{parse:[],users:[r.authorId]},embeds:[new EmbedBuilder().setColor(RED)
 .setAuthor({name:'La Soul Society • Suivi des convocations',iconURL:'https://cdn.discordapp.com/emojis/1548783936010977380.png'})
 .setTitle('🔊 Le membre convoqué est arrivé')
 .setDescription(`<@${r.authorId}>, **<@${r.userId}> est dans le salon d’attente**. Tu peux maintenant le prendre en charge.`)
 .addFields({name:'👤 Membre',value:`<@${r.userId}>`,inline:true},{name:'🛡️ Convocation créée par',value:`<@${r.authorId}>`,inline:true},
 {name:'📅 Rendez-vous prévu',value:`<t:${Math.floor(r.scheduledAt/1000)}:F>`},{name:'📝 Motif',value:escapeMarkdown(r.reason||'Révélé lors de la convocation.')},
 {name:'🔊 Attente convocation',value:`<#${WAIT}>\n[Rejoindre le salon](https://discord.com/channels/${r.guildId}/${WAIT})`})
 .setFooter({text:'La Soul Society • Notification d’arrivée'}).setTimestamp()]};}
module.exports={WAIT,RED,embed,components,payload,arrival};
