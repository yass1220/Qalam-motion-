# Qalam Motion

Four-language illustrated studio website for Qalam Motion, with the existing Express order, payment, email and administration services.

## What It Includes

- Express server with PayPal Checkout order creation and capture.
- PostgreSQL order storage when `DATABASE_URL` is set.
- Local JSON order storage fallback for development.
- Localized studio pages at `/en`, `/ar`, `/fr`, `/es`.
- Original enquiry/checkout page at `/order.html`; in-flight payment returns remain supported.
- Admin orders page at `/admin.html`, protected by `ADMIN_TOKEN`.
- Customer order tracking page at `/status.html`.
- Optional email notifications through Resend.
- PayPal webhook setup for capture confirmation.
- Health check at `/health`.

## Local Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open `http://localhost:3000`. For the combined production server, run `pnpm build` then `pnpm start`. `pnpm dev:backend` starts only the existing backend for local business-flow work.

Validation: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`. The release checks run against isolated local data.

## Required Environment Variables

| Variable | Purpose |
| --- | --- |
| `PAYPAL_MODE` | `sandbox` for testing or `live` for real payments. |
| `PAYPAL_CLIENT_ID` | PayPal REST app client ID. |
| `PAYPAL_CLIENT_SECRET` | PayPal REST app secret. |
| `PUBLIC_BASE_URL` | Public site URL, for example the Railway app URL. |
| `ADMIN_TOKEN` | Long private token used to open `/admin.html`. |
| `DATABASE_URL` | Optional PostgreSQL URL. Railway Postgres can provide this automatically. |
| `PGSSLMODE` | Optional. Use `require` only when the database provider requires SSL. |
| `RESEND_API_KEY` | Optional. Enables order confirmation emails when set with `EMAIL_FROM`. |
| `EMAIL_FROM` | Optional sender address for customer/admin order emails. |
| `ADMIN_EMAIL` | Optional destination for admin order notifications. |
| `SUPPORT_EMAIL` | Optional reply-to/support address shown in customer emails. |
| `PAYPAL_WEBHOOK_ID` | Optional. The app can auto-create and store a Sandbox webhook; set this only if managing it manually. |

## Railway Notes

1. Use the existing Railway project and service.
2. Attach or keep the existing PostgreSQL service for durable orders.
3. Keep the existing environment variables; do not commit secret values to GitHub.
4. Set `PUBLIC_BASE_URL` to the Railway public domain.
5. Keep `PAYPAL_MODE=sandbox` until testing is complete.
6. Switch to `PAYPAL_MODE=live` only after adding live PayPal credentials and approving the change.
7. Add Resend email variables only when you are ready for customer emails; the checkout flow works without them.

The app still works without PostgreSQL, but local JSON storage is not recommended for production because platform filesystems can be temporary.
