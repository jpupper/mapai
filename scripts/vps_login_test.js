const http = require('http');

// Try to login via the API - FSCAUTH is running on port 3027
// But the server's auth.login tries fscauth first, so we need to login through fscauth

function request(hostname, port, method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, port, path, method,
      headers: {}
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
  // Option 1: Login to fscauth directly (port 3027)
  console.log('=== Option 1: Login to FSCAuth ===');
  const r1 = await request('localhost', 3027, 'POST', '/fscauth/api/auth/login',
    JSON.stringify({ email: 'ADMIN', password: 'rty456fgh' })
  );
  console.log('Status:', r1.status);
  console.log('Body:', r1.body);

  // Option 2: Try creating a bare JWT with known secret and test it directly
  // by modifying server.js... no, that's too invasive
  
  // Option 3: Login to the diploia server auth which delegates to fscauth
  console.log('\n=== Option 2: Login via diploia API ===');
  const r2 = await request('localhost', 4560, 'POST', '/api/auth/login',
    JSON.stringify({ username: 'ADMIN', password: 'rty456fgh' })
  );
  console.log('Status:', r2.status);
  console.log('Body:', r2.body.substring(0, 300));
  
  // Try with email field
  console.log('\n=== Option 3: Login via diploia API (email field) ===');
  const r3 = await request('localhost', 4560, 'POST', '/api/auth/login',
    JSON.stringify({ email: 'ADMIN', password: 'rty456fgh' })
  );
  console.log('Status:', r3.status);
  console.log('Body:', r3.body.substring(0, 300));
}

main().catch(e => console.error('Error:', e.message));
