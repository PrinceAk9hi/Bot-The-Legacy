const { ChannelType: T, PermissionFlagsBits: P } = require('discord.js');

const roleDefs = [
    ['creator', '👑・Créateur', 0xF4C95D],
    ['globalManager', '⚜️・Gérant Global', 0xE7B8FF],
    ['administrator', '🛡️・Administrateur', 0xE45C5C],
    ['ticketsLead', '🎫・Responsable Tickets', 0x64B5F6],
    ['recruitmentLead', '📋・Responsable Recrutement', 0x81C784],
    ['animationLead', '🎉・Responsable Animation', 0xFFB74D],
    ['networksLead', '🌐・Responsable Réseaux', 0x4DD0E1],
    ['ticketsManagement', '🎫・Gestion Tickets', 0x42A5F5],
    ['recruitmentManagement', '📋・Gestion Recrutement', 0x66BB6A],
    ['animationManagement', '🎉・Gestion Animation', 0xFFA726],
    ['networksManagement', '🌐・Gestion Réseaux', 0x26C6DA],
    ['senior', 'Membre Senior', 0xD8AA3D],
    ['prestigious', 'Membre Prestigieux', 0xAF8BE8],
    ['expert', 'Membre Expert', 0x4D9D9A],
    ['confirmed', 'Membre Confirmé', 0x4C83C3],
    ['test', 'Membre Test', 0x7C8A9A],
    ['officeAccess', '🔑・Accès Bureau Aven', 0xC5A8E8],
    ['verified', '✅・Membre Vérifié', 0x59BFA1],
    ['community', '🌐・Membre Communautaire', 0x43A6B2],
    ['notifAnnouncements', '🔔・Notifs Annonces', 0xF6D365],
    ['notifRp', '🎭・Notifs RP', 0xCE93D8],
    ['notifNetworks', '🌐・Notifs Réseaux', 0x80CBC4],
    ['notifServers', '📡・Notifs Serveurs', 0x90CAF9]
];

// Incremental additions are kept separate so the update path never reapplies
// the existing roles' names, permissions, or overwrites.
const updateRoleDefs = [
    ['dividerFoundation', '♛・FONDATION', 0x292733, { separator: true, groupDivider: true, anchor: 'creator' }],
    ['dividerDirection', '✦・DIRECTION', 0x292733, { separator: true, groupDivider: true, anchor: 'administrator' }],
    ['dividerResponsibles', '✦・RESPONSABLES', 0x292733, { separator: true, groupDivider: true, anchor: 'ticketsLead' }],
    ['dividerManagement', '✦・GESTIONS', 0x292733, { separator: true, groupDivider: true, anchor: 'ticketsManagement' }],
    ['dividerFamily', '✦・FAMILLE', 0x292733, { separator: true, groupDivider: true, anchor: 'senior' }],
    ['dividerCommunity', '✦・COMMUNAUTÉ', 0x292733, { separator: true, groupDivider: true, anchor: 'community' }],
    ['separatorGrade', 'A / Sanctions / Grade', 0x292733, { separator: true, anchor: 'senior' }],
    ['separatorLevels', 'B / Niveaux', 0x292733, { separator: true }],
    ['separatorFoundation', 'C / Fondation', 0x292733, { separator: true, anchor: 'creator' }],
    ['separatorManagement', 'D / Gestion', 0x292733, { separator: true, anchor: 'ticketsManagement' }],
    ['separatorResponsibility', 'E / Responsabilité', 0x292733, { separator: true, anchor: 'ticketsLead' }],
    ['familyFriend', 'Amis Famille', 0x71C9CE, { anchor: 'test' }],
    ['warning1', 'Avertissement 1', 0xE6B450, { anchor: 'test' }],
    ['warning2', 'Avertissement 2', 0xE67E50, { anchor: 'test' }],
    ['lastChance', 'Dernière Chance', 0xC94C4C, { anchor: 'test' }]
];

