const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const { hasBypass } = require('../utils/security');
const { IDENTITY } = require('../config/soulSociety');
const choices = require('../systems/logs')._test.CATEGORIES.map(key => ({ name: key, value: key }));
function allowed(i) { return hasBypass(i) || Boolean(i.memberPermissions?.has('Administrator')); }
function getSystem(i) { return i.client.logs; }
function statusEmbed(i, logs) {
  const config = logs.getConfig(i.guildId), stats = logs.getStats();
  const lines = logs.categoryList.map(({key,label}) => { const c=config.categories[key]; return `${c?.enabled===false?'🔴':'🟢'} **${label}** — ${c?.channelId?`<#${c.channelId}>`:'non configuré'}`; });
  const e = new EmbedBuilder().setColor(0x5865f2).setTitle('📚 Centre de logs • Soul Society')
    .setDescription(`Événements enregistrés : **${Object.entries(stats.totals).filter(([k])=>!k.endsWith('.unrouted')&&k!=='errors').reduce((a,[,v])=>a+v,0)}**\nErreurs récentes : **${stats.totals.errors||0}**\nDernier événement : ${stats.lastEventAt?`<t:${Math.floor(stats.lastEventAt/1000)}:R>`:'aucun mesuré'}\n\n${lines.join('\n')}`)
    .setFooter({text:`Serveur ${i.guild.name} • configuration persistante`});
  return e;
}
module.exports = {
  data: new SlashCommandBuilder().setName('logs').setDescription('Configurer et diagnostiquer le journal centralisé')
    .addSubcommand(s=>s.setName('etat').setDescription('Voir les catégories, salons et statistiques'))
    .addSubcommand(s=>s.setName('salon').setDescription('Associer un salon à une catégorie').addStringOption(o=>o.setName('categorie').setDescription('Catégorie de logs').setRequired(true).addChoices(...choices)).addChannelOption(o=>o.setName('salon').setDescription('Salon textuel destination').setRequired(true).addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)))
    .addSubcommand(s=>s.setName('categorie').setDescription('Activer ou désactiver une catégorie').addStringOption(o=>o.setName('nom').setDescription('Catégorie').setRequired(true).addChoices(...choices)).addBooleanOption(o=>o.setName('active').setDescription('Activer cette catégorie').setRequired(true)))
    .addSubcommand(s=>s.setName('tester').setDescription('Envoyer un test dans le salon configuré').addStringOption(o=>o.setName('categorie').setDescription('Catégorie').setRequired(true).addChoices(...choices)))
    .addSubcommand(s=>s.setName('diagnostic').setDescription('Vérifier les salons, permissions et stockage'))
    .addSubcommand(s=>s.setName('erreurs').setDescription('Afficher les erreurs récentes du journal')),
  async execute(i) {
    await i.deferReply({flags: MessageFlags.Ephemeral});
    if (!i.guild || (i.guildId !== IDENTITY.guildId && !allowed(i))) return i.editReply('Cette commande doit être utilisée sur un serveur autorisé.');
    if (!allowed(i)) return i.editReply('Réservé aux administrateurs et aux rôles de bypass configurés.');
    const logs=getSystem(i); if(!logs)return i.editReply('Le module central de logs n’est pas chargé.');
    const action=i.options.getSubcommand();
    if(action==='etat') return i.editReply({embeds:[statusEmbed(i,logs)]});
    if(action==='salon') {
      const category=i.options.getString('categorie'), channel=i.options.getChannel('salon');
      if(channel.guildId!==i.guildId||!channel.isTextBased())return i.editReply('Choisis un salon textuel de ce serveur.');
      await logs.configureCategory(i.guildId,category,{channelId:channel.id});
      return i.editReply(`✅ La catégorie **${category}** enverra désormais ses journaux dans <#${channel.id}>. Aucun salon n’a été créé ni supprimé.`);
    }
    if(action==='categorie') {
      const category=i.options.getString('nom'), enabled=i.options.getBoolean('active');
      await logs.configureCategory(i.guildId,category,{enabled});
      return i.editReply(`${enabled?'✅ Activée':'⏸️ Désactivée'} : **${category}**.`);
    }
    if(action==='tester') {
      const category=i.options.getString('categorie');
      const ok=await logs.testCategory(i.guild,category);
      return i.editReply(ok?'✅ Test envoyé dans le salon configuré.':'❌ Envoi impossible : vérifie le salon, son activation et les permissions Voir le salon, Envoyer des messages, Intégrer des liens.');
    }
    if(action==='erreurs') {
      const items=logs.getStats().recentErrors.slice(-10).reverse();
      return i.editReply(items.length?items.map(x=>`• <t:${Math.floor(x.at/1000)}:R> **${x.category}** — ${String(x.error).slice(0,180)}`).join('\n'):'Aucune erreur récente enregistrée.');
    }
    const d=await logs.diagnose(i.client,i.guild);
    const rows=d.categories.filter(x=>!x.ready||!x.enabled).map(x=>`${x.ready?'✅':'⚠️'} ${x.key} — ${x.enabled?'salon ou permissions à vérifier':'désactivée'}`);
    return i.editReply(`**Diagnostic des logs**\nBot connecté : ${d.connected?'oui':'non'}\nStockage accessible : ${d.writable?'oui':'non'}\nAudit accessible : ${d.auditPermission?'oui':'non — auteur non attribué'}\nIntents modération / webhooks / événements : ${d.moderationIntent?'✅':'❌'} / ${d.webhooksIntent?'✅':'❌'} / ${d.scheduledEventsIntent?'✅':'❌'}\nSalons à corriger : ${rows.length?rows.join('\n'):'aucun'}\n\nLe stockage local est écrit dans \`${d.dataDirectory}\`. Sa persistance après redéploiement dépend du volume Railway monté sur ce chemin.`);
  }
};
