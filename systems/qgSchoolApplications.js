const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits: P, MessageFlags } = require('discord.js');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');
const { read, update } = require('../utils/recruitmentData');

const familyQuestions = [
  'Quel est ton pseudo Roblox ?', 'Présente-toi en quelques lignes.', 'Pourquoi souhaites-tu rejoindre la famille ?',
  'Quelle expérience as-tu en roleplay ?', 'As-tu déjà fait partie d’une famille ? Que peux-tu en dire ?',
  'Quelles sont tes disponibilités habituelles ?', 'Quelles sont tes principales qualités ?',
  'Quel point aimerais-tu améliorer chez toi ?', 'Comment réagirais-tu à un désaccord avec un autre membre ?',
  'Quel engagement souhaites-tu prendre envers la famille ?'
];
const state = () => read('qgServer');
const save = fn => update('qgServer', fn);
const familyRoleKeys = ['senior', 'prestigious', 'expert', 'confirmed', 'test'];
const managerFor = { ticketsManagement: 'ticketsLead', recruitmentManagement: 'recruitmentLead', animationManagement: 'animationLead', networksManagement: 'networksLead' };
const teamLabels = { ticketsManagement: 'Gestion Support', recruitmentManagement: 'Gestion Recrutement', animationManagement: 'Gestion Animation', networksManagement: 'Gestion Réseaux' };
const trim = text => String(text ?? '').slice(0, 1000);
const embed = (title, description) => new EmbedBuilder().setFooter({text:'Fondateur - QG'}).setColor(0xffffff).setTitle(title).setDescription(description);
function ids() { const s = state(); return { roles: s.schoolRoles || {}, channels: s.schoolChannels || {}, categories: s.schoolCategories || {} }; }
function inFamily(member) { const r = ids().roles; return familyRoleKeys.some(k => r[k] && member.roles.cache.has(r[k])); }
function verifiedForRecruitment(member, data = state()) {
  const verification = data.schoolEntryVerification?.[member.id];
  const roleId = data.schoolRoles?.community;
  return Boolean(member.guild.id === config.guildId && !member.pending && roleId && member.roles.cache.has(roleId) && verification?.stage === 'accepted' && verification.acceptedAt && verification.confirmedAt && verification.robloxId);
}
function verificationRequired() {
  const channelId = state().schoolChannels?.rules;
  return `Termine d’abord ta vérification${channelId ? ` dans <#${channelId}>` : ' dans le salon règlement'} : confirme ton profil Roblox, puis la lecture du règlement. Tu pourras ensuite déposer ta candidature famille.`;
}

async function beginFamilyRecruitment(i) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  if (i.guildId !== config.guildId) return i.editReply('Action disponible uniquement sur le QG.');
  const server = await i.client.guilds.fetch(config.guildId), member = await server.members.fetch(i.user.id);
  if (!verifiedForRecruitment(member)) return i.editReply(verificationRequired());
  if (inFamily(member)) return i.editReply('Tu fais déjà partie de la famille. Utilise le panel des gestions pour rejoindre une équipe.');
  const active = state().schoolFamilyRecruitment || {};
  if (active[i.user.id] && ['in_progress', 'submitted', 'in_review'].includes(active[i.user.id].status)) return i.editReply('Tu as déjà une candidature active. Vérifie tes MP ou le suivi fourni par l’équipe.');
  const dm = await i.user.createDM().catch(() => null);
  if (!dm) return i.editReply('Je ne peux pas t’envoyer de MP. Active les messages privés du serveur et réessaie.');
  const app = { applicantId: i.user.id, status: 'in_progress', step: 0, answers: [], createdAt: Date.now(), guildId: i.guildId };
  save(s => { s.schoolFamilyRecruitment ||= {}; s.schoolFamilyRecruitment[i.user.id] = app; });
  await dm.send({ embeds: [embed('Candidature famille • 1/10', familyQuestions[0] + '\n\nRéponds directement à ce message. Écris `annuler` pour arrêter la candidature.')] });
  return i.editReply('📩 Je t’ai envoyé la première question en message privé.');
}

