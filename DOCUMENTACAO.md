# Help! — Documentação do Sistema

## 1. Visão geral

O **Help!** é um sistema web responsivo para gerenciamento de equipamentos, laboratórios, chamados de manutenção, mensagens e notificações. Ele foi desenvolvido para funcionar em computadores, tablets e celulares.

O sistema possui dois tipos de acesso:

- **Administrador:** acompanha todos os laboratórios, equipamentos, professores, chamados, mensagens e notificações.
- **Professor/funcionário:** acessa os equipamentos do laboratório vinculado, abre chamados, acompanha solicitações e conversa com a administração.

A aplicação é composta por uma interface web, um servidor Node.js e um banco de dados MySQL.

---

## 2. Arquitetura do projeto

O funcionamento é dividido em três partes:

```text
Navegador do usuário
        ↓
Servidor Node.js / API
        ↓
Banco de dados MySQL
```

### Navegador

Exibe a página inicial, tela de login, painéis, catálogos, chamados, chat e notificações.

### Node.js

Executa o servidor, entrega os arquivos do site, valida o login e faz a comunicação com o MySQL.

### MySQL

Armazena os perfis, laboratórios, equipamentos, chamados, mensagens diretas e notificações compartilhadas entre os dispositivos.

---

## 3. Estrutura dos arquivos

```text
Help_codigo_com_MySQL/
├── server.js                  # Servidor Node.js e API
├── package.json               # Dependências e comandos do projeto
├── package-lock.json          # Versões exatas das dependências
├── .env.example               # Modelo de configuração do MySQL
├── Dockerfile                 # Configuração opcional para publicação
├── README.md                  # Instruções resumidas
├── DOCUMENTACAO.md            # Este manual
├── database/
│   ├── help_app_state.sql     # Criação do banco e dados iniciais
│   └── README.md              # Instruções específicas do MySQL
└── public/
    ├── index.html             # Página inicial e portal
    ├── css/styles.css         # Estilos e responsividade
    ├── js/app.js              # Regras e interações da aplicação
    ├── js/data.js             # Dados auxiliares e departamentos
    ├── js/storage.js          # Comunicação com a API e fallback local
    ├── js/vendor/             # Bibliotecas locais
    └── assets/                # Logos e imagens
```

---

## 4. Requisitos para executar no computador

Instale os seguintes programas:

- **Node.js 20 ou superior**
- **MySQL 8 ou superior**
- **VS Code**, recomendado para editar e executar o projeto
- **MySQL Workbench**, opcional, para importar e visualizar o banco

Para verificar o Node.js no Windows:

```cmd
node --version
npm --version
```

Para verificar o MySQL pelo terminal:

```cmd
mysql --version
```

---

## 5. Configuração do banco MySQL

### 5.1 Criar o banco automaticamente pelo script

Na pasta do projeto existe o arquivo:

```text
database/help_app_state.sql
```

No MySQL Workbench:

1. Abra o MySQL Workbench.
2. Conecte-se ao servidor MySQL.
3. Abra `database/help_app_state.sql`.
4. Execute o script completo.
5. Confirme se o banco `help_db` foi criado.
6. Confirme se a tabela `help_app_state` foi criada.

Também é possível executar pelo terminal do Windows:

```cmd
mysql -u root -p < database\help_app_state.sql
```

O script cria:

- Banco `help_db`.
- Tabela `help_app_state`.
- Dados iniciais de professores, administrador, laboratórios e equipamentos.

### 5.2 Estrutura da tabela

O sistema atual utiliza uma tabela compartilhada com colunas JSON:

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `id` | `TINYINT` | Identificador principal do estado |
| `profiles` | `JSON` | Administrador e professores |
| `labs` | `JSON` | Laboratórios e salas |
| `assets` | `JSON` | Equipamentos cadastrados |
| `tickets` | `JSON` | Chamados de manutenção |
| `direct_messages` | `JSON` | Mensagens entre professores e administração |
| `notifications` | `JSON` | Notificações dos usuários |
| `updated_at` | `TIMESTAMP` | Data da última alteração |

Essa estrutura é intencional. O servidor lê e grava o estado completo da aplicação em JSON para manter compatibilidade com o projeto atual.

### 5.3 Conferir se o banco está correto

Execute no MySQL:

```sql
USE help_db;

SELECT id, updated_at
FROM help_app_state
WHERE id = 1;
```

Deve existir uma linha com `id = 1`.

Para conferir as quantidades armazenadas:

```sql
SELECT
  JSON_LENGTH(profiles) AS perfis,
  JSON_LENGTH(labs) AS laboratorios,
  JSON_LENGTH(assets) AS equipamentos,
  JSON_LENGTH(tickets) AS chamados,
  JSON_LENGTH(direct_messages) AS mensagens,
  JSON_LENGTH(notifications) AS notificacoes
FROM help_app_state
WHERE id = 1;
```

