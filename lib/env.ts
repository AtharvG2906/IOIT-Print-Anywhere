import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  sessionSecret: () => required("SESSION_SECRET"),
  /** Key for HMAC-SHA256 hashing of OTP codes and the "verified email" cookie. */
  otpSecret: () => required("OTP_SECRET"),
  /** Sender for OTP emails (falls back to EMAIL_FROM). Must be on a domain verified in Resend. */
  otpFrom: () => process.env.OTP_FROM || process.env.EMAIL_FROM || "IOIT Print Anywhere <onboarding@resend.dev>",
  /** Comma-separated sign-up domains; empty = anyone can sign up. */
  allowedEmailDomain: () => process.env.ALLOWED_EMAIL_DOMAIN ?? "",
  adminEmails: () =>
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  agentApiKey: () => required("AGENT_API_KEY"),
  cronSecret: () => process.env.CRON_SECRET ?? "",
  razorpay: () => ({
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  }),
  /** Without Razorpay keys (and outside production) payments are simulated. */
  paymentsMock: () =>
    !process.env.RAZORPAY_KEY_ID && process.env.NODE_ENV !== "production",
};
