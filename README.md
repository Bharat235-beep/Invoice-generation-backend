# Shopify Invoice Automation — Backend

A Node.js/Express service that listens for Shopify order-payment webhooks, generates a PDF invoice on demand, stores order data in MongoDB, and emails the invoice to the customer automatically.

**Live API:** https://invoice-generation-backend.onrender.com
**Frontend dashboard:** https://invoice-dashboard-sepia-eta.vercel.app
**Frontend repo:** [Invoice-dashboard](https://github.com/Bharat235-beep/Invoice-dashboard)

> Note: the backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request after idle time may take 30–60 seconds to respond.

## What it does

1. A Shopify custom app is installed on a development store with `orders/paid` webhook access.
2. When an order is marked paid, Shopify sends a signed webhook to this API.
3. The request is verified using HMAC-SHA256 against the app's client secret, so forged requests are rejected before any processing happens.
4. Order data (customer, line items, total) is saved to MongoDB.
5. A PDF invoice is generated in memory using PDFKit — nothing is written to disk, so it works cleanly on ephemeral hosting.
6. The invoice is emailed to the customer via Resend.
7. If the email fails, the order record is still saved with a `failed` status and error message, so it can be identified and retried rather than silently lost.

A `GET /api/invoices/:id/pdf` route regenerates the same PDF on demand for the dashboard's download button, using the same generation function — so the emailed copy and the downloaded copy are always identical.

## Tech stack and key decisions

- **Express** — REST API, webhook receiver
- **Shopify GraphQL Admin API** — used instead of REST, since the REST Admin API was deprecated for new apps as of April 2025
- **MongoDB / Mongoose** — order and invoice persistence, with `shopifyOrderId` as a unique key to make webhook retries idempotent (Shopify does not guarantee exactly-once delivery)
- **PDFKit**, not Puppeteer — invoices are structured documents, not rendered web pages, so a lightweight, no-browser-dependency library was a better fit than bundling headless Chromium
- **Resend**, not Nodemailer/SMTP — the backend is deployed on Render's free tier, which blocks outbound SMTP traffic (ports 465/587) to prevent abuse. Resend sends over HTTPS instead of SMTP, which avoids that restriction entirely
- **express-rate-limit** on the public demo endpoint, to prevent abuse of a route that sends real email to arbitrary addresses

## API routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/invoices` | List all processed invoices |
| GET | `/api/invoices/:id/pdf` | Regenerate and stream a specific invoice PDF |
| POST | `/webhooks/orders/paid` | Shopify webhook receiver (HMAC-verified) |
| POST | `/api/demo/send-invoice` | Public demo route — sends a sample invoice PDF to any email, rate-limited to 3 requests/hour per IP |

## Environment variables

```
MONGODB_URI=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_SECRET=
SHOP_NAME=
API_VERSION=
RESEND_API_KEY=
PORT=
```

## Notable issues solved during development

- **Module-load-time environment variable bug** — the email transporter was being constructed once, at module import time, before `dotenv.config()` had necessarily run in every require order. Fixed by constructing the client lazily, inside the function, on each call.
- **MongoDB defaulting to the `test` database** — a non-SRV connection string (used to work around a local DNS/SRV resolution issue) omitted the database name. Fixed by passing `dbName` explicitly as a connect option rather than embedding it in the URI string.
- **IPv6 SMTP failure on Render** (`ENETUNREACH`) — Nodemailer attempted to connect to Gmail's SMTP server over IPv6, which Render's network doesn't route correctly. This, combined with Render blocking outbound SMTP ports on the free tier, led to switching email delivery to Resend's HTTP API entirely.
- **`express-rate-limit` + Render's reverse proxy** — Render sits the app behind a proxy that sets `X-Forwarded-For`; Express doesn't trust proxy headers by default, so the rate limiter refused to trust the header. Fixed with `app.set('trust proxy', 1)`, trusting exactly one proxy hop rather than any proxy in the chain.

## Running locally

```bash
npm install
# add a .env file with the variables listed above
node index.js
```