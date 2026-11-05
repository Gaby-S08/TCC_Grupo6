'use strict';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function fail(message, status = 403) { const error = new Error(message); error.status = status; throw error; }

function normalizeState(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
    labs: Array.isArray(raw.labs) ? raw.labs : [],
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    tickets: Array.isArray(raw.tickets) ? raw.tickets : [],
    directMessages: Array.isArray(raw.directMessages) ? raw.directMessages : [],
    notifications: Array.isArray(raw.notifications) ? raw.notifications : []
  };
}

function safeProfile(profile) { return { ...profile, password: '__remote__' }; }
function profileFor(state, profileId) { return state.profiles.find((profile) => profile.id === profileId) || null; }
function allowedLabsForTeacher(state, actor) {
  if (actor.labId) return new Set([actor.labId]);
  return new Set(state.labs.filter((lab) => lab.dept === actor.dept).map((lab) => lab.id));
}

function stateForActor(rawState, actor) {
  const state = normalizeState(rawState);
  if (actor.role === 'admin') return { ...state, profiles: state.profiles.map(safeProfile) };
  const allowedLabs = allowedLabsForTeacher(state, actor);
  return {
    profiles: state.profiles.filter((profile) => profile.id === actor.id || profile.role === 'admin').map(safeProfile),
    labs: state.labs.filter((lab) => allowedLabs.has(lab.id)),
    assets: state.assets.filter((asset) => allowedLabs.has(asset.labId)),
    tickets: state.tickets.filter((ticket) => allowedLabs.has(ticket.labId) || ticket.requesterProfileId === actor.id),
    directMessages: state.directMessages.filter((message) => message.profileId === actor.id),
    notifications: state.notifications.filter((item) => item.recipientId === actor.id)
  };
}

function ensureUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) fail(`${label}: identificador inválido ou repetido.`, 400);
    ids.add(item.id);
  }
}

function validateLabs(labs) {
  ensureUniqueIds(labs, 'Laboratórios');
  const keys = new Set();
  for (const lab of labs) {
    if (!lab.dept?.trim() || !lab.name?.trim() || !String(lab.room || '').trim()) fail('Informe nome, departamento e número da sala do laboratório.', 400);
    const key = `${lab.dept.trim().toLocaleLowerCase('pt-BR')}\u0000${String(lab.room).trim().toLocaleLowerCase('pt-BR')}`;
    if (keys.has(key)) fail('Já existe um laboratório cadastrado nesta sala e departamento.', 409);
    keys.add(key);
  }
}

function mergeProfiles(incoming, current, actor, hashPassword) {
  ensureUniqueIds(incoming, 'Perfis');
  const oldById = new Map(current.map((profile) => [profile.id, profile]));
  const profiles = incoming.map((profile) => {
    if (!profile.name?.trim() || !profile.email?.trim() || !['user', 'admin'].includes(profile.role)) fail('Os dados do perfil são inválidos.', 400);
    const previous = oldById.get(profile.id);
    if (profile.password === '__remote__') {
      if (!previous) fail('A senha do novo perfil é obrigatória.', 400);
      return { ...profile, password: previous.password };
    }
    return { ...profile, password: hashPassword(profile.password) };
  });
  const emails = new Set();
  for (const profile of profiles) {
    const email = profile.email.trim().toLocaleLowerCase('pt-BR');
    if (emails.has(email)) fail('Já existe um perfil com este e-mail.', 409);
    emails.add(email);
  }
  if (!profiles.some((profile) => profile.role === 'admin')) fail('O sistema precisa manter ao menos um administrador.', 409);
  if (!profiles.some((profile) => profile.id === actor.id && profile.role === 'admin')) fail('Não é permitido remover ou rebaixar a sessão administrativa atual.', 409);
  return profiles;
}

function mergeById(incoming, current) {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) if (item && item.id) merged.set(item.id, item);
  return Array.from(merged.values());
}

