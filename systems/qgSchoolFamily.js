const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const roles = () => read('qgServer').schoolRoles || {};
const channels = () => read('qgServer').schoolChannels || {};
const save = fn => update('qgServer', fn);
const familyKeys = ['test', 'confirmed', 'expert', 'prestigious', 'senior'];
const familyNames = { test: 'Membre Test', confirmed: 'Membre Confirmé', expert: 'Membre Expert', prestigious: 'Membre Prestigieux', senior: 'Membre Senior' };
const embed = (title, description) => new EmbedBuilder().setFooter({text:'Fondateur - QG'}).setColor(0xffffff).setTitle(title).setDescription(description);
function family(member) { const r = roles(); return familyKeys.some(k => r[k] && member.roles.cache.has(r[k])); }
function staff(member) { const r = roles(); return member.id === config.ownerId || member.id === member.guild.ownerId || ['creator', 'globalManager', 'administrator', 'recruitmentLead'].some(k => r[k] && member.roles.cache.has(r[k])); }
function panel(key) {
  if (key === 'absences') return { embeds: [embed('📆 Signaler une absence', '**Besoin de t’absenter ? Préviens-nous simplement.**\n\nIndique ta date de départ et ton retour prévu. Tu peux ajouter un motif et un commentaire, sans obligation de partager des informations personnelles.\n\n**Pendant ton absence**\nLe rôle **Absent** est attribué pour la période déclarée, puis retiré à ton retour. Les responsables reçoivent les dates ; le motif reste privé.\n\n**Tes disponibilités changent ?**\nRetrouve tes absences pour modifier les dates ou annuler ta déclaration.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:absence-new').setLabel('Déclarer une absence').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('qgs:absence-view').setLabel('Mes absences').setStyle(ButtonStyle.Secondary))] };
  if (key === 'rankUp') return { embeds: [embed('📈 Évolution familiale', 'Retrouve ici les évolutions de grade de la famille QG. Les promotions sont décidées par les responsables habilités selon l’activité, l’investissement et le comportement. Aucune promotion n’est automatique.')], components: [], allowedMentions: { parse: [] } };
  return null;
}
function modal(id, title, fields) { const m = new ModalBuilder().setCustomId(id).setTitle(title); m.addComponents(...fields.map(f => { const input = new TextInputBuilder().setCustomId(f[0]).setLabel(f[1]).setStyle(f[2] || TextInputStyle.Short).setRequired(Boolean(f[3])).setMaxLength(f[4] || 500); if (f[5]) input.setValue(String(f[5]).slice(0, f[4] || 500)); return new ActionRowBuilder().addComponents(input); })); return m; }
async function handle(i) {
  if (!i.customId?.startsWith('qgs:')) return false;
  if (i.customId === 'qgs:absence-new') {
    const member = await i.guild.members.fetch(i.user.id); if (!family(member)) return i.reply({ content: 'Cette fonction est réservée aux membres de la famille.', flags: MessageFlags.Ephemeral });
    return i.showModal(modal('qgs:absence-submit', 'Déclarer une absence', [['start', 'Date de début (JJ/MM/AAAA)', TextInputStyle.Short, true, 30], ['end', 'Date de fin prévue (JJ/MM/AAAA)', TextInputStyle.Short, true, 30], ['reason', 'Motif (facultatif)', TextInputStyle.Short, false, 100], ['comment', 'Commentaire (facultatif)', TextInputStyle.Paragraph, false, 500]]));
  }
  if (i.customId === 'qgs:absence-submit') {
    const member = await i.guild.members.fetch(i.user.id); if (!family(member)) throw new Error('Fonction réservée aux membres de la famille.');
    const parse = value => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim()); if (!m) return NaN; const ms=Date.UTC(+m[3], +m[2]-1, +m[1]),d=new Date(ms); return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]?ms:NaN; };
    const start = parse(i.fields.getTextInputValue('start')), end = parse(i.fields.getTextInputValue('end'));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || start < Date.UTC(2020, 0, 1)) return i.reply({ content: 'Dates invalides. Utilise JJ/MM/AAAA et vérifie que la fin n’est pas avant le début.', flags: MessageFlags.Ephemeral });
    const id = `${Date.now()}-${i.user.id}`;
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const record = { id, memberId: i.user.id, start, end, reason: i.fields.getTextInputValue('reason').trim().slice(0, 100) || null, comment: i.fields.getTextInputValue('comment').trim().slice(0, 500) || null, status: 'active', createdAt: Date.now() };
    save(s => { s.schoolAbsences ||= {}; s.schoolAbsences[id] = record; s.schoolAudit ||= []; s.schoolAudit.push({ id: `absence-${id}`, at: Date.now(), type: 'absence_declaree', actorId: i.user.id, details: { absenceId: id } }); });
    const target = await i.guild.channels.fetch(channels().managementFollowup).catch(() => null);
    if (target?.isTextBased()) {
      const r = roles(), mention = [r.creator, r.globalManager, r.recruitmentLead].filter(Boolean).map(id => `<@&${id}>`).join(' ');
      await target.send({ content: mention, embeds: [embed('Absence déclarée', `Membre : <@${i.user.id}>\nPériode : <t:${Math.floor(start / 1000)}:d> → <t:${Math.floor(end / 1000)}:d>\nLe motif est conservé dans le dossier privé.`)], allowedMentions: { roles: [r.creator, r.globalManager, r.recruitmentLead].filter(Boolean), users: [], parse: [] } });
    }
    await syncAbsenceRoles(i.guild);
    return i.editReply({ content: '✅ Absence enregistrée. Les responsables ont reçu les dates ; ton motif reste privé.' });
  }
  if (i.customId === 'qgs:absence-view') {
    expireAbsences();
    const all = Object.values(read('qgServer').schoolAbsences || {}).filter(x => x.memberId === i.user.id).sort((a,b) => b.createdAt-a.createdAt).slice(0, 8);
    const lines = all.map(a => `• <t:${Math.floor(a.start/1000)}:d> → <t:${Math.floor(a.end/1000)}:d> — ${a.status}${a.reason ? ` (motif : ${a.reason})` : ''}`).join('\n');
    const active = all.filter(a => a.status === 'active');
    const rows = active.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qgs:absence-action').setPlaceholder('Modifier ou annuler une absence').addOptions(active.slice(0, 25).map(a => ({ label: `${new Date(a.start).toLocaleDateString('fr-FR')} → ${new Date(a.end).toLocaleDateString('fr-FR')}`, value: a.id, description: 'Modifier ou annuler cette absence' }))))] : [];
    return i.reply({ content: lines || 'Aucune absence enregistrée.', components: rows, flags: MessageFlags.Ephemeral });
  }
  if (i.customId === 'qgs:absence-action') {
    const id = i.values[0], rec = read('qgServer').schoolAbsences?.[id];
    if (!rec || rec.memberId !== i.user.id || rec.status !== 'active') return i.reply({ content: 'Absence introuvable ou déjà terminée.', flags: MessageFlags.Ephemeral });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`qgs:absence-cancel:${id}`).setLabel('Annuler l’absence').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`qgs:absence-edit:${id}`).setLabel('Modifier les dates').setStyle(ButtonStyle.Primary));
    return i.reply({ content: `Absence du <t:${Math.floor(rec.start/1000)}:d> au <t:${Math.floor(rec.end/1000)}:d>.`, components: [row], flags: MessageFlags.Ephemeral });
  }
  if (i.customId.startsWith('qgs:absence-cancel:')) {
    const id = i.customId.split(':')[2], rec = read('qgServer').schoolAbsences?.[id];
    if (!rec || rec.memberId !== i.user.id || rec.status !== 'active') return i.reply({ content: 'Absence introuvable ou déjà terminée.', flags: MessageFlags.Ephemeral });
    rec.status = 'cancelled'; rec.updatedAt = Date.now(); save(s => { s.schoolAbsences[id] = rec; });
    await i.deferUpdate();await syncAbsenceRoles(i.guild);
    return i.editReply({ content: '✅ Absence annulée.', components: [] });
  }
  if (i.customId.startsWith('qgs:absence-edit:')) {
    const id = i.customId.split(':')[2], rec = read('qgServer').schoolAbsences?.[id];
    if (!rec || rec.memberId !== i.user.id || rec.status !== 'active') return i.reply({ content: 'Absence introuvable ou déjà terminée.', flags: MessageFlags.Ephemeral });
    const format = ms => new Date(ms).toLocaleDateString('fr-FR');
    return i.showModal(modal(`qgs:absence-update:${id}`, 'Modifier une absence', [['start', 'Date de début (JJ/MM/AAAA)', TextInputStyle.Short, true, 30, format(rec.start)], ['end', 'Date de fin (JJ/MM/AAAA)', TextInputStyle.Short, true, 30, format(rec.end)], ['reason', 'Motif facultatif', TextInputStyle.Short, false, 100, rec.reason || ''], ['comment', 'Commentaire facultatif', TextInputStyle.Paragraph, false, 500, rec.comment || '']]));
  }
  if (i.isModalSubmit() && i.customId.startsWith('qgs:absence-update:')) {
    const id = i.customId.split(':')[2], rec = read('qgServer').schoolAbsences?.[id];
    if (!rec || rec.memberId !== i.user.id || rec.status !== 'active') throw new Error('Absence introuvable ou déjà terminée.');
    const parse = value => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim()); if (!m) return NaN; const ms=Date.UTC(+m[3], +m[2]-1, +m[1]),d=new Date(ms); return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]?ms:NaN; };
    const start = parse(i.fields.getTextInputValue('start')), end = parse(i.fields.getTextInputValue('end'));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return i.reply({ content: 'Dates invalides.', flags: MessageFlags.Ephemeral });
    rec.start = start; rec.end = end; rec.reason = i.fields.getTextInputValue('reason').trim().slice(0, 100) || null; rec.comment = i.fields.getTextInputValue('comment').trim().slice(0, 500) || null; rec.updatedAt = Date.now();
    save(s => { s.schoolAbsences[id] = rec; });
    await i.deferReply({flags:MessageFlags.Ephemeral});await syncAbsenceRoles(i.guild);
    return i.editReply({ content: '✅ Absence mise à jour.' });
  }
  if (i.customId === 'qgs:rank-start') {
    const member = await i.guild.members.fetch(i.user.id); if (!family(member)) return i.reply({ content: 'Cette fonction est réservée aux membres de la famille.', flags: MessageFlags.Ephemeral });
    const r = roles(), current = familyKeys.find(k => member.roles.cache.has(r[k]));
    const next = current && familyKeys[familyKeys.indexOf(current) + 1];
    if (!next) return i.reply({ content: current ? 'Tu as déjà atteint le grade familial maximal.' : 'Aucun grade familial trouvé sur ton profil. Contacte la direction.' , flags: MessageFlags.Ephemeral });
    return i.showModal(modal(`qgs:rank-submit:${current}:${next}`, 'Demande de promotion', [['reason', `Justification pour ${familyNames[next]}`, TextInputStyle.Paragraph, true, 800]]));
  }
  if (i.isModalSubmit() && i.customId.startsWith('qgs:rank-submit:')) {
    const [, , current, next] = i.customId.split(':'); const member = await i.guild.members.fetch(i.user.id), r = roles();
    if (!family(member) || !member.roles.cache.has(r[current]) || familyKeys[familyKeys.indexOf(current)+1] !== next) throw new Error('Le grade a changé ou la progression demandée n’est plus valide.');
    const id = `${Date.now()}-${i.user.id}`, reason = i.fields.getTextInputValue('reason').trim();
    save(s => { s.schoolPromotions ||= {}; s.schoolPromotions[id] = { id, memberId: i.user.id, current, requested: next, reason, status: 'pending', createdAt: Date.now() }; });
    const dest = await i.guild.channels.fetch(channels().candidateTracking).catch(() => null);
    if (dest?.isTextBased()) {
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`qgs:rank-decision:${id}:accept`).setLabel('Accepter').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`qgs:rank-decision:${id}:refuse`).setLabel('Refuser').setStyle(ButtonStyle.Danger));
      await dest.send({ embeds: [embed('Demande de promotion', `Membre : <@${i.user.id}>\nGrade actuel : **${familyNames[current]}**\nDemandé : **${familyNames[next]}**\n\n**Justification**\n${reason}`)], components: [row], allowedMentions: { parse: [], users: [i.user.id] } });
    }
    return i.reply({ content: '✅ Demande transmise à la direction. Ton grade ne change qu’après validation.', flags: MessageFlags.Ephemeral });
  }
  if (i.isButton() && i.customId.startsWith('qgs:rank-decision:')) {
    const [, , id, action] = i.customId.split(':'), reviewer = await i.guild.members.fetch(i.user.id);
    if (!staff(reviewer)) return i.reply({ content: 'Décision réservée à la direction.', flags: MessageFlags.Ephemeral });
    const rec = read('qgServer').schoolPromotions?.[id]; if (!rec || rec.status !== 'pending') return i.reply({ content: 'Demande déjà traitée ou introuvable.', flags: MessageFlags.Ephemeral });
    if (action === 'accept') {
      const m = await i.guild.members.fetch(rec.memberId), r = roles();
      if (!m.roles.cache.has(r[rec.current]) || familyKeys[familyKeys.indexOf(rec.current)+1] !== rec.requested) throw new Error('Le grade du membre a changé. La demande doit être réexaminée.');
      await m.roles.remove(r[rec.current], 'Promotion SchoolRP validée'); await m.roles.add(r[rec.requested], 'Promotion SchoolRP validée'); rec.status = 'accepted';
      await m.send(`✅ Ta promotion au grade **${familyNames[rec.requested]}** a été validée.`).catch(() => {});
    } else { rec.status = 'refused'; const m = await i.client.users.fetch(rec.memberId); await m.send('La direction a refusé ta demande de promotion. Tu peux demander un retour en ticket.').catch(() => {}); }
    rec.reviewedAt = Date.now(); rec.reviewerId = i.user.id; save(s => { s.schoolPromotions[id] = rec; });
    return i.update({ embeds: [embed('Demande de promotion traitée', `Statut : **${rec.status === 'accepted' ? 'acceptée' : 'refusée'}** • <@${i.user.id}>`)], components: [] });
  }
  return false;
}
function expireAbsences() {
  const now = new Date(); now.setUTCHours(0, 0, 0, 0); const threshold = now.getTime();
  save(s => { for (const rec of Object.values(s.schoolAbsences || {})) if (rec.status === 'active' && rec.end < threshold) { rec.status = 'ended'; rec.closedAt = Date.now(); } });
}
let syncing;
async function syncAbsenceRoles(guild){
 if(guild.id!==config.guildId)return;if(syncing)return syncing;
 syncing=(async()=>{expireAbsences();const data=read('qgServer'),roleId=data.schoolRoles?.absent;if(!roleId)return;
 const role=await guild.roles.fetch(roleId);if(!role?.editable)throw Error('Le rôle Absent est absent ou trop haut pour le bot.');
 const records=Object.values(data.schoolAbsences||{}),now=Date.now();
 const ids=new Set([...records.map(r=>r.memberId),...role.members.keys()]);
 for(const id of ids){const member=await guild.members.fetch(id).catch(e=>{if(e.code===10007)return null;throw e;});if(!member)continue;
 const active=records.some(r=>r.memberId===id&&r.status==='active'&&r.start<=now&&r.end+86400000>now);
 if(active&&!member.roles.cache.has(roleId))await member.roles.add(roleId,'Absence déclarée en cours');
 if(!active&&member.roles.cache.has(roleId))await member.roles.remove(roleId,'Absence terminée ou annulée');
 }})();try{await syncing;}finally{syncing=null;}
}
module.exports = { panel, handle, expireAbsences, syncAbsenceRoles, _test: { family, familyKeys, familyNames } };