// All staff roles deliberately have zero Discord permissions. Access is granted
// through channel overwrites so no managerial role bypasses private spaces.
const categories = [
    ['office', '01 — ♛・BUREAU', 'private'],
    ['foundation', '02 — ♛・ESPACE FONDATION', 'foundation'],
    ['responsibles', '03 — ✦・ESPACE RESPONSABLES GESTION', 'responsibles'],
    ['welcome', '04 — ✦・ACCUEIL', 'welcome'],
    ['information', '05 — ✦・INFORMATIONS', 'information'],
    ['community', '06 — ✦・ESPACE COMMUNAUTAIRE', 'community'],
    ['communityVoice', '07 — ✦・VOCALS COMMUNAUTAIRES', 'communityVoice'],
    ['support', '08 — ✦・SUPPORT', 'support'],
    ['familyInfo', '09 — ✦・ESPACE INFO FAMILLE', 'family'],
    ['family', '10 — ✦・ESPACE FAMILLE', 'family'],
    ['familyVoice', '11 — ✦・VOCALS FAMILLE', 'familyVoice'],
    ['intermanagement', '12 — ✦・DISCUSSION GLOBALE GESTIONS', 'intermanagement'],
    ['managementPlus', '13 — ✦・GESTION+', 'management'],
    ['networks', '14 — ✦・GESTION RÉSEAUX', 'networks'],
    ['logs', '15 — ✦・LOGS', 'logs']
];

