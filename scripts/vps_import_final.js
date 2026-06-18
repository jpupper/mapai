const http = require('http');
const fs = require('fs');

function request(hostname, port, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, port, path, method,
      headers: {}
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
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
  // Step 1: Login to get token
  console.log('=== Step 1: Login ===');
  const login = await request('localhost', 4560, 'POST', '/api/auth/login',
    JSON.stringify({ username: 'ADMIN', password: 'rty456fgh' })
  );
  if (login.status !== 200) {
    console.log('Login failed:', login.status, login.body);
    return;
  }
  const loginData = JSON.parse(login.body);
  const token = loginData.token;
  console.log('Token obtained, length:', token.length);
  console.log('User:', JSON.stringify(loginData.user));
  
  // Step 2: Create project (it may already exist)
  console.log('\n=== Step 2: Create project ===');
  const createProj = await request('localhost', 4560, 'POST', '/api/projects',
    JSON.stringify({
      id: 'mapa-de-herramientas-conceptual-para-aprender-ch',
      name: 'Tonos del Chino Mandar\u00edn',
      description: 'Mapa conceptual de los 5 tonos del chino mandar\u00edn'
    }),
    token
  );
  console.log('Status:', createProj.status);
  console.log('Body:', createProj.body.substring(0, 200));
  
  // If it says already exists, that's OK - proceed with import
  const projectExists = createProj.status === 200 || createProj.body.includes('Ya existe');
  if (!projectExists && createProj.status !== 200) {
    console.log('Project creation failed, aborting');
    return;
  }
  
  // Step 3: Import data
  console.log('\n=== Step 3: Import data ===');
  const importData = JSON.parse(fs.readFileSync('/root/diploia/chinese_tones_import.json', 'utf8'));
  const importBody = JSON.stringify(importData);
  console.log('Data size:', (importBody.length / 1024).toFixed(1), 'KB');
  
  const imp = await request('localhost', 4560, 'POST', '/api/import?project=mapa-de-herramientas-conceptual-para-aprender-ch',
    importBody, token
  );
  console.log('Import status:', imp.status);
  console.log('Import response:', imp.body.substring(0, 300));
  
  if (imp.status !== 200) {
    console.log('Import failed!');
    return;
  }
  
  // Step 4: Verify
  console.log('\n=== Step 4: Verify ===');
  const verify = await request('localhost', 4560, 'GET',
    '/api/nodes?project=mapa-de-herramientas-conceptual-para-aprender-ch', null, token
  );
  if (verify.status === 200) {
    const d = JSON.parse(verify.body);
    console.log('Total nodes:', d.totalNodes);
    console.log('Categories:', JSON.stringify(d.categories));
    console.log('Root label:', d.nodes?.root?.label);
    console.log('Category children keys:', Object.keys(d.categoryChildren || {}));
  } else {
    console.log('Verify status:', verify.status, 'Body:', verify.body.substring(0, 200));
  }
  
  console.log('\n=== DONE ===');
}

main().catch(e => console.error('Error:', e.message));
