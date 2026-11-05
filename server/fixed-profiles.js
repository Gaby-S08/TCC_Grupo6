'use strict';

const PROFILE_DEFINITIONS = Object.freeze([
  { id: 'prof-rafael', name: 'Professor Rafael Conceição', email: 'rafael.conceicao@gmail.com', role: 'user', dept: 'Informática', labId: 'lab-166', room: '166' },
  { id: 'prof-lucas', name: 'Professor Lucas Oliveira', email: 'lucas.Oliveira@gmail.com', role: 'user', dept: 'Informática', labId: 'lab-221', room: '221' },
  { id: 'prof-maria', name: 'Professora Maria JUlia', email: 'maria.ju@gmail.com', role: 'user', dept: 'Informática', labId: 'lab-094', room: '094' },
  { id: 'prof-luana', name: 'Professora Luana Silva', email: 'Luana.silva@gmail.com', role: 'user', dept: 'Informática', labId: 'lab-265', room: '265' },
  { id: 'admin-guilherme', name: 'Administrador Guilherme dos Santos', email: 'guilherme.santos@gmail.com', role: 'admin' }
]);

const LAB_DEFINITIONS = Object.freeze([
  { id: 'lab-166', dept: 'Informática', name: 'Laboratório de Informática', room: '166', profileId: 'prof-rafael' },
  { id: 'lab-221', dept: 'Informática', name: 'Laboratório de Informática', room: '221', profileId: 'prof-lucas' },
  { id: 'lab-094', dept: 'Informática', name: 'Laboratório de Informática', room: '094', profileId: 'prof-maria' },
  { id: 'lab-265', dept: 'Informática', name: 'Laboratório de Informática', room: '265', profileId: 'prof-luana' }
]);

const PASSWORDS_ENV = 'EQUIPVIRTUAL_FIXED_PROFILE_PASSWORDS_JSON';

function parseFixedProfilePasswords(raw = process.env[PASSWORDS_ENV]) {
  if (!raw) return null;
  let passwords;
  try { passwords = JSON.parse(raw); }
  catch (_error) { throw new Error('O segredo das senhas iniciais dos perfis não contém JSON válido.'); }
  if (!passwords || typeof passwords !== 'object' || Array.isArray(passwords)) {
    throw new Error('O segredo das senhas iniciais dos perfis tem formato inválido.');
  }
  const ids = PROFILE_DEFINITIONS.map((profile) => profile.id);
  if (Object.keys(passwords).length !== ids.length || ids.some((id) => typeof passwords[id] !== 'string' || passwords[id].length < 6 || passwords[id].length > 256)) {
    throw new Error('O segredo deve conter uma senha válida para cada um dos cinco perfis iniciais.');
  }
  return Object.fromEntries(ids.map((id) => [id, passwords[id]]));
}

function applyFixedProfileData(profiles, labs, passwords, hashPassword) {
  if (!passwords || typeof hashPassword !== 'function') throw new Error('Senhas protegidas e função de hash são obrigatórias.');
  const foundProfiles = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const definition of PROFILE_DEFINITIONS) {
    const existing = foundProfiles.get(definition.id);
    if (!existing || existing.role !== definition.role) throw new Error(`O perfil fixo ${definition.id} não existe ou tem uma função incompatível.`);
  }
  const nextProfiles = profiles.map((profile) => {
    const definition = PROFILE_DEFINITIONS.find((item) => item.id === profile.id);
    if (!definition) return profile;
    return { ...profile, ...definition, password: hashPassword(passwords[definition.id]) };
  });
  const foundLabs = new Map(labs.map((lab) => [lab.id, lab]));
  for (const definition of LAB_DEFINITIONS) {
    if (!foundLabs.has(definition.id)) throw new Error(`O laboratório fixo ${definition.id} não existe.`);
  }
  const nextLabs = labs.map((lab) => {
    const definition = LAB_DEFINITIONS.find((item) => item.id === lab.id);
    return definition ? { ...lab, ...definition } : lab;
  });
  return { profiles: nextProfiles, labs: nextLabs };
}

module.exports = { PROFILE_DEFINITIONS, LAB_DEFINITIONS, PASSWORDS_ENV, parseFixedProfilePasswords, applyFixedProfileData };