function mergeTicketMessages(previous = [], incoming = [], actor, isAdmin) {
  const messages = new Map(previous.map((message) => [JSON.stringify(message), message]));
  for (const message of incoming) {
    const key = JSON.stringify(message);
    if (messages.has(key)) continue;
    if (!message || !message.sender?.trim() || !message.text?.trim() || !message.time?.trim()) fail('Mensagem de chamado inválida.', 400);
    if (!isAdmin && message.sender !== actor.name) fail('Não é permitido enviar mensagem em nome de outro perfil.');
    messages.set(key, message);
  }
  return Array.from(messages.values());
}

function mergeAdminTickets(incoming, current, actor) {
  ensureUniqueIds(incoming, 'Chamados');
  const oldById = new Map(current.map((ticket) => [ticket.id, ticket]));
  const next = new Map(current.map((ticket) => [ticket.id, ticket]));
  for (const ticket of incoming) {
    const previous = oldById.get(ticket.id);
    next.set(ticket.id, previous
      ? { ...previous, ...ticket, messages: mergeTicketMessages(previous.messages || [], ticket.messages || [], actor, true) }
      : { ...ticket, messages: mergeTicketMessages([], ticket.messages || [], actor, true) });
  }
  return Array.from(next.values());
}

function mergeTeacherTickets(incoming, current, actor, allowedLabs) {
  ensureUniqueIds(incoming, 'Chamados');
  const oldById = new Map(current.map((ticket) => [ticket.id, ticket]));
  const next = new Map(current.map((ticket) => [ticket.id, ticket]));
  for (const ticket of incoming) {
    const previous = oldById.get(ticket.id);
    if (previous) {
      if (!allowedLabs.has(previous.labId) && previous.requesterProfileId !== actor.id) fail('Este chamado não pertence ao seu laboratório.');
      const { messages: _previousMessages, ...previousCore } = previous;
      const { messages: _incomingMessages, ...incomingCore } = ticket;
      if (!same(previousCore, incomingCore)) fail('Professores só podem acrescentar mensagens aos próprios chamados.');
      next.set(ticket.id, { ...previous, messages: mergeTicketMessages(previous.messages || [], ticket.messages || [], actor, false) });
      continue;
    }
    if (!allowedLabs.has(ticket.labId) || ticket.requesterProfileId !== actor.id || ticket.requester !== actor.name) fail('O chamado precisa estar vinculado ao seu perfil e laboratório.');
    next.set(ticket.id, { ...ticket, messages: mergeTicketMessages([], ticket.messages || [], actor, false) });
  }
  return Array.from(next.values());
}

function mergeDirectMessages(incoming, current, actor, profiles) {
  ensureUniqueIds(incoming, 'Mensagens diretas');
  const oldById = new Map(current.map((message) => [message.id, message]));
  const next = new Map(current.map((message) => [message.id, message]));
  const teacherIds = new Set(profiles.filter((profile) => profile.role === 'user').map((profile) => profile.id));
  for (const message of incoming) {
    if (!message || !message.profileId || !message.senderId || (!message.text?.trim() && !message.attachment?.data)) fail('Mensagem direta inválida.', 400);
    const previous = oldById.get(message.id);
    if (previous) {
      if (!same(previous, message)) fail('Mensagens já enviadas não podem ser alteradas.');
      continue;
    }
    const permitted = actor.role === 'admin'
      ? message.senderId === actor.id && teacherIds.has(message.profileId)
      : message.senderId === actor.id && message.profileId === actor.id;
    if (!permitted) fail('Não é permitido enviar mensagens em nome de outro perfil.');
    if (String(message.text || '').length > 1200 || String(message.attachment?.data || '').length > 6 * 1024 * 1024) fail('A mensagem excede o limite permitido.', 413);
    next.set(message.id, message);
  }
  return Array.from(next.values());
}

