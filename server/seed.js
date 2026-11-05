'use strict';

const crypto = require('crypto');
const { PROFILE_DEFINITIONS, LAB_DEFINITIONS, parseFixedProfilePasswords } = require('./fixed-profiles');

const fixedPasswords = parseFixedProfilePasswords();
const seed = {
  profiles: PROFILE_DEFINITIONS.map((profile) => ({
    ...profile,
    password: fixedPasswords?.[profile.id]
      || (profile.role === 'admin' ? process.env.INITIAL_ADMIN_PASSWORD || '' : crypto.randomBytes(32).toString('base64url'))
  })),
  labs: LAB_DEFINITIONS,
  assets: [
    { id: 'a166-001', code: 'INF-166-001', labId: 'lab-166', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a221-001', code: 'INF-221-001', labId: 'lab-221', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a094-001', code: 'INF-094-001', labId: 'lab-094', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 },
    { id: 'a265-001', code: 'INF-265-001', labId: 'lab-265', name: 'Computador de bancada', desc: 'Estação de trabalho para aulas de informática.', qty: 10 }
  ],
  tickets: [],
  directMessages: [],
  notifications: []
};

module.exports = seed;
