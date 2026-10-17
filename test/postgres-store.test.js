import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../postgres-store.js';
import { processEmailOutbox } from '../email-outbox.js';

function adapter(db) {
  return { query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
}
function order(id, paymentMode = 'live') {
  return { id, paypalOrderId: `paypal-${id}`, packageId: 'short', amount: '15.00', currency: 'USD',
    name: 'Local test customer', email: 'customer@local.test', brief: 'Local test only; no email or payment is sent.',
    contact: '', status: 'AWAITING_PAYMENT', paymentMode, createdAt: new Date().toISOString() };
}
function capture(id) { return { id, status: 'COMPLETED', amount: { value: '15.00', currency_code: 'USD' } }; }
const messages = () => ['admin','customer'].map(kind => ({ kind, payload: { from: 'sender@local.test', to: `${kind}@local.test`, subject: 'LOCAL TEST', text: 'Do not send externally' } }));

async function database(t) {
  const db = new PGlite();
  const pool = adapter(db);
  const store = createPostgresStore({ pool });
  await store.init();
  t.after(() => db.close());
  return { db, pool, store };
}

test('migrations preserve legacy orders, prices and payment records without inventing an environment or sending old notifications', async t => {
  const { db, store } = await database(t);
  await store.createOrder(order('legacy', 'unknown'));
  await db.query("update orders set amount='29.00', status='PAID', capture_id='old-capture', paid_at=now() where id='legacy'");
  await db.query('alter table orders drop column payment_mode');
  await db.query('alter table orders drop column internal_test');
  await store.init();
  await store.init();
  const existing = await store.findById('legacy');
  assert.equal(existing.amount, '29.00');
  assert.equal(existing.status, 'PAID');
  assert.equal(existing.captureId, 'old-capture');
  assert.equal(existing.paymentMode, 'unknown');
  assert.equal(existing.internalTest, false);
  assert.deepEqual(await store.notificationSummary(), { persistent: true, accepted: 0, pending: 0, failed: 0 });
  const replay = await store.markPaid('legacy', capture('old-capture'), messages, 'live');
  assert.equal(replay.paymentMode, 'unknown');
  assert.equal(replay.paymentCompletedNow, false);
  assert.equal((await store.notificationSummary()).pending, 0);
});

test('new order environment, management flags and payment notifications survive a database restart', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qalam-postgres-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let db = new PGlite(directory);
  let store = createPostgresStore({ pool: adapter(db) });
  await store.init();
  await store.createOrder(order('persistent'));
  await store.createEnquiry(order('persistent-enquiry'), () => messages().slice(0, 1));
  await store.updateManagement('persistent', { internalTest: true, adminNotes: 'Verification only', fulfillmentStatus: 'CANCELLED' });
  await store.updateManagement('persistent', { internalTest: false });
  const paid = await store.markPaid('persistent', capture('capture-persistent'), messages, 'live');
  assert.equal(paid.paymentCompletedNow, true);
  await db.close();
  db = new PGlite(directory);
  t.after(() => db.close());
  store = createPostgresStore({ pool: adapter(db) });
  await store.init();
  const restored = await store.findById('persistent');
  assert.equal(restored.paymentMode, 'live');
  assert.equal(restored.internalTest, false);
  assert.equal(restored.fulfillmentStatus, 'CANCELLED');
  assert.equal(restored.adminNotes, 'Verification only');
  assert.equal(restored.captureId, 'capture-persistent');
  assert.equal((await store.notificationSummary()).pending, 3);
  assert.equal((await store.findById('persistent-enquiry')).status, 'ENQUIRY');
});

test('enquiries and owner notifications persist atomically, deduplicate retries, and cannot become captured payments', async t => {
  const { db, store } = await database(t);
  const enquiry = order('enquiry');
  await assert.rejects(store.createEnquiry(enquiry, () => { throw Error('Cannot construct owner notification'); }));
  assert.equal(await store.findById(enquiry.id), null);
  assert.equal((await store.notificationSummary()).pending, 0);
  const saved = await store.createEnquiry(enquiry, () => messages().slice(0, 1));
  assert.equal(saved.status, 'ENQUIRY');
  assert.equal(saved.paymentMode, 'unknown');
  assert.equal(saved.paypalOrderId, 'enquiry:enquiry');
  await store.createEnquiry(enquiry, () => { assert.fail('A replay must not queue another email'); });
  assert.equal((await store.listOrders()).length, 1);
  assert.equal((await store.notificationSummary()).pending, 1);
  await assert.rejects(store.createEnquiry({ ...enquiry, brief: 'Different idea' }));
  await assert.rejects(store.markPaid(enquiry.id, capture('capture-enquiry'), messages, 'live'));
  assert.equal((await db.query('select count(*)::integer as n from payments')).rows[0].n, 0);
  assert.equal((await store.findById(enquiry.id)).status, 'ENQUIRY');
});

