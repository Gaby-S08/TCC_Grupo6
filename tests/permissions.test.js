'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword } = require('../server/auth');
const { stateForActor, applyStateUpdate } = require('../server/permissions');

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'admin' };
const teacher = { id: 'teacher-1', name: 'Professora Ana', email: 'ana@example.test', role: 'user', dept: 'Informática', labId: 'lab-1', room: '101' };
const otherTeacher = { id: 'teacher-2', name: 'Professor Bruno', email: 'bruno@example.test', role: 'user', dept: 'Informática', labId: 'lab-2', room: '102' };

function fixture() {
  return {
    profiles: [
      { ...admin, password: hashPassword('admin-test-password') },
      { ...teacher, password: hashPassword('teacher-test-password') },
      { ...otherTeacher, password: hashPassword('other-test-password') }
    ],
    labs: [
      { id: 'lab-1', dept: 'Informática', name: 'Laboratório de Informática', room: '101' },
      { id: 'lab-2', dept: 'Informática', name: 'Laboratório de Informática', room: '102' }
    ],
    assets: [
      { id: 'asset-1', labId: 'lab-1', name: 'Notebook', desc: 'Equipamento', qty: 4 },
      { id: 'asset-2', labId: 'lab-2', name: 'Projetor', desc: 'Equipamento', qty: 1 }
    ],
    tickets: [],
    directMessages: [],
    notifications: []
  };
}

test('professor vê seu próprio perfil/laboratório e não recebe os dados de outros docentes', () => {
  const state = fixture();
  const result = stateForActor(state, teacher);
  assert.deepEqual(result.profiles.map((profile) => profile.id).sort(), ['admin-1', 'teacher-1']);
  assert.deepEqual(result.labs.map((lab) => lab.id), ['lab-1']);
  assert.deepEqual(result.assets.map((asset) => asset.id), ['asset-1']);
  assert.ok(result.profiles.every((profile) => profile.password === '__remote__'));
});

test('mensagem do professor e notificação ficam visíveis para o administrador na mesma base compartilhada', () => {
  const current = fixture();
  const incoming = stateForActor(current, teacher);
  const message = {
    id: 'dm-1', profileId: teacher.id, senderId: teacher.id, senderName: teacher.name,
    text: 'O laboratório precisa de suporte.', time: '05/11/2026, 10:00'
  };
  incoming.directMessages.push(message);
  incoming.notifications.push({
    id: `teacher-message:${message.id}:${admin.id}`, recipientId: admin.id, type: 'teacher-message',
    referenceId: message.id, text: 'A professora enviou uma mensagem.', time: '05/11/2026, 10:00', read: false
  });
  const saved = applyStateUpdate(incoming, current, teacher, hashPassword);
  const adminView = stateForActor(saved, admin);
  assert.deepEqual(adminView.directMessages, [message]);
  assert.equal(adminView.notifications[0].referenceId, message.id);
});

test('professor não pode enviar mensagem em nome de outro perfil', () => {
  const current = fixture();
  const incoming = stateForActor(current, teacher);
  incoming.directMessages.push({
    id: 'forged', profileId: otherTeacher.id, senderId: otherTeacher.id, senderName: otherTeacher.name,
    text: 'Mensagem forjada', time: '05/11/2026, 10:00'
  });
  assert.throws(() => applyStateUpdate(incoming, current, teacher, hashPassword), /mensagens em nome/i);
});

test('professor não pode alterar ativo de laboratório alheio', () => {
  const current = fixture();
  const incoming = stateForActor(current, teacher);
  incoming.assets.push({ ...current.assets[1], qty: 99 });
  assert.throws(() => applyStateUpdate(incoming, current, teacher, hashPassword), /próprios laboratórios/i);
});

test('administrador não consegue gravar uma sala duplicada no mesmo departamento', () => {
  const current = fixture();
  const incoming = stateForActor(current, admin);
  incoming.labs.push({ id: 'lab-duplicate', dept: 'Informática', name: 'Outro laboratório', room: '101' });
  assert.throws(() => applyStateUpdate(incoming, current, admin, hashPassword), /sala e departamento/i);
});

test('nova senha de professor é armazenada como hash e não como texto original', () => {
  const current = fixture();
  const incoming = stateForActor(current, admin);
  incoming.profiles.push({ id: 'teacher-3', name: 'Professora Carla', email: 'carla@example.test', password: 'nova-senha-segura', role: 'user', dept: 'Informática', labId: 'lab-1', room: '101' });
  const saved = applyStateUpdate(incoming, current, admin, hashPassword);
  const profile = saved.profiles.find((item) => item.id === 'teacher-3');
  assert.match(profile.password, /^scrypt\$/);
  assert.notEqual(profile.password, 'nova-senha-segura');
});

test('administrador cadastra laboratório e professor no mesmo estado persistível sem alterar outras coleções', () => {
  const current = fixture();
  const incoming = stateForActor(current, admin);
  incoming.labs.push({ id: 'lab-3', dept: 'Informática', name: 'Laboratório de Redes', room: '103' });
  incoming.profiles.push({
    id: 'teacher-3', name: 'Professora Carla', email: 'carla@example.test', password: 'senha-cadastro-teste',
    role: 'user', dept: 'Informática', labId: 'lab-3', room: '103'
  });

  const saved = applyStateUpdate(incoming, current, admin, hashPassword);
  assert.ok(saved.labs.some((lab) => lab.id === 'lab-3' && lab.room === '103'));
  assert.ok(saved.profiles.some((profile) => profile.id === 'teacher-3' && profile.labId === 'lab-3'));
  assert.match(saved.profiles.find((profile) => profile.id === 'teacher-3').password, /^scrypt\$/);
  assert.deepEqual(saved.assets, current.assets);
  assert.deepEqual(saved.tickets, current.tickets);
  assert.deepEqual(saved.directMessages, current.directMessages);
});
