const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  PermissionFlagsBits: P, StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config/qg');
const path = require('node:path');
const { localImage } = require('../utils/discordPanelImage');
const layout = require('../config/qgSchoolLayout');
const { read, update } = require('../utils/recruitmentData');

const store = fn => update('qgServer', fn);
const seeds = require('../config/qgSeeds');
const state = () => { const raw = read('qgServer'); return { ...seeds, ...raw, roles: { ...seeds.roles, ...raw.roles }, categories: { ...seeds.categories, ...raw.categories }, channels: { ...seeds.channels, ...raw.channels }, panels: { ...seeds.panels, ...raw.panels } }; };
const roleMap = () => state().schoolRoles || {};
const categoryMap = () => state().schoolCategories || {};
const channelMap = () => state().schoolChannels || {};
const clean = text => String(text ?? '').replace(/@everyone|@here|<@&?\d+>|<#[0-9]+>/g, '[mention]').slice(0, 1800);
const embed = (title, description) => new EmbedBuilder().setColor(0x161323).setTitle(title).setDescription(description).setFooter({ text: 'Soul Society • QG SchoolRP' });
function audit(type, actorId, details = {}) {
  store(s => { s.schoolAudit ||= []; s.schoolAudit.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), type, actorId, details }); if (s.schoolAudit.length > 1000) s.schoolAudit.splice(0, s.schoolAudit.length - 1000); });
}

const ruleText = `Bienvenue dans la famille SchoolRP. L’accès au serveur implique le respect des règles ci-dessous, de Discord et de Roblox. Version 2 • 18 octobre 2026.\n\n`+
`**Article 1 — Respect.** Chacun s’adresse aux autres avec dignité. Les insultes répétées, humiliations, provocations malveillantes et comportements hostiles sont interdits.\n\n`+
`**Article 2 — Harcèlement et discriminations.** Menaces, harcèlement, discriminations, propos haineux et incitation à la violence sont interdits, y compris en messages privés lorsqu’ils sont liés à la communauté.\n\n`+
`**Article 3 — Comportement général.** Évite les règlements de comptes publics. Les désaccords se traitent calmement dans le bon espace ou avec l’équipe.\n\n`+
`**Article 4 — Spam et publicité.** Spam, flood, arnaques, invitations Discord et mentions everyone/here sont interdits aux membres. Anti-spam : timeout 15 minutes, puis ban 24 heures, puis définitif. Les antécédents sont conservés ; Direction et Fondation sont exemptées de l’automatisation.\n\n`+
`**Article 5 — Contenus interdits.** Aucun contenu sexuel explicite, choquant, illégal, violent graphique ou lien malveillant. Respecte les règles des plateformes.\n\n`+
`**Article 6 — Confidentialité.** Ne diffuse pas de données personnelles, conversations privées, identifiants ou contenus privés sans accord. L’usurpation d’identité est interdite.\n\n`+
`**Article 7 — Salons textuels.** Utilise chaque salon selon son thème et respecte ses consignes. Les contenus hors sujet peuvent être déplacés ou retirés par l’équipe.\n\n`+
`**Article 8 — Salons vocaux.** Nuisances sonores et harcèlement interdits. Chat vocal, soundboard, sons externes, voix prioritaire et définition de statut désactivés pour les membres. Respecte les personnes présentes.\n\n`+
`**Article 9 — SchoolRP et roleplay.** Respecte le règlement officiel de SchoolRP et des expériences Roblox concernées. Le présent règlement Discord ne remplace pas celui du jeu. Exploitation de bugs et pratiques interdites par la plateforme proscrites.\n\n`+
`**Article 10 — Hiérarchie.** Respecte les périmètres de responsabilité et les décisions prises par les personnes habilitées. Aucun responsable ne doit abuser de sa position.\n\n`+
`**Article 11 — Recrutement.** Les candidatures doivent être sincères. Fausses informations, manipulation et candidatures répétées pour contourner une décision sont interdites.\n\n`+
`**Article 12 — Gestions.** Les gestionnaires respectent leur mission, la confidentialité des dossiers et les limites de leurs permissions. Les dossiers d’une autre gestion restent privés.\n\n`+
`**Article 13 — Tickets.** Les tickets servent à des demandes légitimes. Spam, fausses déclarations et sollicitations abusives peuvent entraîner une restriction.\n\n`+
`**Article 14 — Grades et promotions.** Les promotions sont décidées par les responsables habilités. Pressions, favoritisme et demandes insistantes ne donnent aucun droit à une promotion.\n\n`+
`**Article 15 — Absences.** Signale une indisponibilité dans le dispositif dédié. Le motif est facultatif et ne doit pas être divulgué sans nécessité.\n\n`+
`**Article 16 — Sanctions.** Rappel, avertissement, restriction temporaire, exclusion temporaire ou bannissement peuvent être appliqués selon la gravité, le contexte et les récidives. Un cas grave peut justifier une mesure immédiate.\n\n`+
`**Article 17 — Contestations.** Conteste une sanction calmement et en privé via un ticket. Une contestation n’autorise ni harcèlement ni perturbation publique.\n\n`+
`**Article 18 — Règles des plateformes.** Les conditions d’utilisation et règles communautaires de Discord et Roblox s’appliquent également.\n\n`+
`**Article 19 — Modifications.** La direction peut faire évoluer ce règlement. Les changements importants sont annoncés ; la version affichée indique la date de mise à jour.\n\n`+
`**Article 20 — Acceptation.** Pour accéder aux espaces communautaires, clique sur le bouton ci-dessous après avoir lu le règlement.`;

