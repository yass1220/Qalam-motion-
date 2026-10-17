import fs from 'node:fs';
const orders = new Map();
let sequence = 0;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body.startsWith('{') ? options.body : '{}') : null;
  fs.appendFileSync(process.env.PAYPAL_TEST_CALLS, JSON.stringify({ method, origin: url.origin, path: url.pathname, body }) + '\n');
  if (url.origin === 'https://api.resend.com' && url.pathname === '/emails' && method === 'POST') {
    return Response.json({ id: 'local-email-' + ++sequence });
  }
  if (url.origin !== 'https://api-m.paypal.com') throw Error('Blocked unexpected external request in test');
  if (url.pathname === '/v1/oauth2/token' && method === 'POST') return Response.json({ access_token: 'local-only-access-token' });
  if (url.pathname === '/v2/checkout/orders' && method === 'POST') {
    const id = 'LOCALTEST' + String(++sequence).padStart(8, '0');
    orders.set(id, body.purchase_units[0]);
    return Response.json({ id, links: [{ rel: 'payer-action', href: `https://paypal.invalid/checkout/${id}` }] });
  }
  const captured = url.pathname.match(/^\/v2\/checkout\/orders\/([a-z0-9]+)\/capture$/i);
  if (captured && method === 'POST') {
    const id = captured[1];
    const unit = orders.get(id);
    if (!unit) throw Error('Unknown local checkout');
    const control = JSON.parse(fs.readFileSync(process.env.PAYPAL_TEST_CONTROL, 'utf8'));
    return Response.json({ id, status: 'COMPLETED', purchase_units: [{ reference_id: unit.reference_id,
      payments: { captures: [{ id: 'capture-' + id, status: 'COMPLETED', custom_id: unit.custom_id,
        amount: { currency_code: 'USD', value: control.captureAmount || unit.amount.value } }] } }] });
  }
  throw Error('Unexpected payment endpoint in local test');
};
