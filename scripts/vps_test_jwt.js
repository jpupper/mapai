require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const secret = process.env.JWT_SECRET;
console.log('SECRET: ' + secret + ' (' + secret.length + ' chars)');

// Generate token exactly like server signToken()
const payload = { username: 'ADMIN', role: 'admin' };
const token = jwt.sign(payload, secret, { expiresIn: '30d' });
console.log('TOKEN: ' + token);

// Verify it like server resolveAuthUser()
try {
  const decoded = jwt.verify(token, secret);
  console.log('VERIFY OK: ' + JSON.stringify(decoded));
  
  if (decoded?.username && decoded?.role) {
    const role = String(decoded.role).trim().toLowerCase();
    const user = { username: String(decoded.username).trim().toUpperCase(), role: role === 'admin' ? 'admin' : 'user' };
    console.log('USER OK: ' + JSON.stringify(user));
  } else {
    console.log('MISSING username/role in payload!');
  }
} catch (e) {
  console.log('VERIFY FAILED: ' + e.message);
}

// Now try to send it
const postData = JSON.stringify({ username: 'ADMIN', role: 'admin' });
const req = http.request({
  hostname: 'localhost', port: 4560,
  path: '/api/auth/me',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('SERVER STATUS: ' + res.statusCode);
    console.log('SERVER RESP: ' + data);
  });
});
req.on('error', e => console.log('REQ ERROR: ' + e.message));
req.end();
