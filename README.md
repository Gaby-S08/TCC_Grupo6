# Help!

Site responsivo de gestão de ativos, laboratórios e manutenção acadêmica/corporativa, reconstruído a partir do projeto original.

## Manual completo

Para instalação, configuração do MySQL, execução no Windows, uso dos perfis, sincronização entre dispositivos e solução de problemas, consulte [`DOCUMENTACAO.md`](DOCUMENTACAO.md).

## Pacote para baixar no computador

O arquivo ZIP desta entrega contém o site completo, o servidor Node.js, o script do banco MySQL e os manuais de instalação. Ele não inclui `node_modules`, `.git` nem senhas reais; depois de extrair, execute `npm install`, configure o arquivo `.env` e rode `npm start`.

Se o MySQL configurado no `.env` não estiver disponível, o servidor usa automaticamente `data/state.json` como armazenamento persistente local. Assim, chamados, mensagens e notificações continuam funcionando no mesmo servidor, sem erro de conexão. Quando o MySQL estiver disponível, ele continua sendo utilizado normalmente.

Para que vários aparelhos compartilhem mensagens e chamados, o servidor precisa permanecer ativo em um computador ou hospedagem acessível pela rede, e todos os aparelhos devem acessar o endereço desse servidor.

## Executar no VS Code

É necessário Node.js 20+. A variável `DATABASE_URL` pode apontar para um banco MySQL compatível; se o banco não estiver disponível, o armazenamento local de contingência será ativado automaticamente.

1. Extraia o ZIP e abra a pasta `Help!` no VS Code.
2. No terminal da pasta, execute `npm install` e configure `DATABASE_URL`.
3. Execute `npm start` e acesse `http://localhost:3000`. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

Não abra `index.html` diretamente: o portal usa `/api/state`, `/api/login` e `/api/health` para compartilhar dados entre dispositivos.

## Colocar o banco no MySQL

O projeto inclui `database/help_app_state.sql`, que cria o banco `help_db`, a tabela JSON `help_app_state` e os dados iniciais de demonstração. Execute o arquivo no MySQL Workbench ou pelo terminal com `mysql -u root -p < database/help_app_state.sql`. Depois, copie `.env.example` para `.env`, preencha `DATABASE_URL` e execute `npm install` e `npm start`. O passo a passo completo está em `database/README.md`.

## O que está incluído

- Autenticação via API dos quatro perfis de professores e do administrador informados, com cadastro remoto de novos professores.
- Catálogo vinculado à sala de cada professor, com códigos sequenciais de itens, como `INF-166-001`; professor pode editar informações e excluir itens do catálogo do seu laboratório.
- Chamados numerados, como `CH-0001`, associados ao item, laboratório, sala e solicitante.
- Histórico de manutenção por laboratório, conversa por chamado, fotos e atualização de status.
- Painel administrativo organizado em abas de Visão geral, Gráficos, Usuários e laboratórios, Catálogo, Chamados, Relatórios e Mensagens. Inclui gráfico de chamados por status, gráfico por laboratório e monitoramento ao vivo do banco compartilhado.
- Tabelas ao vivo de perfis, laboratórios, itens catalogados e chamados de manutenção.
- Atualização automática a cada 3 segundos pela API para professores e administradores em dispositivos diferentes.
- Relatório por laboratório com catálogo, histórico, status e indicadores. O botão `Exportar PDF` abre um relatório pronto para impressão; na janela do navegador, selecione `Salvar como PDF`.
- Geração de QR Code com identificação textual do ativo. O QR não aponta para uma URL pública ou serviço de consulta inexistente.
- Perfil aberto pelo avatar no canto superior direito, com informações de cadastro e envio de solicitações pelo chat.
- Mensagens diretas individuais entre professores e administrador, com histórico persistente no banco compartilhado; administrador pode responder e atualizar nome, e-mail e laboratório do professor.
- Notificações com contador no avatar para novas mensagens, chamados e atualizações de status, removidas ao abrir a área correspondente.
- Identidade visual em tons de azul, com texto de alto contraste, tema claro/escuro, navegação responsiva, suporte a teclado e fallback local temporário.

## Limites importantes

A API Node grava o estado em uma tabela JSON do MySQL gerenciado e o navegador consulta o estado compartilhado periodicamente. O `localStorage` é apenas fallback quando a API não responde. Para produção, troque as senhas demonstrativas por um provedor de autenticação e sessões com expiração.

As fotos anexadas continuam redimensionadas dentro do navegador antes de serem incluídas no estado compartilhado. O arquivo original pode ter até 12 MB; para produção, recomenda-se migrar imagens para armazenamento de objetos.

QRCode.js é fornecido localmente, sem chamada a CDN. As fontes DM Sans e Manrope são solicitadas ao Google Fonts quando há conexão; fontes de sistema são usadas como alternativa se a rede não estiver disponível.

## Estrutura

- `index.html`: página inicial, login e portal administrativo/por professor.
- `admin-test.html`: página independente para testar a interface administrativa e os gráficos com dados simulados.
- `js/admin-test.js`: dados e interações da página de teste.
- `css/styles.css`: identidade visual, componentes, painel ao vivo e breakpoints responsivos.
- `js/data.js`: perfis, salas, catálogo inicial e dados demonstrativos.
- `server.js`: servidor HTTP, API de login/estado/saúde e persistência MySQL ou local compartilhada.
- `server/seed.js`: dados iniciais usados na primeira preparação do banco.
- `js/storage.js`: sincronização com a API e fallback local de perfis, laboratórios, itens, chamados e mensagens.
- `js/app.js`: autenticação, catálogo, chamados, Direct entre professores e administrador, monitoramento ao vivo, relatório visual em PNG.
- `Dockerfile`: imagem de produção para publicar o website e a API.
- `js/vendor/`: biblioteca QR e licença.
- `assets/`: marca, ilustração do hero e fotografias otimizadas das áreas.
- `manus-routes.json`: manifesto `/` usado pelo Preview do projeto Manus; não é necessário para executar localmente.
