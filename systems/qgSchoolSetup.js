const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  PermissionFlagsBits: P, StringSelectMenuBuilder
} = require('discord.js');
const config = require('../config/qg');
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

const ruleText = `Bienvenue dans la famille SchoolRP. L’accès au serveur implique le respect des règles ci-dessous, de Discord et de Roblox. Version 1 • 17 octobre 2026.\n\n`+
`**Article 1 — Respect.** Chacun s’adresse aux autres avec dignité. Les insultes répétées, humiliations, provocations malveillantes et comportements hostiles sont interdits.\n\n`+
`**Article 2 — Harcèlement et discriminations.** Menaces, harcèlement, discriminations, propos haineux et incitation à la violence sont interdits, y compris en messages privés lorsqu’ils sont liés à la communauté.\n\n`+
`**Article 3 — Comportement général.** Évite les règlements de comptes publics. Les désaccords se traitent calmement dans le bon espace ou avec l’équipe.\n\n`+
`**Article 4 — Spam et publicité.** Spam, flood, mentions abusives, arnaques, invitations et publicités sans autorisation sont interdits, en public comme en démarchage privé.\n\n`+
`**Article 5 — Contenus interdits.** Aucun contenu sexuel explicite, choquant, illégal, violent graphique ou lien malveillant. Respecte les règles des plateformes.\n\n`+
`**Article 6 — Confidentialité.** Ne diffuse pas de données personnelles, conversations privées, identifiants ou contenus privés sans accord. L’usurpation d’identité est interdite.\n\n`+
`**Article 7 — Salons textuels.** Utilise chaque salon selon son thème et respecte ses consignes. Les contenus hors sujet peuvent être déplacés ou retirés par l’équipe.\n\n`+
`**Article 8 — Salons vocaux.** Nuisances sonores volontaires, harcèlement vocal, soundboard abusive et perturbations répétées sont interdits. Respecte les personnes présentes.\n\n`+
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
  if (['absences', 'rankUp'].includes(key)) return require('./qgSchoolFamily').panel(key);
  if (key === 'levelsInfo') return require('./qgLevels').panel();
  if (['giveawaysInfo', 'communityGiveaways', 'familyGiveaways'].includes(key)) return { embeds: [embed('🎁 Giveaways', 'Les giveaways sont créés par la Gestion Animation.\n\nFormat : `=giveaway creer 1h 1 Récompense`\nDurée : de 1 minute à 30 jours • 1 à 20 gagnants.\n\nLes membres vérifiés participent avec le bouton. Résultats et participation sont conservés par le bot.')], allowedMentions: { parse: [] } };
  if (key === 'tickets') return { embeds: [embed('🎫 Support de la famille', 'Ouvre un ticket privé pour une question, un problème ou un signalement. Fournis les éléments utiles et ne partage jamais de mot de passe.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:ticket').setLabel('Ouvrir un ticket').setEmoji('✉️').setStyle(ButtonStyle.Primary))], allowedMentions: { parse: [] } };
  if (key === 'help') return { embeds: [embed('📚 Aide et FAQ', 'Pour une demande personnelle, ouvre un ticket dans le salon Support. Pour une question sur le fonctionnement de la famille, consulte le Guide famille. Les commandes sont disponibles dans les salons de discussion autorisés.')], allowedMentions: { parse: [] } };
  if (key === 'familyGuide') return { embeds: [embed('📚 Guide de la famille', `**Fonctionnement**\nLa famille s’organise autour de la Direction, de quatre gestions indépendantes et des grades familiaux.\n\n**Direction**\nCréateur → Gérant Global → Administrateur. Fondation : Créateur et Gérant Global.\n\n**Gestions**\nTickets, Recrutement, Animation et Réseaux. Chaque équipe est dirigée par son responsable et conserve la confidentialité de ses dossiers.\n\n**Grades**\nMembre Test → Membre Confirmé → Membre Expert → Membre Prestigieux → Membre Senior. Les promotions sont examinées par la Direction et ne sont jamais automatiques.\n\n**Candidatures**\nLe recrutement famille débute dans <#${channelMap().familyApplications}> et se déroule en MP. Une candidature à une gestion se dépose dans <#${channelMap().joinManagement}>.\n\n**Absences**\nDéclare et gère tes dates dans <#${channelMap().absences}>. Le motif reste facultatif.\n\n**Comportement**\nRespecte le règlement, la confidentialité des dossiers et les consignes des salons. Ouvre un ticket pour demander de l’aide ou contester une décision.`)], allowedMentions: { parse: [] } };
  if (key === 'familyChart') return { embeds: [embed('📌 Organigramme', `**Direction**\n👑 Créateur\n⚜️ Gérant Global\n🛡️ Administrateur\n\n**Responsables**\n🎫 Tickets • 📋 Recrutement • 🎉 Animation • 🌐 Réseaux\n\n**Équipes**\nGestion Tickets • Gestion Recrutement • Gestion Animation • Gestion Réseaux\n\n**Grades familiaux**\nMembre Senior • Membre Prestigieux • Membre Expert • Membre Confirmé • Membre Test\n\nLes noms des titulaires sont consultables via les rôles Discord correspondants.`)], allowedMentions: { parse: [] } };
  if (key === 'rules') return { embeds: [embed('📜 Règlement de la famille', ruleText)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:verify').setLabel("J'ai lu et j'accepte le règlement").setEmoji('✅').setStyle(ButtonStyle.Success))], allowedMentions: { parse: [] } };
  if (key === 'notifications') return { embeds: [embed('🔔 Rôles de notifications', 'Choisis les annonces que tu souhaites recevoir. Tu peux modifier ton choix à tout moment.')], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qgs:notifs').setPlaceholder('Choisir les notifications').setMinValues(0).setMaxValues(4).addOptions(
    { label: 'Annonces', value: 'notifAnnouncements', emoji: '🔔' }, { label: 'Roleplay', value: 'notifRp', emoji: '🎭' }, { label: 'Réseaux', value: 'notifNetworks', emoji: '🌐' }, { label: 'Serveurs', value: 'notifServers', emoji: '📡' }
  ))] , allowedMentions: { parse: [] } };
  if (key === 'familyApplications') return { embeds: [embed('📋 Rejoindre la famille', 'La candidature famille se déroule en conversation privée avec le bot. Clique pour commencer. Une décision est toujours prise par l’équipe.')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:family-apply').setLabel('Commencer ma candidature').setStyle(ButtonStyle.Primary))], allowedMentions: { parse: [] } };
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
    rolesMissing: layout.roleDefs.filter(([k]) => !guild.roles.cache.has(roles[k]) && !guild.roles.cache.find(r => r.name === layout.roleDefs.find(x => x[0] === k)[1])).length,
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
    for (const [key, name, color] of [...layout.roleDefs].reverse()) {
      const savedId = roleMap()[key];
      let role = (savedId && await guild.roles.fetch(savedId).catch(() => null)) || guild.roles.cache.find(x => x.name === name && !x.managed);
      if (!role) { role = await guild.roles.create({ name, color, permissions: [], hoist: true, mentionable: false, reason: 'Installation SchoolRP confirmée par le propriétaire du QG' }); created.roles++; }
      else if (role.permissions.has(P.Administrator)) throw new Error(`Le rôle « ${role.name} » a Administrator. Retire cette permission manuellement avant de continuer afin que les accès privés restent réellement privés.`);
      r[key] = role.id; store(s => { s.schoolRoles ||= {}; s.schoolRoles[key] = role.id; });
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
      chs[key] = ch.id; store(s => { s.schoolChannels ||= {}; s.schoolChannels[key] = ch.id; });
    }
    for (const [key, channelKey] of Object.entries({ rules: 'rules', notifications: 'notifications', tickets: 'tickets', help: 'help', familyApplications: 'familyApplications', joinManagement: 'joinManagement', absences: 'absences', rankUp: 'rankUp', levelsInfo: 'levelsInfo', familyGuide: 'familyGuide', familyChart: 'familyChart', giveawaysInfo: 'giveawaysInfo', communityGiveaways: 'communityGiveaways', familyGiveaways: 'familyGiveaways' })) {
      const payload = panelPayload(key); if (!payload) continue;
      const channel = await guild.channels.fetch(chs[channelKey]);
      const record = state().schoolPanels?.[key];
      let message = record?.channelId === channel.id ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
      if (!message) message = await channel.send(payload); else await message.edit(payload);
      store(s => { s.schoolPanels ||= {}; s.schoolPanels[key] = { channelId: channel.id, messageId: message.id }; });
    }
    const overview = { installedAt: Date.now(), guildId: guild.id, version: 1, created };
    store(s => { s.schoolSetup = overview; s.schoolAudit ||= []; s.schoolAudit.push({ id: `install-${Date.now()}`, at: Date.now(), type: 'installation', actorId: owner.id, details: overview.created }); });
    return overview;
  } finally { install.running = false; }
}

