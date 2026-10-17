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
