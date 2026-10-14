import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({
  limit: '32kb',
  verify: (req, res, buffer) => {
    req.rawBody = buffer.toString('utf8');
  }
}));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static('public'));

const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
const paypalBase = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const catalog = {
  short: { name: 'Short Story', price: '29.00', duration: 'Up to 20 seconds' },
  signature: { name: 'Signature Reel', price: '59.00', duration: 'Up to 45 seconds' }
};
const fulfillmentStatuses = new Set(['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'DELIVERED', 'CANCELLED']);
const adminSessionCookie = 'qm_admin';
const adminSessionTtlMs = 8 * 60 * 60 * 1000;
const supportEmail = clean(process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL, 254);

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function safeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function adminSecret() {
  const expected = process.env.ADMIN_TOKEN;
  return expected && !expected.startsWith('replace_') ? expected : '';
}

function adminTokenMatches(supplied) {
  const expected = adminSecret();
  return Boolean(expected && safeEqual(supplied || '', expected));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('=') || '')];
  }).filter(([key]) => key));
}

function signAdminSession(value) {
  return crypto.createHmac('sha256', adminSecret()).update(value).digest('base64url');
}

function createAdminSessionCookie() {
  const expires = Date.now() + adminSessionTtlMs;
  const nonce = crypto.randomBytes(18).toString('base64url');
  const value = `${expires}.${nonce}`;
  return `${value}.${signAdminSession(value)}`;
}

function adminSessionValid(req) {
  const token = parseCookies(req)[adminSessionCookie];
  if (!token || !adminSecret()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now() || !nonce) return false;
  return safeEqual(signature, signAdminSession(`${expires}.${nonce}`));
}

function setAdminSession(res) {
  const secure = publicBaseUrl.startsWith('https://') || Boolean(process.env.RAILWAY_ENVIRONMENT);
  res.setHeader('Set-Cookie', [
    `${adminSessionCookie}=${encodeURIComponent(createAdminSessionCookie())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${adminSessionTtlMs / 1000}${secure ? '; Secure' : ''}`
  ]);
}

