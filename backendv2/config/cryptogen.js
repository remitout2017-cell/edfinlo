// scripts/gen-key.js
const crypto = require('crypto');

const key = crypto.randomBytes(32);          // 32 bytes = 256 bits
console.log('ENCRYPTION_KEY (hex):', key.toString('hex'));
console.log('Length (hex chars):', key.toString('hex').length);
