(function () {
  'use strict';

  const departments = ['Informática'];
  // Credenciais e perfis chegam exclusivamente da API autenticada.
  const profiles = [];

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
