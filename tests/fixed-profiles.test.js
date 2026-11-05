'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROFILE_DEFINITIONS, LAB_DEFINITIONS, parseFixedProfilePasswords, applyFixedProfileData } = require('../server/fixed-profiles');
const { validateUniqueProfiles, validateUniqueLabRooms } = require('../scripts/migrate-fixed-profiles');

function examplePasswords() {
  return Object.fromEntries(PROFILE_DEFINITIONS.map((profile, index) => [profile.id, `senha-teste-${index}-forte`]));
}

test('segredo de senhas exige exatamente os cinco perfis e valores de comprimento permitido', () => {
  const passwords = examplePasswords();
  assert.deepEqual(parseFixedProfilePasswords(JSON.stringify(passwords)), passwords);
  assert.throws(() => parseFixedProfilePasswords('{invalido'), /JSON válido/);
  assert.throws(() => parseFixedProfilePasswords(JSON.stringify({ ...passwords, extra: 'senha-extra' })), /cada um dos cinco/);
  assert.throws(() => parseFixedProfilePasswords(JSON.stringify({ ...passwords, 'prof-rafael': '12345' })), /cada um dos cinco/);
});

test('migração atualiza os perfis e salas definidos, armazena hashes e preserva os demais registros', () => {
  const passwords = examplePasswords();
  const originalProfiles = [
    ...PROFILE_DEFINITIONS.map((profile) => ({ ...profile, name: `Nome antigo ${profile.id}`, email: `old-${profile.id}@example.test`, password: 'hash-antigo' })),
    { id: 'prof-extra', name: 'Outro professor', email: 'outro@example.test', password: 'hash-intacto', role: 'user', dept: 'Química', labId: 'lab-extra', room: '301', customField: 'preservado' }
  ];
  const originalLabs = [
    ...LAB_DEFINITIONS.map((lab) => ({ ...lab, name: 'Nome antigo', room: '999' })),
    { id: 'lab-extra', name: 'Outro laboratório', dept: 'Química', room: '301', customField: 'preservado' }
  ];
  const calls = [];
  const updated = applyFixedProfileData(originalProfiles, originalLabs, passwords, (password) => { calls.push(password); return `scrypt-hash-${calls.length}`; });

  assert.equal(calls.length, 5);
  for (const definition of PROFILE_DEFINITIONS) {
    const result = updated.profiles.find((profile) => profile.id === definition.id);
    assert.deepEqual(Object.fromEntries(Object.keys(definition).map((key) => [key, result[key]])), definition);
    assert.match(result.password, /^scrypt-hash-/);
    assert.notEqual(result.password, passwords[definition.id]);
  }
  assert.deepEqual(updated.profiles.find((profile) => profile.id === 'prof-extra'), originalProfiles.at(-1));
  for (const definition of LAB_DEFINITIONS) assert.deepEqual(updated.labs.find((lab) => lab.id === definition.id), definition);
  assert.deepEqual(updated.labs.find((lab) => lab.id === 'lab-extra'), originalLabs.at(-1));
});

test('migração recusa e-mails repetidos e salas duplicadas por departamento', () => {
  assert.throws(() => validateUniqueProfiles([{ id: '1', email: 'mesmo@example.test' }, { id: '2', email: 'MESMO@example.test' }]), /não são únicos/);
  assert.throws(() => validateUniqueLabRooms([{ dept: 'Informática', room: '166' }, { dept: 'informática', room: '166' }]), /duplicada/);
  assert.doesNotThrow(() => validateUniqueLabRooms([{ dept: 'Informática', room: '166' }, { dept: 'Informática', room: '221' }]));
});
