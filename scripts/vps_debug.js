const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');

// Read .env directly
const env = fs.readFileSync('/root/diploia/.env', 'utf8');
const lines = env.split('\n');
let secret = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('JWT_SECRET=')) {
    secret = trimmed.substring(11).trim();
    break;
  }
}
console.log('SECRET_LEN: ' + secret.length);
console.log('SECRET_VAL: ' + secret);

// Generate token
const token = jwt.sign({ username: 'ADMIN', role: 'admin' }, secret, { expiresIn: '30d' });
console.log('TOKEN_LEN: ' + token.length);

// Test against auth/me
const req = http.get('http://localhost:4560/api/auth/me', {
  headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('AUTH_STATUS: ' + res.statusCode);
    console.log('AUTH_RESP: ' + data);
  });
});
req.on('error', e => console.log('ERROR: ' + e.message));
