const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../systems/qgEntryVerification');
const { desiredSeparatorIds } = require('../systems/qgSchoolSeparators');
const config = require('../config/qg');
function fixture() {
  const state = { schoolRoles: { community: 'community', verified: 'verified' } }, added = [];
  const deps = { read: () => state, update: (_, fn) => fn(state), existing: () => null, findRoblox: async () => ({ robloxId: '123', robloxName: 'Example' }) };
  const member = { pending: false, roles: { cache: new Map(), add: async id => { added.push(id); member.roles.cache.set(id, true); } } };
  const i = id => ({ customId: id, guildId: config.guildId, user: { id: 'user', username: 'Example' }, guild: { members: { fetch: async () => member }, roles: { fetch: async () => ({ editable: true }) } }, fields: { getTextInputValue: key => ({roblox:'Example',discord:'Example',reason:'Rejoindre la communauté'})[key] }, deferReply: async () => {}, deferUpdate: async () => {}, editReply: async payload => { state.lastPayload = payload; }, reply: async () => {}, showModal: async () => {} });
  return { state, added, deps, member, i };
}
test('QG: profile confirmation grants no role; private rules acceptance grants only community, including after restart', async () => {
  const f = fixture(); let handle = createHandler(f.deps);
  await handle(f.i('qgs:entry-form'));
  const token = f.state.schoolEntryVerification.user.token;
  await handle(f.i(`qgs:entry-confirm:${token}`));
  assert.deepEqual(f.added, []);
  assert.match(f.state.lastPayload.embeds[0].data.description, /Confirmes-tu avoir bien lu et accepté/);
  handle = createHandler(f.deps);
  await handle(f.i(`qgs:entry-accept:${token}`));
  assert.deepEqual(f.added, ['community']);
  assert.ok(f.state.schoolEntryVerification.user.acceptedAt);
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  assert.deepEqual(f.added, ['community']);
});
test('QG: wrong token, missing confirmation and native Discord screening cannot grant access', async () => {
  const f = fixture(), handle = createHandler(f.deps);
  await handle(f.i('qgs:entry-form'));
  const token = f.state.schoolEntryVerification.user.token;
  await assert.rejects(handle(f.i('qgs:entry-accept:forged')));
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  await handle(f.i(`qgs:entry-confirm:${token}`));
  f.member.pending = true;
  await assert.rejects(handle(f.i(`qgs:entry-accept:${token}`)));
  assert.deepEqual(f.added, []);
});
test('QG: Global Manager and Administrator receive Direction, not Foundation', () => {
  const roles = {creator:'c',globalManager:'g',administrator:'a',dividerFoundation:'f',dividerDirection:'d'};
  const member = ids => ({ roles: { cache: new Map(ids.map(id => [id,true])) } });
  for (const ids of [['g'], ['a'], ['g','a']]) assert.deepEqual(desiredSeparatorIds(member(ids),roles), ['d']);
  assert.deepEqual(desiredSeparatorIds(member(['c']),roles), ['f']);
});