function panelPayload(key) {
  if (['communityCommands','familyCommands'].includes(key)) return require('./qgSchoolVoice').panel();
  if (['absences', 'rankUp'].includes(key)) return require('./qgSchoolFamily').panel(key);
  if (key === 'levelsInfo') return require('./qgLevels').panel();
  if (['giveawaysInfo', 'communityGiveaways', 'familyGiveaways'].includes(key)) return { embeds: [embed('🎁 Giveaways', 'Les giveaways sont créés par la Gestion Animation.\n\nFormat : `=giveaway creer 1h 1 Récompense`\nDurée : de 1 minute à 30 jours • 1 à 20 gagnants.\n\nLes membres vérifiés participent avec le bouton. Résultats et participation sont conservés par le bot.')], allowedMentions: { parse: [] } };
  if (key === 'foundationReports') return { embeds: [embed('📊 Rapports de la Fondation', 'Salon réservé au Créateur et au Gérant Global.\n\n**Modèle de rapport**\n• Période concernée\n• Gestion ou sujet\n• Actions réalisées et résultats\n• Difficultés ou décisions attendues\n• Prochaines étapes\n\nÉvite d’inclure des informations personnelles qui ne sont pas nécessaires au suivi.')], allowedMentions: { parse: [] } };
  if (key === 'managementFollowup') return null;
  if (key === 'tickets') {
    const banner = embed('🎫 Support du QG', '**Assistance générale** — aide et questions sur le serveur ou le bot.\n\n**Signalement** — signaler un incident ou un membre ; ajoute les éléments utiles.\n\n**Réclamation** — demander le réexamen d’une décision, avec son contexte.\n\n**Contacter la Fondation** — transmettre une demande confidentielle, visible uniquement par toi et la Fondation.\n\nChoisis une catégorie dans le menu. Ne partage jamais de mot de passe, cookie ou code de connexion.');
    const art = localImage(path.join(__dirname, '..', 'assets', 'qg-support-banner.gif'), 'qg-support-banner.gif');
    banner.setColor(0xF0F0F0).setImage(art.url);
    return { embeds: [banner], files: [art.file], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qg:ticket-type').setPlaceholder('Choisir le sujet du ticket').addOptions(
      { label: 'Questions / Aide', value: 'questions', description: 'Une question ou besoin d’assistance', emoji: '✉️' },
      { label: 'Signaler un joueur', value: 'report', description: 'Signaler un comportement et joindre des preuves', emoji: '⚒️' },
      { label: 'Réclamation', value: 'complaint', description: 'Contester une décision de manière confidentielle', emoji: '⚖️' },
      { label: 'Contacter la Fondation', value: 'foundation', description: 'Demande confidentielle à la Fondation', emoji: '👑' }
    ))], allowedMentions: { parse: [] } };
  }
  if (key === 'help') return { embeds: [embed('📚 Aide et FAQ', 'Pour une demande personnelle, ouvre un ticket dans le salon Support. Pour une question sur le fonctionnement de la famille, consulte le Guide famille. Les commandes sont disponibles dans les salons de discussion autorisés.')], allowedMentions: { parse: [] } };
  if (key === 'familyGuide') return { embeds: [embed('📚 Guide de la famille', `**Fonctionnement**\nLa famille s’organise autour de la Direction, de quatre gestions indépendantes et des grades familiaux.\n\n**Direction**\nCréateur → Gérant Global → Administrateur. Fondation : Créateur et Gérant Global.\n\n**Gestions**\nTickets, Recrutement, Animation et Réseaux. Chaque équipe est dirigée par son responsable et conserve la confidentialité de ses dossiers.\n\n**Grades**\nMembre Test → Membre Confirmé → Membre Expert → Membre Prestigieux → Membre Senior. Les promotions sont examinées par la Direction et ne sont jamais automatiques.\n\n**Candidatures**\nLe recrutement famille débute dans <#${channelMap().familyApplications}> et se déroule en MP. Une candidature à une gestion se dépose dans <#${channelMap().joinManagement}>.\n\n**Absences**\nDéclare et gère tes dates dans <#${channelMap().absences}>. Le motif reste facultatif.\n\n**Comportement**\nRespecte le règlement, la confidentialité des dossiers et les consignes des salons. Ouvre un ticket pour demander de l’aide ou contester une décision.`)], allowedMentions: { parse: [] } };
  if (key === 'familyChart') return { embeds: [embed('📌 Organigramme', `**Direction**\n👑 Créateur\n⚜️ Gérant Global\n🛡️ Administrateur\n\n**Responsables**\n🎫 Tickets • 📋 Recrutement • 🎉 Animation • 🌐 Réseaux\n\n**Équipes**\nGestion Tickets • Gestion Recrutement • Gestion Animation • Gestion Réseaux\n\n**Grades familiaux**\nMembre Senior • Membre Prestigieux • Membre Expert • Membre Confirmé • Membre Test\n\nLes noms des titulaires sont consultables via les rôles Discord correspondants.`)], allowedMentions: { parse: [] } };
  if (key === 'rules') return require('./qgEntryVerification').panel();
  if (key === 'notifications') return { embeds: [embed('🔔 Rôles de notifications', 'Choisis les annonces que tu souhaites recevoir. Tu peux modifier ton choix à tout moment.')], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qgs:notifs').setPlaceholder('Choisir les notifications').setMinValues(0).setMaxValues(4).addOptions(
    { label: 'Annonces', value: 'notifAnnouncements', emoji: '🔔' }, { label: 'Roleplay', value: 'notifRp', emoji: '🎭' }, { label: 'Réseaux', value: 'notifNetworks', emoji: '🌐' }, { label: 'Serveurs', value: 'notifServers', emoji: '📡' }
  ))] , allowedMentions: { parse: [] } };
  if (key === 'familyApplications') {
    const banner = embed('📋 Candidature — Famille SchoolRP', '**Une famille se construit avec des personnes respectueuses, sincères et motivées.**\n\nAvant de commencer, prépare ton pseudo Roblox et prends quelques minutes pour répondre personnellement aux questions. Une candidature complète et honnête aidera l’équipe à mieux te connaître.\n\n**Comment se déroule le recrutement ?**\nLe questionnaire se fait en messages privés avec le bot, une question à la fois. Tes réponses sont sauvegardées afin que tu puisses avancer sans formulaire Discord. À la fin, ton dossier est transmis à la Gestion Recrutement ; une personne de l’équipe étudiera ta candidature.\n\nClique sur **Déposer ma candidature** pour recevoir la première question en MP. Les messages privés du serveur doivent être ouverts.');
    const art = localImage(path.join(__dirname, '..', 'assets', 'qg-initial.gif'), 'qg-initial.gif');
    banner.setColor(0xF0F0F0).setImage(art.url);
    return { embeds: [banner], files: [art.file], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:family-apply').setLabel('Déposer ma candidature').setStyle(ButtonStyle.Secondary))], allowedMentions: { parse: [] } };
  }
  if (key === 'joinManagement') return { embeds: [embed('✦ Rejoindre une gestion', 'Choisis une gestion pour remplir une candidature confidentielle. Tu dois déjà être membre de la famille.')], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qgs:management-apply').setPlaceholder('Choisir une gestion').addOptions(
    { label: 'Gestion Tickets', value: 'ticketsManagement' }, { label: 'Gestion Recrutement', value: 'recruitmentManagement' }, { label: 'Gestion Animation', value: 'animationManagement' }, { label: 'Gestion Réseaux', value: 'networksManagement' }
  ))] , allowedMentions: { parse: [] } };
  if (key === 'absences') return { embeds: [embed('📆 Déclarer une absence', 'Les demandes d’absence seront traitées par les responsables. Indique les dates et un motif facultatif dans un ticket auprès de ton responsable.')], allowedMentions: { parse: [] } };
  if (key === 'rankUp') return { embeds: [embed('📈 Demande de promotion', 'Une promotion peut être proposée au responsable concerné. Elle n’est jamais automatique et doit être justifiée. Contacte ton responsable via un ticket.')], allowedMentions: { parse: [] } };
  return null;
}

