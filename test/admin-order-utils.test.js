import test from 'node:test';
import assert from 'node:assert/strict';
import { customerOrderStats, isTestOrder, normalizePaymentMode, csvCell } from '../public/admin-order-utils.js';

test('Sandbox, reserved email domains and explicit internal tests never count as customer revenue', () => {
  const orders = [
    { status: 'PAID', paymentMode: 'sandbox', email: 'owner@company.test' },
    { status: 'PAID', email: 'sb-user@personal.example.com' },
    { status: 'PAID', paymentMode: 'live', internalTest: true },
    { status: 'PAID', paymentMode: 'unknown', email: 'legacy@customer.test' },
    { status: 'PAID', paymentMode: 'live', fulfillmentStatus: 'IN_PROGRESS', email: 'customer@customer.test' },
    { status: 'AWAITING_PAYMENT', email: 'pending@customer.test' },
    { status: 'AWAITING_PAYMENT', fulfillmentStatus: 'CANCELLED' }
  ];
  assert.deepEqual(customerOrderStats(orders), { total: 4, enquiries: 0, paid: 1, waiting: 1, active: 1, delivered: 0, tests: 3, unverifiedPaid: 1 });
  assert.equal(isTestOrder({ email: 'real@example.com.customer.test' }), false);
  assert.equal(isTestOrder({ name: 'Test', email: 'user@customer.test' }), false);
  assert.equal(normalizePaymentMode(undefined), 'unknown');
  assert.equal(normalizePaymentMode('LIVE'), 'unknown');
});

test('free enquiries are counted separately from orders, payment attempts and revenue', () => {
  const stats = customerOrderStats([
    { status: 'ENQUIRY', email: 'lead@customer.test' },
    { status: 'ENQUIRY', email: 'cancelled@customer.test', fulfillmentStatus: 'CANCELLED' },
    { status: 'ENQUIRY', email: 'check@example.com' }
  ]);
  assert.equal(stats.total, 0);
  assert.equal(stats.waiting, 0);
  assert.equal(stats.paid, 0);
  assert.equal(stats.enquiries, 1);
  assert.equal(stats.tests, 1);
});

test('CSV exports neutralize formulas and escape quotes without changing ordinary text', () => {
  for (const value of ['=HYPERLINK("https://invalid")', '+SUM(1,2)', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1', '\rformula']) {
    assert.ok(csvCell(value).startsWith('"\''));
  }
  assert.equal(csvCell('قصة جميلة'), '"قصة جميلة"');
  assert.equal(csvCell('a "quoted" story'), '"a ""quoted"" story"');
  assert.equal(csvCell('15.00'), '"15.00"');
});
