(function () {
  'use strict';

  const DATA = window.EVData;
  const STORAGE = window.EVStorage;
  const state = {
    ...STORAGE.load(),
    user: null,
    activeAssetId: null,
    editingAssetId: null,
    activeTicketId: null,
    activeConversationProfileId: null,
    activeModalId: null,
    returnFocus: null,
    tempPhoto: null,
    photoTask: Promise.resolve(),
    photoToken: 0,
    pendingDirectAttachment: null,
    currentUserTab: 'catalog',
    adminTab: 'overview',
    liveTimer: null,
    knownNotificationIds: new Set()
  };
  let adminWriteInFlight = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function findLab(id) { return state.labs.find((lab) => lab.id === id) || null; }
  function labDisplayName(lab) {
    if (!lab?.name) return 'Laboratório não encontrado';
    const name = String(lab.name).trim();
    const suffix = name.match(/\s*[·-]\s*Sala\s+(.+)$/i);
    return suffix && String(lab.room || '').trim() && suffix[1].trim() === String(lab.room).trim() ? name.slice(0, suffix.index).trim() : name;
  }
  function findAsset(id) { return state.assets.find((asset) => asset.id === id) || null; }
  function findTicket(id) { return state.tickets.find((ticket) => ticket.id === id) || null; }

  function applyRemoteState(remote) {
    state.profiles = remote.profiles;
    state.labs = remote.labs;
    state.assets = remote.assets;
    state.tickets = remote.tickets;
    state.directMessages = remote.directMessages || [];
    state.notifications = remote.notifications || [];
  }

  function persist(next, options = {}) {
    const payload = {
      ...next,
      profiles: next.profiles || state.profiles,
      labs: next.labs || state.labs,
      assets: next.assets || state.assets,
      tickets: next.tickets || state.tickets,
      directMessages: next.directMessages || state.directMessages || [],
      notifications: next.notifications || state.notifications || []
    };
    if (!STORAGE.saveCollections(payload, options)) {
      showToast('Não foi possível salvar. O armazenamento local pode estar cheio; reduza o tamanho das imagens ou remova dados antigos.', 'error');
      return false;
    }
    state.profiles = payload.profiles.map((profile) => ({ ...profile, password: '__remote__' }));
    state.labs = payload.labs;
    state.assets = payload.assets;
    state.tickets = payload.tickets;
    state.directMessages = payload.directMessages;
    state.notifications = payload.notifications || state.notifications || [];
    return true;
  }

  async function persistAdminChange(next) {
    if (adminWriteInFlight) {
      showToast('Aguarde a confirmação da gravação anterior no banco.', 'warning');
      return false;
    }
    adminWriteInFlight = true;
    const previous = {
      profiles: state.profiles,
      labs: state.labs,
      assets: state.assets,
      tickets: state.tickets,
      directMessages: state.directMessages,
      notifications: state.notifications
    };
    try {
      if (!persist(next, { notifyRemoteFailure: false })) return false;
      if (await STORAGE.flushRemote()) return true;
      const fresh = await STORAGE.loadRemote();
      applyRemoteState(fresh || previous);
      STORAGE.syncLocalCache(fresh || previous);
      renderPortal();
      showToast('Não foi possível confirmar a gravação no banco. Confira os dados antes de tentar novamente.', 'error');
      return false;
    } catch (_error) {
      const fresh = await STORAGE.loadRemote();
      applyRemoteState(fresh || previous);
      STORAGE.syncLocalCache(fresh || previous);
      renderPortal();
      showToast('O banco não confirmou a alteração. Confira a conexão e os dados antes de tentar novamente.', 'error');
      return false;
    } finally {
      adminWriteInFlight = false;
    }
  }

  function refreshNotificationBadge() {
    const badge = $('#notificationCountBadge');
    const center = $('#notificationCenter');
    if (!badge || !center || !state.user) return;
    const unread = (state.notifications || []).filter((item) => item.recipientId === state.user.id && !item.read);
    center.hidden = false;
    badge.hidden = unread.length === 0;
    badge.textContent = unread.length > 9 ? '9+' : String(unread.length);
    const label = unread.length ? `Abrir notificações. ${unread.length} não lida${unread.length === 1 ? '' : 's'}.` : 'Abrir notificações';
    $('.notification-button').setAttribute('aria-label', label);
    $('.notification-button').title = label;
    renderNotificationList();
  }
  function notificationIcon(type) {
    if (type === 'new-ticket') return '⚠';
    if (type === 'ticket-update') return '✓';
    if (type === 'ticket-message') return '✉';
    return '●';
  }
  function renderNotificationList() {
    const list = $('#notificationList');
    if (!list || !state.user) return;
    const items = (state.notifications || []).filter((item) => item.recipientId === state.user.id).slice().reverse().slice(0, 20);
    list.innerHTML = items.length ? items.map((item) => `<button class="notification-item${item.read ? '' : ' is-unread'}" type="button" data-action="open-notification" data-notification-id="${escapeHTML(item.id)}"><span class="notification-item-icon" aria-hidden="true">${notificationIcon(item.type)}</span><span><strong>${escapeHTML(item.text || 'Nova atualização')}</strong><small>${escapeHTML(item.time || '')}</small></span>${item.read ? '' : '<i aria-label="Não lida"></i>'}</button>`).join('') : '<p class="notification-empty">Nenhuma notificação por enquanto.</p>';
  }
  function toggleNotifications(button) {
    const panel = $('#notificationPanel');
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) renderNotificationList();
  }
  function markAllNotificationsRead() {
    if (!state.user) return;
    const notifications = (state.notifications || []).map((item) => item.recipientId === state.user.id ? { ...item, read: true } : item);
    if (JSON.stringify(notifications) !== JSON.stringify(state.notifications)) persist({ profiles: state.profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages, notifications });
    refreshNotificationBadge();
  }
  function openNotification(notificationId) {
    if (!state.user) return;
    const notifications = (state.notifications || []).map((item) => item.id === notificationId && item.recipientId === state.user.id ? { ...item, read: true } : item);
    persist({ profiles: state.profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages, notifications });
    refreshNotificationBadge();
    const item = notifications.find((entry) => entry.id === notificationId);
    if (item?.type === 'teacher-message' || item?.type === 'direct-message') openDirectMessages();
    else if (item?.type === 'new-ticket' || item?.type === 'ticket-message' || item?.type === 'ticket-update') {
      if (state.user.role === 'admin') switchAdminTab('tickets'); else switchUserTab('history');
    }
  }
  function addNotification(recipientId, type, referenceId, text) {
    if (!recipientId) return;
    const id = `${type}:${referenceId}:${recipientId}`;
    if ((state.notifications || []).some((item) => item.id === id)) return;
    const notifications = [...(state.notifications || []), { id, recipientId, type, referenceId: String(referenceId), text, time: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()), read: false }];
    persist({ profiles: state.profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages, notifications });
    refreshNotificationBadge();
  }
  function markNotificationsRead(types) {
    if (!state.user) return;
    const allowed = new Set(types);
    let changed = false;
    const notifications = (state.notifications || []).map((item) => {
      if (item.recipientId === state.user.id && !item.read && allowed.has(item.type)) { changed = true; return { ...item, read: true }; }
      return item;
    });
    if (changed) persist({ profiles: state.profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages, notifications });
    refreshNotificationBadge();
  }
  function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' is-error' : type === 'warning' ? ' is-warning' : ''}`;
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${notificationIcon(type === 'warning' ? 'new-ticket' : type)}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(5px)';
      window.setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  function applyTheme(theme, save = true) {
    const selected = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selected;
    if (save) STORAGE.saveTheme(selected);
    $$('.theme-toggle').forEach((button) => {
      button.setAttribute('aria-label', selected === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
      button.title = selected === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
    });
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function fillOptions(select, items, selected = '') {
    if (!select) return;
    select.replaceChildren();
    items.forEach((item) => {
      const option = document.createElement('option');
      if (typeof item === 'string') {
        option.value = item;
        option.textContent = item;
      } else {
        option.value = item.value;
        option.textContent = item.label;
        if (item.disabled) option.disabled = true;
      }
      if (option.value === selected) option.selected = true;
      select.appendChild(option);
    });
  }

  function syncUserLabsSelect() {
    // O laboratório é definido pelo perfil autenticado e não pode ser alterado no login.
  }

  function populateSelects() {
    fillOptions($('#newLabDept'), DATA.departments, DATA.departments[0]);
    fillOptions($('#newProfessorDept'), DATA.departments, DATA.departments[0]);
    syncNewProfessorLabs();
    fillOptions($('#adminCourseFilter'), [{ value: 'Todos', label: 'Todos os departamentos' }, ...DATA.departments.map((dept) => ({ value: dept, label: dept }))], 'Todos');
  }

  function syncNewProfessorLabs() {
    const dept = $('#newProfessorDept')?.value || DATA.departments[0];
    const labs = state.labs.filter((lab) => lab.dept === dept).map((lab) => ({ value: lab.id, label: `${labDisplayName(lab)}${lab.room ? ` · Sala ${lab.room}` : ''}` }));
    fillOptions($('#newProfessorLab'), labs.length ? labs : [{ value: '', label: 'Nenhum laboratório neste departamento', disabled: true }]);
  }

  function setMobileMenu(open) {
    const menu = $('#siteNav');
    const toggle = $('.menu-toggle');
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  function scrollPageToTop() {
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function enterPortal() {
    $('#marketingSite').hidden = true;
    $('#portalApp').hidden = false;
    document.body.classList.add('portal-mode');
    setMobileMenu(false);
    scrollPageToTop();
    if (!state.user) $('#loginUserEmail').focus({ preventScroll: true });
  }

  function goHome() {
    $('#portalApp').hidden = true;
    $('#marketingSite').hidden = false;
    document.body.classList.remove('portal-mode');
    setMobileMenu(false);
    scrollPageToTop();
  }

  function switchLoginTab(role) {
    const userSelected = role === 'user';
    $('#userLoginForm').hidden = !userSelected;
    $('#adminLoginForm').hidden = userSelected;
    $('#tabUserBtn').classList.toggle('is-active', userSelected);
    $('#tabAdminBtn').classList.toggle('is-active', !userSelected);
    $('#tabUserBtn').setAttribute('aria-selected', String(userSelected));
    $('#tabAdminBtn').setAttribute('aria-selected', String(!userSelected));
    $('#tabUserBtn').tabIndex = userSelected ? 0 : -1;
    $('#tabAdminBtn').tabIndex = userSelected ? -1 : 0;
    (userSelected ? $('#loginUserEmail') : $('#loginAdminEmail')).focus({ preventScroll: true });
  }

  function renderPortal() {
    const login = $('#loginSection');
    const userDashboard = $('#userDashboardSection');
    const adminDashboard = $('#adminDashboardSection');
    const badge = $('#userHeaderBadge');
    if (!state.user) {
      login.hidden = false;
      userDashboard.hidden = true;
      adminDashboard.hidden = true;
      badge.hidden = true;
      $('#notificationCenter').hidden = true;
      syncUserLabsSelect();
      return;
    }

    login.hidden = true;
    badge.hidden = false;
    $('#userNameDisplay').textContent = state.user.name;
    $('#userAvatarInitial').textContent = state.user.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'E';
    refreshNotificationBadge();
    $('#userRoleDisplay').textContent = state.user.role === 'admin' ? 'Administrador · acesso global' : `Sala: ${state.user.room || (state.user.labId && findLab(state.user.labId)?.room) || '—'}`;

    if (state.user.role === 'user') {
      userDashboard.hidden = false;
      adminDashboard.hidden = true;
      $('#userDeptTitle').textContent = 'Laboratório de informática';
      renderUserDashboard();
    } else {
      userDashboard.hidden = true;
      adminDashboard.hidden = false;
      renderAdminDashboard();
      switchAdminTab(state.adminTab);
    }
  }

  async function authenticateProfile(emailInput, passwordInput, role) {
    if (!emailInput.value.trim() || !emailInput.validity.valid || !passwordInput.value) {
      emailInput.reportValidity();
      if (!emailInput.value.trim() || !emailInput.validity.valid) emailInput.focus();
      else passwordInput.focus();
      return null;
    }
    const email = emailInput.value.trim().toLocaleLowerCase('pt-BR');
    const profile = await STORAGE.authenticate(email, passwordInput.value, role);
    if (!profile) {
      showToast('E-mail, senha ou tipo de perfil inválido.', 'error');
      passwordInput.focus();
      return null;
    }
    const remote = await STORAGE.loadRemote();
    if (!remote) {
      await STORAGE.logout();
      showToast('Não foi possível carregar os dados compartilhados. Tente novamente.', 'error');
      return null;
    }
    applyRemoteState(remote);
    state.knownNotificationIds = new Set(state.notifications.map((item) => item.id));
    return profile;
  }

  function requireTrimmedText(input, message) {
    const value = input.value.trim();
    if (value) {
      input.removeAttribute('aria-invalid');
      input.setCustomValidity('');
      return value;
    }
    input.setAttribute('aria-invalid', 'true');
    input.setCustomValidity(message);
    input.reportValidity();
    input.focus();
    input.setCustomValidity('');
    showToast(message, 'warning');
    return null;
  }

  async function loginAsUser() {
    const profile = await authenticateProfile($('#loginUserEmail'), $('#loginUserPassword'), 'user');
    if (!profile) return;
    state.user = { ...profile };
    state.currentUserTab = 'catalog';
    renderPortal();
    startLiveRefresh();
    showToast(`Perfil de ${profile.name} autenticado.`, 'info');
  }

  async function loginAsAdmin() {
    const profile = await authenticateProfile($('#loginAdminEmail'), $('#loginAdminPassword'), 'admin');
    if (!profile) return;
    state.user = { ...profile };
    renderPortal();
    startLiveRefresh();
    showToast(`Painel de ${profile.name} autenticado.`, 'info');
  }

  async function logout() {
    stopLiveRefresh();
    await STORAGE.logout();
    state.user = null;
    renderPortal();
    showToast('Você saiu da sua conta.', 'info');
  }

  function profileMarkup(profile) {
    const isAdmin = profile.role === 'admin';
    const lab = profile.labId ? findLab(profile.labId) : null;
    const details = [['Nome completo', profile.name], ['E-mail de cadastro', profile.email], ['Tipo de perfil', isAdmin ? 'Administrador' : 'Professor'], ['Departamento / curso', profile.dept || (isAdmin ? 'Acesso global' : '—')], ['Laboratório', lab ? labDisplayName(lab) : (isAdmin ? 'Acesso global' : 'Não vinculado')], ['Sala', profile.room || (lab && lab.room) || (isAdmin ? '—' : 'Não informada')]];
    return `<div class="profile-card"><div class="profile-card-heading"><span class="profile-avatar" aria-hidden="true">${escapeHTML((profile.name || '?').trim().charAt(0).toLocaleUpperCase('pt-BR'))}</span><div><p class="eyebrow">DADOS DE CADASTRO</p><h3>${escapeHTML(profile.name)}</h3><p>${escapeHTML(isAdmin ? 'Administrador' : 'Professor')}</p></div></div><dl class="profile-details">${details.map(([label, value]) => `<div class="profile-detail"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl></div>`;
  }
  function closeDashboardNavMenus() {
    [['userDashboardNavMenu', 'userDashboardNavToggle'], ['adminDashboardNavMenu', 'adminDashboardNavToggle']].forEach(([menuId, toggleId]) => {
      const menu = $(`#${menuId}`); const toggle = $(`#${toggleId}`);
      if (menu) menu.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }
  function toggleDashboardNav(kind) {
    const menu = $(`#${kind}DashboardNavMenu`); const toggle = $(`#${kind}DashboardNavToggle`);
    if (!menu || !toggle) return;
    const shouldOpen = menu.hidden;
    closeDashboardNavMenus();
    menu.hidden = !shouldOpen;
    toggle.setAttribute('aria-expanded', String(shouldOpen));
  }
  function syncDashboardNav(kind, activeKey, label) {
    const labelNode = $(`#${kind}DashboardNavLabel`); if (labelNode) labelNode.textContent = label;
    $$(`#${kind}DashboardNavMenu .dashboard-mobile-nav-item`).forEach((item) => item.classList.toggle('is-active', item.dataset.tab === activeKey));
    closeDashboardNavMenus();
  }
  function switchUserTab(tab) {
    const valid = ['catalog', 'history', 'messages'];
    state.currentUserTab = valid.includes(tab) ? tab : 'catalog';
    const buttons = { catalog: $('#tabUserCatalogBtn'), history: $('#tabUserHistoryBtn'), messages: $('#tabUserMessagesBtn') };
    const panels = { catalog: $('#userCatalogSubtab'), history: $('#userHistorySubtab'), messages: $('#userMessagesSubtab') };
    Object.entries(buttons).forEach(([key, button]) => {
      const active = key === state.currentUserTab;
      button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; panels[key].hidden = !active;
    });
    syncDashboardNav('user', state.currentUserTab, buttons[state.currentUserTab]?.textContent || 'Catálogo de ativos');
    if (state.currentUserTab === 'messages') { markNotificationsRead(['direct-message', 'ticket-message']); renderDirectMessages(); }
    else if (state.currentUserTab === 'history') markNotificationsRead(['ticket-update', 'ticket-message']);
  }
  function switchAdminTab(tab) {
    const validTabs = ['overview', 'charts', 'users', 'catalog', 'tickets', 'reports', 'messages'];
    state.adminTab = validTabs.includes(tab) ? tab : 'overview';
    $$('.admin-tab').forEach((button) => { const active = button.dataset.tab === state.adminTab; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
    $$('.admin-tab-panel').forEach((panel) => { const active = panel.dataset.adminPanel === state.adminTab; panel.hidden = !active; panel.classList.toggle('is-active', active); });
    const activeAdminButton = $(`.admin-tab[data-tab="${state.adminTab}"]`);
    syncDashboardNav('admin', state.adminTab, activeAdminButton?.textContent || 'Visão geral');
    if (state.adminTab === 'messages') { markNotificationsRead(['teacher-message']); renderDirectMessages(); }
    else if (state.adminTab === 'tickets') markNotificationsRead(['new-ticket']);
  }
  function openProfile() {
    if (!state.user) return;
    $('#profileModalDetails').innerHTML = profileMarkup(state.user);
    $('#profileRequestText').value = '';
    openModal('profileModal');
  }
  function directInput() { return state.user?.role === 'admin' ? $('#adminDirectMessageInput') : $('#userDirectMessageInput'); }
  function directFileInput() { return state.user?.role === 'admin' ? $('#adminDirectFileInput') : $('#userDirectFileInput'); }
  function updateDirectAttachmentStatus() {
    const status = state.user?.role === 'admin' ? $('#adminDirectAttachmentStatus') : $('#userDirectAttachmentStatus');
    if (!status) return;
    const attachment = state.pendingDirectAttachment;
    status.hidden = !attachment;
    status.textContent = attachment ? `📎 ${attachment.name}` : '';
    status.title = attachment ? `${attachment.name} · clique no + para substituir` : '';
  }
  function toggleDirectAttachMenu(button) {
    const menu = button.closest('.direct-attach-wrap')?.querySelector('.direct-attach-menu');
    if (!menu) return;
    const open = menu.hidden;
    document.querySelectorAll('.direct-attach-menu').forEach((item) => { item.hidden = true; });
    document.querySelectorAll('.direct-compose-add').forEach((item) => item.setAttribute('aria-expanded', 'false'));
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }
  function openDirectFilePicker(button) {
    button.closest('.direct-attach-wrap')?.querySelector('[data-direct-file-input]')?.click();
    button.closest('.direct-attach-menu').hidden = true;
  }
  function handleDirectFileChange(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { input.value = ''; showToast('O arquivo deve ter no máximo 4 MB.', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      state.pendingDirectAttachment = { name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result) };
      updateDirectAttachmentStatus();
      showToast(`Arquivo “${file.name}” pronto para envio.`, 'info');
    };
    reader.onerror = () => showToast('Não foi possível ler este arquivo.', 'error');
    reader.readAsDataURL(file);
  }
  function directAttachmentMarkup(attachment) {
    if (!attachment || !attachment.data || !attachment.name) return '';
    return `<a class="direct-attachment" href="${escapeHTML(attachment.data)}" download="${escapeHTML(attachment.name)}"><span aria-hidden="true">📎</span><span><strong>${escapeHTML(attachment.name)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB · baixar arquivo</small></span></a>`;
  }
  function renderDirectMessages() {
    if (!state.user) return;
    const teachers = state.profiles.filter((profile) => profile.role === 'user');
    if (state.user.role === 'user') state.activeConversationProfileId = state.user.id;
    if (state.user.role === 'admin' && !teachers.some((profile) => profile.id === state.activeConversationProfileId)) state.activeConversationProfileId = teachers[0]?.id || null;
    const prefix = state.user.role === 'admin' ? 'admin' : 'user';
    const list = $(`#${prefix}DirectConversationList`);
    const header = $(`#${prefix}DirectThreadHeader`);
    const feed = $(`#${prefix}DirectMessageFeed`);
    if (!list || !header || !feed) return;
    const searchInput = $(`#${prefix}DirectSearchInput`);
    const searchTerm = String(searchInput?.value || '').trim().toLocaleLowerCase('pt-BR');
    if (state.user.role === 'admin') {
      const visibleTeachers = teachers.filter((profile) => !searchTerm || `${profile.name} ${profile.email}`.toLocaleLowerCase('pt-BR').includes(searchTerm));
      list.innerHTML = visibleTeachers.map((profile) => {
        const messages = (state.directMessages || []).filter((message) => message.profileId === profile.id);
        const last = messages[messages.length - 1];
        const active = profile.id === state.activeConversationProfileId;
        return `<button class="direct-conversation${active ? ' is-active' : ''}" type="button" data-action="select-direct-conversation" data-profile-id="${escapeHTML(profile.id)}"><span class="direct-conversation-avatar">${escapeHTML(profile.name.charAt(0).toLocaleUpperCase('pt-BR'))}</span><span class="direct-conversation-copy"><strong>${escapeHTML(profile.name)}</strong><small>${escapeHTML(last ? last.text : (profile.email || 'Inicie uma conversa'))}</small></span></button>`;
      }).join('') || '<p class="direct-empty-list">Nenhuma conversa encontrada.</p>';
    } else {
      const admin = state.profiles.find((profile) => profile.role === 'admin');
      list.innerHTML = `<div class="direct-conversation is-active"><span class="direct-conversation-avatar">${escapeHTML((admin?.name || 'A').charAt(0).toLocaleUpperCase('pt-BR'))}</span><span class="direct-conversation-copy"><strong>${escapeHTML(admin?.name || 'Administrador')}</strong><small>${escapeHTML(admin?.email || 'Conversa com a administração')}</small></span></div>`;
    }
    const selected = teachers.find((profile) => profile.id === state.activeConversationProfileId);
    if (!selected) { header.innerHTML = '<strong>Mensagens</strong><span>Selecione um professor para iniciar uma conversa.</span>'; feed.innerHTML = '<p class="direct-empty">Nenhuma conversa selecionada.</p>'; return; }
    const admin = state.user.role === 'admin';
    const adminProfile = state.profiles.find((profile) => profile.role === 'admin');
    header.innerHTML = `<span class="direct-conversation-avatar">${escapeHTML((admin ? selected.name : (adminProfile?.name || 'A')).charAt(0).toLocaleUpperCase('pt-BR'))}</span><span><strong>${escapeHTML(admin ? selected.name : (adminProfile?.name || 'Administrador'))}</strong><small>${escapeHTML(admin ? (selected.email || 'Professor') : 'Administração')}</small></span>`;
    const messages = (state.directMessages || []).filter((message) => message.profileId === selected.id);
    feed.innerHTML = messages.length ? messages.map((message) => {
      const own = message.senderId === state.user.id;
      return `<article class="direct-message${own ? ' is-own' : ''}"><p class="direct-message-meta">${escapeHTML(message.senderName)} · ${escapeHTML(message.time)}</p><div class="direct-message-bubble">${message.text ? `<p>${escapeHTML(message.text)}</p>` : ''}${directAttachmentMarkup(message.attachment)}</div></article>`;
    }).join('') : '<p class="direct-empty">Esta conversa está vazia. Envie uma mensagem para começar.</p>';
    feed.scrollTop = feed.scrollHeight;
    const editButton = document.querySelector('.direct-admin-actions');
    if (editButton) editButton.hidden = !admin || !selected;
  }
  async function sendDirectMessage(textOverride = '') {
    const input = directInput();
    const text = String(textOverride || input.value).trim();
    const attachment = state.pendingDirectAttachment;
    if (!state.user || (!text && !attachment) || text.length > 1200) { if (!text && !attachment) input.focus(); return false; }
    const profileId = state.user.role === 'user' ? state.user.id : state.activeConversationProfileId;
    if (!profileId || !state.profiles.some((profile) => profile.id === profileId && profile.role === 'user')) { showToast('Selecione a conversa de um professor.', 'warning'); return false; }
    const message = { id: `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, profileId, senderId: state.user.id, senderName: state.user.name, text, time: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()), ...(attachment ? { attachment } : {}) };
    const directMessages = [...(state.directMessages || []), message];
    const recipient = state.user.role === 'admin' ? state.profiles.find((profile) => profile.id === profileId) : state.profiles.find((profile) => profile.role === 'admin');
    const notificationType = state.user.role === 'admin' ? 'direct-message' : 'teacher-message';
    const notificationId = `${notificationType}:${message.id}:${recipient?.id || ''}`;
    const notifications = recipient && !(state.notifications || []).some((item) => item.id === notificationId)
      ? [...(state.notifications || []), { id: notificationId, recipientId: recipient.id, type: notificationType, referenceId: message.id, text: `${state.user.name} enviou uma mensagem.`, time: message.time, read: false }]
      : state.notifications;
    if (!persist({ profiles: state.profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages, notifications }, { notifyRemoteFailure: false })) return false;
    refreshNotificationBadge();
    if (!await STORAGE.flushRemote()) {
      const fresh = await STORAGE.loadRemote();
      if (fresh) applyRemoteState(fresh);
      if (fresh?.directMessages.some((item) => item.id === message.id)) {
        input.value = ''; state.pendingDirectAttachment = null; const fileInput = directFileInput(); if (fileInput) fileInput.value = ''; updateDirectAttachmentStatus(); renderDirectMessages();
        showToast('Mensagem enviada e sincronizada com a administração.', 'info');
        return true;
      }
      showToast('Não foi possível confirmar o envio. Verifique a conexão antes de tentar novamente.', 'error');
      return false;
    }
    input.value = ''; state.pendingDirectAttachment = null; const fileInput = directFileInput(); if (fileInput) fileInput.value = ''; updateDirectAttachmentStatus(); renderDirectMessages(); return true;
  }
  function openDirectMessages() {
    if (!state.user) return;
    closeModal('profileModal');
    if (state.user.role === 'admin') switchAdminTab('messages'); else switchUserTab('messages');
    const input = directInput(); if (input) input.focus({ preventScroll: true });
  }
  function openDirectProfileEditor() {
    if (!state.user || state.user.role !== 'admin') return;
    const profile = state.profiles.find((entry) => entry.id === state.activeConversationProfileId);
    if (!profile) return;
    $('#directEditName').value = profile.name; $('#directEditEmail').value = profile.email;
    fillOptions($('#directEditLab'), state.labs.filter((lab) => !profile.dept || lab.dept === profile.dept).map((lab) => ({ value: lab.id, label: `${labDisplayName(lab)}${lab.room ? ` · Sala ${lab.room}` : ''}` })));
    $('#directEditLab').value = profile.labId || '';
    openModal('editDirectProfileModal');
  }
  function saveDirectProfileEdit() {
    if (!state.user || state.user.role !== 'admin') return;
    const target = state.profiles.find((profile) => profile.id === state.activeConversationProfileId);
    if (!target) return;
    const name = requireTrimmedText($('#directEditName'), 'Informe o nome do professor.'); if (name === null) return;
    const email = requireTrimmedText($('#directEditEmail'), 'Informe o e-mail do professor.'); if (email === null) return;
    if (!$('#directEditEmail').validity.valid) { $('#directEditEmail').reportValidity(); return; }
    if (state.profiles.some((profile) => profile.id !== target.id && profile.email.toLocaleLowerCase('pt-BR') === email.toLocaleLowerCase('pt-BR'))) { showToast('Este e-mail já está vinculado a outro perfil.', 'warning'); return; }
    const lab = findLab($('#directEditLab').value); if (!lab) { showToast('Selecione um laboratório válido.', 'warning'); return; }
    const updated = { ...target, name, email, labId: lab.id, dept: lab.dept, room: lab.room || target.room };
    const profiles = state.profiles.map((profile) => profile.id === target.id ? updated : profile);
    if (!persist({ profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages })) return;
    closeModal('editDirectProfileModal'); renderPortal(); showToast('Cadastro do professor atualizado.', 'info');
  }
  function renderUserDashboard() {
    if (!state.user || state.user.role !== 'user') return;
    const labs = state.user.labId ? state.labs.filter((lab) => lab.id === state.user.labId) : state.labs.filter((lab) => lab.dept === state.user.dept);
    const selectedLab = $('#userLabFilterSelect').value;
    const linkedLab = state.user.labId ? findLab(state.user.labId) : null;
    const profileRoom = state.user.room || linkedLab?.room || 'Não informada';
    const options = labs.length > 1
      ? [{ value: 'all', label: 'Todas as salas' }, ...labs.map((lab) => ({ value: lab.id, label: `Sala ${lab.room || profileRoom}` }))]
      : labs.length === 1
        ? [{ value: labs[0].id, label: `Sala ${labs[0].room || profileRoom}` }]
        : [{ value: state.user.labId || 'profile-room', label: `Sala ${profileRoom}` }];
    const selected = labs.some((lab) => lab.id === selectedLab) ? selectedLab : (state.user.labId || labs[0]?.id || 'profile-room');
    fillOptions($('#userLabFilterSelect'), options, selected);

    const labIds = new Set(labs.map((lab) => lab.id));
    const query = $('#userAssetSearchInput').value.trim().toLocaleLowerCase('pt-BR');
    const assets = state.assets.filter((asset) => {
      const belongs = labIds.has(asset.labId) && (selected === 'all' || asset.labId === selected);
      const text = `${asset.name} ${asset.desc}`.toLocaleLowerCase('pt-BR');
      return belongs && text.includes(query);
    });
    $('#statUserAssets').textContent = String(assets.length);
    renderAssetCards(assets);

    const tickets = state.tickets.filter((ticket) => ticket.requester === state.user.name || ticket.labId === state.user.labId);
    $('#statUserTickets').textContent = String(tickets.length);
    renderUserTicketHistory(tickets);
    switchUserTab(state.currentUserTab);
  }

  function renderAssetCards(assets) {
    const container = $('#userCatalogSubtab');
    if (!assets.length) {
      container.innerHTML = '<div class="empty-state">Nenhum equipamento corresponde ao laboratório e à pesquisa selecionados.</div>';
      return;
    }
    container.innerHTML = assets.map((asset) => {
      const lab = findLab(asset.labId);
      return `<article class="asset-card"><div><div class="asset-card-top"><h3>${escapeHTML(asset.name)}</h3><span class="asset-quantity">Qtd. ${escapeHTML(asset.qty)}</span></div><p>${escapeHTML(asset.desc)}</p><small class="asset-location">${escapeHTML(lab ? lab.name : 'Laboratório não encontrado')}</small></div><div class="asset-actions"><button class="icon-action" type="button" data-action="open-qr" data-id="${escapeHTML(asset.id)}" aria-label="Gerar QR Code para ${escapeHTML(asset.name)}" title="Gerar QR Code">⌗</button><button class="button button-outline" type="button" data-action="open-ticket" data-id="${escapeHTML(asset.id)}">Abrir chamado</button></div><div class="asset-manage-actions"><button class="button button-outline" type="button" data-action="edit-asset" data-id="${escapeHTML(asset.id)}">Editar informações</button><button class="button button-danger-outline" type="button" data-action="delete-asset" data-id="${escapeHTML(asset.id)}">Excluir item</button></div></article>`;
    }).join('');
  }

  function statusMarkup(status) {
    const done = status === 'Concluído';
    return `<span class="status-pill ${done ? 'status-done' : 'status-pending'}">${done ? 'Concluído' : 'Em andamento'}</span>`;
  }

  function photoMarkup(ticket) {
    return ticket.photo
      ? `<img class="ticket-photo" src="${escapeHTML(ticket.photo)}" alt="Foto anexada ao chamado ${escapeHTML(ticket.id)}" loading="lazy">`
      : '<span class="no-photo">Sem foto</span>';
  }

  function renderUserTicketHistory(tickets) {
    const body = $('#userTicketHistoryTable');
    if (!tickets.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-table-cell">Nenhum chamado registrado neste perfil.</td></tr>';
      return;
    }
    body.innerHTML = tickets.map((ticket) => `<tr><td><span class="ticket-id">${escapeHTML(ticket.id)}</span></td><td>${photoMarkup(ticket)}</td><td><strong>${escapeHTML(ticket.assetName)}</strong><br><span class="no-photo">${escapeHTML(ticket.assetCode || '')} · ${escapeHTML(ticket.serial)}</span></td><td>${escapeHTML(ticket.type)}</td><td><span class="ticket-description" title="${escapeHTML(ticket.desc)}">${escapeHTML(ticket.desc)}</span></td><td>${statusMarkup(ticket.status)}</td><td><button class="button button-outline table-action" type="button" data-action="open-chat" data-id="${escapeHTML(ticket.id)}">Ver conversa</button></td></tr>`).join('');
  }

  function renderAdminDashboard() {
    const filter = $('#adminCourseFilter').value || 'Todos';
    const filtered = state.tickets.filter((ticket) => filter === 'Todos' || ticket.dept === filter);
    $('#statAdminTotalTickets').textContent = String(state.tickets.length);
    $('#statAdminInMaintenance').textContent = String(state.tickets.filter((ticket) => ticket.status !== 'Concluído').length);
    $('#statAdminActiveLabs').textContent = String(state.labs.length);
    const body = $('#adminTicketsTable');
    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="9" class="empty-table-cell">Nenhum chamado corresponde ao filtro selecionado.</td></tr>';
    } else {
      body.innerHTML = filtered.map((ticket) => `<tr><td><span class="ticket-id">${escapeHTML(ticket.id)}</span></td><td>${photoMarkup(ticket)}</td><td>${escapeHTML(ticket.dept)}</td><td>${escapeHTML(ticket.labName)}</td><td><strong>${escapeHTML(ticket.assetName)}</strong><br><span class="no-photo">${escapeHTML(ticket.assetCode || '')} · ${escapeHTML(ticket.serial)}</span></td><td>${escapeHTML(ticket.requester)}</td><td>${escapeHTML(ticket.type)}</td><td>${statusMarkup(ticket.status)}</td><td><button class="button button-primary table-action" type="button" data-action="open-chat" data-id="${escapeHTML(ticket.id)}">Atender</button></td></tr>`).join('');
    }
    renderAdminCharts();
    renderLiveDatabase();
    startLiveRefresh();
  }

  function liveCell(value) { return escapeHTML(value == null ? '—' : value); }

  function renderDepartmentOccupancyChart() {
    const chart = $('#departmentOccupancyChart');
    if (!chart) return;
    const departments = [...new Set([...state.labs.map((lab) => lab.dept), ...state.profiles.filter((p) => p.role === 'user').map((p) => p.dept)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!departments.length) { chart.innerHTML = '<p class="empty-state">Não há salas ou laboratórios cadastrados para exibir.</p>'; return; }
    chart.innerHTML = departments.map((dept) => {
      const labs = state.labs.filter((lab) => lab.dept === dept);
      const occupiedCount = labs.filter((lab) => state.profiles.some((profile) => profile.role === 'user' && profile.labId === lab.id)).length;
      const total = labs.length;
      const percent = total ? Math.round(occupiedCount / total * 100) : 0;
      const teacherCount = state.profiles.filter((profile) => profile.role === 'user' && (findLab(profile.labId)?.dept || profile.dept) === dept).length;
      return `<article class="occupancy-item"><div class="occupancy-heading"><strong>${escapeHTML(dept)}</strong><span>${occupiedCount} de ${total} salas/laboratórios ocupados · ${teacherCount} ${teacherCount === 1 ? 'professor' : 'professores'}</span></div><div class="occupancy-track" role="meter" aria-label="${escapeHTML(dept)}: ${occupiedCount} de ${total} ocupados" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${occupiedCount}"><span class="occupancy-fill" style="width:${percent}%"></span></div></article>`;
    }).join('');
  }
  function renderLiveDatabase() {
    if (!state.user || state.user.role !== 'admin') return;
    renderDepartmentOccupancyChart();
    const reportSelect = $('#reportLabSelect');
    const currentLab = reportSelect ? reportSelect.value : '';
    const labOptions = state.labs.map((lab) => ({ value: lab.id, label: `${labDisplayName(lab)}${lab.room ? ` · Sala ${lab.room}` : ''}` }));
    fillOptions(reportSelect, labOptions.length ? labOptions : [{ value: '', label: 'Nenhum laboratório cadastrado', disabled: true }], currentLab);
    const deptFilter = $('#teacherRoomDeptFilter');
    const labFilter = $('#teacherRoomLabFilter');
    const selectedDept = deptFilter?.value || 'Todos';
    const selectedLab = labFilter?.value || 'Todos';
    const departments = [...new Set([...state.labs.map((lab) => lab.dept), ...state.profiles.filter((p) => p.role === 'user').map((p) => p.dept)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    fillOptions(deptFilter, [{ value: 'Todos', label: 'Todos os departamentos' }, ...departments.map((dept) => ({ value: dept, label: dept }))], departments.includes(selectedDept) ? selectedDept : 'Todos');
    const filteredLabs = state.labs.filter((lab) => deptFilter.value === 'Todos' || lab.dept === deptFilter.value);
    fillOptions(labFilter, [{ value: 'Todos', label: 'Todos os laboratórios' }, ...filteredLabs.map((lab) => ({ value: lab.id, label: `${labDisplayName(lab)}${lab.room ? ` · Sala ${lab.room}` : ''}` }))], filteredLabs.some((lab) => lab.id === selectedLab) ? selectedLab : 'Todos');
    $('#liveProfilesCount').textContent = String(state.profiles.length);
    $('#liveLabsCount').textContent = String(state.labs.length);
    $('#liveAssetsCount').textContent = String(state.assets.length);
    $('#liveTicketsCount').textContent = String(state.tickets.length);
    $('#liveLastSync').textContent = formatTime();
    const assetsBody = $('#liveAssetsTable');
    const ticketsBody = $('#liveTicketsTable');
    const profilesBody = $('#liveProfilesTable');
    profilesBody.innerHTML = state.profiles.map((profile) => {
      const lab = profile.labId ? findLab(profile.labId) : null;
      const actions = profile.role === 'user' ? `<div class="table-actions"><button class="button button-outline table-action" type="button" data-action="edit-professor" data-id="${escapeHTML(profile.id)}">Editar</button><button class="button button-danger-outline table-action" type="button" data-action="delete-professor" data-id="${escapeHTML(profile.id)}">Remover</button></div>` : '—';
      return `<tr><td><strong>${liveCell(profile.name)}</strong></td><td>${liveCell(profile.email)}</td><td>${profile.role === 'admin' ? 'Administrador' : 'Professor'}</td><td>${liveCell(lab ? `${labDisplayName(lab)} · Sala ${lab.room || '—'}` : 'Acesso global')}</td><td>${actions}</td></tr>`;
    }).join('');
    const labsBody = $('#liveLabsTable');
    if (labsBody) labsBody.innerHTML = state.labs.length ? state.labs.map((lab) => `<tr><td><strong>${liveCell(labDisplayName(lab))}</strong></td><td>${liveCell(lab.dept)}</td><td>${liveCell(lab.room || '—')}</td><td><button class="button button-outline table-action" type="button" data-action="edit-lab" data-id="${escapeHTML(lab.id)}">Editar</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-table-cell">Nenhum laboratório cadastrado.</td></tr>';
    const teacherRoomBody = $('#teacherRoomReportTable');
    if (teacherRoomBody) {
      const teachers = state.profiles.filter((profile) => {
        if (profile.role !== 'user') return false;
        const lab = profile.labId ? findLab(profile.labId) : null;
        const dept = lab?.dept || profile.dept || '';
        const selectedDepartment = deptFilter?.value || 'Todos';
        const selectedLaboratory = labFilter?.value || 'Todos';
        return (selectedDepartment === 'Todos' || dept === selectedDepartment) && (selectedLaboratory === 'Todos' || profile.labId === selectedLaboratory);
      }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      teacherRoomBody.innerHTML = teachers.length ? teachers.map((profile) => {
        const lab = profile.labId ? findLab(profile.labId) : null;
        return `<tr><td><strong>${liveCell(profile.name)}</strong></td><td>${liveCell(profile.email)}</td><td>${liveCell(lab?.dept || profile.dept || '—')}</td><td>${liveCell(lab ? labDisplayName(lab) : 'Sem laboratório vinculado')}</td><td>${liveCell(lab?.room || profile.room || '—')}</td></tr>`;
      }).join('') : '<tr><td colspan="5" class="empty-table-cell">Nenhum professor corresponde aos filtros.</td></tr>';
    }
    assetsBody.innerHTML = state.assets.length ? state.assets.map((asset) => {
      const lab = findLab(asset.labId);
      return `<tr><td><span class="ticket-id">${liveCell(asset.code || asset.id)}</span></td><td><strong>${liveCell(asset.name)}</strong></td><td>${liveCell(lab ? lab.name : 'Não encontrado')}</td><td>${liveCell(asset.qty)}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="empty-table-cell">Nenhum item cadastrado.</td></tr>';
    ticketsBody.innerHTML = state.tickets.length ? state.tickets.map((ticket) => `<tr><td><span class="ticket-id">${liveCell(ticket.id)}</span></td><td><strong>${liveCell(ticket.assetCode || ticket.assetName)}</strong></td><td>${liveCell(ticket.labName)}</td><td>${liveCell(ticket.requester)}</td><td>${statusMarkup(ticket.status)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-table-cell">Nenhum chamado registrado.</td></tr>';
  }

  function startLiveRefresh() {
    if (state.liveTimer || !state.user) return;
    state.liveTimer = window.setInterval(async () => {
      if (!state.user) return;
      const fresh = await STORAGE.loadRemote();
      if (!fresh) return;
      const incomingUnread = fresh.notifications.filter((item) => item.recipientId === state.user.id && !item.read && !state.knownNotificationIds.has(item.id));
      incomingUnread.forEach((item) => showToast(item.text || 'Você recebeu uma nova atualização.', item.type === 'new-ticket' ? 'warning' : 'info'));
      fresh.notifications.forEach((item) => state.knownNotificationIds.add(item.id));
      const changed = JSON.stringify([state.profiles, state.labs, state.assets, state.tickets, state.directMessages, state.notifications]) !== JSON.stringify([fresh.profiles, fresh.labs, fresh.assets, fresh.tickets, fresh.directMessages, fresh.notifications]);
      if (changed) {
        state.profiles = fresh.profiles;
        state.directMessages = fresh.directMessages;
        state.notifications = fresh.notifications;
        state.labs = fresh.labs;
        state.assets = fresh.assets;
        state.tickets = fresh.tickets;
        renderPortal();
      } else {
        if (state.user.role === 'admin') renderLiveDatabase();
        refreshNotificationBadge();
      }
    }, 3000);
  }

  function stopLiveRefresh() {
    if (state.liveTimer) window.clearInterval(state.liveTimer);
    state.liveTimer = null;
  }

  function renderAdminCharts() {
    const pending = state.tickets.filter((ticket) => ticket.status !== 'Concluído').length;
    const done = state.tickets.length - pending;
    const total = state.tickets.length;
    const ratio = total ? (pending / total) * 100 : 0;
    const donut = $('#chartStatus');
    donut.style.background = `conic-gradient(#edab38 0 ${ratio}%, #36a68b ${ratio}% 100%)`;
    donut.setAttribute('aria-label', `${pending} chamados em andamento e ${done} concluídos, de ${total} no total.`);
    donut.innerHTML = `<span class="donut-center">${total}<small>chamados</small></span>`;
    $('#chartStatusLegend').innerHTML = `<li><span class="legend-dot" style="background:#edab38"></span>Em andamento <strong>${pending}</strong></li><li><span class="legend-dot" style="background:#36a68b"></span>Concluído <strong>${done}</strong></li>`;

    const labCounts = state.labs.map((lab) => ({ lab, value: state.tickets.filter((ticket) => ticket.labId === lab.id || ticket.labName === lab.name).length }));
    const knownLabIds = new Set(state.labs.map((lab) => lab.id));
    const orphanCounts = state.tickets.filter((ticket) => !ticket.labId || !knownLabIds.has(ticket.labId)).reduce((entries, ticket) => {
      const label = ticket.labName || 'Laboratório não identificado';
      const existing = entries.find((entry) => entry.label === label);
      if (existing) existing.value += 1;
      else entries.push({ label, value: 1 });
      return entries;
    }, []);
    const counts = [...labCounts.map((entry) => ({ label: entry.lab.name, value: entry.value })), ...orphanCounts]
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value);
    const max = Math.max(1, ...counts.map((entry) => entry.value));
    const chart = $('#chartLab');
    chart.setAttribute('aria-label', counts.length ? counts.map((entry) => `${entry.label}: ${entry.value}`).join('; ') : 'Nenhum chamado por laboratório');
    chart.innerHTML = counts.length ? counts.map((entry) => `<div class="bar-row"><span class="bar-label" title="${escapeHTML(entry.label)}">${escapeHTML(entry.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${(entry.value / max) * 100}%"></span></span><span class="bar-value">${entry.value}</span></div>`).join('') : '<p class="empty-state">Ainda não há chamados para distribuir por laboratório.</p>';
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    state.returnFocus = document.activeElement;
    state.activeModalId = id;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = $('input:not([type="hidden"]), select, textarea, button', modal);
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function closeModal(id = state.activeModalId) {
    const modal = id ? document.getElementById(id) : null;
    if (!modal) return;
    modal.hidden = true;
    if (state.activeModalId === id) state.activeModalId = null;
    document.body.style.overflow = '';
    if (id === 'addAssetModal') { state.editingAssetId = null; $('#assetModalTitle').textContent = 'Adicionar ativo'; }
    if (id === 'openTicketModal') {
      $('#ticketForm').reset();
      state.tempPhoto = null;
      state.photoToken += 1;
      state.photoTask = Promise.resolve();
      $('#photoPreviewBox').hidden = true;
      $('#photoPreviewImg').removeAttribute('src');
    }
    if (state.returnFocus && typeof state.returnFocus.focus === 'function') state.returnFocus.focus({ preventScroll: true });
  }

  function openTicketModalForAsset(id) {
    const asset = findAsset(id);
    if (!asset) return;
    state.activeAssetId = asset.id;
    $('#modalTicketAssetName').value = asset.name;
    const amount = Math.max(1, Math.min(5000, Number(asset.qty) || 1));
    fillOptions($('#modalTicketSerialSelect'), Array.from({ length: amount }, (_, index) => `Nº ${String(index + 1).padStart(2, '0')}`));
    openModal('openTicketModal');
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Não foi possível processar esta imagem.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.76);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível ler a imagem selecionada.'));
      };
      image.src = objectUrl;
    });
  }

  function handlePhotoChange(input) {
    const token = ++state.photoToken;
    const file = input.files && input.files[0];
    state.tempPhoto = null;
    $('#photoPreviewBox').hidden = true;
    state.photoTask = Promise.resolve();
    if (!file) return state.photoTask;
    if (!file.type.startsWith('image/')) {
      input.value = '';
      showToast('Selecione um arquivo de imagem.', 'warning');
      return state.photoTask;
    }
    if (file.size > 12 * 1024 * 1024) {
      input.value = '';
      showToast('A imagem original deve ter até 12 MB para ser processada.', 'warning');
      return state.photoTask;
    }
    state.photoTask = compressImage(file).then((dataUrl) => {
      if (token !== state.photoToken) return;
      state.tempPhoto = dataUrl;
      $('#photoPreviewImg').src = dataUrl;
      $('#photoPreviewBox').hidden = false;
    }).catch((error) => {
      if (token === state.photoToken) showToast(error.message || 'Não foi possível preparar a imagem.', 'error');
    });
    return state.photoTask;
  }

  function nextTicketId() {
    const highest = state.tickets.reduce((current, ticket) => Math.max(current, Number(String(ticket.id).replace(/\D/g, '')) || 0), 0);
    return `CH-${String(highest + 1).padStart(4, '0')}`;
  }

  function saveNewTicket() {
    const asset = findAsset(state.activeAssetId);
    if (!asset || !state.user) return;
    const lab = findLab(asset.labId);
    const desc = requireTrimmedText($('#modalTicketDesc'), 'Descreva o problema antes de registrar o chamado.');
    if (desc === null) return;
    const ticket = {
      id: nextTicketId(),
      dept: lab ? lab.dept : state.user.dept,
      labName: lab ? lab.name : 'Laboratório',
      assetName: asset.name,
      assetCode: asset.code || asset.id,
      labId: asset.labId,
      serial: $('#modalTicketSerialSelect').value,
      requester: state.user.name,
      requesterProfileId: state.user.id,
      type: $('#modalTicketType').value,
      desc,
      status: 'Em Andamento',
      photo: state.tempPhoto,
      messages: [{ sender: state.user.name, text: desc, time: formatTime() }]
    };
    const nextTickets = [ticket, ...state.tickets];
    if (!persist({ labs: state.labs, assets: state.assets, tickets: nextTickets })) return;
    const adminProfile = state.profiles.find((profile) => profile.role === 'admin');
    addNotification(adminProfile?.id, 'new-ticket', ticket.id, `Novo chamado ${ticket.id}: ${ticket.assetName}`);
    closeModal('openTicketModal');
    renderPortal();
    showToast(`Chamado ${ticket.id} registrado no armazenamento deste navegador.`, 'info');
  }

  function openAddAssetModal() {
    const selectedLabId = $('#userLabFilterSelect').value;
    const labId = selectedLabId && selectedLabId !== 'all' ? selectedLabId : (state.user && state.user.labId);
    if (state.user && state.user.role === 'user' && !findLab(labId)) {
      showToast('Cadastre ou selecione um laboratório antes de adicionar um ativo.', 'warning');
      return;
    }
    state.editingAssetId = null;
    $('#assetModalTitle').textContent = 'Adicionar ativo';
    $('#assetForm').reset();
    $('#newAssetQty').value = '1';
    openModal('addAssetModal');
  }

  function saveNewAsset() {
    if (state.editingAssetId) { saveEditedAsset(); return; }
    const labId = $('#userLabFilterSelect').value === 'all' ? state.user.labId : $('#userLabFilterSelect').value;
    const lab = findLab(labId);
    if (!lab) {
      showToast('Selecione um laboratório válido antes de cadastrar o ativo.', 'warning');
      return;
    }
    const name = requireTrimmedText($('#newAssetName'), 'Informe o nome do ativo.');
    if (name === null) return;
    const desc = requireTrimmedText($('#newAssetSpecs'), 'Informe as especificações do ativo.');
    if (desc === null) return;
    const qty = Number.parseInt($('#newAssetQty').value, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 5000) {
      showToast('Informe uma quantidade inteira entre 1 e 5.000.', 'warning');
      $('#newAssetQty').focus();
      return;
    }
    const nextNumber = state.assets.filter((entry) => entry.labId === lab.id).reduce((max, entry) => Math.max(max, Number(String(entry.code || '').split('-').pop()) || 0), 0) + 1;
    const room = lab.room || state.user.room || '000';
    const asset = { id: `a${Date.now().toString(36)}`, code: `INF-${room}-${String(nextNumber).padStart(3, '0')}`, labId: lab.id, name, desc, qty };
    const nextAssets = [...state.assets, asset];
    if (!persist({ labs: state.labs, assets: nextAssets, tickets: state.tickets })) return;
    closeModal('addAssetModal');
    renderPortal();
    showToast('Ativo cadastrado no catálogo local.', 'info');
  }

  function saveEditedAsset() {
    if (!state.user || state.user.role !== 'user') return;
    const current = findAsset(state.editingAssetId);
    const allowedLabs = state.user.labId ? [state.user.labId] : state.labs.filter((lab) => lab.dept === state.user.dept).map((lab) => lab.id);
    if (!current || !allowedLabs.includes(current.labId)) { showToast('Este item não está mais disponível para edição.', 'warning'); return; }
    const name = requireTrimmedText($('#newAssetName'), 'Informe o nome do item.'); if (name === null) return;
    const desc = requireTrimmedText($('#newAssetSpecs'), 'Informe as especificações do item.'); if (desc === null) return;
    const qty = Number.parseInt($('#newAssetQty').value, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 5000) { showToast('Informe uma quantidade inteira entre 1 e 5.000.', 'warning'); $('#newAssetQty').focus(); return; }
    const assets = state.assets.map((asset) => asset.id === current.id ? { ...asset, name, desc, qty } : asset);
    if (!persist({ labs: state.labs, assets, tickets: state.tickets })) return;
    state.editingAssetId = null; closeModal('addAssetModal'); renderPortal(); showToast('Informações do item atualizadas.', 'info');
  }
  function openEditAssetModal(assetId) {
    if (!state.user || state.user.role !== 'user') return;
    const asset = findAsset(assetId);
    const allowedLabs = state.user.labId ? [state.user.labId] : state.labs.filter((lab) => lab.dept === state.user.dept).map((lab) => lab.id);
    if (!asset || !allowedLabs.includes(asset.labId)) { showToast('Você só pode editar itens dos seus laboratórios.', 'warning'); return; }
    state.editingAssetId = asset.id;
    $('#assetModalTitle').textContent = 'Editar item do catálogo';
    $('#newAssetName').value = asset.name;
    $('#newAssetSpecs').value = asset.desc;
    $('#newAssetQty').value = String(asset.qty);
    openModal('addAssetModal');
  }
  function deleteAsset(assetId) {
    if (!state.user || state.user.role !== 'user') return;
    const asset = findAsset(assetId);
    const allowedLabs = state.user.labId ? [state.user.labId] : state.labs.filter((lab) => lab.dept === state.user.dept).map((lab) => lab.id);
    if (!asset || !allowedLabs.includes(asset.labId)) { showToast('Você só pode excluir itens dos seus laboratórios.', 'warning'); return; }
    if (!window.confirm(`Excluir “${asset.name}” do catálogo? Esta ação não pode ser desfeita.`)) return;
    const assets = state.assets.filter((entry) => entry.id !== asset.id);
    if (!persist({ labs: state.labs, assets, tickets: state.tickets })) return;
    renderPortal();
    showToast(`Item “${asset.name}” excluído do catálogo.`, 'info');
  }
  function openAddLabModal() {
    if (!state.user || state.user.role !== 'admin') return;
    state.editingLabId = null;
    $('#labForm').reset();
    $('#labModalTitle').textContent = 'Cadastrar laboratório';
    $('#labForm button[type="submit"]').textContent = 'Salvar laboratório';
    fillOptions($('#newLabDept'), DATA.departments, DATA.departments[0]);
    openModal('addLabModal');
  }

  function openAddProfessorModal() {
    if (!state.user || state.user.role !== 'admin') return;
    $('#professorForm').reset();
    fillOptions($('#newProfessorDept'), DATA.departments, DATA.departments[0]);
    syncNewProfessorLabs();
    openModal('addProfessorModal');
  }

  async function saveNewProfessor() {
    if (!state.user || state.user.role !== 'admin') return;
    $('#newProfessorPassword').setCustomValidity('');
    const name = requireTrimmedText($('#newProfessorName'), 'Informe o nome completo do professor.');
    const email = requireTrimmedText($('#newProfessorEmail'), 'Informe um e-mail válido.');
    const password = requireTrimmedText($('#newProfessorPassword'), 'Informe uma senha inicial.');
    const lab = findLab($('#newProfessorLab').value);
    if ([name, email, password].some((value) => value === null) || !lab) {
      if (!lab) showToast('Selecione um laboratório válido para este professor.', 'warning');
      return;
    }
    if (password.length < 6) {
      $('#newProfessorPassword').setCustomValidity('A senha deve ter pelo menos 6 caracteres.');
      $('#newProfessorPassword').reportValidity();
      return;
    }
    const normalizedEmail = email.toLocaleLowerCase('pt-BR');
    if (state.profiles.some((profile) => profile.email.toLocaleLowerCase('pt-BR') === normalizedEmail)) {
      showToast('Já existe um perfil com este e-mail.', 'warning');
      return;
    }
    const professor = { id: `prof-${Date.now().toString(36)}`, name, email, password, role: 'user', dept: lab.dept, labId: lab.id, room: lab.room || '' };
    if (!await persistAdminChange({ profiles: [...state.profiles, professor], labs: state.labs, assets: state.assets, tickets: state.tickets })) return;
    closeModal('addProfessorModal');
    renderPortal();
    showToast(`${name} foi cadastrado no ${lab.name}.`, 'info');
  }

  function openEditProfessorModal(profileId) {
    if (!state.user || state.user.role !== 'admin') return;
    const profile = state.profiles.find((item) => item.id === profileId && item.role === 'user');
    if (!profile) { showToast('Professor não encontrado.', 'warning'); return; }
    state.editingProfessorId = profile.id;
    $('#editProfessorName').value = profile.name || '';
    $('#editProfessorEmail').value = profile.email || '';
    $('#editProfessorPassword').value = '';
    fillOptions($('#editProfessorLab'), state.labs.map((lab) => ({ value: lab.id, label: `${lab.dept} · ${labDisplayName(lab)}${lab.room ? ` · Sala ${lab.room}` : ''}` })), profile.labId || '');
    openModal('editProfessorModal');
  }
  async function saveEditedProfessor() {
    if (!state.user || state.user.role !== 'admin') return;
    const current = state.profiles.find((item) => item.id === state.editingProfessorId && item.role === 'user');
    if (!current) { showToast('Professor não encontrado.', 'warning'); return; }
    const name = requireTrimmedText($('#editProfessorName'), 'Informe o nome completo do professor.');
    const email = requireTrimmedText($('#editProfessorEmail'), 'Informe um e-mail válido.');
    const lab = findLab($('#editProfessorLab').value);
    if (name === null || email === null || !lab) { if (!lab) showToast('Selecione um laboratório válido.', 'warning'); return; }
    if (state.profiles.some((item) => item.id !== current.id && item.email.toLocaleLowerCase('pt-BR') === email.toLocaleLowerCase('pt-BR'))) { showToast('Este e-mail já está vinculado a outro perfil.', 'warning'); return; }
    const password = $('#editProfessorPassword').value;
    if (password && password.length < 6) { showToast('A nova senha deve ter pelo menos 6 caracteres.', 'warning'); $('#editProfessorPassword').focus(); return; }
    const profiles = state.profiles.map((item) => item.id === current.id ? { ...item, name, email, labId: lab.id, dept: lab.dept, room: lab.room || '', ...(password ? { password } : {}) } : item);
    if (!await persistAdminChange({ profiles, labs: state.labs, assets: state.assets, tickets: state.tickets })) return;
    state.editingProfessorId = null; closeModal('editProfessorModal'); renderPortal(); showToast(password ? 'Informações atualizadas e senha redefinida.' : 'Informações do professor atualizadas.', 'info');
  }
  async function deleteProfessor(profileId) {
    if (!state.user || state.user.role !== 'admin') return;
    const profile = state.profiles.find((item) => item.id === profileId && item.role === 'user');
    if (!profile) { showToast('Professor não encontrado.', 'warning'); return; }
    if (!window.confirm(`Remover o acesso de ${profile.name}? Esta ação não poderá ser desfeita.`)) return;
    const profiles = state.profiles.filter((item) => item.id !== profile.id);
    const notifications = (state.notifications || []).filter((item) => item.recipientId !== profile.id);
    if (!await persistAdminChange({ profiles, labs: state.labs, assets: state.assets, tickets: state.tickets, directMessages: state.directMessages, notifications })) return;
    if (state.activeConversationProfileId === profile.id) state.activeConversationProfileId = null;
    renderPortal(); showToast(`${profile.name} foi removido.`, 'info');
  }
  function openEditLabModal(labId) {
    if (!state.user || state.user.role !== 'admin') return;
    const lab = findLab(labId);
    if (!lab) { showToast('Laboratório não encontrado.', 'warning'); return; }
    state.editingLabId = lab.id;
    $('#labForm').reset();
    $('#labModalTitle').textContent = 'Editar laboratório';
    $('#labForm button[type="submit"]').textContent = 'Salvar alterações';
    fillOptions($('#newLabDept'), DATA.departments, lab.dept);
    $('#newLabName').value = labDisplayName(lab) === 'Laboratório não encontrado' ? '' : labDisplayName(lab);
    $('#newLabRoom').value = lab.room || '';
    openModal('addLabModal');
  }
  async function saveNewLab() {
    if (!state.user || state.user.role !== 'admin') return;
    const editing = state.editingLabId ? findLab(state.editingLabId) : null;
    const dept = $('#newLabDept').value;
    const name = requireTrimmedText($('#newLabName'), 'Informe o nome do laboratório.');
    const room = requireTrimmedText($('#newLabRoom'), 'Informe o número da sala.');
    if (name === null || room === null) return;
    const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    const duplicate = state.labs.some((lab) => lab.id !== editing?.id && normalize(lab.dept) === normalize(dept) && normalize(lab.room) === normalize(room));
    if (duplicate) { showToast('Essa sala já está cadastrada neste departamento. Informe outro número de sala.', 'warning'); $('#newLabRoom').focus(); return; }
    if (editing) {
      const labs = state.labs.map((lab) => lab.id === editing.id ? { ...lab, dept, name, room } : lab);
      const profiles = state.profiles.map((profile) => profile.labId === editing.id ? { ...profile, dept, room } : profile);
      if (!await persistAdminChange({ profiles, labs, assets: state.assets, tickets: state.tickets })) return;
      state.editingLabId = null; closeModal('addLabModal'); populateSelects(); renderPortal(); showToast('Laboratório atualizado.', 'info');
      return;
    }
    const lab = { id: `l${Date.now().toString(36)}`, dept, name, room };
    const nextLabs = [...state.labs, lab];
    if (!await persistAdminChange({ labs: nextLabs, assets: state.assets, tickets: state.tickets })) return;
    closeModal('addLabModal'); populateSelects(); renderPortal(); showToast('Laboratório cadastrado e sincronizado com os demais dispositivos.', 'info');
  }
  function openChatModal(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) return;
    state.activeTicketId = ticket.id;
    $('#chatModalTitle').textContent = `Chamado ${ticket.id}`;
    $('#chatModalSub').textContent = `${ticket.assetName} (${ticket.serial}) · ${ticket.requester}`;
    const statusControl = $('#ticketStatusControl');
    if (statusControl) statusControl.hidden = state.user?.role !== 'admin';
    renderChatMessages();
    openModal('manageTicketModal');
  }

  function renderChatMessages() {
    const ticket = findTicket(state.activeTicketId);
    const feed = $('#chatMessageFeed');
    if (!ticket) return;
    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    if (!messages.length) {
      feed.innerHTML = '<p class="empty-state">Ainda não há mensagens neste chamado.</p>';
      return;
    }
    feed.innerHTML = messages.map((message) => {
      const isOwn = state.user && (state.user.role === 'admin' ? message.sender === 'Admin' : message.sender === state.user.name);
      return `<article class="chat-message${isOwn ? ' is-own' : ''}"><p class="chat-meta">${escapeHTML(message.sender)} · ${escapeHTML(message.time)}</p><div class="chat-bubble">${escapeHTML(message.text)}</div></article>`;
    }).join('');
    feed.scrollTop = feed.scrollHeight;
  }

  function sendChatMessage() {
    const text = requireTrimmedText($('#chatInputText'), 'Escreva uma mensagem antes de enviar.');
    if (text === null) return;
    const ticket = findTicket(state.activeTicketId);
    if (!ticket || !state.user) return;
    const updated = { ...ticket, messages: [...(ticket.messages || []), { sender: state.user.role === 'admin' ? 'Admin' : state.user.name, text, time: formatTime() }] };
    const nextTickets = state.tickets.map((entry) => entry.id === ticket.id ? updated : entry);
    if (!persist({ labs: state.labs, assets: state.assets, tickets: nextTickets })) return;
    if (state.user.role === 'admin') { const requester = state.profiles.find((profile) => profile.id === ticket.requesterProfileId) || state.profiles.find((profile) => profile.role === 'user' && profile.name === ticket.requester); addNotification(requester?.id, 'ticket-message', `${ticket.id}:${updated.messages.length}`, `Nova mensagem no chamado ${ticket.id}.`); }
    $('#chatInputText').value = '';
    renderChatMessages();
  }

  function updateTicketStatus(status) {
    if (!state.user || state.user.role !== 'admin') {
      showToast('Apenas administradores podem atualizar o status do chamado.', 'warning');
      return;
    }
    const ticket = findTicket(state.activeTicketId);
    if (!ticket || !['Em Andamento', 'Concluído'].includes(status) || ticket.status === status) return;
    const updated = { ...ticket, status };
    const nextTickets = state.tickets.map((entry) => entry.id === ticket.id ? updated : entry);
    if (!persist({ labs: state.labs, assets: state.assets, tickets: nextTickets })) return;
    if (state.user.role === 'admin') { const requester = state.profiles.find((profile) => profile.id === ticket.requesterProfileId) || state.profiles.find((profile) => profile.role === 'user' && profile.name === ticket.requester); addNotification(requester?.id, 'ticket-update', `${ticket.id}:${status}`, `O chamado ${ticket.id} foi atualizado: ${status}.`); }
    closeModal('manageTicketModal');
    renderPortal();
    showToast(`Status do chamado atualizado para “${status}”.`, 'info');
  }

  function openQrModal(assetId) {
    const asset = findAsset(assetId);
    if (!asset) return;
    $('#qrModalTitle').textContent = asset.name;
    $('#qrModalSub').textContent = `ID local do ativo: ${asset.id}`;
    const container = $('#qrContainer');
    container.replaceChildren();
    const payload = `Help! | Ativo: ${asset.name} | ID: ${asset.id}`;
    if (typeof window.QRCode === 'function') {
      new window.QRCode(container, { text: payload, width: 180, height: 180, colorDark: '#102c35', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    } else {
      container.textContent = payload;
      showToast('O gerador QR local não carregou; a identificação textual continua disponível.', 'warning');
    }
    openModal('qrCodeModal');
  }

  function exportTeacherRoomPdf() {
    if (!state.user || state.user.role !== 'admin') { showToast('Apenas administradores podem exportar este relatório.', 'warning'); return; }
    const selectedDepartment = $('#teacherRoomDeptFilter')?.value || 'Todos';
    const selectedLaboratory = $('#teacherRoomLabFilter')?.value || 'Todos';
    const teachers = state.profiles.filter((profile) => {
      if (profile.role !== 'user') return false;
      const lab = profile.labId ? findLab(profile.labId) : null;
      const dept = lab?.dept || profile.dept || '';
      return (selectedDepartment === 'Todos' || dept === selectedDepartment) && (selectedLaboratory === 'Todos' || profile.labId === selectedLaboratory);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    const rows = teachers.map((profile) => {
      const lab = profile.labId ? findLab(profile.labId) : null;
      return `<tr><td>${escapeHTML(profile.name || '—')}</td><td>${escapeHTML(profile.email || '—')}</td><td>${escapeHTML(lab?.dept || profile.dept || '—')}</td><td>${escapeHTML(lab?.name || 'Sem laboratório vinculado')}</td><td>${escapeHTML(lab?.room || profile.room || '—')}</td></tr>`;
    }).join('');
    const generatedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.', 'warning'); return; }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de professores por laboratório e sala</title><style>@page{size:landscape;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b43;margin:0}header{border-bottom:3px solid #155da8;padding:0 0 14px;margin-bottom:20px}h1{font-size:24px;margin:0 0 6px;color:#102c4c}p{margin:0;color:#52677d;font-size:12px}.meta{margin-top:10px;font-size:11px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#102c4c;color:#fff;text-align:left;padding:10px 8px}td{border-bottom:1px solid #d3dfeb;padding:9px 8px;vertical-align:top}tbody tr:nth-child(even){background:#f3f7fc}footer{margin-top:15px;color:#52677d;font-size:10px}@media print{thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><header><h1>Professores por laboratório e sala</h1><p>Relatório de alocação de professores</p><p class="meta">Gerado em ${escapeHTML(generatedAt)} · Total de professores: ${teachers.length}</p></header><table><thead><tr><th>Professor</th><th>E-mail</th><th>Departamento</th><th>Laboratório</th><th>Sala</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nenhum professor cadastrado.</td></tr>'}</tbody></table><footer>EquipVirtual · Relatório administrativo</footer><script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print()},250)})<\/script></body></html>`);
    printWindow.document.close();
  }
  function reportRowsForLab(labId) {
    return state.tickets.filter((ticket) => ticket.labId === labId);
  }

  function exportReportImage() {
    const labId = $('#reportLabSelect').value;
    const lab = findLab(labId);
    if (!lab) { showToast('Selecione um laboratório para gerar a imagem.', 'warning'); return; }
    const assets = state.assets.filter((asset) => asset.labId === lab.id);
    const tickets = state.tickets.filter((ticket) => ticket.labId === lab.id || ticket.labName === lab.name);
    const maxRows = 18;
    const shownAssets = assets.slice(0, maxRows);
    const shownTickets = tickets.slice(0, maxRows);
    const assetRows = Math.max(1, shownAssets.length);
    const ticketRows = Math.max(1, shownTickets.length);
    const width = 1600;
    const margin = 88;
    const tableRowHeight = 54;
    const assetStart = 524;
    const ticketTitleY = assetStart + assetRows * tableRowHeight + 92;
    const ticketStart = ticketTitleY + 110;
    const height = ticketStart + ticketRows * tableRowHeight + 100;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { showToast('Não foi possível gerar a imagem neste navegador.', 'error'); return; }
    const colors = { navy: '#102c4c', blue: '#155da8', ink: '#102a43', muted: '#52677d', line: '#d3dfeb', light: '#f3f7fc', white: '#ffffff', cyan: '#eaf1f9' };
    ctx.fillStyle = colors.light; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors.navy; ctx.fillRect(0, 0, width, 300);
    ctx.fillStyle = '#9bcaff'; ctx.font = '700 22px Arial, sans-serif'; ctx.fillText('HELP!  /  RELATÓRIO', margin, 62);
    ctx.fillStyle = colors.white; ctx.font = '700 48px Arial, sans-serif'; ctx.fillText('Resumo do laboratório', margin, 128);
    ctx.font = '400 25px Arial, sans-serif'; ctx.fillStyle = '#d9e7f8'; ctx.fillText(lab.name, margin, 174, 1100);
    ctx.font = '400 18px Arial, sans-serif'; ctx.fillStyle = '#d9e7f8';
    ctx.fillText(`${lab.dept || 'Departamento não informado'}  ·  Sala ${lab.room || '—'}`, margin, 213);
    ctx.fillStyle = '#b8d0ea'; ctx.font = '400 16px Arial, sans-serif';
    ctx.fillText(`Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`, margin, 260);

    const totalUnits = assets.reduce((sum, asset) => sum + (Number(asset.qty) || 0), 0);
    const inProgress = tickets.filter((ticket) => ticket.status !== 'Concluído').length;
    const completed = tickets.length - inProgress;
    const metrics = [['ITENS CADASTRADOS', String(assets.length)], ['UNIDADES NO CATÁLOGO', String(totalUnits)], ['CHAMADOS REGISTRADOS', String(tickets.length)], ['EM ANDAMENTO / CONCLUÍDOS', `${inProgress} / ${completed}`]];
    const gap = 18; const cardWidth = (width - margin * 2 - gap * 3) / 4; const cardY = 326;
    metrics.forEach(([label, value], index) => {
      const x = margin + index * (cardWidth + gap);
      ctx.fillStyle = colors.white; ctx.strokeStyle = colors.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, cardY, cardWidth, 122, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.muted; ctx.font = '700 15px Arial, sans-serif'; ctx.fillText(label, x + 22, cardY + 34, cardWidth - 44);
      ctx.fillStyle = colors.blue; ctx.font = '700 36px Arial, sans-serif'; ctx.fillText(value, x + 22, cardY + 84, cardWidth - 44);
    });

    function sectionTitle(title, y) { ctx.fillStyle = colors.ink; ctx.font = '700 29px Arial, sans-serif'; ctx.fillText(title, margin, y); }
    function tableHeader(y, columns) {
      ctx.fillStyle = colors.navy; ctx.fillRect(margin, y, width - margin * 2, 48);
      ctx.fillStyle = colors.white; ctx.font = '700 16px Arial, sans-serif';
      columns.forEach(([label, x, maxWidth]) => ctx.fillText(label, x, y + 31, maxWidth));
    }
    function tableRow(y, cells, index) {
      ctx.fillStyle = index % 2 ? colors.white : colors.cyan; ctx.fillRect(margin, y, width - margin * 2, tableRowHeight);
      ctx.strokeStyle = colors.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(margin, y + tableRowHeight); ctx.lineTo(width - margin, y + tableRowHeight); ctx.stroke();
      cells.forEach(([value, x, maxWidth, color]) => { ctx.fillStyle = color || colors.ink; ctx.font = '500 17px Arial, sans-serif'; ctx.fillText(String(value ?? '—'), x, y + 33, maxWidth); });
    }
    sectionTitle('Catálogo do laboratório', 466);
    tableHeader(476, [['CÓDIGO', margin + 18, 230], ['ITEM', margin + 280, 850], ['QUANTIDADE', width - margin - 180, 160]]);
    if (shownAssets.length) shownAssets.forEach((asset, index) => tableRow(assetStart + index * tableRowHeight, [[asset.code || asset.id, margin + 18, 230], [asset.name, margin + 280, 850], [asset.qty, width - margin - 180, 160]], index));
    else tableRow(assetStart, [['—', margin + 18, 230], ['Nenhum item cadastrado', margin + 280, 850], ['—', width - margin - 180, 160]], 0);
    if (assets.length > maxRows) { ctx.fillStyle = colors.muted; ctx.font = 'italic 15px Arial, sans-serif'; ctx.fillText(`Exibindo ${maxRows} de ${assets.length} itens.`, margin, assetStart + assetRows * tableRowHeight + 24); }

    sectionTitle('Chamados recentes', ticketTitleY);
    tableHeader(ticketTitleY + 10, [['CHAMADO', margin + 18, 230], ['ITEM / SOLICITANTE', margin + 280, 850], ['STATUS', width - margin - 250, 225]]);
    if (shownTickets.length) shownTickets.forEach((ticket, index) => tableRow(ticketStart + index * tableRowHeight, [[ticket.id, margin + 18, 230], [`${ticket.assetName} · ${ticket.requester}`, margin + 280, 850], [ticket.status, width - margin - 250, 225, ticket.status === 'Concluído' ? '#176b54' : colors.blue]], index));
    else tableRow(ticketStart, [['—', margin + 18, 230], ['Nenhum chamado registrado', margin + 280, 850], ['—', width - margin - 250, 225]], 0);
    if (tickets.length > maxRows) { ctx.fillStyle = colors.muted; ctx.font = 'italic 15px Arial, sans-serif'; ctx.fillText(`Exibindo ${maxRows} de ${tickets.length} chamados.`, margin, ticketStart + ticketRows * tableRowHeight + 24); }
    ctx.fillStyle = colors.muted; ctx.font = '400 14px Arial, sans-serif'; ctx.fillText('Help! · Relatório informativo gerado localmente.', margin, height - 38);

    const filename = `relatorio-${lab.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    canvas.toBlob((blob) => {
      if (!blob) { showToast('A imagem não pôde ser exportada.', 'error'); return; }
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Imagem do relatório baixada em PNG.', 'info');
    }, 'image/png');
  }

  function handleClick(event) {
    if (!event.target.closest('.dashboard-mobile-nav')) closeDashboardNavMenus();
    if (!event.target.closest('.notification-center')) {
      const panel = $('#notificationPanel');
      if (panel && !panel.hidden) { panel.hidden = true; $('.notification-button')?.setAttribute('aria-expanded', 'false'); }
    }
    const closeMenuLink = event.target.closest('.nav-link');
    if (closeMenuLink) setMobileMenu(false);
    const button = event.target.closest('[data-action]');
    if (!button) {
      if (event.target.classList.contains('modal-backdrop')) closeModal(event.target.id);
      return;
    }
    const { action } = button.dataset;
    if (action === 'enter-portal') enterPortal();
    else if (action === 'go-home') { event.preventDefault(); goHome(); }
    else if (action === 'toggle-theme') toggleTheme();
    else if (action === 'toggle-menu') setMobileMenu(!$('#siteNav').classList.contains('is-open'));
    else if (action === 'toggle-user-nav') toggleDashboardNav('user');
    else if (action === 'toggle-admin-nav') toggleDashboardNav('admin');
    else if (action === 'toggle-notifications') toggleNotifications(button);
    else if (action === 'mark-all-notifications') markAllNotificationsRead();
    else if (action === 'open-notification') openNotification(button.dataset.notificationId);
    else if (action === 'toggle-direct-attach') toggleDirectAttachMenu(button);
    else if (action === 'select-direct-file') openDirectFilePicker(button);
    else if (action === 'switch-login') switchLoginTab(button.dataset.role);
    else if (action === 'logout') logout();
    else if (action === 'open-profile') openProfile();
    else if (action === 'open-messages') openDirectMessages();
    else if (action === 'select-direct-conversation') { state.activeConversationProfileId = button.dataset.profileId; renderDirectMessages(); }
    else if (action === 'edit-direct-profile') openDirectProfileEditor();
    else if (action === 'open-add-asset') openAddAssetModal();
    else if (action === 'edit-asset') openEditAssetModal(button.dataset.id);
    else if (action === 'delete-asset') deleteAsset(button.dataset.id);
    else if (action === 'open-add-lab') openAddLabModal();
    else if (action === 'edit-lab') openEditLabModal(button.dataset.id);
    else if (action === 'open-add-professor') openAddProfessorModal();
    else if (action === 'edit-professor') openEditProfessorModal(button.dataset.id);
    else if (action === 'delete-professor') deleteProfessor(button.dataset.id);
    else if (action === 'open-ticket') openTicketModalForAsset(button.dataset.id);
    else if (action === 'open-qr') openQrModal(button.dataset.id);
    else if (action === 'open-chat') openChatModal(button.dataset.id);
    else if (action === 'close-modal') closeModal(button.dataset.modal);
    else if (action === 'update-status') updateTicketStatus(button.dataset.status);
    else if (action === 'switch-user-tab') switchUserTab(button.dataset.tab);
    else if (action === 'switch-admin-tab') switchAdminTab(button.dataset.tab);
    else if (action === 'export-report-image') exportReportImage();
    else if (action === 'export-teacher-room-pdf') exportTeacherRoomPdf();
    else if (action === 'refresh-live') refreshSharedState();
  }

  async function refreshSharedState() {
    const fresh = await STORAGE.loadRemote();
    if (!fresh) { showToast('Não foi possível conectar ao banco compartilhado agora.', 'error'); return; }
    state.profiles = fresh.profiles; state.labs = fresh.labs; state.assets = fresh.assets; state.tickets = fresh.tickets;
    state.directMessages = fresh.directMessages || []; state.notifications = fresh.notifications || [];
    fresh.notifications.forEach((item) => state.knownNotificationIds.add(item.id));
    renderPortal(); showToast('Dados atualizados do servidor.', 'info');
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const type = form.dataset.form;
    if (type === 'user-login') await loginAsUser(form);
    else if (type === 'admin-login') await loginAsAdmin();
    else if (type === 'ticket') {
      await state.photoTask;
      saveNewTicket();
    }
    else if (type === 'asset') saveNewAsset();
    else if (type === 'lab') await saveNewLab();
    else if (type === 'professor') await saveNewProfessor();
    else if (type === 'edit-professor') await saveEditedProfessor();
    else if (type === 'chat') sendChatMessage();
    else if (type === 'direct-message') { if (await sendDirectMessage()) event.target.reset(); }
    else if (type === 'profile-request') { const text = requireTrimmedText($('#profileRequestText'), 'Escreva sua dúvida ou solicitação.'); if (text !== null && await sendDirectMessage(text)) { $('#profileRequestText').value = ''; closeModal('profileModal'); openDirectMessages(); showToast('Solicitação enviada à administração.', 'info'); } }
    else if (type === 'edit-direct-profile') saveDirectProfileEdit();
  }

  function handleChange(event) {
    if (event.target.id === 'loginUserDept') syncUserLabsSelect();
    else if (event.target.id === 'newProfessorDept') syncNewProfessorLabs();
    else if (event.target.id === 'userLabFilterSelect') renderUserDashboard();
    else if (event.target.id === 'adminCourseFilter') renderAdminDashboard();
    else if (event.target.id === 'teacherRoomDeptFilter' || event.target.id === 'teacherRoomLabFilter') renderLiveDatabase();
    else if (event.target.id === 'modalTicketPhoto') handlePhotoChange(event.target);
    else if (event.target.matches('[data-direct-file-input]')) handleDirectFileChange(event.target);
  }

  function handleInput(event) {
    const input = event.target;
    if (input.matches('input, textarea') && input.getAttribute('aria-invalid') === 'true' && input.value.trim()) {
      input.removeAttribute('aria-invalid');
      input.setCustomValidity('');
    }
    if (input.id === 'userAssetSearchInput') renderUserDashboard();
    else if (input.id === 'userDirectSearchInput' || input.id === 'adminDirectSearchInput') renderDirectMessages();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (state.activeModalId) closeModal(state.activeModalId);
      else if ($('#notificationPanel') && !$('#notificationPanel').hidden) { $('#notificationPanel').hidden = true; $('.notification-button')?.setAttribute('aria-expanded', 'false'); }
      else if ($('#siteNav').classList.contains('is-open')) setMobileMenu(false);
    }
    const activeTab = event.target.closest && event.target.closest('[role="tab"]');
    if (activeTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const tablist = activeTab.closest('[role="tablist"]');
      const tabs = tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')).filter((tab) => !tab.disabled) : [];
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex >= 0 && tabs.length) {
        const nextIndex = event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1
            : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        tabs[nextIndex].click();
        tabs[nextIndex].focus();
        return;
      }
    }
    if (event.key !== 'Tab' || !state.activeModalId) return;
    const modal = document.getElementById(state.activeModalId);
    const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]', modal).filter((element) => !element.closest('[hidden]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function initialize() {
    const remote = await STORAGE.loadRemote();
    if (remote) {
      applyRemoteState(remote);
      state.user = STORAGE.currentProfile();
    }
    state.knownNotificationIds = new Set(state.notifications.map((item) => item.id));
    populateSelects();
    applyTheme(STORAGE.readTheme(), false);
    $('#copyrightYear').textContent = String(new Date().getFullYear());
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('change', handleChange);
    document.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('ev-remote-save-failed', () => showToast('Não foi possível confirmar a gravação no servidor. Confira a conexão antes de continuar.', 'error'));
    window.addEventListener('storage', (event) => {
      if (!state.user || !['ev_profiles', 'ev_labs', 'ev_assets', 'ev_tickets', 'ev_direct_messages', 'ev_notifications'].includes(event.key)) return;
      const fresh = STORAGE.load();
      state.profiles = fresh.profiles; state.labs = fresh.labs; state.assets = fresh.assets; state.tickets = fresh.tickets; state.directMessages = fresh.directMessages; state.notifications = fresh.notifications;
      renderPortal();
    });
    if (window.location.hash === '#portal') enterPortal();
    renderPortal();
    if (state.user) startLiveRefresh();
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
