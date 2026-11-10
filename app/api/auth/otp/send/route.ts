import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { issueOtp } from "@/lib/otp";
import { OTP_COOLDOWN_MS, domainRestrictionMessage, emailDomainAllowed, maskEmail, parseAllowedDomains } from "@/lib/otpPolicy";
import { readJson, rejectUnsafeJsonRequest } from "@/lib/requestGuard";

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/**
 * POST /api/auth/otp/send  { email }
 * Emails a 6-digit sign-up code. The response is the same whether or not the email is
 * already registered (registered emails get a "you already have an account" email instead).
 */
export async function POST(req: Request) {
  const blocked = rejectUnsafeJsonRequest(req);
  if (blocked) return blocked;

  const parsed = emailSchema.safeParse((await readJson(req)).email);
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data;

  const allowed = parseAllowedDomains(env.allowedEmailDomain());
  if (!emailDomainAllowed(email, allowed)) {
    return Response.json({ error: domainRestrictionMessage(allowed) }, { status: 400 });
  }

  const accountExists = Boolean(await db.user.findUnique({ where: { email }, select: { id: true } }));
  const sent = await issueOtp(email, "SIGNUP", { accountExists });
  if (!sent.ok) {
    const headers = sent.retryAfterSeconds ? { "Retry-After": String(sent.retryAfterSeconds) } : undefined;
    return Response.json({ error: sent.error, retryAfterSeconds: sent.retryAfterSeconds }, { status: sent.status, headers });
  }
  return Response.json({
    ok: true,
    sentTo: maskEmail(email),
    cooldownSeconds: OTP_COOLDOWN_MS / 1000,
    devCode: sent.devCode, // localhost without Resend only
  });
}