async function submitFamily(memberId, app, client) {
  const { roles, channels, categories } = ids();
  const guild = await client.guilds.fetch(config.guildId);
  const candidate = await guild.members.fetch(memberId);
  if (!verifiedForRecruitment(candidate)) throw new Error(verificationRequired());
  const targetRole = roles.recruitmentManagement, lead = roles.recruitmentLead;
  if (!targetRole || !channels.candidateReception) throw new Error('L’installation des salons de candidature est incomplète.');
  const user = await client.users.fetch(memberId);
  const ch = await guild.channels.create({
    name: `candidature-famille-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
    type: 0, parent: categories.managementPlus, topic: `qgs-family-application:${memberId}`,
    permissionOverwrites: [
      { id: guild.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.ManageChannels] },
      { id: memberId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
      { id: targetRole, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
      ...(lead ? [{ id: lead, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }] : [])
    ]
  });
  const body = familyQuestions.map((q, n) => `**${n + 1}. ${q}**\n${trim(app.answers[n]) || '—'}`).join('\n\n');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`qgs:family-decision:${memberId}:accept`).setLabel('Accepter').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`qgs:family-decision:${memberId}:refuse`).setLabel('Refuser').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`qgs:family-decision:${memberId}:interview`).setLabel('Entretien').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`qgs:family-decision:${memberId}:details`).setLabel('Précisions').setStyle(ButtonStyle.Secondary)
  );
  await ch.send({ embeds: [embed('Nouvelle candidature famille', `Candidate : <@${memberId}>\n${body}`)], components: [row], allowedMentions: { parse: [], users: [memberId] } });
  app.status = 'submitted'; app.channelId = ch.id; app.submittedAt = Date.now();
  save(s => { s.schoolFamilyRecruitment[memberId] = app; });
  await user.send('✅ Ta candidature a été transmise à la Gestion Recrutement. Une décision sera communiquée ici.').catch(() => {});
}

async function beginManagementApplication(i) {
  const member = await i.guild.members.fetch(i.user.id);
  if (!inFamily(member)) return i.reply({ content: 'Cette candidature est réservée aux membres de la famille.', flags: MessageFlags.Ephemeral });
  const team = i.values?.[0];
  if (!managerFor[team]) return i.reply({ content: 'Gestion inconnue.', flags: MessageFlags.Ephemeral });
  const active = state().schoolManagementApplications || {};
  if (active[i.user.id]?.[team] && ['submitted', 'in_review'].includes(active[i.user.id][team].status)) return i.reply({ content: `Tu as déjà une candidature active pour ${teamLabels[team]}.`, flags: MessageFlags.Ephemeral });
  const modal = new ModalBuilder().setCustomId(`qgs:management-modal:${team}`).setTitle(`Candidature • ${teamLabels[team]}`);
  const fields = [['motivation', 'Tes motivations'], ['experience', 'Ton expérience'], ['availability', 'Tes disponibilités'], ['skills', 'Tes compétences'], ['contribution', 'Ta contribution envisagée']];
  modal.addComponents(...fields.map(([id, label]) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Paragraph).setMaxLength(800).setRequired(true))));
  await i.showModal(modal);
}

async function submitManagement(i, team) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = await i.client.guilds.fetch(config.guildId), applicant = await guild.members.fetch(i.user.id), { roles, channels, categories } = ids();
  if (!inFamily(applicant)) throw new Error('Tu ne fais pas partie de la famille.');
  if (!managerFor[team]) throw new Error('Gestion invalide.');
  const existing = state().schoolManagementApplications?.[i.user.id]?.[team];
  if (existing && ['submitted', 'in_review'].includes(existing.status)) throw new Error('Tu as déjà une candidature active pour cette gestion.');
  const lead = roles[managerFor[team]], managementRole = roles[team];
  const ch = await guild.channels.create({ name: `candidature-${team.replace('Management', '')}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90), type: 0, parent: categories.managementPlus, topic: `qgs-management-application:${team}:${i.user.id}`,
    permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] }, { id: i.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks, P.ManageChannels] }, { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }, ...[roles.creator, roles.globalManager, lead, managementRole].filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }))] });
  const labels = { motivation: 'Motivation', experience: 'Expérience', availability: 'Disponibilités', skills: 'Compétences', contribution: 'Contribution envisagée' };
  const description = Object.entries(labels).map(([id, label]) => `**${label}**\n${trim(i.fields.getTextInputValue(id))}`).join('\n\n');
  const row = new ActionRowBuilder().addComponents(...[
    ['accept', 'Accepter', ButtonStyle.Success], ['refuse', 'Refuser', ButtonStyle.Danger], ['interview', 'Entretien', ButtonStyle.Primary], ['details', 'Précisions', ButtonStyle.Secondary]
  ].map(([action, label, style]) => new ButtonBuilder().setCustomId(`qgs:management-decision:${team}:${i.user.id}:${action}`).setLabel(label).setStyle(style)));
  await ch.send({ embeds: [embed(`Candidature • ${teamLabels[team]}`, `Candidat : <@${i.user.id}>\n${description}`)], components: [row], allowedMentions: { parse: [], users: [i.user.id] } });
  save(s => { s.schoolManagementApplications ||= {}; s.schoolManagementApplications[i.user.id] ||= {}; s.schoolManagementApplications[i.user.id][team] = { applicantId: i.user.id, team, status: 'submitted', channelId: ch.id, createdAt: Date.now() }; });
  await i.editReply({ content: `✅ Ta candidature pour **${teamLabels[team]}** a été transmise au responsable concerné.` });
}

