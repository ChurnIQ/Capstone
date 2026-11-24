/**
 * basicAuth.test.js – Basic Auth on the real /api router (no database needed:
 * we call endpoints that don't touch MongoDB).
 * Run: node --test basicAuth.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');

process.env.BASIC_AUTH_USER = 'tester';
process.env.BASIC_AUTH_PASS = 'S3cret!pass:with:colons';

const apiRoutes = require('./routes/api');
const { parseBasicHeader } = require('./middleware/basicAuth');

const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

function start({ sessionUser } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = () => !!sessionUser;
    req.user = sessionUser;
    next();
  });
  app.use('/api', apiRoutes);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ port, path, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

test('valid credentials → 200', async () => {
  const { server, port } = await start();
  const r = await get(port, '/api/analytics/feature-importance', { Authorization: basic('tester', process.env.BASIC_AUTH_PASS) });
  server.close();
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(JSON.parse(r.body)));
});

test('missing credentials → 401 JSON', async () => {
  const { server, port } = await start();
  const r = await get(port, '/api/analytics/feature-importance');
  server.close();
  assert.strictEqual(r.status, 401);
  assert.strictEqual(JSON.parse(r.body).error, 'Unauthorized');
});

test('wrong password → 401 with WWW-Authenticate', async () => {
  const { server, port } = await start();
  const r = await get(port, '/api/analytics/feature-importance', { Authorization: basic('tester', 'nope') });
  server.close();
  assert.strictEqual(r.status, 401);
  assert.match(r.headers['www-authenticate'], /^Basic realm=/);
});

test('wrong username → 401', async () => {
  const { server, port } = await start();
  const r = await get(port, '/api/stats', { Authorization: basic('hacker', process.env.BASIC_AUTH_PASS) });
  server.close();
  assert.strictEqual(r.status, 401);
});

test('malformed / non-Basic header → 401', async () => {
  const { server, port } = await start();
  const a = await get(port, '/api/stats', { Authorization: 'Bearer abc' });
  const b = await get(port, '/api/stats', { Authorization: 'Basic !!!notbase64' });
  server.close();
  assert.strictEqual(a.status, 401);
  assert.strictEqual(b.status, 401);
});

test('password containing colons is parsed correctly', () => {
  assert.deepStrictEqual(parseBasicHeader(basic('u', 'a:b:c')), { user: 'u', pass: 'a:b:c' });
});

test('logged-in dashboard session (no header) still allowed', async () => {
  const { server, port } = await start({ sessionUser: { name: 'Srishti', email: 's@x.com' } });
  const r = await get(port, '/api/me');
  server.close();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(JSON.parse(r.body).name, 'Srishti');
});

test('wrong Basic header is rejected even with a session', async () => {
  const { server, port } = await start({ sessionUser: { name: 'Srishti' } });
  const r = await get(port, '/api/me', { Authorization: basic('tester', 'wrong') });
  server.close();
  assert.strictEqual(r.status, 401);
});

test('/api/me with Basic Auth returns the API user', async () => {
  const { server, port } = await start();
  const r = await get(port, '/api/me', { Authorization: basic('tester', process.env.BASIC_AUTH_PASS) });
  server.close();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(JSON.parse(r.body).name, 'tester');
});

test('fails closed when server has no Basic credentials configured', async () => {
  const u = process.env.BASIC_AUTH_USER, p = process.env.BASIC_AUTH_PASS;
  delete process.env.BASIC_AUTH_USER; delete process.env.BASIC_AUTH_PASS;
  const { server, port } = await start();
  const r = await get(port, '/api/stats', { Authorization: basic('', '') });
  server.close();
  process.env.BASIC_AUTH_USER = u; process.env.BASIC_AUTH_PASS = p;
  assert.strictEqual(r.status, 401);
});
