'use strict';

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const seed = require('./server/seed');
const { hashPassword, verifyPassword, cookieHeader, clearedCookieHeader, constantTimeEqual, createSession, lookupSession, revokeSession } = require('./server/auth');
const { normalizeState, stateForActor, applyStateUpdate } = require('./server/permissions');
const { parseFixedProfilePasswords } = require('./server/fixed-profiles');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_TABLE = 'help_app_state';
let pool;
let ready;
const loginAttempts = new Map();

function safeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function publicProfile(profile) { return { ...profile, password: '__remote__' }; }

async function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não está disponível.');
  if (!pool) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

function parseRow(row) {
  return normalizeState({
    profiles: safeJson(row.profiles, []),
    labs: safeJson(row.labs, []),
    assets: safeJson(row.assets, []),
    tickets: safeJson(row.tickets, []),
    directMessages: safeJson(row.direct_messages, []),
    notifications: safeJson(row.notifications, [])
  });
}

async function ensureDatabase() {
  const db = await getPool();
  await db.query(`CREATE TABLE IF NOT EXISTS ${DB_TABLE} (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    profiles JSON NOT NULL,
    labs JSON NOT NULL,
    assets JSON NOT NULL,
    tickets JSON NOT NULL,
    direct_messages JSON NOT NULL,
    notifications JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS equipvirtual_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    profile_id VARCHAR(191) NOT NULL,
    csrf_token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_equipvirtual_sessions_expiry (expires_at),
    INDEX idx_equipvirtual_sessions_profile (profile_id)
  )`);
  const [rows] = await db.query(`SELECT id FROM ${DB_TABLE} WHERE id = 1 LIMIT 1`);
  if (!rows.length) {
    const fixedPasswords = parseFixedProfilePasswords();
    const initialAdminPassword = fixedPasswords?.['admin-guilherme'] || process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialAdminPassword || initialAdminPassword.length < (fixedPasswords ? 6 : 12)) {
      throw new Error('A senha inicial protegida do administrador não está configurada ou não atende ao mínimo de segurança.');
    }
    const profiles = seed.profiles.map((profile) => ({ ...profile, password: hashPassword(profile.password) }));
    await db.execute(`INSERT INTO ${DB_TABLE} (id, profiles, labs, assets, tickets, direct_messages, notifications) VALUES (1, ?, ?, ?, ?, ?, ?)`, [
      JSON.stringify(profiles), JSON.stringify(seed.labs), JSON.stringify(seed.assets), JSON.stringify(seed.tickets), JSON.stringify(seed.directMessages), JSON.stringify(seed.notifications)
    ]);
  }
  await db.query('DELETE FROM equipvirtual_sessions WHERE expires_at <= UTC_TIMESTAMP()');
}

async function getState() {
  await ensureDatabase();
  const db = await getPool();
  const [rows] = await db.query(`SELECT profiles, labs, assets, tickets, direct_messages, notifications FROM ${DB_TABLE} WHERE id = 1 LIMIT 1`);
  if (!rows.length) throw new Error('O estado compartilhado não foi inicializado.');
  return parseRow(rows[0]);
}

