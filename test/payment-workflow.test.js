import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

test('checkout pins server pricing and mode, admin changes require authorization, and only verified matching captures count as paid', async t => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qalam-payment-local-'));
  const callsFile = path.join(directory, 'calls.jsonl');
  const controlFile = path.join(directory, 'control.json');
  await fs.writeFile(callsFile, '');
  await fs.writeFile(controlFile, JSON.stringify({ captureAmount: '14.00' }));
  await fs.writeFile(path.join(directory, 'orders.json'), JSON.stringify([{
    id: 'legacy-sandbox', paypalOrderId: 'SANDBOXLOCAL000001', paymentMode: 'sandbox',
    email: 'local@customer.test', amount: '29.00', status: 'AWAITING_PAYMENT'
  }]));
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
  const child = spawn(process.execPath, ['--import','./test/fixtures/payment-workflow.mjs','server.js'], {
    cwd,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DATABASE_URL: '', RAILWAY_ENVIRONMENT: '', DATA_DIR: directory,
      PAYPAL_MODE: 'live', PAYPAL_CLIENT_ID: 'local-client', PAYPAL_CLIENT_SECRET: 'local-secret', PAYPAL_WEBHOOK_ID: 'local-webhook',
      PUBLIC_BASE_URL: 'http://127.0.0.1:' + port, ADMIN_TOKEN: 'local-admin',
      PAYPAL_TEST_CALLS: callsFile, PAYPAL_TEST_CONTROL: controlFile,
      RESEND_API_KEY: 'local-only-key', EMAIL_FROM: 'Qalam <sender@local.test>', ADMIN_EMAIL: 'owner@local.test' },
    stdio: ['ignore','pipe','pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit',resolve)); child.kill(); await stopped; }
    await fs.rm(directory, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + port;
  let started = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/health')).ok) { started = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await delay(25);
  }
  assert.ok(started, output);
  const send = (route, body, token, method = 'POST') => fetch(base + route, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  assert.equal((await send('/api/orders/legacy-sandbox/capture', {})).status, 409);
  assert.equal(await fs.readFile(callsFile, 'utf8'), '', 'wrong environment must not contact or capture PayPal');
  assert.equal((await fetch(base + '/api/admin/notifications')).status, 401);
  const created = await send('/api/orders', { packageId: 'short', name: 'Local customer', email: 'customer@local.test',
    brief: 'Local fixture only, never sent externally.', amount: '0.01', paymentMode: 'sandbox', internalTest: true });
  assert.equal(created.status, 200);
  const order = await created.json();
  const adminList = await fetch(base + '/api/admin/orders', { headers: { Authorization: 'Bearer local-admin' } });
  const stored = (await adminList.json()).find(item => item.id === order.orderId);
  assert.equal(stored.amount, '15.00');
  assert.equal(stored.paymentMode, 'live');
  assert.equal(stored.internalTest, false);
  assert.equal((await send('/api/admin/orders/' + order.orderId, { internalTest: true }, null, 'PATCH')).status, 401);
  assert.equal((await send('/api/admin/orders/' + order.orderId, { internalTest: 'true' }, 'local-admin', 'PATCH')).status, 400);
  let updated = await send('/api/admin/orders/' + order.orderId, { internalTest: true, fulfillmentStatus: 'CANCELLED' }, 'local-admin', 'PATCH');
  assert.equal((await updated.json()).internalTest, true);
  updated = await send('/api/admin/orders/' + order.orderId, { internalTest: false, fulfillmentStatus: 'NEW' }, 'local-admin', 'PATCH');
  assert.equal((await updated.json()).internalTest, false);
  assert.equal((await send('/api/orders/' + order.orderId + '/capture', {})).status, 409, 'wrong captured amount rejected');
  let status = await send('/api/orders/status', { orderId: order.orderId, email: 'customer@local.test' });
  assert.equal((await status.json()).status, 'AWAITING_PAYMENT');
  await fs.writeFile(controlFile, '{}');
  const paid = await send('/api/orders/' + order.orderId + '/capture', {});
  assert.equal((await paid.json()).status, 'PAID');
  const beforeReplay = await fs.readFile(callsFile, 'utf8');
  const replay = await send('/api/orders/' + order.orderId + '/capture', {});
  assert.equal((await replay.json()).status, 'PAID');
  assert.equal(await fs.readFile(callsFile, 'utf8'), beforeReplay, 'paid order must never be captured or notified twice');
  const calls = beforeReplay.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.filter(call => call.origin === 'https://api.resend.com').length, 2);
  const creation = calls.find(call => call.path === '/v2/checkout/orders' && call.method === 'POST');
  assert.equal(creation.body.purchase_units[0].amount.value, '15.00');
  assert.equal((await send('/api/orders/status', { orderId: order.orderId, email: 'wrong@local.test' })).status, 404);
  status = await send('/api/orders/status', { orderId: order.orderId, email: 'customer@local.test' });
  const publicStatus = await status.json();
  assert.equal(status.headers.get('cache-control'), 'no-store');
  for (const key of ['internalTest','adminNotes','email','name','paypalOrderId','captureId']) assert.equal(publicStatus[key], undefined);

  const callsBeforeEnquiry = await fs.readFile(callsFile, 'utf8');
  const idea = { requestId: randomUUID(), packageId: 'short', name: 'Local enquiry', email: 'lead@local.test', contact: '',
    brief: 'An idea to review before any payment is requested.', amount: '0.01', paymentMode: 'live', internalTest: true };
  assert.equal((await send('/api/enquiries', { ...idea, email: 'invalid' })).status, 400);
  const enquiry = await send('/api/enquiries', idea);
  assert.equal(enquiry.status, 200);
  assert.equal(enquiry.headers.get('cache-control'), 'no-store');
  const enquiryResult = await enquiry.json();
  assert.deepEqual(enquiryResult, { enquiryId: idea.requestId, status: 'ENQUIRY' });
  assert.equal((await send('/api/enquiries', idea)).status, 200);
  assert.equal((await send('/api/enquiries', { ...idea, brief: 'Changed details for the same request.' })).status, 409);
  assert.equal((await send('/api/enquiries', { ...idea, requestId: randomUUID(), website: 'bot-filled-field' })).status, 400);
  assert.equal((await send('/api/orders/' + idea.requestId + '/capture', {})).status, 409);
  assert.equal(await fs.readFile(callsFile, 'utf8'), callsBeforeEnquiry, 'enquiry must never call PayPal or email a customer');
  const records = JSON.parse(await fs.readFile(path.join(directory, 'orders.json'), 'utf8'));
  const savedEnquiry = records.find(item => item.id === idea.requestId);
  assert.equal(savedEnquiry.status, 'ENQUIRY');
  assert.equal(savedEnquiry.paymentMode, 'unknown');
  assert.equal(savedEnquiry.amount, '15.00');
  assert.equal(savedEnquiry.internalTest, false);
  assert.equal(records.filter(item => item.id === idea.requestId).length, 1);
  assert.equal((await send('/api/enquiries', { ...idea, requestId: randomUUID() })).status, 429, 'public enquiry rate limit applies');
});