const channels = [
    ['officeVoice', '🔊・Bureau Aven', 'office', T.GuildVoice],
    ['foundationRequests', '📥・gestion-requêtes', 'foundation', T.GuildText],
    ['foundationChat', '💬・discussion-fondation', 'foundation', T.GuildText],
    ['foundationAnnouncements', '📢・annonces-fondation', 'foundation', T.GuildText],
    ['foundationReports', '📊・rapports-fondation', 'foundation', T.GuildText],
    ['foundationVoice', '🔊・Réunion Fondation', 'foundation', T.GuildVoice],
    ['responsibleAnnouncements', '📢・annonces-responsables', 'responsibles', T.GuildText],
    ['responsibleChat', '💬・discussion-responsables', 'responsibles', T.GuildText],
    ['managementFollowup', '📊・suivi-des-gestions', 'responsibles', T.GuildText],
    ['responsibleVoice', '🔊・Réunion Responsables', 'responsibles', T.GuildVoice],
    ['arrivals', '✈️・arrivées', 'welcome', T.GuildText],
    ['rules', '📜・règlement', 'welcome', T.GuildText],
    ['notifications', '🔔・rôles-notifs', 'welcome', T.GuildText],
    ['announcements', '📢・annonces', 'information', T.GuildText],
    ['schoolNews', '🏫・actus-school', 'information', T.GuildText],
    ['rpNews', '🎭・actus-rp', 'information', T.GuildText],
    ['networkNews', '🌐・actus-réseaux', 'information', T.GuildText],
    ['serverNews', '📡・actus-serveur', 'information', T.GuildText],
    ['recruitmentNews', '📋・actus-recrutement', 'information', T.GuildText],
    ['supportNews', '🎫・actus-support', 'information', T.GuildText],
    ['giveawaysInfo', '🎁・giveaways', 'information', T.GuildText],
    ['levelsInfo', '🏆・niveaux', 'information', T.GuildText],
    ['communityChat', '💬・discussion', 'community', T.GuildText],
    ['communityMedia', '📸・médias', 'community', T.GuildText],
    ['communityCommands', '🤖・commandes', 'community', T.GuildText],
    ['communitySuggestions', '💡・suggestions', 'community', T.GuildText],
    ['communityGiveaways', '🎁・giveaways-communauté', 'community', T.GuildText],
    ['communityVoice1', '🔊・Vocal 01', 'communityVoice', T.GuildVoice],
    ['communityVoice2', '🔊・Vocal 02', 'communityVoice', T.GuildVoice],
    ['communityVoice3', '🔊・Vocal 03', 'communityVoice', T.GuildVoice],
    ['communityVoice4', '🔊・Vocal 04', 'communityVoice', T.GuildVoice],
    ['communityVoice5', '🔊・Vocal 05', 'communityVoice', T.GuildVoice],
    ['createCommunityVoice', '➕・Créer sa voc', 'communityVoice', T.GuildVoice],
    ['tickets', '🎫・ouvrir-un-ticket', 'support', T.GuildText],
    ['familyApplications', '📋・candidature-famille', 'support', T.GuildText],
    ['help', '📚・aide-et-faq', 'support', T.GuildText],
    ['familyGuide', '📚・guide-famille', 'family', T.GuildText],
    ['familyAnnouncements', '📣・annonces-famille', 'family', T.GuildText],
    ['joinManagement', '📋・rejoindre-une-gestion', 'family', T.GuildText],
    ['rankUp', '📈・rank-up', 'family', T.GuildText],
    ['absences', '📆・absences', 'family', T.GuildText],
    ['familyRoster', '📊・effectifs-famille', 'family', T.GuildText],
    ['familyChart', '📌・organigramme', 'family', T.GuildText],
    ['familyChat', '💬・général-famille', 'family', T.GuildText],
    ['familyMedia', '📸・médias-famille', 'family', T.GuildText],
    ['familySuggestions', '💡・suggestions-famille', 'family', T.GuildText],
    ['familyGiveaways', '🎁・giveaways-famille', 'family', T.GuildText],
    ['familyCommands', '🤖・commandes-famille', 'family', T.GuildText],
    ['familyVoice1', '🔊・Vocal Famille 01', 'familyVoice', T.GuildVoice],
    ['familyVoice2', '🔊・Vocal Famille 02', 'familyVoice', T.GuildVoice],
    ['createFamilyVoice', '➕・Créer sa voc famille', 'familyVoice', T.GuildVoice],
    ['intermanagementChat', '💬・discussion-intergestions', 'intermanagement', T.GuildText],
    ['intermanagementAnnouncements', '📢・annonces-gestions', 'intermanagement', T.GuildText],
    ['intermanagementVoice', '🔊・Réunion Intergestions', 'intermanagement', T.GuildVoice],
    ['candidateReception', '📥・réception-candidatures', 'managementPlus', T.GuildText],
    ['candidateTracking', '📋・suivi-candidatures', 'managementPlus', T.GuildText],
    ['managementCommands', '🤖・commandes-gestion', 'managementPlus', T.GuildText],
    ['voicePanel', '🎙️・panel-vocaux', 'managementPlus', T.GuildText],
    ['interview1', '🔊・Bureau Entretien 01', 'managementPlus', T.GuildVoice],
    ['interview2', '🔊・Bureau Entretien 02', 'managementPlus', T.GuildVoice],
    ['networkAnnouncements', '📢・annonces-réseaux', 'networks', T.GuildText],
    ['networkChat', '💬・discussion-réseaux', 'networks', T.GuildText],
    ['networkSchedule', '📅・planning-publications', 'networks', T.GuildText],
    ['networkIdeas', '📝・propositions-contenus', 'networks', T.GuildText],
    ['networkVoice', '🔊・Vocal Réseaux', 'networks', T.GuildVoice],
    ['logsMembers', '📜・logs-membres', 'logs', T.GuildText],
    ['logsVoice', '🔊・logs-vocaux', 'logs', T.GuildText],
    ['logsModeration', '🛡️・logs-modération', 'logs', T.GuildText],
    ['logsTickets', '🎫・logs-tickets', 'logs', T.GuildText],
    ['logsBot', '🤖・logs-bot', 'logs', T.GuildText]
];

