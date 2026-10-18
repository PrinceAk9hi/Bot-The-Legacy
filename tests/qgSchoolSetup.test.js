const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../config/qgSchoolLayout');
const setup = require('../systems/qgSchoolSetup');
const family = require('../systems/qgSchoolFamily');
const apps = require('../systems/qgSchoolApplications');
const giveaways = require('../systems/qgSchoolGiveaways');
const news = require('../systems/qgSchoolNews');

test('QG SchoolRP declares every family role without Discord Administrator', () => {
  assert.equal(layout.roleDefs.length, 23);
  assert.equal(new Set(layout.roleDefs.map(([key]) => key)).size, 23);
  assert.ok(layout.roleDefs.every(([, name, color]) => name && Number.isInteger(color)));
});

test('the six group dividers are least-privilege, unique install roles', () => {
  assert.equal(layout.dividerRoleDefs.length, 6);
  assert.equal(layout.installRoleDefs.length, 29);
  assert.deepEqual(layout.dividerRoleDefs.map(([key, name]) => [key, name]), [
    ['dividerFoundation', '♛・FONDATION'], ['dividerDirection', '✦・DIRECTION'],
    ['dividerResponsibles', '✦・RESPONSABLES'], ['dividerManagement', '✦・GESTIONS'],
    ['dividerFamily', '✦・FAMILLE'], ['dividerCommunity', '✦・COMMUNAUTÉ']
  ]);
  assert.equal(new Set(layout.installRoleDefs.map(([key]) => key)).size, layout.installRoleDefs.length);
});

test('categories and channels follow the requested ordered plan without duplicates', () => {
  assert.equal(layout.categories.length, 15);
  assert.equal(layout.categories[0][1], '01 — ♛・BUREAU');
  assert.equal(layout.categories.at(-1)[1], '15 — ✦・LOGS');
  assert.ok(layout.channels.length >= 60);
  assert.equal(new Set(layout.channels.map(([key]) => key)).size, layout.channels.length);
  assert.ok(layout.channels.every(([, , parent]) => layout.categories.some(([key]) => key === parent)));
});

test('private category access is expressed by role-specific overwrites', () => {
  const r = Object.fromEntries(layout.roleDefs.map(([key], n) => [key, String(n + 100)]));
  const office = layout.overwrites('1', '2', r, 'private', { channelKey: 'officeVoice' });
  assert.ok(office.some(x => x.id === r.creator));
  assert.ok(office.some(x => x.id === r.officeAccess));
  assert.ok(office.find(x => x.id === '1').deny.includes(require('discord.js').PermissionFlagsBits.ViewChannel));
  const welcome = layout.overwrites('1', '2', r, 'welcome');
  assert.equal(welcome.filter(x => x.id === '1').length, 1);
  for (const key of ['foundationVoice','responsibleVoice','intermanagementVoice','interview1','interview2','networkVoice']) {
    const channel = layout.channels.find(x => x[0] === key);
    const scope = layout.categories.find(x => x[0] === channel[2])[2];
    assert.ok(layout.overwrites('1','2',r,scope,{channelKey:key}).some(x => x.allow.includes(require('discord.js').PermissionFlagsBits.Connect)), `${key} must allow its authorized team to connect`);
  }
});

test('the regulation fits a single Discord embed description', () => {
  assert.ok(setup.ruleText.length <= 4096, `description length ${setup.ruleText.length}`);
  assert.match(setup.ruleText, /Article 20/);
});

test('persistent panels use stable custom IDs and the four requested management teams', () => {
  for (const key of ['rules', 'notifications', 'familyApplications', 'joinManagement', 'absences', 'rankUp']) assert.ok(setup.panelPayload(key));
  const management = setup.panelPayload('joinManagement').components[0].components[0];
  assert.equal(management.toJSON().options.length, 4);
  assert.deepEqual(management.toJSON().options.map(x => x.value), ['ticketsManagement', 'recruitmentManagement', 'animationManagement', 'networksManagement']);
});

test('family application panel attaches the supplied animated GIF and preserves the MP questionnaire button', () => {
  const fs = require('node:fs'), path = require('node:path');
  const payload = setup.panelPayload('familyApplications');
  const image = payload.embeds[0].data.image.url;
  assert.equal(image, 'attachment://qg-initial.gif');
  assert.equal(payload.files[0].name, 'qg-initial.gif');
  assert.ok(payload.files[0] instanceof require('discord.js').AttachmentBuilder);
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'qg-initial.gif'));
  assert.equal(bytes.subarray(0, 6).toString(), 'GIF89a');
  assert.equal(payload.components[0].components[0].data.custom_id, 'qgs:family-apply');
  assert.equal(payload.components[0].components[0].data.label, 'Déposer ma candidature');
});

