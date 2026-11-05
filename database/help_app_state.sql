-- Esquema local opcional do EquipVirtual; não inclui usuários ou senhas.
-- O servidor cria as tabelas e insere o seed apenas quando o estado está vazio.

CREATE DATABASE IF NOT EXISTS help_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE help_db;

CREATE TABLE IF NOT EXISTS help_app_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  profiles JSON NOT NULL,
  labs JSON NOT NULL,
  assets JSON NOT NULL,
  tickets JSON NOT NULL,
  direct_messages JSON NOT NULL,
  notifications JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipvirtual_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  profile_id VARCHAR(191) NOT NULL,
  csrf_token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_equipvirtual_sessions_expiry (expires_at),
  INDEX idx_equipvirtual_sessions_profile (profile_id)
);
