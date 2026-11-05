'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const { hashPassword } = require('../server/auth');
const { parseFixedProfilePasswords, applyFixedProfileData, PROFILE_DEFINITIONS } = require('../server/fixed-profiles');

const STATE_TABLE = 'help_app_state';
const MIGRATIONS_TABLE = 'equipvirtual_migrations';
const MIGRATION_ID = '2026-11-05-fixed-initial-profile-credentials-v1';

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_error) { throw new Error('O estado JSON do banco está inválido; nenhuma alteração foi aplicada.'); }
}

function validateUniqueProfiles(profiles) {
  const emails = new Set();
  for (const profile of profiles) {
    const email = String(profile.email || '').trim().toLocaleLowerCase('pt-BR');
    if (!email || emails.has(email)) throw new Error('Os e-mails dos perfis não são únicos; nenhuma alteração foi aplicada.');
    emails.add(email);
  }
}

function validateUniqueLabRooms(labs) {
  const keys = new Set();
  for (const lab of labs) {
    const key = `${String(lab.dept || '').trim().toLocaleLowerCase('pt-BR')}\u0000${String(lab.room || '').trim().toLocaleLowerCase('pt-BR')}`;
    if (!lab.dept || !lab.room || keys.has(key)) throw new Error('Há laboratório ou sala duplicada; nenhuma alteração foi aplicada.');
    keys.add(key);
  }
}

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não está configurado.');
  const passwords = parseFixedProfilePasswords();
  if (!passwords) throw new Error('O segredo protegido das senhas dos perfis não está disponível.');

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_id VARCHAR(128) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await connection.beginTransaction();
    const [applied] = await connection.execute(`SELECT migration_id FROM ${MIGRATIONS_TABLE} WHERE migration_id = ? FOR UPDATE`, [MIGRATION_ID]);
    if (applied.length) {
      await connection.rollback();
      console.log('Migração dos perfis fixos já aplicada; nenhum dado foi alterado.');
      return;
    }

    const [rows] = await connection.query(`SELECT profiles, labs FROM ${STATE_TABLE} WHERE id = 1 FOR UPDATE`);
    if (!rows.length) throw new Error('O estado inicial do EquipVirtual não existe no banco; nenhuma alteração foi aplicada.');
    const currentProfiles = parseJson(rows[0].profiles, []);
    const currentLabs = parseJson(rows[0].labs, []);
    if (!Array.isArray(currentProfiles) || !Array.isArray(currentLabs)) throw new Error('As coleções de perfis/laboratórios não são válidas.');

    const updated = applyFixedProfileData(currentProfiles, currentLabs, passwords, hashPassword);
    validateUniqueProfiles(updated.profiles);
    validateUniqueLabRooms(updated.labs);
    await connection.execute(`UPDATE ${STATE_TABLE} SET profiles = ?, labs = ? WHERE id = 1`, [JSON.stringify(updated.profiles), JSON.stringify(updated.labs)]);

    const profileIds = PROFILE_DEFINITIONS.map((profile) => profile.id);
    const placeholders = profileIds.map(() => '?').join(', ');
    const [sessionResult] = await connection.execute(`DELETE FROM equipvirtual_sessions WHERE profile_id IN (${placeholders})`, profileIds);
    await connection.execute(`INSERT INTO ${MIGRATIONS_TABLE} (migration_id) VALUES (?)`, [MIGRATION_ID]);
    await connection.commit();
    console.log(`Migração concluída: ${updated.profiles.length} perfis preservados/atualizados, ${updated.labs.length} laboratórios verificados, ${sessionResult.affectedRows} sessões anteriores encerradas.`);
  } catch (error) {
    try { await connection.rollback(); } catch (_rollbackError) {}
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(`Migração não concluída: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { migrate, MIGRATION_ID, validateUniqueProfiles, validateUniqueLabRooms };
