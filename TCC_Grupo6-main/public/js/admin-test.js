(function () {
  'use strict';

  const initialTickets = [
    { id: 'CH-0001', lab: 'Laboratório de Informática · Sala 166', item: 'INF-166-001', status: 'Em Andamento' },
    { id: 'CH-0002', lab: 'Laboratório de Informática · Sala 166', item: 'INF-166-002', status: 'Concluído' },
    { id: 'CH-0003', lab: 'Laboratório de Informática · Sala 221', item: 'INF-221-001', status: 'Em Andamento' },
    { id: 'CH-0004', lab: 'Laboratório de Informática · Sala 094', item: 'INF-094-001', status: 'Concluído' },
    { id: 'CH-0005', lab: 'Laboratório de Informática · Sala 265', item: 'INF-265-001', status: 'Em Andamento' }
  ];
  let tickets = initialTickets.map((ticket) => ({ ...ticket }));
  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function render() {
    const pending = tickets.filter((ticket) => ticket.status !== 'Concluído').length;
    const done = tickets.length - pending;
    $('#totalTickets').textContent = tickets.length;
    $('#openTickets').textContent = pending;
    $('#doneTickets').textContent = done;
    const ratio = tickets.length ? pending / tickets.length * 100 : 0;
    const donut = $('#testStatusChart');
    donut.style.background = `conic-gradient(#edab38 0 ${ratio}%, #36a68b ${ratio}% 100%)`;
    donut.setAttribute('aria-label', `${pending} em andamento e ${done} concluídos`);
    donut.innerHTML = `<span class="donut-center">${tickets.length}<small>chamados</small></span>`;
    $('#testStatusLegend').innerHTML = `<li><span class="legend-dot" style="background:#edab38"></span>Em andamento <strong>${pending}</strong></li><li><span class="legend-dot" style="background:#36a68b"></span>Concluído <strong>${done}</strong></li>`;

    const counts = tickets.reduce((result, ticket) => {
      const current = result.find((entry) => entry.lab === ticket.lab);
      if (current) current.value += 1;
      else result.push({ lab: ticket.lab, value: 1 });
      return result;
    }, []).sort((left, right) => right.value - left.value);
    const max = Math.max(1, ...counts.map((entry) => entry.value));
    $('#testLabChart').innerHTML = counts.map((entry) => `<div class="bar-row"><span class="bar-label" title="${escapeHTML(entry.lab)}">${escapeHTML(entry.lab)}</span><span class="bar-track"><span class="bar-fill" style="width:${entry.value / max * 100}%"></span></span><span class="bar-value">${entry.value}</span></div>`).join('');
    $('#testTicketsTable').innerHTML = tickets.map((ticket) => `<tr><td><span class="ticket-id">${escapeHTML(ticket.id)}</span></td><td>${escapeHTML(ticket.lab)}</td><td><strong>${escapeHTML(ticket.item)}</strong></td><td>${ticket.status === 'Concluído' ? '<span class="status-pill status-done">Concluído</span>' : '<span class="status-pill status-pending">Em andamento</span>'}</td></tr>`).join('');
  }

  $('#addTicket').addEventListener('click', () => {
    const labs = ['Laboratório de Informática · Sala 166', 'Laboratório de Informática · Sala 221', 'Laboratório de Informática · Sala 094', 'Laboratório de Informática · Sala 265'];
    const index = tickets.length % labs.length;
    const number = String(tickets.length + 1).padStart(4, '0');
    tickets.unshift({ id: `CH-${number}`, lab: labs[index], item: `INF-${['166', '221', '094', '265'][index]}-002`, status: tickets.length % 2 ? 'Em Andamento' : 'Concluído' });
    render();
  });
  $('#resetData').addEventListener('click', () => { tickets = initialTickets.map((ticket) => ({ ...ticket })); render(); });
  $('#themeToggle').addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; });
  render();
})();