function clearAdminSession(res) {
  res.setHeader('Set-Cookie', `${adminSessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function adminAuthorized(req) {
  const supplied = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  return adminSessionValid(req) || adminTokenMatches(supplied);
}

function requireAdmin(req, res) {
  if (adminAuthorized(req)) return true;
  fail(res, 401, 'Unauthorized');
  return false;
}

function normalizeOrder(order) {
  if (!order) return null;
  return {
    ...order,
    fulfillmentStatus: fulfillmentStatuses.has(order?.fulfillmentStatus) ? order.fulfillmentStatus : 'NEW',
    adminNotes: clean(order?.adminNotes, 3000),
    updatedAt: order?.updatedAt || order?.paidAt || order?.createdAt || new Date().toISOString()
  };
}

function adminOrder(order) {
  return {
    id: order.id,
    packageId: order.packageId,
    amount: order.amount,
    currency: order.currency,
    name: order.name,
    email: order.email,
    contact: order.contact,
    brief: order.brief,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus || 'NEW',
    adminNotes: order.adminNotes || '',
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    updatedAt: order.updatedAt,
    captureId: order.captureId
  };
}

function customerOrder(order) {
  return {
    id: order.id,
    packageId: order.packageId,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus || 'NEW',
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    updatedAt: order.updatedAt
  };
}

function createStore() {
  if (process.env.DATABASE_URL) return createPostgresStore();
  return createJsonStore();
}

function createPostgresStore() {
  const sslMode = process.env.PGSSLMODE || new URL(process.env.DATABASE_URL).searchParams.get('sslmode');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false
  });

  async function init() {
    await pool.query(`
      create table if not exists orders (
        id text primary key,
        paypal_order_id text unique not null,
        package_id text not null,
        amount text not null,
        currency text not null default 'USD',
        customer_name text not null,
        email text not null,
        contact text,
        brief text not null,
        status text not null,
        fulfillment_status text not null default 'NEW',
        admin_notes text not null default '',
        capture_id text,
        created_at timestamptz not null,
        paid_at timestamptz,
        updated_at timestamptz not null default now()
      )
    `);
    await pool.query(`
      create table if not exists payments (
        capture_id text primary key,
        order_id text not null references orders(id),
        paypal_order_id text not null,
        status text not null,
        amount text not null,
        currency text not null default 'USD',
        created_at timestamptz not null default now()
      )
    `);
    await pool.query("alter table orders add column if not exists fulfillment_status text not null default 'NEW'");
    await pool.query("alter table orders add column if not exists admin_notes text not null default ''");
    await pool.query('create index if not exists orders_status_created_idx on orders (status, created_at desc)');
    await pool.query('create index if not exists orders_fulfillment_created_idx on orders (fulfillment_status, created_at desc)');
    await pool.query('create unique index if not exists orders_capture_id_unique on orders (capture_id) where capture_id is not null');
    await pool.query('create index if not exists payments_order_created_idx on payments (order_id, created_at desc)');
  }

  function rowToOrder(row) {
    if (!row) return null;
    return {
      id: row.id,
      paypalOrderId: row.paypal_order_id,
      packageId: row.package_id,
      amount: row.amount,
      currency: row.currency,
      name: row.customer_name,
      email: row.email,
      contact: row.contact || '',
      brief: row.brief,
      status: row.status,
      fulfillmentStatus: row.fulfillment_status || 'NEW',
      adminNotes: row.admin_notes || '',
      captureId: row.capture_id || undefined,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      paidAt: row.paid_at?.toISOString?.() || row.paid_at || undefined,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at
    };
  }

  return {
    type: 'postgres',
    init,
    async createOrder(order) {
      await pool.query(
        `insert into orders
          (id, paypal_order_id, package_id, amount, currency, customer_name, email, contact, brief, status, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
        [order.id, order.paypalOrderId, order.packageId, order.amount, order.currency, order.name, order.email, order.contact, order.brief, order.status, order.createdAt]
      );
    },
    async findById(orderId) {
      const result = await pool.query('select * from orders where id=$1 limit 1', [orderId]);
      return rowToOrder(result.rows[0]);
    },
    async findByPayPalOrderId(paypalOrderId) {
      const result = await pool.query('select * from orders where paypal_order_id=$1 limit 1', [paypalOrderId]);
      return rowToOrder(result.rows[0]);
    },
    async markPaid(orderId, capture) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const current = await client.query('select * from orders where id=$1 for update', [orderId]);
        if (!current.rows[0]) {
          await client.query('rollback');
          return null;
        }
        const existing = rowToOrder(current.rows[0]);
        if (existing.status === 'PAID' && existing.captureId === capture.id) {
          await client.query('commit');
          existing.paymentCompletedNow = false;
          return existing;
        }
        if (existing.status === 'PAID' && existing.captureId && existing.captureId !== capture.id) {
          throw Error('Order is already paid with a different capture ID');
        }
        await client.query(
          `insert into payments (capture_id, order_id, paypal_order_id, status, amount, currency)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (capture_id) do nothing`,
          [capture.id, orderId, existing.paypalOrderId, capture.status, capture.amount.value, capture.amount.currency_code]
        );
        const result = await client.query(
          `update orders
             set status='PAID', capture_id=$2, paid_at=coalesce(paid_at, now()), updated_at=now()
           where id=$1
           returning *`,
          [orderId, capture.id]
        );
        await client.query('commit');
        const order = rowToOrder(result.rows[0]);
        order.paymentCompletedNow = existing.status !== 'PAID';
        return order;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async updateManagement(orderId, updates) {
      const result = await pool.query(
        `update orders
           set fulfillment_status=coalesce($2, fulfillment_status),
               admin_notes=coalesce($3, admin_notes),
               updated_at=now()
         where id=$1
         returning *`,
        [orderId, updates.fulfillmentStatus ?? null, updates.adminNotes ?? null]
      );
      return rowToOrder(result.rows[0]);
    },
    async listOrders() {
      const result = await pool.query('select * from orders order by created_at desc limit 500');
      return result.rows.map(rowToOrder);
    },
    async health() {
      await pool.query('select 1');
    }
  };
}

