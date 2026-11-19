-- Help! — esquema relacional normalizado para MySQL 8+
--
-- Este modelo substitui a tabela única help_app_state, que guardava vários
-- conjuntos de dados em colunas JSON. Execute em um banco de desenvolvimento
-- antes de migrar os dados atuais.

CREATE DATABASE IF NOT EXISTS help_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE help_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  department VARCHAR(120) NULL,
  room VARCHAR(30) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS laboratories (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  room VARCHAR(30) NOT NULL,
  department VARCHAR(120) NOT NULL,
  responsible_user_id VARCHAR(64) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_laboratories_department (department),
  CONSTRAINT fk_laboratories_responsible
    FOREIGN KEY (responsible_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asset_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  UNIQUE KEY uq_asset_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  laboratory_id VARCHAR(64) NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('available', 'maintenance', 'inactive') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assets_code (code),
  KEY idx_assets_lab_status (laboratory_id, status),
  CONSTRAINT fk_assets_laboratory
    FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_assets_category
    FOREIGN KEY (category_id) REFERENCES asset_categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  ticket_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id VARCHAR(64) NOT NULL,
  assigned_admin_id VARCHAR(64) NULL,
  laboratory_id VARCHAR(64) NULL,
  asset_id VARCHAR(64) NULL,
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  status ENUM('open', 'in_progress', 'waiting_user', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  UNIQUE KEY uq_tickets_number (ticket_number),
  KEY idx_tickets_requester_status (requester_id, status),
  KEY idx_tickets_admin_status (assigned_admin_id, status),
  KEY idx_tickets_lab (laboratory_id),
  KEY idx_tickets_asset (asset_id),
  CONSTRAINT fk_tickets_requester
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_admin
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_laboratory
    FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_asset
    FOREIGN KEY (asset_id) REFERENCES assets(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(64) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ticket_messages_ticket_date (ticket_id, created_at),
  CONSTRAINT fk_ticket_messages_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ticket_messages_author
    FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sender_id VARCHAR(64) NOT NULL,
  recipient_id VARCHAR(64) NOT NULL,
  subject VARCHAR(180) NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_direct_messages_recipient_read (recipient_id, read_at, created_at),
  KEY idx_direct_messages_conversation (sender_id, recipient_id, created_at),
  CONSTRAINT fk_direct_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_direct_messages_recipient
    FOREIGN KEY (recipient_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(500) NOT NULL,
  ticket_id VARCHAR(64) NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user_read_date (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(64) NULL,
  message_id BIGINT UNSIGNED NULL,
  uploaded_by VARCHAR(64) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attachments_ticket (ticket_id),
  KEY idx_attachments_message (message_id),
  CONSTRAINT fk_attachments_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_attachments_message
    FOREIGN KEY (message_id) REFERENCES ticket_messages(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_attachments_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_attachments_parent
    CHECK (ticket_id IS NOT NULL OR message_id IS NOT NULL)
) ENGINE=InnoDB;

-- Dados iniciais mínimos. As senhas abaixo são apenas exemplos de desenvolvimento.
INSERT INTO users (id, name, email, password_hash, role, department, room)
VALUES
  ('admin-guilherme', 'Administrador Guilherme dos Santos', 'guilherme.santos@gmail.com', '221340', 'admin', NULL, NULL),
  ('prof-rafael', 'Professor Rafael Conceição', 'rafael.conceicao@gmail.com', '123456', 'user', 'Informática', '166'),
  ('prof-lucas', 'Professor Lucas Oliveira', 'lucas.oliveira@gmail.com', '246810', 'user', 'Informática', '221'),
  ('prof-maria', 'Professora Maria Julia', 'maria.ju@gmail.com', '369122', 'user', 'Informática', '094'),
  ('prof-luana', 'Professora Luana Silva', 'luana.silva@gmail.com', '481216', 'user', 'Informática', '265')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  department = VALUES(department),
  room = VALUES(room);

INSERT INTO laboratories (id, name, room, department, responsible_user_id)
VALUES
  ('lab-166', 'Laboratório de Informática · Sala 166', '166', 'Informática', 'prof-rafael'),
  ('lab-221', 'Laboratório de Informática · Sala 221', '221', 'Informática', 'prof-lucas'),
  ('lab-094', 'Laboratório de Informática · Sala 094', '094', 'Informática', 'prof-maria'),
  ('lab-265', 'Laboratório de Informática · Sala 265', '265', 'Informática', 'prof-luana')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  department = VALUES(department),
  responsible_user_id = VALUES(responsible_user_id);

INSERT INTO asset_categories (name, description)
VALUES ('Computadores', 'Estações de trabalho para aulas de informática')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO assets (id, code, laboratory_id, category_id, name, description, quantity)
SELECT 'a166-001', 'INF-166-001', 'lab-166', id, 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10
FROM asset_categories WHERE name = 'Computadores'
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), description = VALUES(description);

INSERT INTO assets (id, code, laboratory_id, category_id, name, description, quantity)
SELECT 'a221-001', 'INF-221-001', 'lab-221', id, 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10
FROM asset_categories WHERE name = 'Computadores'
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), description = VALUES(description);

INSERT INTO assets (id, code, laboratory_id, category_id, name, description, quantity)
SELECT 'a094-001', 'INF-094-001', 'lab-094', id, 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10
FROM asset_categories WHERE name = 'Computadores'
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), description = VALUES(description);

INSERT INTO assets (id, code, laboratory_id, category_id, name, description, quantity)
SELECT 'a265-001', 'INF-265-001', 'lab-265', id, 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10
FROM asset_categories WHERE name = 'Computadores'
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), description = VALUES(description);

SET FOREIGN_KEY_CHECKS = 1;

-- Consultas úteis para validar a estrutura:
-- SELECT * FROM users;
-- SELECT l.name, a.code, a.name, a.quantity FROM laboratories l JOIN assets a ON a.laboratory_id = l.id;
-- SELECT t.ticket_number, t.subject, t.status, u.name AS requester FROM tickets t JOIN users u ON u.id = t.requester_id;
-- SELECT t.ticket_number, m.created_at, u.name, m.message FROM ticket_messages m JOIN tickets t ON t.id = m.ticket_id JOIN users u ON u.id = m.author_id ORDER BY m.created_at;