const directions = ['creator', 'globalManager', 'administrator'];
const leads = ['ticketsLead', 'recruitmentLead', 'animationLead', 'networksLead'];
const managers = ['ticketsManagement', 'recruitmentManagement', 'animationManagement', 'networksManagement'];
const family = ['senior', 'prestigious', 'expert', 'confirmed', 'test'];
const allFamily = [...family, ...leads, ...managers];
const communityRead = ['verified', 'community', ...directions, ...leads, ...managers, ...family];
const infoPublish = {
    networkNews: ['networksLead', 'networksManagement'],
    recruitmentNews: ['recruitmentLead', 'recruitmentManagement'],
    supportNews: ['ticketsLead', 'ticketsManagement'],
    announcements: directions,
    schoolNews: directions,
    rpNews: directions,
    serverNews: directions,
    giveawaysInfo: ['animationLead', 'animationManagement', ...directions],
    levelsInfo: directions
};
const managementForChannel = {
    ticketsLead: ['ticketsManagement'],
    recruitmentLead: ['recruitmentManagement'],
    animationLead: ['animationManagement'],
    networksLead: ['networksManagement']
};

const read = [P.ViewChannel, P.ReadMessageHistory];
const textWrite = [...read, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.AddReactions, P.AttachFiles, P.EmbedLinks];
const voiceWrite = [...read, P.Connect, P.Speak, P.UseVAD, P.Stream];
const botPermissions = [...read, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.ManageChannels, P.ManageMessages, P.ManageRoles, P.ManageThreads, P.MoveMembers, P.MuteMembers, P.DeafenMembers, P.ManageEvents, P.AttachFiles, P.EmbedLinks];

function overwrite(id, allow = [], deny = []) { return { id, allow, deny }; }
function roleOverwrites(roleIds, allow = read) { return roleIds.filter(Boolean).map(id => overwrite(id, allow)); }
function specialRoles(keys, ids, allow = read) { return roleOverwrites(keys.map(key => ids[key]), allow); }

