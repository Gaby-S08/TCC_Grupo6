# Entregas — EquipVirtual

- [x] **Importar e disponibilizar o website EquipVirtual.** Preservar a página inicial e o portal de demonstração, incluindo catálogo de equipamentos, login de professor e administrador, abertura e acompanhamento de chamados, mensagens, painel administrativo, gráficos, relatórios e QR Code.

- [x] **Compartilhar os dados entre dispositivos.** Perfis, catálogo, laboratórios, chamados, mensagens diretas e notificações agora são persistidos em uma API Node com banco MySQL gerenciado; o localStorage permanece apenas como fallback temporário quando a API estiver indisponível.

- [x] **Garantir experiência responsiva.** A página inicial, navegação, cartões de catálogo, formulários, tabelas, painéis, gráficos, mensagens e modais devem permanecer utilizáveis e legíveis em celular, tablet e computador. Nos painéis do professor e do administrador, a navegação móvel usa um menu hambúrguer para substituir as abas horizontais e fechar automaticamente após a seleção. A área de mensagens usa uma composição adaptável com lista compacta de conversas, contato ativo destacado, feed de bolhas e compositor fixado ao rodapé; no celular, o chat agora ocupa um painel vertical único, com lista rolável no topo e conversa em tela cheia abaixo, usando a paleta azul-escura da referência enviada.

- [x] **Permitir que o administrador cadastre professores.** Dentro de “Usuários e laboratórios”, o administrador possui o botão “Novo professor” e pode informar nome completo, e-mail, senha inicial, curso/departamento e laboratório/sala. O novo perfil é validado para evitar e-mails duplicados, recebe a função de professor, fica vinculado ao laboratório selecionado e é salvo no banco compartilhado para aparecer no painel e permitir login posterior em outro dispositivo.

- [x] **Permitir que o administrador cadastre laboratórios e use novos acessos.** O administrador pode abrir “Novo laboratório”, selecionar o departamento e salvar um laboratório no estado compartilhado; depois, esse laboratório aparece na seleção do cadastro de professor. O cadastro do professor mantém no banco compartilhado o nome, e-mail, senha inicial definida pelo administrador, função e vínculo ao laboratório, permitindo autenticação posterior em outro dispositivo.

- [x] **Permitir anexos nas mensagens diretas.** O botão “+” do chat de professor e administrador abre a opção “Adicionar arquivo”; o arquivo é lido como base64, limitado a 4 MB, enviado junto à mensagem, persistido no JSON compartilhado e exibido como um cartão com nome, tamanho e download nos dispositivos sincronizados.

- [x] **Preparar a entrega como website com API.** O projeto serve `index.html` e os recursos enviados pelo servidor Node, expõe `manus-routes.json`, disponibiliza `/api/health`, `/api/login` e `/api/state` e inicia corretamente na porta configurada para visualização e publicação.

- [x] **Validar a interface e o funcionamento.** Conferir a inicialização, o manifesto de rotas e a apresentação nos tamanhos de tela móvel e desktop; corrigir eventuais problemas identificados. Também foram validados o login remoto do administrador, o login remoto do professor, a inicialização do banco, a gravação e leitura de mensagens/notificações pela API, o polling periódico para os dois perfis e a limpeza dos registros temporários de teste.
