# Qalam Motion

Arabic landing page and checkout flow for Qalam Motion, a hand-drawn video service.

## What It Includes

- Express server with PayPal Checkout order creation and capture.
- PostgreSQL order storage when `DATABASE_URL` is set.
- Local JSON order storage fallback for development.
- Public Arabic landing page in `public/index.html`.
- Admin orders page at `/admin.html`, protected by `ADMIN_TOKEN`.
- Health check at `/health`.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

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

## Railway Notes

1. Use the existing Railway project and service.
2. Attach or keep the existing PostgreSQL service for durable orders.
3. Keep the existing environment variables; do not commit secret values to GitHub.
4. Set `PUBLIC_BASE_URL` to the Railway public domain.
5. Keep `PAYPAL_MODE=sandbox` until testing is complete.
6. Switch to `PAYPAL_MODE=live` only after adding live PayPal credentials and approving the change.

The app still works without PostgreSQL, but local JSON storage is not recommended for production because platform filesystems can be temporary.
