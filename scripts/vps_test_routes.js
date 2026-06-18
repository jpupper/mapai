require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const secret = process.env.JWT_SECRET;
const token = jwt.sign({ username: 'ADMIN', role: 'admin' }, secret, { expiresIn: '30d' });
console.log('Token: ' + token.substring(0, 40) + '...');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 4560,
      path: path,
      method: method,
      headers: { 'Authorization': 'Bearer ' + token }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Test 1: auth/me (requireAuth)
  const r1 = await request('GET', '/api/auth/me');
  console.log('\n1. /api/auth/me -> ' + r1.status + ': ' + r1.body.substring(0, 100));

  // Test 2: nodes diplomatura (requireProjectReadAccess - should work even without auth)
  const r2 = await request('GET', '/api/nodes?project=diplomatura');
  console.log('2. /api/nodes -> ' + r2.status + ': nodes=' + (r2.status === 200 ? JSON.parse(r2.body).totalNodes : r2.body.substring(0, 100)));

  // Test 3: protecte project read (non-existent project)
  const r3 = await request('GET', '/api/nodes?project=test-project-xyz');
  console.log('3. /api/nodes?project=test-project-xyz -> ' + r3.status + ': ' + r3.body.substring(0, 100));

  // Test 4: Create a new project (requireAuth)
  const r4 = await request('POST', '/api/projects', JSON.stringify({
    id: 'test-import-tones',
    name: 'Test Project',
    description: 'Test'
  }));
  console.log('4. POST /api/projects -> ' + r4.status + ': ' + r4.body.substring(0, 100));
  
  // If project was created or already exists, try import
  if (r4.status === 200 || r4.body.includes('ya existe')) {
    console.log('   Project exists/created, proceeding...');
  }

  // Test 5: Try the mapai-prefixed routes
  const r5 = await request('GET', '/mapai/api/health');
  console.log('5. /mapai/api/health -> ' + r5.status + ': ' + r5.body.substring(0, 100));
}

main().catch(e => console.error('Error:', e.message));