function createJsonStore() {
  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  const file = path.join(dataDir, 'orders.json');
  let orders = [];
  let writeQueue = Promise.resolve();

  async function persist() {
    writeQueue = writeQueue.then(async () => {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(orders, null, 2), { mode: 0o600 });
      await fs.rename(tmp, file);
    });
    return writeQueue;
  }

  return {
    type: 'json',
    async init() {
      await fs.mkdir(dataDir, { recursive: true });
      try {
        const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
        orders = Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
    async createOrder(order) {
      orders.push(normalizeOrder(order));
      await persist();
    },
    async findById(orderId) {
      return normalizeOrder(orders.find(order => order.id === orderId) || null);
    },
    async findByPayPalOrderId(paypalOrderId) {
      return normalizeOrder(orders.find(order => order.paypalOrderId === paypalOrderId) || null);
    },
    async markPaid(orderId, capture) {
      const order = orders.find(item => item.id === orderId);
      if (!order) return null;
      const wasAlreadyPaid = order.status === 'PAID';
      if (order.status === 'PAID' && order.captureId && order.captureId !== capture.id) {
        throw Error('Order is already paid with a different capture ID');
      }
      order.status = 'PAID';
      order.captureId = capture.id;
      order.paidAt = order.paidAt || new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      await persist();
      const paidOrder = normalizeOrder(order);
      paidOrder.paymentCompletedNow = !wasAlreadyPaid;
      return paidOrder;
    },
    async updateManagement(orderId, updates) {
      const order = orders.find(item => item.id === orderId);
      if (!order) return null;
      if (updates.fulfillmentStatus) order.fulfillmentStatus = updates.fulfillmentStatus;
      if (typeof updates.adminNotes === 'string') order.adminNotes = updates.adminNotes;
      order.updatedAt = new Date().toISOString();
      await persist();
      return normalizeOrder(order);
    },
    async listOrders() {
      return [...orders].map(normalizeOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async health() {
      return true;
    }
  };
}

const store = createStore();
await store.init();

async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret || id.startsWith('replace_')) throw Error('PayPal credentials are not configured');
  const response = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) throw Error('PayPal authentication failed');
  return json.access_token;
}

async function paypal(pathname, method, body, requestId) {
  const token = await accessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const response = await fetch(`${paypalBase}${pathname}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`PayPal ${method} failed (${response.status}): ${json.name || 'unknown error'}`);
  return json;
}

function emailsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!emailsConfigured() || !validEmail(to)) return false;

  const payload = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html
  };
  if (replyTo && validEmail(replyTo)) payload.reply_to = replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Error(`Email send failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return true;
}

function orderUrl(order) {
  return `${publicBaseUrl}/status.html`;
}

function orderSummary(order) {
  return [
    `Order ID: ${order.id}`,
    `Package: ${order.packageId}`,
    `Amount: ${order.amount} ${order.currency || 'USD'}`,
    `Customer: ${order.name}`,
    `Email: ${order.email}`,
    order.contact ? `Contact: ${order.contact}` : '',
    '',
    'Brief:',
    order.brief
  ].filter(Boolean).join('\n');
}

async function notifyPaidOrder(order) {
  const tasks = [];
  const trackUrl = orderUrl(order);

  tasks.push(sendEmail({
    to: order.email,
    subject: 'تم تأكيد طلبك في قلم موشن',
    replyTo: supportEmail,
    text: [
      `مرحبا ${order.name},`,
      '',
      'تم تأكيد الدفع بنجاح، ووصل طلبك إلى قلم موشن.',
      `رقم الطلب: ${order.id}`,
      `تتبع الطلب: ${trackUrl}`,
      '',
      'سنراجع التفاصيل ونتواصل معك إذا احتجنا أي معلومات إضافية.',
      supportEmail ? `للمساعدة: ${supportEmail}` : ''
    ].filter(Boolean).join('\n'),
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#1f1f1f">
        <h2>تم تأكيد طلبك في قلم موشن</h2>
        <p>مرحبا ${escapeHtml(order.name)},</p>
        <p>تم تأكيد الدفع بنجاح، ووصل طلبك إلينا.</p>
        <p><strong>رقم الطلب:</strong> <span dir="ltr">${escapeHtml(order.id)}</span></p>
        <p><a href="${trackUrl}">تتبع حالة الطلب</a></p>
        <p>سنراجع التفاصيل ونتواصل معك إذا احتجنا أي معلومات إضافية.</p>
      </div>
    `
  }).catch(error => console.warn(error.message)));

  if (validEmail(process.env.ADMIN_EMAIL || '')) {
    tasks.push(sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `طلب مدفوع جديد - ${order.packageId}`,
      replyTo: order.email,
      text: orderSummary(order),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f1f">
          <h2>New paid Qalam Motion order</h2>
          <pre style="white-space:pre-wrap;background:#f6f2eb;padding:16px;border-radius:8px">${escapeHtml(orderSummary(order))}</pre>
          <p><a href="${publicBaseUrl}/admin.html">Open admin dashboard</a></p>
        </div>
      `
    }).catch(error => console.warn(error.message)));
  }

  await Promise.all(tasks);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function webhookHeaders(req) {
  return {
    auth_algo: req.get('paypal-auth-algo'),
    cert_url: req.get('paypal-cert-url'),
    transmission_id: req.get('paypal-transmission-id'),
    transmission_sig: req.get('paypal-transmission-sig'),
    transmission_time: req.get('paypal-transmission-time')
  };
}

async function paypalWebhookVerified(req) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const headers = webhookHeaders(req);
  if (Object.values(headers).some(value => !value)) return false;

  const result = await paypal('/v1/notifications/verify-webhook-signature', 'POST', {
    ...headers,
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: req.body
  });
  return result.verification_status === 'SUCCESS';
}

