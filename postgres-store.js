import { Pool } from 'pg';
import { normalizePaymentMode } from './public/admin-order-utils.js';
import { notificationJobs } from './email-outbox.js';

export function createPostgresStore({ pool: suppliedPool, connectionString = process.env.DATABASE_URL } = {}) {
  const sslMode = process.env.PGSSLMODE || new URL(connectionString || 'postgres://localhost/qalam').searchParams.get('sslmode');
  const pool = suppliedPool || new Pool({
    connectionString,
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
    await pool.query(`
      create table if not exists settings (
        key text primary key,
        value text not null,
        updated_at timestamptz not null default now()
      )
    `);
    await pool.query("alter table orders add column if not exists fulfillment_status text not null default 'NEW'");
    await pool.query("alter table orders add column if not exists admin_notes text not null default ''");
    await pool.query("alter table orders add column if not exists payment_mode text not null default 'unknown'");
    await pool.query("alter table orders add column if not exists internal_test boolean not null default false");
    await pool.query(`
      create table if not exists email_notifications (
        id text primary key,
        order_id text not null references orders(id),
        kind text not null,
        payload jsonb not null,
        attempts integer not null default 0,
        available_at timestamptz not null default now(),
        first_attempt_at timestamptz,
        locked_until timestamptz,
        sent_at timestamptz,
        failed_at timestamptz,
        provider_id text,
        created_at timestamptz not null default now()
      )
    `);
    await pool.query('create index if not exists email_notifications_due_idx on email_notifications (available_at) where sent_at is null and failed_at is null');
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
      paymentMode: normalizePaymentMode(row.payment_mode),
      internalTest: row.internal_test === true,
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
          (id, paypal_order_id, package_id, amount, currency, customer_name, email, contact, brief, status, created_at, payment_mode, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
        [order.id, order.paypalOrderId, order.packageId, order.amount, order.currency, order.name, order.email, order.contact, order.brief, order.status, order.createdAt, normalizePaymentMode(order.paymentMode)]
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
    async markPaid(orderId, capture, buildMessages = () => [], captureMode = 'unknown') {
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
             set status='PAID', capture_id=$2, paid_at=coalesce(paid_at, now()), updated_at=now(),
                 payment_mode=case when payment_mode='unknown' then $3 else payment_mode end
           where id=$1
           returning *`,
          [orderId, capture.id, normalizePaymentMode(captureMode)]
        );
        const order = rowToOrder(result.rows[0]);
        for (const job of notificationJobs(order, buildMessages(order))) {
          await client.query(
            `insert into email_notifications (id, order_id, kind, payload)
             values ($1,$2,$3,$4) on conflict (id) do nothing`,
            [job.id, job.orderId, job.kind, JSON.stringify(job.payload)]
          );
        }
        await client.query('commit');
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
               internal_test=coalesce($4, internal_test),
               updated_at=now()
         where id=$1
         returning *`,
        [orderId, updates.fulfillmentStatus ?? null, updates.adminNotes ?? null, updates.internalTest ?? null]
      );
      return rowToOrder(result.rows[0]);
    },
    async listOrders() {
      const result = await pool.query('select * from orders order by created_at desc limit 500');
      return result.rows.map(rowToOrder);
    },
    async health() {
      await pool.query('select 1');
    },
    async claimNotification() {
      const result = await pool.query(`
        update email_notifications set attempts=attempts+1,
          first_attempt_at=coalesce(first_attempt_at, now()),
          locked_until=now()+interval '2 minutes'
        where id=(
          select id from email_notifications
          where sent_at is null and failed_at is null and available_at<=now()
            and (locked_until is null or locked_until<=now())
          order by created_at, id for update skip locked limit 1
        ) returning *
      `);
      const row = result.rows[0];
      return row ? { id: row.id, payload: row.payload, attempts: row.attempts, firstAttemptAt: row.first_attempt_at } : null;
    },
    async completeNotification(job, messageId) {
      await pool.query(
        'update email_notifications set sent_at=now(), provider_id=$3, locked_until=null where id=$1 and attempts=$2',
        [job.id, job.attempts, messageId]
      );
    },
    async failNotification(job, { permanent, delaySeconds }) {
      await pool.query(
        `update email_notifications set locked_until=null,
          available_at=now()+($3 * interval '1 second'),
          failed_at=case when $4 then now() else null end
         where id=$1 and attempts=$2 and sent_at is null`,
        [job.id, job.attempts, delaySeconds, permanent]
      );
    },
    async notificationSummary() {
      const result = await pool.query(`
        select count(*) filter (where sent_at is not null)::integer as accepted,
          count(*) filter (where sent_at is null and failed_at is null)::integer as pending,
          count(*) filter (where failed_at is not null)::integer as failed
        from email_notifications
      `);
      return { persistent: true, ...result.rows[0] };
    },
    async getSetting(key) {
      const result = await pool.query('select value from settings where key=$1 limit 1', [key]);
      return result.rows[0]?.value || '';
    },
    async setSetting(key, value) {
      await pool.query(
        `insert into settings (key, value, updated_at)
         values ($1, $2, now())
         on conflict (key) do update set value=excluded.value, updated_at=now()`,
        [key, value]
      );
    }
  };
}
