(function () {
  'use strict';

  const keys = Object.freeze({
    profiles: 'ev_profiles',
    labs: 'ev_labs',
    assets: 'ev_assets',
    tickets: 'ev_tickets',
    directMessages: 'ev_direct_messages',
    notifications: 'ev_notifications',
    theme: 'theme'
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  let pendingRemoteWrite = Promise.resolve(true);
  let csrfToken = '';
  let sessionProfile = null;
  let lastRemoteFailureNotice = 0;
  function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function hasText(value) { return typeof value === 'string' && value.trim().length > 0; }
  function validProfile(profile) {
    return isRecord(profile) && hasText(profile.id) && hasText(profile.name) && hasText(profile.email)
      && hasText(profile.password) && ['user', 'admin'].includes(profile.role);
  }
  function validLab(lab) { return isRecord(lab) && hasText(lab.id) && hasText(lab.dept) && hasText(lab.name); }
  function validAsset(asset) {
    return isRecord(asset) && hasText(asset.id) && hasText(asset.labId) && hasText(asset.name)
      && hasText(asset.desc) && Number.isInteger(asset.qty) && asset.qty >= 0;
  }
  function validMessage(message) { return isRecord(message) && hasText(message.sender) && hasText(message.text) && hasText(message.time); }
  function validDirectMessage(message) { return isRecord(message) && hasText(message.id) && hasText(message.profileId) && hasText(message.senderId) && hasText(message.senderName) && (hasText(message.text) || (isRecord(message.attachment) && hasText(message.attachment.name) && hasText(message.attachment.data))) && hasText(message.time); }
  function validNotification(item) { return isRecord(item) && hasText(item.id) && hasText(item.recipientId) && hasText(item.type) && hasText(item.text) && hasText(item.time) && typeof item.read === 'boolean'; }
  function validTicket(ticket) {
    const requiredText = ['id', 'dept', 'labName', 'assetName', 'serial', 'requester', 'desc'];
    return isRecord(ticket) && requiredText.every((field) => hasText(ticket[field]))
      && ['Manutenção / Reparo', 'Troca de Peça', 'Calibração / Ajuste', 'Substituição Integral'].includes(ticket.type)
      && ['Em Andamento', 'Concluído'].includes(ticket.status)
      && (ticket.photo == null || typeof ticket.photo === 'string');
  }
  function normalizeAsset(asset) { return { ...asset, code: hasText(asset.code) ? asset.code : asset.id.toUpperCase() }; }
  function normalizeTicket(ticket) { return { ...ticket, photo: typeof ticket.photo === 'string' ? ticket.photo : null, messages: Array.isArray(ticket.messages) ? ticket.messages.filter(validMessage) : [] }; }
  function safeProfiles(profiles) { return profiles.map((profile) => ({ ...profile, password: '__remote__' })); }

  function readCollection(key, fallback, validator, normalize = (item) => item) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return clone(fallback);
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) return clone(fallback);
      const cleaned = value.filter(validator).map(normalize);
      if (value.length > 0 && cleaned.length === 0) return clone(fallback);
      return cleaned;
    } catch (_error) { return clone(fallback); }
  }

  function load() {
    const defaults = window.EVData;
    const profiles = readCollection(keys.profiles, defaults.profiles, validProfile).map((profile) => ({ ...profile, password: '__remote__' }));
    return {
      profiles,
      labs: readCollection(keys.labs, defaults.defaultLabs, validLab),
      assets: readCollection(keys.assets, defaults.defaultAssets, validAsset, normalizeAsset),
      tickets: readCollection(keys.tickets, defaults.defaultTickets, validTicket, normalizeTicket),
      directMessages: readCollection(keys.directMessages, [], validDirectMessage),
      notifications: readCollection(keys.notifications, [], validNotification)
    };
  }

  function cacheCollections(next) {
    const safe = { ...next, profiles: safeProfiles(next.profiles || []) };
    window.localStorage.setItem(keys.profiles, JSON.stringify(safe.profiles));
    window.localStorage.setItem(keys.labs, JSON.stringify(safe.labs));
    window.localStorage.setItem(keys.assets, JSON.stringify(safe.assets));
    window.localStorage.setItem(keys.tickets, JSON.stringify(safe.tickets));
    window.localStorage.setItem(keys.directMessages, JSON.stringify(safe.directMessages || []));
    window.localStorage.setItem(keys.notifications, JSON.stringify(safe.notifications || []));
  }

  function syncLocalCache(next) {
    try { cacheCollections(next); return true; }
    catch (_error) { return false; }
  }

  function saveCollections(next, options = {}) {
    const previous = {};
    try {
      Object.values(keys).filter((key) => key !== keys.theme).forEach((key) => { previous[key] = window.localStorage.getItem(key); });
      cacheCollections(next);
    } catch (_error) {
      Object.entries(previous).forEach(([key, value]) => { try { value === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value); } catch (_rollbackError) {} });
      return false;
    }
    const payload = clone(next);
    pendingRemoteWrite = pendingRemoteWrite.catch(() => false).then(async () => {
      try {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify(payload),
          cache: 'no-store'
        });
        if (!response.ok) throw new Error(`remote state ${response.status}`);
        return true;
      } catch (error) {
        console.warn('Não foi possível confirmar a gravação no banco compartilhado.', error);
        const now = Date.now();
        if (options.notifyRemoteFailure !== false && now - lastRemoteFailureNotice >= 5000) {
          lastRemoteFailureNotice = now;
          window.dispatchEvent(new CustomEvent('ev-remote-save-failed'));
        }
        return false;
      }
    });
    return true;
  }

  async function restoreSession() {
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.profile || !result.csrfToken) return null;
      csrfToken = result.csrfToken;
      sessionProfile = result.profile;
      return sessionProfile;
    } catch (_error) { return null; }
  }

  async function loadRemote() {
    try {
      await pendingRemoteWrite;
      if (!csrfToken && !await restoreSession()) return null;
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 401) { csrfToken = ''; sessionProfile = null; }
        throw new Error(`remote state ${response.status}`);
      }
      const remote = await response.json();
      if (!Array.isArray(remote.profiles) || !Array.isArray(remote.labs) || !Array.isArray(remote.assets) || !Array.isArray(remote.tickets)) return null;
      return remote;
    } catch (error) {
      if (error.message !== 'remote state 401') console.warn('Não foi possível carregar o estado compartilhado.', error);
      return null;
    }
  }

  async function authenticate(email, password, role) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.profile || !result.csrfToken) return null;
      csrfToken = result.csrfToken;
      sessionProfile = result.profile;
      return result.profile;
    } catch (_error) { return null; }
  }

  async function logout() {
    try {
      if (csrfToken) await fetch('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, cache: 'no-store' });
    } catch (error) { console.warn('Não foi possível encerrar a sessão no servidor.', error); }
    csrfToken = '';
    sessionProfile = null;
  }

  function currentProfile() { return sessionProfile ? { ...sessionProfile } : null; }
  async function flushRemote() { return (await pendingRemoteWrite) === true; }
  function readTheme() {
    try {
      const saved = window.localStorage.getItem(keys.theme);
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_error) { return 'light'; }
  }
  function saveTheme(theme) { try { window.localStorage.setItem(keys.theme, theme); return true; } catch (_error) { return false; } }
  window.EVStorage = Object.freeze({ load, loadRemote, authenticate, saveCollections, flushRemote, logout, currentProfile, readTheme });
})();
  window.EVStorage = Object.freeze({ load, loadRemote, authenticate, saveCollections, syncLocalCache, flushRemote, logout, currentProfile, readTheme });
