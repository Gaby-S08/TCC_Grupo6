-- Help! — instalação do banco MySQL
-- Execute este arquivo em um banco MySQL 8+.
-- O servidor Node também cria a tabela automaticamente quando DATABASE_URL é válido.

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

-- Insere os dados de demonstração somente quando a linha principal ainda não existe.
INSERT INTO help_app_state
  (id, profiles, labs, assets, tickets, direct_messages, notifications)
SELECT
  1,
  '[{"id":"prof-rafael","name":"Professor Rafael Conceição","email":"rafael.conceicao@gmail.com","password":"123456","role":"user","dept":"Informática","labId":"lab-166","room":"166"},{"id":"prof-lucas","name":"Professor Lucas Oliveira","email":"lucas.oliveira@gmail.com","password":"246810","role":"user","dept":"Informática","labId":"lab-221","room":"221"},{"id":"prof-maria","name":"Professora Maria Julia","email":"maria.ju@gmail.com","password":"369122","role":"user","dept":"Informática","labId":"lab-094","room":"094"},{"id":"prof-luana","name":"Professora Luana Silva","email":"luana.silva@gmail.com","password":"481216","role":"user","dept":"Informática","labId":"lab-265","room":"265"},{"id":"admin-guilherme","name":"Administrador Guilherme dos Santos","email":"guilherme.santos@gmail.com","password":"221340","role":"admin"}]',
  '[{"id":"lab-166","dept":"Informática","name":"Laboratório de Informática · Sala 166","room":"166","profileId":"prof-rafael"},{"id":"lab-221","dept":"Informática","name":"Laboratório de Informática · Sala 221","room":"221","profileId":"prof-lucas"},{"id":"lab-094","dept":"Informática","name":"Laboratório de Informática · Sala 094","room":"094","profileId":"prof-maria"},{"id":"lab-265","dept":"Informática","name":"Laboratório de Informática · Sala 265","room":"265","profileId":"prof-luana"}]',
  '[{"id":"a166-001","code":"INF-166-001","labId":"lab-166","name":"Computador de bancada","desc":"Estação de trabalho para aulas de informática.","qty":10},{"id":"a221-001","code":"INF-221-001","labId":"lab-221","name":"Computador de bancada","desc":"Estação de trabalho para aulas de informática.","qty":10},{"id":"a094-001","code":"INF-094-001","labId":"lab-094","name":"Computador de bancada","desc":"Estação de trabalho para aulas de informática.","qty":10},{"id":"a265-001","code":"INF-265-001","labId":"lab-265","name":"Computador de bancada","desc":"Estação de trabalho para aulas de informática.","qty":10}]',
  '[]', '[]', '[]'
WHERE NOT EXISTS (SELECT 1 FROM help_app_state WHERE id = 1);

-- Credenciais demonstrativas:
-- Administrador: guilherme.santos@gmail.com / 221340
-- Professor: rafael.conceicao@gmail.com / 123456