const decisionQueues = new Map();
async function decision(i) {
  const key = i.customId.split(':')[2];
  await i.deferUpdate();
  const next = (decisionQueues.get(key) || Promise.resolve()).catch(()=>{}).then(()=>decisionInternal(i));
  decisionQueues.set(key,next);try{return await next;}finally{if(decisionQueues.get(key)===next)decisionQueues.delete(key);}
}
async function decisionInternal(i) {
  const parts = i.customId.split(':');
  const isFamily = parts[1] === 'family-decision';
  const memberId = isFamily ? parts[2] : parts[3], action = parts.at(-1), team = isFamily ? null : parts[2];
  const { roles } = ids(), reviewer = await i.guild.members.fetch(i.user.id);
  const leadKey = isFamily ? 'recruitmentLead' : managerFor[team];
  if (i.user.id !== config.ownerId && i.user.id !== i.guild.ownerId && !reviewer.roles.cache.has(roles[leadKey]) && !reviewer.roles.cache.has(roles[isFamily ? 'recruitmentManagement' : team])) return i.followUp({ content: 'Seule la gestion concernée peut traiter cette candidature.', flags: MessageFlags.Ephemeral });
  const table = isFamily ? 'schoolFamilyRecruitment' : 'schoolManagementApplications';
  const app = isFamily ? state()[table]?.[memberId] : state()[table]?.[memberId]?.[team];
  if (!app || app.channelId !== i.channelId || !['submitted', 'in_review'].includes(app.status)) return i.followUp({ content: 'Cette candidature a déjà été traitée ou son dossier est introuvable.', flags: MessageFlags.Ephemeral });
  const status = { accept: 'acceptée', refuse: 'refusée', interview: 'entretien demandé', details: 'précisions demandées' }[action];
  if (!status) return i.followUp({ content: 'Action invalide.', flags: MessageFlags.Ephemeral });
  if (isFamily && action === 'accept') {
    const candidate = await i.guild.members.fetch(memberId);
    if (!verifiedForRecruitment(candidate)) return i.followUp({ content: 'Ce candidat doit terminer sa vérification et accepter le règlement avant de pouvoir rejoindre la famille.', flags: MessageFlags.Ephemeral });
    if (inFamily(candidate)) return i.followUp({ content: 'Cette personne possède déjà un grade familial ; vérifie son dossier avant de valider.', flags: MessageFlags.Ephemeral });
    if (!roles.test) throw new Error('Le rôle Membre Test n’est pas configuré.');
    await candidate.roles.add(roles.test, 'Candidature famille acceptée');
  }
  if (!isFamily && action === 'accept') {
    const candidate = await i.guild.members.fetch(memberId);
    if (!roles[team]) throw new Error(`Le rôle ${teamLabels[team]} n’est pas configuré.`);
    const members = await i.guild.members.fetch();
    const occupied = [...members.values()].filter(m=>!m.user.bot&&m.roles.cache.has(roles[team])&&!m.roles.cache.has(roles[managerFor[team]])).length;
    if (occupied >= 2 && !candidate.roles.cache.has(roles[team])) return i.followUp({content:'Cette gestion possède déjà ses deux membres (hors responsable). Libère une place avant de valider.',flags:MessageFlags.Ephemeral});
    if (!candidate.roles.cache.has(roles[team])) await candidate.roles.add(roles[team], `Candidature acceptée : ${teamLabels[team]}`);
  }
  app.status = action === 'interview' || action === 'details' ? 'in_review' : action;
  app.updatedAt = Date.now(); app.updatedBy = i.user.id;
  if (isFamily) save(s => { s[table][memberId] = app; }); else save(s => { s[table][memberId][team] = app; });
  const user = await i.client.users.fetch(memberId);
  await user.send(`Ta candidature${team ? ` pour ${teamLabels[team]}` : ''} a été **${status}** par l’équipe. ${action === 'interview' ? 'La gestion te contactera pour organiser un entretien.' : action === 'details' ? 'Réponds à l’équipe via le dossier pour fournir les précisions demandées.' : ''}`).catch(() => {});
  await i.editReply({ embeds: [embed('Candidature mise à jour', `Décision : **${status}**\nTraitée par <@${i.user.id}> • <t:${Math.floor(Date.now() / 1000)}:f>`)], components: [] });
}

