# Qalam Motion operations

The existing Railway production service deploys this repository's `main` branch.
The homepage design and current packages remain the approved source of truth:
$15 for 40–45 seconds and $25 for 60–75 seconds, one revision within the agreed
idea, and Arabic voiceover on request. Production is supervised; videos are not
generated automatically by this website.

## Payments and order records

- Keep PayPal credentials and mode in Railway variables. Never commit, print, or
  paste credentials into issues, screenshots, or chat.
- Each new order records its actual PayPal environment. Legacy orders remain
  `unknown`; they are not silently reclassified as live sales.
- The authenticated admin dashboard defaults to customer orders. Sandbox,
  reserved example email addresses, and orders explicitly marked as internal
  tests are excluded from customer sales totals. All records remain available.
- Use the admin receiving-account check to read the seller/payee of an existing
  PayPal order. It never creates or captures a payment. An unpaid owner-only
  checkout verified the intended live recipient on 2026-10-17; no charge was made.
- Never repay or recapture a previously completed order. PayPal capture IDs and
  the existing amount, currency, order-reference, and webhook-signature checks
  remain authoritative.
- Refunds, disputes, chargebacks and bank withdrawals require review in the
  merchant's PayPal account. This admin dashboard does not execute them.

## Paid-order emails

For PostgreSQL, the verified payment record and its admin/customer notification
jobs commit in the same transaction. No email job is backfilled for old paid
records or created for an unpaid checkout or a known test order.

The worker runs at startup, after verified payment and every 30 seconds. Each job
has a two-minute claim lease; each email request times out after 15 seconds.
Retries preserve the original payload and a stable Resend idempotency key.
They back off from one minute to one hour and stop after eight attempts or
23 hours from the first attempt. Expired or exhausted jobs require owner review;
they are not blindly resent after the provider's 24-hour deduplication window.

The private dashboard shows pending and failed notification counts. Provider
acceptance is not proof of inbox delivery; the customer's email account may
still reject or filter mail. Existing emails and historical test notifications
are not resent by deploying this change.

## Database and deployment

- Startup adds missing columns and the notification table; it does not delete
  orders, payments, settings, or the PostgreSQL volume. Migrations are repeatable.
- On Railway, missing `DATABASE_URL` fails startup rather than falling back to
  ephemeral JSON storage. JSON remains a local-development fallback; its email
  notifications do not have the production database queue's durability.
- Railway's deployment healthcheck uses `/health`, which checks the database.
- Before release: `npm ci`, `npm run check`, `npm test`. Database tests execute
  PostgreSQL through PGlite, including migration, rollback, restart, retries,
  leases and duplicate-payment handling. Payment/email HTTP tests use local
  fixtures that reject unrecognized external calls.
- After release: observe the correct commit's Railway deployment reach SUCCESS,
  check `/health`, check the private admin dashboard, and check the public site.

## Remaining owner decisions before a full commercial launch

The public terms/privacy/refund pages still explicitly identify themselves as
drafts. Publishing final promises needs owner approval. A proposed operating
policy, consistent with the homepage, is:

1. Review a paid brief and agree the written scope and delivery date before
   production begins; do not promise an unapproved fixed turnaround.
2. Include one revision within the original idea, as advertised. Obtain approval
   before any work or cost outside that scope.
3. Offer a full refund if the customer cancels before production starts, or if
   Qalam Motion declines the brief. After production starts, agree a fair refund
   based on work completed, subject to applicable consumer rights. Never state
   that statutory rights are waived.
4. Obtain customer permission before using their work publicly in a portfolio.
   Document the seller's required business identity and contact details, actual
   privacy/data-retention practices, and any legal requirements before removing
   the draft notices.

The operator must confirm backup coverage and a restore procedure in the existing
Postgres volume's Railway backup settings. Current connector access cannot list
volume backup schedules or read billing. Automated backups and point-in-time
recovery may incur storage charges; do not enable them without cost approval.

Standalone card acceptance remains dependent on provider onboarding. Do not
advertise guaranteed card checkout while relying only on PayPal's account- and
buyer-dependent checkout options. Keep the existing Payzone inquiry pending
rather than creating duplicate applications or financial accounts.

Domain auto-renewal and subscription changes require owner approval of future
charges. Do not change them as part of an ordinary code deployment.
