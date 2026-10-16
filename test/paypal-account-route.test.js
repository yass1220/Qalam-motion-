import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

test('admin endpoint authenticates, protects credentials and only reads existing orders', async t => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qalam-paypal-route-'));
  const callsFile = path.join(directory, 'calls.jsonl');
  const ordersFile = path.join(directory, 'orders.json');
  const orders = [{ id: 'local-order-one', paypalOrderId: '4TST1234567890001', createdAt: '2026-10-16T12:00:00Z', status: 'AWAITING_PAYMENT' }];
  await fs.writeFile(ordersFile, JSON.stringify(orders));
  await fs.writeFile(callsFile, '');
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => resolve(value)); });
  });
  const child = spawn(process.execPath, ['--import', './test/fixtures/paypal-read-only.mjs', 'server.js'], {
    cwd,
    env: {
      ...process.env, PORT: String(port), NODE_ENV: 'test', DATABASE_URL: '', DATA_DIR: directory,
      ADMIN_TOKEN: 'local-only-admin-token', PAYPAL_MODE: 'live',
      PAYPAL_CLIENT_ID: 'local-only-client-id', PAYPAL_CLIENT_SECRET: 'local-only-client-secret',
      PAYPAL_WEBHOOK_ID: 'local-only-ready-webhook', PUBLIC_BASE_URL: 'http://127.0.0.1:' + port,
      PAYPAL_TEST_CALLS: callsFile, RESEND_API_KEY: '', EMAIL_FROM: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await stopped;
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + port;
  let started = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + '/health')).ok) { started = true; break; }
    } catch {}
    if (child.exitCode !== null) break;
    await delay(25);
  }
  assert.ok(started, 'Server should start: ' + output);

  const denied = await fetch(base + '/api/admin/paypal-account');
  assert.equal(denied.status, 401);
  assert.equal(await fs.readFile(callsFile, 'utf8'), '');
  const invalid = await fetch(base + '/api/admin/paypal-account', { headers: { Authorization: 'Bearer invalid-token' } });
  assert.equal(invalid.status, 401);
  assert.equal(await fs.readFile(callsFile, 'utf8'), '');

  const response = await fetch(base + '/api/admin/paypal-account', { headers: { Authorization: 'Bearer local-only-admin-token' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.email, 'merchant@example.invalid');
  assert.equal(body.mode, 'live');
  for (const privateValue of ['local-only-admin-token', 'local-only-client-id', 'local-only-client-secret', 'local-only-test-access-token', 'customer@example.invalid', 'local-order-one']) {
    assert.ok(!JSON.stringify(body).includes(privateValue));
  }
  const calls = (await fs.readFile(callsFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls, [
    { method: 'POST', path: '/v1/oauth2/token' },
    { method: 'GET', path: '/v2/checkout/orders/4TST1234567890001' }
  ]);
  assert.equal(await fs.readFile(ordersFile, 'utf8'), JSON.stringify(orders));
});