function preview(guild) {
  const s = state(), roles = roleMap(), cats = categoryMap(), channels = channelMap();
  const categoryIds = Object.fromEntries(layout.categories.map(([key, name]) => [key, guild.channels.cache.has(cats[key]) ? cats[key] : guild.channels.cache.find(c => c.type === 4 && c.name === name)?.id]));
  return {
    rolesMissing: layout.installRoleDefs.filter(([k]) => !guild.roles.cache.has(roles[k]) && !guild.roles.cache.find(r => r.name === layout.installRoleDefs.find(x => x[0] === k)[1])).length,
    categoriesMissing: layout.categories.filter(([k, name]) => !categoryIds[k]).length,
    channelsMissing: layout.channels.filter(([k, name, parent]) => !guild.channels.cache.has(channels[k]) && !guild.channels.cache.find(c => c.parentId === categoryIds[parent] && c.name === name)).length,
    installedAt: s.schoolSetup?.installedAt || null
  };
}

async function install(guild, client) {
  if (guild.id !== config.guildId) throw new Error('Cette installation est réservée au serveur QG configuré.');
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(P.ManageRoles) || !me.permissions.has(P.ManageChannels) || !me.permissions.has(P.MoveMembers)) throw new Error('Le bot doit avoir Gérer les rôles, Gérer les salons et Déplacer des membres. Place aussi son rôle au-dessus des rôles qu’il crée.');
  const lockKey = 'qg-school-install';
  if (install.running) throw new Error('Une installation est déjà en cours.');
  install.running = true;
  try {
    const r = {}, cats = {}, chs = {}, created = { roles: 0, categories: 0, channels: 0 };
    // Only exact saved IDs or exact names are reused; no existing element is deleted or moved.
    for (const [key, name, color, options = {}] of [...layout.installRoleDefs].reverse()) {
      const savedId = roleMap()[key];
      let role = (savedId && await guild.roles.fetch(savedId).catch(() => null)) || guild.roles.cache.find(x => x.name === name && !x.managed);
      if (!role) { role = await guild.roles.create({ name, color, permissions: [], hoist: !options.separator, mentionable: false, reason: 'Installation SchoolRP confirmée par le propriétaire du QG' }); created.roles++; }
      else if (role.permissions.has(P.Administrator) && !options.separator) throw new Error(`Le rôle « ${role.name} » a Administrator. Retire cette permission manuellement avant de continuer afin que les accès privés restent réellement privés.`);
      if (options.separator && role.editable) await role.edit({ permissions: [], hoist: false, mentionable: false }, { reason: 'Les rôles séparateurs ne portent aucune permission.' });
      r[key] = role.id; store(s => { s.schoolRoles ||= {}; s.schoolRoles[key] = role.id; });
    }
    const installedRoles = await guild.roles.fetch();
    for (const [key, , , options = {}] of layout.dividerRoleDefs) {
      const separator = await guild.roles.fetch(r[key]);
      const anchorDef = layout.roleDefs.find(item => item[0] === options.anchor);
      const anchor = await guild.roles.fetch(r[options.anchor]).catch(() => null) || installedRoles.find(role => role.name === anchorDef?.[1]);
      if (separator?.editable && anchor?.editable) await separator.setPosition(anchor.position + 1, { reason: 'Placement du séparateur de section QG' });
    }
    const owner = await guild.fetchOwner();
    await owner.roles.add(r.creator, 'Créateur de la famille SchoolRP');
    // The legacy QG roles predate this least-privilege structure. Remove Administrator
    // from them so they cannot bypass the new private-space overwrites.
    for (const key of ['creator', 'admin']) {
      const legacyId = state().roles?.[key];
      if (!legacyId) continue;
      const legacyRole = await guild.roles.fetch(legacyId).catch(() => null);
      if (legacyRole?.permissions.has(P.Administrator)) {
        const safePermissions = key === 'admin' ? [P.ViewAuditLog, P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages, P.MoveMembers, P.MuteMembers, P.DeafenMembers] : [];
        await legacyRole.setPermissions(safePermissions, `Retrait de la permission Administrator pour respecter la matrice de sécurité SchoolRP (${key})`);
      }
    }
    for (const [key, name] of layout.categories) {
      let cat = (categoryMap()[key] && await guild.channels.fetch(categoryMap()[key]).catch(() => null)) || guild.channels.cache.find(c => c.type === 4 && c.name === name);
      const permissionOverwrites = layout.overwrites(guild.id, client.user.id, r, layout.categories.find(x => x[0] === key)[2]);
      if (!cat) { cat = await guild.channels.create({ name, type: 4, permissionOverwrites, reason: 'Installation SchoolRP confirmée' }); created.categories++; }
      else if (cat.type !== 4) throw new Error(`L’élément enregistré pour ${name} n’est pas une catégorie.`);
      cats[key] = cat.id; store(s => { s.schoolCategories ||= {}; s.schoolCategories[key] = cat.id; });
    }
    for (const [key, name, parentKey, type] of layout.channels) {
      const parent = await guild.channels.fetch(cats[parentKey]);
      let ch = (channelMap()[key] && await guild.channels.fetch(channelMap()[key]).catch(() => null)) || guild.channels.cache.find(c => c.parentId === parent.id && c.name === name);
      const overwrites = layout.overwrites(guild.id, client.user.id, r, layout.categories.find(x => x[0] === parentKey)[2], { channelKey: key });
      if (!ch) { ch = await guild.channels.create({ name, type, parent: parent.id, permissionOverwrites: overwrites, reason: 'Installation SchoolRP confirmée' }); created.channels++; }
      else if (ch.type !== type) throw new Error(`Le salon ${name} existe déjà avec un type incompatible.`);
      if (key === 'foundationReports') await ch.permissionOverwrites.set(overwrites, 'Configuration du salon Rapports Fondation');
      chs[key] = ch.id; store(s => { s.schoolChannels ||= {}; s.schoolChannels[key] = ch.id; });
    }
    for (const [key, channelKey] of Object.entries({ rules: 'rules', notifications: 'notifications', tickets: 'tickets', help: 'help', familyApplications: 'familyApplications', joinManagement: 'joinManagement', absences: 'absences', rankUp: 'rankUp', levelsInfo: 'levelsInfo', familyGuide: 'familyGuide', familyChart: 'familyChart', giveawaysInfo: 'giveawaysInfo', communityCommands: 'communityCommands', familyCommands: 'familyCommands', familyGiveaways: 'familyGiveaways', foundationReports: 'foundationReports', managementFollowup: 'managementFollowup' })) {
      let payload = panelPayload(key); if (key === 'managementFollowup') payload = await require('./qgSchoolManagementBoard').buildPanel(guild);
      if (!payload) continue;
      const channel = await guild.channels.fetch(chs[channelKey]);
      const record = state().schoolPanels?.[key];
      let message = record?.channelId === channel.id ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
      if (!message) message = await channel.send(payload); else await message.edit(payload);
      store(s => { s.schoolPanels ||= {}; s.schoolPanels[key] = { channelId: channel.id, messageId: message.id }; });
    }
    created.separatorSync = await require('./qgSchoolSeparators').syncGuild(guild);
    const overview = { installedAt: Date.now(), guildId: guild.id, version: 2, created };
    store(s => { s.schoolSetup = overview; s.schoolAudit ||= []; s.schoolAudit.push({ id: `install-${Date.now()}`, at: Date.now(), type: 'installation', actorId: owner.id, details: overview.created }); });
    return overview;
  } finally { install.running = false; }
}