test('QG ticket panel exposes the four requested categories and reattaches its animated banner on edits', () => {
  const payload = setup.panelPayload('tickets');
  const menu = payload.components[0].components[0];
  assert.deepEqual(menu.toJSON().options.map(option => option.value), ['questions', 'report', 'complaint', 'foundation']);
  assert.equal(payload.embeds[0].data.color, 0xF0F0F0);
  assert.equal(payload.embeds[0].data.image.url, 'attachment://qg-support-banner.gif');
  assert.equal(payload.files[0].name, 'qg-support-banner.gif');
  for (const text of ['Assistance générale', 'Signalement', 'Réclamation', 'Contacter la Fondation']) assert.match(payload.embeds[0].data.description, new RegExp(text));
});

test('Foundation ticket permissions deny every non-Foundation server role while keeping applicant access', () => {
  const { ticketOverwrites } = require('../systems/qgServer')._test;
  const roles = { creator: '10', globalManager: '11', administrator: '12', ticketsManagement: '13' };
  const overwrites = ticketOverwrites('1', '20', '30', 'foundation', roles, {}, ['1','10','11','12','13','14']);
  assert.ok(overwrites.find(overwrite => overwrite.id === '20').allow.includes(require('discord.js').PermissionFlagsBits.ViewChannel));
  for (const id of ['12','13','14']) assert.ok(overwrites.find(overwrite => overwrite.id === id).deny.includes(require('discord.js').PermissionFlagsBits.ViewChannel));
  assert.deepEqual(overwrites.filter(overwrite => ['10','11'].includes(overwrite.id)).map(overwrite => overwrite.id), ['10','11']);
});

test('separator reconciliation keeps a group separator while any matching role remains', () => {
  const separators = require('../systems/qgSchoolSeparators');
  const roleIds = { dividerFamily: '100', test: '200', senior: '201', dividerManagement: '101', ticketsManagement: '202' };
  const member = roles => ({ roles: { cache: new Map(roles.map(id => [id, { id }])) } });
  assert.deepEqual(separators.desiredSeparatorIds(member(['200','201']), roleIds), ['100']);
  assert.deepEqual(separators.desiredSeparatorIds(member(['200','202']), roleIds), ['101','100']);
  assert.deepEqual(separators.desiredSeparatorIds(member(['200']), roleIds), ['100']);
});

test('family rank progression is ordered from test to senior', () => {
  assert.deepEqual(family._test.familyKeys, ['test', 'confirmed', 'expert', 'prestigious', 'senior']);
});

test('family recruitment asks ten questions and management applications require the five requested fields', () => {
  assert.equal(apps.familyQuestions.length, 10);
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'systems', 'qgSchoolApplications.js'), 'utf8');
  for (const key of ['motivation', 'experience', 'availability', 'skills', 'contribution']) assert.ok(source.includes(key));
});

test('giveaway durations are parsed as fixed time units', () => {
  assert.equal(giveaways.duration('1h'), 60 * 60 * 1000);
  assert.equal(giveaways.duration('30d'), 30 * 24 * 60 * 60 * 1000);
  assert.equal(giveaways.duration('abc'), 0);
});

test('news command parses French categories, text, optional image and opt-in notification', () => {
  assert.deepEqual(news.parse('=actualite réseaux | Tournoi | Inscriptions ouvertes | https://example.org/image.png | ping'), { category: 'reseaux', title: 'Tournoi', description: 'Inscriptions ouvertes', image: 'https://example.org/image.png', notify: true });
  assert.equal(news.parse('=actualite school | Titre'), null);
});

test('direct-image validation distinguishes a GIF file from a web page containing one', () => {
  const { directImage } = require('../utils/discordPanelImage');
  assert.equal(directImage('https://cdn.example.org/animation.gif'), 'https://cdn.example.org/animation.gif');
  assert.throws(() => directImage('https://example.org/page-with-gif'), /URL directe/);
  assert.throws(() => directImage('http://cdn.example.org/animation.gif'), /HTTPS/);
});
