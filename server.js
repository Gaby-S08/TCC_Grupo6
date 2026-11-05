require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const seed = require('./server/seed');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const FALLBACK_STATE_FILE = path.join(DATA_DIR, 'state.json');
const DB_TABLE = 'help_app_state';
let pool;
let ready;
let storageMode = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (error) { return fallback; }
}

function publicProfile(profile) {
  const { password, ...safe } = profile;
  return { ...safe, password: '__remote__' };
}

function publicState(state) {
  return { ...state, profiles: state.profiles.map(publicProfile) };
}

function normalizeState(raw) {
  return {
    profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
    labs: Array.isArray(raw.labs) ? raw.labs : [],
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    tickets: Array.isArray(raw.tickets) ? raw.tickets : [],
    directMessages: Array.isArray(raw.directMessages) ? raw.directMessages : [],
    notifications: Array.isArray(raw.notifications) ? raw.notifications : []
  };
}

async function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não está disponível.');
  if (!pool) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

async function ensureFallbackStore() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.promises.access(FALLBACK_STATE_FILE, fs.constants.F_OK);
  } catch (error) {
    await fs.promises.writeFile(FALLBACK_STATE_FILE, JSON.stringify(normalizeState(seed), null, 2), 'utf8');
  }
}

async function ensureDatabase() {
  if (storageMode === 'file') {
    await ensureFallbackStore();
    return;
  }
  try {
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
    const [rows] = await db.query(`SELECT id FROM ${DB_TABLE} WHERE id = 1 LIMIT 1`);
    if (!rows.length) {
      await db.execute(`INSERT INTO ${DB_TABLE} (id, profiles, labs, assets, tickets, direct_messages, notifications) VALUES (1, ?, ?, ?, ?, ?, ?)`, [
        JSON.stringify(seed.profiles), JSON.stringify(seed.labs), JSON.stringify(seed.assets), JSON.stringify(seed.tickets), JSON.stringify(seed.directMessages), JSON.stringify(seed.notifications)
      ]);
    }
    storageMode = 'mysql';
  } catch (error) {
    storageMode = 'file';
    console.warn(`MySQL indisponível (${error.code || error.message}); usando armazenamento local em ${FALLBACK_STATE_FILE}.`);
    await ensureFallbackStore();
  }
}

async function getState() {
  await ensureDatabase();
  if (storageMode === 'file') {
    const raw = await fs.promises.readFile(FALLBACK_STATE_FILE, 'utf8');
    return normalizeState(JSON.parse(raw));
  }
  const db = await getPool();
  const [rows] = await db.query(`SELECT profiles, labs, assets, tickets, direct_messages, notifications FROM ${DB_TABLE} WHERE id = 1 LIMIT 1`);
  if (!rows.length) throw new Error('Estado compartilhado não foi inicializado.');
  const row = rows[0];
  return normalizeState({
    profiles: safeJson(row.profiles, seed.profiles),
    labs: safeJson(row.labs, seed.labs),
    assets: safeJson(row.assets, seed.assets),
    tickets: safeJson(row.tickets, seed.tickets),
    directMessages: safeJson(row.direct_messages, seed.directMessages),
    notifications: safeJson(row.notifications, seed.notifications)
  });
}

function mergeProfiles(incoming, current) {
  const oldById = new Map(current.map((profile) => [profile.id, profile]));
  return incoming.map((profile) => {
    const previous = oldById.get(profile.id);
    return profile.password && profile.password !== '__remote__' ? profile : { ...profile, password: previous?.password || '' };
  }).filter((profile) => profile.id && profile.email && profile.name && profile.role && profile.password);
}

function mergeById(incoming, current) {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => { if (item && item.id) merged.set(item.id, item); });
  return Array.from(merged.values());
}

async function saveState(raw) {
  const current = await getState();
  const incoming = normalizeState(raw);
  const next = {
    ...incoming,
    profiles: mergeProfiles(incoming.profiles, current.profiles),
    directMessages: mergeById(incoming.directMessages, current.directMessages),
    notifications: mergeById(incoming.notifications, current.notifications)
  };
  if (storageMode === 'file') {
    const temporaryFile = `${FALLBACK_STATE_FILE}.tmp`;
    await fs.promises.writeFile(temporaryFile, JSON.stringify(next, null, 2), 'utf8');
    await fs.promises.rename(temporaryFile, FALLBACK_STATE_FILE);
    return next;
  }
  const db = await getPool();
  await db.execute(`UPDATE ${DB_TABLE} SET profiles = ?, labs = ?, assets = ?, tickets = ?, direct_messages = ?, notifications = ? WHERE id = 1`, [
    JSON.stringify(next.profiles), JSON.stringify(next.labs), JSON.stringify(next.assets), JSON.stringify(next.tickets), JSON.stringify(next.directMessages), JSON.stringify(next.notifications)
  ]);
  await db.query('COMMIT');
  return next;
}

function bodyJson(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; if (raw.length > 8 * 1024 * 1024) reject(new Error('Payload muito grande.')); });
    request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(new Error('JSON inválido.')); } });
    request.on('error', reject);
  });
}

function sendJson(response, status, payload) {
  const output = JSON.stringify(payload);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  response.end(output);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[ext] || 'application/octet-stream';
}

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' });
    response.end();
    return;
  }
  if (url.pathname === '/api/health' && request.method === 'GET') {
    await ensureDatabase();
    sendJson(response, 200, { ok: true, service: 'Help! shared data' });
    return;
  }
  if (url.pathname === '/api/state' && request.method === 'GET') {
    sendJson(response, 200, publicState(await getState()));
    return;
  }
  if (url.pathname === '/api/state' && request.method === 'PUT') {
    sendJson(response, 200, publicState(await saveState(await bodyJson(request))));
    return;
  }
  if (url.pathname === '/api/login' && request.method === 'POST') {
    const body = await bodyJson(request);
    const email = String(body.email || '').trim().toLocaleLowerCase('pt-BR');
    const password = String(body.password || '');
    const role = String(body.role || '');
    const state = await getState();
    const profile = state.profiles.find((entry) => entry.role === role && entry.email.toLocaleLowerCase('pt-BR') === email && entry.password === password);
    if (!profile) { sendJson(response, 401, { ok: false, message: 'E-mail, senha ou tipo de perfil inválido.' }); return; }
    sendJson(response, 200, { ok: true, profile: publicProfile(profile) });
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
    if (url.pathname.startsWith('/api/')) sendJson(response, 500, { ok: false, message: 'Não foi possível acessar os dados compartilhados.' });
    else { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); }
    console.error(error);
  }
}

ready = ensureDatabase().catch((error) => { console.error('Database initialization failed:', error.message); });
const server = http.createServer((request, response) => { ready.then(() => handleRequest(request, response)).catch((error) => { console.error(error); sendJson(response, 500, { ok: false, message: 'Servidor indisponível.' }); }); });
server.listen(PORT, '0.0.0.0', () => console.log(`Help! server listening on ${PORT}`));