function captureFromWebhook(resource, record) {
  const capture = {
    id: clean(resource?.id, 120),
    status: clean(resource?.status, 40).toUpperCase(),
    custom_id: clean(resource?.custom_id, 120),
    amount: resource?.amount || {}
  };
  const paypalOrderId = clean(resource?.supplementary_data?.related_ids?.order_id, 120);
  const amountMatches = capture.amount?.value === record.amount && capture.amount?.currency_code === record.currency;
  const orderMatches = !paypalOrderId || paypalOrderId === record.paypalOrderId;
  if (!capture.id || capture.status !== 'COMPLETED' || capture.custom_id !== record.id || !amountMatches || !orderMatches) {
    return null;
  }
  return capture;
}

async function finishPaidOrder(order, capture) {
  const paidOrder = await store.markPaid(order.id, capture);
  if (paidOrder?.paymentCompletedNow) {
    await notifyPaidOrder(paidOrder);
  }
  return paidOrder;
}

function verifiedCapture(result, record) {
  const unit = result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find(item => item.status === 'COMPLETED' && item.custom_id === record.id);
  const amountMatches = capture?.amount?.value === record.amount && capture?.amount?.currency_code === record.currency;
  const orderMatches = result.id === record.paypalOrderId && result.status === 'COMPLETED' && unit?.reference_id === record.id && capture?.custom_id === record.id;
  return capture && amountMatches && orderMatches ? capture : null;
}

async function capturePayPalOrder(record) {
  try {
    return await paypal(`/v2/checkout/orders/${encodeURIComponent(record.paypalOrderId)}/capture`, 'POST', null, `capture-${record.id}`);
  } catch (captureError) {
    const inspected = await paypal(`/v2/checkout/orders/${encodeURIComponent(record.paypalOrderId)}`, 'GET', null, `inspect-${record.id}`);
    if (inspected.status === 'COMPLETED') return inspected;
    throw captureError;
  }
}

app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store').json({
    mode,
    currency: 'USD',
    catalog,
    storage: store.type,
    configured: Boolean(process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_ID.startsWith('replace_'))
  });
});

app.post('/api/orders', async (req, res) => {
  try {
    const { packageId } = req.body || {};
    const pkg = catalog[packageId];
    const name = clean(req.body?.name, 100);
    const email = clean(req.body?.email, 254);
    const contact = clean(req.body?.contact, 120);
    const brief = clean(req.body?.brief, 4000);

    if (!pkg || name.length < 2 || !validEmail(email) || brief.length < 15) {
      return fail(res, 400, 'Enter a valid package, name, email and a story of at least 15 characters.');
    }

    const localId = crypto.randomUUID();
    const result = await paypal('/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: localId,
        description: `Qalam Motion - ${pkg.name}`,
        custom_id: localId,
        amount: { currency_code: 'USD', value: pkg.price }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Qalam Motion',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: `${publicBaseUrl}/?payment=return`,
            cancel_url: `${publicBaseUrl}/?payment=cancel`
          }
        }
      }
    }, `create-${localId}`);

    const approve = result.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    if (!approve || !result.id) throw Error('PayPal did not return an approval URL');

    const record = {
      id: localId,
      paypalOrderId: result.id,
      packageId,
      amount: pkg.price,
      currency: 'USD',
      name,
      email,
      contact,
      brief,
      status: 'AWAITING_PAYMENT',
      fulfillmentStatus: 'NEW',
      adminNotes: '',
      createdAt: new Date().toISOString()
    };

    await store.createOrder(record);
    res.json({ orderId: localId, paypalOrderId: result.id, approvalUrl: approve });
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not start PayPal checkout. Check server configuration and try again.');
  }
});

app.post('/api/orders/:paypalOrderId/capture', async (req, res) => {
  const record = await store.findByPayPalOrderId(req.params.paypalOrderId);
  if (!record) return fail(res, 404, 'Order not found');
  if (record.status === 'PAID') return res.json({ status: 'PAID', orderId: record.id });

  try {
    // PayPal is authoritative. Never trust a client-side success redirect alone.
    const result = await capturePayPalOrder(record);
    const capture = verifiedCapture(result, record);

    if (!capture) {
      return fail(res, 409, 'Payment has not been verified. Contact support.');
    }

    const paidOrder = await finishPaidOrder(record, capture);
    res.json({ status: 'PAID', orderId: paidOrder.id });
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not confirm payment. Do not pay again; contact support with your order reference.');
  }
});

