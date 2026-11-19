-- Help! — perfis fixos de professores e administrador
-- Execute depois de database/help_app_relational.sql.
-- Pode ser executado novamente: os registros existentes serão atualizados,
-- sem criar duplicidade por e-mail.

USE help_db;

INSERT INTO users (id, name, email, password_hash, role, department, room, active)
VALUES
  ('prof-rafael', 'Professor Rafael Conceição', 'rafael.conceicao@gmail.com', '123456', 'user', 'Informática', '166', 1),
  ('prof-lucas', 'Professor Lucas Oliveira', 'lucas.oliveira@gmail.com', '246810', 'user', 'Informática', '221', 1),
  ('prof-maria', 'Professora Maria Julia', 'maria.ju@gmail.com', '369122', 'user', 'Informática', '094', 1),
  ('prof-luana', 'Professora Luana Silva', 'luana.silva@gmail.com', '481216', 'user', 'Informática', '265', 1),
  ('admin-guilherme', 'Administrador Guilherme dos Santos', 'guilherme.santos@gmail.com', '221340', 'admin', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  department = VALUES(department),
  room = VALUES(room),
  active = VALUES(active);

INSERT INTO laboratories (id, name, room, department, responsible_user_id)
VALUES
  ('lab-166', 'Laboratório de Informática', '166', 'Informática', 'prof-rafael'),
  ('lab-221', 'Laboratório de Informática', '221', 'Informática', 'prof-lucas'),
  ('lab-094', 'Laboratório de Informática', '094', 'Informática', 'prof-maria'),
  ('lab-265', 'Laboratório de Informática', '265', 'Informática', 'prof-luana')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  department = VALUES(department),
  responsible_user_id = VALUES(responsible_user_id),
  active = 1;

DROP PROCEDURE IF EXISTS sp_upsert_professor;

DELIMITER $$

CREATE PROCEDURE sp_upsert_professor(
  IN p_id VARCHAR(64),
  IN p_name VARCHAR(150),
  IN p_email VARCHAR(190),
  IN p_password VARCHAR(255),
  IN p_department VARCHAR(120),
  IN p_room VARCHAR(30)
)
BEGIN
  DECLARE v_lab_id VARCHAR(64);

  SET v_lab_id = CONCAT('lab-', p_room);

  INSERT INTO users (id, name, email, password_hash, role, department, room, active)
  VALUES (p_id, p_name, LOWER(TRIM(p_email)), p_password, 'user', p_department, p_room, 1)
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    role = 'user',
    department = VALUES(department),
    room = VALUES(room),
    active = 1;

  INSERT INTO laboratories (id, name, room, department, responsible_user_id)
  VALUES (v_lab_id, p_department, p_room, p_department, p_id)
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    department = VALUES(department),
    responsible_user_id = VALUES(responsible_user_id),
    active = 1;
END$$

DELIMITER ;

-- Exemplo: cadastrar ou atualizar um novo professor.
-- A procedure termina a operação imediatamente no banco.
-- CALL sp_upsert_professor(
--   'prof-ana-souza',
--   'Professora Ana Souza',
--   'ana.souza@escola.com',
--   'SENHA_INICIAL',
--   'Informática',
--   '310'
-- );

-- Conferência dos perfis cadastrados:
SELECT id, name, email, role, department, room, active
FROM users
WHERE role IN ('admin', 'user')
ORDER BY role DESC, name;
