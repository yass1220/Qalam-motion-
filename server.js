import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createPostgresStore } from './postgres-store.js';
import { normalizePaymentMode, isTestOrder } from './public/admin-order-utils.js';
import { processEmailOutbox } from './email-outbox.js';
import { inspectPayPalReceiver } from './paypal-receiver.js';

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
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-7', legacyHeaders: false });
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts. Try again later.' }
});
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 5,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many enquiries. Please try again later or contact support by email.' }
});
app.use('/api', apiLimiter);
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.redirect(302, '/admin.html');
});
app.use('/admin.html', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static('public'));

const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
const paypalBase = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const paypalWebhookPath = '/api/paypal/webhook';
const paypalWebhookUrl = `${publicBaseUrl}${paypalWebhookPath}`;
const catalog = {
  short: { name: 'Drawn Story', price: '15.00', duration: '40–45 seconds', durationSeconds: { min: 40, max: 45 } },
  signature: { name: 'Extended Story', price: '25.00', duration: '60–75 seconds', durationSeconds: { min: 60, max: 75 } }
};
const fulfillmentStatuses = new Set(['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'DELIVERED', 'CANCELLED']);
const adminSessionCookie = 'qm_admin';
const adminSessionTtlMs = 8 * 60 * 60 * 1000;
const supportEmail = clean(process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL, 254);
const paypalWebhookSettingKey = 'paypalWebhookId';
const paypalWebhookUrlSettingKey = 'paypalWebhookUrl';
const resendDomain = clean(process.env.RESEND_DOMAIN || 'mail.qalammotion.com', 253).toLowerCase();

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
    const rawValue = value.join('=') || '';
    try {
      return [key, decodeURIComponent(rawValue)];
    } catch {
      return [key, rawValue];
    }
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

function setupAuthorized(req) {
  const expected = clean(process.env.SETUP_TOKEN, 500);
  const supplied = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  return Boolean(expected && safeEqual(supplied, expected));
}

function requireSetup(req, res) {
  if (setupAuthorized(req)) return true;
  fail(res, 401, 'Unauthorized');
  return false;
}

function normalizeOrder(order) {
  if (!order) return null;
  return {
    ...order,
    paymentMode: normalizePaymentMode(order.paymentMode),
    internalTest: order.internalTest === true,
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
    paymentMode: normalizePaymentMode(order.paymentMode),
    internalTest: order.internalTest === true,
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
  if (process.env.RAILWAY_ENVIRONMENT) throw Error('DATABASE_URL is required on Railway; refusing ephemeral order storage');
  return createJsonStore();
}


function createJsonStore() {
  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  const file = path.join(dataDir, 'orders.json');
  const settingsFile = path.join(dataDir, 'settings.json');
  let orders = [];
  let settings = {};
  let writeQueue = Promise.resolve();

  async function persist() {
    writeQueue = writeQueue.then(async () => {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(orders, null, 2), { mode: 0o600 });
      await fs.rename(tmp, file);
    });
    return writeQueue;
  }

  async function persistSettings() {
    writeQueue = writeQueue.then(async () => {
      const tmp = `${settingsFile}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(settings, null, 2), { mode: 0o600 });
      await fs.rename(tmp, settingsFile);
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
      try {
        const parsedSettings = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
        settings = parsedSettings && typeof parsedSettings === 'object' && !Array.isArray(parsedSettings) ? parsedSettings : {};
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
    async createOrder(order) {
      orders.push(normalizeOrder(order));
      await persist();
    },
    async createEnquiry(order) {
      const existing = orders.find(item => item.id === order.id);
      if (existing) {
        if (existing.status !== 'ENQUIRY' || ['name', 'email', 'contact', 'brief', 'packageId'].some(key => existing[key] !== order[key])) {
          const error = Error('Request reference already used');
          error.status = 409;
          throw error;
        }
        return normalizeOrder(existing);
      }
      const record = normalizeOrder({ ...order, paypalOrderId: `enquiry:${order.id}`, status: 'ENQUIRY', paymentMode: 'unknown' });
      orders.push(record);
      await persist();
      return record;
    },
    async findById(orderId) {
      return normalizeOrder(orders.find(order => order.id === orderId) || null);
    },
    async findByPayPalOrderId(paypalOrderId) {
      return normalizeOrder(orders.find(order => order.paypalOrderId === paypalOrderId) || null);
    },
    async markPaid(orderId, capture, buildMessages, captureMode) {
      const order = orders.find(item => item.id === orderId);
      if (!order) return null;
      if (order.status === 'ENQUIRY') throw Error('An enquiry cannot be captured or marked paid');
      const wasAlreadyPaid = order.status === 'PAID';
      if (order.status === 'PAID' && order.captureId && order.captureId !== capture.id) {
        throw Error('Order is already paid with a different capture ID');
      }
      order.status = 'PAID';
      if (normalizePaymentMode(order.paymentMode) === 'unknown') order.paymentMode = normalizePaymentMode(captureMode);
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
      if (typeof updates.internalTest === 'boolean') order.internalTest = updates.internalTest;
      order.updatedAt = new Date().toISOString();
      await persist();
      return normalizeOrder(order);
    },
    async listOrders() {
      return [...orders].map(normalizeOrder).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    async health() {
      return true;
    },
    async getSetting(key) {
      return settings[key] || '';
    },
    async setSetting(key, value) {
      settings[key] = value;
      await persistSettings();
    }
  };
}

const store = createStore();
await store.init();
let notificationDrain = null;
void drainNotifications();
setInterval(() => { void drainNotifications(); }, 30_000).unref();
ensurePayPalWebhook()
  .then(webhookId => {
    if (webhookId) console.log(`PayPal webhook ready at ${paypalWebhookPath}`);
  })
  .catch(error => console.warn(`PayPal webhook setup skipped: ${error.message}`));

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
  if (!response.ok) {
    const error = Error(`PayPal ${method} failed (${response.status}): ${json.name || 'unknown error'}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

function emailsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function adminEmail() {
  return clean(process.env.ADMIN_EMAIL || '', 254);
}

function resendTestMode() {
  return /(^|<)onboarding@resend\.dev>?$/i.test(clean(process.env.EMAIL_FROM, 254));
}

function canSendNotificationTo(email) {
  const recipient = clean(email, 254).toLowerCase();
  const admin = adminEmail().toLowerCase();
  return emailsConfigured() && validEmail(recipient) && (!resendTestMode() || recipient === admin);
}

function emailPayload({ to, subject, text, html, replyTo }) {
  const payload = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html
  };
  if (replyTo && validEmail(replyTo)) payload.reply_to = replyTo;
  return payload;
}

async function deliverEmail(payload, idempotencyKey) {
  if (!emailsConfigured() || !validEmail(payload.to)) throw Error('Email is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw Error(`Email send failed (${response.status})`);
  }
  const json = await response.json();
  if (!json.id) throw Error('Email provider did not return an ID');
  return json.id;
}

async function sendEmail(message) {
  if (!emailsConfigured() || !validEmail(message.to)) return false;
  await deliverEmail(emailPayload(message));
  return true;
}

function drainNotifications() {
  if (store.type !== 'postgres' || !emailsConfigured()) return Promise.resolve();
  if (notificationDrain) return notificationDrain;
  notificationDrain = processEmailOutbox({ store, deliver: deliverEmail })
    .catch(() => console.warn('Notification queue needs attention'))
    .finally(() => { notificationDrain = null; });
  return notificationDrain;
}

async function resendApi(pathname, method, body) {
  if (!process.env.RESEND_API_KEY) throw Error('Resend API key is not configured');
  const response = await fetch(`https://api.resend.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Error(`Resend ${method} failed (${response.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function publicResendDomain(domain) {
  return {
    id: domain?.id,
    name: domain?.name,
    status: domain?.status,
    region: domain?.region,
    records: Array.isArray(domain?.records) ? domain.records.map(record => ({
      record: record.record,
      name: record.name,
      type: record.type,
      value: record.value,
      priority: record.priority,
      status: record.status
    })) : []
  };
}

async function findResendDomain(name) {
  const listed = await resendApi('/domains', 'GET');
  return (listed.data || []).find(domain => domain.name === name) || null;
}

async function ensureResendDomain() {
  let domain = await findResendDomain(resendDomain);
  if (!domain) {
    domain = await resendApi('/domains', 'POST', {
      name: resendDomain,
      region: 'eu-west-1',
      capabilities: {
        sending: 'enabled',
        receiving: 'disabled'
      }
    });
  }
  if (!Array.isArray(domain.records)) {
    domain = await resendApi(`/domains/${encodeURIComponent(domain.id)}`, 'GET');
  }
  return domain;
}

function orderUrl(order) {
  return `${publicBaseUrl}/status.html?orderId=${encodeURIComponent(order.id)}`;
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

function paidOrderMessages(order) {
  if (!emailsConfigured() || isTestOrder(order)) return [];
  const messages = [];
  const trackUrl = orderUrl(order);
  const admin = adminEmail();
  const customerCanReceive = canSendNotificationTo(order.email);

  if (validEmail(admin)) {
    messages.push({ kind: 'admin', payload: emailPayload({
      to: admin,
      subject: `طلب مدفوع جديد - ${order.packageId}`,
      replyTo: resendTestMode() ? '' : order.email,
      text: [
        orderSummary(order),
        !customerCanReceive ? 'Customer email was skipped because Resend is still using the testing sender. Verify a domain in Resend before launch.' : ''
      ].filter(Boolean).join('\n\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f1f">
          <h2>New paid Qalam Motion order</h2>
          ${!customerCanReceive ? '<p><strong>Customer email skipped:</strong> Resend is still using the testing sender. Verify a domain in Resend before launch.</p>' : ''}
          <pre style="white-space:pre-wrap;background:#f6f2eb;padding:16px;border-radius:8px">${escapeHtml(orderSummary(order))}</pre>
          <p><a href="${publicBaseUrl}/admin.html">Open admin dashboard</a></p>
        </div>
      `
    }) });
  }

  if (!customerCanReceive) {
    return messages;
  }

  messages.push({ kind: 'customer', payload: emailPayload({
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
  }) });
  return messages;
}

async function configuredPayPalWebhookId() {
  if (process.env.PAYPAL_WEBHOOK_ID) return clean(process.env.PAYPAL_WEBHOOK_ID, 120);
  const saved = clean(await store.getSetting(paypalWebhookSettingKey), 120);
  const savedUrl = clean(await store.getSetting(paypalWebhookUrlSettingKey), 300);
  if (savedUrl && savedUrl !== paypalWebhookUrl) return '';
  return saved;
}

async function webhookStatus() {
  return {
    configured: Boolean(await configuredPayPalWebhookId()),
    url: paypalWebhookUrl
  };
}

function paypalCredentialsConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && !process.env.PAYPAL_CLIENT_ID.startsWith('replace_'));
}

async function ensurePayPalWebhook() {
  if (process.env.PAYPAL_WEBHOOK_ID) return clean(process.env.PAYPAL_WEBHOOK_ID, 120);
  if (!paypalCredentialsConfigured()) return '';

  const saved = clean(await store.getSetting(paypalWebhookSettingKey), 120);
  const savedUrl = clean(await store.getSetting(paypalWebhookUrlSettingKey), 300);
  const listed = await paypal('/v1/notifications/webhooks', 'GET');
  const webhooks = Array.isArray(listed.webhooks) ? listed.webhooks : [];
  const existing = webhooks.find(item => item.url === paypalWebhookUrl);
  const savedWebhook = saved ? webhooks.find(item => item.id === saved) : null;
  if (!existing && saved && savedUrl === paypalWebhookUrl && savedWebhook) return saved;

  const webhook = existing || await paypal('/v1/notifications/webhooks', 'POST', {
    url: paypalWebhookUrl,
    event_types: [
      { name: 'PAYMENT.CAPTURE.COMPLETED' }
    ]
  });

  const webhookId = clean(webhook?.id, 120);
  if (!webhookId) throw Error('PayPal webhook setup did not return a webhook ID');
  await store.setSetting(paypalWebhookSettingKey, webhookId);
  await store.setSetting(paypalWebhookUrlSettingKey, paypalWebhookUrl);
  return webhookId;
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
  const webhookId = await configuredPayPalWebhookId();
  if (!webhookId) return false;
  const headers = webhookHeaders(req);
  if (Object.values(headers).some(value => !value)) return false;

  const result = await paypal('/v1/notifications/verify-webhook-signature', 'POST', {
    ...headers,
    webhook_id: webhookId,
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
  const paidOrder = await store.markPaid(order.id, capture, paidOrderMessages, mode);
  if (store.type === 'postgres') {
    void drainNotifications();
  } else if (paidOrder?.paymentCompletedNow) {
    for (const message of paidOrderMessages(paidOrder)) {
      await deliverEmail(message.payload).catch(() => console.warn('Payment notification could not be sent'));
    }
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

// This saves an idea for owner review. It never creates or captures a PayPal order.
app.post('/api/enquiries', enquiryLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const packageId = clean(req.body?.packageId, 30);
  const pkg = catalog[packageId];
  const name = clean(req.body?.name, 100);
  const email = clean(req.body?.email, 254).toLowerCase();
  const contact = clean(req.body?.contact, 120);
  const brief = clean(req.body?.brief, 4000);
  const id = clean(req.body?.requestId, 50);
  if (!pkg || name.length < 2 || !validEmail(email) || brief.length < 15 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id) || clean(req.body?.website, 200)) {
    return fail(res, 400, 'Enter a valid name, email, package and idea of at least 15 characters.');
  }
  try {
    const record = await store.createEnquiry({
      id, packageId, name, email, contact, brief,
      amount: pkg.price, currency: 'USD', createdAt: new Date().toISOString()
    }, order => {
      if (isTestOrder(order) || !canSendNotificationTo(adminEmail())) return [];
      return [{ kind: 'enquiry-admin', payload: emailPayload({
        to: adminEmail(), subject: 'استفسار فيديو جديد — لم يتم الدفع | Qalam Motion',
        replyTo: resendTestMode() ? '' : order.email,
        text: ['New video enquiry — NO PAYMENT', `Reference: ${order.id}`, `Name: ${order.name}`,
          `Email: ${order.email}`, `Contact: ${order.contact || '-'}`, `Package: ${order.packageId}`,
          `Listed price: ${order.amount} USD (not charged)`, order.brief,
          `Review and reply: ${publicBaseUrl}/admin.html`].join('\n')
      }) }];
    });
    void drainNotifications();
    res.json({ enquiryId: record.id, status: 'ENQUIRY' });
  } catch (error) {
    if (error.status === 409) return fail(res, 409, 'Request reference already used. Reload the page before sending a different idea.');
    console.warn('Enquiry could not be saved');
    fail(res, 503, 'Could not save your idea. Please try again later or contact support by email.');
  }
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
            return_url: `${publicBaseUrl}/?payment=return&orderId=${encodeURIComponent(localId)}`,
            cancel_url: `${publicBaseUrl}/?payment=cancel&orderId=${encodeURIComponent(localId)}`
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
      paymentMode: mode,
      internalTest: false,
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

app.post('/api/orders/:orderRef/capture', async (req, res) => {
  const orderRef = clean(req.params.orderRef, 120);
  const record = await store.findByPayPalOrderId(orderRef) || await store.findById(orderRef);
  if (!record) return fail(res, 404, 'Order not found');
  if (record.status === 'ENQUIRY') return fail(res, 409, 'This is an enquiry, not a payment order. Agree the project details before starting a separate checkout.');
  if (record.status === 'PAID') return res.json({ status: 'PAID', orderId: record.id, statusUrl: orderUrl(record) });
  if (normalizePaymentMode(record.paymentMode) !== 'unknown' && record.paymentMode !== mode) {
    return fail(res, 409, 'This order belongs to a different PayPal environment. Contact support; do not pay it again.');
  }

  try {
    // PayPal is authoritative. Never trust a client-side success redirect alone.
    const result = await capturePayPalOrder(record);
    const capture = verifiedCapture(result, record);

    if (!capture) {
      return fail(res, 409, 'Payment has not been verified. Contact support.');
    }

    const paidOrder = await finishPaidOrder(record, capture);
    res.json({ status: 'PAID', orderId: paidOrder.id, statusUrl: orderUrl(paidOrder) });
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not confirm payment. Do not pay again; contact support with your order reference.');
  }
});

app.post('/api/paypal/webhook', async (req, res) => {
  try {
    if (!(await configuredPayPalWebhookId())) {
      return fail(res, 503, 'PayPal webhook is not configured');
    }

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

app.get('/api/admin/paypal-account', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;
  if (!paypalCredentialsConfigured()) return fail(res, 503, 'PayPal credentials are not configured');
  try {
    const result = await inspectPayPalReceiver({
      mode,
      listOrders: () => store.listOrders(),
      readOrder: id => paypal(`/v2/checkout/orders/${encodeURIComponent(id)}`, 'GET')
    });
    res.json(result);
  } catch (error) {
    console.warn('PayPal receiving account verification failed');
    fail(res, 502, 'Could not verify the PayPal receiving account. No payment was made.');
  }
});

app.get('/api/admin/orders', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const orders = await store.listOrders();
  res.set('Cache-Control', 'no-store').json(orders.map(adminOrder));
});

app.get('/api/admin/notifications', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json(store.type === 'postgres' ? await store.notificationSummary() : { persistent: false, accepted: 0, pending: 0, failed: 0 });
  } catch {
    fail(res, 503, 'Could not read notification status');
  }
});

async function adminSessionPayload() {
  return {
    authenticated: true,
    emailConfigured: emailsConfigured(),
    emailTestMode: resendTestMode(),
    webhookConfigured: (await webhookStatus()).configured
  };
}

app.get('/api/admin/session', async (req, res) => {
  if (!adminAuthorized(req)) return fail(res, 401, 'Unauthorized');
  res.set('Cache-Control', 'no-store').json(await adminSessionPayload());
});

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  const token = clean(req.body?.token, 500);
  if (!adminTokenMatches(token)) return fail(res, 401, 'Unauthorized');
  setAdminSession(res);
  res.set('Cache-Control', 'no-store').json(await adminSessionPayload());
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminSession(res);
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

app.post('/api/admin/paypal-webhook/setup', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const webhookId = await ensurePayPalWebhook();
    if (!webhookId) return fail(res, 503, 'PayPal credentials are not configured');
    res.set('Cache-Control', 'no-store').json({
      webhookConfigured: true,
      webhookUrl: paypalWebhookUrl
    });
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not configure PayPal webhook');
  }
});

app.post('/api/admin/email-test', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (!emailsConfigured()) {
    return fail(res, 503, 'Email is not configured');
  }

  const recipient = clean(req.body?.email || process.env.ADMIN_EMAIL || '', 254);
  if (!validEmail(recipient)) return fail(res, 400, 'Admin email is not configured');

  try {
    await sendEmail({
      to: recipient,
      subject: 'Qalam Motion email test',
      replyTo: supportEmail,
      text: [
        'Qalam Motion email is configured correctly.',
        '',
        `Dashboard: ${publicBaseUrl}/admin.html`,
        `Time: ${new Date().toISOString()}`
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f1f">
          <h2>Qalam Motion email is configured correctly.</h2>
          <p>This test confirms that the website can send email through Resend.</p>
          <p><a href="${publicBaseUrl}/admin.html">Open admin dashboard</a></p>
        </div>
      `
    });
    res.set('Cache-Control', 'no-store').json({ sent: true, to: recipient });
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not send test email');
  }
});

app.post('/api/setup/email-domain', async (req, res) => {
  if (!requireSetup(req, res)) return;

  try {
    const domain = await ensureResendDomain();
    res.set('Cache-Control', 'no-store').json(publicResendDomain(domain));
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not set up Resend domain');
  }
});

app.post('/api/setup/email-domain/verify', async (req, res) => {
  if (!requireSetup(req, res)) return;

  try {
    const domain = await ensureResendDomain();
    await resendApi(`/domains/${encodeURIComponent(domain.id)}/verify`, 'POST');
    const refreshed = await resendApi(`/domains/${encodeURIComponent(domain.id)}`, 'GET');
    res.set('Cache-Control', 'no-store').json(publicResendDomain(refreshed));
  } catch (error) {
    console.error(error);
    fail(res, 502, 'Could not verify Resend domain');
  }
});

app.patch('/api/admin/orders/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const updates = {};
  if (Object.hasOwn(req.body || {}, 'internalTest')) {
    if (typeof req.body.internalTest !== 'boolean') return fail(res, 400, 'Invalid test-order flag');
    updates.internalTest = req.body.internalTest;
  }
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

