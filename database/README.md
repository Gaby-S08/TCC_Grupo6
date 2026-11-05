# Banco MySQL do EquipVirtual

`help_app_state.sql` contém somente o esquema local opcional das tabelas. Ele não inclui contas ou senhas. O servidor cria as mesmas tabelas automaticamente quando `DATABASE_URL` está configurado e inicializa os dados apenas quando ainda não existe a linha principal.

## Execução local

1. Configure `DATABASE_URL` para um banco MySQL de desenvolvimento.
2. Configure `EQUIPVIRTUAL_FIXED_PROFILE_PASSWORDS_JSON` como segredo protegido do ambiente para os cinco perfis iniciais; não grave o conteúdo em `.env.example`, SQL, documentação ou Git.
3. Se preferir usar uma senha inicial separada para o administrador de um banco vazio, configure `INITIAL_ADMIN_PASSWORD` com pelo menos 12 caracteres. Quando o segredo dos cinco perfis está configurado, o seed o utiliza para essas contas.
4. Execute `npm ci` e `npm start`; o servidor prepara o esquema e armazena as senhas usando hash scrypt com salt.
5. Acesse `http://localhost:3000`. As senhas dos perfis existentes podem ser redefinidas pelo administrador na área de edição.

## Atualizar perfis existentes

O comando `npm run migrate:fixed-profiles` aplica uma migração transacional identificada por versão. Ele atualiza os cinco perfis iniciais e seus laboratórios/salas, armazena hashes de senha, encerra as sessões anteriores desses perfis e preserva as demais coleções. A migração requer `DATABASE_URL` e o segredo protegido acima; é aplicada uma única vez e o marcador é salvo na mesma transação.

O banco gerenciado é compartilhado entre desenvolvimento e publicação. Execute a migração somente quando a atualização dos perfis existentes for desejada. O script SQL é opcional para ambientes locais; não o use para substituir o estado de um banco com dados.
