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

- **Create account:** name, academic year, PRN, department, class, batch, phone, email, address and password.
  A **Send OTP** button next to the email field emails a 6-digit code at once. The student enters it on the same
  form and clicks **Create account**. They then get a **welcome email** and upload their college ID.
  Any email domain can sign up. PRN, phone and email must each be unique. OTPs are rate limited
  (30 s resend, 5 per hour per email, 20 per hour per IP address).
- **Log in:** with email or PRN plus password. Sessions end when the browser closes, or after 2 hours idle.
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
cp .env.example .env           # then set SESSION_SECRET and AGENT_API_KEY (openssl rand -hex 32)
npx prisma migrate dev         # creates the tables
npm run dev                    # http://localhost:3000
```

In development:

- **OTPs and emails** are printed in the terminal (`EMAIL_PROVIDER=console`). OTP codes also appear
  **on screen** in a yellow "Dev mode" box with a *Fill it in* button. This never shows in production
  or once Resend is set up.
- **Skipping OTPs:** set `OTP_BYPASS="true"` in `.env` to create accounts without a code (the box is prefilled
  with `000000` and any number works). It is ignored in production.
- **Payments:** with no Razorpay keys set, the pay page shows a **"Simulate payment"** button.
- **Admin access:** add your email to `ADMIN_EMAILS` and log in. You'll see **Desk** in the header.
- **Print agent:** to try it locally, copy `agent/agent.config.example.json` to `agent/agent.config.json`,
  set `serverUrl` to `http://localhost:3000`, `apiKey` to your `AGENT_API_KEY` and `"dryRun": true`,
  then run `node agent/agent.mjs`. Outside Windows it always runs in dry-run mode.

Tests: `npm test` (unit tests) · `npm run typecheck` · `npm run lint` · `npm run build`

## Going live

1. **Database:** any managed Postgres (Neon, Supabase, Railway, etc.). Set `DATABASE_URL`, remove
   `DATABASE_POOL_MAX`, and run `npx prisma migrate deploy`.
2. **Hosting:** Vercel, Railway or any Node host. Set every variable from `.env.example` and set
   `APP_URL` to your domain.
3. **File storage:** `STORAGE_DRIVER=s3` with a private Cloudflare R2 or S3 bucket.
   Local disk only works on a single server with a persistent disk.
4. **Razorpay:**
   - Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use test keys first.
   - Ask Razorpay to **enable QR Codes** on your account.
   - Add a webhook pointing to `https://<your-domain>/api/webhooks/razorpay`, subscribed to
     `payment.captured`, `order.paid` and `qr_code.credited`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`.
5. **Email (OTPs and notifications):** `EMAIL_PROVIDER=resend`. Verify your sending domain in Resend
   (without one, Resend only delivers to your own account address) and set `RESEND_API_KEY`
   and `EMAIL_FROM`.
6. **Printer PC:** follow [`agent/README.md`](agent/README.md).
7. **Optional backup cron:** `GET /api/cron/maintenance` with `Authorization: Bearer <CRON_SECRET>`.
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