app.post('/api/paypal/webhook', async (req, res) => {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return fail(res, 503, 'PayPal webhook is not configured');
  }

  try {
    if (!await paypalWebhookVerified(req)) {
      return fail(res, 400, 'Webhook signature verification failed');
    }

    const eventType = clean(req.body?.event_type, 80);
    const resource = req.body?.resource || {};

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = clean(resource.custom_id, 120);
      const record = await store.findById(orderId);
      if (!record) {
        console.warn(`Ignoring PayPal webhook for unknown order ${orderId || 'none'}`);
        return res.json({ received: true, ignored: true });
      }
      if (record.status === 'PAID') return res.json({ received: true, status: 'PAID' });

      const capture = captureFromWebhook(resource, record);
      if (!capture) {
        console.warn(`Ignoring PayPal webhook with mismatched capture for order ${record.id}`);
        return res.json({ received: true, ignored: true });
      }

      const paidOrder = await finishPaidOrder(record, capture);
      return res.json({ received: true, status: paidOrder.status, orderId: paidOrder.id });
    }

    if (eventType === 'CHECKOUT.ORDER.COMPLETED') {
      const paypalOrderId = clean(resource.id, 120);
      const record = await store.findByPayPalOrderId(paypalOrderId);
      if (!record) {
        console.warn(`Ignoring PayPal completed-order webhook for unknown PayPal order ${paypalOrderId || 'none'}`);
        return res.json({ received: true, ignored: true });
      }
      if (record.status === 'PAID') return res.json({ received: true, status: 'PAID' });

      const capture = verifiedCapture(resource, record);
      if (!capture) {
        console.warn(`Ignoring PayPal completed-order webhook with mismatched capture for order ${record.id}`);
        return res.json({ received: true, ignored: true });
      }

      const paidOrder = await finishPaidOrder(record, capture);
      return res.json({ received: true, status: paidOrder.status, orderId: paidOrder.id });
    }

    res.json({ received: true, ignored: true });
  } catch (error) {
    console.error(error);
    fail(res, 500, 'Could not process PayPal webhook');
  }
});

app.post('/api/orders/status', async (req, res) => {
  const orderId = clean(req.body?.orderId, 80);
  const email = clean(req.body?.email, 254).toLowerCase();
  if (!orderId || !validEmail(email)) return fail(res, 400, 'Enter a valid order reference and email.');

  const record = await store.findById(orderId);
  if (!record || record.email.toLowerCase() !== email) return fail(res, 404, 'Order not found');

  res.set('Cache-Control', 'no-store').json(customerOrder(record));
});

app.get('/api/admin/orders', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const orders = await store.listOrders();
  res.set('Cache-Control', 'no-store').json(orders.map(adminOrder));
});

app.get('/api/admin/session', (req, res) => {
  if (!adminAuthorized(req)) return fail(res, 401, 'Unauthorized');
  res.set('Cache-Control', 'no-store').json({
    authenticated: true,
    emailConfigured: emailsConfigured(),
    webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID)
  });
});

app.post('/api/admin/login', (req, res) => {
  const token = clean(req.body?.token, 500);
  if (!adminTokenMatches(token)) return fail(res, 401, 'Unauthorized');
  setAdminSession(res);
  res.set('Cache-Control', 'no-store').json({
    authenticated: true,
    emailConfigured: emailsConfigured(),
    webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID)
  });
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminSession(res);
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

app.patch('/api/admin/orders/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const updates = {};
  if (Object.hasOwn(req.body || {}, 'fulfillmentStatus')) {
    const fulfillmentStatus = clean(req.body.fulfillmentStatus, 40).toUpperCase();
    if (!fulfillmentStatuses.has(fulfillmentStatus)) return fail(res, 400, 'Invalid fulfillment status');
    updates.fulfillmentStatus = fulfillmentStatus;
  }
  if (Object.hasOwn(req.body || {}, 'adminNotes')) {
    updates.adminNotes = clean(req.body.adminNotes, 3000);
  }
  if (!Object.keys(updates).length) return fail(res, 400, 'No order updates supplied');

  const order = await store.updateManagement(clean(req.params.id, 80), updates);
  if (!order) return fail(res, 404, 'Order not found');

  res.set('Cache-Control', 'no-store').json(adminOrder(order));
});

app.get('/health', async (req, res) => {
  try {
    await store.health();
    res.json({ ok: true, storage: store.type });
  } catch (error) {
    console.error(error);
    res.status(503).json({ ok: false, storage: store.type });
  }
});

app.listen(Number(process.env.PORT) || 3000, () => {
  console.log(`Qalam Motion running on port ${process.env.PORT || 3000} (${mode}, ${store.type})`);
});
