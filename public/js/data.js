(function () {
  'use strict';

  const departments = ['Informática'];

  const profiles = [
    { id: 'prof-rafael', name: 'Professor Rafael Conceição', email: 'rafael.conceicao@gmail.com', password: '123456', role: 'user', dept: 'Informática', labId: 'lab-166', room: '166' },
    { id: 'prof-lucas', name: 'Professor Lucas Oliveira', email: 'lucas.oliveira@gmail.com', password: '246810', role: 'user', dept: 'Informática', labId: 'lab-221', room: '221' },
    { id: 'prof-maria', name: 'Professora Maria Julia', email: 'maria.ju@gmail.com', password: '369122', role: 'user', dept: 'Informática', labId: 'lab-094', room: '094' },
    { id: 'prof-luana', name: 'Professora Luana Silva', email: 'luana.silva@gmail.com', password: '481216', role: 'user', dept: 'Informática', labId: 'lab-265', room: '265' },
    { id: 'admin-guilherme', name: 'Administrador Guilherme dos Santos', email: 'guilherme.santos@gmail.com', password: '221340', role: 'admin' }
  ];

  const defaultLabs = [
    { id: 'lab-166', dept: 'Informática', name: 'Laboratório de Informática · Sala 166', room: '166', profileId: 'prof-rafael' },
    { id: 'lab-221', dept: 'Informática', name: 'Laboratório de Informática · Sala 221', room: '221', profileId: 'prof-lucas' },
    { id: 'lab-094', dept: 'Informática', name: 'Laboratório de Informática · Sala 094', room: '094', profileId: 'prof-maria' },
    { id: 'lab-265', dept: 'Informática', name: 'Laboratório de Informática · Sala 265', room: '265', profileId: 'prof-luana' }
  ];

  const defaultAssets = [
    { id: 'a166-001', code: 'INF-166-001', labId: 'lab-166', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a221-001', code: 'INF-221-001', labId: 'lab-221', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a094-001', code: 'INF-094-001', labId: 'lab-094', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a265-001', code: 'INF-265-001', labId: 'lab-265', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 }
  ];

  const defaultTickets = [];

  window.EVData = Object.freeze({ profiles, departments, defaultLabs, defaultAssets, defaultTickets });
})();