---

## 6. Configurar o arquivo `.env`

Na mesma pasta onde estão `server.js` e `package.json`, crie um arquivo chamado exatamente:

```text
.env
```

Use o arquivo `.env.example` como modelo. Exemplo:

```env
DATABASE_URL=mysql://root:SUA_SENHA@127.0.0.1:3306/help_db
```

Substitua `SUA_SENHA` pela senha real do usuário MySQL.

Se o usuário não tiver senha, a URL poderá ser:

```env
DATABASE_URL=mysql://root@127.0.0.1:3306/help_db
```

Se a senha tiver caracteres especiais, como `@`, `#`, `/` ou espaços, ela deverá ser codificada na URL ou substituída por um usuário/senha próprios para a aplicação.

O arquivo `.env` deve ficar assim:

```text
Help_codigo_com_MySQL/
├── .env
├── server.js
└── package.json
```

Não publique o arquivo `.env` nem compartilhe a senha do MySQL.

---

## 7. Instalar e iniciar no Windows

Abra o Prompt de Comando ou o terminal do VS Code dentro da pasta do projeto.

### Instalar dependências

```cmd
npm install
```

A mensagem abaixo indica que a instalação terminou corretamente:

```text
added packages
found 0 vulnerabilities
```

### Iniciar o servidor

```cmd
npm start
```

Quando funcionar, aparecerá:

```text
Help! server listening on 3000
```

Mantenha esse terminal aberto enquanto estiver utilizando o sistema.

Abra o navegador em:

```text
http://localhost:3000
```

Para parar o servidor, pressione:

```text
Ctrl + C
```

---

## 8. Erro de porta 3000 ocupada

Se aparecer:

```text
EADDRINUSE: address already in use 0.0.0.0:3000
```

significa que o sistema já está rodando em outro terminal ou que outro programa está usando a porta.

### Usar o servidor que já está aberto

Tente acessar:

```text
http://localhost:3000
```

### Encerrar o processo antigo no Windows

```cmd
netstat -ano | findstr :3000
```

Anote o último número da linha, que é o PID, e execute:

```cmd
taskkill /PID NUMERO_DO_PID /F
```

Depois inicie novamente:

```cmd
npm start
```

Não execute dois servidores na mesma porta ao mesmo tempo.

---

## 9. Credenciais iniciais de demonstração

### Administrador

```text
E-mail: guilherme.santos@gmail.com
Senha: 221340
```

### Professor

```text
E-mail: rafael.conceicao@gmail.com
Senha: 123456
```

Outros perfis de demonstração estão registrados no arquivo `server/seed.js` e no script SQL.

> Para uso real, altere as senhas de demonstração e implemente autenticação com senhas criptografadas, sessões com expiração e controle de permissões mais rigoroso.

---

## 10. Funcionalidades do administrador

O administrador consegue:

- Visualizar indicadores gerais.
- Consultar gráficos por status e laboratório.
- Cadastrar laboratórios.
- Cadastrar professores com nome, e-mail, senha e laboratório.
- Visualizar os perfis cadastrados.
- Acompanhar o catálogo completo.
- Visualizar e atender chamados.
- Alterar o status dos chamados.
- Conversar diretamente com professores.
- Editar dados de professores.
- Receber notificações automáticas.
- Gerar relatórios visuais.

### Cadastro de laboratório

No painel administrativo:

1. Clique em **Novo laboratório**.
2. Selecione o departamento.
3. Informe o nome do laboratório ou sala.
4. Clique em **Salvar laboratório**.

O novo laboratório será persistido no MySQL e aparecerá na seleção do cadastro de professores.

### Cadastro de professor

1. Abra **Usuários e laboratórios**.
2. Clique em **Novo professor**.
3. Informe nome, e-mail e senha inicial.
4. Selecione o departamento.
5. Selecione o laboratório.
6. Clique em **Cadastrar professor**.

O professor poderá entrar posteriormente usando o e-mail e a senha cadastrados.

---

## 11. Funcionalidades do professor

O professor consegue:

- Visualizar equipamentos do laboratório vinculado.
- Pesquisar equipamentos.
- Cadastrar, editar e remover ativos permitidos.
- Abrir chamados de manutenção.
- Anexar foto de evidência ao chamado.
- Acompanhar o histórico de chamados.
- Conversar com a administração.
- Enviar arquivos pelo botão `+` do chat.
- Receber notificações de novas mensagens e atualizações.

---

## 12. Mensagens, anexos e notificações

As mensagens diretas são salvas na coluna `direct_messages` do MySQL.

