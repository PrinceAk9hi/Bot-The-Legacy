const {COLORS}=require('../config/soulSociety');
const {SlashCommandBuilder,PermissionFlagsBits,EmbedBuilder,MessageFlags,escapeMarkdown}=require('discord.js');
module.exports={
 data:new SlashCommandBuilder().setName('banlist').setDescription('Afficher les utilisateurs bannis, par page.').addIntegerOption(o=>o.setName('page').setDescription('Page à afficher').setMinValue(1)).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 async execute(i){
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const bans=await i.guild.bans.fetch().catch(()=>null);
  if(!bans)return i.editReply({content:'❌ Impossible de récupérer les bannissements. Vérifie la permission Bannir des membres du bot.'});
  if(!bans.size)return i.editReply({content:'✅ Aucun utilisateur n’est actuellement banni.'});
  const entries=[...bans.values()].sort((a,b)=>a.user.id.localeCompare(b.user.id));
  const pages=Math.ceil(entries.length/10),page=i.options.getInteger('page')||1;
  if(page>pages)return i.editReply({content:`Cette page n’existe pas. Choisis une page entre 1 et ${pages}.`});
  const embed=new EmbedBuilder().setColor(COLORS.sanction).setTitle(`🔨 Liste des bannis — ${entries.length}`).setDescription(entries.slice((page-1)*10,page*10).map(b=>`**${escapeMarkdown(String(b.user.tag).slice(0,60))}**\nID : \`${b.user.id}\`\nRaison : ${escapeMarkdown(String(b.reason||'Aucune raison').slice(0,120))}`).join('\n\n')).setFooter({text:`Page ${page}/${pages} • =banlist ${page<pages?page+1:1}`});
  return i.editReply({embeds:[embed],allowedMentions:{parse:[]}});
 }
};