function authorized(i) { return i.guildId === config.guildId && (i.user.id === i.guild?.ownerId || i.user.id === config.ownerId); }
function updatePreview(guild) {
  const channels = guild.channels.cache;
  const missingVoices = ['communityVoice3', 'communityVoice4', 'communityVoice5'].filter(key => {
    const def = layout.channels.find(item => item[0] === key);
    return !channels.has(channelMap()[key]) && !channels.find(channel => channel.parentId === categoryMap().communityVoice && channel.name === def[1]);
  });
  return { roles: 0, voices: missingVoices.length, panels: 5 };
}

async function updateIncremental(guild, client) {
  if (guild.id !== config.guildId) throw new Error('Cette mise à jour est réservée au serveur QG configuré.');
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(P.ManageChannels)) throw new Error('Le bot doit avoir Gérer les salons.');
  if (install.running) throw new Error('Une opération de configuration est déjà en cours.');
  install.running = true;
  try {
    const made = { roles: 0, voices: 0, panels: 0 };
    const channels = await guild.channels.fetch();
    let communityCategory = categoryMap().communityVoice && await guild.channels.fetch(categoryMap().communityVoice).catch(() => null);
    communityCategory ||= channels.find(channel => channel.type === 4 && channel.name === layout.categories.find(item => item[0] === 'communityVoice')?.[1]);
    if (!communityCategory || communityCategory.type !== 4) throw new Error('La catégorie de vocals communautaires est introuvable. Aucun salon existant n’a été modifié.');
    for (const key of ['communityVoice3', 'communityVoice4', 'communityVoice5']) {
      const [, name, , type] = layout.channels.find(item => item[0] === key);
      let channel = (channelMap()[key] && channels.get(channelMap()[key])) || channels.find(item => item.parentId === communityCategory.id && item.name === name);
      if (!channel) {
        channel = await guild.channels.create({ name, type, parent: communityCategory.id, permissionOverwrites: layout.overwrites(guild.id, client.user.id, roleMap(), 'communityVoice', { channelKey: key }), reason: 'Ajout ciblé des vocaux communautaires QG' });
        made.voices++;
      }
      store(data => { data.schoolChannels ||= {}; data.schoolChannels[key] = channel.id; });
    }

    // Give only the two Foundation roles post access in the reports channel; all other channel settings stay untouched.
    let reports = channelMap().foundationReports && await guild.channels.fetch(channelMap().foundationReports).catch(() => null);
    reports ||= channels.find(channel => channel.name === '📊・rapports-fondation' && channel.parentId === categoryMap().foundation);
    if (reports?.isTextBased?.()) {
      const ids = roleMap();
      for (const key of ['creator', 'globalManager']) if (ids[key]) await reports.permissionOverwrites.edit(ids[key], { ViewChannel: true, ReadMessageHistory: true, SendMessages: true });
    }

    for (const [panelKey, channelKey, title] of [
      ['rules', 'rules', 'Bienvenue au QG'],
      ['tickets', 'tickets', 'Support du QG'],
      ['familyApplications', 'familyApplications', 'Candidature — Famille SchoolRP'],
      ['foundationReports', 'foundationReports', 'Rapports de la Fondation'],
      ['managementFollowup', 'managementFollowup', 'Classement et suivi des gestions'],
      ['communityCommands', 'communityCommands', 'Mon vocal temporaire'],
      ['familyCommands', 'familyCommands', 'Mon vocal temporaire']
    ]) {
      let channel = channelMap()[channelKey] && await guild.channels.fetch(channelMap()[channelKey]).catch(() => null);
      if (!channel?.isTextBased?.()) continue;
      let payload = panelKey === 'managementFollowup' ? await require('./qgSchoolManagementBoard').buildPanel(guild) : panelPayload(panelKey);
      const record = state().schoolPanels?.[panelKey];
      let message = record?.channelId === channel.id ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
      if (!message) {
        const recent = await channel.messages.fetch({ limit: 50 });
        message = recent.find(item => item.author.id === client.user.id && item.embeds.some(e => e.title?.includes(title) || (panelKey === 'tickets' && e.title === '🎫 Support de la famille') || (panelKey === 'rules' && e.title === '📜 Règlement de la famille')));
      }
      if (message?.author.id !== client.user.id) message = null;
      message = message ? await message.edit(payload) : await channel.send(payload);
      store(data => { data.schoolPanels ||= {}; data.schoolPanels[panelKey] = { channelId: channel.id, messageId: message.id }; });
      made.panels++;
    }


    store(data => { data.schoolSetup ||= { guildId: guild.id, installedAt: Date.now(), version: 1 }; data.schoolSetup.updatedAt = Date.now(); data.schoolSetup.version = Math.max(2, Number(data.schoolSetup.version || 1)); });
    made.policy = await require('./qgCommunityPolicy').apply(guild, client);
    audit('mise_a_jour_ciblee', client.user.id, made);
    return made;
  } finally { install.running = false; }
}

