const http = require('http');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const env = fs.readFileSync('/root/diploia/.env', 'utf8');
const match = env.match(/^JWT_SECRET=(.*)/m);
const secret = match ? match[1].trim() : 'dev-secret';
console.log('Secret length:', secret.length);

const token = jwt.sign({ username: 'ADMIN', role: 'admin' }, secret, { expiresIn: '30d' });
console.log('Token length:', token.length);

const importData = JSON.parse(fs.readFileSync('/root/diploia/chinese_tones_import.json', 'utf8'));

function httpReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 4560,
      path: path, method: method,
      headers: { 'Authorization': 'Bearer ' + token }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Create project
  console.log('--- Creating project ---');
  const projectBody = JSON.stringify({
    id: 'mapa-de-herramientas-conceptual-para-aprender-ch',
    name: 'Tonos del Chino Mandarin',
    description: 'Mapa conceptual de los 5 tonos del chino mandarin'
  });
  const r1 = await httpReq('POST', '/api/projects', projectBody);
  console.log('Status:', r1.status, 'Body:', r1.body);

  // Step 2: Import data
  console.log('\n--- Importing data ---');
  const importBody = JSON.stringify(importData);
  console.log('Data size:', (importBody.length / 1024).toFixed(1), 'KB');
  const r2 = await httpReq('POST', '/api/import?project=mapa-de-herramientas-conceptual-para-aprender-ch', importBody);
  console.log('Status:', r2.status, 'Body:', r2.body);

  // Step 3: Verify
  console.log('\n--- Verifying ---');
  const r3 = await httpReq('GET', '/api/nodes?project=mapa-de-herramientas-conceptual-para-aprender-ch');
  if (r3.status === 200) {
    const d = JSON.parse(r3.body);
    console.log('Total nodes:', d.totalNodes);
    console.log('Categories:', JSON.stringify(d.categories));
    console.log('Root label:', d.nodes?.root?.label);
  } else {
    console.log('Status:', r3.status, 'Body:', r3.body.substring(0, 200));
  }
  console.log('\nDone!');
}

main().catch(e => console.error('Error:', e));
