import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  sessionSecret: () => required("SESSION_SECRET"),
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