async function handle(i) {
  if (!i.customId?.startsWith('qgs:')) return false;
  if (i.guildId !== config.guildId) { await i.reply({ content: 'Action réservée au serveur QG.', flags: MessageFlags.Ephemeral }); return true; }
  if (await require('./qgEntryVerification').handle(i)) return true;
  if (await require('./qgSchoolGiveaways').handle(i)) return true;
  if (await require('./qgSchoolFamily').handle(i)) return true;
  if (await require('./qgSchoolApplications').handle(i)) return true;
  if (await require('./qgSchoolVoice').handle(i)) return true;
  if (await require('./qgSchoolVoice').modal(i)) return true;
  if (i.customId === 'qgs:confirm-install') {
    if (!authorized(i)) { await i.reply({ content: 'Seul le propriétaire configuré du QG peut installer la structure.', flags: MessageFlags.Ephemeral }); return true; }
    await i.deferUpdate();
    const result = await install(i.guild, i.client);
    await i.editReply({ content: `✅ Structure installée sans supprimer d’éléments existants : ${result.created.roles} rôles, ${result.created.categories} catégories et ${result.created.channels} salons.`, embeds: [], components: [] }); return true;
  }
  if (i.customId === 'qgs:confirm-update') {
    if (!authorized(i)) { await i.reply({ content: 'Seul le propriétaire configuré du QG peut lancer la mise à jour.', flags: MessageFlags.Ephemeral }); return true; }
    await i.deferUpdate();
    const result = await updateIncremental(i.guild, i.client);
    await i.editReply({ content: `✅ Mise à jour terminée : ${result.voices} vocal(aux) ajouté(s), ${result.panels} panel(s) actualisé(s). Permissions communautaires appliquées, anti-spam activé, Gestion Support renommée et giveaway communautaire supprimé. Aucun séparateur ajouté ou modifié.`, embeds: [], components: [] }); return true;
  }
  if (i.customId === 'qgs:cancel-update') { if (!authorized(i)) { await i.reply({ content: 'Action réservée au propriétaire du QG.', flags: MessageFlags.Ephemeral }); return true; } await i.update({ content: 'Mise à jour annulée. Aucun changement effectué.', embeds: [], components: [] }); return true; }
  if (i.customId === 'qgs:cancel-install') { if (!authorized(i)) { await i.reply({ content: 'Action réservée au propriétaire du QG.', flags: MessageFlags.Ephemeral }); return true; } await i.update({ content: 'Installation annulée. Aucun changement effectué.', embeds: [], components: [] }); return true; }
  const s = state(), r = s.schoolRoles || {};
  if (i.customId === 'qgs:notifs') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await i.guild.members.fetch(i.user.id);
    if (!member.roles.cache.has(r.community)) return i.editReply('Accepte d’abord le règlement.');
    const keys = ['notifAnnouncements', 'notifRp', 'notifNetworks', 'notifServers'];
    const wanted = new Set(i.values);
    for (const key of keys) if (r[key]) wanted.has(key) ? await member.roles.add(r[key]) : await member.roles.remove(r[key]);
    audit('notifications_modifiees', i.user.id, { roles: [...wanted] });
    return i.editReply('Tes préférences de notifications ont été enregistrées.');
  }
  if (i.customId === 'qgs:family-apply') {
    const { beginFamilyRecruitment } = require('./qgSchoolApplications');
    await beginFamilyRecruitment(i); return true;
  }
  if (i.customId === 'qgs:management-apply') {
    const { beginManagementApplication } = require('./qgSchoolApplications');
    await beginManagementApplication(i); return true;
  }
  if (!i.replied && !i.deferred) await i.reply({ content: 'Cette action a expiré ou n’est plus disponible.', flags: MessageFlags.Ephemeral }).catch(() => {});
  return true;
}

