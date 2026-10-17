const test = require('node:test');
const assert = require('node:assert/strict');
const registerLogs = require('../systems/logs');
const { _test } = registerLogs;

test('le format neutralise les mentions globales et masque les clés connues', () => {
  assert.equal(_test.text('@everyone @here'), '@\u200beveryone @\u200bhere');
  assert.match(_test.text('secret sk-abcdefghijklmnopqrstuvwxyz0123456789'), /\[secret masqué\]/);
});

test('les options sensibles de commandes sont masquées dans les logs', () => {
  const lines = _test.flatten([
    { name: 'question', value: 'contenu confidentiel' },
    { name: 'membre', value: '123456789012345678' },
    { name: 'api_key', value: 'sk-secret-value' }
  ]);
  assert.match(lines[0], /\[masqué\]/);
  assert.match(lines[1], /123456789012345678/);
  assert.match(lines[2], /\[masqué\]/);
  assert.doesNotMatch(lines.join(' '), /contenu confidentiel|sk-secret-value/);
});

test('le diff de profil rapporte les changements accessibles sans inventer le reste', () => {
  const before = { nickname: 'Avant', user: { username: 'user', globalName: 'Nom', avatar: 'a' } };
  const after = { nickname: null, user: { username: 'user2', globalName: 'Nom 2', avatar: 'b' } };
  const changes = _test.profileDiff(before, after);
  assert.ok(changes.some(x => x.includes('Surnom serveur')));
  assert.ok(changes.some(x => x.includes('Nom Discord')));
  assert.ok(changes.some(x => x.includes('Nom global')));
  assert.ok(changes.some(x => x.includes('Avatar')));
});

test('les destinations initiales réutilisent uniquement les identifiants déjà configurés', () => {
  assert.ok(_test.CATEGORIES.includes('voice'));
  assert.ok(_test.CATEGORIES.includes('tickets'));
  assert.equal(_test.DEFAULTS.commands, require('../config/soulSociety').CHANNELS.commandLogs);
  assert.equal(_test.DEFAULTS.tickets, require('../config/soulSociety').CHANNELS.ticketLogs);
  assert.equal(_test.DEFAULTS.voice, require('../config/soulSociety').CHANNELS.logs);
});

test('les embeds de log gardent les changements utiles et neutralisent les mentions', () => {
  const embed = _test.embedFor({ name: 'Soul Society' }, {
    category: 'roles', title: 'Rôle modifié', description: '@everyone modification',
    actor: '123456789012345678', target: '123456789012345679',
    fields: [{ name: 'Avant', value: 'Membre' }, { name: 'Après', value: 'Staff' }]
  }).toJSON();
  assert.equal(embed.title, 'Rôle modifié');
  assert.ok(embed.description.includes('@\u200beveryone'));
  assert.ok(embed.fields.some(x => x.name === 'Auteur'));
  assert.ok(embed.fields.some(x => x.name === 'Membre / cible'));
  assert.ok(embed.fields.length <= 25);
});

test('le système ne double pas ses gestionnaires quand il est initialisé deux fois', () => {
  const { EventEmitter } = require('node:events');
  const client = new EventEmitter();
  client.guilds = { cache: new Map() };
  client.options = { intents: { has: () => true } };
  registerLogs(client);
  const before = client.listenerCount('voiceStateUpdate');
  registerLogs(client);
  assert.ok(before > 0);
  assert.equal(client.listenerCount('voiceStateUpdate'), before);
});

test('les messages privés du ticket sont classés sans être copiés dans le journal', () => {
  const reply = _test.classifyTicketBotMessage('<@123456789012345678> Voici la réponse utile.', '123456789012345678');
  assert.equal(reply.reply, true);
  assert.equal(reply.escalation, false);
  const escalation = _test.classifyTicketBotMessage('<@&1471557970079912047> Je transmets cette demande à l’équipe.', '123456789012345678', ['1471557970079912047']);
  assert.equal(escalation.escalation, true);
  const failure = _test.classifyTicketBotMessage('<@&1471557970079912047> L’IA n’a pas pu traiter la demande.', '123456789012345678', ['1471557970079912047']);
  assert.equal(failure.providerError, true);
});
