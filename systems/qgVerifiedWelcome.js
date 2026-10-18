const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const seeds = require('../config/qgSeeds');
const busy = new Set();
async function send(member) {
  if (member.guild.id !== config.guildId || member.user.bot || busy.has(member.id)) return;
  busy.add(member.id);
  try {
    const state = read('qgServer');
    if (state.schoolEntryVerification?.[member.id]?.stage !== 'accepted') return;
    const joinedAt = member.joinedTimestamp || 0;
    if (state.schoolWelcome?.[member.id]?.joinedAt === joinedAt) return;
    const channelId = state.schoolChannels?.arrivals || state.channels?.arrivals || seeds.channels.arrivals;
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw Error('Salon d’arrivées QG indisponible.');
    const embed = new EmbedBuilder().setFooter({text:'Fondateur - QG'}).setColor(0xffffff).setTitle('✦ Bienvenue dans la communauté du QG')
      .setDescription(`Bienvenue <@${member.id}> !\n\nTa vérification est terminée : tu fais désormais partie de notre communauté.\n\n**Prends tes repères**\nDécouvre les salons, présente-toi et fais connaissance avec les membres. Discussions, rencontres et roleplay t’attendent.\n\n**Envie de rejoindre la famille ?**\n${state.schoolChannels?.familyApplications ? `Dépose ta candidature dans <#${state.schoolChannels.familyApplications}>.` : 'Retrouve le panel de candidature famille dans l’espace Support.'}\n\nNous sommes heureux de t’accueillir parmi nous !`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 })).setTimestamp();
    const card = await require('../utils/qgArrivalCard').render(member);
    embed.setImage('attachment://bienvenue-qg.png');
    const message = await channel.send({ files: [new AttachmentBuilder(card, {name:'bienvenue-qg.png'})], content: `<@${member.id}>`, embeds: [embed], allowedMentions: { parse: [], users: [member.id] } });
    update('qgServer', data => { data.schoolWelcome ||= {}; data.schoolWelcome[member.id] = { joinedAt, messageId: message.id, channelId, sentAt: Date.now() }; });
  } finally { busy.delete(member.id); }
}
module.exports = { send };