function authorized(i) { return i.guildId === config.guildId && (i.user.id === i.guild?.ownerId || i.user.id === config.ownerId); }
async function handle(i) {
  if (!i.customId?.startsWith('qgs:')) return false;
  if (i.guildId !== config.guildId) { await i.reply({ content: 'Action réservée au serveur QG.', flags: MessageFlags.Ephemeral }); return true; }
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
  if (i.customId === 'qgs:cancel-install') { if (!authorized(i)) { await i.reply({ content: 'Action réservée au propriétaire du QG.', flags: MessageFlags.Ephemeral }); return true; } await i.update({ content: 'Installation annulée. Aucun changement effectué.', embeds: [], components: [] }); return true; }
  const s = state(), r = s.schoolRoles || {};
  if (i.customId === 'qgs:verify') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await i.guild.members.fetch(i.user.id);
    const legacyMemberRole = state().roles?.member;
    if (!r.verified || !r.community || !legacyMemberRole) throw new Error('Rôles de vérification incomplets. Relance /setup-serveur reparer.');
    if ([r.verified, r.community, legacyMemberRole].every(id => member.roles.cache.has(id))) return i.editReply('Tu as déjà accepté le règlement.');
    await member.roles.add([r.verified, r.community, legacyMemberRole], 'Acceptation du règlement QG SchoolRP');
    audit('reglement_accepte', i.user.id, { version: 1 });
    return i.editReply('✅ Règlement accepté. Les espaces autorisés sont maintenant accessibles.');
  }
  if (i.customId === 'qgs:notifs') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await i.guild.members.fetch(i.user.id);
    if (!member.roles.cache.has(r.verified)) return i.editReply('Accepte d’abord le règlement.');
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

module.exports = { execute, handle, install, preview, panelPayload, ruleText, authorized };