async function execute(i) {
  if (!authorized(i)) return i.reply({ content: 'Cette commande est réservée au propriétaire du serveur QG.', flags: MessageFlags.Ephemeral });
  const action = i.options.getSubcommand();
  if (action === 'diagnostic') {
    const me = await i.guild.members.fetchMe(), p = preview(i.guild);
    const fs = require('fs'), path = require('path'); let storage = 'indisponible';
    try { fs.accessSync(path.join(__dirname, '..', 'data'), fs.constants.R_OK | fs.constants.W_OK); storage = 'répertoire data accessible en lecture/écriture'; } catch {}
    const hasPerms = me.permissions.has(P.ManageRoles) && me.permissions.has(P.ManageChannels) && me.permissions.has(P.MoveMembers);
    return i.reply({ flags: MessageFlags.Ephemeral, embeds: [embed('Diagnostic QG SchoolRP', `Serveur cible : ${i.guild.id}\nBot : ${hasPerms ? '✅ Gérer les rôles, Gérer les salons et Déplacer des membres présents' : '❌ Permissions manquantes : Gérer les rôles, Gérer les salons et/ou Déplacer des membres'}\nRôles manquants : ${p.rolesMissing}\nCatégories manquantes : ${p.categoriesMissing}\nSalons manquants : ${p.channelsMissing}\nStockage : ${storage}\nInstallation : ${p.installedAt ? `<t:${Math.floor(p.installedAt / 1000)}:R>` : 'pas encore faite'}`)] });
  }
  if (action === 'synchroniser-separateurs') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await require('./qgSchoolSeparators').syncGuild(i.guild);
    audit('separateurs_synchronises', i.user.id, result);
    return i.editReply(`✅ Séparateurs recalculés pour **${result.members} membres**. Ajouts : ${result.added} • Retraits : ${result.removed}.`);
  }
  if (action === 'mise-a-jour') {
    const p = updatePreview(i.guild);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:confirm-update').setLabel('Confirmer la mise à jour').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('qgs:cancel-update').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
    return i.reply({ flags: MessageFlags.Ephemeral, embeds: [embed('Mise à jour communautaire du QG', `Vocaux manquants à ajouter : **${p.voices}**.\n\n• Accès initial limité au règlement.\n• Accueil et Informations en lecture seule pour les membres.\n• Protections messages et vocaux dans tout le QG ; Direction / Fondation exemptées des filtres.\n• Spam : timeout 15 min, ban 24 h, puis définitif ; antécédents conservés.\n• Médias et suggestions avec fils de discussion.\n• Panel vocal dans les salons commandes.\n• Gestion Tickets renommée Gestion Support.\n• **Suppression du seul salon giveaways communautaire, avec ses messages et annulation de ses tirages actifs.**\n\nLes séparateurs ne sont ni ajoutés, ni renommés, ni repositionnés. Le bot doit pouvoir gérer les rôles, salons, messages, fils et sanctions.`)], components: [row] });
  }
  if (action === 'apercu') {
    const p = preview(i.guild);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:confirm-install').setLabel('Confirmer l’installation').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('qgs:cancel-install').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
    return i.reply({ flags: MessageFlags.Ephemeral, embeds: [embed('Prévisualisation de l’installation', `Serveur : **${i.guild.name}** (${i.guild.id})\n\nRôles à créer : **${p.rolesMissing}**\nCatégories à créer : **${p.categoriesMissing}**\nSalons à vérifier/créer : **${p.channelsMissing}**\n\nAucun salon, rôle ou message ne sera supprimé. L’installation retire aussi Administrator des anciens rôles QG « Creator » et « Administrateur » pour empêcher le contournement des espaces privés ; les droits de modération usuels restent sur « Administrateur ».`)], components: [row] });
  }
  if (action === 'installer' || action === 'reparer') {
    const p = preview(i.guild);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:confirm-install').setLabel('Confirmer l’installation').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('qgs:cancel-install').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
    return i.reply({ flags: MessageFlags.Ephemeral, embeds: [embed('Confirmer l’installation SchoolRP', `Serveur : **${i.guild.name}**\n\nRôles manquants : ${p.rolesMissing}\nCatégories manquantes : ${p.categoriesMissing}\nSalons manquants : ${p.channelsMissing}\n\nLa confirmation crée ou réutilise les éléments enregistrés. Aucun salon, rôle ou message n’est supprimé. Les anciens rôles QG « Creator » et « Administrateur » perdent Administrator pour protéger les nouveaux espaces privés ; « Administrateur » conserve les droits de modération usuels.`)], components: [row] });
  }
}

module.exports = { execute, handle, install, updateIncremental, updatePreview, preview, panelPayload, ruleText, authorized };
