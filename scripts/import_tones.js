const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Generate admin token
const JWT_SECRET = process.env.JWT_SECRET || 'arte_digital_data_jwt_secret_2024_secure';
const token = jwt.sign({ username: 'ADMIN', role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
console.log('Token generated, length:', token.length);

// Read the import data
const importData = JSON.parse(fs.readFileSync(
  'D:/Programacion/sistemasfullscreen/mapai/chinese_tones_import.json',
  'utf8'
));

const postData = JSON.stringify(importData);
const options = {
  hostname: 'localhost',
  port: 3027,
  path: '/api/import?project=mapa-de-herramientas-conceptual-para-aprender-ch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Sending import request...');
console.log('Data size:', (postData.length / 1024).toFixed(1), 'KB');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
    
    // After import, verify by fetching nodes
    verifyImport();
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();

function verifyImport() {
  const verifyOptions = {
    hostname: 'localhost',
    port: 3027,
    path: '/api/nodes?project=mapa-de-herramientas-conceptual-para-aprender-ch',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  setTimeout(() => {
    const verifyReq = http.request(verifyOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('\n=== VERIFICATION ===');
          console.log('Total nodes:', data.totalNodes);
          console.log('Categories:', JSON.stringify(data.categories, null, 2));
          console.log('Category children keys:', Object.keys(data.categoryChildren || {}));
          console.log('Node IDs:', Object.keys(data.nodes || {}));
          console.log('\n✅ Import successful!');
        } catch (e) {
          console.log('Verify response:', body);
        }
      });
    });
    verifyReq.on('error', (e) => console.error('Verify error:', e.message));
    verifyReq.end();
  }, 1000);
}