test('captured payment and notification jobs commit atomically, replay safely, and reject conflicting captures', async t => {
  const { db, store } = await database(t);
  await store.createOrder(order('atomic', 'unknown'));
  await assert.rejects(store.markPaid('atomic', capture('capture-atomic'), () => { throw Error('Failed message construction'); }, 'live'));
  assert.equal((await store.findById('atomic')).status, 'AWAITING_PAYMENT');
  assert.equal((await db.query('select count(*)::integer as n from payments')).rows[0].n, 0);
  assert.equal((await store.notificationSummary()).pending, 0);
  await store.markPaid('atomic', capture('capture-atomic'), messages, 'live');
  assert.equal((await store.findById('atomic')).paymentMode, 'live');
  const replay = await store.markPaid('atomic', capture('capture-atomic'), messages, 'live');
  assert.equal(replay.paymentCompletedNow, false);
  assert.equal((await store.notificationSummary()).pending, 2);
  await assert.rejects(store.markPaid('atomic', capture('different-capture'), messages, 'live'));
  assert.equal((await db.query('select count(*)::integer as n from payments')).rows[0].n, 1);
});

test('failed sends retry from the persistent queue with the same payload and key; accepted jobs never resend', async t => {
  const { db, pool, store } = await database(t);
  await store.createOrder(order('retry'));
  await store.markPaid('retry', capture('capture-retry'), () => messages().slice(0, 1), 'live');
  const attempts = [];
  await processEmailOutbox({ store, deliver: async (payload, key) => { attempts.push({ payload, key }); throw Error('Temporary provider failure'); } });
  assert.equal(attempts.length, 1);
  assert.equal((await store.notificationSummary()).pending, 1);
  assert.equal(await store.claimNotification(), null, 'backoff prevents an immediate retry');
  await db.query("update email_notifications set available_at=now()-interval '1 minute'");
  const restartedStore = createPostgresStore({ pool });
  await processEmailOutbox({ store: restartedStore, deliver: async (payload, key) => { attempts.push({ payload, key }); return 'provider-id-local-only'; } });
  assert.deepEqual(attempts[0], attempts[1]);
  assert.deepEqual(await store.notificationSummary(), { persistent: true, accepted: 1, pending: 0, failed: 0 });
  await processEmailOutbox({ store, deliver: async () => { assert.fail('Accepted notification resent'); } });
});

test('leases prevent double claims and an abandoned worker can recover the same job', async t => {
  const { db, store } = await database(t);
  await store.createOrder(order('lease'));
  await store.markPaid('lease', capture('capture-lease'), () => messages().slice(0, 1), 'live');
  const first = await store.claimNotification();
  assert.equal(first.attempts, 1);
  assert.equal(await store.claimNotification(), null);
  await db.query("update email_notifications set locked_until=now()-interval '1 minute'");
  const second = await store.claimNotification();
  assert.equal(second.id, first.id);
  assert.equal(second.attempts, 2);
  assert.equal(new Date(second.firstAttemptAt).getTime(), new Date(first.firstAttemptAt).getTime());
  await store.completeNotification(first, 'stale-worker');
  assert.equal((await store.notificationSummary()).accepted, 0);
});

test('expired retry windows and repeated failures stop safely and are visible for owner review', async t => {
  const { db, store } = await database(t);
  await store.createOrder(order('expired'));
  await store.markPaid('expired', capture('capture-expired'), () => messages().slice(0, 1), 'live');
  await db.query("update email_notifications set first_attempt_at=now()-interval '24 hours'");
  await processEmailOutbox({ store, deliver: async () => { assert.fail('Would risk sending after provider deduplication expires'); } });
  assert.equal((await store.notificationSummary()).failed, 1);
  await store.createOrder(order('exhausted'));
  await store.markPaid('exhausted', capture('capture-exhausted'), () => messages().slice(0, 1), 'live');
  let calls = 0;
  for (let i = 0; i < 8; i++) {
    await processEmailOutbox({ store, deliver: async () => { calls++; throw Error('Unavailable'); } });
    await db.query("update email_notifications set available_at=now()-interval '1 minute'");
  }
  assert.equal(calls, 8);
  assert.deepEqual(await store.notificationSummary(), { persistent: true, accepted: 0, pending: 0, failed: 2 });
  await processEmailOutbox({ store, deliver: async () => assert.fail('Exhausted job retried') });
});
