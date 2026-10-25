# Shopify Invoice Automation — Backend

A Node.js/Express/TypeScript service that listens for Shopify order-payment webhooks, generates a PDF invoice on demand, stores order data in MongoDB, and emails the invoice to the customer automatically. A JWT-protected API serves the data to a separate React dashboard.

**Live API:** https://invoice-generation-backend.onrender.com
**Frontend dashboard:** https://invoice-dashboard-sepia-eta.vercel.app
**Frontend repo:** [Invoice-dashboard](https://github.com/Bharat235-beep/Invoice-dashboard)

> Note: the backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request after idle time may take 30–60 seconds to respond.

## Known limitation

Email delivery uses Resend's sandbox mode, which only allows sending to the email address the Resend account was registered with. This affects both the public demo route and the invoice emails triggered by Shopify orders: for any other recipient the send is rejected, and the invoice is saved with a `failed` status and the provider's error message. Sending to arbitrary recipients requires verifying a custom sending domain (DNS-level verification) and changing the `from` address to that domain, which hasn't been set up for this project. This is a configuration step, not a code or architecture change.

## What it does

1. A Shopify custom app is installed on a development store with `orders/paid` webhook access.
2. When an order is marked paid, Shopify sends a signed webhook to this API.
3. The request is verified using HMAC-SHA256 against the app's client secret, so forged requests are rejected before any processing happens.
4. Order data (customer, line items, total) is saved to MongoDB.
5. A PDF invoice is generated in memory using PDFKit — nothing is written to disk, so it works cleanly on ephemeral hosting.
6. The invoice is emailed to the customer via Resend.
7. If the email fails, the order record is still saved with a `failed` status and error message, so it can be identified and retried rather than silently lost.

A `GET /api/invoices/:id/pdf` route regenerates the same PDF on demand for the dashboard's download button, using the same generation function — so the emailed copy and the downloaded copy are always identical.

## Authentication

- `POST /api/auth/login` checks the email and password against a bcrypt-hashed password stored in MongoDB and returns a signed JWT (valid for one day)
- Two roles exist: `admin` and `demo`. The role is stored in the token, and a `requireAdmin` middleware is ready for any route that modifies data
- A `requireAuth` middleware protects `/api/invoices` and `/api/invoices/:id/pdf`, rejecting missing, malformed, expired or tampered tokens with a 401
- The login route is rate-limited to 10 attempts per 15 minutes per IP, and returns the same error for an unknown email and a wrong password, so it doesn't reveal which emails exist
- There is no public signup: users are created by a seed script, which validates its inputs and refuses to run if the admin and demo emails match
- The Shopify webhook is protected separately by HMAC verification, and the public demo-email route by rate limiting

## Tech stack and key decisions

- **Express with TypeScript** — REST API and webhook receiver. The codebase was migrated from JavaScript to TypeScript incrementally, file by file, with `strict` mode enabled
- **Shopify GraphQL Admin API** — used instead of REST, since the REST Admin API was deprecated for new apps as of April 2025
- **MongoDB / Mongoose** — order, invoice and user persistence, with `shopifyOrderId` as a unique key to make webhook retries idempotent (Shopify does not guarantee exactly-once delivery)
- **PDFKit**, not Puppeteer — invoices are structured documents, not rendered web pages, so a lightweight, no-browser-dependency library was a better fit than bundling headless Chromium
- **Resend**, not Nodemailer/SMTP — the backend is deployed on Render's free tier, which blocks outbound SMTP traffic (ports 465/587) to prevent abuse. Resend sends over HTTPS instead of SMTP, which avoids that restriction entirely
- **JWT and bcrypt** for authentication (see above)
- **express-rate-limit** on the login route and on the public demo endpoint, to prevent brute-force attempts and abuse of a route that sends real email to arbitrary addresses

## API routes

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public, rate-limited | Returns a JWT for valid credentials |
| GET | `/api/invoices` | Requires login | List all processed invoices |
| GET | `/api/invoices/:id/pdf` | Requires login | Regenerate and stream a specific invoice PDF |
| POST | `/webhooks/orders/paid` | HMAC-verified | Shopify webhook receiver |
| POST | `/api/demo/send-invoice` | Public, rate-limited | Sends a sample invoice PDF to an email address, limited to 3 requests/hour per IP. See "Known limitation" above. |

## Environment variables

```
MONGODB_URI=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_SECRET=
SHOP_NAME=
API_VERSION=
RESEND_API_KEY=
JWT_SECRET=
PORT=
```

Only the seed script uses these, and only locally: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_EMAIL`, `DEMO_PASSWORD`.

## Notable issues solved during development

- **Module-load-time environment variable bug** — the email client was being constructed once, at module import time, before `dotenv.config()` had necessarily run in every require order. Fixed by constructing the client lazily, inside the function, on each call.
- **MongoDB defaulting to the `test` database** — a non-SRV connection string (used to work around a local DNS/SRV resolution issue) omitted the database name. Fixed by passing `dbName` explicitly as a connect option rather than embedding it in the URI string.
- **IPv6 SMTP failure on Render** (`ENETUNREACH`) — Nodemailer attempted to connect to Gmail's SMTP server over IPv6, which Render's network doesn't route correctly. This, combined with Render blocking outbound SMTP ports on the free tier, led to switching email delivery to Resend's HTTP API entirely.
- **`express-rate-limit` + Render's reverse proxy** — Render sits the app behind a proxy that sets `X-Forwarded-For`; Express doesn't trust proxy headers by default, so the rate limiter refused to trust the header. Fixed with `app.set('trust proxy', 1)`, trusting exactly one proxy hop rather than any proxy in the chain.
- **Login failing with the correct password** — `dotenv` treats an unquoted `#` as the start of a comment, so the seeded password was silently truncated and every login attempt was compared against the wrong hash. Found by comparing password lengths in the seed script and at login without printing the password, and fixed by quoting the value.
- **Mongoose runtime fields invisible to TypeScript** — `timestamps: true` adds `createdAt` and `updatedAt` at runtime, but the type system only knows what the interface declares, so they had to be added to the document interface explicitly.

## Running locally

```bash
npm install
# add a .env file with the variables listed above
npm run build
npm start
```

To create the admin and demo users, set the four seed variables in `.env` and run the seed script once:

```bash
npx tsx src/scripts/seedAdmin.ts
```

Quote any `.env` value that contains `#`, spaces or `$`, and remove the seed passwords from `.env` afterwards.