function overwrites(guildId, botId, r, scope, { channelKey } = {}) {
    const bot = overwrite(botId, botPermissions);
    let grants = [];
    if (scope === 'welcome') {
        grants = [overwrite(guildId, read)];
    } else if (scope === 'foundation') {
        const canWrite = ['foundationRequests', 'foundationChat', 'foundationAnnouncements', 'foundationReports'].includes(channelKey);
        grants = specialRoles(['creator', 'globalManager'], r, canWrite ? textWrite : read);
    } else if (scope === 'responsibles') {
        grants = specialRoles([...directions, ...leads], r);
    } else if (scope === 'private') {
        grants = specialRoles(['creator', 'officeAccess'], r, scope === 'private' && channelKey === 'officeVoice' ? voiceWrite : read);
    } else if (scope === 'information') {
        grants = specialRoles(communityRead, r);
        const publishers = infoPublish[channelKey] || [];
        grants.push(...specialRoles(publishers, r, [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.EmbedLinks, P.AttachFiles]));
        // Discussions and news are read-only; only the designated groups can post.
    } else if (scope === 'community') {
        grants = specialRoles(['community', ...directions, ...leads, ...managers, ...family], r, textWrite);
        grants.push(...specialRoles(['verified'], r));
        if (['communityCommands', 'communityGiveaways'].includes(channelKey)) {
            grants = specialRoles(communityRead, r);
            if (channelKey === 'communityGiveaways') grants.push(...specialRoles(['animationLead', 'animationManagement', ...directions], r, [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.EmbedLinks, P.AttachFiles]));
        }
    } else if (scope === 'communityVoice') {
        const allow = channelKey?.startsWith('create') ? voiceWrite : voiceWrite;
        grants = specialRoles(['community', ...directions, ...leads, ...managers, ...family], r, allow);
        grants.push(...specialRoles(['verified'], r));
    } else if (scope === 'familyVoice') {
        grants = specialRoles([...directions, ...allFamily], r, voiceWrite);
    } else if (scope === 'support') {
        grants = specialRoles(['community', ...directions, ...leads, ...managers], r, textWrite);
        grants.push(...specialRoles(family, r, textWrite));
        grants.push(...specialRoles(['verified'], r));
    } else if (scope === 'family') {
        grants = specialRoles([...directions, ...allFamily], r, textWrite);
        if (['familyGuide', 'familyAnnouncements', 'familyRoster', 'familyChart', 'familyGiveaways', 'familyCommands'].includes(channelKey)) {
            grants = specialRoles([...directions, ...allFamily], r);
            if (channelKey === 'familyAnnouncements' || channelKey === 'familyGiveaways') grants.push(...specialRoles(['animationLead', 'animationManagement'], r, [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.EmbedLinks, P.AttachFiles]));
        }
    } else if (scope === 'intermanagement') {
        grants = specialRoles([...directions, ...leads, ...managers], r, textWrite);
    } else if (scope === 'management') {
        grants = specialRoles([...directions, ...leads, ...managers], r, textWrite);
    } else if (scope === 'networks') {
        grants = specialRoles([...directions, 'networksLead', 'networksManagement'], r, textWrite);
    } else if (scope === 'logs') {
        grants = specialRoles(directions, r);
        if (channelKey === 'logsMembers') grants.push(...specialRoles(['recruitmentLead', 'recruitmentManagement'], r));
        if (channelKey === 'logsTickets') grants.push(...specialRoles(['ticketsLead', 'ticketsManagement'], r));
    }

    if (channelKey === 'voicePanel' || channelKey === 'candidateReception' || channelKey === 'candidateTracking' || channelKey === 'managementCommands') {
        grants = specialRoles([...directions, ...leads, ...managers], r, channelKey === 'voicePanel' || channelKey === 'managementCommands' ? textWrite : read);
    }
    if (channelKey === 'familyApplications') {
        // Recruitment entry panel is visible to everyone who can read the support category.
        grants = specialRoles(communityRead, r);
    }
    if (channelKey === 'logsVoice') grants = specialRoles(directions, r);
    const voiceScopes = {
        foundationVoice: ['creator', 'globalManager'],
        responsibleVoice: [...directions, ...leads],
        intermanagementVoice: [...directions, ...leads, ...managers],
        interview1: [...directions, 'recruitmentLead', 'recruitmentManagement'],
        interview2: [...directions, 'recruitmentLead', 'recruitmentManagement'],
        networkVoice: [...directions, 'networksLead', 'networksManagement']
    };
    if (voiceScopes[channelKey]) grants = specialRoles(voiceScopes[channelKey], r, voiceWrite);
    const publicWelcome = scope === 'welcome';
    const denied = publicWelcome ? null : overwrite(guildId, [], [P.ViewChannel]);
    return [...(denied ? [denied] : []), bot, ...grants];
}

const readOnlyChannels = new Set([
    'arrivals', 'rules', 'notifications', 'announcements', 'schoolNews', 'rpNews', 'networkNews', 'serverNews',
    'recruitmentNews', 'supportNews', 'giveawaysInfo', 'levelsInfo', 'communityCommands', 'communityGiveaways',
    'familyGuide', 'familyAnnouncements', 'familyRoster', 'familyChart', 'familyGiveaways', 'familyCommands',
    'candidateReception', 'candidateTracking', 'logsMembers', 'logsVoice', 'logsModeration', 'logsTickets', 'logsBot'
]);
const familyRankKeys = family;
const dividerRoleDefs = updateRoleDefs.filter(([, , , options]) => options?.groupDivider);
const installRoleDefs = [...roleDefs, ...dividerRoleDefs];

module.exports = {
    roleDefs, updateRoleDefs, dividerRoleDefs, installRoleDefs, categories, channels, directions, leads, managers, family, allFamily,
    readOnlyChannels, familyRankKeys, infoPublish, overwrites, read, textWrite, voiceWrite, botPermissions
};
