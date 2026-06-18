require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const secret = process.env.JWT_SECRET;
console.log('Secret from dotenv: ' + secret);
console.log('Secret length: ' + secret.length);

// Generate token EXACTLY like the server does
const token = jwt.sign({ username: 'ADMIN', role: 'admin' }, secret, { expiresIn: '30d' });
console.log('Token: ' + token);

// Decode it and verify on our side
const decoded = jwt.verify(token, secret);
console.log('Decoded (self): ' + JSON.stringify(decoded));

// Now test against the server
const req = http.get('http://localhost:4560/api/auth/me', {
  headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Server status: ' + res.statusCode);
    console.log('Server response: ' + data);
    
    // Also try with a GET /api/nodes?project=diplomatura with read access
    const req2 = http.get('http://localhost:4560/api/nodes?project=diplomatura', {
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res2) => {
      let data2 = '';
      res2.on('data', c => data2 += c);
      res2.on('end', () => {
        console.log('Nodes status: ' + res2.statusCode);
        console.log('Nodes response (first 200): ' + data2.substring(0, 200));
      });
    });
    req2.on('error', e => console.log('Nodes error: ' + e.message));
  });
});
req.on('error', e => console.log('Auth error: ' + e.message));