async function saveState(raw, actor) {
  const db = await getPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT profiles, labs, assets, tickets, direct_messages, notifications FROM ${DB_TABLE} WHERE id = 1 FOR UPDATE`);
    if (!rows.length) throw new Error('O estado compartilhado não foi inicializado.');
    const current = parseRow(rows[0]);
    const next = applyStateUpdate(raw, current, actor, hashPassword);
    await connection.execute(`UPDATE ${DB_TABLE} SET profiles = ?, labs = ?, assets = ?, tickets = ?, direct_messages = ?, notifications = ? WHERE id = 1`, [
      JSON.stringify(next.profiles), JSON.stringify(next.labs), JSON.stringify(next.assets), JSON.stringify(next.tickets), JSON.stringify(next.directMessages), JSON.stringify(next.notifications)
    ]);
    await connection.commit();
    return stateForActor(next, actor);
  } catch (error) {
    try { await connection.rollback(); } catch (_rollbackError) {}
    throw error;
  } finally {
    connection.release();
  }
}

function bodyJson(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) reject(Object.assign(new Error('Payload muito grande.'), { status: 413 }));
    });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_error) { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[ext] || 'application/octet-stream';
}

function loginAllowed(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt >= windowMs) loginAttempts.set(key, { startedAt: now, count: 0 });
  const bucket = loginAttempts.get(key);
  if (bucket.count >= 12) return false;
  bucket.count += 1;
  return true;
}

async function actorFromRequest(request) {
  const db = await getPool();
  const session = await lookupSession(db, request);
  if (!session) return null;
  const state = await getState();
  const profile = state.profiles.find((item) => item.id === session.profile_id);
  if (!profile) {
    await revokeSession(db, session);
    return null;
  }
  return { session, profile, state };
}

function requireCsrf(request, session) {
  const supplied = request.headers['x-csrf-token'];
  if (!constantTimeEqual(supplied, session.csrf_token)) {
    throw Object.assign(new Error('A sessão expirou ou a solicitação não é válida. Entre novamente.'), { status: 403 });
  }
}

async function handleApi(request, response, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    await ensureDatabase();
    const db = await getPool();
    await db.query('SELECT 1');
    sendJson(response, 200, { ok: true, service: 'EquipVirtual', database: 'ready' });
    return;
  }

  if (url.pathname === '/api/login' && request.method === 'POST') {
    if (!loginAllowed(request)) { sendJson(response, 429, { ok: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }); return; }
    const body = await bodyJson(request);
    const email = String(body.email || '').trim().toLocaleLowerCase('pt-BR');
    const password = String(body.password || '');
    const role = String(body.role || '');
    const state = await getState();
    const profile = state.profiles.find((entry) => entry.role === role && entry.email.toLocaleLowerCase('pt-BR') === email && verifyPassword(password, entry.password));
    if (!profile) { sendJson(response, 401, { ok: false, message: 'E-mail, senha ou tipo de perfil inválido.' }); return; }
    loginAttempts.delete(request.socket.remoteAddress || 'unknown');
    const db = await getPool();
    const session = await createSession(db, profile.id);
    sendJson(response, 200, { ok: true, profile: publicProfile(profile), csrfToken: session.csrfToken }, { 'Set-Cookie': cookieHeader(session.token) });
    return;
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const actor = await actorFromRequest(request);
    if (!actor) { sendJson(response, 401, { ok: false }); return; }
    sendJson(response, 200, { ok: true, profile: publicProfile(actor.profile), csrfToken: actor.session.csrf_token });
    return;
  }

  if (url.pathname === '/api/logout' && request.method === 'POST') {
    const actor = await actorFromRequest(request);
    if (!actor) { response.writeHead(204, { 'Set-Cookie': clearedCookieHeader(), 'Cache-Control': 'no-store' }); response.end(); return; }
    requireCsrf(request, actor.session);
    await revokeSession(await getPool(), actor.session);
    response.writeHead(204, { 'Set-Cookie': clearedCookieHeader(), 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  if (url.pathname === '/api/state' && request.method === 'GET') {
    const actor = await actorFromRequest(request);
    if (!actor) { sendJson(response, 401, { ok: false, message: 'Faça login para acessar os dados.' }); return; }
    sendJson(response, 200, stateForActor(actor.state, actor.profile));
    return;
  }

  if (url.pathname === '/api/state' && request.method === 'PUT') {
    const actor = await actorFromRequest(request);
    if (!actor) { sendJson(response, 401, { ok: false, message: 'Faça login para salvar os dados.' }); return; }
    requireCsrf(request, actor.session);
    const next = await saveState(await bodyJson(request), actor.profile);
    sendJson(response, 200, next);
    return;
  }

  sendJson(response, 404, { ok: false, message: 'API não encontrada.' });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) { await handleApi(request, response, url); return; }
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(requested)}`);
    if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': url.pathname === '/manus-routes.json' ? 'no-cache' : 'public, max-age=0' });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    const status = Number(error.status) || (url.pathname.startsWith('/api/') ? 500 : 404);
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, status, { ok: false, message: error.status ? error.message : 'Não foi possível acessar o serviço agora.' });
    } else {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(status === 404 ? 'Not found' : 'Request failed');
    }
    if (!error.status) console.error('Request failed:', error.code || error.name || 'Error');
  }
}

ready = ensureDatabase();
ready.catch((error) => console.error('Database initialization failed:', error.message));
const server = http.createServer((request, response) => {
  ready.then(() => handleRequest(request, response)).catch((error) => {
    console.error('Application unavailable:', error.code || error.name || 'Error');
    sendJson(response, 503, { ok: false, message: 'Servidor indisponível.' });
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`EquipVirtual server listening on ${PORT}`));

module.exports = { server, ensureDatabase, getState, saveState };
