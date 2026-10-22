import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('HTTP boundary validates media types, JSON, size, origin and private routes', async t => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), QLOO_API_KEY: '', QLOO_BASE_URL: 'https://hackathon.api.qloo.com' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { server.kill(); await once(server, 'exit'); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start')), 5000);
    server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    server.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const base = `http://127.0.0.1:${port}`;
  for (const path of ['/.env.local', '/server/qloo.mjs', '/..%2f.env.local']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  const post = (body, headers = {}) => fetch(base + '/api/negotiate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
  });
  assert.equal((await post('{}', { 'Content-Type': 'application/jsonp' })).status, 415);
  assert.equal((await post('{', { 'Content-Type': 'Application/JSON; charset=utf-8' })).status, 400);
  assert.equal((await post(JSON.stringify({ padding: 'x'.repeat(20000) }))).status, 413);
  assert.equal((await post('{}', { Origin: 'https://example.com' })).status, 403);
  assert.equal((await post('{}')).status, 400);
  assert.equal((await fetch(base + '/api/status')).status, 200);
});
