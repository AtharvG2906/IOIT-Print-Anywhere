# IOIT Print Anywhere

Students upload a PDF, choose a page range and up to 10 copies (**A4, black & white, ₹1/page**),
and pay the exact amount with **Razorpay** (a fixed-amount UPI QR, or Checkout).
They get a **printing code**. A Windows PC next to the printer prints the job automatically,
with a **cover page** (name, PRN, code) in front, and the student gets an **email when it's ready**.
At pickup, the desk checks the cover page against the student's college ID card.

```
Student browser ─► Next.js app ─► Postgres
                     │ ├─ Razorpay (orders, fixed-amount QR, webhooks)
                     │ ├─ File storage (local disk / S3 / Cloudflare R2)
                     │ └─ Resend (email OTP + notifications)
                     ▲
     HTTPS polling   │  (Bearer AGENT_API_KEY)
Windows PC ── agent/agent.mjs ─► SumatraPDF ─► Printer
```

## Features

- **Create account:** step 1, the student enters their email, gets a 6-digit code (sent with Resend) and
  verifies it. Step 2, they fill in name, academic year, PRN, department, class, batch, phone, address,
  a password and a **photo of their college ID card**, then click **Create account**. They're logged in straight
  away and land on their **Dashboard**, and get a **welcome email**.
  - ID cards go into the admin's private **Google Drive folder** when Drive is set up (see below); otherwise into
    the normal file storage. Big phone photos are shrunk in the browser (max 4 MB).
  - Older accounts without an ID card aren't asked for one.
  - On localhost (`npm run dev`) the form can be submitted with empty fields; test values are filled in
    (password `password123`). Never active in production.
  - Codes expire after 5 minutes and allow 5 wrong tries. Only an HMAC-SHA256 hash (keyed with `OTP_SECRET`)
    is stored, and a code is deleted once used.
  - Limits: 60 s between sends, 3 per 10 minutes per email, 20 per hour per IP.
  - The site never says whether an email is already registered: such emails get a "you already have an
    account" email instead of a code.
  - Set `ALLOWED_EMAIL_DOMAIN` to restrict sign-up to college emails. PRN, phone and email must each be unique.
  - Endpoints: `POST /api/auth/otp/send` `{email}` and `POST /api/auth/otp/verify` `{email, code}`.
- **Dashboard:** each student sees only their own orders: queue position ("#2 in the queue · 1 person before
  you"), an estimated time (`PRINTER_PAGES_PER_MINUTE`, default 20), and an order summary. Never other students' details.
- **Log in:** with email or PRN plus password (no OTP). Lands on the Dashboard (admins on the Desk). Sessions end when the browser closes, or after 2 hours idle.
  Students can reset a forgotten password with an email OTP.
- **Print:** PDF only, with the size and page limits shown in the upload area.
  The server checks the file really is a PDF, rejects encrypted or damaged files, and warns when pages
  aren't A4 (they're scaled to fit). The server always calculates the price itself.
- **Pay:** after upload the student goes straight to the payment page, which shows a single-use Razorpay
  UPI QR for the exact amount plus a Razorpay Checkout button. Payment is confirmed by signature check
  or webhook, safely if both arrive. Unpaid orders expire after 30 minutes and never print.
- **Print agent:** prints the cover page, then the document (A4, monochrome, page range, copies), and waits
  for the Windows print queue to empty before marking the order ready. Jobs are retried 3 times, then
  marked Failed for the desk.
- **Desk dashboard** (`/admin`): look up a printing code to see the student's details and college ID photo,
  then mark it collected. It also has a live queue, reprint for failed jobs, printer online/offline status,
  pause/resume orders, price and limit settings, and student search with block/unblock.
- **Housekeeping:** files are deleted 24 h after pickup and 48 h after an unpaid order expires.

## Run locally

Needs Node.js 20+. No Docker is required, because Prisma runs a local Postgres for you.

```bash
npm install
npm run db:dev                 # starts a local Postgres (prisma dev) in the background
cp .env.example .env           # then set SESSION_SECRET, OTP_SECRET and AGENT_API_KEY (openssl rand -hex 32)
npx prisma migrate dev         # creates the tables
npm run dev                    # http://localhost:3000
```

