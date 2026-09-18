const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const { COLORS, ROBLOX } = require('../config/soulSociety');
const { getRobloxLink } = require('./robloxLinks');
const { duration } = require('./soulActivityHelpers');
async function robloxRoles(id) {
    if(!id)return 'Compte Roblox non lié.';
    try {
        const response=await fetch(`https://groups.roblox.com/v2/users/${encodeURIComponent(id)}/groups/roles`,{signal:AbortSignal.timeout(8000)});
        if(!response.ok)return 'Roblox indisponible : rôles non vérifiés.';
        const data=await response.json();if(!Array.isArray(data.data))return 'Réponse Roblox non exploitable.';
        const entry=data.data.find(e=>String(e.group?.id)===String(ROBLOX.groupId));
        if(!entry)return 'Ce compte ne figure pas dans la communauté Soul Society.';
        if(Array.isArray(entry.roles) && entry.roles.length)return entry.roles.map(r=>escapeMarkdown(r.name||String(r.id))).join(', ').slice(0,900);
        return entry.role?.name ? `${escapeMarkdown(entry.role.name)} (rôle principal retourné par Roblox ; autres rôles non vérifiés)` : 'Rôles non fournis par Roblox.';
    }catch{return 'Roblox indisponible : rôles non vérifiés.';}
}
async function build(client,member) {
    const system=client.soulActivity, now=Date.now();
    const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('📅 Suivi du grade et communauté Roblox');
    if(system){
        system.sync(member);
        const m=system.ledger.data.members[member.id], stats=system.ledger.gradeTotals(member.id,now);
        if(stats)embed.addFields({name:'Depuis le dernier changement de grade observé',value:`💬 **${stats.messages}** messages\n🎙️ **${duration(stats.voiceMs)}**\nDepuis <t:${Math.floor(stats.since/1000)}:f>.${stats.partial?'\n⚠️ Date d’obtention du grade inconnue dans ce suivi : activité comptée seulement depuis la première observation.':''}`});
        const total=system.ledger.totals(member.id,0,now);
        // Average over the global observation window, independent of grade changes.
        const averageSince=m?.firstObservedAt || system.ledger.data.since;
        const elapsed=(now-averageSince)/604800000;
        embed.addFields({name:'Vocal moyen par semaine (suivi daté)',value:elapsed>=1?`${duration(total.voiceMs/elapsed)} / semaine\nMoyenne depuis <t:${Math.floor(averageSince/1000)}:d>.`:'Moins de 7 jours de suivi : moyenne pas encore représentative.'},
            {name:'Vocal sur les 7 derniers jours',value:duration(system.ledger.totals(member.id,now-604800000,now).voiceMs)});
    }else embed.setDescription('Suivi daté indisponible pour le moment.');
    const link=getRobloxLink(member.id);
    embed.addFields({name:'Rôle(s) dans la communauté Roblox',value:await robloxRoles(link?.robloxUserId)});
    embed.setFooter({text:'Les totaux historiques et critères de promotion restent dans l’analyse principale.'});
    return embed;
}
module.exports={build,robloxRoles};
