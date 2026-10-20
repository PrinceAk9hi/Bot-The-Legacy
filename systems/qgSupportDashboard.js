const {ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,MessageFlags:F,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),{embed}=require('./qgPanels');
async function payload(guild,page=0,viewer=null){
 const all=Object.entries(a.state().tickets||{}).filter(([,t])=>t.type==='questions');
 const tickets=[];for(const [id,t]of all){const ch=await guild.channels.fetch(id).catch(()=>null);if(ch&&(!viewer||ch.permissionsFor(viewer)?.has([P.ViewChannel,P.ReadMessageHistory])))tickets.push({id,...t,createdAt:t.createdAt||ch.createdTimestamp});}
 tickets.sort((x,y)=>x.createdAt-y.createdAt);const max=Math.max(0,Math.ceil(tickets.length/10)-1);page=Math.max(0,Math.min(max,page));
 return{embeds:[embed('Tableau de bord • Gestion Support',`**${tickets.length} tickets Questions/Aide** • ${tickets.filter(t=>!t.claimedBy).length} sans gestionnaire\nMis à jour <t:${Math.floor(Date.now()/1000)}:R> • Page ${page+1}/${max+1}\n\n${tickets.slice(page*10,page*10+10).map(t=>`<#${t.id}> • ${t.claimedBy?`<@${t.claimedBy}>`:'**À prendre**'}\nOuvert <t:${Math.floor(t.createdAt/1000)}:R> • ${t.escalatedAt?'Transmis au support':'Assistance IA'}`).join('\n\n')||'Aucun ticket à afficher.'}\n\nLes dossiers Fondation et les autres gestions ne sont pas inclus.`)],components:[new Row().addComponents(new Button().setCustomId(`qgsd:${page-1}`).setLabel('Précédent').setStyle(S.Secondary).setDisabled(page===0),new Button().setCustomId(`qgsd:${page}`).setLabel('Actualiser').setStyle(S.Primary),new Button().setCustomId(`qgsd:${page+1}`).setLabel('Suivant').setStyle(S.Secondary).setDisabled(page===max))],allowedMentions:{parse:[]}};
}
async function refresh(guild){return a.serial('support-dashboard',async()=>{
 const id=a.state().schoolChannels?.supportTeamFollowup;if(!id)return;
 const ch=await guild.channels.fetch(id);if(!ch?.isTextBased())return;
 // Never publish the operational dashboard into an everyone-visible channel.
 if(ch.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel))throw Error('Le salon de suivi Support doit rester privé.');
 const messageId=a.state().schoolSupportDashboard;let msg=messageId?await ch.messages.fetch(messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!msg){const recent=await ch.messages.fetch({limit:50});msg=recent.find(m=>m.author.id===guild.client.user.id&&m.embeds.some(e=>e.title==='Tableau de bord • Gestion Support'));}
 const p=await payload(guild);if(msg)await msg.edit(p);else msg=await ch.send(p);a.save(s=>{s.schoolSupportDashboard=msg.id;});
});}
async function handle(i){await i.deferReply({flags:F.Ephemeral});const member=await require('./qgSupportWorkspace').authorize(i);return i.editReply(await payload(i.guild,Number(i.customId.split(':')[1])||0,member));}
module.exports={refresh,handle};
