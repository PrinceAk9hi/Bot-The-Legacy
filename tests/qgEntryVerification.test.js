const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../systems/qgEntryVerification');
const { desiredSeparatorIds } = require('../systems/qgSchoolSeparators');
const config = require('../config/qg');
test('QG: family recruitment requires completed verification and community access', () => {
  const { verifiedForRecruitment } = require('../systems/qgSchoolApplications')._test;
  const member = { id: 'candidate', guild: { id: config.guildId }, pending: false, roles: { cache: new Map([['community', true]]) } };
  const state = { schoolRoles: { community: 'community' }, schoolEntryVerification: {} };
  assert.equal(verifiedForRecruitment(member, state), false);
  state.schoolEntryVerification.candidate = { stage: 'rules', confirmedAt: 1, robloxId: '123' };
  assert.equal(verifiedForRecruitment(member, state), false);
  Object.assign(state.schoolEntryVerification.candidate, { stage: 'accepted', acceptedAt: 2 });
  assert.equal(verifiedForRecruitment(member, state), true);
  member.roles.cache.clear();
  assert.equal(verifiedForRecruitment(member, state), false);
});
function fixture() {
  const state = { schoolRoles: { community: 'community', verified: 'verified' } }, added = [];
  const deps = { read: () => state, update: (_, fn) => fn(state), recordVerification:()=>{},syncMember:async()=>{},existing: () => null, findRoblox: async () => ({ robloxId: '123', robloxName: 'Example' }), welcome: async () => { assert.equal(state.schoolEntryVerification.user.stage, 'accepted'); state.welcomes = (state.welcomes || 0) + 1; } };
  const member = { id:'user',displayName:'Example',pending: false, roles: { cache: new Map(), add: async id => { added.push(id); member.roles.cache.set(id, true); } } };
  const i = id => ({ customId: id, guildId: config.guildId, user: { id: 'user', username: 'Example' }, guild: { members: { fetch: async () => member }, roles: { fetch: async () => ({ editable: true }) } }, fields: { getTextInputValue: key => ({roblox:'Example',discord:'Example',reason:'Rejoindre la communauté'})[key] }, deferReply: async () => {}, deferUpdate: async () => {}, editReply: async payload => { state.lastPayload = payload; }, reply: async () => {}, showModal: async () => {} });
  return { state, added, deps, member, i };
}
test('QG: profile confirmation grants no role; private rules acceptance grants community only (no age role), including after restart', async () => {
  const f = fixture(); let handle = createHandler(f.deps);
  await handle(f.i('qgs:entry-form'));
  const token = f.state.schoolEntryVerification.user.token;
  await handle(f.i(`qgs:entry-confirm:${token}`));
  assert.deepEqual(f.added, []);
  assert.equal(f.state.welcomes, undefined);
  assert.match(f.state.lastPayload.embeds[0].data.description, /tranche d’âge sur Roblox/);
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  await handle(f.i(`qgs:entry-age:${token}:13`));
  await handle(f.i(`qgs:entry-no-notifs:${token}`));
  assert.match(f.state.lastPayload.embeds[0].data.description, /Confirmes-tu avoir bien lu et accepté/);
  handle = createHandler(f.deps);
  await handle(f.i(`qgs:entry-accept:${token}`));
  assert.deepEqual(f.added, ['community']);
  assert.ok(f.state.schoolEntryVerification.user.acceptedAt);
  assert.equal(f.state.welcomes, 1);
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  assert.equal(f.state.welcomes, 1);
  assert.deepEqual(f.added, ['community']);
});
test('QG: wrong token, missing confirmation and native Discord screening cannot grant access', async () => {
  const f = fixture(), handle = createHandler(f.deps);
  await handle(f.i('qgs:entry-form'));
  const token = f.state.schoolEntryVerification.user.token;
  await assert.rejects(handle(f.i('qgs:entry-accept:forged')));
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  await handle(f.i(`qgs:entry-confirm:${token}`));
  await handle(f.i(`qgs:entry-age:${token}:18`));
  await handle(f.i(`qgs:entry-no-notifs:${token}`));
  f.member.pending = true;
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  assert.deepEqual(f.added, []);
});
test('QG: Global Manager and Administrator receive Direction, not Foundation', () => {
  const roles = {creator:'c',globalManager:'g',administrator:'a',dividerFoundation:'f',dividerDirection:'d'};
  const member = ids => ({ roles: { cache: new Map(ids.map(id => [id,true])) } });
  for (const ids of [['g'], ['a'], ['g','a']]) assert.deepEqual(desiredSeparatorIds(member(ids),roles), ['d']);
  assert.deepEqual(desiredSeparatorIds(member(['c']),roles), []);
});