function mergeNotifications(incoming, current, actor, context, profiles) {
  const oldById = new Map(current.map((item) => [item.id, item]));
  const next = new Map(current.map((item) => [item.id, item]));
  const adminIds = new Set(profiles.filter((profile) => profile.role === 'admin').map((profile) => profile.id));
  const teacherIds = new Set(profiles.filter((profile) => profile.role === 'user').map((profile) => profile.id));
  const directMessages = new Map(context.directMessages.map((message) => [message.id, message]));
  const tickets = new Map(context.tickets.map((ticket) => [ticket.id, ticket]));
  for (const item of incoming) {
    if (!item?.id || !item.recipientId || !item.type || !item.referenceId || typeof item.read !== 'boolean') fail('Notificação inválida.', 400);
    const previous = oldById.get(item.id);
    if (previous) {
      if (previous.recipientId !== actor.id) {
        if (!same(previous, item)) fail('Não é permitido alterar notificações de outro perfil.');
      } else {
        const { read: _read, ...oldCore } = previous;
        const { read: incomingRead, ...incomingCore } = item;
        if (!same(oldCore, incomingCore) || (previous.read && !incomingRead)) fail('Só é permitido marcar suas notificações como lidas.');
        next.set(item.id, { ...previous, read: incomingRead });
      }
      continue;
    }
    let allowed = false;
    if (actor.role === 'admin') {
      allowed = teacherIds.has(item.recipientId) && (
        (item.type === 'direct-message' && directMessages.get(item.referenceId)?.senderId === actor.id)
        || (item.type === 'ticket-message' && tickets.has(String(item.referenceId).split(':')[0]))
        || (item.type === 'ticket-update' && tickets.has(String(item.referenceId).split(':')[0]))
      );
    } else {
      allowed = adminIds.has(item.recipientId) && (
        (item.type === 'teacher-message' && directMessages.get(item.referenceId)?.senderId === actor.id)
        || (item.type === 'new-ticket' && tickets.get(item.referenceId)?.requesterProfileId === actor.id)
      );
    }
    if (!allowed) fail('Não é permitido criar esta notificação.');
    next.set(item.id, item);
  }
  return Array.from(next.values());
}

function applyStateUpdate(rawIncoming, currentRaw, actor, hashPassword) {
  const incoming = normalizeState(rawIncoming);
  const current = normalizeState(currentRaw);
  if (actor.role === 'admin') {
    const profiles = mergeProfiles(incoming.profiles, current.profiles, actor, hashPassword);
    validateLabs(incoming.labs);
    const labs = incoming.labs;
    const assets = incoming.assets;
    ensureUniqueIds(assets, 'Ativos');
    const tickets = mergeAdminTickets(incoming.tickets, current.tickets, actor);
    const directMessages = mergeDirectMessages(incoming.directMessages, current.directMessages, actor, profiles);
    const notifications = mergeNotifications(incoming.notifications, current.notifications, actor, { directMessages, tickets }, profiles);
    return { profiles, labs, assets, tickets, directMessages, notifications };
  }
  if (actor.role !== 'user') fail('Perfil sem permissão para alterar dados.');
  const allowedLabs = allowedLabsForTeacher(current, actor);
  for (const asset of incoming.assets) if (!allowedLabs.has(asset.labId)) fail('Professores só podem alterar ativos dos próprios laboratórios.');
  ensureUniqueIds(incoming.assets, 'Ativos');
  const keptAssets = current.assets.filter((asset) => !allowedLabs.has(asset.labId));
  const assets = [...keptAssets, ...incoming.assets];
  const tickets = mergeTeacherTickets(incoming.tickets, current.tickets, actor, allowedLabs);
  const profiles = current.profiles;
  const directMessages = mergeDirectMessages(incoming.directMessages, current.directMessages, actor, profiles);
  const notifications = mergeNotifications(incoming.notifications, current.notifications, actor, { directMessages, tickets }, profiles);
  return { ...current, assets, tickets, directMessages, notifications };
}

module.exports = { normalizeState, stateForActor, applyStateUpdate, validateLabs };
