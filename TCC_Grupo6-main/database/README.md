# Banco MySQL do Help!

O arquivo `help_app_state.sql` mantém o formato legado compatível com o `server.js` atual: uma linha com colunas JSON para perfis, laboratórios, ativos, chamados, mensagens diretas e notificações.

Para uma estrutura mais organizada e pronta para consultas relacionais, use `help_app_relational.sql`. Ele separa usuários, laboratórios, categorias, ativos, chamados, mensagens dos chamados, mensagens diretas, notificações e anexos, usando chaves estrangeiras e índices.

Para cadastrar ou atualizar os perfis fixos e disponibilizar a procedure de novos professores, execute também `professors_seed.sql`. O script usa `ON DUPLICATE KEY UPDATE`, normaliza os e-mails para minúsculo e não duplica usuários. A procedure `sp_upsert_professor` grava o professor e vincula seu laboratório na mesma operação.

## Importação no MySQL Workbench

1. Abra `help_app_relational.sql` no MySQL Workbench para usar o novo modelo relacional.
2. Execute o script inteiro.
3. Abra e execute `professors_seed.sql`.
4. Confira se o banco `help_db` e as tabelas `users`, `laboratories`, `assets`, `tickets` e `ticket_messages` foram criados.
5. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com o usuário, senha e endereço do seu MySQL.
6. Na pasta do projeto, execute `npm install` e depois `npm start`.
7. Acesse `http://localhost:3000`.

## Importação pelo terminal

```bash
mysql -u root -p < database/help_app_state.sql
```

Se o MySQL estiver em outro servidor, altere a URL, por exemplo:

```env
DATABASE_URL=mysql://help_user:SENHA@meu-servidor:3306/help_db
```

O backend atual ainda lê a tabela legada `help_app_state`; portanto, o script relacional deve ser aplicado junto com uma futura migração do `server.js` para as novas tabelas. O script SQL é útil para deixar a estrutura pronta antes dessa migração. As credenciais no arquivo são apenas de demonstração; troque-as antes de usar em produção.
