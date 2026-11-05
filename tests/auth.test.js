'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, cookieHeader, constantTimeEqual } = require('../server/auth');

test('senha validada com scrypt e nunca retornada como texto puro', () => {
  const password = 'uma-senha-segura-para-teste';
  const stored = hashPassword(password);
  assert.match(stored, /^scrypt\$/);
  assert.notEqual(stored, password);
  assert.equal(verifyPassword(password, stored), true);
  assert.equal(verifyPassword('senha errada', stored), false);
});

test('verificação rejeita senha excessivamente longa sem executar scrypt', () => {
  const stored = hashPassword('senha de teste');
  assert.equal(verifyPassword('x'.repeat(257), stored), false);
});

test('cookie de sessão é HttpOnly, Secure e compatível com Preview HTTPS em iframe', () => {
  const value = cookieHeader('token-exemplo');
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=None/);
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
});