In development:

- **OTPs and emails** are printed in the terminal when `RESEND_API_KEY` is empty. OTP codes also appear
  **on screen** in a yellow "Dev mode" box with a *Fill it in* button. This never shows in production
  or once Resend is set up.
- **Skipping OTPs:** set `OTP_BYPASS="true"` in `.env` and any 6-digit code passes verification.
  It is ignored in production.
- **Payments:** with no Razorpay keys set, the pay page shows a **"Simulate payment"** button.
- **Admin access:** add your email to `ADMIN_EMAILS` and log in. You'll see **Desk** in the header.
- **Print agent:** to try it locally, copy `agent/agent.config.example.json` to `agent/agent.config.json`,
  set `serverUrl` to `http://localhost:3000`, `apiKey` to your `AGENT_API_KEY` and `"dryRun": true`,
  then run `node agent/agent.mjs`. Outside Windows it always runs in dry-run mode.

Tests: `npm test` (unit tests) · `npm run typecheck` · `npm run lint` · `npm run build`

## Going live

1. **Database:** any managed Postgres (Neon, Supabase, Railway, etc.). Set `DATABASE_URL`, remove
   `DATABASE_POOL_MAX`. Vercel builds run `prisma migrate deploy` automatically (see `vercel.json`).
   On Neon, migrations use the direct connection in `DATABASE_URL_UNPOOLED` (set by Vercel's Neon
   integration; copy it from Neon → Connect with pooling off if missing). The app uses `DATABASE_URL`.
2. **Hosting:** Vercel, Railway or any Node host. Set every variable from `.env.example` and set
   `APP_URL` to your domain.
3. **File storage:** `STORAGE_DRIVER=s3` with a private Cloudflare R2 or S3 bucket.
   Local disk only works on a single server with a persistent disk.
4. **Razorpay:**
   - Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use test keys first.
   - Ask Razorpay to **enable QR Codes** on your account.
   - Add a webhook pointing to `https://<your-domain>/api/webhooks/razorpay`, subscribed to
     `payment.captured`, `order.paid` and `qr_code.credited`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`.
5. **Email (OTPs and notifications):** verify your sending domain in Resend (without one, Resend only
   delivers to your own account address). Set `RESEND_API_KEY`, `OTP_FROM` (OTP sender), `EMAIL_FROM`
   (other emails), `OTP_SECRET`, and optionally `ALLOWED_EMAIL_DOMAIN`. OTP emails are tagged
   `category: otp` in Resend.
6. **College ID cards in Google Drive (optional):**
   1. [Google Cloud Console](https://console.cloud.google.com/) → new project → *APIs & Services → Library* → enable **Google Drive API**.
   2. *OAuth consent screen* → External → fill in the app name and your email → add yourself as a user →
      **Publish app** (status "In production"; in "Testing" the sign-in expires every 7 days).
   3. *Credentials → Create credentials → OAuth client ID → Desktop app*. Put the Client ID and secret in `.env`
      as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
   4. Run `npm run drive:setup`, sign in with the account that **owns** the folder and click Allow (on
      "Google hasn't verified this app" choose *Advanced → Go to …*). It saves `GOOGLE_REFRESH_TOKEN` into `.env`.
   5. Copy `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` into Vercel
      and redeploy. Keep the folder's sharing **Restricted**.
7. **Printer PC:** follow [`agent/README.md`](agent/README.md).
8. **Optional backup cron:** `GET /api/cron/maintenance` with `Authorization: Bearer <CRON_SECRET>`.
   The agent heartbeat already runs maintenance every minute.

## Project layout

```
app/                pages (signup, login, print, orders, admin) and app/api/* route handlers
app/actions/        server actions: auth (signup/OTP/login/reset) and admin
lib/                auth, otp, rateLimit, email, razorpay, orders (payment, ready, maintenance), pdf
                    (validation and cover page), pageRange, pricing, printingCode, storage, settings
prisma/             schema and migrations
agent/              Windows print agent (no dependencies) and service installer
tests/              unit tests (Vitest)
```
