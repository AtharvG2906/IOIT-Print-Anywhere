import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; html: string; text: string };
type SendOptions = { from?: string; category?: string };

/** "console" (print to terminal) or "resend". Defaults to resend whenever RESEND_API_KEY is set. */
function provider(): string {
  return process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console");
}

/**
 * True on localhost when no real email service is configured: emails are only
 * printed to the terminal, so OTP codes are also shown on screen for testing.
 */
export function emailIsSimulated(): boolean {
  return provider() === "console" && process.env.NODE_ENV !== "production";
}

/**
 * Sends one email. Throws an Error whose message holds only the provider's reason
 * (never the subject or body, so OTP codes can't end up in logs).
 */
async function send(mail: Mail, opts: SendOptions = {}): Promise<void> {
  const p = provider();
  if (p === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("No email provider configured in production (set RESEND_API_KEY).");
    }
    console.log(`\n[email:console] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  if (p === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("Resend missing_api_key: RESEND_API_KEY is not set");
    const resend = new Resend(process.env.RESEND_API_KEY);
    let result: Awaited<ReturnType<typeof resend.emails.send>>;
    try {
      result = await resend.emails.send({
        from: opts.from ?? process.env.EMAIL_FROM ?? "IOIT Print Anywhere <onboarding@resend.dev>",
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: opts.category ? [{ name: "category", value: opts.category }] : undefined,
      });
    } catch (err) {
      // Network failure, timeout, etc.
      throw new Error(`Resend request failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    if (result.error) {
      const { name, statusCode, message } = result.error;
      throw new Error(`Resend ${name} (${statusCode ?? "no status"}): ${message}`);
    }
    return;
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${p}"`);
}

/** Never let an email failure break the order flow; log it instead. */
async function sendSafely(mail: Mail, category: string) {
  try {
    await send(mail, { category });
  } catch (err) {
    console.error(`[email] could not send ${category} email:`, err instanceof Error ? err.message : "unknown error");
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f5f4;padding:24px">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:28px">
  <h2 style="margin:0 0 16px">${title}</h2>${body}
  <p style="color:#78716c;font-size:12px;margin-top:28px">IOIT Print Anywhere</p></div></body></html>`;
}

function codeBlock(code: string) {
  return `<div style="font-size:36px;font-weight:bold;letter-spacing:4px;text-align:center;border:3px solid #111;border-radius:10px;padding:14px;margin:16px 0">${escapeHtml(code)}</div>`;
}

// ---------- Account emails ----------

export function buildOtpEmail(to: string, code: string, purpose: "SIGNUP" | "RESET"): Mail {
  const action = purpose === "SIGNUP" ? "create your IOIT Print Anywhere account" : "reset your IOIT Print Anywhere password";
  return {
    to,
    // The code is deliberately not in the subject (it would show in notifications and provider logs).
    subject: purpose === "SIGNUP" ? "Your IOIT Print Anywhere sign-up code" : "Your IOIT Print Anywhere password reset code",
    text: `Use this code to ${action}: ${code}\n\nIt expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
    html: layout(
      "Your verification code",
      `<p>Use this code to ${action}:</p>${codeBlock(code)}<p>It expires in <b>5 minutes</b>. Don't share it with anyone.</p><p style="color:#78716c;font-size:13px">If you didn't ask for this code, you can ignore this email.</p>`,
    ),
  };
}

/** Sent instead of a sign-up code when the email already has an account (the website never says so). */
export function buildAccountExistsEmail(to: string, appUrl: string): Mail {
  return {
    to,
    subject: "Your IOIT Print Anywhere sign-up code",
    text: `Someone (hopefully you) tried to create an IOIT Print Anywhere account with this email, but you already have one.\n\nLog in: ${appUrl}/login\nForgot your password? ${appUrl}/forgot-password\n\nIf this wasn't you, you can ignore this email.`,
    html: layout(
      "You already have an account",
      `<p>Someone (hopefully you) tried to create an IOIT Print Anywhere account with this email, but you already have one.</p>
      <p><a href="${appUrl}/login" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Log in</a></p>
      <p>Forgot your password? <a href="${appUrl}/forgot-password">Reset it here</a>.</p>
      <p style="color:#78716c;font-size:13px">If this wasn't you, you can ignore this email.</p>`,
    ),
  };
}

/** Sends an OTP from OTP_FROM. Unlike the other emails this throws on failure, so the form can tell the student. */
export async function sendOtpEmail(to: string, code: string, purpose: "SIGNUP" | "RESET") {
  await send(buildOtpEmail(to, code, purpose), { from: env.otpFrom(), category: "otp" });
}

/** Throws on failure (same as sendOtpEmail) so both paths behave identically. */
export async function sendAccountExistsEmail(to: string) {
  await send(buildAccountExistsEmail(to, env.appUrl()), { from: env.otpFrom(), category: "otp" });
}

type WelcomeMail = { to: string; name: string; prn: string; department: string; appUrl: string };

export function buildWelcomeEmail(w: WelcomeMail): Mail {
  return {
    to: w.to,
    subject: "Welcome to IOIT Print Anywhere 🎉",
    text: `Hi ${w.name},\n\nYour IOIT Print Anywhere account is ready (PRN ${w.prn}, ${w.department}).\n\nHow it works:\n1. Upload a PDF, choose pages and copies (A4, black & white).\n2. Pay with UPI — you'll get a printing code.\n3. We email you when it's ready. Show the code and your college ID at the desk.\n\nLog in any time with your email or PRN: ${w.appUrl}/login`,
    html: layout(
      `Welcome, ${escapeHtml(w.name.split(" ")[0])}!`,
      `<p>Your IOIT Print Anywhere account is ready.</p>
      <p style="background:#f5f5f4;border-radius:8px;padding:10px 14px;font-size:14px">PRN <b>${escapeHtml(w.prn)}</b> · ${escapeHtml(w.department)}</p>
      <p><b>How it works</b></p>
      <ol style="padding-left:20px;line-height:1.7">
        <li>Upload a PDF and choose pages &amp; copies — A4, black &amp; white.</li>
        <li>Pay with UPI and get your <b>printing code</b>.</li>
        <li>We'll email you when it's ready. Show the code and your college ID at the desk.</li>
      </ol>
      <p><a href="${w.appUrl}/dashboard" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open my dashboard</a></p>
      <p style="color:#78716c;font-size:13px">Log in any time with your email or PRN.</p>`,
    ),
  };
}

export function sendWelcomeEmail(w: WelcomeMail) {
  return sendSafely(buildWelcomeEmail(w), "welcome");
}

// ---------- Order emails ----------

type OrderMail = { to: string; name: string; code: string; fileName: string; amount: string; orderUrl: string };

export function sendPaymentReceivedEmail(o: OrderMail) {
  return sendSafely({
    to: o.to,
    subject: `Payment received — your printing code is ${o.code}`,
    text: `Hi ${o.name},\n\nWe received ${o.amount} for "${o.fileName}".\nYour printing code: ${o.code}\n\nWe'll email you again when your prints are ready. Bring your college ID card to collect them.\n\n${o.orderUrl}`,
    html: layout(
      "Payment received",
      `<p>Hi ${escapeHtml(o.name)},</p><p>We received <b>${escapeHtml(o.amount)}</b> for <b>${escapeHtml(o.fileName)}</b>. Your printing code:</p>${codeBlock(o.code)}<p>We'll email you again when your prints are ready. Bring your <b>college ID card</b> to collect them.</p><p><a href="${o.orderUrl}">View order</a></p>`,
    ),
  }, "payment-received");
}

export function sendPrintsReadyEmail(o: OrderMail) {
  return sendSafely({
    to: o.to,
    subject: `Your prints are ready — code ${o.code}`,
    text: `Hi ${o.name},\n\nYour prints of "${o.fileName}" are ready for pickup.\nPrinting code: ${o.code}\n\nShow this code and your college ID card at the desk.\n\n${o.orderUrl}`,
    html: layout(
      "Your prints are ready 🎉",
      `<p>Hi ${escapeHtml(o.name)},</p><p>Your prints of <b>${escapeHtml(o.fileName)}</b> are ready for pickup.</p>${codeBlock(o.code)}<p>Show this code and your <b>college ID card</b> at the desk.</p><p><a href="${o.orderUrl}">View order</a></p>`,
    ),
  }, "prints-ready");
}