async function handle(i) {
  if (i.isModalSubmit() && i.customId.startsWith('qgs:management-modal:')) return submitManagement(i, i.customId.split(':')[2]);
  if (i.isButton() && (i.customId.startsWith('qgs:management-decision:') || i.customId.startsWith('qgs:family-decision:'))) return decision(i);
  if (!i.isModalSubmit() && !i.isButton()) return false;
  return false;
}

async function directMessage(message) {
  if (message.author.bot || message.guildId) return false;
  const all = state().schoolFamilyRecruitment || {}, app = all[message.author.id];
  if (!app || app.status !== 'in_progress') return false;
  const text = message.content.trim();
  if (text.toLowerCase() === 'annuler') { save(s => { s.schoolFamilyRecruitment[message.author.id].status = 'cancelled'; s.schoolFamilyRecruitment[message.author.id].updatedAt = Date.now(); }); await message.reply('Candidature annulée. Tu pourras recommencer depuis le panel.'); return true; }
  const guild = await message.client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(message.author.id).catch(() => null);
  if (!member || !verifiedForRecruitment(member)) { await message.reply(verificationRequired()); return true; }
  if (!text && !message.attachments.size) return message.reply('Envoie une réponse écrite pour continuer.');
  app.answers[app.step] = (text || '[Pièce jointe fournie]').slice(0, 1500);
  app.step++;
  if (app.step >= familyQuestions.length) {
    app.status = 'submitted';
    await submitFamily(message.author.id, app, message.client);
    return true;
  }
  save(s => { s.schoolFamilyRecruitment[message.author.id] = app; });
  await message.reply({ embeds: [embed(`Candidature famille • ${app.step + 1}/10`, familyQuestions[app.step] + '\n\nRéponds directement. Écris `annuler` pour arrêter.')] });
  return true;
}

module.exports = { handle, directMessage, beginFamilyRecruitment, beginManagementApplication, familyQuestions, _test: { inFamily, managerFor, verifiedForRecruitment } };
