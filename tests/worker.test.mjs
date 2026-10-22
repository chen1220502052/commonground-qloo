import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerHandler } from '../server/worker-handler.mjs';
import { QlooClient, AppError } from '../server/qloo.mjs';
test('hosted worker serves the app and enforces the same request boundary without exposing secrets', async () => {
  const handle = createWorkerHandler({ assets: { '/': { body: 'CommonGround', type: 'text/html' } }, QlooClient, AppError });
  const env = { QLOO_API_KEY: 'test-secret' };
  const request = (path, init) => handle(new Request('https://example.com' + path, init), env);
  assert.equal(await (await request('/')).text(), 'CommonGround');
  assert.equal((await request('/.env.local')).status, 404);
  assert.equal((await request('/server/qloo.mjs')).status, 404);
  assert.equal((await request('/api/negotiate', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.equal((await request('/api/negotiate', { method: 'POST', headers: { 'Content-Type': 'application/jsonp' }, body: '{}' })).status, 415);
  assert.equal((await request('/api/negotiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(17000) })).status, 413);
  const invalid = await request('/api/negotiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalid.status, 400); assert.ok(!(await invalid.text()).includes('test-secret'));
  const status = await (await request('/api/status')).json();
  assert.deepEqual(status, { qlooConfigured: true, modelConnected: false });
});
