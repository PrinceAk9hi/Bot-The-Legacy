const { Events, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { IDENTITY, COLORS, EMOJIS } = require('../config/soulSociety');
const { eligible } = require('../utils/soulActivityHelpers');
const { read, update } = require('../utils/recruitmentData');
const LOG_CHANNEL = '1550615172895473736';
const REMINDER_CHANNEL = '1550808374357131264';
const SIX_HOURS = 6 * 3600000;
const { automaticDerank, exempt } = require("../utils/automaticDerank");
const pendingProfile = (profiles, id) => !complete(profiles[id]) && !Object.values(profiles).some(p => p.discordId === id && complete(p));
const complete = p => Boolean(p?.completedAt) || p?.step === 'done';
function text(value) { return escapeMarkdown(String(value || 'Non renseigné')).slice(0, 900); }
async function channel(client, id) {
    const c = await client.channels.fetch(id);
    if (!c?.isTextBased() || c.guildId !== IDENTITY.guildId) throw new Error('Salon accueil invalide');
    return c;
}
function logPayload(actor, p) {
    const welcome = require('./memberOnboarding');
    return { allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(COLORS.primary)
        .setTitle('✅ Parcours =bienvenue terminé')
        .setDescription(`${EMOJIS.logo} <@${p.discordId || actor}> a terminé son accueil.\n${p.completedAt ? `Terminé le <t:${Math.floor(p.completedAt/1000)}:f>.` : 'Parcours ancien : date de fin non enregistrée.'}`)
        .addFields(
            {name:'Profil Discord',value:`Nom : ${text(p.discordName)}\nID : ${text(p.discordId || actor)}\nCompte ayant rempli le parcours : <@${actor}>`},
            {name:'Profil Roblox',value:`Nom : ${text(p.robloxDisplayName)}\n@ : ${text(p.robloxUsername)}\nID : ${text(p.robloxId)}`},
            ...welcome.availabilityFields(p),
            {name:'Communauté Roblox',value:p.membershipVerifiedAt && p.membershipRobloxId===p.robloxId ? `Adhésion confirmée le <t:${Math.floor(p.membershipVerifiedAt/1000)}:f>.` : 'Confirmation non enregistrée.'},
            {name:'Anniversaire',value:p.birthDate ? 'Date renseignée — conservée privée dans le profil.' : 'Date non renseignée.'},
            {name:'Suite du parcours',value:'Modifications disponibles via =mon-profil.'})
        .setFooter({text:'La Soul Society • Suivi des accueils'}).setTimestamp()] };
}
function register(client) {
    let running = false, nextAttempt = 0;
    async function tick() {
        if (require("../utils/lineState").isOff()) return;
        if (running || Date.now() < nextAttempt) return;
        running = true;
        try {
            // Completed profiles remain the source of truth; a failed log never blocks onboarding.
            const profiles = read('welcomeProfiles');
            for (const [actor,p] of Object.entries(profiles)) {
                if (!complete(p) || read('welcomeFollowup').logs?.[actor]) continue;
                try {
                    const c = await channel(client, LOG_CHANNEL);
                    const message = await c.send(logPayload(actor,p));
                    update('welcomeFollowup', state => { state.logs ||= {}; state.logs[actor] = {messageId:message.id, at:Date.now()}; });
                } catch { console.warn('⚠️ Log =bienvenue non envoyé ; nouvelle tentative ultérieure.'); break; }
            }
            const saved = read('welcomeFollowup');
            if (saved.nextReminderAt && Date.now() < saved.nextReminderAt) return;
            const guild = client.guilds.cache.get(IDENTITY.guildId); if (!guild) return;
            // REST inventory every six hours, never a Gateway member fetch.
            const members = []; let after;
            while (true) {
                const batch = await guild.members.list({limit:1000,...(after?{after}:{})});
                members.push(...batch.values()); if(batch.size<1000)break; after=batch.last().id;
            }
            const current = read('welcomeProfiles'), now = Date.now();
            const pending = members.filter(m=>!exempt(m) && eligible(m) && !complete(current[m.id]) && !Object.values(current).some(p=>p.discordId===m.id && complete(p)))
                .filter(m=>now-(saved.reminders?.[m.id]?.lastSentAt || 0)>=SIX_HOURS);
            // Reprise après redémarrage entre le 12e rappel et le derank.
            for (const member of members) {
                if (exempt(member) || !eligible(member) || !pendingProfile(read('welcomeProfiles'), member.id)) continue;
                const reminder = read('welcomeFollowup').reminders?.[member.id];
                if ((reminder?.count || 0) < 12) continue;
                await automaticDerank(member, '=bienvenue non terminé après 12 rappels.',
                    'welcome:' + guild.id + ':' + member.id + ':' + reminder.firstSentAt,
                    async m => pendingProfile(read('welcomeProfiles'), m.id));
            }
            if(pending.length) {
                const c=await channel(client,REMINDER_CHANNEL);
                for(let offset=0;offset<pending.length;offset+=25) {
                    const group=pending.slice(offset,offset+25);
                    // Recheck just before sending: a member may have finished during the inventory.
                    const latest=read('welcomeProfiles');
                    const targets=group.filter(m=>pendingProfile(latest,m.id) && (read("welcomeFollowup").reminders?.[m.id]?.count || 0)<12);
                    if(!targets.length)continue;
                    const reminders=targets.map(m=>({id:m.id, count:(saved.reminders?.[m.id]?.count || 0)+1, firstSentAt:saved.reminders?.[m.id]?.firstSentAt || now}));
                    await c.send({content:targets.map(m=>`<@${m.id}>`).join(' '),allowedMentions:{parse:[],users:targets.map(m=>m.id)},embeds:[new EmbedBuilder().setColor(COLORS.primary)
                        .setTitle('📣 Rappel • Termine ton =bienvenue')
                        .setDescription(`${EMOJIS.logo} Ton parcours d’accueil n’est pas encore terminé. Tape **=bienvenue** dans le serveur et va jusqu’à la dernière étape. Une fois terminé, utilise **=mon-profil** pour tes modifications.\n\n**Rappels envoyés :**\n${reminders.map(d=>`<@${d.id}> : **${d.count}/12**`).join('\n')}\n\n⚠️ **Après 12 rappels envoyés sans avoir terminé =bienvenue, un derank sera appliqué automatiquement.**`)
                        .setFooter({text:'La Soul Society • Rappel toutes les 6 heures'})]});
                    update('welcomeFollowup',state=>{state.reminders||={};for(const d of reminders)state.reminders[d.id]={...d,lastSentAt:Date.now()};});
                    for(const member of targets) {
                        const reminder=read('welcomeFollowup').reminders[member.id];
                        if(reminder.count>=12) await automaticDerank(member, '=bienvenue non terminé après 12 rappels.',
                            'welcome:'+guild.id+':'+member.id+':'+reminder.firstSentAt,
                            async m=>pendingProfile(read('welcomeProfiles'),m.id));
                    }
                }
            }
            update('welcomeFollowup',state=>{state.nextReminderAt=Date.now()+SIX_HOURS;});
        } catch { nextAttempt=Date.now()+5*60000;console.warn('⚠️ Rappels accueil indisponibles ; vérifier les permissions et la connexion.'); }
        finally { running=false; }
    }
    client.welcomeFollowup = { tick };
    client.once(Events.ClientReady, tick);
    const timer=setInterval(tick,60000);timer.unref();
}
module.exports=register;
Object.assign(module.exports,{logPayload,complete});
