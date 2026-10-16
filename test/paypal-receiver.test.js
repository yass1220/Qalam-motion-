import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPayPalReceiver } from '../paypal-receiver.js';

const record = { id: 'local-order-one', paypalOrderId: '4TST1234567890001', createdAt: '2026-10-16T12:00:00Z' };
const details = {
  id: record.paypalOrderId,
  payer: { email_address: 'customer@example.invalid' },
  purchase_units: [{
    reference_id: record.id,
    payee: { email_address: 'merchant@example.invalid', merchant_id: 'TESTMERCHANT1' }
  }]
};

test('identifies the receiving merchant, never the customer or credentials', async () => {
  const calls = [];
  const result = await inspectPayPalReceiver({
    mode: 'live',
    listOrders: async () => [record],
    readOrder: async id => { calls.push(id); return details; }
  });
  assert.equal(result.email, 'merchant@example.invalid');
  assert.equal(result.merchantId, 'TESTMERCHANT1');
  assert.equal(result.mode, 'live');
  assert.equal(result.verified, true);
  assert.equal(result.source, 'existing_order');
  assert.deepEqual(calls, [record.paypalOrderId]);
  assert.ok(!JSON.stringify(result).includes('customer@example.invalid'));
  assert.ok(!JSON.stringify(result).includes(record.id));
});

test('can skip an inaccessible old environment and inspect the next order', async () => {
  const result = await inspectPayPalReceiver({
    mode: 'live',
    listOrders: async () => [{ ...record, paypalOrderId: '4TST1234567890002', createdAt: '2026-10-16T13:00:00Z' }, record],
    readOrder: async id => {
      if (id !== record.paypalOrderId) throw Object.assign(new Error('not found'), { status: 404 });
      return details;
    }
  });
  assert.equal(result.email, 'merchant@example.invalid');
});

test('never reports a customer email when PayPal omits the merchant', async () => {
  const result = await inspectPayPalReceiver({
    mode: 'live', listOrders: async () => [record],
    readOrder: async () => ({ ...details, purchase_units: [{ reference_id: record.id }] })
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'NO_READABLE_ORDER');
  assert.equal(result.email, undefined);
});

test('rejects details for another PayPal order or local reference', async () => {
  for (const response of [
    { ...details, id: '4TST1234567890099' },
    { ...details, purchase_units: [{ ...details.purchase_units[0], reference_id: 'another-local-order' }] },
    { ...details, purchase_units: [...details.purchase_units, details.purchase_units[0]] }
  ]) {
    const result = await inspectPayPalReceiver({ mode: 'live', listOrders: async () => [record], readOrder: async () => response });
    assert.equal(result.verified, false);
  }
});

test('stops on authentication, rate-limit and service errors', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const failure = Object.assign(new Error('PayPal unavailable'), { status });
    await assert.rejects(inspectPayPalReceiver({
      mode: 'live', listOrders: async () => [record, record],
      readOrder: async () => { calls++; throw failure; }
    }), error => error === failure);
    assert.equal(calls, 1);
  }
});

test('bounds lookups and leaves stored orders unchanged', async () => {
  const records = Array.from({ length: 8 }, (_, index) => ({
    ...record, id: 'local-' + index, paypalOrderId: '4TST123456789000' + index,
    createdAt: '2026-10-16T1' + index + ':00:00Z'
  }));
  const before = JSON.stringify(records);
  let calls = 0;
  const result = await inspectPayPalReceiver({
    mode: 'sandbox', listOrders: async () => records,
    readOrder: async () => { calls++; throw Object.assign(new Error('not found'), { status: 404 }); }
  });
  assert.equal(calls, 5);
  assert.equal(JSON.stringify(records), before);
  assert.equal(result.verified, false);
  assert.equal(result.mode, 'sandbox');
});

test('ignores missing or malformed stored PayPal IDs', async () => {
  const result = await inspectPayPalReceiver({
    mode: 'live', listOrders: async () => [{ ...record, paypalOrderId: '../../capture' }, { id: 'missing' }],
    readOrder: async () => { assert.fail('No request should be made'); }
  });
  assert.equal(result.verified, false);
});
