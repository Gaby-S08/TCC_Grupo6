# Plano de implementação — EquipVirtual permanente

## Objetivo e decisões aprovadas

Manter o website EquipVirtual existente em hospedagem permanente, preservando a interface azul-escura/azul, os recursos de professor/admin, os dados atuais e a identidade visual. O backend usa o servidor Node e MySQL gerenciado. Nesta solicitação, atualizar somente os cinco perfis iniciais e as quatro localizações associadas no banco compartilhado; preservar ativos, chamados, mensagens, notificações e os demais dados. Não importar dados de outro banco.

## Abordagem

- Manter as contas fixas e os dados de laboratório em `server/fixed-profiles.js`; as cinco senhas são recebidas apenas pelo segredo protegido `EQUIPVIRTUAL_FIXED_PROFILE_PASSWORDS_JSON`. No banco, armazenar hashes scrypt com salt, nunca as senhas em texto puro.
- Para uma base vazia, `server/seed.js` usa as definições fixas e as senhas do ambiente. Para a base existente, `scripts/migrate-fixed-profiles.js` aplica uma migração MySQL transacional, versionada e de uso único; atualiza nome/e-mail/função/localização e hash de senha, corrige os quatro laboratórios e salas, encerra sessões existentes dos cinco perfis e preserva as demais coleções.
- No painel administrativo, as ações de cadastrar/editar/remover professor e cadastrar/editar laboratório aguardam confirmação do `PUT /api/state`; ao falhar a confirmação, a tela e o cache local são reconciliados com o estado remoto e o administrador recebe aviso antes de repetir.
- Continuar exigindo sessão válida para ler/gravar dados, CSRF em mutações, hash de senhas, cookie HttpOnly seguro e autorização por perfil/laboratório.
- Preservar as mensagens professor-admin no MySQL compartilhado, o polling existente, as notificações, catálogo, chamados, relatórios, filtros, exports e layout responsivo.
- Usar `/api/health`, `PORT`, `DATABASE_URL`, `Dockerfile` e `public/manus-routes.json` conforme o runtime gerenciado. As alterações do servidor e do cliente devem ser versionadas em `main`; quando a publicação automática estiver habilitada, o push promove o checkpoint.

## Estrutura do projeto

- `server.js`: servidor HTTP, arquivos estáticos, API de saúde/login/estado e acesso transacional ao MySQL.
- `server/auth.js`: hashes, cookie, sessões e CSRF.
- `server/permissions.js`: filtragem por perfil e autorização por laboratório.
- `server/fixed-profiles.js`: definições dos perfis e salas e validações, sem credenciais.
- `server/seed.js`: estado inicial seguro para banco vazio.
- `scripts/migrate-fixed-profiles.js`: migração controlada de uso único para o banco compartilhado.
- `public/index.html`, `public/js/app.js`, `public/js/storage.js`, `public/js/data.js` e `public/css/styles.css`: interface, formulários, confirmação de gravações, comunicação com a API, conteúdo público e estilos.
- `public/assets/`: logotipos e imagens existentes; `public/manus-routes.json`: manifesto de rota.
- `database/`: esquema local opcional e instruções, sem senhas.
- `tests/`: testes de autenticação, permissões, salas e migração de perfis.
- `Dockerfile`, `package.json` e `package-lock.json`: build e execução do container.

## Restrições

O banco gerenciado é compartilhado entre desenvolvimento e publicação; migrações e testes que escrevam nele afetam o site publicado. A senha vem de segredo protegido, e o código/SQL/documentação não deve conter os valores literais. A migração existente não reverte nem sobrescreve as outras coleções.
