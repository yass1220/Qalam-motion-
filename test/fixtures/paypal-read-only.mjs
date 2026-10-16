import fs from 'node:fs';

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  const method = options.method || 'GET';
  fs.appendFileSync(process.env.PAYPAL_TEST_CALLS, JSON.stringify({ method, path: url.pathname }) + '\n');
  if (url.origin !== 'https://api-m.paypal.com') throw Error('Unexpected external request in test');
  if (url.pathname === '/v1/oauth2/token' && method === 'POST') {
    return Response.json({ access_token: 'local-only-test-access-token' });
  }
  if (url.pathname === '/v2/checkout/orders/4TST1234567890001' && method === 'GET') {
    return Response.json({
      id: '4TST1234567890001',
      payer: { email_address: 'customer@example.invalid' },
      purchase_units: [{
        reference_id: 'local-order-one',
        payee: { email_address: 'merchant@example.invalid', merchant_id: 'TESTMERCHANT1' }
      }]
    });
  }
  throw Error('A payment mutation or unexpected PayPal endpoint was requested');
};
