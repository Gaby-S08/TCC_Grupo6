'use strict';

const crypto = require('crypto');
const SESSION_COOKIE = 'equipvirtual_session';
const SESSION_TTL_HOURS = 12;

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 256) {
    throw new Error('A senha precisa ter entre 6 e 256 caracteres.');
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || typeof stored !== 'string') return false;
  const match = /^scrypt\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(stored);
  if (!match) return false;
  try {
    const salt = Buffer.from(match[1], 'base64url');
    const expected = Buffer.from(match[2], 'base64url');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
}

function cookieValue(request, name = SESSION_COOKIE) {
  const cookieHeader = request.headers.cookie || '';
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return item.slice(separator + 1).trim();
  }
  return '';
}

function cookieHeader(token) {
  const maxAge = SESSION_TTL_HOURS * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

function clearedCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function createSession(db, profileId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  await db.execute(
    `INSERT INTO equipvirtual_sessions (token_hash, profile_id, csrf_token, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${SESSION_TTL_HOURS} HOUR))`,
    [tokenHash, profileId, csrfToken]
  );
  return { token, csrfToken };
}

async function lookupSession(db, request) {
  const token = cookieValue(request);
  if (!token || token.length > 128) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await db.execute(
    'SELECT token_hash, profile_id, csrf_token FROM equipvirtual_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1',
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeSession(db, session) {
  if (!session) return;
  await db.execute('DELETE FROM equipvirtual_sessions WHERE token_hash = ?', [session.token_hash]);
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  cookieHeader,
  clearedCookieHeader,
  constantTimeEqual,
  createSession,
  lookupSession,
  revokeSession
};
