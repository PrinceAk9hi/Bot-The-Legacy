const { Events, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { IDENTITY, COLORS } = require('../config/soulSociety');
const { eligible, grade, duration } = require('../utils/soulActivityHelpers');
const { Ledger } = require('../utils/soulActivityLedger');
const { read, update, ensurePanel } = require('../utils/recruitmentData');
const CHANNEL = '1544424543664349264', KEY = 'soulactivity_period';
const PERIODS = { day: ['24 heures', 1], three: ['3 jours', 3], week: ['1 semaine', 7], month: ['1 mois (30 jours)', 30], all: ['Depuis le début du suivi daté', 0] };
function register(client) {
    const ledger = new Ledger(read('soulActivityTimeline'));
    const members = new Map(); let complete = false, publicMessage, refreshing = false;
    function sync(member) {
        if (member.guild.id !== IDENTITY.guildId) return;
        const ok = eligible(member), now = Date.now();
        if (ok) { members.set(member.id, member); ledger.voice(member.id, grade(member), Boolean(member.voice.channelId), now); }
        else { members.delete(member.id); if (ledger.data.members[member.id]) ledger.voice(member.id, grade(member), false, now); }
    }
    function save() { const data = ledger.flush(); update('soulActivityTimeline', store => Object.assign(store, data)); }
    function payload(period = 'all', page = 0, owner = null, target = null) {
        if (!PERIODS[period]) period = 'all';
        const now = Date.now(), from = PERIODS[period][1] ? now - PERIODS[period][1] * 86400000 : 0;
        const rows = [...members.values()].filter(eligible).map(m => ({ id: m.id, ...ledger.totals(m.id, from, now) })).sort((a,b) => b.voiceMs-a.voiceMs || b.messages-a.messages || a.id.localeCompare(b.id));
        const pages = Math.max(1, Math.ceil(rows.length / 10)); page = Math.max(0, Math.min(page, pages-1));
        const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('📊 Activité des membres • La Soul Society')
            .setDescription(`**${PERIODS[period][0]}** • Classement par temps vocal, puis messages.\nSuivi daté depuis <t:${Math.floor(ledger.data.since/1000)}:f>. ${from && from < ledger.data.since ? '**Période partielle.** ' : ''}Les anciens totaux sans dates restent dans =analyse.\nTous les messages humains sont comptés ; vocal connecté, y compris en sourdine. Le temps hors ligne du bot n’est pas compté.${complete ? '' : '\n⚠️ Liste des membres en cours de chargement ou incomplète.'}`)
            .setFooter({text:`Page ${page+1}/${pages} • ${rows.length} membres • Choisis une période pour ta vue privée`}).setTimestamp();
        for (const [index, r] of (target ? rows.filter(r => r.id === target) : rows.slice(page*10,page*10+10)).entries()) embed.addFields({name:`#${target ? rows.findIndex(item => item.id === r.id)+1 : page*10+index+1}`,value:`<@${r.id}> — 💬 **${r.messages.toLocaleString('fr-FR')}** messages\n🎙️ **${duration(r.voiceMs)}**`});
        if (target) embed.setTitle('👤 Activité du membre • La Soul Society');
        if (target && !rows.some(r => r.id === target)) embed.addFields({name:'Membre',value:'Ce compte ne fait pas partie des membres de la Soul Society connus du bot.'});
        if (!rows.length && !target) embed.addFields({name:'Membres',value:'Aucun membre disponible pour le moment.'});
        const components = [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(target ? `${KEY}:${target}` : KEY).setPlaceholder('Choisir une période').addOptions(Object.entries(PERIODS).map(([value,[label]])=>({label,value,default:value===period}))))];
        components.push(new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`soulactivity_member:${period}`).setPlaceholder('Rechercher un membre précis').setMinValues(1).setMaxValues(1)));
        if (owner && target) components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`soulactivity_page:${owner}:${period}:0`).setLabel('Retour au classement').setStyle(ButtonStyle.Secondary)));
        if (owner && !target) components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`soulactivity_page:${owner}:${period}:${page-1}`).setLabel('Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page===0),
            new ButtonBuilder().setCustomId(`soulactivity_page:${owner}:${period}:${page}`).setLabel('Actualiser').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`soulactivity_page:${owner}:${period}:${page+1}`).setLabel('Suivant').setStyle(ButtonStyle.Secondary).setDisabled(page===pages-1)));
        return {embeds:[embed],components,allowedMentions:{parse:[]}};
    }
    client.soulActivity = { ledger, save, sync, payload };
    client.on(Events.MessageCreate, message => { if (message.guildId !== IDENTITY.guildId || !eligible(message.member)) return; sync(message.member); ledger.message(message.author.id, grade(message.member), Date.now()); });
    client.on(Events.VoiceStateUpdate, (oldState,newState) => { if (newState.member) sync(newState.member); });
    client.on(Events.GuildMemberUpdate, (_,member) => sync(member));
    client.on(Events.GuildMemberAdd, sync);
    client.on(Events.GuildMemberRemove, member => { if(member.guild.id!==IDENTITY.guildId)return; members.delete(member.id); if(ledger.data.members[member.id])ledger.voice(member.id,grade(member),false,Date.now()); });
    client.once(Events.ClientReady, async () => {
        const guild = client.guilds.cache.get(IDENTITY.guildId); if (!guild) return;
        for (const member of guild.members.cache.values()) sync(member);
        try {
            // One paginated REST inventory at startup, never a Gateway opcode-8 bulk fetch.
            let after;
            while (true) { const batch = await guild.members.list({limit:1000,...(after?{after}:{})}); for(const member of batch.values())sync(member); if(batch.size<1000)break; after=batch.last().id; }
            complete = true;
        } catch { console.warn('⚠️ Inventaire activité incomplet ; utilisation des membres connus.'); }
        try { publicMessage = await ensurePanel(client, CHANNEL, KEY, payload()); await require('../utils/rankingChannel').prepare(client, publicMessage); } catch { console.warn('⚠️ Panel ou préparation du classement incomplet : vérifier les permissions du bot. Le nettoyage reprendra au prochain redémarrage.'); }
        save();
    });
    const timer = setInterval(async () => {
        try { save(); if(publicMessage && !refreshing){refreshing=true;try{await publicMessage.edit(payload());}finally{refreshing=false;}} }
        catch { console.warn('⚠️ Sauvegarde ou actualisation activité impossible.'); }
    },60000); timer.unref();
    client.on(Events.InteractionCreate, async i => {
        if(i.guildId!==IDENTITY.guildId || !i.customId?.startsWith('soulactivity_'))return;
        try {
            if(i.isUserSelectMenu() && i.customId.startsWith('soulactivity_member:')) {
                const period=i.customId.split(':')[1], target=i.values[0];
                if(i.message?.flags?.has(MessageFlags.Ephemeral)) await i.deferUpdate(); else await i.deferReply({flags:MessageFlags.Ephemeral});
                const member=await i.guild.members.fetch(target).catch(()=>null); if(member)sync(member);
                return i.editReply(payload(period,0,i.user.id,target));
            }
            if(i.isStringSelectMenu() && (i.customId===KEY || i.customId.startsWith(KEY+':'))){
                const target=i.customId.split(':')[1] || null;
                if(i.message?.flags?.has(MessageFlags.Ephemeral)) await i.deferUpdate(); else await i.deferReply({flags:MessageFlags.Ephemeral});
                return i.editReply(payload(i.values[0],0,i.user.id,target));
            }
            if(i.isButton() && i.customId.startsWith('soulactivity_page:')){const [,owner,period,p]=i.customId.split(':');if(owner!==i.user.id)return i.reply({content:'Cette vue appartient à un autre membre.',flags:MessageFlags.Ephemeral});await i.deferUpdate();return i.editReply(payload(period,Number(p)||0,owner));}
        } catch { if(i.deferred)await i.editReply({content:'Impossible d’afficher les statistiques. Réessaie.',embeds:[],components:[]}).catch(()=>{}); }
    });
}
module.exports = register;