O botão `+` no chat permite escolher um arquivo. O arquivo é convertido para base64 e salvo junto com a mensagem. O limite atual é de 4 MB por arquivo.

O cabeçalho do sistema possui um sino de notificações. Ele mostra:

- Novas mensagens.
- Novos chamados.
- Mensagens em chamados.
- Alterações de status.

A sincronização automática consulta o servidor a cada 3 segundos. Assim, quando um professor enviar uma mensagem em um dispositivo, o administrador poderá receber o alerta em outro dispositivo conectado.

---

## 13. Endpoints da API

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/api/health` | Verifica se o servidor e o banco estão acessíveis |
| `GET` | `/api/state` | Carrega o estado compartilhado |
| `PUT` | `/api/state` | Salva alterações no estado compartilhado |
| `POST` | `/api/login` | Valida e-mail, senha e tipo de perfil |

Teste de saúde no navegador:

```text
http://localhost:3000/api/health
```

O resultado esperado é semelhante a:

```json
{"ok":true,"service":"Help! shared data"}
```

---

## 14. Dados compartilhados entre dispositivos

Para que dois ou mais dispositivos enxerguem as mesmas informações:

1. Todos devem acessar o mesmo servidor publicado ou o mesmo endereço IP do computador servidor.
2. Todos devem utilizar o mesmo banco MySQL.
3. O servidor Node.js deve permanecer ligado.
4. A porta usada pelo servidor deve estar liberada para os dispositivos, quando executado em rede local.

No computador servidor, o acesso é:

```text
http://localhost:3000
```

Em outro dispositivo da mesma rede, use o IP do computador servidor, por exemplo:

```text
http://192.168.0.10:3000
```

Para acesso externo pela internet, recomenda-se usar a versão publicada do website ou configurar hospedagem, domínio, HTTPS e firewall corretamente.

---

## 15. Backup do banco

Antes de alterações importantes, faça um backup:

```cmd
mysqldump -u root -p help_db > backup_help_db.sql
```

Para restaurar:

```cmd
mysql -u root -p help_db < backup_help_db.sql
```

Também é recomendável copiar periodicamente a tabela `help_app_state`, pois ela contém todo o estado da aplicação.

---

## 16. Solução de problemas

### `npm` não é reconhecido

Instale o Node.js 20 ou superior e reinicie o VS Code ou o Prompt de Comando.

### `DATABASE_URL não está disponível`

Confira se o arquivo `.env` está na mesma pasta do `server.js` e se a variável foi escrita corretamente.

### Erro de acesso negado no MySQL

Confira usuário, senha, endereço, porta e nome do banco na variável `DATABASE_URL`.

### Banco ou tabela não encontrados

Execute novamente:

```cmd
mysql -u root -p < database\help_app_state.sql
```

### Site não abre em `localhost:3000`

Confira se o terminal exibe:

```text
Help! server listening on 3000
```

Se a porta estiver ocupada, encerre o processo anterior ou utilize o servidor já iniciado.

### Alterações não aparecem em outro dispositivo

Verifique se os dois dispositivos estão acessando o mesmo servidor e se o `/api/health` responde corretamente. O fallback do navegador não substitui o banco compartilhado quando a API está indisponível.

---

## 17. Recomendações para produção

Antes de utilizar o sistema em uma instituição ou empresa:

- Trocar todas as senhas de demonstração.
- Nunca compartilhar o arquivo `.env`.
- Usar HTTPS.
- Criar usuário MySQL específico para a aplicação, sem permissões administrativas.
- Criptografar senhas com bcrypt ou Argon2.
- Implementar sessões com expiração.
- Validar permissões no backend, não apenas no navegador.
- Separar anexos em armazenamento de objetos.
- Fazer backups automáticos.
- Limitar tamanho e tipos de arquivos.
- Configurar firewall e acesso seguro ao MySQL.
- Monitorar logs e erros do servidor.

---

## 18. Checklist rápido de instalação

- [ ] Node.js 20+ instalado.
- [ ] MySQL 8+ instalado e iniciado.
- [ ] Projeto extraído completamente.
- [ ] `npm install` executado sem erros.
- [ ] Script `database/help_app_state.sql` executado.
- [ ] Arquivo `.env` criado na raiz do projeto.
- [ ] `DATABASE_URL` preenchida corretamente.
- [ ] `npm start` executado.
- [ ] Mensagem `Help! server listening on 3000` exibida.
- [ ] `http://localhost:3000` aberto no navegador.
- [ ] Login de administrador testado.
- [ ] Login de professor testado.
- [ ] `/api/health` respondendo com `ok: true`.

---

**Projeto:** Help!

**Finalidade:** gestão de laboratórios, equipamentos, manutenção, mensagens e notificações.

**Tecnologias:** HTML, CSS, JavaScript, Node.js, MySQL e JSON.
