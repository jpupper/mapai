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
  // Step 1: Login
  console.log('=== Step 1: Login ===');
  const login = await request('localhost', 4560, 'POST', '/api/auth/login',
    JSON.stringify({ username: 'ADMIN', password: 'rty456fgh' })
  );
  if (login.status !== 200) {
    console.log('Login failed:', login.status, login.body);
    return;
  }
  const token = JSON.parse(login.body).token;
  console.log('Token obtained, length:', token.length);

  // Step 2: Delete project if exists (to clear all data)
  console.log('\n=== Step 2: Delete existing project ===');
  const del = await request('localhost', 4560, 'DELETE', '/api/projects/mapa-de-herramientas-conceptual-para-aprender-ch', null, token);
  console.log('Delete status:', del.status, 'Body:', del.body.substring(0, 100));

  // Step 3: Create project fresh
  console.log('\n=== Step 3: Create project ===');
  const create = await request('localhost', 4560, 'POST', '/api/projects',
    JSON.stringify({
      id: 'mapa-de-herramientas-conceptual-para-aprender-ch',
      name: 'Chino Mandar\u00edn - Pinyin',
      description: 'Mapa conceptual completo del curso de chino mandar\u00edn. 15 categor\u00edas: tonos, fon\u00e9tica, gram\u00e1tica, vocabulario y m\u00e1s.'
    }), token
  );
  console.log('Create status:', create.status, 'Body:', create.body.substring(0, 100));

  // Step 4: Import data  
  console.log('\n=== Step 4: Import data ===');
  const importData = JSON.parse(fs.readFileSync('/root/diploia/chinese_full_import.json', 'utf8'));
  const importBody = JSON.stringify(importData);
  console.log('Data size:', (importBody.length / 1024 / 1024).toFixed(2), 'MB');
  
  const imp = await request('localhost', 4560, 'POST', '/api/import?project=mapa-de-herramientas-conceptual-para-aprender-ch',
    importBody, token
  );
  console.log('Import status:', imp.status);
  console.log('Import response:', imp.body.substring(0, 200));

  if (imp.status !== 200) {
    console.log('Import failed!');
    return;
  }

  // Step 5: Verify
  console.log('\n=== Step 5: Verify ===');
  const verify = await request('localhost', 4560, 'GET',
    '/api/nodes?project=mapa-de-herramientas-conceptual-para-aprender-ch', null, token
  );
  if (verify.status === 200) {
    const d = JSON.parse(verify.body);
    console.log('Total nodes:', d.totalNodes);
    console.log('Categories:', d.categories.length);
  } else {
    console.log('Verify status:', verify.status);
  }
  
  console.log('\n=== DONE ===');
}

main().catch(e => console.error('Error:', e.message));
